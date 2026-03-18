import { prisma } from './db'
import { computeStandings } from './standings'

export async function generateNextRoundGroups(roundId: number) {
  const round = await prisma.round.findUnique({
    where: { id: roundId },
    include: {
      groups: {
        include: {
          players: { include: { player: true } },
          matches: { include: { player1: true, player2: true } },
        },
        orderBy: { sortOrder: 'asc' },
      },
      season: true,
    },
  })

  if (!round) throw new Error('Runda nie znaleziona')

  // Compute standings for each group
  const groupStandings = round.groups.map((group) => ({
    groupName: group.name,
    standings: computeStandings(group.players, group.matches),
  }))

  // Determine max positions across groups
  const maxPositions = Math.max(
    ...groupStandings.map((g) => g.standings.length)
  )

  // Build new groups: position 1 from each group -> Group A, position 2 -> Group B, etc.
  const newGroups: Array<{
    name: string
    players: Array<{ playerId: number; firstName: string; lastName: string; hcp: number | null }>
  }> = []

  const groupLetters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'

  for (let pos = 0; pos < maxPositions; pos++) {
    const playersAtPosition = groupStandings
      .map((g) => g.standings[pos])
      .filter(Boolean)

    if (playersAtPosition.length > 0) {
      newGroups.push({
        name: `Grupa ${groupLetters[pos] || pos + 1}`,
        players: playersAtPosition.map((p) => ({
          playerId: p.playerId,
          firstName: p.firstName,
          lastName: p.lastName,
          hcp: p.hcpAtStart,
        })),
      })
    }
  }

  return newGroups
}

export function generateRoundRobinPairings(playerIds: number[]): Array<[number, number]> {
  const pairs: Array<[number, number]> = []
  for (let i = 0; i < playerIds.length; i++) {
    for (let j = i + 1; j < playerIds.length; j++) {
      pairs.push([playerIds[i], playerIds[j]])
    }
  }
  return pairs
}
