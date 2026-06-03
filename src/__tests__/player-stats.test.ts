import { describe, it, expect } from 'vitest'
import {
  evaluatePlayerInBracket,
  resolvePlayoffResultLabel,
  pickBestFinish,
  pickSeasonFinalPosition,
  type PlayoffMatchLike,
  type RankedGroupPlayer,
} from '@/lib/player-stats'

// ─── Fixture helpers ────────────────────────────────────────────────────

interface MatchFixture {
  p1: number
  p2: number
  winner: number | null
  round: number // bracketRound (1 = first, 2 = next, ...)
  pos: number // bracketPosition
  played?: boolean
}

function m(spec: MatchFixture): PlayoffMatchLike {
  return {
    player1Id: spec.p1,
    player2Id: spec.p2,
    winnerId: spec.winner,
    played: spec.played ?? true,
    bracketRound: spec.round,
    bracketPosition: spec.pos,
  }
}

/**
 * Build an 8-player single-elimination bracket where `championId` wins it all.
 * Players: 1..8. Bracket rounds: 1 (QF), 2 (SF), 3 (Final). Position numbers
 * encode slot — for simplicity we use position=1 for finals/semifinals; QF
 * positions are 1..4.
 *
 * `loserInSF` — id of the player who reached the SF but lost.
 * `loserInF`  — id of the player who reached the Final but lost.
 */
function build8PlayerBracket(opts: {
  championId: number
  loserInF: number
  loserInSF: number
}): PlayoffMatchLike[] {
  const { championId, loserInF, loserInSF } = opts
  return [
    // QF (round 1) — fillers, championId wins his QF and SF wins
    m({ p1: championId, p2: 100, winner: championId, round: 1, pos: 1 }),
    m({ p1: loserInSF, p2: 101, winner: loserInSF, round: 1, pos: 2 }),
    m({ p1: loserInF, p2: 102, winner: loserInF, round: 1, pos: 3 }),
    m({ p1: 103, p2: 104, winner: 103, round: 1, pos: 4 }),
    // SF (round 2)
    m({ p1: championId, p2: loserInSF, winner: championId, round: 2, pos: 1 }),
    m({ p1: loserInF, p2: 103, winner: loserInF, round: 2, pos: 2 }),
    // Final (round 3)
    m({ p1: championId, p2: loserInF, winner: championId, round: 3, pos: 1 }),
  ]
}

// ─── Tests: evaluatePlayerInBracket (BUG #2) ────────────────────────────

