import { describe, it, expect } from 'vitest'
import {
  buildPlayoffSeedOrder,
  BRACKET_SEEDS,
  BRACKET_NAMES,
  BRACKET_HOLES,
  BRACKET_HOLES_OPTIONS,
  BRACKET_DISPLAY_NAMES,
  bracketKeyFromGroupName,
  bracketHolesLabel,
} from '@/lib/playoff'

/**
 * Kontrakt seedowania playoff.
 *
 * Te testy blokują kolejność seedów zatwierdzoną przez Zarząd Ligi dla sezonu 2026.
 * Jeśli `buildPlayoffSeedOrder` kiedykolwiek zacznie dawać inny wynik — testy padną.
 *
 * Źródło prawdy: lista 1-48 zatwierdzona 18.08.2026 na podstawie tabel Rundy 4
 * (10 grup × 5 zawodników). Patrz DOCS/playoff-2026-seeding.md.
 */

// ─── Fixture: tabele Rundy 4 sezonu 2026 ────────────────────────────────
// Kolejność grup = siła (Grupa 1 najsilniejsza), kolejność w grupie = pozycja 1-5.

const ROUND_4_2026: string[][] = [
  // Grupa 1
  ['Kacper Glinka', 'Sebastian Szot', 'Remigiusz Wiśniewski', 'Janusz Zieliński', 'Jerzy Górski'],
  // Grupa 2
  ['Michał Łowiński', 'Tomek Śleziak', 'Jakub Michalak', 'Krzysztof Łukasiuk', 'Grzegorz Ptak'],
  // Grupa 3
  ['Fabio Szic', 'Dominik Weidinger', 'Maciej Ślusarczyk', 'Artur Kiowski', 'Marek Klyk'],
  // Grupa 4
  ['Maciej Skucik', 'Krzysztof Wingert', 'Wojciech Szwedowski', 'Jacek Wróbel', 'Paweł Ślusarczyk'],
  // Grupa 5
  ['Jakub Krok', 'Zbigniew Marciniak', 'Jacek Stadnicki', 'Wojciech Stefanik', 'Roman Staś'],
  // Grupa 6
  ['Wojciech Stelmach', 'Sylwester Sienkiewicz', 'Grzegorz Możdżonek', 'Marcin Kucia', 'Ryszard Michalewski'],
  // Grupa 7
  ['Radosław Grek', 'Rafał Stolarczyk', 'Krzysztof Kozłowski', 'Mirosław Domagała', 'Mateusz Tymich'],
  // Grupa 8
  ['Tomasz Len', 'Łukasz Cieplik', 'Ludwik Kownacki', 'Mariusz Boruszek', 'Łukasz Lachowski'],
  // Grupa 9
  ['Robert Warnecki', 'Aleksander Sitko', 'Tomasz Tarkowski', 'Bartłomiej Czarnotta', 'Piotr Glinka'],
  // Grupa 10
  ['Marcin Szemainda', 'Marek Turski', 'Grzegorz Czudaj', 'Marcin Stelmach', 'Maciej Plewka'],
]

