import { NextRequest, NextResponse } from 'next/server';
import { createRoom, generatePlayerId, generateRoomCode } from '@/multiplayer/roomLogic';
import { createRoomRecord, getRoom, storageReliable } from '@/multiplayer/roomStore';
import type { ServerRoom } from '@/multiplayer/roomTypes';

export type { ServerRoom } from '@/multiplayer/roomTypes';

// POST /api/rooms -> create a room
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));

    // Restore: a client re-uploads its last known room after the server lost it (cold start,
    // redeploy). The first upload wins; later ones just receive the stored room.
    if (body.restore) {
      const r = body.restore as ServerRoom;
      const valid =
        r &&
        typeof r.code === 'string' &&
        /^[a-z0-9]{4,8}$/.test(r.code) &&
        Array.isArray(r.players) &&
        r.players.length > 0 &&
        r.players.length <= 4 &&
        typeof r.hostId === 'string';
      if (!valid) {
        return NextResponse.json({ success: false, error: 'Invalid room' }, { status: 400 });
      }
      const room: ServerRoom = { ...r, updatedAt: Date.now() };
      if (room.maxOvers == null) room.maxOvers = Infinity;
      if (room.match && room.match.maxOvers == null) room.match.maxOvers = Infinity;
      const created = await createRoomRecord(room);
      const stored = created ? room : await getRoom(room.code);
      return NextResponse.json({
        success: Boolean(stored),
        room: stored,
        restored: created,
        reliable: storageReliable(),
      });
    }

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
          reliable: storageReliable(),
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
