/**
 * Peer-to-peer online rooms (WebRTC via PeerJS).
 *
 * The HOST's browser is the room server: it owns the ServerRoom state and runs the same
 * pure `applyAction` rules used in tests. Guests only send actions and receive snapshots,
 * so there is no backend, no polling and nothing to lose on a serverless host.
 *
 * Signalling uses the free PeerJS cloud broker. Media/data go directly between browsers,
 * falling back to a TURN relay for strict NATs (see `iceServers`).
 */
import type { DataConnection, MediaConnection, Peer } from 'peerjs';
import { RoomAction, ServerRoom } from './roomTypes';
import { applyAction, createRoom, generatePlayerId, generateRoomCode, RoomError } from './roomLogic';
import { GameFormat, GameMode } from '@/engine/types';

const PEER_PREFIX = 'oddoreve-hc-';
const peerIdFor = (code: string) => `${PEER_PREFIX}${code.toLowerCase()}`;

/** STUN + TURN. Provide your own TURN via NEXT_PUBLIC_TURN_* env vars for production. */
export function iceServers(): RTCIceServer[] {
  const servers: RTCIceServer[] = [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
  ];
  const url = process.env.NEXT_PUBLIC_TURN_URL;
  const username = process.env.NEXT_PUBLIC_TURN_USERNAME;
  const credential = process.env.NEXT_PUBLIC_TURN_CREDENTIAL;
  if (url && username && credential) {
    const urls = url.split(',').map((u) => u.trim()).filter(Boolean);
    servers.push({ urls, username, credential });
  } else {
    // Best-effort public relay so strict NATs still work out of the box. It is shared and
    // rate limited; configure NEXT_PUBLIC_TURN_* for anything you depend on.
    servers.push({
      urls: [
        'turn:openrelay.metered.ca:80',
        'turn:openrelay.metered.ca:443',
        'turn:openrelay.metered.ca:443?transport=tcp',
      ],
      username: 'openrelayproject',
      credential: 'openrelayproject',
    });
  }
  return servers;
}

type HostToGuest =
  | { t: 'room'; room: ServerRoom; serverTime: number }
  | { t: 'ping'; ts: number }
  | { t: 'countdown'; cycle: number; leadMs: number }
  | { t: 'error'; message: string; fatal?: boolean };

type GuestToHost = { t: 'action'; body: RoomAction } | { t: 'pong'; ts: number };

export interface P2PHandlers {
  onRoom(room: ServerRoom, serverTime: number): void;
  onCountdown(cycle: number, leadMs: number): void;
  onRemoteStream(stream: MediaStream | null): void;
  onError(message: string, fatal: boolean): void;
}

export interface P2PSession {
  role: 'host' | 'guest';
  code: string;
  playerId: string;
  /** Send a game action as this player. Never throws. */
  send(action: Omit<RoomAction, 'playerId'>): void;
  /** Host only: tell everyone to start the 3-2-1 for `cycle`. Returns the lead time in ms. */
  startCountdown(cycle: number): number;
  setLocalStream(stream: MediaStream | null): void;
  close(): void;
}

function revive(room: ServerRoom): ServerRoom {
  if (room.maxOvers == null) room.maxOvers = Infinity;
  if (room.match && room.match.maxOvers == null) room.match.maxOvers = Infinity;
  return room;
}

function openPeer(PeerCtor: typeof Peer, id?: string): Promise<Peer> {
  return new Promise((resolve, reject) => {
    const peer = id
      ? new PeerCtor(id, { config: { iceServers: iceServers() } })
      : new PeerCtor({ config: { iceServers: iceServers() } });
    const onErr = (e: Error) => {
      peer.off('open', onOpen);
      peer.destroy();
      reject(e);
    };
    const onOpen = () => {
      peer.off('error', onErr);
      resolve(peer);
    };
    peer.once('open', onOpen);
    peer.once('error', onErr);
  });
}

/* ------------------------------ HOST ------------------------------ */

