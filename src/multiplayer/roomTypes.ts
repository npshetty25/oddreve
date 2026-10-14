import { GameMode, GameFormat, MatchState, ThrowValue, BallEvent } from '@/engine/types';

export type TeamId = 'team_a' | 'team_b';

export interface ServerRoomPlayer {
  id: string;
  name: string;
  teamId: TeamId;
  /** Position inside the team (0 = captain / first batter) */
  slot: number;
  isHost: boolean;
  lastSeen: number;
}

export interface ServerRoom {
  code: string;
  /** Incremented on every mutation so clients can skip no-op updates */
  version: number;
  mode: GameMode;
  format: GameFormat;
  maxOvers: number;
  stage: 'lobby' | 'playing' | 'match_over';
  hostId: string;
  players: ServerRoomPlayer[];
  match: MatchState | null;
  pendingThrows: { teamA: ThrowValue | null; teamB: ThrowValue | null };
  lastEvent: BallEvent | null;
  ballCycle: number;
  /** Set when a ball was voided because someone showed no clear hand */
  reball: { count: number; by: string } | null;
  createdAt: number;
  updatedAt: number;
}

export type RoomAction =
  | { action: 'join'; playerId: string; playerName: string }
  | { action: 'start'; playerId: string }
  | { action: 'toss_call'; playerId: string; call: 'odd' | 'even' }
  | { action: 'toss_throw'; playerId: string; value: number; cycle?: number }
  | { action: 'toss_choice'; playerId: string; choice: 'bat' | 'bowl' }
  | { action: 'throw'; playerId: string; value: number; cycle?: number }
  | { action: 'reball'; playerId: string; cycle: number }
  | { action: 'start_innings_2'; playerId: string }
  | { action: 'reset'; playerId: string }
  | { action: 'leave'; playerId: string }
  | { action: 'ping'; playerId: string };

export function roomCapacity(format: GameFormat): number {
  return format === '2v2' ? 4 : 2;
}