/** Ranking 1-48 zatwierdzony przez Zarząd + miejsca 49-50 poza playoff. */
const EXPECTED_ORDER: string[] = [
  'Kacper Glinka',          //  1  G1 pos1
  'Sebastian Szot',         //  2  G1 pos2
  'Remigiusz Wiśniewski',   //  3  G1 pos3
  'Michał Łowiński',        //  4  G2 pos1
  'Tomek Śleziak',          //  5  G2 pos2
  'Janusz Zieliński',       //  6  G1 pos4
  'Jerzy Górski',           //  7  G1 pos5
  'Jakub Michalak',         //  8  G2 pos3
  'Fabio Szic',             //  9  G3 pos1
  'Dominik Weidinger',      // 10  G3 pos2
  'Krzysztof Łukasiuk',     // 11  G2 pos4
  'Grzegorz Ptak',          // 12  G2 pos5
  'Maciej Ślusarczyk',      // 13  G3 pos3
  'Maciej Skucik',          // 14  G4 pos1
  'Krzysztof Wingert',      // 15  G4 pos2
  'Artur Kiowski',          // 16  G3 pos4
  'Marek Klyk',             // 17  G3 pos5
  'Wojciech Szwedowski',    // 18  G4 pos3
  'Jakub Krok',             // 19  G5 pos1
  'Zbigniew Marciniak',     // 20  G5 pos2
  'Jacek Wróbel',           // 21  G4 pos4
  'Paweł Ślusarczyk',       // 22  G4 pos5
  'Jacek Stadnicki',        // 23  G5 pos3
  'Wojciech Stelmach',      // 24  G6 pos1
  'Sylwester Sienkiewicz',  // 25  G6 pos2
  'Wojciech Stefanik',      // 26  G5 pos4
  'Roman Staś',             // 27  G5 pos5
  'Grzegorz Możdżonek',     // 28  G6 pos3
  'Radosław Grek',          // 29  G7 pos1
  'Rafał Stolarczyk',       // 30  G7 pos2
  'Marcin Kucia',           // 31  G6 pos4
  'Ryszard Michalewski',    // 32  G6 pos5
  'Krzysztof Kozłowski',    // 33  G7 pos3
  'Tomasz Len',             // 34  G8 pos1
  'Łukasz Cieplik',         // 35  G8 pos2
  'Mirosław Domagała',      // 36  G7 pos4
  'Mateusz Tymich',         // 37  G7 pos5
  'Ludwik Kownacki',        // 38  G8 pos3
  'Robert Warnecki',        // 39  G9 pos1
  'Aleksander Sitko',       // 40  G9 pos2
  'Mariusz Boruszek',       // 41  G8 pos4
  'Łukasz Lachowski',       // 42  G8 pos5
  'Tomasz Tarkowski',       // 43  G9 pos3
  'Marcin Szemainda',       // 44  G10 pos1
  'Marek Turski',           // 45  G10 pos2
  'Bartłomiej Czarnotta',   // 46  G9 pos4
  'Piotr Glinka',           // 47  G9 pos5
  'Grzegorz Czudaj',        // 48  G10 pos3
  // ─── poniżej: poza playoff ───
  'Marcin Stelmach',        // 49  G10 pos4
  'Maciej Plewka',          // 50  G10 pos5
]

describe('buildPlayoffSeedOrder — kontrakt seedowania 2026', () => {
  const ordered = buildPlayoffSeedOrder(ROUND_4_2026)

  it('zwraca wszystkich 50 zawodników bez duplikatów i bez gubienia nikogo', () => {
    expect(ordered).toHaveLength(50)
    expect(new Set(ordered).size).toBe(50)
    expect([...ordered].sort()).toEqual([...ROUND_4_2026.flat()].sort())
  })

  it('odtwarza DOKŁADNIE ranking zatwierdzony przez Zarząd (1-48 + 2 poza playoff)', () => {
    expect(ordered).toEqual(EXPECTED_ORDER)
  })

  it('zwycięzcy grup nie przeskakują hierarchii grup — Warnecki (G9 pos1) jest 39., nie 1.', () => {
    // Regresja: stara implementacja sortowała BP→SP→HCP i wypychała Warneckiego na #1
    expect(ordered.indexOf('Robert Warnecki') + 1).toBe(39)
    expect(ordered.indexOf('Kacper Glinka') + 1).toBe(1)
  })

  it('spadkowicze z góry są wyżej niż "ten kto został" niżej, ale niżej niż awansujący', () => {
    const seed = (name: string) => ordered.indexOf(name) + 1
    // G1 pos4/pos5 (spadek) vs G2 pos1/pos2 (awans) vs G2 pos3 (zostaje)
    expect(seed('Michał Łowiński')).toBeLessThan(seed('Janusz Zieliński')) // G2p1 < G1p4
    expect(seed('Tomek Śleziak')).toBeLessThan(seed('Janusz Zieliński'))   // G2p2 < G1p4
    expect(seed('Jerzy Górski')).toBeLessThan(seed('Jakub Michalak'))      // G1p5 < G2p3
  })

  it('dwaj ostatni z najsłabszej grupy wypadają poza 48 miejsc', () => {
    const outside = ordered.slice(48)
    expect(outside).toEqual(['Marcin Stelmach', 'Maciej Plewka'])
  })
})