describe('evaluatePlayerInBracket — championship/finalist/semifinalist detection', () => {
  it('Champion: zwycięzca finału → championship=1, finalist=0, semifinalist=0', () => {
    const matches = build8PlayerBracket({ championId: 1, loserInF: 2, loserInSF: 3 })
    const result = evaluatePlayerInBracket(1, matches)
    expect(result).toEqual({ championship: 1, finalist: 0, semifinalist: 0 })
  })

  it('Finalista: przegrał finał → championship=0, finalist=1, semifinalist=0', () => {
    const matches = build8PlayerBracket({ championId: 1, loserInF: 2, loserInSF: 3 })
    const result = evaluatePlayerInBracket(2, matches)
    expect(result).toEqual({ championship: 0, finalist: 1, semifinalist: 0 })
  })

  it('Półfinalista: przegrał półfinał → semifinalist=1', () => {
    const matches = build8PlayerBracket({ championId: 1, loserInF: 2, loserInSF: 3 })
    const result = evaluatePlayerInBracket(3, matches)
    expect(result).toEqual({ championship: 0, finalist: 0, semifinalist: 1 })
  })

  it('Pure: pusta lista meczów → wszystkie 0', () => {
    const result = evaluatePlayerInBracket(1, [])
    expect(result).toEqual({ championship: 0, finalist: 0, semifinalist: 0 })
  })

  it('BUG #2 regression: Druga Liga (bracket równoległy) — zwycięzca dostaje championship=1', () => {
    // Symulacja 2023: Pierwsza Liga ma swój bracket, Druga Liga ma swój.
    // Helper iteruje per-bracket — winner Drugiej Ligi też dostaje championship.
    // (Wcześniej kod liczył tylko "Pierwszą Ligę" → BUG.)
    const drugaLigaBracket = build8PlayerBracket({
      championId: 50, // gracz Drugiej Ligi
      loserInF: 51,
      loserInSF: 52,
    })
    const result = evaluatePlayerInBracket(50, drugaLigaBracket)
    expect(result.championship).toBe(1)
  })

  it('Walkover w finale (played=false) nie zalicza championship', () => {
    // Defensywa: jeśli mecz finałowy nie został rozegrany → brak mistrzostwa.
    const matches: PlayoffMatchLike[] = [
      m({ p1: 1, p2: 100, winner: 1, round: 1, pos: 1 }),
      m({ p1: 2, p2: 101, winner: 2, round: 1, pos: 2 }),
      m({ p1: 1, p2: 2, winner: null, round: 2, pos: 1, played: false }),
    ]
    const result = evaluatePlayerInBracket(1, matches)
    expect(result.championship).toBe(0)
  })

  it('Semifinalist: gracz nie brał udziału w półfinale → semifinalist=0', () => {
    // Edge case: w danym brackecie maxRound-1 mecze są zagrane, ale BEZ tego gracza.
    const matches: PlayoffMatchLike[] = [
      m({ p1: 50, p2: 51, winner: 50, round: 1, pos: 1 }), // 50 wins SF
      m({ p1: 52, p2: 53, winner: 52, round: 1, pos: 2 }), // 52 wins SF
      m({ p1: 50, p2: 52, winner: 50, round: 2, pos: 1 }), // 50 wins Final
    ]
    // Gracz 99 nigdy nie zagrał — nie powinien dostać semifinalist=1
    const result = evaluatePlayerInBracket(99, matches)
    expect(result).toEqual({ championship: 0, finalist: 0, semifinalist: 0 })
  })
})

// ─── Tests: resolvePlayoffResultLabel (BUG #1) ──────────────────────────

