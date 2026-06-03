/**
 * Career and season-history statistics for a single player.
 *
 * All metrics are computed on-the-fly from Match / GroupPlayer records — no caching layer
 * in the DB itself; wrap callers with `unstable_cache` where needed.
 */

import { prisma } from '@/lib/db'
import {
  matchOutcome,
  signedMargin,
  parseMargin,
  isHalved,
  isRetired,
  longestWinStreak,
  type MatchOutcome,
} from '@/lib/match-play-utils'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface HeadToHeadEntry {
  opponentId: number
  opponentName: string
  opponentSlug: string
  played: number
  won: number
  lost: number
  halved: number
}

export interface CareerStats {
  playerId: number
  totalSeasons: number
  seasonsPlayed: Array<{ seasonId: number; seasonName: string; year: number }>

  // Headline record
  totalMatches: number
  wins: number
  losses: number
  halved: number
  walkoverWins: number
  walkoverLosses: number
  retiredWins: number
  retiredLosses: number

  // Percentages (0-100, rounded to 1 decimal)
  winPercentage: number
  halvedRate: number

  // Scoring
  bigPointsTotal: number
  smallPointsTotal: number
  birdies: number

  // Margins (only for matches with a numeric margin)
  avgMarginOfVictory: number | null
  biggestWinMargin: number | null
  biggestWinCode: string | null
  biggestLossMargin: number | null
  biggestLossCode: string | null

  // Streaks
  longestWinStreak: number

  // Close & decisive performance
  closeMatchesPlayed: number
  closeMatchesWon: number

  // HCP-based upsets (wins vs opponent with lower/better HCP at start of round)
  upsetAttempts: number // matches where opponent had lower HCP
  upsets: number // wins among those

  // Playoff pedigree (computed from Round.type === PLAYOFF groups)
  playoffAppearances: number
  championships: number
  finalsAppearances: number
  semifinalAppearances: number

  // Best season finish (lowest position number across seasons)
  bestFinish: { position: number; seasonName: string; year: number } | null

  // Head-to-head top 3 frequent opponents
  headToHead: HeadToHeadEntry[]
}

export interface SeasonHistoryRow {
  seasonId: number
  seasonName: string
  year: number
  matchesPlayed: number
  wins: number
  losses: number
  halved: number
  bigPoints: number
  smallPoints: number
  birdies: number
  finalPosition: number | null
  playoffBracket: string | null // e.g. "Pierwsza Liga Playoff"
  playoffResult: string | null // e.g. "Mistrz", "Finalista", "Półfinał", "1/8"
}

// ---------------------------------------------------------------------------
// Pure helpers (exported for unit testing — regression coverage for BUG #1, #2, #3)
// ---------------------------------------------------------------------------

/**
 * Minimal shape of a GroupPlayer-with-context needed for best-finish ranking.
 * BUG #3: previous logic skipped PLAYOFF, so multi-group RR season → every
 * group winner had bestFinish.position=1. Fix: prefer PLAYOFF position (true
 * season-final rank 1..N) over RR group position.
 */
export interface RankedGroupPlayer {
  finalPosition: number | null
  roundType: 'ROUND_ROBIN' | 'PLAYOFF'
  seasonId: number
  seasonName: string
  year: number
}

/**
 * Pick the best season-final rank across a player's career.
 *
 * Per-season priority:
 *   1) PLAYOFF finalPosition (canonical 1-N season rank from the playoff bracket)
 *   2) ROUND_ROBIN finalPosition (group position) — used only when the season had no playoff
 *
 * Returns the lowest (best) position across all seasons.
 */
