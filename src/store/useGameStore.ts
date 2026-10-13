'use client';

import { create } from 'zustand';
import {
  MatchState,
  ThrowValue,
  TossCall,
  TossChoice,
  GameMode,
  GameFormat,
  BallEvent,
} from '@/engine/types';
import {
  createInitialMatch,
  setTossCall,
  resolveTossThrows,
  selectTossChoice,
  startInnings2,
  playBall,
} from '@/engine/match';

export type OpponentType = 'human' | 'computer';

interface GameStore {
  match: MatchState;
  opponentType: OpponentType;
  lastBallEvent: BallEvent | null;
  ballCycle: number;
  pendingThrows: {
    teamA: ThrowValue | null;
    teamB: ThrowValue | null;
  };

  // Actions
  initMatch: (params?: {
    mode?: GameMode;
    format?: GameFormat;
    maxOvers?: number;
    teamAName?: string;
    teamBName?: string;
    teamAPlayers?: string[];
    teamBPlayers?: string[];
    opponentType?: OpponentType;
  }) => void;
  setMode: (mode: GameMode) => void;
  setFormat: (format: GameFormat) => void;
  setOpponentType: (opponentType: OpponentType) => void;
  callToss: (callerTeamId: string, call: TossCall) => void;
  chooseToss: (choice: TossChoice) => void;
  setPlayerThrow: (teamId: 'team_a' | 'team_b', value: ThrowValue) => void;
  submitPendingThrows: () => void;
  startSecondInnings: () => void;
  resetMatch: () => void;
}

// In ODDOREVE, valid moves are 1 to 6
function getRandomThrow(): ThrowValue {
  return (Math.floor(Math.random() * 6) + 1) as ThrowValue;
}

