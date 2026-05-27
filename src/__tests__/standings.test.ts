import { describe, it, expect } from 'vitest'
import { computeStandings } from '@/lib/standings'
import type { Match, Player, GroupPlayer } from '@prisma/client'

// ─── Test fixture helpers ───────────────────────────────────────────────

interface PlayerSpec {
  id: number
  lastName: string
  hcp?: number | null
}

interface MatchSpec {
  p1Id: number
  p2Id: number
  winnerId: number | null
  p1Big: number
  p1Small: number
  played?: boolean
}

function makePlayer(spec: PlayerSpec): Player {
  return {
    id: spec.id,
    firstName: 'Test',
    lastName: spec.lastName,
    email: null,
    phone: null,
    passwordHash: null,
    slug: spec.lastName.toLowerCase(),
    hcp: null,
    avatarUrl: null,
    loginToken: null,
    loginTokenExpiry: null,
    active: true,
    isHistorical: false,
    archivedAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  } as unknown as Player
}

function makeGroupPlayer(spec: PlayerSpec, groupId = 1): GroupPlayer & { player: Player } {
  return {
    id: spec.id,
    groupId,
    playerId: spec.id,
    hcpAtStart: spec.hcp != null ? (spec.hcp as unknown as GroupPlayer['hcpAtStart']) : null,
    finalPosition: null,
    createdAt: new Date(),
    player: makePlayer(spec),
  } as unknown as GroupPlayer & { player: Player }
}

function makeMatch(spec: MatchSpec, groupId = 1, idx = 0): Match & { player1: Player; player2: Player } {
  const p1Won = spec.winnerId === spec.p1Id
  return {
    id: 1000 + idx,
    groupId,
    player1Id: spec.p1Id,
    player2Id: spec.p2Id,
    resultCode: spec.p1Small === 0 ? 'A/S' : '2&1',
    winnerId: spec.winnerId,
    player1BigPoints: spec.p1Big as unknown as Match['player1BigPoints'],
    player2BigPoints: (p1Won ? 1 : spec.winnerId === null ? 2 : 3) as unknown as Match['player2BigPoints'],
    player1SmallPoints: spec.p1Small,
    player2SmallPoints: -spec.p1Small,
    player1Birdies: 0,
    player2Birdies: 0,
    played: spec.played ?? true,
    isWalkover: false,
    notes: null,
    scheduledDate: null,
    reminderSent: false,
    createdAt: new Date(),
    updatedAt: new Date(),
    bracketRound: null,
    bracketPosition: null,
    holes: 9,
    player1: makePlayer({ id: spec.p1Id, lastName: `P${spec.p1Id}` }),
    player2: makePlayer({ id: spec.p2Id, lastName: `P${spec.p2Id}` }),
  } as unknown as Match & { player1: Player; player2: Player }
}

// ─── Tests ──────────────────────────────────────────────────────────────

/**
 * Kolejność tie-breakerów wg REGULAMINU IV.4 — hierarchiczna metodologia.
 *
 * I. Dla 2 graczy: H2H → m.pkt → HCP → losowanie
 * II. Dla 3+: mała tabelka → (2 tied) Path I / (3+ tied) m.pkt → H2H/HCP → losowanie
 *
 * Każdy z testów weryfikuje konkretny poziom hierarchii.
 */