export function pickBestFinish(
  groupPlayers: RankedGroupPlayer[],
): { position: number; seasonName: string; year: number } | null {
  // Step 1: per-season candidate (PLAYOFF beats RR).
  type Candidate = { position: number; seasonName: string; year: number; source: 'PLAYOFF' | 'ROUND_ROBIN' }
  const perSeason = new Map<number, Candidate>()

  for (const gp of groupPlayers) {
    if (gp.finalPosition === null) continue
    const existing = perSeason.get(gp.seasonId)

    if (gp.roundType === 'PLAYOFF') {
      // Playoff trumps RR for the same season. Among multiple PLAYOFF entries
      // (e.g. semis bracket vs main) keep the lowest position.
      if (!existing || existing.source !== 'PLAYOFF' || gp.finalPosition < existing.position) {
        perSeason.set(gp.seasonId, {
          position: gp.finalPosition,
          seasonName: gp.seasonName,
          year: gp.year,
          source: 'PLAYOFF',
        })
      }
    } else if (gp.roundType === 'ROUND_ROBIN') {
      // Use RR only if no PLAYOFF candidate yet.
      if (!existing) {
        perSeason.set(gp.seasonId, {
          position: gp.finalPosition,
          seasonName: gp.seasonName,
          year: gp.year,
          source: 'ROUND_ROBIN',
        })
      } else if (existing.source === 'ROUND_ROBIN' && gp.finalPosition < existing.position) {
        // Multiple RR rounds in one season — keep best group position.
        existing.position = gp.finalPosition
      }
    }
  }

  // Step 2: lowest position across seasons.
  let best: { position: number; seasonName: string; year: number } | null = null
  for (const candidate of perSeason.values()) {
    if (!best || candidate.position < best.position) {
      best = {
        position: candidate.position,
        seasonName: candidate.seasonName,
        year: candidate.year,
      }
    }
  }
  return best
}

/**
 * Pick the final position for ONE season — used in `getSeasonHistory`.
 * Same priority as `pickBestFinish` (PLAYOFF over RR).
 */
export function pickSeasonFinalPosition(
  groupPlayersForSeason: Array<{ finalPosition: number | null; roundType: 'ROUND_ROBIN' | 'PLAYOFF' }>,
): number | null {
  let playoffBest: number | null = null
  let rrBest: number | null = null
  for (const gp of groupPlayersForSeason) {
    if (gp.finalPosition === null) continue
    if (gp.roundType === 'PLAYOFF') {
      if (playoffBest === null || gp.finalPosition < playoffBest) playoffBest = gp.finalPosition
    } else if (gp.roundType === 'ROUND_ROBIN') {
      if (rrBest === null || gp.finalPosition < rrBest) rrBest = gp.finalPosition
    }
  }
  return playoffBest ?? rrBest
}

/**
 * Minimal shape of a playoff match needed by the bracket helpers.
 * Keep narrow so test fixtures don't need full Prisma `Match` rows.
 */
export interface PlayoffMatchLike {
  player1Id: number
  player2Id: number
  winnerId: number | null
  played: boolean
  bracketRound: number | null
  bracketPosition: number | null
}

/**
 * Evaluate a player's pedigree in a SINGLE bracket (e.g. Pierwsza Liga Playoff).
 *
 * Used by `getCareerStats`. Iterating per-bracket (BUG #2 fix) lets winners of
 * secondary brackets (Druga/Trzecia Liga) count championships too.
 *
 * Returns 0/1 flags so caller can sum across brackets.
 */
export function evaluatePlayerInBracket(
  playerId: number,
  bracketMatches: PlayoffMatchLike[],
): { championship: 0 | 1; finalist: 0 | 1; semifinalist: 0 | 1 } {
  if (bracketMatches.length === 0) {
    return { championship: 0, finalist: 0, semifinalist: 0 }
  }
  const maxBracketRound = Math.max(...bracketMatches.map((m) => m.bracketRound ?? 0))

  const finalMatch = bracketMatches.find(
    (m) => m.bracketRound === maxBracketRound && m.bracketPosition === 1,
  )

  let championship: 0 | 1 = 0
  let finalist: 0 | 1 = 0
  if (finalMatch?.played) {
    if (finalMatch.winnerId === playerId) {
      championship = 1
    } else if (finalMatch.player1Id === playerId || finalMatch.player2Id === playerId) {
      finalist = 1
    }
  }

  const semiMatches = bracketMatches.filter(
    (m) =>
      m.bracketRound === maxBracketRound - 1 &&
      (m.bracketPosition === 1 || m.bracketPosition === 2) &&
      m.played &&
      m.winnerId !== playerId &&
      (m.player1Id === playerId || m.player2Id === playerId),
  )
  const semifinalist: 0 | 1 = semiMatches.length > 0 ? 1 : 0

  return { championship, finalist, semifinalist }
}

