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
  // Temporary staging for pending local player throws in UI
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

function getRandomThrow(): ThrowValue {
  return Math.floor(Math.random() * 7) as ThrowValue;
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
      pendingThrows: { teamA: null, teamB: null },
    });
  },

  setMode: (mode) => {
    const { match, opponentType } = get();
    set({
      match: createInitialMatch({
        mode,
        format: match.format,
        maxOvers: match.maxOvers,
        teamAName: match.teamA.name,
        teamBName: match.teamB.name,
      }),
      lastBallEvent: null,
      pendingThrows: { teamA: null, teamB: null },
    });
  },

  setFormat: (format) => {
    const { match, opponentType } = get();
    set({
      match: createInitialMatch({
        mode: match.mode,
        format,
        teamAName: match.teamA.name,
        teamBName: match.teamB.name,
      }),
      lastBallEvent: null,
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
      pendingThrows: { teamA: null, teamB: null },
    });
  },

  callToss: (callerTeamId, call) => {
    const { match, opponentType } = get();
    const nextState = setTossCall(match, callerTeamId, call);
    set({ match: nextState });

    // If opponent is computer, automatically prepare computer's toss throw
    if (opponentType === 'computer') {
      const compThrow = getRandomThrow();
      set((state) => ({
        pendingThrows: {
          ...state.pendingThrows,
          teamB: compThrow,
        },
      }));
    }
  },

  chooseToss: (choice) => {
    const { match } = get();
    set({ match: selectTossChoice(match, choice) });

    // If computer won toss and must choose (handled if needed)
    if (get().opponentType === 'computer' && get().match.phase === 'innings1') {
      const compThrow = getRandomThrow();
      set((state) => ({
        pendingThrows: {
          ...state.pendingThrows,
          teamB: compThrow,
        },
      }));
    }
  },

  setPlayerThrow: (teamId, value) => {
    const { opponentType } = get();
    let currentPending = { ...get().pendingThrows };

    currentPending[teamId === 'team_a' ? 'teamA' : 'teamB'] = value;

    // If playing computer and human just made throw for Team A, computer throws randomly for Team B
    if (opponentType === 'computer' && teamId === 'team_a' && currentPending.teamB === null) {
      currentPending.teamB = getRandomThrow();
    }

    set({ pendingThrows: currentPending });

    // Auto submit if both throws are set!
    if (currentPending.teamA !== null && currentPending.teamB !== null) {
      get().submitPendingThrows();
    }
  },

  submitPendingThrows: () => {
    const { match, pendingThrows, opponentType } = get();
    if (pendingThrows.teamA === null || pendingThrows.teamB === null) return;

    const throwA = pendingThrows.teamA;
    const throwB = pendingThrows.teamB;

    if (match.phase === 'toss_throw') {
      const nextState = resolveTossThrows(match, throwA, throwB);
      // If computer won toss, computer auto-picks bat or bowl
      if (opponentType === 'computer' && nextState.toss.winnerTeamId === 'team_b') {
        const compChoice: TossChoice = Math.random() > 0.5 ? 'bat' : 'bowl';
        const afterChoice = selectTossChoice(nextState, compChoice);
        set({
          match: afterChoice,
          pendingThrows: {
            teamA: null,
            teamB: getRandomThrow(),
          },
        });
      } else {
        set({
          match: nextState,
          pendingThrows: { teamA: null, teamB: null },
        });
      }
    } else if (match.phase === 'innings1' || match.phase === 'innings2') {
      const { nextState, event } = playBall(match, throwA, throwB);
      set({
        match: nextState,
        lastBallEvent: event,
        pendingThrows: {
          teamA: null,
          teamB: opponentType === 'computer' && !nextState.innings1.isCompleted ? getRandomThrow() : null,
        },
      });
    }
  },

  startSecondInnings: () => {
    const { match, opponentType } = get();
    const nextState = startInnings2(match);
    set({
      match: nextState,
      lastBallEvent: null,
      pendingThrows: {
        teamA: null,
        teamB: opponentType === 'computer' ? getRandomThrow() : null,
      },
    });
  },

  resetMatch: () => {
    const { match, opponentType } = get();
    set({
      match: createInitialMatch({
        mode: match.mode,
        format: match.format,
        maxOvers: match.maxOvers,
        teamAName: match.teamA.name,
        teamBName: match.teamB.name,
      }),
      lastBallEvent: null,
      pendingThrows: { teamA: null, teamB: null },
    });
  },
}));
