import { describe, it, expect } from 'vitest';
import { resolveToss, formatOvers } from '../toss';
import { cricketBallRule, baseballBallRule } from '../rules';
import {
  createInitialMatch,
  setTossCall,
  resolveTossThrows,
  selectTossChoice,
  startInnings2,
  playBall,
} from '../match';
import { ThrowValue } from '../types';

describe('Toss Engine & Utilities', () => {
  it('correctly resolves odd/even toss where caller calls odd and sum is odd', () => {
    // 3 + 4 = 7 (odd) -> caller wins
    const result = resolveToss('team_a', 'odd', 'team_a', 'team_b', 3, 4);
    expect(result.total).toBe(7);
    expect(result.isEven).toBe(false);
    expect(result.callerWon).toBe(true);
    expect(result.winnerTeamId).toBe('team_a');
  });

  it('correctly resolves odd/even toss where caller calls even and sum is odd', () => {
    // 2 + 3 = 5 (odd) -> caller called even -> other team wins
    const result = resolveToss('team_a', 'even', 'team_a', 'team_b', 2, 3);
    expect(result.callerWon).toBe(false);
    expect(result.winnerTeamId).toBe('team_b');
  });

  it('formats overs correctly (0.0 to 1.5 and beyond)', () => {
    expect(formatOvers(0)).toBe('0.0');
    expect(formatOvers(1)).toBe('0.1');
    expect(formatOvers(5)).toBe('0.5');
    expect(formatOvers(6)).toBe('1.0');
    expect(formatOvers(7)).toBe('1.1');
    expect(formatOvers(11)).toBe('1.5');
    expect(formatOvers(12)).toBe('2.0');
  });
});

describe('Phase 1 Pure Cricket Engine (1v1)', () => {
  it('cricket rule: out on equal throws', () => {
    const res = cricketBallRule.resolveBall(4, 4);
    expect(res.isOut).toBe(true);
    expect(res.runs).toBe(0);
  });

  it('cricket rule: batter scores throw value when throws differ', () => {
    const res = cricketBallRule.resolveBall(6, 2);
    expect(res.isOut).toBe(false);
    expect(res.runs).toBe(6);
  });

  it('full 1v1 match flow: runs accumulate, out on equal throws, chase win', () => {
    // 1. Initial match
    let match = createInitialMatch({
      mode: 'cricket',
      format: '1v1',
      teamAName: 'Alice',
      teamBName: 'Bob',
    });
    expect(match.phase).toBe('toss_call');

    // 2. Call toss: Team A calls 'odd'
    match = setTossCall(match, 'team_a', 'odd');
    expect(match.phase).toBe('toss_throw');

    // 3. Toss throws: A throws 3, B throws 2 -> sum = 5 (odd) -> Team A wins toss
    match = resolveTossThrows(match, 3, 2);
    expect(match.phase).toBe('toss_result');
    expect(match.toss.winnerTeamId).toBe('team_a');

    // 4. Toss choice: Team A chooses to 'bat'
    match = selectTossChoice(match, 'bat');
    expect(match.phase).toBe('innings1');
    expect(match.innings1.battingTeamId).toBe('team_a');
    expect(match.innings1.bowlingTeamId).toBe('team_b');

    // 5. Ball 1: Alice throws 4, Bob throws 2 -> 4 runs
    let step = playBall(match, 4, 2);
    match = step.nextState;
    expect(match.innings1.score).toBe(4);
    expect(match.innings1.balls).toBe(1);
    expect(match.innings1.wickets).toBe(0);

    // 6. Ball 2: Alice throws 6, Bob throws 1 -> 6 runs (Total: 10)
    step = playBall(match, 6, 1);
    match = step.nextState;
    expect(match.innings1.score).toBe(10);
    expect(match.innings1.wickets).toBe(0);

    // 7. Ball 3: Alice throws 3, Bob throws 3 -> OUT! (Innings 1 ends, 1v1 is 1 wicket)
    step = playBall(match, 3, 3);
    match = step.nextState;
    expect(match.innings1.score).toBe(10);
    expect(match.innings1.wickets).toBe(1);
    expect(match.phase).toBe('innings_break');
    expect(match.target).toBe(11); // Chase target is 10 + 1 = 11

    // 8. Start Innings 2 (Bob bats, Alice bowls)
    match = startInnings2(match);
    expect(match.phase).toBe('innings2');
    expect(match.innings2?.battingTeamId).toBe('team_b');

    // 9. Innings 2 Ball 1: Alice (bowler) throws 1, Bob (batter) throws 6 -> Bob scores 6
    step = playBall(match, 1, 6);
    match = step.nextState;
    expect(match.innings2?.score).toBe(6);
    expect(match.phase).toBe('innings2');

    // 10. Innings 2 Ball 2: Alice (bowler) throws 2, Bob (batter) throws 5 -> Bob scores 5 (Total: 11 >= 11 Target)
    step = playBall(match, 2, 5);
    match = step.nextState;
    expect(match.innings2?.score).toBe(11);
    expect(match.phase).toBe('match_over');
    expect(match.result?.winnerTeamId).toBe('team_b');
    expect(match.result?.marginText).toContain('Bob won by 1 wicket');
  });

  it('chase loss when chasing team is out before target', () => {
    let match = createInitialMatch({ mode: 'cricket', format: '1v1' });
    match = setTossCall(match, 'team_a', 'even');
    match = resolveTossThrows(match, 2, 2); // 4 = even, A wins
    match = selectTossChoice(match, 'bat'); // Team A bats

    // Team A scores 5, then is out
    match = playBall(match, 5, 1).nextState;
    match = playBall(match, 2, 2).nextState; // OUT! Total score = 5. Target = 6
    expect(match.phase).toBe('innings_break');
    expect(match.target).toBe(6);

    // Innings 2: Team B bats
    match = startInnings2(match);
    match = playBall(match, 0, 3).nextState; // Team A bowls 0, Team B bats 3 -> 3 runs
    match = playBall(match, 4, 4).nextState; // Team A bowls 4, Team B bats 4 -> OUT!

    expect(match.phase).toBe('match_over');
    expect(match.result?.winnerTeamId).toBe('team_a');
    expect(match.result?.marginText).toContain('Team A won by 2 runs');
  });

  it('tie resolution when chasing team score matches first innings and gets out', () => {
    let match = createInitialMatch({ mode: 'cricket', format: '1v1' });
    match = setTossCall(match, 'team_a', 'even');
    match = resolveTossThrows(match, 2, 2);
    match = selectTossChoice(match, 'bat');

    // Team A scores 4, then out
    match = playBall(match, 4, 1).nextState;
    match = playBall(match, 3, 3).nextState; // OUT, score 4, target 5
    expect(match.target).toBe(5);

    // Innings 2: Team B scores 4, then out
    match = startInnings2(match);
    match = playBall(match, 0, 4).nextState; // score 4
    match = playBall(match, 2, 2).nextState; // OUT at score 4

    expect(match.phase).toBe('match_over');
    expect(match.result?.winnerTeamId).toBe('tie');
    expect(match.result?.marginText).toBe('Match Tied!');
  });
});