describe('resolvePlayoffResultLabel — etykieta wyniku playoff per sezon', () => {
  it('Mistrz: gracz wygrał finał', () => {
    const matches = build8PlayerBracket({ championId: 1, loserInF: 2, loserInSF: 3 })
    // DB query używa orderBy bracketRound DESC — symulujemy odwracając listę
    const desc = [...matches].reverse()
    expect(resolvePlayoffResultLabel(1, desc)).toBe('Mistrz')
  })

  it('Finalista: gracz przegrał finał', () => {
    const matches = build8PlayerBracket({ championId: 1, loserInF: 2, loserInSF: 3 })
    const desc = [...matches].reverse()
    expect(resolvePlayoffResultLabel(2, desc)).toBe('Finalista')
  })

  it('Półfinał: gracz przegrał półfinał', () => {
    const matches = build8PlayerBracket({ championId: 1, loserInF: 2, loserInSF: 3 })
    const desc = [...matches].reverse()
    expect(resolvePlayoffResultLabel(3, desc)).toBe('Półfinał')
  })

  it('Ćwierćfinał: gracz przegrał QF (round 1 z maxRound=3)', () => {
    const matches = build8PlayerBracket({ championId: 1, loserInF: 2, loserInSF: 3 })
    const desc = [...matches].reverse()
    // Gracz 100 przegrał QF z 1 (mecz round=1, pos=1)
    expect(resolvePlayoffResultLabel(100, desc)).toBe('Ćwierćfinał')
  })

  it('BUG #1 regression: gracz nie był w finale ale poprzedni gracz w sortowaniu DESC był', () => {
    // Symuluje sytuację z BUG #1: bracketMatches[0] (po DESC) to mecz finałowy,
    // ale interesujący gracz przegrał wcześniej. Bez participant-check
    // .find() mógłby trafić w mecz, w którym ten gracz nie uczestniczył.
    const matches: PlayoffMatchLike[] = [
      // Final (round 3) — bez gracza 5
      m({ p1: 1, p2: 2, winner: 1, round: 3, pos: 1 }),
      // Semi (round 2) — bez gracza 5
      m({ p1: 1, p2: 3, winner: 1, round: 2, pos: 1 }),
      m({ p1: 2, p2: 4, winner: 2, round: 2, pos: 2 }),
      // QF (round 1) — gracz 5 przegrał z 1
      m({ p1: 1, p2: 5, winner: 1, round: 1, pos: 1 }),
      m({ p1: 3, p2: 103, winner: 3, round: 1, pos: 2 }),
      m({ p1: 2, p2: 104, winner: 2, round: 1, pos: 3 }),
      m({ p1: 4, p2: 105, winner: 4, round: 1, pos: 4 }),
    ]
    // matches[] są w kolejności insert; konwersja na DESC by bracketRound (jak prisma orderBy)
    const desc = [...matches].sort((a, b) => (b.bracketRound ?? 0) - (a.bracketRound ?? 0))
    // Gracz 5 odpadł w QF (round 1, maxRound 3 → roundFromTop = 2 → "Ćwierćfinał")
    expect(resolvePlayoffResultLabel(5, desc)).toBe('Ćwierćfinał')
  })

  it('Bez meczów → null', () => {
    expect(resolvePlayoffResultLabel(1, [])).toBeNull()
  })

  it('Gracz nigdy nie zagrał (winnerId === null wszędzie) → null', () => {
    const matches: PlayoffMatchLike[] = [
      m({ p1: 10, p2: 11, winner: null, round: 2, pos: 1, played: false }),
      m({ p1: 10, p2: 12, winner: null, round: 1, pos: 1, played: false }),
    ]
    expect(resolvePlayoffResultLabel(99, matches)).toBeNull()
  })

  it('1/16 lub głębsze: gracz odpadł w pierwszej rundzie 16-osobowego turnieju', () => {
    // maxRound = 4 (R16, QF, SF, F). Gracz przegrał w round=1.
    // roundFromTop = 4 - 1 = 3 → "1/16" (2^(3+1) = 16)
    const matches: PlayoffMatchLike[] = [
      m({ p1: 1, p2: 2, winner: 1, round: 4, pos: 1 }), // F
      m({ p1: 1, p2: 3, winner: 1, round: 3, pos: 1 }), // SF
      m({ p1: 1, p2: 4, winner: 1, round: 2, pos: 1 }), // QF
      m({ p1: 1, p2: 5, winner: 1, round: 1, pos: 1 }), // R16
    ]
    const desc = [...matches].sort((a, b) => (b.bracketRound ?? 0) - (a.bracketRound ?? 0))
    expect(resolvePlayoffResultLabel(5, desc)).toBe('1/16')
  })
})

// ─── Tests: pickBestFinish (BUG #3 — "wszyscy mają najlepszą pozycję 1") ───

function gp(
  finalPosition: number | null,
  roundType: 'ROUND_ROBIN' | 'PLAYOFF',
  seasonId = 1,
  seasonName = 'Sezon 2023',
  year = 2023,
): RankedGroupPlayer {
  return { finalPosition, roundType, seasonId, seasonName, year }
}

