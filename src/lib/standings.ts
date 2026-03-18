import { Match, Player, GroupPlayer } from '@prisma/client'

export interface PlayerStanding {
  playerId: number
  firstName: string
  lastName: string
  slug: string
  played: number
  won: number
  drawn: number
  lost: number
  bigPoints: number
  smallPoints: number
  hcpAtStart: number | null
  position: number
  finalPosition: number | null
}

type MatchWithPlayers = Match & {
  player1: Player
  player2: Player
}

type GroupPlayerWithPlayer = GroupPlayer & {
  player: Player
}

export function computeStandings(
  groupPlayers: GroupPlayerWithPlayer[],
  matches: MatchWithPlayers[]
): PlayerStanding[] {
  const standings: Map<number, PlayerStanding> = new Map()

  for (const gp of groupPlayers) {
    standings.set(gp.playerId, {
      playerId: gp.playerId,
      firstName: gp.player.firstName,
      lastName: gp.player.lastName,
      slug: gp.player.slug,
      played: 0,
      won: 0,
      drawn: 0,
      lost: 0,
      bigPoints: 0,
      smallPoints: 0,
      hcpAtStart: gp.hcpAtStart ? Number(gp.hcpAtStart) : null,
      position: 0,
      finalPosition: gp.finalPosition,
    })
  }

  for (const match of matches) {
    if (!match.played) continue

    const p1 = standings.get(match.player1Id)
    const p2 = standings.get(match.player2Id)
    if (!p1 || !p2) continue

    p1.played++
    p2.played++
    p1.bigPoints += match.player1BigPoints
    p2.bigPoints += match.player2BigPoints
    p1.smallPoints += match.player1SmallPoints
    p2.smallPoints += match.player2SmallPoints

    if (match.winnerId === match.player1Id) {
      p1.won++
      p2.lost++
    } else if (match.winnerId === match.player2Id) {
      p2.won++
      p1.lost++
    } else {
      p1.drawn++
      p2.drawn++
    }
  }

  const sorted = Array.from(standings.values())

  sorted.sort((a, b) => {
    // 1. Big points descending
    if (b.bigPoints !== a.bigPoints) return b.bigPoints - a.bigPoints

    // 2. Head-to-head (only for 2-player tie)
    const h2h = getHeadToHead(a.playerId, b.playerId, matches)
    if (h2h !== 0) return h2h

    // 3. Small points descending
    if (b.smallPoints !== a.smallPoints) return b.smallPoints - a.smallPoints

    // 4. HCP - higher HCP = higher position (better ranking for weaker player)
    const aHcp = a.hcpAtStart ?? 0
    const bHcp = b.hcpAtStart ?? 0
    if (bHcp !== aHcp) return bHcp - aHcp

    return 0
  })

  sorted.forEach((s, i) => {
    s.position = s.finalPosition ?? i + 1
  })

  // Re-sort by final position if any are set manually
  sorted.sort((a, b) => a.position - b.position)

  return sorted
}

function getHeadToHead(
  playerAId: number,
  playerBId: number,
  matches: MatchWithPlayers[]
): number {
  const h2hMatch = matches.find(
    (m) =>
      m.played &&
      ((m.player1Id === playerAId && m.player2Id === playerBId) ||
        (m.player1Id === playerBId && m.player2Id === playerAId))
  )

  if (!h2hMatch || !h2hMatch.winnerId) return 0

  if (h2hMatch.winnerId === playerAId) return -1 // A wins -> A ranks higher
  if (h2hMatch.winnerId === playerBId) return 1  // B wins -> B ranks higher
  return 0
}
