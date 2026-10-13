import { describe, it, expect } from 'vitest';
import { createInitialMatch, setTossCall, resolveTossThrows, selectTossChoice, playBall, startInnings2 } from '../match';

describe('Phase 3 2v2 Team Format with Overs & Rotation', () => {
  it('over counting (6 balls = 1 over, 1.5 -> 2.0)', () => {
    let match = createInitialMatch({
      mode: 'cricket',
      format: '2v2',
      maxOvers: 2,
      teamAName: 'Warriors',
      teamBName: 'Knights',
      teamAPlayers: ['Alice', 'Aaron'],
      teamBPlayers: ['Bob', 'Ben'],
    });

    match = setTossCall(match, 'team_a', 'even');
    match = resolveTossThrows(match, 2, 2);
    match = selectTossChoice(match, 'bat'); // Warriors bat

    // Bowl 5 balls
    for (let i = 0; i < 5; i++) {
      const step = playBall(match, 1, 3);
      match = step.nextState;
      expect(step.event.overString).toBe(`0.${i + 1}`);
    }

    // 6th ball -> over completes -> 1.0
    let step = playBall(match, 2, 4);
    match = step.nextState;
    expect(step.event.overString).toBe('1.0');
    expect(match.innings1.balls).toBe(6);

    // Bowler should rotate to second player (Ben) after over 1
    expect(match.innings1.activeBowlerId).toBe('b_2');

    // Bowl balls 7 through 11 (1.1 to 1.5)
    for (let i = 1; i <= 5; i++) {
      step = playBall(match, 2, 5);
      match = step.nextState;
      expect(step.event.overString).toBe(`1.${i}`);
    }

    // Ball 12 -> 2.0 (Overs exhausted)
    step = playBall(match, 3, 5);
    match = step.nextState;
    expect(step.event.overString).toBe('2.0');
    expect(match.innings1.balls).toBe(12);
    expect(match.phase).toBe('innings_break');
    expect(match.innings1.endReason).toBe('overs_completed');
  });

  it('batter rotation on wicket and all-out condition in 2v2', () => {
    let match = createInitialMatch({
      mode: 'cricket',
      format: '2v2',
      maxOvers: 2,
      teamAPlayers: ['Alice', 'Aaron'],
      teamBPlayers: ['Bob', 'Ben'],
    });

    match = setTossCall(match, 'team_a', 'even');
    match = resolveTossThrows(match, 2, 2);
    match = selectTossChoice(match, 'bat');

    // Alice is initial batter
    expect(match.innings1.activeBatterId).toBe('a_1');

    // Alice gets out on equal throw (3 and 3)
    let step = playBall(match, 3, 3);
    match = step.nextState;
    expect(match.innings1.wickets).toBe(1);
    expect(match.phase).toBe('innings1'); // Still active, next batter comes in!
    expect(match.innings1.activeBatterId).toBe('a_2'); // Aaron is now batting

    // Aaron scores 4 runs
    step = playBall(match, 4, 1);
    match = step.nextState;
    expect(match.innings1.score).toBe(4);

    // Aaron gets out on equal throw (5 and 5) -> All out! (2 wickets)
    step = playBall(match, 5, 5);
    match = step.nextState;
    expect(match.innings1.wickets).toBe(2);
    expect(match.phase).toBe('innings_break');
    expect(match.innings1.endReason).toBe('all_out');
    expect(match.target).toBe(5);
  });

  it('2v2 chase target resolution and individual stats tracking', () => {
    let match = createInitialMatch({
      mode: 'cricket',
      format: '2v2',
      maxOvers: 1,
      teamAPlayers: ['Alice', 'Aaron'],
      teamBPlayers: ['Bob', 'Ben'],
    });

    match = setTossCall(match, 'team_a', 'even');
    match = resolveTossThrows(match, 2, 2);
    match = selectTossChoice(match, 'bat');

    // 1st innings: Alice scores 4 and 6, then gets out. Aaron scores 2.
    match = playBall(match, 4, 1).nextState;
    match = playBall(match, 6, 2).nextState;
    match = playBall(match, 3, 3).nextState; // Alice out
    match = playBall(match, 2, 4).nextState; // Aaron scores 2. (Score = 12)
    match = playBall(match, 1, 1).nextState; // Aaron out. (Target = 13)

    expect(match.phase).toBe('innings_break');
    expect(match.target).toBe(13);

    // 2nd innings: Bob & Ben chase
    match = startInnings2(match);
    expect(match.phase).toBe('innings2');
    expect(match.innings2?.activeBatterId).toBe('b_1');

    // Bob scores 6 and 6 -> 12 runs
    match = playBall(match, 1, 6).nextState; // Bowler Alice (1), Batter Bob (6)
    match = playBall(match, 2, 6).nextState; // Bowler Alice (2), Batter Bob (6)
    expect(match.innings2?.score).toBe(12);

    // Bob scores 2 runs -> 14 runs >= 13 target -> Win by 2 wickets!
    match = playBall(match, 0, 2).nextState;
    expect(match.phase).toBe('match_over');
    expect(match.result?.winnerTeamId).toBe('team_b');
    expect(match.result?.marginText).toContain('Team B won by 2 wickets');

    // Verify Bob's stats
    const bob = match.teamB.players.find((p) => p.name === 'Bob');
    expect(bob?.runs).toBe(14);
    expect(bob?.ballsFaced).toBe(3);
    expect(bob?.isOut).toBe(false);
  });

  it('2v2 works with baseball mode as well', () => {
    let match = createInitialMatch({
      mode: 'baseball',
      format: '2v2',
      maxOvers: 2,
    });
    match = setTossCall(match, 'team_a', 'even');
    match = resolveTossThrows(match, 2, 2);
    match = selectTossChoice(match, 'bat');

    // Double runs on 4 and 4 with 0 strikes -> 8 runs
    let step = playBall(match, 4, 4);
    match = step.nextState;
    expect(match.innings1.score).toBe(8);
    expect(step.event.isDouble).toBe(true);
  });
});
