import { GameMode, GameFormat, ThrowValue, MatchState } from '@/engine/types';
import {
  createInitialMatch,
  setTossCall,
  resolveTossThrows,
  selectTossChoice,
  playBall,
  startInnings2,
} from '@/engine/match';
import { RoomAction, ServerRoom, ServerRoomPlayer, TeamId, roomCapacity } from './roomTypes';

export class RoomError extends Error {
  constructor(message: string, public status = 400) {
    super(message);
  }
}

const CODE_CHARS = 'abcdefghjkmnpqrstuvwxyz23456789';

export function generateRoomCode(): string {
  let out = '';
  for (let i = 0; i < 5; i++) out += CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)];
  return out;
}

export function generatePlayerId(): string {
  return `p_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
}

function cleanName(name: unknown, fallback: string): string {
  const s = typeof name === 'string' ? name.trim().slice(0, 14) : '';
  return s || fallback;
}

export function createRoom(opts: {
  code: string;
  hostId: string;
  hostName: string;
  mode?: GameMode;
  format?: GameFormat;
  maxOvers?: number;
}): ServerRoom {
  const mode: GameMode = opts.mode === 'baseball' ? 'baseball' : 'cricket';
  const format: GameFormat = opts.format === '2v2' ? '2v2' : '1v1';
  const now = Date.now();
  return {
    code: opts.code,
    version: 1,
    mode,
    format,
    maxOvers: opts.maxOvers ?? Infinity,
    stage: 'lobby',
    hostId: opts.hostId,
    players: [
      {
        id: opts.hostId,
        name: cleanName(opts.hostName, 'Host'),
        teamId: 'team_a',
        slot: 0,
        isHost: true,
        lastSeen: now,
      },
    ],
    match: null,
    pendingThrows: { teamA: null, teamB: null },
    lastEvent: null,
    ballCycle: 0,
    createdAt: now,
    updatedAt: now,
  };
}

function findPlayer(room: ServerRoom, playerId: string): ServerRoomPlayer {
  const p = room.players.find((x) => x.id === playerId);
  if (!p) throw new RoomError('You are not in this room', 403);
  return p;
}

function teamPlayers(room: ServerRoom, teamId: TeamId) {
  return room.players.filter((p) => p.teamId === teamId).sort((a, b) => a.slot - b.slot);
}

function buildMatch(room: ServerRoom): MatchState {
  const a = teamPlayers(room, 'team_a');
  const b = teamPlayers(room, 'team_b');
  const is2v2 = room.format === '2v2';
  return createInitialMatch({
    mode: room.mode,
    format: room.format,
    maxOvers: room.maxOvers,
    teamAName: is2v2 ? `${a[0].name}'s Team` : a[0].name,
    teamBName: is2v2 ? `${b[0].name}'s Team` : b[0].name,
    teamAPlayers: a.map((p) => p.name),
    teamBPlayers: b.map((p) => p.name),
  });
}

/** Which room player is expected to throw for a team on the current ball. */
export function activePlayerFor(room: ServerRoom, teamId: TeamId): ServerRoomPlayer | undefined {
  const match = room.match;
  if (!match) return undefined;
  const team = teamPlayers(room, teamId);
  if (room.format !== '2v2') return team[0];

  if (match.phase === 'toss_throw') return team[0];
  const innings = match.phase === 'innings2' ? match.innings2 : match.innings1;
  if (!innings) return team[0];
  const matchTeam = teamId === 'team_a' ? match.teamA : match.teamB;
  const activeId = innings.battingTeamId === matchTeam.id ? innings.activeBatterId : innings.activeBowlerId;
  const idx = matchTeam.players.findIndex((p) => p.id === activeId);
  return team.find((p) => p.slot === Math.max(0, idx)) ?? team[0];
}

function isValidThrow(v: unknown): v is ThrowValue {
  return typeof v === 'number' && Number.isInteger(v) && v >= 1 && v <= 6;
}

/**
 * Applies one action to a room. Mutates and returns the room. Throws RoomError on invalid input.
 * Idempotent where double-delivery is plausible (two players clicking the same button).
 */
