import { TossCall, ThrowValue, TossChoice } from './types';

export interface TossResult {
  total: number;
  isEven: boolean;
  callerCall: TossCall;
  callerWon: boolean;
  winnerTeamId: string;
}

/**
 * Pure function: resolveToss
 * - Caller team calls 'odd' or 'even'
 * - Team A and Team B throw 0–6
 * - Sum decides if total is odd or even
 * - Determines which team wins the toss
 */
export function resolveToss(
  callerTeamId: string,
  callerCall: TossCall,
  teamAId: string,
  teamBId: string,
  throwA: ThrowValue,
  throwB: ThrowValue
): TossResult {
  const total = throwA + throwB;
  const isEven = total % 2 === 0;
  const callerWon = (isEven && callerCall === 'even') || (!isEven && callerCall === 'odd');
  const otherTeamId = callerTeamId === teamAId ? teamBId : teamAId;
  const winnerTeamId = callerWon ? callerTeamId : otherTeamId;

  return {
    total,
    isEven,
    callerCall,
    callerWon,
    winnerTeamId,
  };
}

/**
 * Converts balls count to cricket standard overs string, e.g. 0 -> "0.0", 1 -> "0.1", 6 -> "1.0", 11 -> "1.5"
 */
export function formatOvers(balls: number): string {
  const overs = Math.floor(balls / 6);
  const remainingBalls = balls % 6;
  return `${overs}.${remainingBalls}`;
}
