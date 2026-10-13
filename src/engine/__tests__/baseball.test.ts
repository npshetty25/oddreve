import { describe, it, expect } from 'vitest';
import { baseballBallRule } from '../rules';
import { createInitialMatch, setTossCall, resolveTossThrows, selectTossChoice, playBall, startInnings2 } from '../match';

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

  it('strike on difference of 1 at 0 vs 1', () => {
    const res = baseballBallRule.resolveBall(0, 1, { currentStrikes: 1 });
    expect(res.isStrike).toBe(true);
    expect(res.runs).toBe(0);
    expect(res.newStrikesCount).toBe(2);
    expect(res.isOut).toBe(false);
  });

  it('difference of 5 is NOT a strike, batter scores throw', () => {
    // 6 vs 1 -> diff = 5 != 1
    const res = baseballBallRule.resolveBall(6, 1, { currentStrikes: 0 });
    expect(res.isStrike).toBeFalsy();
    expect(res.runs).toBe(6);
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

  it('three strikes = out, innings ends', () => {
    // Already has 2 strikes, gets a 3rd strike
    const res = baseballBallRule.resolveBall(3, 4, { currentStrikes: 2 });
    expect(res.isStrike).toBe(true);
    expect(res.newStrikesCount).toBe(3);
    expect(res.isOut).toBe(true);
    expect(res.description).toContain('STRIKE 3! Batter is OUT!');
  });

  it('runs match end to end in baseball mode', () => {
    let match = createInitialMatch({ mode: 'baseball', format: '1v1' });
    match = setTossCall(match, 'team_a', 'odd');
    match = resolveTossThrows(match, 1, 2); // 3 = odd, A wins
    match = selectTossChoice(match, 'bat'); // A bats

    // Ball 1: Double (3 and 3 with 0 strikes) -> 6 runs
    let step = playBall(match, 3, 3);
    match = step.nextState;
    expect(match.innings1.score).toBe(6);
    expect(match.innings1.wickets).toBe(0);

    // Ball 2: Strike 1 (batter 4, bowler 5) -> 0 runs, strike 1
    step = playBall(match, 4, 5);
    match = step.nextState;
    expect(match.innings1.score).toBe(6);
    expect(step.event.isStrike).toBe(true);

    // Ball 3: Regular runs (batter 6, bowler 2) -> 6 runs (Total: 12)
    step = playBall(match, 6, 2);
    match = step.nextState;
    expect(match.innings1.score).toBe(12);

    // Ball 4: Strike 2 (batter 2, bowler 2 while on strike 1)
    step = playBall(match, 2, 2);
    match = step.nextState;
    expect(step.event.isStrike).toBe(true);

    // Ball 5: Strike 3 (batter 1, bowler 2) -> OUT!
    step = playBall(match, 1, 2);
    match = step.nextState;
    expect(step.event.isOut).toBe(true);
    expect(match.phase).toBe('innings_break');
    expect(match.target).toBe(13);
  });
});