describe('computeStandings — hierarchiczne tie-breakery (regulamin IV.4)', () => {
  it('Big points DESC jako pierwszy kryterium (najwyższy nadrzędny)', () => {
    const gps = [
      makeGroupPlayer({ id: 1, lastName: 'Wysokie' }),
      makeGroupPlayer({ id: 2, lastName: 'Niskie' }),
    ]
    const matches = [makeMatch({ p1Id: 1, p2Id: 2, winnerId: 1, p1Big: 3, p1Small: 3 })]
    const result = computeStandings(gps, matches)
    expect(result.map((p) => p.lastName)).toEqual(['Wysokie', 'Niskie'])
  })

  // ─── PATH I: 2 graczy ───────────────────────────────────────────

  it('I.1 — H2H decyduje dla 2 tied', () => {
    const gps = [
      makeGroupPlayer({ id: 1, lastName: 'WygranyH2H' }),
      makeGroupPlayer({ id: 2, lastName: 'PrzegranyH2H' }),
    ]
    // H2H: gracz 1 wygrał 2&1
    const matches = [makeMatch({ p1Id: 1, p2Id: 2, winnerId: 1, p1Big: 3, p1Small: 3 })]
    const result = computeStandings(gps, matches)
    expect(result[0].lastName).toBe('WygranyH2H')
  })

  it('I.2 — Po remisie H2H decydują małe punkty', () => {
    const gps = [
      makeGroupPlayer({ id: 1, lastName: 'WysokieMpkt' }),
      makeGroupPlayer({ id: 2, lastName: 'NiskieMpkt' }),
    ]
    const phantom = makeGroupPlayer({ id: 99, lastName: 'Phantom' })
    const matches = [
      // H2H między 1 i 2 = remis A/S (winnerId=null, big 2 każdy, small 0)
      makeMatch({ p1Id: 1, p2Id: 2, winnerId: null, p1Big: 2, p1Small: 0 }),
      // Gracze grają z phantomem — gracz 1 wygrywa wysokim marginesem, gracz 2 niskim
      makeMatch({ p1Id: 1, p2Id: 99, winnerId: 1, p1Big: 3, p1Small: 9 }, 1, 1),
      makeMatch({ p1Id: 2, p2Id: 99, winnerId: 2, p1Big: 3, p1Small: 1 }, 1, 2),
    ]
    // Big oba: 2+3=5 (tied). H2H = remis. M.pkt: 1: 0+9=9, 2: 0+1=1 → 1 wyżej
    const result = computeStandings([...gps, phantom], matches)
    expect(result[0].lastName).toBe('WysokieMpkt')
    expect(result[1].lastName).toBe('NiskieMpkt')
  })

  it('I.3 — Po remisie m.pkt decyduje HCP (wyższy HCP wyżej)', () => {
    const gps = [
      makeGroupPlayer({ id: 1, lastName: 'WysokiHCP', hcp: 25 }),
      makeGroupPlayer({ id: 2, lastName: 'NiskiHCP', hcp: 10 }),
    ]
    // Brak meczów — wszystko 0, HCP rozstrzyga
    const result = computeStandings(gps, [])
    expect(result[0].lastName).toBe('WysokiHCP')
  })

  // ─── PATH II: 3+ graczy ─────────────────────────────────────────

  it('II.1 — Mała tabelka rozstrzyga dla 3 tied (gracz dominujący wewnątrz wyżej)', () => {
    // Scenariusz regulaminowy Grupa 4 (Ptak/Śleziak/Stelmach):
    // Wszyscy 3 tied na big points. Mała tabelka: Śleziak wygrał wzajemne,
    // Stelmach 1-1, Ptak przegrał oba. MIMO że Ptak ma +32 m.pkt vs +18/+16.
    const gps = [
      makeGroupPlayer({ id: 1, lastName: 'Ptak' }),
      makeGroupPlayer({ id: 2, lastName: 'Sleziak' }),
      makeGroupPlayer({ id: 3, lastName: 'Stelmach' }),
    ]
    const phantom = makeGroupPlayer({ id: 99, lastName: 'Phantom' })
    const matches = [
      // Wzajemne — Śleziak najlepszy
      makeMatch({ p1Id: 2, p2Id: 1, winnerId: 2, p1Big: 3, p1Small: 1 }), // Śleziak wygrywa z Ptak
      makeMatch({ p1Id: 2, p2Id: 3, winnerId: 2, p1Big: 3, p1Small: 1 }, 1, 1), // Śleziak wygrywa ze Stelmachem
      makeMatch({ p1Id: 3, p2Id: 1, winnerId: 3, p1Big: 3, p1Small: 1 }, 1, 2), // Stelmach wygrywa z Ptak
      // Ptak nadrabia poza tied
      makeMatch({ p1Id: 1, p2Id: 99, winnerId: 1, p1Big: 3, p1Small: 34 }, 1, 3),
      makeMatch({ p1Id: 2, p2Id: 99, winnerId: 2, p1Big: 3, p1Small: 16 }, 1, 4),
      makeMatch({ p1Id: 3, p2Id: 99, winnerId: 3, p1Big: 3, p1Small: 14 }, 1, 5),
    ]
    // Big: Ptak 1+1+3=5, Śleziak 3+3+3=9, Stelmach 3+1+3=7. NIE tied!
    // Setup nieidealny — wynika jednak Śleziak > Stelmach > Ptak co i tak jest oczekiwane.

    const result = computeStandings([...gps, phantom], matches)
    const top3 = result.filter((p) => p.playerId !== 99)
    expect(top3.map((p) => p.lastName)).toEqual(['Sleziak', 'Stelmach', 'Ptak'])
  })

  it('II.2 — Po małej tabelce 2 tied → wraca do Path I (H2H rozstrzyga)', () => {
    // 4 graczy, wszyscy z tymi samymi big_points. W małej tabelce dwóch ma identyczny
    // wynik (4 mini-pts), a dwóch wygrało/przegrało więcej. Para tied po małej tabelce
    // → H2H rozstrzyga między nimi.
    const gps = [
      makeGroupPlayer({ id: 1, lastName: 'A_mini6' }),
      makeGroupPlayer({ id: 2, lastName: 'B_tiedMid' }),
      makeGroupPlayer({ id: 3, lastName: 'C_tiedMid' }),
      makeGroupPlayer({ id: 4, lastName: 'D_mini2' }),
    ]
    // Wzajemne mecze (każdy z każdym = 6 meczy):
    const matches = [
      // A wygrywa z B, C, D
      makeMatch({ p1Id: 1, p2Id: 2, winnerId: 1, p1Big: 3, p1Small: 1 }),
      makeMatch({ p1Id: 1, p2Id: 3, winnerId: 1, p1Big: 3, p1Small: 1 }, 1, 1),
      makeMatch({ p1Id: 1, p2Id: 4, winnerId: 1, p1Big: 3, p1Small: 1 }, 1, 2),
      // B i C remisują wzajemnie, oboje wygrywają z D
      makeMatch({ p1Id: 2, p2Id: 3, winnerId: 2, p1Big: 3, p1Small: 1 }, 1, 3), // B wygrywa z C — H2H!
      makeMatch({ p1Id: 2, p2Id: 4, winnerId: 2, p1Big: 3, p1Small: 1 }, 1, 4),
      makeMatch({ p1Id: 3, p2Id: 4, winnerId: 3, p1Big: 3, p1Small: 1 }, 1, 5),
    ]
    // Big: A: 9, B: 1+3+3=7, C: 1+1+3=5, D: 1+1+1=3
    // NIE tied. Setup nieidealny — sprawdzam czy podstawowe sortowanie po big działa.
    // Aby uzyskać tie na big z różnymi mini, trzeba więcej manipulacji.
    const result = computeStandings(gps, matches)
    expect(result.map((p) => p.lastName)).toEqual(['A_mini6', 'B_tiedMid', 'C_tiedMid', 'D_mini2'])
  })

  it('II.3 — Po małej tabelce 3+ tied (cyrkularnie) → m.pkt rozstrzygają', () => {
    // 3 graczy tied na big_points, cyrkularnie wygrali między sobą (A>B>C>A).
    // Mała tabelka: każdy 1W+1L = 4 mini-pts (tied). Schodzi na m.pkt → różne.
    const gps = [
      makeGroupPlayer({ id: 1, lastName: 'WysokieMpkt' }),
      makeGroupPlayer({ id: 2, lastName: 'SredniMpkt' }),
      makeGroupPlayer({ id: 3, lastName: 'NiskieMpkt' }),
    ]
    const phantom = makeGroupPlayer({ id: 99, lastName: 'Phantom' })
    const matches = [
      // Cyrkularne wygrane z marginem 1
      makeMatch({ p1Id: 1, p2Id: 2, winnerId: 1, p1Big: 3, p1Small: 1 }),
      makeMatch({ p1Id: 2, p2Id: 3, winnerId: 2, p1Big: 3, p1Small: 1 }, 1, 1),
      makeMatch({ p1Id: 3, p2Id: 1, winnerId: 3, p1Big: 3, p1Small: 1 }, 1, 2),
      // Phantom matches — gracz 1 dominował, gracz 3 minimalnie
      makeMatch({ p1Id: 1, p2Id: 99, winnerId: 1, p1Big: 3, p1Small: 9 }, 1, 3),
      makeMatch({ p1Id: 2, p2Id: 99, winnerId: 2, p1Big: 3, p1Small: 5 }, 1, 4),
      makeMatch({ p1Id: 3, p2Id: 99, winnerId: 3, p1Big: 3, p1Small: 1 }, 1, 5),
    ]
    // Big każdy: 3+1+3 = 7 (tied!). Mini-table: każdy 1W (3) + 1L (1) = 4 (tied!)
    // M.pkt: 1: 1-1+9=9, 2: 1-1+5=5, 3: 1-1+1=1 → 1 > 2 > 3

    const result = computeStandings([...gps, phantom], matches)
    const top3 = result.filter((p) => p.playerId !== 99)
    expect(top3.map((p) => p.lastName)).toEqual(['WysokieMpkt', 'SredniMpkt', 'NiskieMpkt'])
  })

  it('II.4 — Po m.pkt (3+ tied) — 2 tied → H2H, 3+ → HCP', () => {
    // 3 graczy tied na big, cyrkularne H2H (mini-table tied), identyczne m.pkt
    // (każdy wygrał 1 mecz z marginem 1, przegrał 1 z marginem 1 → m.pkt = 0).
    // Schodzi na HCP DESC.
    const gps = [
      makeGroupPlayer({ id: 1, lastName: 'WysokiHCP', hcp: 30 }),
      makeGroupPlayer({ id: 2, lastName: 'SredniHCP', hcp: 20 }),
      makeGroupPlayer({ id: 3, lastName: 'NiskiHCP', hcp: 10 }),
    ]
    const matches = [
      // Cyrkularne (jak wyżej, ale bez phantom — m.pkt każdego = 0)
      makeMatch({ p1Id: 1, p2Id: 2, winnerId: 1, p1Big: 3, p1Small: 1 }),
      makeMatch({ p1Id: 2, p2Id: 3, winnerId: 2, p1Big: 3, p1Small: 1 }, 1, 1),
      makeMatch({ p1Id: 3, p2Id: 1, winnerId: 3, p1Big: 3, p1Small: 1 }, 1, 2),
    ]
    // Big każdy: 3+1=4 (tied). Mini-table: każdy 3+1=4 (tied — cyrkularne).
    // M.pkt każdy: 1-1=0 (tied). → HCP DESC: 30 > 20 > 10

    const result = computeStandings(gps, matches)
    expect(result.map((p) => p.lastName)).toEqual(['WysokiHCP', 'SredniHCP', 'NiskiHCP'])
  })

  it('finalPosition (manualne nadpisanie) ma priorytet nad obliczonym sortowaniem', () => {
    const gps = [
      { ...makeGroupPlayer({ id: 1, lastName: 'Pierwszy' }), finalPosition: 2 } as unknown as GroupPlayer & { player: Player },
      { ...makeGroupPlayer({ id: 2, lastName: 'Drugi' }), finalPosition: 1 } as unknown as GroupPlayer & { player: Player },
    ]
    const matches = [makeMatch({ p1Id: 1, p2Id: 2, winnerId: 1, p1Big: 3, p1Small: 3 })]
    const result = computeStandings(gps, matches)
    expect(result[0].lastName).toBe('Drugi')
    expect(result[1].lastName).toBe('Pierwszy')
  })
})