describe('BRACKET_SEEDS — pary Rundy 1', () => {
  it('każda drabinka ma 8 par, razem 24 mecze', () => {
    for (const name of BRACKET_NAMES) {
      expect(BRACKET_SEEDS[name]).toHaveLength(8)
    }
    expect(BRACKET_NAMES.flatMap((n) => BRACKET_SEEDS[n])).toHaveLength(24)
  })

  it('sumy seedów w parach są stałe (17 / 49 / 81) — klasyczne rozstawienie', () => {
    const expectedSums: Record<string, number> = { '1-16': 17, '17-32': 49, '33-48': 81 }
    for (const name of BRACKET_NAMES) {
      for (const [a, b] of BRACKET_SEEDS[name]) {
        expect(a + b).toBe(expectedSums[name])
      }
    }
  })

  it('48 seedów pokrywa każdą drabinkę dokładnie raz', () => {
    const all = BRACKET_NAMES.flatMap((n) => BRACKET_SEEDS[n]).flat()
    expect(new Set(all).size).toBe(48)
    expect(Math.min(...all)).toBe(1)
    expect(Math.max(...all)).toBe(48)
  })

  it('pary Rundy 1 obsadzone rankingiem 2026 dają zatwierdzone mecze', () => {
    const ordered = buildPlayoffSeedOrder(ROUND_4_2026)
    const player = (seed: number) => ordered[seed - 1]

    // Pierwsza Liga Playoff — górna połowa
    expect(BRACKET_SEEDS['1-16'].slice(0, 4).map(([a, b]) => [player(a), player(b)])).toEqual([
      ['Kacper Glinka', 'Artur Kiowski'],
      ['Jakub Michalak', 'Fabio Szic'],
      ['Michał Łowiński', 'Maciej Ślusarczyk'],
      ['Tomek Śleziak', 'Grzegorz Ptak'],
    ])

    // Pierwsza Liga Playoff — dolna połowa
    expect(BRACKET_SEEDS['1-16'].slice(4).map(([a, b]) => [player(a), player(b)])).toEqual([
      ['Sebastian Szot', 'Krzysztof Wingert'],
      ['Jerzy Górski', 'Dominik Weidinger'],
      ['Remigiusz Wiśniewski', 'Maciej Skucik'],
      ['Janusz Zieliński', 'Krzysztof Łukasiuk'],
    ])

    // Druga Liga Playoff
    expect(BRACKET_SEEDS['17-32'].map(([a, b]) => [player(a), player(b)])).toEqual([
      ['Marek Klyk', 'Ryszard Michalewski'],
      ['Wojciech Stelmach', 'Sylwester Sienkiewicz'],
      ['Zbigniew Marciniak', 'Radosław Grek'],
      ['Jacek Wróbel', 'Grzegorz Możdżonek'],
      ['Wojciech Szwedowski', 'Marcin Kucia'],
      ['Jacek Stadnicki', 'Wojciech Stefanik'],
      ['Jakub Krok', 'Rafał Stolarczyk'],
      ['Paweł Ślusarczyk', 'Roman Staś'],
    ])

    // Trzecia Liga Playoff
    expect(BRACKET_SEEDS['33-48'].map(([a, b]) => [player(a), player(b)])).toEqual([
      ['Krzysztof Kozłowski', 'Grzegorz Czudaj'],
      ['Aleksander Sitko', 'Mariusz Boruszek'],
      ['Mirosław Domagała', 'Marek Turski'],
      ['Mateusz Tymich', 'Marcin Szemainda'],
      ['Tomasz Len', 'Piotr Glinka'],
      ['Robert Warnecki', 'Łukasz Lachowski'],
      ['Łukasz Cieplik', 'Bartłomiej Czarnotta'],
      ['Ludwik Kownacki', 'Tomasz Tarkowski'],
    ])
  })
})

