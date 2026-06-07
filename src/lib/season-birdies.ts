import { prisma } from '@/lib/db'

/**
 * Season-cumulative birdie totals per player (R1 + R2 + ... played matches).
 * Pass the result to `computeStandings(..., seasonBirdies)` so the birdie column
 * reflects season totals instead of just the current round.
 */
export async function getSeasonBirdies(seasonId: number): Promise<Map<number, number>> {
  const matches = await prisma.match.findMany({
    where: { group: { round: { seasonId } }, played: true },
    select: { player1Id: true, player2Id: true, player1Birdies: true, player2Birdies: true },
  })
  const totals = new Map<number, number>()
  for (const m of matches) {
    totals.set(m.player1Id, (totals.get(m.player1Id) ?? 0) + m.player1Birdies)
    totals.set(m.player2Id, (totals.get(m.player2Id) ?? 0) + m.player2Birdies)
  }
  return totals
}
