import { describe, it, expect } from 'vitest'
import {
  RESULT_CODES,
  RESULT_CODES_18,
  DEFAULT_SEASON_CONFIG,
  computePoints,
  resultCodesForHoles,
  extraHoleCodes,
  isExtraHoleCode,
} from '@/lib/scoring'
import { parseMargin, isCloseResult, isDecisiveWin, parseExtraHoleNumber, formatResultCodePl } from '@/lib/match-play-utils'

/**
 * Kontrakt kodów wyniku match play.
 *
 * Kluczowa własność: kod „X&Y" (X do góry, Y dołków do końca) jest osiągalny TYLKO gdy
 * X = Y+1 albo X = Y+2. Dowód: mecz kończy się w chwili, gdy przewaga przekroczy liczbę
 * pozostałych dołków, a przewaga zmienia się o najwyżej 1 na dołek — więc dołek wcześniej
 * (Y+1 pozostałych) przewaga musiała wynosić najwyżej Y+1.
 *
 * Stąd zestaw 18-dołkowy kończy się na 10&8, a 9-dołkowy na 5&4. Ustalenie Zarządu
 * potwierdzone 20.08.2026.
 */

/** Wszystkie kody „X&Y" możliwe w meczu o danej liczbie dołków. */
function validAmpCodes(matchHoles: number): string[] {
  const out: string[] = []
  for (let y = 1; y < matchHoles; y++) {
    for (const x of [y + 1, y + 2]) {
      if (x <= matchHoles - y) out.push(`${x}&${y}`)
    }
  }
  return out
}

describe('RESULT_CODES — zgodność z regułą X=Y+1 / X=Y+2', () => {
  it('każdy kod X&Y na liście 9-dołkowej jest matematycznie możliwy', () => {
    const amp = RESULT_CODES.filter((c) => c.includes('&'))
    for (const code of amp) {
      const [x, y] = code.split('&').map(Number)
      expect(x === y + 1 || x === y + 2, `${code} niemożliwy: X musi być Y+1 lub Y+2`).toBe(true)
      expect(x, `${code}: przewaga większa niż liczba rozegranych dołków`).toBeLessThanOrEqual(9 - y)
    }
  })

  it('lista 9-dołkowa zawiera WSZYSTKIE możliwe kody X&Y i nic ponad', () => {
    const amp = RESULT_CODES.filter((c) => c.includes('&'))
    expect([...amp].sort()).toEqual(validAmpCodes(9).sort())
  })

  it('lista 18-dołkowa zawiera WSZYSTKIE możliwe kody X&Y i nic ponad', () => {
    const amp = RESULT_CODES_18.filter((c) => c.includes('&'))
    expect([...amp].sort()).toEqual(validAmpCodes(18).sort())
  })

  it('regresja: 6&3 jest niemożliwe i nie może wrócić na listę', () => {
    // 6 do góry z 3 do końca = Y+3 — mecz zamknąłby się dołek wcześniej
    expect(RESULT_CODES_18).not.toContain('6&3')
  })

  it('największy możliwy margines na 18 dołkach to 10&8', () => {
    const amp = validAmpCodes(18)
    expect(amp).toContain('10&8')
    expect(amp.filter((c) => Number(c.split('&')[0]) > 10)).toEqual([])
  })
})

describe('Małe punkty — ciąg 1…18 wg regulaminu §III.4.c', () => {
  const map = DEFAULT_SEASON_CONFIG.small_points_map

  it('odtwarza wartości wypisane w regulaminie', () => {
    expect(map['1Up']).toEqual([1, -1])
    expect(map['2Up']).toEqual([2, -2])
    expect(map['2&1']).toEqual([3, -3])
    expect(map['3&1']).toEqual([4, -4])
    expect(map['3&2']).toEqual([5, -5])
    expect(map['4&2']).toEqual([6, -6])
    expect(map['4&3']).toEqual([7, -7])
    expect(map['5&3']).toEqual([8, -8])
    expect(map['5&4']).toEqual([9, -9])
  })

  it('dla każdego kodu X&Y małe punkty = X+Y', () => {
    for (const code of RESULT_CODES_18.filter((c) => c.includes('&'))) {
      const [x, y] = code.split('&').map(Number)
      expect(map[code], `brak lub zła wartość dla ${code}`).toEqual([x + y, -(x + y)])
    }
  })

  it('kody 18-dołkowe domykają ciąg do ±18', () => {
    expect(map['6&4']).toEqual([10, -10])
    expect(map['10&8']).toEqual([18, -18])
  })

  it('A/S i Ret nie dają małych punktów', () => {
    expect(map['A/S']).toEqual([0, 0])
    expect(map['Ret']).toEqual([0, 0])
  })
})