/**
 * Resolve playoff result LABEL for a single season's bracket appearance.
 * Used by `getSeasonHistory`.
 *
 * Input: playoff matches for ONE bracket, ordered by bracketRound DESC.
 *
 * Returns: 'Mistrz' | 'Finalista' | 'Półfinał' | 'Ćwierćfinał' | '1/X' | null
 *
 * FIX (BUG #1): `.find()` for last-played must check participation; without
 * the participant filter, a non-participated match could be returned.
 */
export function resolvePlayoffResultLabel(
  playerId: number,
  playoffMatchesDesc: PlayoffMatchLike[],
): string | null {
  if (playoffMatchesDesc.length === 0) return null

  const maxRound = Math.max(...playoffMatchesDesc.map((m) => m.bracketRound ?? 0))

  const finalMatch = playoffMatchesDesc.find(
    (m) => m.bracketRound === maxRound && m.bracketPosition === 1,
  )
  if (
    finalMatch?.played &&
    (finalMatch.player1Id === playerId || finalMatch.player2Id === playerId)
  ) {
    return finalMatch.winnerId === playerId ? 'Mistrz' : 'Finalista'
  }

  const lastPlayed = playoffMatchesDesc.find(
    (m) =>
      m.played &&
      (m.player1Id === playerId || m.player2Id === playerId) &&
      m.winnerId !== null &&
      m.winnerId !== playerId,
  )
  if (!lastPlayed) return null

  const roundFromTop = maxRound - (lastPlayed.bracketRound ?? 0)
  if (roundFromTop === 1) return 'Półfinał'
  if (roundFromTop === 2) return 'Ćwierćfinał'
  return `1/${2 ** (roundFromTop + 1)}`
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Fetch all matches the player participated in, across all seasons.
 * Ordered by seasonId ASC, then roundNumber ASC, then match createdAt ASC
 * so streak calculations use chronological order.
 */
async function fetchAllPlayerMatches(playerId: number) {
  return prisma.match.findMany({
    where: {
      OR: [{ player1Id: playerId }, { player2Id: playerId }],
      played: true,
    },
    include: {
      group: {
        include: {
          round: {
            include: {
              season: { select: { id: true, name: true, year: true, status: true } },
            },
          },
        },
      },
      player1: { select: { id: true, firstName: true, lastName: true, slug: true } },
      player2: { select: { id: true, firstName: true, lastName: true, slug: true } },
    },
    orderBy: [
      { group: { round: { season: { year: 'asc' } } } },
      { group: { round: { roundNumber: 'asc' } } },
      { createdAt: 'asc' },
    ],
  })
}

/**
 * Fetch GroupPlayer records for the player — used to read HCP-at-start and finalPosition.
 */
async function fetchPlayerGroupPlayers(playerId: number) {
  return prisma.groupPlayer.findMany({
    where: { playerId },
    include: {
      group: {
        include: {
          round: {
            include: {
              season: { select: { id: true, name: true, year: true, status: true } },
            },
          },
        },
      },
    },
  })
}

/**
 * Fetch HCP snapshots for all OTHER players in the same groups as this player.
 * Returns map: `${groupId}-${playerId}` → hcpAtStart (number | null).
 */
async function fetchOpponentHcpSnapshots(groupIds: number[]) {
  if (groupIds.length === 0) return new Map<string, number | null>()
  const rows = await prisma.groupPlayer.findMany({
    where: { groupId: { in: groupIds } },
    select: { groupId: true, playerId: true, hcpAtStart: true },
  })
  const map = new Map<string, number | null>()
  for (const r of rows) {
    map.set(`${r.groupId}-${r.playerId}`, r.hcpAtStart !== null ? Number(r.hcpAtStart) : null)
  }
  return map
}

// ---------------------------------------------------------------------------
// Main: getCareerStats
// ---------------------------------------------------------------------------

export async function getCareerStats(playerId: number): Promise<CareerStats> {
  const [matches, groupPlayers] = await Promise.all([
    fetchAllPlayerMatches(playerId),
    fetchPlayerGroupPlayers(playerId),
  ])

  const groupIds = Array.from(new Set(matches.map((m) => m.groupId)))
  const hcpMap = await fetchOpponentHcpSnapshots(groupIds)

  // Init accumulators
  let wins = 0,
    losses = 0,
    halved = 0,
    walkoverWins = 0,
    walkoverLosses = 0,
    retiredWins = 0,
    retiredLosses = 0
  let bigPoints = 0,
    smallPoints = 0,
    birdies = 0
  let closeMatchesPlayed = 0,
    closeMatchesWon = 0
  let upsetAttempts = 0,
    upsets = 0

  const winMargins: number[] = []
  const lossMargins: number[] = []
  let biggestWin: { margin: number; code: string } | null = null
  let biggestLoss: { margin: number; code: string } | null = null

  const outcomeTimeline: MatchOutcome[] = []
  const h2h = new Map<number, HeadToHeadEntry>()

  const seasonsSet = new Map<number, { seasonId: number; seasonName: string; year: number }>()

  // Playoff tracking — group by (seasonId, groupName/bracketName)
  let playoffAppearances = 0
  let championships = 0
  let finalsAppearances = 0
  let semifinalAppearances = 0
  const playoffSeensSeasons = new Set<number>()

  for (const m of matches) {
    const isP1 = m.player1Id === playerId
    const opponent = isP1 ? m.player2 : m.player1
    const outcome = matchOutcome(
      {
        player1Id: m.player1Id,
        player2Id: m.player2Id,
        winnerId: m.winnerId,
        resultCode: m.resultCode,
        isWalkover: m.isWalkover,
        played: m.played,
      },
      playerId,
    )
    outcomeTimeline.push(outcome)

    // Season set
    const season = m.group.round.season
    if (season) {
      seasonsSet.set(season.id, {
        seasonId: season.id,
        seasonName: season.name,
        year: season.year,
      })
    }

    // Points + birdies
    bigPoints += Number(isP1 ? m.player1BigPoints : m.player2BigPoints)
    smallPoints += isP1 ? m.player1SmallPoints : m.player2SmallPoints
    birdies += isP1 ? m.player1Birdies : m.player2Birdies

    // Outcome tallies — outcome already includes winner vs loser distinction
    if (outcome === 'win') wins++
    else if (outcome === 'loss') losses++
    else if (outcome === 'halved') halved++
    else if (outcome === 'walkoverWin') {
      walkoverWins++
      wins++
    } else if (outcome === 'walkoverLoss') {
      walkoverLosses++
      losses++
    } else if (outcome === 'retired') {
      retiredWins++
      wins++
    } else if (outcome === 'retiredLoss') {
      retiredLosses++
      losses++
    }

    // Margin tracking (skip WO and Ret — undefined margin)
    if (!m.isWalkover && !isRetired(m.resultCode)) {
      const sm = signedMargin(
        {
          player1Id: m.player1Id,
          player2Id: m.player2Id,
          winnerId: m.winnerId,
          resultCode: m.resultCode,
          isWalkover: m.isWalkover,
          played: m.played,
        },
        playerId,
      )
      if (sm !== null && sm > 0) {
        winMargins.push(sm)
        if (!biggestWin || sm > biggestWin.margin) {
          biggestWin = { margin: sm, code: m.resultCode ?? '' }
        }
      } else if (sm !== null && sm < 0) {
        lossMargins.push(-sm)
        if (!biggestLoss || -sm > biggestLoss.margin) {
          biggestLoss = { margin: -sm, code: m.resultCode ?? '' }
        }
      }
    }

    // Close matches
    const numericMargin = parseMargin(m.resultCode)
    if (numericMargin !== null && numericMargin <= 1) {
      closeMatchesPlayed++
      if (outcome === 'win') closeMatchesWon++
    }

    // Upsets — compare HCP at start of the group. Upset = win vs opponent with LOWER HCP (better).
    const myHcp = hcpMap.get(`${m.groupId}-${playerId}`)
    const oppHcp = hcpMap.get(`${m.groupId}-${(isP1 ? m.player2Id : m.player1Id)}`)
    if (myHcp !== null && myHcp !== undefined && oppHcp !== null && oppHcp !== undefined) {
      if (oppHcp < myHcp) {
        upsetAttempts++
        if (outcome === 'win') upsets++
      }
    }

    // Head-to-head
    if (opponent) {
      const h = h2h.get(opponent.id) ?? {
        opponentId: opponent.id,
        opponentName: `${opponent.firstName} ${opponent.lastName}`,
        opponentSlug: opponent.slug,
        played: 0,
        won: 0,
        lost: 0,
        halved: 0,
      }
      h.played++
      if (outcome === 'win' || outcome === 'walkoverWin' || outcome === 'retired') {
        h.won++
      } else if (outcome === 'loss' || outcome === 'walkoverLoss' || outcome === 'retiredLoss') {
        h.lost++
      } else if (outcome === 'halved') {
        h.halved++
      }
      h2h.set(opponent.id, h)
    }

    // Playoff tracking
    if (m.group.round.type === 'PLAYOFF') {
      playoffSeensSeasons.add(season.id)
    }
  }
  playoffAppearances = playoffSeensSeasons.size

  // Championships / finals / semifinals — scan playoff matches where the player participated.
  //
  // FIX (BUG #2): Iterate ALL playoff brackets per season (Pierwsza/Druga/Trzecia Liga).
  // Previous version filtered only "Pierwsza Liga" — so winners of secondary brackets
  // (e.g. 2023 Druga Liga: 9-16, Trzecia Liga: 17-24) had championships=0 in career stats.
  // Now every player who wins their bracket's final → championships++.
  for (const season of seasonsSet.values()) {
    const myPlayoffMatches = matches.filter(
      (m) =>
        m.group.round.type === 'PLAYOFF' &&
        m.group.round.season.id === season.seasonId &&
        (m.player1Id === playerId || m.player2Id === playerId),
    )
    if (myPlayoffMatches.length === 0) continue

    // Group player's playoff matches by bracket name (Pierwsza/Druga/Trzecia Liga, or any custom)
    const byBracket = new Map<string, typeof myPlayoffMatches>()
    for (const m of myPlayoffMatches) {
      const key = m.group.name
      const arr = byBracket.get(key) ?? []
      arr.push(m)
      byBracket.set(key, arr)
    }

    // For each bracket the player participated in: check championship/finalist/semifinalist
    // Pure logic lives in `evaluatePlayerInBracket` — kept testable in isolation.
    for (const bracketMatches of byBracket.values()) {
      const pedigree = evaluatePlayerInBracket(playerId, bracketMatches)
      championships += pedigree.championship
      finalsAppearances += pedigree.finalist
      semifinalAppearances += pedigree.semifinalist
    }
  }

  // Best finish across seasons — see `pickBestFinish` for prioritization.
  // BUG #3 fix: previously skipped PLAYOFF and used only RR group position,
  // so every group winner in a multi-group season got bestFinish=1.
  const bestFinish: CareerStats['bestFinish'] = pickBestFinish(
    groupPlayers.map((gp) => ({
      finalPosition: gp.finalPosition,
      roundType: gp.group.round.type as 'ROUND_ROBIN' | 'PLAYOFF',
      seasonId: gp.group.round.season.id,
      seasonName: gp.group.round.season.name,
      year: gp.group.round.season.year,
    })),
  )

  const avgMargin = winMargins.length
    ? Math.round((winMargins.reduce((a, b) => a + b, 0) / winMargins.length) * 10) / 10
    : null

  const totalMatches = wins + losses + halved
  const winPercentage = totalMatches
    ? Math.round((wins / totalMatches) * 1000) / 10
    : 0
  const halvedRate = totalMatches
    ? Math.round((halved / totalMatches) * 1000) / 10
    : 0

  // Head-to-head: top 3 most frequent
  const headToHead = Array.from(h2h.values())
    .sort((a, b) => b.played - a.played)
    .slice(0, 3)

  return {
    playerId,
    totalSeasons: seasonsSet.size,
    seasonsPlayed: Array.from(seasonsSet.values()).sort((a, b) => b.year - a.year),
    totalMatches,
    wins,
    losses,
    halved,
    walkoverWins,
    walkoverLosses,
    retiredWins,
    retiredLosses,
    winPercentage,
    halvedRate,
    bigPointsTotal: bigPoints,
    smallPointsTotal: smallPoints,
    birdies,
    avgMarginOfVictory: avgMargin,
    biggestWinMargin: biggestWin?.margin ?? null,
    biggestWinCode: biggestWin?.code ?? null,
    biggestLossMargin: biggestLoss?.margin ?? null,
    biggestLossCode: biggestLoss?.code ?? null,
    longestWinStreak: longestWinStreak(outcomeTimeline),
    closeMatchesPlayed,
    closeMatchesWon,
    upsetAttempts,
    upsets,
    playoffAppearances,
    championships,
    finalsAppearances,
    semifinalAppearances,
    bestFinish,
    headToHead,
  }
}

// ---------------------------------------------------------------------------
// getSeasonHistory — per-season breakdown for a player
// ---------------------------------------------------------------------------

export async function getSeasonHistory(playerId: number): Promise<SeasonHistoryRow[]> {
  const gps = await prisma.groupPlayer.findMany({
    where: { playerId },
    include: {
      group: {
        include: {
          round: {
            include: {
              season: { select: { id: true, name: true, year: true, status: true } },
            },
          },
          matches: {
            where: {
              OR: [{ player1Id: playerId }, { player2Id: playerId }],
              played: true,
            },
          },
        },
      },
    },
  })

  // Aggregate by seasonId
  const bySeason = new Map<number, SeasonHistoryRow>()

  for (const gp of gps) {
    const season = gp.group.round.season
    if (season.status === 'DRAFT') continue

    const row = bySeason.get(season.id) ?? {
      seasonId: season.id,
      seasonName: season.name,
      year: season.year,
      matchesPlayed: 0,
      wins: 0,
      losses: 0,
      halved: 0,
      bigPoints: 0,
      smallPoints: 0,
      birdies: 0,
      finalPosition: null,
      playoffBracket: null,
      playoffResult: null,
    }

    // Playoff bracket name (for label resolution below)
    if (gp.group.round.type === 'PLAYOFF') {
      row.playoffBracket = gp.group.name
    }
    // finalPosition resolved AFTER the loop (PLAYOFF priority over RR — see pickSeasonFinalPosition).

    // Tally matches
    for (const m of gp.group.matches) {
      const isP1 = m.player1Id === playerId
      const outcome = matchOutcome(
        {
          player1Id: m.player1Id,
          player2Id: m.player2Id,
          winnerId: m.winnerId,
          resultCode: m.resultCode,
          isWalkover: m.isWalkover,
          played: m.played,
        },
        playerId,
      )
      row.matchesPlayed++
      if (outcome === 'win' || outcome === 'walkoverWin' || outcome === 'retired') {
        row.wins++
      } else if (outcome === 'loss' || outcome === 'walkoverLoss' || outcome === 'retiredLoss') {
        row.losses++
      } else if (outcome === 'halved') {
        row.halved++
      }

      row.bigPoints += Number(isP1 ? m.player1BigPoints : m.player2BigPoints)
      row.smallPoints += isP1 ? m.player1SmallPoints : m.player2SmallPoints
      row.birdies += isP1 ? m.player1Birdies : m.player2Birdies
    }

    bySeason.set(season.id, row)
  }

  // BUG #3 fix: per-season finalPosition with PLAYOFF priority over RR group position.
  // Previously RR-only — every group winner showed "1" regardless of playoff outcome.
  for (const [seasonId, row] of bySeason.entries()) {
    const gpsForSeason = gps
      .filter((gp) => gp.group.round.season.id === seasonId)
      .map((gp) => ({
        finalPosition: gp.finalPosition,
        roundType: gp.group.round.type as 'ROUND_ROBIN' | 'PLAYOFF',
      }))
    row.finalPosition = pickSeasonFinalPosition(gpsForSeason)
  }

  // Resolve playoffResult for each season with playoff
  for (const row of bySeason.values()) {
    if (!row.playoffBracket) continue

    const playoffMatches = await prisma.match.findMany({
      where: {
        group: {
          round: { seasonId: row.seasonId, type: 'PLAYOFF' },
          name: row.playoffBracket,
        },
        OR: [{ player1Id: playerId }, { player2Id: playerId }],
      },
      orderBy: { bracketRound: 'desc' },
    })
    if (playoffMatches.length === 0) continue

    // Pure label-resolution lives in `resolvePlayoffResultLabel` (BUG #1 fix + tests).
    row.playoffResult = resolvePlayoffResultLabel(playerId, playoffMatches)
  }

  return Array.from(bySeason.values()).sort((a, b) => b.year - a.year)
}
