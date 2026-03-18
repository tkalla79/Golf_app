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
    'Tied': [0, 0],
    '1Up': [1, -1],
    '2Up': [2, -2],
    '2&1': [3, -3],
    '3&1': [4, -4],
    '3&2': [5, -5],
    '4&2': [6, -6],
    '4&3': [7, -7],
    '5&3': [8, -8],
    '5&4': [9, -9],
  },
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

  if (input.resultCode === 'Tied' || !input.winnerId) {
    return {
      player1BigPoints: scoring.draw,
      player2BigPoints: scoring.draw,
      player1SmallPoints: 0,
      player2SmallPoints: 0,
    }
  }

  const p1Wins = input.winnerId === player1Id
  const smallPoints = small_points_map[input.resultCode] ?? [0, 0]
  const [winnerSmall, loserSmall] = smallPoints

  return {
    player1BigPoints: p1Wins ? scoring.win : scoring.loss,
    player2BigPoints: p1Wins ? scoring.loss : scoring.win,
    player1SmallPoints: p1Wins ? winnerSmall : loserSmall,
    player2SmallPoints: p1Wins ? loserSmall : winnerSmall,
  }
}

export const RESULT_CODES = [
  'Tied',
  '1Up',
  '2Up',
  '2&1',
  '3&1',
  '3&2',
  '4&2',
  '4&3',
  '5&3',
  '5&4',
] as const