describe('Długość meczów w drabinkach — ustalenie Zarządu z 19.08.2026', () => {
  it('Pierwsza i Druga Liga grają 18 dołków, Trzecia domyślnie 9', () => {
    expect(BRACKET_HOLES['1-16']).toBe(18)
    expect(BRACKET_HOLES['17-32']).toBe(18)
    expect(BRACKET_HOLES['33-48']).toBe(9)
  })

  it('tylko Trzecia Liga ma wybór długości', () => {
    expect(BRACKET_HOLES_OPTIONS['1-16']).toEqual([18])
    expect(BRACKET_HOLES_OPTIONS['17-32']).toEqual([18])
    expect(BRACKET_HOLES_OPTIONS['33-48']).toEqual([9, 18])
  })

  it('domyślna długość każdej drabinki jest jedną z dopuszczalnych', () => {
    for (const name of BRACKET_NAMES) {
      expect(BRACKET_HOLES_OPTIONS[name]).toContain(BRACKET_HOLES[name])
    }
  })

  it('bracketKeyFromGroupName odwraca nazwy wyświetlane', () => {
    for (const name of BRACKET_NAMES) {
      expect(bracketKeyFromGroupName(BRACKET_DISPLAY_NAMES[name])).toBe(name)
    }
  })

  it('bracketKeyFromGroupName zwraca null dla grup fazy zasadniczej', () => {
    expect(bracketKeyFromGroupName('Grupa 7')).toBeNull()
    expect(bracketKeyFromGroupName('')).toBeNull()
  })

  // Regresja: publiczna drabinka miała własną mapę etykiet, która po zmianie
  // ustalenia Zarządu pokazywała 17-32 jako "9/18" a 33-48 jako "9" — odwrotnie.
  it('etykieta długości na publicznej drabince zgadza się z dopuszczalnymi wariantami', () => {
    expect(bracketHolesLabel('1-16')).toBe('18 dołków')
    expect(bracketHolesLabel('17-32')).toBe('18 dołków')
    expect(bracketHolesLabel('33-48')).toBe('9/18 dołków')
  })

  it('etykieta jest pusta dla nieznanej drabinki zamiast rzucać', () => {
    expect(bracketHolesLabel('brak-takiej')).toBe('')
  })
})

describe('buildPlayoffSeedOrder — przypadki brzegowe', () => {
  it('pusta lista grup', () => {
    expect(buildPlayoffSeedOrder([])).toEqual([])
  })

  it('jedna grupa — zachowuje kolejność z tabeli', () => {
    expect(buildPlayoffSeedOrder([['a', 'b', 'c', 'd', 'e']])).toEqual(['a', 'b', 'c', 'd', 'e'])
  })

  it('grupy mniejsze niż 5 osób — nie gubi zawodników', () => {
    const result = buildPlayoffSeedOrder([['a1', 'a2', 'a3'], ['b1', 'b2']])
    expect(new Set(result).size).toBe(5)
    expect([...result].sort()).toEqual(['a1', 'a2', 'a3', 'b1', 'b2'])
  })

  it('grupy większe niż 5 osób (runda wstępna 2×10) — nikt nie wypada', () => {
    const g1 = Array.from({ length: 10 }, (_, i) => `a${i + 1}`)
    const g2 = Array.from({ length: 10 }, (_, i) => `b${i + 1}`)
    const result = buildPlayoffSeedOrder([g1, g2])
    expect(result).toHaveLength(20)
    expect(new Set(result).size).toBe(20)
  })
})
