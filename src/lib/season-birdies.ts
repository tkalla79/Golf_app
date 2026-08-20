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

export interface BirdieRankingRow {
  position: number
  playerId: number
  firstName: string
  lastName: string
  slug: string
  /** Suma birdie w sezonie: faza grupowa + playoff. */
  total: number
  groupPhase: number
  playoff: number
  matchesPlayed: number
  /** Birdie na mecz, zaokrąglone do 2 miejsc. */
  perMatch: number
}

/**
 * Klasyfikacja birdie za sezon — faza grupowa i playoff razem.
 *
 * Birdie z playoff dokładają się do dorobku z rund grupowych (nie zerują go),
 * dlatego zwracamy też rozbicie na fazy, żeby suma była weryfikowalna.
 *
 * Sortowanie: suma malejąco → mniej meczów wyżej (lepsza średnia) → nazwisko.
 */
export async function getBirdieRanking(seasonId: number): Promise<BirdieRankingRow[]> {
  const matches = await prisma.match.findMany({
    where: { group: { round: { seasonId } }, played: true },
    select: {
      player1Id: true,
      player2Id: true,
      player1Birdies: true,
      player2Birdies: true,
      player1: { select: { firstName: true, lastName: true, slug: true } },
      player2: { select: { firstName: true, lastName: true, slug: true } },
      group: { select: { round: { select: { type: true } } } },
    },
  })
  return buildBirdieRanking(matches)
}

/** Wiersz meczu potrzebny do klasyfikacji — tyle, ile wybiera `getBirdieRanking`. */
export interface BirdieMatchRow {
  player1Id: number
  player2Id: number
  player1Birdies: number
  player2Birdies: number
  player1: { firstName: string; lastName: string; slug: string }
  player2: { firstName: string; lastName: string; slug: string }
  group: { round: { type: string } }
}

/**
 * Czysta agregacja klasyfikacji birdie — wydzielona z `getBirdieRanking`,
 * żeby reguły sortowania i miejsc ex aequo dały się przetestować bez bazy.
 */
export function buildBirdieRanking(matches: BirdieMatchRow[]): BirdieRankingRow[] {
  interface Acc {
    playerId: number
    firstName: string
    lastName: string
    slug: string
    groupPhase: number
    playoff: number
    matchesPlayed: number
  }
  const acc = new Map<number, Acc>()

  const add = (
    playerId: number,
    player: { firstName: string; lastName: string; slug: string },
    birdies: number,
    isPlayoff: boolean,
  ) => {
    const row = acc.get(playerId) ?? {
      playerId,
      firstName: player.firstName,
      lastName: player.lastName,
      slug: player.slug,
      groupPhase: 0,
      playoff: 0,
      matchesPlayed: 0,
    }
    if (isPlayoff) row.playoff += birdies
    else row.groupPhase += birdies
    row.matchesPlayed += 1
    acc.set(playerId, row)
  }

  for (const m of matches) {
    const isPlayoff = m.group.round.type === 'PLAYOFF'
    // Mecze BYE mają tego samego gracza po obu stronach — liczymy raz, bez birdie.
    if (m.player1Id === m.player2Id) continue
    add(m.player1Id, m.player1, m.player1Birdies, isPlayoff)
    add(m.player2Id, m.player2, m.player2Birdies, isPlayoff)
  }

  const rows = Array.from(acc.values())
    .map((r) => {
      const total = r.groupPhase + r.playoff
      return {
        ...r,
        total,
        perMatch: r.matchesPlayed > 0 ? Math.round((total / r.matchesPlayed) * 100) / 100 : 0,
      }
    })
    .sort((a, b) => {
      if (b.total !== a.total) return b.total - a.total
      if (a.matchesPlayed !== b.matchesPlayed) return a.matchesPlayed - b.matchesPlayed
      return a.lastName.localeCompare(b.lastName, 'pl')
    })

  // Pozycje ex aequo: ta sama suma = ta sama pozycja
  let position = 0
  let prevTotal: number | null = null
  return rows.map((r, i) => {
    if (r.total !== prevTotal) {
      position = i + 1
      prevTotal = r.total
    }
    return { position, ...r }
  })
}
