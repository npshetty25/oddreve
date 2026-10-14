import { describe, it, expect } from 'vitest';
import { applyAction, createRoom, RoomError, activePlayerFor } from '../roomLogic';
import { ServerRoom } from '../roomTypes';

function lobby(format: '1v1' | '2v2' = '1v1', mode: 'cricket' | 'baseball' = 'cricket'): ServerRoom {
  const room = createRoom({ code: 'abc12', hostId: 'h', hostName: 'Host', format, mode });
  applyAction(room, { action: 'join', playerId: 'g', playerName: 'Guest' });
  if (format === '2v2') {
    applyAction(room, { action: 'join', playerId: 'h2', playerName: 'HostMate' });
    applyAction(room, { action: 'join', playerId: 'g2', playerName: 'GuestMate' });
  }
  return room;
}

function throws(room: ServerRoom, a: { id: string; v: number }, b: { id: string; v: number }, kind: 'throw' | 'toss_throw' = 'throw') {
  applyAction(room, { action: kind, playerId: a.id, value: a.v, cycle: room.ballCycle });
  applyAction(room, { action: kind, playerId: b.id, value: b.v, cycle: room.ballCycle });
}

describe('room lobby', () => {
  it('rejects extra players and late joiners', () => {
    const room = lobby();
    expect(() => applyAction(room, { action: 'join', playerId: 'x', playerName: 'X' })).toThrow(RoomError);
  });

  it('assigns 2v2 players to alternating teams with slots', () => {
    const room = lobby('2v2');
    expect(room.players.map((p) => [p.id, p.teamId, p.slot])).toEqual([
      ['h', 'team_a', 0],
      ['g', 'team_b', 0],
      ['h2', 'team_a', 1],
      ['g2', 'team_b', 1],
    ]);
  });

  it('cannot start until the room is full, and only the host can start', () => {
    const room = createRoom({ code: 'abc12', hostId: 'h', hostName: 'Host', format: '2v2' });
    applyAction(room, { action: 'join', playerId: 'g', playerName: 'Guest' });
    expect(() => applyAction(room, { action: 'start', playerId: 'h' })).toThrow(/Waiting for players/);
    const full = lobby('2v2');
    expect(() => applyAction(full, { action: 'start', playerId: 'g' })).toThrow(/host/);
    applyAction(full, { action: 'start', playerId: 'h' });
    expect(full.stage).toBe('playing');
    expect(full.match?.teamA.players.map((p) => p.name)).toEqual(['Host', 'HostMate']);
  });

  it('rejoining with the same id is idempotent', () => {
    const room = lobby();
    const v = room.version;
    applyAction(room, { action: 'join', playerId: 'g', playerName: 'Guest' });
    expect(room.version).toBe(v);
    expect(room.players).toHaveLength(2);
  });
});

