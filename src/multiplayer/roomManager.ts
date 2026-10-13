import { GameMode, GameFormat, ThrowValue, MatchState } from '../engine/types';
import { createInitialMatch, playBall, resolveTossThrows } from '../engine/match';
import { verifyCommitment } from './commitment';

export interface RoomPlayer {
  id: string;
  name: string;
  teamId: 'team_a' | 'team_b';
  isHost: boolean;
  connected: boolean;
  lastSeen: number;
}

export interface PlayerCommitment {
  playerId: string;
  commitmentHash: string;
  timestamp: number;
}

export interface PlayerReveal {
  playerId: string;
  throwValue: ThrowValue;
  nonce: string;
}

export interface RoomState {
  roomCode: string;
  mode: GameMode;
  format: GameFormat;
  maxOvers: number;
  players: Record<string, RoomPlayer>;
  match: MatchState | null;
  stage: 'lobby' | 'playing' | 'paused';
  // Simultaneous throw round
  currentRound: {
    roundId: number;
    commitments: Record<string, PlayerCommitment>;
    reveals: Record<string, PlayerReveal>;
  };
  reconnectionTimeout: {
    pausedAt: number | null;
    disconnectedPlayerId: string | null;
  } | null;
}

export class RoomManager {
  private room: RoomState;

  constructor(roomCode: string, hostPlayerId: string, hostPlayerName: string) {
    this.room = {
      roomCode,
      mode: 'cricket',
      format: '1v1',
      maxOvers: 2,
      players: {
        [hostPlayerId]: {
          id: hostPlayerId,
          name: hostPlayerName,
          teamId: 'team_a',
          isHost: true,
          connected: true,
          lastSeen: Date.now(),
        },
      },
      match: null,
      stage: 'lobby',
      currentRound: {
        roundId: 1,
        commitments: {},
        reveals: {},
      },
      reconnectionTimeout: null,
    };
  }

  public getRoomState(): RoomState {
    return this.room;
  }

  public joinRoom(playerId: string, playerName: string): boolean {
    const existingPlayers = Object.values(this.room.players);
    if (existingPlayers.length >= (this.room.format === '2v2' ? 4 : 2)) {
      // Check if reconnecting
      if (this.room.players[playerId]) {
        this.room.players[playerId].connected = true;
        this.room.players[playerId].lastSeen = Date.now();
        if (this.room.reconnectionTimeout?.disconnectedPlayerId === playerId) {
          this.room.stage = 'playing';
          this.room.reconnectionTimeout = null;
        }
        return true;
      }
      return false;
    }

    const teamId: 'team_a' | 'team_b' =
      existingPlayers.filter((p) => p.teamId === 'team_a').length <=
      existingPlayers.filter((p) => p.teamId === 'team_b').length
        ? 'team_a'
        : 'team_b';

    this.room.players[playerId] = {
      id: playerId,
      name: playerName,
      teamId,
      isHost: false,
      connected: true,
      lastSeen: Date.now(),
    };
    return true;
  }

  public setConfig(mode: GameMode, format: GameFormat, maxOvers: number): void {
    if (this.room.stage !== 'lobby') return;
    this.room.mode = mode;
    this.room.format = format;
    this.room.maxOvers = maxOvers;
  }

  public startMatch(): MatchState {
    const teamAPlayers = Object.values(this.room.players).filter((p) => p.teamId === 'team_a');
    const teamBPlayers = Object.values(this.room.players).filter((p) => p.teamId === 'team_b');

    const match = createInitialMatch({
      mode: this.room.mode,
      format: this.room.format,
      maxOvers: this.room.maxOvers,
      teamAName: teamAPlayers[0]?.name ? `${teamAPlayers[0].name}'s Team` : 'Team A',
      teamBName: teamBPlayers[0]?.name ? `${teamBPlayers[0].name}'s Team` : 'Team B',
      teamAPlayers: teamAPlayers.map((p) => p.name),
      teamBPlayers: teamBPlayers.map((p) => p.name),
    });

    this.room.match = match;
    this.room.stage = 'playing';
    return match;
  }

  public submitCommitment(playerId: string, commitmentHash: string): boolean {
    if (!this.room.players[playerId]) return false;
    this.room.currentRound.commitments[playerId] = {
      playerId,
      commitmentHash,
      timestamp: Date.now(),
    };
    return true;
  }

  public areBothCommitmentsReceived(playerAId: string, playerBId: string): boolean {
    return (
      Boolean(this.room.currentRound.commitments[playerAId]) &&
      Boolean(this.room.currentRound.commitments[playerBId])
    );
  }

  public async submitReveal(
    playerId: string,
    throwValue: ThrowValue,
    nonce: string
  ): Promise<{ success: boolean; error?: string }> {
    const commitment = this.room.currentRound.commitments[playerId];
    if (!commitment) {
      return { success: false, error: 'No commitment found for player' };
    }

    const isValid = await verifyCommitment(commitment.commitmentHash, throwValue, nonce);
    if (!isValid) {
      return {
        success: false,
        error: `Tampered reveal! Hash did not match commitment for player ${playerId}`,
      };
    }

    this.room.currentRound.reveals[playerId] = {
      playerId,
      throwValue,
      nonce,
    };
    return { success: true };
  }

  public async resolveRoundIfReady(
    playerAId: string,
    playerBId: string
  ): Promise<{ resolved: boolean; nextMatchState?: MatchState; error?: string }> {
    if (
      !this.room.currentRound.reveals[playerAId] ||
      !this.room.currentRound.reveals[playerBId] ||
      !this.room.match
    ) {
      return { resolved: false };
    }

    const throwA = this.room.currentRound.reveals[playerAId].throwValue;
    const throwB = this.room.currentRound.reveals[playerBId].throwValue;

    if (this.room.match.phase === 'toss_throw') {
      const nextMatch = resolveTossThrows(this.room.match, throwA, throwB);
      this.room.match = nextMatch;
      this.resetRound();
      return { resolved: true, nextMatchState: nextMatch };
    }

    if (this.room.match.phase === 'innings1' || this.room.match.phase === 'innings2') {
      const { nextState } = playBall(this.room.match, throwA, throwB);
      this.room.match = nextState;
      this.resetRound();
      return { resolved: true, nextMatchState: nextState };
    }

    return { resolved: false };
  }

  private resetRound() {
    this.room.currentRound = {
      roundId: this.room.currentRound.roundId + 1,
      commitments: {},
      reveals: {},
    };
  }

  public handleDisconnect(playerId: string, now: number = Date.now()): void {
    if (this.room.players[playerId]) {
      this.room.players[playerId].connected = false;
      this.room.stage = 'paused';
      this.room.reconnectionTimeout = {
        pausedAt: now,
        disconnectedPlayerId: playerId,
      };
    }
  }

  public checkReconnectionExpiry(now: number = Date.now()): { expired: boolean; forfeitedTeamId?: string } {
    if (!this.room.reconnectionTimeout || !this.room.reconnectionTimeout.pausedAt) {
      return { expired: false };
    }
    const elapsed = now - this.room.reconnectionTimeout.pausedAt;
    // 30 seconds reconnection grace window
    if (elapsed >= 30000) {
      const player = this.room.players[this.room.reconnectionTimeout.disconnectedPlayerId!];
      return {
        expired: true,
        forfeitedTeamId: player ? player.teamId : 'team_a',
      };
    }
    return { expired: false };
  }
}
