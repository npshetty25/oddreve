import { NextRequest, NextResponse } from 'next/server';
import { getRoom, updateRoom, touchPlayer, storageReliable } from '@/multiplayer/roomStore';
import { applyAction, RoomError } from '@/multiplayer/roomLogic';
import { RoomAction } from '@/multiplayer/roomTypes';

interface RouteContext {
  params: Promise<{ code: string }>;
}

const notFound = () =>
  NextResponse.json(
    { success: false, error: 'Room not found. It may have expired — ask your friend for a new code.' },
    { status: 404 }
  );

// GET /api/rooms/[code]?playerId=...  (poll; playerId doubles as a heartbeat)
export async function GET(req: NextRequest, context: RouteContext) {
  try {
    const { code } = await context.params;
    const playerId = req.nextUrl.searchParams.get('playerId');

    const room = await getRoom(code);
    if (room && playerId) await touchPlayer(room, playerId); // heartbeat; no version bump

    if (!room) return notFound();
    return NextResponse.json({ success: true, room, serverTime: Date.now(), reliable: storageReliable() });
  } catch (err) {
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : 'Server error' },
      { status: 500 }
    );
  }
}

// POST /api/rooms/[code]  body: RoomAction
export async function POST(req: NextRequest, context: RouteContext) {
  try {
    const { code } = await context.params;
    const body = (await req.json().catch(() => null)) as RoomAction | null;
    if (!body || typeof body.action !== 'string' || typeof body.playerId !== 'string') {
      return NextResponse.json({ success: false, error: 'Invalid request' }, { status: 400 });
    }

    let failure: RoomError | null = null;
    const room = await updateRoom(code, (r) => {
      try {
        return applyAction(r, body);
      } catch (e) {
        if (e instanceof RoomError) {
          failure = e;
          return r;
        }
        throw e;
      }
    });

    if (!room) return notFound();
    if (failure) {
      const f = failure as RoomError;
      return NextResponse.json({ success: false, error: f.message, room }, { status: f.status });
    }
    return NextResponse.json({
      success: true,
      room,
      playerId: body.playerId,
      serverTime: Date.now(),
      reliable: storageReliable(),
    });
  } catch (err) {
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : 'Server error' },
      { status: 500 }
    );
  }
}