describe('Kody dogrywki — numer dołka od początku meczu', () => {
  it('mecz 18-dołkowy: pierwszy dołek dogrywki to 19th', () => {
    expect(extraHoleCodes(18).slice(0, 4)).toEqual(['19th', '20th', '21st', '22nd'])
  })

  it('mecz 9-dołkowy: pierwszy dołek dogrywki to 10th', () => {
    expect(extraHoleCodes(9).slice(0, 4)).toEqual(['10th', '11th', '12th', '13th'])
  })

  it('końcówki liczebników są poprawne (11-13 zawsze "th")', () => {
    const codes = extraHoleCodes(9)
    expect(codes).toContain('11th')
    expect(codes).toContain('12th')
    expect(codes).toContain('13th')
    expect(extraHoleCodes(18)).toContain('23rd')
  })

  it('rozpoznawanie kodu dogrywki', () => {
    expect(isExtraHoleCode('19th')).toBe(true)
    expect(isExtraHoleCode('21st')).toBe(true)
    expect(isExtraHoleCode('10th')).toBe(true)
    expect(isExtraHoleCode('5&4')).toBe(false)
    expect(isExtraHoleCode('A/S')).toBe(false)
    expect(isExtraHoleCode('1Up')).toBe(false)
  })

  it('parseExtraHoleNumber zwraca numer dołka', () => {
    expect(parseExtraHoleNumber('19th')).toBe(19)
    expect(parseExtraHoleNumber('21st')).toBe(21)
    expect(parseExtraHoleNumber('5&4')).toBeNull()
  })

  it('dogrywka to margines 1 i wynik bliski, nie rozstrzygający', () => {
    expect(parseMargin('19th')).toBe(1)
    expect(isCloseResult('19th')).toBe(true)
    expect(isDecisiveWin('19th')).toBe(false)
  })

  it('opis po polsku nie udaje przewagi dołkowej', () => {
    expect(formatResultCodePl('19th')).toBe('19th (dogrywka, dołek 19)')
    expect(formatResultCodePl('10th')).toBe('10th (dogrywka, dołek 10)')
  })

  it('wygrana w dogrywce daje pełne duże punkty i ±1 małego', () => {
    const pts = computePoints(
      { winnerId: 1, resultCode: '19th', isWalkover: false },
      1, 2, DEFAULT_SEASON_CONFIG
    )
    expect(pts.player1BigPoints).toBe(3)
    expect(pts.player2BigPoints).toBe(1)
    expect(pts.player1SmallPoints).toBe(1)
    expect(pts.player2SmallPoints).toBe(-1)
  })
})

describe('resultCodesForHoles — zestaw wg długości meczu i fazy', () => {
  it('faza grupowa: jest A/S, nie ma dogrywek', () => {
    const codes = resultCodesForHoles(9, { allowHalved: true })
    expect(codes).toContain('A/S')
    expect(codes.filter(isExtraHoleCode)).toEqual([])
  })

  it('playoff: nie ma A/S, są dogrywki', () => {
    const codes = resultCodesForHoles(18, { allowHalved: false })
    expect(codes).not.toContain('A/S')
    expect(codes).toContain('19th')
  })

  it('mecz 9-dołkowy nie dostaje kodów zarezerwowanych dla 18 dołków', () => {
    const codes = resultCodesForHoles(9, { allowHalved: false })
    expect(codes).not.toContain('6&4')
    expect(codes).not.toContain('10&8')
    expect(codes).toContain('5&4')
  })

  it('mecz 18-dołkowy dostaje pełny zestaw marginesów', () => {
    const codes = resultCodesForHoles(18, { allowHalved: false })
    expect(codes).toContain('10&8')
    expect(codes).toContain('5&4')
  })
})
