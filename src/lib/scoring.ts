import { isExtraHoleCode } from './match-play-utils'

// Re-eksport dla wygody: kody dogrywki są częścią zestawu wyników, więc konsumenci
// `scoring` (panel wyników, testy) sięgają po ten predykat tutaj. Definicja mieszka
// w `match-play-utils` razem z resztą parsowania kodów.
export { isExtraHoleCode }

export interface SeasonConfig {
  scoring: {
    win: number
    draw: number
    loss: number
    unplayed: number
    walkover_winner: number
    walkover_loser: number
  }
  small_points_map: Record<string, [number, number]>
}

export interface MatchResultInput {
  winnerId: number | null
  resultCode: string
  isWalkover: boolean
}

export interface ComputedPoints {
  player1BigPoints: number
  player2BigPoints: number
  player1SmallPoints: number
  player2SmallPoints: number
}

export const DEFAULT_SEASON_CONFIG: SeasonConfig = {
  scoring: {
    win: 3,
    draw: 2,
    loss: 1,
    unplayed: 0,
    walkover_winner: 3,
    walkover_loser: 0,
  },
  small_points_map: {
    'A/S': [0, 0],
    '1Up': [1, -1],
    '2Up': [2, -2],
    '3Up': [3, -3],
    '4Up': [4, -4],
    '5Up': [5, -5],
    '2&1': [3, -3],
    '3&1': [4, -4],
    '3&2': [5, -5],
    '4&2': [6, -6],
    '4&3': [7, -7],
    '5&3': [8, -8],
    '5&4': [9, -9],
    // ─── Marginesy osiągalne tylko na 18 dołkach ───
    // Regulamin §III.4.c wylicza wartości do 5&4=±9. Reguła, którą realizuje ta lista,
    // to suma X+Y dla kodu „X&Y" — odtwarza WSZYSTKIE pozycje z regulaminu co do jednej
    // i przedłuża je w nieprzerwany ciąg 1…18 (bo możliwe są tylko X=Y+1 i X=Y+2).
    '6&4': [10, -10],
    '6&5': [11, -11],
    '7&5': [12, -12],
    '7&6': [13, -13],
    '8&6': [14, -14],
    '8&7': [15, -15],
    '9&7': [16, -16],
    '9&8': [17, -17],
    '10&8': [18, -18],
    // Ret = opponent retired during the round (historical code).
    // Awards same big points as a win, zero small points (margin unknown).
    'Ret': [0, 0],
  },
}

/**
 * Małe punkty za wygraną w dogrywce. Zwycięzca wygrywa dodatkowym dołkiem, czyli
 * najmniejszą możliwą różnicą — stąd ±1, tak jak `1Up`. Zero jest zastrzeżone dla
 * remisu (`A/S`).
 *
 * Praktycznie bez wpływu na tabele: dogrywka występuje wyłącznie w playoff
 * (Regulamin §IV.3), a małe punkty są tiebreakerem fazy grupowej (§III.4.c).
 */
export const EXTRA_HOLE_SMALL_POINTS: [number, number] = [1, -1]

/**
 * Małe punkty zwycięzcy za dany kod wyniku (margines). Przegrany dostaje wartość przeciwną.
 *
 * Jedyne miejsce, które rozstrzyga „kod → margines" — używa go `computePoints` oraz
 * importer sezonów historycznych (`scripts/historical-data/import-season.ts`), żeby
 * definicja nie żyła w kilku kopiach naraz.
 *
 * Nieznany kod daje 0 (np. `Ret`/`WO` — margines nieznany).
 */
export function smallPointsMargin(
  resultCode: string,
  map: Record<string, [number, number]> = DEFAULT_SEASON_CONFIG.small_points_map,
): number {
  // Kody dogrywki są generowane dynamicznie z długości meczu (19th, 20th, 10th…),
  // więc nie da się ich wypisać w mapie — rozpoznajemy je wzorcem.
  if (isExtraHoleCode(resultCode)) return EXTRA_HOLE_SMALL_POINTS[0]
  return map[resultCode]?.[0] ?? 0
}