export async function hostRoom(
  opts: { playerName: string; mode: GameMode; format: GameFormat },
  h: P2PHandlers
): Promise<P2PSession> {
  const { Peer: PeerCtor } = await import('peerjs');

  let peer: Peer | null = null;
  let code = '';
  for (let i = 0; i < 8 && !peer; i++) {
    code = generateRoomCode();
    try {
      peer = await openPeer(PeerCtor, peerIdFor(code));
    } catch (e) {
      const type = (e as { type?: string }).type;
      if (type !== 'unavailable-id') throw new Error(`Could not reach the matchmaking server (${type ?? 'network'})`);
    }
  }
  if (!peer) throw new Error('Could not allocate a room code, please try again');
  const livePeer = peer;

  const playerId = generatePlayerId();
  const room = createRoom({
    code,
    hostId: playerId,
    hostName: opts.playerName,
    mode: opts.mode,
    format: opts.format,
  });

  const conns = new Map<string, DataConnection>(); // playerId -> connection
  const owner = new Map<DataConnection, string>(); // connection -> playerId
  const rtts = new Map<string, number>();
  let localStream: MediaStream | null = null;
  let pendingCall: MediaConnection | null = null;
  let closed = false;

  const sendTo = (c: DataConnection, msg: HostToGuest) => {
    if (c.open) c.send(msg);
  };
  const broadcast = () => {
    const serverTime = Date.now();
    room.players.find((p) => p.id === playerId)!.lastSeen = serverTime;
    conns.forEach((c) => sendTo(c, { t: 'room', room, serverTime }));
    h.onRoom(JSON.parse(JSON.stringify(room)), serverTime);
  };

  const apply = (action: RoomAction): string | null => {
    try {
      applyAction(room, action);
      broadcast();
      return null;
    } catch (e) {
      if (e instanceof RoomError) return e.message;
      throw e;
    }
  };

  const answer = (call: MediaConnection) => {
    call.answer(localStream ?? undefined);
    call.on('stream', (s) => h.onRemoteStream(s));
    call.on('close', () => h.onRemoteStream(null));
  };

  livePeer.on('call', (call) => {
    if (room.format === '2v2') {
      call.close();
      return;
    }
    if (localStream) answer(call);
    else pendingCall = call;
  });

  livePeer.on('connection', (conn) => {
    conn.on('data', (raw) => {
      const msg = raw as GuestToHost;
      if (msg.t === 'pong') {
        const id = owner.get(conn);
        if (id) {
          rtts.set(id, Date.now() - msg.ts);
          const p = room.players.find((x) => x.id === id);
          if (p) p.lastSeen = Date.now();
        }
        return;
      }
      if (msg.t !== 'action' || !msg.body) return;
      const body = msg.body;

      if (body.action === 'join') {
        const err = apply(body);
        if (err) {
          sendTo(conn, { t: 'error', message: err, fatal: true });
          return;
        }
        owner.set(conn, body.playerId);
        conns.set(body.playerId, conn);
        broadcast();
        return;
      }
      if (owner.get(conn) !== body.playerId) return; // spoofed / not joined
      const err = apply(body);
      if (err) sendTo(conn, { t: 'error', message: err });
    });

    conn.on('close', () => {
      const id = owner.get(conn);
      owner.delete(conn);
      if (!id) return;
      if (conns.get(id) === conn) conns.delete(id);
      if (room.stage === 'lobby' && !closed) apply({ action: 'leave', playerId: id });
    });
  });

  livePeer.on('error', (e) => {
    if (!closed) h.onError(`Connection problem (${(e as { type?: string }).type ?? 'unknown'})`, false);
  });
  livePeer.on('disconnected', () => {
    // Lost the matchmaking broker; existing data channels keep working. Try to re-register.
    if (!closed && !livePeer.destroyed) livePeer.reconnect();
  });

  const timer = setInterval(() => {
    conns.forEach((c) => sendTo(c, { t: 'ping', ts: Date.now() }));
    broadcast();
  }, 3000);

  broadcast();

  return {
    role: 'host',
    code,
    playerId,
    send(action) {
      const err = apply({ ...action, playerId } as RoomAction);
      if (err) h.onError(err, false);
    },
    startCountdown(cycle) {
      const worst = Math.max(0, ...Array.from(rtts.values()));
      const leadMs = Math.min(3000, Math.max(900, 1.5 * worst + 300));
      conns.forEach((c) => sendTo(c, { t: 'countdown', cycle, leadMs }));
      return leadMs;
    },
    setLocalStream(stream) {
      localStream = stream;
      if (stream && pendingCall) {
        answer(pendingCall);
        pendingCall = null;
      }
    },
    close() {
      closed = true;
      clearInterval(timer);
      conns.forEach((c) => c.close());
      livePeer.destroy();
    },
  };
}

