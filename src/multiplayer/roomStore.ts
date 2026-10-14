import { ServerRoom } from './roomTypes';

/**
 * Room persistence.
 *
 * - If UPSTASH_REDIS_REST_URL / UPSTASH_REDIS_REST_TOKEN (or the Vercel KV equivalents
 *   KV_REST_API_URL / KV_REST_API_TOKEN) are set, rooms live in Redis so every serverless
 *   instance sees the same rooms. Updates are compare-and-set on `version`.
 * - Otherwise rooms live in process memory, which only works for a single long-running
 *   server (`next dev`, `next start`, one container).
 */

const TTL_SECONDS = 60 * 60 * 3;

const redisUrl = () => process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL || '';
const redisToken = () => process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN || '';

export function usingRedis(): boolean {
  return Boolean(redisUrl() && redisToken());
}

declare global {
  var __ODDOREVE_ROOMS__: Map<string, ServerRoom> | undefined;
}

function memory(): Map<string, ServerRoom> {
  if (!globalThis.__ODDOREVE_ROOMS__) globalThis.__ODDOREVE_ROOMS__ = new Map();
  return globalThis.__ODDOREVE_ROOMS__;
}

const key = (code: string) => `oddoreve:room:${code.toLowerCase()}`;

// JSON turns Infinity into null; restore it so overs logic keeps working after a round trip.
function revive(room: ServerRoom): ServerRoom {
  if (room.maxOvers == null) room.maxOvers = Infinity;
  if (room.match && room.match.maxOvers == null) room.match.maxOvers = Infinity;
  return room;
}

async function redis<T = unknown>(command: (string | number)[]): Promise<T> {
  const res = await fetch(redisUrl(), {
    method: 'POST',
    headers: { Authorization: `Bearer ${redisToken()}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(command),
    cache: 'no-store',
  });
  const data = await res.json();
  if (data.error) throw new Error(`Redis: ${data.error}`);
  return data.result as T;
}

export async function getRoom(code: string): Promise<ServerRoom | null> {
  if (!usingRedis()) return memory().get(code.toLowerCase()) ?? null;
  const [raw, seen] = await Promise.all([
    redis<string | null>(['GET', key(code)]),
    redis<string[] | null>(['HGETALL', seenKey(code)]),
  ]);
  if (!raw) return null;
  const room = revive(JSON.parse(raw)) as ServerRoom;
  // Heartbeats are stored apart from the room so they never conflict with game updates.
  for (let i = 0; seen && i + 1 < seen.length; i += 2) {
    const p = room.players.find((x) => x.id === seen[i]);
    if (p) p.lastSeen = Math.max(p.lastSeen, Number(seen[i + 1]));
  }
  return room;
}

const seenKey = (code: string) => `oddoreve:seen:${code.toLowerCase()}`;

/** Record that a player is still connected. Does not change room.version. */
export async function touchPlayer(room: ServerRoom, playerId: string): Promise<void> {
  const p = room.players.find((x) => x.id === playerId);
  if (!p) return;
  const now = Date.now();
  p.lastSeen = now;
  if (usingRedis()) {
    await redis(['HSET', seenKey(room.code), playerId, now]);
    await redis(['EXPIRE', seenKey(room.code), TTL_SECONDS]);
  }
}

export async function createRoomRecord(room: ServerRoom): Promise<boolean> {
  if (!usingRedis()) {
    if (memory().has(room.code)) return false;
    memory().set(room.code, room);
    pruneMemory();
    return true;
  }
  const res = await redis<string | null>(['SET', key(room.code), JSON.stringify(room), 'EX', TTL_SECONDS, 'NX']);
  return res === 'OK';
}

// Atomic: only write if the stored version is still the one we read.
const CAS_SCRIPT = `
local cur = redis.call('GET', KEYS[1])
if not cur then return 0 end
local v = cjson.decode(cur).version
if v ~= tonumber(ARGV[1]) then return 0 end
redis.call('SET', KEYS[1], ARGV[2], 'EX', ARGV[3])
return 1`;

/**
 * Read-modify-write a room. `fn` may mutate the room in place and/or throw to abort.
 * Returns null if the room does not exist.
 */
export async function updateRoom(
  code: string,
  fn: (room: ServerRoom) => ServerRoom | void
): Promise<ServerRoom | null> {
  if (!usingRedis()) {
    const room = memory().get(code.toLowerCase());
    if (!room) return null;
    return fn(room) ?? room;
  }

  for (let attempt = 0; attempt < 6; attempt++) {
    const current = await getRoom(code);
    if (!current) return null;
    const baseVersion = current.version;
    const next = fn(current) ?? current;
    if (next.version === baseVersion) return next; // nothing changed (e.g. ping / duplicate)
    const ok = await redis<number>([
      'EVAL',
      CAS_SCRIPT,
      1,
      key(code),
      baseVersion,
      JSON.stringify(next),
      TTL_SECONDS,
    ]);
    if (ok === 1) return next;
  }
  throw new Error('Room is busy, please retry');
}

function pruneMemory() {
  const cutoff = Date.now() - TTL_SECONDS * 1000;
  for (const [code, room] of memory()) {
    if (room.updatedAt < cutoff) memory().delete(code);
  }
}