describe('pickBestFinish — najlepsza pozycja w karierze (BUG #3 fix)', () => {
  it('PLAYOFF priorytetem nad RR w tym samym sezonie', () => {
    // RR: gracz wygrał swoją grupę (poz. 1). Playoff: skończył na poz. 10 (mistrz Drugiej Ligi).
    // Bez fixa: bestFinish=1 (group). Z fixem: bestFinish=10 (playoff = canonical season rank).
    const result = pickBestFinish([
      gp(1, 'ROUND_ROBIN'),
      gp(10, 'PLAYOFF'),
    ])
    expect(result?.position).toBe(10)
  })

  it('RR fallback gdy brak PLAYOFF w sezonie', () => {
    // Aktywny sezon bez playoff jeszcze — bestFinish to pozycja w grupie.
    const result = pickBestFinish([gp(2, 'ROUND_ROBIN')])
    expect(result?.position).toBe(2)
  })

  it('Wybiera najniższą pozycję playoff między sezonami', () => {
    const result = pickBestFinish([
      gp(8, 'PLAYOFF', 1, 'Sezon 2023', 2023),
      gp(3, 'PLAYOFF', 2, 'Sezon 2024', 2024),
      gp(15, 'PLAYOFF', 3, 'Sezon 2025', 2025),
    ])
    expect(result).toEqual({ position: 3, seasonName: 'Sezon 2024', year: 2024 })
  })

  it('BUG #3 regression: 8 graczy wygrało grupy ale tylko jeden został mistrzem playoff', () => {
    // Symulujemy 8 graczy każdy z `RR finalPosition=1` w swojej grupie + różne playoff position.
    // Każdy gracz osobno: jego PLAYOFF position powinno wygrać z RR=1.
    const winners = [
      { player: 'A', rr: 1, playoff: 1 },
      { player: 'B', rr: 1, playoff: 5 },
      { player: 'C', rr: 1, playoff: 8 },
      { player: 'D', rr: 1, playoff: 12 },
    ]
    for (const w of winners) {
      const result = pickBestFinish([
        gp(w.rr, 'ROUND_ROBIN'),
        gp(w.playoff, 'PLAYOFF'),
      ])
      expect(result?.position).toBe(w.playoff)
    }
  })

  it('Brak finalPosition → null', () => {
    const result = pickBestFinish([gp(null, 'ROUND_ROBIN'), gp(null, 'PLAYOFF')])
    expect(result).toBeNull()
  })

  it('Pusta lista → null', () => {
    expect(pickBestFinish([])).toBeNull()
  })

  it('Wiele RR w jednym sezonie bez playoff → bierze najniższą pozycję w grupie', () => {
    // 3 rundy RR — gracz zajął kolejno 3, 1, 2 w swoich grupach. bestFinish = 1.
    const result = pickBestFinish([
      gp(3, 'ROUND_ROBIN'),
      gp(1, 'ROUND_ROBIN'),
      gp(2, 'ROUND_ROBIN'),
    ])
    expect(result?.position).toBe(1)
  })

  it('Mieszane: jeden sezon z playoff, jeden bez', () => {
    // Sezon 1 (2023): RR=1 + PLAYOFF=10 → 10
    // Sezon 2 (2024): RR=4 (brak playoff) → 4
    // Najlepszy: 4 (sezon 2024)
    const result = pickBestFinish([
      gp(1, 'ROUND_ROBIN', 1, 'S1', 2023),
      gp(10, 'PLAYOFF', 1, 'S1', 2023),
      gp(4, 'ROUND_ROBIN', 2, 'S2', 2024),
    ])
    expect(result).toEqual({ position: 4, seasonName: 'S2', year: 2024 })
  })
})

// ─── Tests: pickSeasonFinalPosition ────────────────────────────────────

describe('pickSeasonFinalPosition — pozycja w jednym sezonie (BUG #3)', () => {
  it('PLAYOFF wygrywa z RR', () => {
    expect(
      pickSeasonFinalPosition([
        { finalPosition: 1, roundType: 'ROUND_ROBIN' },
        { finalPosition: 9, roundType: 'PLAYOFF' },
      ]),
    ).toBe(9)
  })

  it('Tylko RR (brak playoff) → najniższa pozycja w grupach', () => {
    expect(
      pickSeasonFinalPosition([
        { finalPosition: 3, roundType: 'ROUND_ROBIN' },
        { finalPosition: 2, roundType: 'ROUND_ROBIN' },
      ]),
    ).toBe(2)
  })

  it('Tylko PLAYOFF → ta pozycja', () => {
    expect(
      pickSeasonFinalPosition([{ finalPosition: 5, roundType: 'PLAYOFF' }]),
    ).toBe(5)
  })

  it('Brak danych → null', () => {
    expect(pickSeasonFinalPosition([])).toBeNull()
    expect(
      pickSeasonFinalPosition([{ finalPosition: null, roundType: 'PLAYOFF' }]),
    ).toBeNull()
  })
})
