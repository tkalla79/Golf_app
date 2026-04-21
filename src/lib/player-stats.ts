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

  // Championships / finals / semifinals — scan playoff matches where player1Id or player2Id == playerId
  // and group name suggests Pierwsza Liga Playoff (bracket "1-16").
  // We identify the bracket by searching back in the groupPlayers array + matches.
  // Approach: for each (seasonId, groupName==Pierwsza Liga) compute final result from bracket rounds.
  for (const season of seasonsSet.values()) {
    const seasonPlayoffMatches = matches.filter(
      (m) => m.group.round.type === 'PLAYOFF' && m.group.round.season.id === season.seasonId,
    )
    if (seasonPlayoffMatches.length === 0) continue

    // Max bracketRound where the player participated
    const myPlayoffMatches = seasonPlayoffMatches.filter(
      (m) => m.player1Id === playerId || m.player2Id === playerId,
    )
    if (myPlayoffMatches.length === 0) continue
    const maxRound = Math.max(...myPlayoffMatches.map((m) => m.bracketRound ?? 0))

    // Was the player in the top bracket (Pierwsza Liga)? Check group name.
    const primaryLeagueMatches = myPlayoffMatches.filter(
      (m) =>
        m.group.name.toLowerCase().includes('pierwsza') ||
        m.group.name === '1-16' ||
        m.group.name.toLowerCase().includes('1-16'),
    )

    if (primaryLeagueMatches.length > 0) {
      const finalMatch = primaryLeagueMatches.find((m) => m.bracketRound === maxRound)
      if (finalMatch && finalMatch.played) {
        if (finalMatch.winnerId === playerId) championships++
        else finalsAppearances++
      }
      // Semifinal = one round below final
      const semi = primaryLeagueMatches.find((m) => m.bracketRound === maxRound - 1)
      if (semi && semi.winnerId !== playerId && semi.played) {
        // Lost in semifinal
        semifinalAppearances++
      }
    }
  }

  // Best finish — minimum finalPosition across seasons (with known rank)
  let bestFinish: CareerStats['bestFinish'] = null
  for (const gp of groupPlayers) {
    if (gp.finalPosition === null) continue
    const season = gp.group.round.season
    if (gp.group.round.type !== 'ROUND_ROBIN') continue // use RR standings, not playoff slots
    if (!bestFinish || gp.finalPosition < bestFinish.position) {
      bestFinish = {
        position: gp.finalPosition,
        seasonName: season.name,
        year: season.year,
      }
    }
  }

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

    // Round-robin final position: take the LOWEST finalPosition across RR rounds
    if (gp.group.round.type === 'ROUND_ROBIN' && gp.finalPosition !== null) {
      if (row.finalPosition === null || gp.finalPosition < row.finalPosition) {
        row.finalPosition = gp.finalPosition
      }
    }

    // Playoff bracket + result
    if (gp.group.round.type === 'PLAYOFF') {
      row.playoffBracket = gp.group.name
    }

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

    const maxRound = Math.max(...playoffMatches.map((m) => m.bracketRound ?? 0))
    const finalMatch = playoffMatches.find((m) => m.bracketRound === maxRound)
    if (finalMatch?.played) {
      if (finalMatch.winnerId === playerId) row.playoffResult = 'Mistrz'
      else row.playoffResult = 'Finalista'
    } else {
      // Find last played round
      const lastPlayed = playoffMatches.find((m) => m.played && m.winnerId && m.winnerId !== playerId)
      if (lastPlayed) {
        const roundFromTop = maxRound - (lastPlayed.bracketRound ?? 0)
        row.playoffResult =
          roundFromTop === 1 ? 'Półfinał' : roundFromTop === 2 ? 'Ćwierćfinał' : `1/${2 ** (roundFromTop + 1)}`
      }
    }
  }

  return Array.from(bySeason.values()).sort((a, b) => b.year - a.year)
}
