/**
 * Season-wide highlights: champions, top scorers, biggest upsets, records.
 * Powers the panel on `/poprzednie-sezony/[id]` and teasers on `/poprzednie-sezony`.
 */

import { prisma } from '@/lib/db'
import {
  matchOutcome,
  parseMargin,
  isHalved,
  isRetired,
} from '@/lib/match-play-utils'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ChampionEntry {
  bracketName: string // e.g. "Pierwsza Liga Playoff"
  championId: number
  championName: string
  championSlug: string
  runnerUpId: number | null
  runnerUpName: string | null
  runnerUpSlug: string | null
  finalResultCode: string | null
}

export interface TopScorerEntry {
  playerId: number
  playerName: string
  playerSlug: string
  value: number
}

export interface BiggestUpsetEntry {
  winnerId: number
  winnerName: string
  winnerSlug: string
  winnerHcp: number
  loserId: number
  loserName: string
  loserSlug: string
  loserHcp: number
  hcpGap: number
  resultCode: string
  roundName: string
  groupName: string
}

export interface SeasonHighlights {
  seasonId: number
  seasonName: string
  year: number

  // Core metrics
  totalMatches: number
  playedMatches: number
  avgHcp: number | null
  halvedRate: number // %
  walkoverRate: number // %
  uniquePlayers: number

  // Champions per bracket
  champions: ChampionEntry[]

  // Top performers
  topBirdieScorers: TopScorerEntry[] // top 3
  topWinRate: TopScorerEntry[] // top 3 by win %
  biggestUpset: BiggestUpsetEntry | null