export const useGameStore = create<GameStore>((set, get) => ({
  match: createInitialMatch({
    mode: 'cricket',
    format: '1v1',
    teamAName: 'You',
    teamBName: 'Computer',
  }),
  opponentType: 'computer',
  lastBallEvent: null,
  ballCycle: 0,
  pendingThrows: {
    teamA: null,
    teamB: null,
  },

  initMatch: (params) => {
    const opp = params?.opponentType ?? get().opponentType;
    set({
      opponentType: opp,
      match: createInitialMatch({
        ...params,
        teamAName: params?.teamAName ?? 'You',
        teamBName: params?.teamBName ?? (opp === 'computer' ? 'Computer' : 'Friend'),
      }),
      lastBallEvent: null,
      ballCycle: 0,
      pendingThrows: { teamA: null, teamB: null },
    });
  },

  setMode: (mode) => {
    const { match } = get();
    set({
      match: createInitialMatch({
        mode,
        format: match.format,
        maxOvers: match.maxOvers,
        teamAName: match.teamA.name,
        teamBName: match.teamB.name,
      }),
      lastBallEvent: null,
      ballCycle: 0,
      pendingThrows: { teamA: null, teamB: null },
    });
  },

  setFormat: (format) => {
    const { match } = get();
    set({
      match: createInitialMatch({
        mode: match.mode,
        format,
        teamAName: match.teamA.name,
        teamBName: match.teamB.name,
      }),
      lastBallEvent: null,
      ballCycle: 0,
      pendingThrows: { teamA: null, teamB: null },
    });
  },

  setOpponentType: (opponentType) => {
    set({
      opponentType,
      match: createInitialMatch({
        mode: get().match.mode,
        format: get().match.format,
        teamAName: 'You',
        teamBName: opponentType === 'computer' ? 'Computer' : 'Friend',
      }),
      lastBallEvent: null,
      ballCycle: 0,
      pendingThrows: { teamA: null, teamB: null },
    });
  },

  callToss: (callerTeamId, call) => {
    const { match } = get();
    const nextState = setTossCall(match, callerTeamId, call);
    // DO NOT pre-generate or leak computer's throw! It is thrown simultaneously on throw step.
    set({
      match: nextState,
      pendingThrows: { teamA: null, teamB: null },
      ballCycle: get().ballCycle + 1,
    });
  },

  chooseToss: (choice) => {
    const { match } = get();
    const nextState = selectTossChoice(match, choice);
    set({
      match: nextState,
      pendingThrows: { teamA: null, teamB: null },
      ballCycle: get().ballCycle + 1,
    });
  },

  setPlayerThrow: (teamId, value) => {
    // 0 is fist / idle; valid cricket moves are 1 to 6
    if (value < 1 || value > 6) return;

    const { match, opponentType } = get();

    // 1. TOSS THROW FLOW
    if (match.phase === 'toss_throw') {
      if (opponentType === 'computer' && teamId === 'team_a') {
        const compThrow = getRandomThrow();
        const nextState = resolveTossThrows(match, value, compThrow);

        // If computer won toss, computer auto-picks bat or bowl after short delay
        if (nextState.toss.winnerTeamId === match.teamB.id) {
          const compChoice: TossChoice = Math.random() > 0.5 ? 'bat' : 'bowl';
          const chosenState = selectTossChoice(nextState, compChoice);
          set({
            match: chosenState,
            pendingThrows: { teamA: null, teamB: null },
            ballCycle: get().ballCycle + 1,
          });
        } else {
          set({
            match: nextState,
            pendingThrows: { teamA: null, teamB: null },
            ballCycle: get().ballCycle + 1,
          });
        }
      } else {
        // Human vs Human toss
        let currentPending = { ...get().pendingThrows };
        currentPending[teamId === 'team_a' ? 'teamA' : 'teamB'] = value;
        set({ pendingThrows: currentPending });

        if (currentPending.teamA !== null && currentPending.teamB !== null) {
          const nextState = resolveTossThrows(match, currentPending.teamA, currentPending.teamB);
          set({
            match: nextState,
            pendingThrows: { teamA: null, teamB: null },
            ballCycle: get().ballCycle + 1,
          });
        }
      }
      return;
    }

    // 2. LIVE GAMEPLAY (INNINGS 1 OR 2)
    if (match.phase === 'innings1' || match.phase === 'innings2') {
      let currentPending = { ...get().pendingThrows };
      currentPending[teamId === 'team_a' ? 'teamA' : 'teamB'] = value;

      if (opponentType === 'computer' && teamId === 'team_a') {
        const compThrow = getRandomThrow();
        currentPending.teamB = compThrow;

        const { nextState, event } = playBall(match, value, compThrow);
        set({
          match: nextState,
          lastBallEvent: event,
          pendingThrows: { teamA: null, teamB: null },
          ballCycle: get().ballCycle + 1,
        });
        return;
      }

      set({ pendingThrows: currentPending });
      if (currentPending.teamA !== null && currentPending.teamB !== null) {
        get().submitPendingThrows();
      }
    }
  },

  submitPendingThrows: () => {
    const { match, pendingThrows } = get();
    if (pendingThrows.teamA === null || pendingThrows.teamB === null) return;

    const throwA = pendingThrows.teamA;
    const throwB = pendingThrows.teamB;

    if (match.phase === 'innings1' || match.phase === 'innings2') {
      const { nextState, event } = playBall(match, throwA, throwB);
      set({
        match: nextState,
        lastBallEvent: event,
        pendingThrows: { teamA: null, teamB: null },
        ballCycle: get().ballCycle + 1,
      });
    }
  },

  startSecondInnings: () => {
    const { match } = get();
    const nextState = startInnings2(match);
    set({
      match: nextState,
      lastBallEvent: null,
      pendingThrows: { teamA: null, teamB: null },
      ballCycle: get().ballCycle + 1,
    });
  },

  resetMatch: () => {
    const { match } = get();
    set({
      match: createInitialMatch({
        mode: match.mode,
        format: match.format,
        maxOvers: match.maxOvers,
        teamAName: match.teamA.name,
        teamBName: match.teamB.name,
      }),
      lastBallEvent: null,
      ballCycle: 0,
      pendingThrows: { teamA: null, teamB: null },
    });
  },
}));
