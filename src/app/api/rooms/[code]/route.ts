import { NextRequest, NextResponse } from 'next/server';
import { getRoomsMap, ServerRoom } from '../route';
import { resolveTossThrows, selectTossChoice, setTossCall, playBall, startInnings2, createInitialMatch } from '@/engine/match';
import { ThrowValue, TossCall, TossChoice } from '@/engine/types';

interface RouteContext {
  params: Promise<{ code: string }>;
}

// GET /api/rooms/[code]
export async function GET(req: NextRequest, context: RouteContext) {
  const { code } = await context.params;
  const rooms = getRoomsMap();
  const room = rooms.get(code.toLowerCase());

  if (!room) {
    return NextResponse.json({ success: false, error: 'Room not found' }, { status: 404 });
  }

  return NextResponse.json({ success: true, room });
}

// POST /api/rooms/[code]
export async function POST(req: NextRequest, context: RouteContext) {
  try {
    const { code } = await context.params;
    const rooms = getRoomsMap();
    const room = rooms.get(code.toLowerCase());

    if (!room) {
      return NextResponse.json({ success: false, error: 'Room not found' }, { status: 404 });
    }

    const body = await req.json();
    const { action } = body;

    // 1. JOIN ROOM
    if (action === 'join') {
      const { playerId = `player_${Date.now().toString(36)}`, playerName = 'Friend' } = body;

      const existingPlayer = room.players.find((p) => p.id === playerId);
      if (existingPlayer) {
        existingPlayer.connected = true;
        return NextResponse.json({ success: true, room, playerId: existingPlayer.id });
      }

      if (room.players.length >= 2) {
        return NextResponse.json({ success: false, error: 'Room is already full (2/2 players)' }, { status: 400 });
      }

      const newPlayer = {
        id: playerId,
        name: playerName,
        teamId: 'team_b' as const,
        isHost: false,
        connected: true,
      };

      room.players.push(newPlayer);
      if (room.match) {
        room.match.teamB.name = playerName;
      }

      room.chat.push({
        sender: 'System',
        text: `${playerName} joined the room!`,
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      });

      return NextResponse.json({ success: true, room, playerId: newPlayer.id });
    }

    // 2. START MATCH
    if (action === 'start') {
      if (room.players.length < 2) {
        return NextResponse.json({ success: false, error: 'Need 2 players to start match' }, { status: 400 });
      }

      const teamA = room.players.find((p) => p.teamId === 'team_a');
      const teamB = room.players.find((p) => p.teamId === 'team_b');

      room.match = createInitialMatch({
        mode: room.mode,
        format: room.format,
        teamAName: teamA?.name || 'Player 1',
        teamBName: teamB?.name || 'Player 2',
      });
      room.stage = 'playing';
      room.pendingThrows = { teamA: null, teamB: null };
      room.lastEvent = null;
      room.ballCycle = 0;

      return NextResponse.json({ success: true, room });
    }

    // 3. TOSS CALL
    if (action === 'toss_call') {
      const { callerTeamId = 'team_a', call = 'odd' } = body;
      room.match = setTossCall(room.match, callerTeamId, call as TossCall);
      room.pendingThrows = { teamA: null, teamB: null };
      room.ballCycle += 1;
      return NextResponse.json({ success: true, room });
    }

    // 4. TOSS THROW
    if (action === 'toss_throw') {
      const { teamId, value } = body;
      if (value < 1 || value > 6) {
        return NextResponse.json({ success: false, error: 'Invalid throw value' }, { status: 400 });
      }

      if (teamId === 'team_a') {
        room.pendingThrows.teamA = value;
      } else {
        room.pendingThrows.teamB = value;
      }

      // If both throws are submitted, resolve toss
      if (room.pendingThrows.teamA !== null && room.pendingThrows.teamB !== null) {
        room.match = resolveTossThrows(room.match, room.pendingThrows.teamA as ThrowValue, room.pendingThrows.teamB as ThrowValue);
        room.pendingThrows = { teamA: null, teamB: null };
        room.ballCycle += 1;
      }

      return NextResponse.json({ success: true, room });
    }

    // 5. TOSS CHOICE (bat or bowl)
    if (action === 'toss_choice') {
      const { choice } = body;
      room.match = selectTossChoice(room.match, choice as TossChoice);
      room.pendingThrows = { teamA: null, teamB: null };
      room.ballCycle += 1;
      return NextResponse.json({ success: true, room });
    }

    // 6. GAMEPLAY BALL THROW (innings 1 or 2)
    if (action === 'throw') {
      const { teamId, value } = body;
      if (value < 1 || value > 6) {
        return NextResponse.json({ success: false, error: 'Invalid throw value' }, { status: 400 });
      }

      if (teamId === 'team_a') {
        room.pendingThrows.teamA = value;
      } else {
        room.pendingThrows.teamB = value;
      }

      // When both players have submitted their throw for this ball
      if (room.pendingThrows.teamA !== null && room.pendingThrows.teamB !== null) {
        const { nextState, event } = playBall(
          room.match,
          room.pendingThrows.teamA as ThrowValue,
          room.pendingThrows.teamB as ThrowValue
        );
        room.match = nextState;
        room.lastEvent = event;
        room.pendingThrows = { teamA: null, teamB: null };
        room.ballCycle += 1;

        if (nextState.phase === 'match_over') {
          room.stage = 'match_over';
        }
      }

      return NextResponse.json({ success: true, room });
    }

    // 7. INNINGS 2 START
    if (action === 'start_innings_2') {
      room.match = startInnings2(room.match);
      room.pendingThrows = { teamA: null, teamB: null };
      room.lastEvent = null;
      room.ballCycle += 1;
      return NextResponse.json({ success: true, room });
    }

    // 8. CHAT MESSAGE
    if (action === 'chat') {
      const { sender = 'Player', text = '' } = body;
      if (text.trim()) {
        room.chat.push({
          sender,
          text: text.trim(),
          time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        });
      }
      return NextResponse.json({ success: true, room });
    }

    // 9. RESET / PLAY AGAIN
    if (action === 'reset') {
      const teamA = room.players.find((p) => p.teamId === 'team_a');
      const teamB = room.players.find((p) => p.teamId === 'team_b');

      room.match = createInitialMatch({
        mode: room.mode,
        format: room.format,
        teamAName: teamA?.name || 'Player 1',
        teamBName: teamB?.name || 'Player 2',
      });
      room.stage = 'playing';
      room.pendingThrows = { teamA: null, teamB: null };
      room.lastEvent = null;
      room.ballCycle = 0;
      return NextResponse.json({ success: true, room });
    }

    return NextResponse.json({ success: false, error: 'Unknown action' }, { status: 400 });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