/* ------------------------------ GUEST ------------------------------ */

export async function joinRoom(
  opts: { code: string; playerName: string; playerId?: string },
  h: P2PHandlers
): Promise<P2PSession> {
  const { Peer: PeerCtor } = await import('peerjs');
  const code = opts.code.trim().toLowerCase();
  const playerId = opts.playerId ?? generatePlayerId();
  const peer = await openPeer(PeerCtor).catch((e) => {
    throw new Error(`Could not reach the matchmaking server (${(e as { type?: string }).type ?? 'network'})`);
  });

  return new Promise<P2PSession>((resolve, reject) => {
    let conn: DataConnection | null = null;
    let settled = false;
    let attempts = 0;
    let closed = false;
    let localStream: MediaStream | null = null;
    let called = false;
    let retryTimer: ReturnType<typeof setTimeout> | null = null;

    const fail = (msg: string) => {
      if (settled) {
        h.onError(msg, true);
      } else {
        settled = true;
        reject(new Error(msg));
      }
      session.close();
    };

    const maybeCall = () => {
      if (called || !localStream || !conn?.open || session.format2v2) return;
      called = true;
      const call = peer.call(peerIdFor(code), localStream);
      call.on('stream', (s) => h.onRemoteStream(s));
      call.on('close', () => h.onRemoteStream(null));
    };

    const connect = () => {
      if (closed) return;
      attempts += 1;
      conn = peer.connect(peerIdFor(code), { reliable: true, serialization: 'json' });
      const c = conn;

      c.on('open', () => {
        c.send({
          t: 'action',
          body: { action: 'join', playerId, playerName: opts.playerName },
        } satisfies GuestToHost);
      });

      c.on('data', (raw) => {
        const msg = raw as HostToGuest;
        switch (msg.t) {
          case 'room': {
            const room = revive(msg.room);
            session.format2v2 = room.format === '2v2';
            h.onRoom(room, msg.serverTime);
            if (!settled && room.players.some((p) => p.id === playerId)) {
              settled = true;
              resolve(session);
            }
            maybeCall();
            break;
          }
          case 'ping':
            c.send({ t: 'pong', ts: msg.ts } satisfies GuestToHost);
            break;
          case 'countdown':
            h.onCountdown(msg.cycle, msg.leadMs);
            break;
          case 'error':
            if (msg.fatal) fail(msg.message);
            else h.onError(msg.message, false);
            break;
        }
      });

      c.on('close', () => {
        if (closed) return;
        fail('The host left the room.');
      });
    };

    peer.on('error', (e) => {
      if (closed) return;
      const type = (e as { type?: string }).type;
      if (type === 'peer-unavailable') {
        if (attempts < 6) {
          retryTimer = setTimeout(connect, 1500);
          return;
        }
        fail("Couldn't find a room with that code. Check it with your friend - the host must keep the game tab open.");
        return;
      }
      if (!settled) fail(`Connection problem (${type ?? 'unknown'})`);
      else h.onError(`Connection problem (${type ?? 'unknown'})`, false);
    });

    const session: P2PSession & { format2v2: boolean } = {
      role: 'guest',
      code,
      playerId,
      format2v2: false,
      send(action) {
        if (conn?.open) conn.send({ t: 'action', body: { ...action, playerId } as RoomAction } satisfies GuestToHost);
      },
      startCountdown() {
        return 0;
      },
      setLocalStream(stream) {
        localStream = stream;
        maybeCall();
      },
      close() {
        if (closed) return;
        closed = true;
        if (retryTimer) clearTimeout(retryTimer);
        try {
          if (conn?.open) conn.send({ t: 'action', body: { action: 'leave', playerId } } satisfies GuestToHost);
        } catch {}
        setTimeout(() => peer.destroy(), 150);
      },
    };

    setTimeout(() => {
      if (!settled) fail('Timed out connecting to the room. Check the code and try again.');
    }, 20000);

    connect();
  });
}