  // Records
  longestMatchCode: string | null // e.g. "9&8" — biggest margin in the season
  longestMatchWinnerName: string | null
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

export async function getSeasonHighlights(seasonId: number): Promise<SeasonHighlights | null> {
  const season = await prisma.season.findUnique({
    where: { id: seasonId },
    select: { id: true, name: true, year: true },
  })
  if (!season) return null

  const [matches, groupPlayers] = await Promise.all([
    prisma.match.findMany({
      where: { group: { round: { seasonId } } },
      include: {
        group: {
          include: {
            round: { select: { id: true, name: true, type: true, roundNumber: true } },
          },
        },
        player1: { select: { id: true, firstName: true, lastName: true, slug: true } },
        player2: { select: { id: true, firstName: true, lastName: true, slug: true } },
      },
    }),
    prisma.groupPlayer.findMany({
      where: { group: { round: { seasonId } } },
      include: {
        player: { select: { id: true, firstName: true, lastName: true, slug: true } },
        group: { include: { round: { select: { type: true } } } },
      },
    }),
  ])

  // ---------------------------
  // Core counters
  // ---------------------------
  const totalMatches = matches.length
  const played = matches.filter((m) => m.played)
  const halved = played.filter((m) => isHalved(m.resultCode)).length
  const walkovers = played.filter((m) => m.isWalkover).length
  const halvedRate = played.length ? Math.round((halved / played.length) * 1000) / 10 : 0
  const walkoverRate = played.length ? Math.round((walkovers / played.length) * 1000) / 10 : 0

  // Avg HCP across all GroupPlayer records with an HCP
  const hcps = groupPlayers
    .filter((gp) => gp.group.round.type === 'ROUND_ROBIN')
    .map((gp) => (gp.hcpAtStart !== null ? Number(gp.hcpAtStart) : null))
    .filter((n): n is number => n !== null)
  const avgHcp = hcps.length ? Math.round((hcps.reduce((a, b) => a + b, 0) / hcps.length) * 10) / 10 : null

  // Unique players
  const uniquePlayers = new Set(groupPlayers.map((gp) => gp.playerId)).size

  // ---------------------------
  // Champions per bracket (playoff groups)
  // ---------------------------
  const playoffGroups = new Map<string, typeof matches>()
  for (const m of matches) {
    if (m.group.round.type !== 'PLAYOFF') continue
    const key = m.group.name
    const arr = playoffGroups.get(key) ?? []
    arr.push(m)
    playoffGroups.set(key, arr)
  }

  const champions: ChampionEntry[] = []
  for (const [bracketName, bracketMatches] of playoffGroups.entries()) {
    const maxRound = Math.max(...bracketMatches.map((m) => m.bracketRound ?? 0))
    const finalMatch = bracketMatches.find((m) => m.bracketRound === maxRound && m.played)
    if (!finalMatch || !finalMatch.winnerId) continue

    const champion = finalMatch.winnerId === finalMatch.player1Id ? finalMatch.player1 : finalMatch.player2
    const runnerUp = finalMatch.winnerId === finalMatch.player1Id ? finalMatch.player2 : finalMatch.player1

    champions.push({
      bracketName,
      championId: champion.id,
      championName: `${champion.firstName} ${champion.lastName}`,
      championSlug: champion.slug,
      runnerUpId: runnerUp.id,
      runnerUpName: `${runnerUp.firstName} ${runnerUp.lastName}`,
      runnerUpSlug: runnerUp.slug,
      finalResultCode: finalMatch.resultCode,
    })
  }
  // Order: Pierwsza Liga first, then Druga, Trzecia
  champions.sort((a, b) => {
    const order: Record<string, number> = {
      'Pierwsza Liga Playoff': 0,
      'Druga Liga Playoff': 1,
      'Trzecia Liga Playoff': 2,
    }
    return (order[a.bracketName] ?? 99) - (order[b.bracketName] ?? 99)
  })

  // ---------------------------
  // Top birdie scorers (sum across season)
  // ---------------------------
  const birdieMap = new Map<number, { player: { id: number; firstName: string; lastName: string; slug: string }; birdies: number }>()
  for (const m of played) {
    const p1 = m.player1
    const p2 = m.player2
    const prev1 = birdieMap.get(p1.id)
    const prev2 = birdieMap.get(p2.id)
    birdieMap.set(p1.id, { player: p1, birdies: (prev1?.birdies ?? 0) + m.player1Birdies })
    birdieMap.set(p2.id, { player: p2, birdies: (prev2?.birdies ?? 0) + m.player2Birdies })
  }
  const topBirdieScorers: TopScorerEntry[] = Array.from(birdieMap.values())
    .filter((x) => x.birdies > 0)
    .sort((a, b) => b.birdies - a.birdies)
    .slice(0, 3)
    .map((x) => ({
      playerId: x.player.id,
      playerName: `${x.player.firstName} ${x.player.lastName}`,
      playerSlug: x.player.slug,
      value: x.birdies,
    }))

  // ---------------------------
  // Top win rate (min 3 matches played)
  // ---------------------------
  const recordMap = new Map<number, { player: { id: number; firstName: string; lastName: string; slug: string }; wins: number; total: number }>()
  for (const m of played) {
    for (const side of ['p1', 'p2'] as const) {
      const p = side === 'p1' ? m.player1 : m.player2
      const rec = recordMap.get(p.id) ?? { player: p, wins: 0, total: 0 }
      rec.total++
      const outcome = matchOutcome(
        {
          player1Id: m.player1Id,
          player2Id: m.player2Id,
          winnerId: m.winnerId,
          resultCode: m.resultCode,
          isWalkover: m.isWalkover,
          played: m.played,
        },
        p.id,
      )
      if (outcome === 'win' || outcome === 'retired' || (outcome === 'walkover' && m.winnerId === p.id)) {
        rec.wins++
      }
      recordMap.set(p.id, rec)
    }
  }
  const topWinRate: TopScorerEntry[] = Array.from(recordMap.values())
    .filter((x) => x.total >= 3)
    .map((x) => ({
      playerId: x.player.id,
      playerName: `${x.player.firstName} ${x.player.lastName}`,
      playerSlug: x.player.slug,
      value: Math.round((x.wins / x.total) * 1000) / 10,
    }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 3)

  // ---------------------------
  // Biggest upset
  // ---------------------------
  const hcpByGP = new Map<string, number>() // key: groupId-playerId → hcpAtStart
  for (const gp of groupPlayers) {
    if (gp.hcpAtStart !== null) {
      hcpByGP.set(`${gp.groupId}-${gp.playerId}`, Number(gp.hcpAtStart))
    }
  }
  let biggestUpset: BiggestUpsetEntry | null = null
  for (const m of played) {
    if (m.isWalkover || isRetired(m.resultCode) || isHalved(m.resultCode)) continue
    if (!m.winnerId) continue
    const winnerIsP1 = m.winnerId === m.player1Id
    const winner = winnerIsP1 ? m.player1 : m.player2
    const loser = winnerIsP1 ? m.player2 : m.player1
    const winnerHcp = hcpByGP.get(`${m.groupId}-${winner.id}`)
    const loserHcp = hcpByGP.get(`${m.groupId}-${loser.id}`)
    if (winnerHcp === undefined || loserHcp === undefined) continue
    // Upset = winner had HIGHER hcp (worse) than loser
    if (winnerHcp > loserHcp) {
      const gap = winnerHcp - loserHcp
      if (!biggestUpset || gap > biggestUpset.hcpGap) {
        biggestUpset = {
          winnerId: winner.id,
          winnerName: `${winner.firstName} ${winner.lastName}`,
          winnerSlug: winner.slug,
          winnerHcp,
          loserId: loser.id,
          loserName: `${loser.firstName} ${loser.lastName}`,
          loserSlug: loser.slug,
          loserHcp,
          hcpGap: Math.round(gap * 10) / 10,
          resultCode: m.resultCode ?? '',
          roundName: m.group.round.name,
          groupName: m.group.name,
        }
      }
    }
  }

  // ---------------------------
  // Longest match (biggest numeric margin)
  // ---------------------------
  let longestMatch: { margin: number; code: string; winnerName: string } | null = null
  for (const m of played) {
    const margin = parseMargin(m.resultCode)
    if (margin === null || margin <= 0) continue
    if (!m.winnerId) continue
    const winner = m.winnerId === m.player1Id ? m.player1 : m.player2
    if (!longestMatch || margin > longestMatch.margin) {
      longestMatch = {
        margin,
        code: m.resultCode ?? '',
        winnerName: `${winner.firstName} ${winner.lastName}`,
      }
    }
  }

  return {
    seasonId: season.id,
    seasonName: season.name,
    year: season.year,
    totalMatches,
    playedMatches: played.length,
    avgHcp,
    halvedRate,
    walkoverRate,
    uniquePlayers,
    champions,
    topBirdieScorers,
    topWinRate,
    biggestUpset,
    longestMatchCode: longestMatch?.code ?? null,
    longestMatchWinnerName: longestMatch?.winnerName ?? null,
  }
}
