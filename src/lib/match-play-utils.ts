/**
 * Match Play code utilities.
 *
 * Match play results encode the margin of victory in a compact form:
 * - "A/S"  — halved (draw), margin 0
 * - "1Up"  — won by 1 hole on the 18th/9th
 * - "2Up"  — won by 2 holes (same as "2up" through course)
 * - "X&Y"  — won X holes up with Y holes remaining to play (classic match-play shorthand)
 * - "Ret"  — opponent retired during the round, margin unknown but a win
 *
 * These helpers are used by stats code, UI rendering, and OCR import validation.
 */

export type MatchOutcome =
  | 'win'
  | 'loss'
  | 'halved'
  | 'walkoverWin'
  | 'walkoverLoss'
  | 'retired' // player won because opponent retired
  | 'retiredLoss' // player lost because they retired
  | 'notPlayed'

/**
 * Parse the numeric margin (holes up) from a match-play result code.
 * Returns `null` for codes where the margin is undefined (Ret, WO, A/S).
 *
 * Examples:
 *   parseMargin("3&2")  → 3
 *   parseMargin("1Up")  → 1
 *   parseMargin("A/S")  → 0
 *   parseMargin("Ret")  → null
 *   parseMargin("WO")   → null
 */
export function parseMargin(code: string | null | undefined): number | null {
  if (!code) return null
  const normalized = code.trim()
  if (normalized === 'A/S') return 0
  if (normalized === 'Ret' || normalized === 'WO') return null

  // "1Up" / "2Up" / "1up" / "2up"
  const upMatch = /^(\d+)\s*[Uu]p$/.exec(normalized)
  if (upMatch) return parseInt(upMatch[1], 10)

  // "X&Y"
  const ampMatch = /^(\d+)\s*&\s*(\d+)$/.exec(normalized)
  if (ampMatch) return parseInt(ampMatch[1], 10)

  return null
}

/**
 * True when the code represents a halved (tied) match.
 */
export function isHalved(code: string | null | undefined): boolean {
  return code?.trim() === 'A/S'
}

/**
 * True when the code represents a retired match (opponent walked off).
 */
export function isRetired(code: string | null | undefined): boolean {
  return code?.trim() === 'Ret'
}

/**
 * True when the margin is at most 1 hole or the match was halved.
 * Useful for "close-match win rate" and nerve stats.
 */
export function isCloseResult(code: string | null | undefined): boolean {
  const m = parseMargin(code)
  return m !== null && m <= 1
}

/**
 * True when the margin is 4 holes or more — dominant win.
 */
export function isDecisiveWin(code: string | null | undefined): boolean {
  const m = parseMargin(code)
  return m !== null && m >= 4
}

/**
 * Derive the outcome of a match from the perspective of `playerId`.
 * Accepts minimal match data — pass whatever you have from Prisma.
 */
export function matchOutcome(
  match: {
    player1Id: number
    player2Id: number
    winnerId: number | null
    resultCode: string | null
    isWalkover: boolean
    played: boolean
  },
  playerId: number,
): MatchOutcome {
  if (!match.played) return 'notPlayed'
  if (match.isWalkover) {
    return match.winnerId === playerId ? 'walkoverWin' : 'walkoverLoss'
  }
  if (isHalved(match.resultCode)) return 'halved'
  if (isRetired(match.resultCode)) {
    return match.winnerId === playerId ? 'retired' : 'retiredLoss'
  }
  if (match.winnerId === playerId) return 'win'
  if (match.winnerId && match.winnerId !== playerId) return 'loss'
  return 'halved' // fallback: played but no winner + no known halved code
}

/**
 * Given a match from the perspective of `playerId`, return the margin won or lost.
 * Positive = `playerId` won by N holes; negative = lost by N holes; null = undefined (Ret/WO/unplayed).
 * 0 = halved.
 */
export function signedMargin(
  match: {
    player1Id: number
    player2Id: number
    winnerId: number | null
    resultCode: string | null
    isWalkover: boolean
    played: boolean
  },
  playerId: number,
): number | null {
  if (!match.played || match.isWalkover || isRetired(match.resultCode)) return null
  const m = parseMargin(match.resultCode)
  if (m === null) return null
  if (m === 0) return 0 // halved
  return match.winnerId === playerId ? m : -m
}

/**
 * Compute the longest consecutive winning streak from a chronologically ordered
 * list of outcomes.
 *
 * Counted as a win: `win`, `walkoverWin`, `retired` (opponent retired).
 * Counted as a loss (breaks streak): `loss`, `walkoverLoss`, `retiredLoss`.
 * `halved` breaks by default (configurable). `notPlayed` is skipped.
 */
export function longestWinStreak(
  outcomes: MatchOutcome[],
  opts: { breakOnHalved?: boolean } = {},
): number {
  const { breakOnHalved = true } = opts
  let best = 0
  let current = 0
  for (const o of outcomes) {
    if (o === 'win' || o === 'walkoverWin' || o === 'retired') {
      current++
      if (current > best) best = current
    } else if (o === 'notPlayed') {
      // Skip — doesn't affect streak.
    } else if (o === 'halved' && !breakOnHalved) {
      // Preserve streak.
    } else {
      // Any loss (loss, walkoverLoss, retiredLoss) or halved with break
      current = 0
    }
  }
  return best
}

/**
 * Human-readable label for a match result code in Polish.
 * Used for tooltips and stats rows.
 */
export function formatResultCodePl(code: string | null | undefined, holesPlayed?: number): string {
  if (!code) return '—'
  if (code === 'A/S') return 'A/S (remis)'
  if (code === 'Ret') return 'Poddał się'
  if (code === 'WO') return 'Walkower'
  const m = parseMargin(code)
  if (m !== null && m > 0) {
    const holesRem = /^\d+&(\d+)$/.exec(code)?.[1]
    if (holesRem) return `${code} (${m} dołki przewagi, ${holesRem} zostało)`
    return `${code} (${m} ${m === 1 ? 'dołek' : 'dołki'} przewagi)`
  }
  return code
}
