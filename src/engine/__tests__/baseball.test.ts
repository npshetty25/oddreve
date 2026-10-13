import { describe, it, expect } from 'vitest';
import { baseballBallRule } from '../rules';
import { createInitialMatch, setTossCall, resolveTossThrows, selectTossChoice, playBall } from '../match';

describe('Phase 2 Pure Baseball Mode Rules', () => {
  it('strike on difference of 1 at 1 vs 2', () => {
    const res = baseballBallRule.resolveBall(1, 2, { currentStrikes: 0 });
    expect(res.isStrike).toBe(true);
    expect(res.runs).toBe(0);
    expect(res.newStrikesCount).toBe(1);
    expect(res.isOut).toBe(false);
  });

  it('strike on difference of 1 at 6 vs 5', () => {
    const res = baseballBallRule.resolveBall(6, 5, { currentStrikes: 0 });
    expect(res.isStrike).toBe(true);
    expect(res.runs).toBe(0);
    expect(res.newStrikesCount).toBe(1);
    expect(res.isOut).toBe(false);
  });

  it('strike on 6 and 1 (wrap-around / difference of 5 between 6 and 1)', () => {
    const res1 = baseballBallRule.resolveBall(6, 1, { currentStrikes: 0 });
    expect(res1.isStrike).toBe(true);
    expect(res1.runs).toBe(0);
    expect(res1.newStrikesCount).toBe(1);
    expect(res1.isOut).toBe(false);

    const res2 = baseballBallRule.resolveBall(1, 6, { currentStrikes: 1 });
    expect(res2.isStrike).toBe(true);
    expect(res2.runs).toBe(0);
    expect(res2.newStrikesCount).toBe(2);
    expect(res2.isOut).toBe(false);
  });

  it('non-strike throws score runs and reset strike count', () => {
    // 6 vs 2 -> diff = 4, not a strike
    const res = baseballBallRule.resolveBall(6, 2, { currentStrikes: 2 });
    expect(res.isStrike).toBeFalsy();
    expect(res.runs).toBe(6);
    expect(res.newStrikesCount).toBe(0);
    expect(res.isOut).toBe(false);
  });

  it('double score when throws are equal and batter has 0 strikes', () => {
    // 2 and 2 = 2 * 2 = 4 runs
    const res = baseballBallRule.resolveBall(2, 2, { currentStrikes: 0 });
    expect(res.isDouble).toBe(true);
    expect(res.runs).toBe(4);
    expect(res.isOut).toBe(false);
    expect(res.description).toContain('Double: 4 runs!');
  });

  it('equal throws when batter has 1 strike counts as a strike, NOT a double', () => {
    const res = baseballBallRule.resolveBall(2, 2, { currentStrikes: 1 });
    expect(res.isStrike).toBe(true);
    expect(res.isDouble).toBeFalsy();
    expect(res.runs).toBe(0);
    expect(res.newStrikesCount).toBe(2);
    expect(res.isOut).toBe(false);
  });

  it('three consecutive strikes = out', () => {
    const res = baseballBallRule.resolveBall(3, 4, { currentStrikes: 2 });
    expect(res.isStrike).toBe(true);
    expect(res.newStrikesCount).toBe(3);
    expect(res.isOut).toBe(true);
    expect(res.description).toContain('STRIKE 3! Batter is OUT!');
  });

  it('non-consecutive strikes do not cause out (hit resets strike streak)', () => {
    let match = createInitialMatch({ mode: 'baseball', format: '1v1' });
    match = setTossCall(match, 'team_a', 'odd');
    match = resolveTossThrows(match, 1, 2);
    match = selectTossChoice(match, 'bat');

    // Strike 1 (4 vs 5)
    let step = playBall(match, 4, 5);
    match = step.nextState;
    expect(step.event.isStrike).toBe(true);
    expect(match.innings1.wickets).toBe(0);

    // Strike 2 (6 vs 1 -> 6 and 1 strike rule!)
    step = playBall(match, 6, 1);
    match = step.nextState;
    expect(step.event.isStrike).toBe(true);
    expect(match.innings1.wickets).toBe(0);

    // Hit (5 vs 2) -> Resets consecutive strikes!
    step = playBall(match, 5, 2);
    match = step.nextState;
    expect(step.event.isStrike).toBeFalsy();
    expect(match.innings1.score).toBe(5);
    expect(match.innings1.wickets).toBe(0);

    // Strike 1 again (2 vs 3) -> 1st strike in new streak, NOT out!
    step = playBall(match, 2, 3);
    match = step.nextState;
    expect(step.event.isStrike).toBe(true);
    expect(match.innings1.wickets).toBe(0);
    expect(match.phase).toBe('innings1');

    // Strike 2 again (3 vs 2)
    step = playBall(match, 3, 2);
    match = step.nextState;
    expect(step.event.isStrike).toBe(true);
    expect(match.innings1.wickets).toBe(0);

    // Strike 3 consecutive (1 vs 6) -> 3 in a row -> OUT!
    step = playBall(match, 1, 6);
    match = step.nextState;
    expect(step.event.isOut).toBe(true);
    expect(match.phase).toBe('innings_break');
    expect(match.target).toBe(6);
  });
});
