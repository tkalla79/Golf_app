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

/**
 * Generate groups for rounds 3+ using promotion/relegation:
 * - Positions 1-2: promote one group up (stay if already in A)
 * - Position 3: stays in same group
 * - Positions 4-5: relegate one group down (stay if already in last group)
 *
 * Groups must be named "Grupa A", "Grupa B", etc. for this to work.
 */
export async function generatePromotionRelegation(roundId: number) {
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

  const groupLetters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'
  const numGroups = round.groups.length

  // Compute standings for each group, indexed by sortOrder
  const groupStandings = round.groups.map((group, groupIdx) => ({
    groupIdx,
    groupName: group.name,
    standings: computeStandings(group.players, group.matches),
  }))

  // Build new groups as arrays of players
  const newGroupPlayers: Array<Array<{ playerId: number; firstName: string; lastName: string; hcp: number | null }>> =
    Array.from({ length: numGroups }, () => [])

  for (const { groupIdx, standings } of groupStandings) {
    for (const player of standings) {
      const pos = player.position // 1-based position in group
      let targetGroup: number

      if (pos <= 2) {
        // Promote: move up one group (min = 0 = Grupa A)
        targetGroup = Math.max(0, groupIdx - 1)
      } else if (pos === 3) {
        // Stay in same group
        targetGroup = groupIdx
      } else {
        // Relegate: move down one group (max = numGroups-1 = last group)
        targetGroup = Math.min(numGroups - 1, groupIdx + 1)
      }

      newGroupPlayers[targetGroup].push({
        playerId: player.playerId,
        firstName: player.firstName,
        lastName: player.lastName,
        hcp: player.hcpAtStart,
      })
    }
  }

  // Build result array with balance warnings
  const targetSize = Math.round(groupStandings.reduce((sum, g) => sum + g.standings.length, 0) / numGroups)
  const newGroups = newGroupPlayers.map((players, i) => ({
    name: `Grupa ${groupLetters[i] || i + 1}`,
    players,
    warning: players.length !== targetSize
      ? `Nierówna liczba graczy (${players.length} zamiast ${targetSize}) - sprawdź i skoryguj ręcznie`
      : undefined,
  }))

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