export function applyAction(room: ServerRoom, req: RoomAction, now = Date.now()): ServerRoom {
  const changed = () => {
    room.version += 1;
    room.updatedAt = now;
    return room;
  };

  if (req.action === 'join') {
    const existing = room.players.find((p) => p.id === req.playerId);
    if (existing) {
      existing.lastSeen = now;
      return room;
    }
    if (room.stage !== 'lobby') throw new RoomError('This match has already started');
    if (room.players.length >= roomCapacity(room.format)) throw new RoomError('Room is full');
    const aCount = teamPlayers(room, 'team_a').length;
    const bCount = teamPlayers(room, 'team_b').length;
    const teamId: TeamId = aCount <= bCount ? 'team_a' : 'team_b';
    room.players.push({
      id: req.playerId,
      name: cleanName(req.playerName, 'Friend'),
      teamId,
      slot: teamId === 'team_a' ? aCount : bCount,
      isHost: false,
      lastSeen: now,
    });
    return changed();
  }

  const me = findPlayer(room, req.playerId);
  me.lastSeen = now;

  switch (req.action) {
    case 'ping':
      return room;

    case 'leave': {
      if (room.stage === 'lobby' && !me.isHost) {
        room.players = room.players.filter((p) => p.id !== me.id);
        // Re-pack slots so teams stay contiguous
        (['team_a', 'team_b'] as TeamId[]).forEach((t) =>
          teamPlayers(room, t).forEach((p, i) => (p.slot = i))
        );
        return changed();
      }
      return room;
    }

    case 'start': {
      if (!me.isHost) throw new RoomError('Only the host can start the match', 403);
      if (room.stage === 'playing') return room;
      if (room.players.length < roomCapacity(room.format)) {
        throw new RoomError(`Waiting for players (${room.players.length}/${roomCapacity(room.format)})`);
      }
      room.match = buildMatch(room);
      room.stage = 'playing';
      room.pendingThrows = { teamA: null, teamB: null };
      room.lastEvent = null;
      room.ballCycle += 1;
      return changed();
    }

    case 'reset': {
      if (room.stage !== 'match_over') return room; // already restarted by the other player
      room.match = buildMatch(room);
      room.stage = 'playing';
      room.pendingThrows = { teamA: null, teamB: null };
      room.lastEvent = null;
      room.ballCycle += 1;
      return changed();
    }
  }

  const match = room.match;
  if (!match || room.stage === 'lobby') throw new RoomError('Match has not started');

  switch (req.action) {
    case 'toss_call': {
      if (match.phase !== 'toss_call') return room;
      const caller = match.toss.callerTeamId;
      if (me.teamId !== caller || (room.format === '2v2' && me.slot !== 0)) {
        throw new RoomError('Only the toss caller can call odd or even', 403);
      }
      if (req.call !== 'odd' && req.call !== 'even') throw new RoomError('Invalid call');
      room.match = setTossCall(match, caller, req.call);
      room.pendingThrows = { teamA: null, teamB: null };
      room.ballCycle += 1;
      return changed();
    }

    case 'toss_throw':
    case 'throw': {
      const tossing = req.action === 'toss_throw';
      if (tossing ? match.phase !== 'toss_throw' : match.phase !== 'innings1' && match.phase !== 'innings2') {
        return room; // stale throw from a previous phase
      }
      if (req.cycle !== undefined && req.cycle !== room.ballCycle) return room; // stale ball
      if (!isValidThrow(req.value)) throw new RoomError('Invalid throw value');
      if (activePlayerFor(room, me.teamId)?.id !== me.id) {
        throw new RoomError('It is not your turn to throw', 403);
      }
      const key = me.teamId === 'team_a' ? 'teamA' : 'teamB';
      if (room.pendingThrows[key] !== null) return room; // throw is locked once submitted
      room.pendingThrows[key] = req.value;

      const { teamA, teamB } = room.pendingThrows;
      if (teamA !== null && teamB !== null) {
        if (tossing) {
          room.match = resolveTossThrows(match, teamA, teamB);
        } else {
          const { nextState, event } = playBall(match, teamA, teamB);
          room.match = nextState;
          room.lastEvent = event;
          if (nextState.phase === 'match_over') room.stage = 'match_over';
        }
        room.pendingThrows = { teamA: null, teamB: null };
        room.ballCycle += 1;
      }
      return changed();
    }

    case 'toss_choice': {
      if (match.phase !== 'toss_result') return room;
      if (me.teamId !== match.toss.winnerTeamId || (room.format === '2v2' && me.slot !== 0)) {
        throw new RoomError('Only the toss winner can choose', 403);
      }
      if (req.choice !== 'bat' && req.choice !== 'bowl') throw new RoomError('Invalid choice');
      room.match = selectTossChoice(match, req.choice);
      room.pendingThrows = { teamA: null, teamB: null };
      room.ballCycle += 1;
      return changed();
    }

    case 'start_innings_2': {
      if (match.phase !== 'innings_break') return room;
      room.match = startInnings2(match);
      room.pendingThrows = { teamA: null, teamB: null };
      room.lastEvent = null;
      room.ballCycle += 1;
      return changed();
    }
  }

  throw new RoomError('Unknown action');
}
