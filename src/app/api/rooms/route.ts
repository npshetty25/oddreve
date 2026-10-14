import { NextRequest, NextResponse } from 'next/server';
import { createRoom, generatePlayerId, generateRoomCode } from '@/multiplayer/roomLogic';
import { createRoomRecord, usingRedis } from '@/multiplayer/roomStore';

export type { ServerRoom } from '@/multiplayer/roomTypes';

// POST /api/rooms -> create a room
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const hostId = generatePlayerId();

    for (let i = 0; i < 8; i++) {
      const room = createRoom({
        code: generateRoomCode(),
        hostId,
        hostName: body.playerName,
        mode: body.mode,
        format: body.format,
      });
      if (await createRoomRecord(room)) {
        return NextResponse.json({
          success: true,
          roomCode: room.code,
          playerId: hostId,
          room,
          persistent: usingRedis(),
        });
      }
    }
    return NextResponse.json({ success: false, error: 'Could not allocate a room code' }, { status: 503 });
  } catch (err) {
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : 'Server error' },
      { status: 500 }
    );
  }
}