export function computePoints(
  input: MatchResultInput,
  player1Id: number,
  player2Id: number,
  config: SeasonConfig
): ComputedPoints {
  const { scoring, small_points_map } = config

  if (input.isWalkover) {
    const p1Wins = input.winnerId === player1Id
    return {
      player1BigPoints: p1Wins ? scoring.walkover_winner : scoring.walkover_loser,
      player2BigPoints: p1Wins ? scoring.walkover_loser : scoring.walkover_winner,
      player1SmallPoints: 0,
      player2SmallPoints: 0,
    }
  }

  if (input.resultCode === 'A/S' || !input.winnerId) {
    return {
      player1BigPoints: scoring.draw,
      player2BigPoints: scoring.draw,
      player1SmallPoints: 0,
      player2SmallPoints: 0,
    }
  }

  const p1Wins = input.winnerId === player1Id
  const winnerSmall = smallPointsMargin(input.resultCode, small_points_map)
  const loserSmall = -winnerSmall

  return {
    player1BigPoints: p1Wins ? scoring.win : scoring.loss,
    player2BigPoints: p1Wins ? scoring.loss : scoring.win,
    player1SmallPoints: p1Wins ? winnerSmall : loserSmall,
    player2SmallPoints: p1Wins ? loserSmall : winnerSmall,
  }
}

export const RESULT_CODES = [
  'A/S',
  '1Up',
  '2Up',
  '3Up',
  '4Up',
  '5Up',
  '2&1',
  '3&1',
  '3&2',
  '4&2',
  '4&3',
  '5&3',
  '5&4',
  'Ret',
] as const

/**
 * Kody 18-dołkowe = wszystkie 9-dołkowe plus marginesy osiągalne dopiero na dłuższym meczu.
 *
 * Które kody „X&Y" są w ogóle możliwe? Mecz kończy się w chwili, gdy przewaga przekracza
 * liczbę pozostałych dołków. Żeby skończyć się DOKŁADNIE przy X do góry i Y pozostałych,
 * dołek wcześniej przewaga musiała wynosić najwyżej Y+1 (inaczej mecz zamknąłby się
 * wcześniej), a zmienia się o najwyżej 1 na dołek. Stąd **X = Y+1 albo X = Y+2** — nic innego.
 *
 * Dlatego np. `6&3` (to Y+3) jest niemożliwe, podobnie `6&1` czy `7&1`. Zestaw dla 18 dołków
 * kończy się naturalnie na `10&8`, bo dla Y=9 potrzebne X=10 przekracza 18−9=9 rozegranych dołków.
 */
export const RESULT_CODES_18 = [
  ...RESULT_CODES,
  '6&4',
  '6&5',
  '7&5',
  '7&6',
  '8&6',
  '8&7',
  '9&7',
  '9&8',
  '10&8',
] as const

/**
 * Kody dogrywki („nagła śmierć" od dołka 1 — Regulamin §IV.3, tylko playoff).
 * Numer odpowiada faktycznemu dołkowi rozstrzygającemu, liczonemu od początku meczu:
 * mecz 18-dołkowy → `19th`, `20th`, `21st`…, mecz 9-dołkowy → `10th`, `11th`, `12th`…
 *
 * Zwraca pełną dodatkową dziewiątkę — tyle wystarcza w praktyce, a zakres łatwo rozszerzyć.
 */
export function extraHoleCodes(matchHoles: number): string[] {
  return Array.from({ length: 9 }, (_, i) => ordinal(matchHoles + i + 1))
}

/** 1st, 2nd, 3rd, 4th… 21st, 22nd, 23rd — reguła angielska z wyjątkiem na 11-13. */
function ordinal(n: number): string {
  const lastTwo = n % 100
  if (lastTwo >= 11 && lastTwo <= 13) return `${n}th`
  switch (n % 10) {
    case 1: return `${n}st`
    case 2: return `${n}nd`
    case 3: return `${n}rd`
    default: return `${n}th`
  }
}

/**
 * Kody wyniku dostępne dla meczu o danej długości.
 * `allowHalved` — faza grupowa dopuszcza remis; playoff nie (rozstrzyga dogrywka),
 * dlatego tam zamiast `A/S` pojawiają się kody dogrywki.
 */
export function resultCodesForHoles(
  matchHoles: number,
  opts: { allowHalved: boolean }
): string[] {
  const base = matchHoles >= 18 ? [...RESULT_CODES_18] : [...RESULT_CODES]
  const codes = opts.allowHalved ? base : base.filter((c) => c !== 'A/S')
  return opts.allowHalved ? codes : [...codes, ...extraHoleCodes(matchHoles)]
}