describe('1v1 match flow through the room', () => {
  it('lets the guest win the toss and choose; plays to match end', () => {
    const room = lobby();
    applyAction(room, { action: 'start', playerId: 'h' });

    // only host (caller) may call
    expect(() => applyAction(room, { action: 'toss_call', playerId: 'g', call: 'odd' })).toThrow(RoomError);
    applyAction(room, { action: 'toss_call', playerId: 'h', call: 'odd' });

    // 1 + 2 = 3 odd -> caller (host) wins; 1 + 1 = even -> guest wins
    throws(room, { id: 'h', v: 1 }, { id: 'g', v: 1 }, 'toss_throw');
    expect(room.match?.phase).toBe('toss_result');
    expect(room.match?.toss.winnerTeamId).toBe('team_b');

    expect(() => applyAction(room, { action: 'toss_choice', playerId: 'h', choice: 'bat' })).toThrow(RoomError);
    applyAction(room, { action: 'toss_choice', playerId: 'g', choice: 'bat' });
    expect(room.match?.phase).toBe('innings1');
    expect(room.match?.innings1.battingTeamId).toBe('team_b');

    // guest bats: 4 vs 2 => 4 runs; then equal => out, innings break
    throws(room, { id: 'h', v: 2 }, { id: 'g', v: 4 });
    expect(room.match?.innings1.score).toBe(4);
    throws(room, { id: 'h', v: 3 }, { id: 'g', v: 3 });
    expect(room.match?.phase).toBe('innings_break');

    applyAction(room, { action: 'start_innings_2', playerId: 'h' });
    applyAction(room, { action: 'start_innings_2', playerId: 'g' }); // duplicate click is harmless
    expect(room.match?.phase).toBe('innings2');

    // host chases 5 and wins
    throws(room, { id: 'h', v: 6 }, { id: 'g', v: 1 });
    expect(room.match?.phase).toBe('match_over');
    expect(room.stage).toBe('match_over');
    expect(room.match?.result?.winnerTeamId).toBe('team_a');

    // both clicking play again must not restart twice
    applyAction(room, { action: 'reset', playerId: 'h' });
    const v = room.version;
    applyAction(room, { action: 'reset', playerId: 'g' });
    expect(room.version).toBe(v);
    expect(room.match?.phase).toBe('toss_call');
  });

  it('ignores stale throws from a previous ball and double submissions', () => {
    const room = lobby();
    applyAction(room, { action: 'start', playerId: 'h' });
    applyAction(room, { action: 'toss_call', playerId: 'h', call: 'even' });
    const staleCycle = room.ballCycle - 1;
    applyAction(room, { action: 'toss_throw', playerId: 'h', value: 3, cycle: staleCycle });
    expect(room.pendingThrows.teamA).toBeNull();

    applyAction(room, { action: 'toss_throw', playerId: 'h', value: 3, cycle: room.ballCycle });
    applyAction(room, { action: 'toss_throw', playerId: 'h', value: 5, cycle: room.ballCycle });
    expect(room.pendingThrows.teamA).toBe(3); // locked in
  });

  it('rejects a 0 / out-of-range throw', () => {
    const room = lobby();
    applyAction(room, { action: 'start', playerId: 'h' });
    applyAction(room, { action: 'toss_call', playerId: 'h', call: 'even' });
    expect(() => applyAction(room, { action: 'toss_throw', playerId: 'h', value: 0 })).toThrow(RoomError);
    expect(() => applyAction(room, { action: 'toss_throw', playerId: 'h', value: 7 })).toThrow(RoomError);
  });
});

describe('2v2 match flow through the room', () => {
  it('only the active batter and bowler can throw; batter rotates after a wicket', () => {
    const room = lobby('2v2');
    applyAction(room, { action: 'start', playerId: 'h' });
    applyAction(room, { action: 'toss_call', playerId: 'h', call: 'odd' });
    // Only captains throw in the toss
    expect(() => applyAction(room, { action: 'toss_throw', playerId: 'h2', value: 1 })).toThrow(RoomError);
    throws(room, { id: 'h', v: 1 }, { id: 'g', v: 2 }, 'toss_throw'); // 3 odd -> host team wins
    expect(room.match?.toss.winnerTeamId).toBe('team_a');
    expect(() => applyAction(room, { action: 'toss_choice', playerId: 'h2', choice: 'bat' })).toThrow(RoomError);
    applyAction(room, { action: 'toss_choice', playerId: 'h', choice: 'bat' });

    expect(activePlayerFor(room, 'team_a')?.id).toBe('h');
    expect(activePlayerFor(room, 'team_b')?.id).toBe('g');
    expect(() => applyAction(room, { action: 'throw', playerId: 'h2', value: 2 })).toThrow(RoomError);

    // first batter out (equal throws) -> second teammate bats
    throws(room, { id: 'h', v: 4 }, { id: 'g', v: 4 });
    expect(room.match?.innings1.wickets).toBe(1);
    expect(activePlayerFor(room, 'team_a')?.id).toBe('h2');
  });
});
