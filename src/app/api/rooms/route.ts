import { NextRequest, NextResponse } from 'next/server';
import { GameMode, GameFormat, ThrowValue } from '@/engine/types';
import { createInitialMatch } from '@/engine/match';

// Shared in-memory room storage across API requests
export interface ServerRoom {
  code: string;
  mode: GameMode;
  format: GameFormat;
  maxOvers: number;
  stage: 'lobby' | 'playing' | 'match_over';
  hostId: string;
  players: Array<{
    id: string;
    name: string;
    teamId: 'team_a' | 'team_b';
    isHost: boolean;
    connected: boolean;
  }>;
  match: any;
  pendingThrows: {
    teamA: ThrowValue | null;
    teamB: ThrowValue | null;
  };
  lastEvent: any;
  ballCycle: number;
  chat: Array<{
    sender: string;
    text: string;
    time: string;
  }>;
  createdAt: number;
}

declare global {
  var __ODDOREVE_ROOMS__: Map<string, ServerRoom> | undefined;
}

export function getRoomsMap(): Map<string, ServerRoom> {
  if (!global.__ODDOREVE_ROOMS__) {
    global.__ODDOREVE_ROOMS__ = new Map();
  }
  return global.__ODDOREVE_ROOMS__;
}

function generateRoomCode(): string {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  for (let i = 0; i < 6; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

// POST /api/rooms -> Create room
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const { playerName = 'Host', mode = 'cricket', format = '1v1' } = body;

    const rooms = getRoomsMap();
    let code = generateRoomCode();
    while (rooms.has(code)) {
      code = generateRoomCode();
    }

    const hostId = `player_${Date.now().toString(36)}`;
    const initialMatch = createInitialMatch({
      mode,
      format,
      teamAName: playerName,
      teamBName: 'Waiting for friend...',
    });

    const room: ServerRoom = {
      code,
      mode,
      format,
      maxOvers: 2,
      stage: 'lobby',
      hostId,
      players: [
        {
          id: hostId,
          name: playerName,
          teamId: 'team_a',
          isHost: true,
          connected: true,
        },
      ],
      match: initialMatch,
      pendingThrows: {
        teamA: null,
        teamB: null,
      },
      lastEvent: null,
      ballCycle: 0,
      chat: [
        {
          sender: 'System',
          text: `Room created! Share code ${code} with your friend.`,
          time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        },
      ],
      createdAt: Date.now(),
    };

    rooms.set(code, room);

    return NextResponse.json({
      success: true,
      roomCode: code,
      playerId: hostId,
      room,
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
