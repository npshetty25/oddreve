import { ThrowValue, BallResolutionResult } from './types';

export interface BallRuleConfig {
  name: string;
  resolveBall: (
    batterThrow: ThrowValue,
    bowlerThrow: ThrowValue,
    context?: { currentStrikes?: number }
  ) => BallResolutionResult;
}

/**
 * Standard Cricket ball resolution rule:
 * - Each ball, both players throw. Batter's throw is their runs.
 * - If both throws are equal → batter is out, innings ends (or wicket falls).
 * - Otherwise batter adds their throw to the score.
 */
export const cricketBallRule: BallRuleConfig = {
  name: 'cricket',
  resolveBall: (batterThrow: ThrowValue, bowlerThrow: ThrowValue): BallResolutionResult => {
    if (batterThrow === bowlerThrow) {
      return {
        runs: 0,
        isOut: true,
        description: `OUT! Both threw ${batterThrow}!`,
      };
    }
    return {
      runs: batterThrow,
      isOut: false,
      description: `+${batterThrow} run${batterThrow === 1 ? '' : 's'}!`,
    };
  },
};

/**
 * Baseball ball resolution rule (Phase 2):
 * - If |b - o| = 1 → strike. Strikes count toward the batter's out count.
 * - If b = o:
 *   - If the batter has 0 strikes → batter scores 2 * b (e.g. 2 and 2 = 4 runs).
 *   - If the batter has 1 strike → it counts as a strike, not a double.
 * - Otherwise → batter scores b runs.
 * - Three strikes = out, innings ends (or batter out).
 */
export const baseballBallRule: BallRuleConfig = {
  name: 'baseball',
  resolveBall: (
    batterThrow: ThrowValue,
    bowlerThrow: ThrowValue,
    context?: { currentStrikes?: number }
  ): BallResolutionResult => {
    const currentStrikes = context?.currentStrikes ?? 0;
    const diff = Math.abs(batterThrow - bowlerThrow);
    // Rule 1: Difference of 1 or circular (6 and 1) is a strike
    const isStrikeDiff = diff === 1 || (batterThrow === 6 && bowlerThrow === 1) || (batterThrow === 1 && bowlerThrow === 6);

    if (isStrikeDiff) {
      const nextStrikes = currentStrikes + 1;
      const isOut = nextStrikes >= 3;
      return {
        runs: 0,
        isOut,
        isStrike: true,
        newStrikesCount: nextStrikes,
        description: isOut
          ? `STRIKE 3! Batter is OUT!`
          : `Strike! (${batterThrow} vs ${bowlerThrow}) - Consecutive Strike ${nextStrikes}/3`,
      };
    }

    // Rule 2: Equal throws
    if (batterThrow === bowlerThrow) {
      if (currentStrikes === 0) {
        // Double runs!
        const doubleRuns = (batterThrow * 2);
        return {
          runs: doubleRuns,
          isOut: false,
          isDouble: true,
          newStrikesCount: 0,
          description: `Double: ${doubleRuns} runs! (${batterThrow} = ${bowlerThrow})`,
        };
      } else {
        // If batter has >= 1 strike, equal throw counts as a strike
        const nextStrikes = currentStrikes + 1;
        const isOut = nextStrikes >= 3;
        return {
          runs: 0,
          isOut,
          isStrike: true,
          newStrikesCount: nextStrikes,
          description: isOut
            ? `STRIKE 3 on equal throw! Batter is OUT!`
            : `Strike! (Equal throw ${batterThrow} while on strike) - Consecutive Strike ${nextStrikes}/3`,
        };
      }
    }

    // Rule 3: Otherwise batter scores runs and consecutive strike count resets to 0
    return {
      runs: batterThrow,
      isOut: false,
      newStrikesCount: 0,
      description: `+${batterThrow} run${batterThrow === 1 ? '' : 's'}!`,
    };
  },
};

export const rulesRegistry: Record<string, BallRuleConfig> = {
  cricket: cricketBallRule,
  baseball: baseballBallRule,
};
