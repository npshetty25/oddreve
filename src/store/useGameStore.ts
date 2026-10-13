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
  // Player lives for warning system (2 lives each, 0 is not a move)
  lives: {
    teamA: number;
    teamB: number;
  };
  warningMessage: string | null;

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
  triggerNoMoveWarning: (teamId: 'team_a' | 'team_b') => void;
  clearWarning: () => void;
  submitPendingThrows: () => void;
  startSecondInnings: () => void;
  resetMatch: () => void;
}

// In ODDOREVE, valid moves are 1 to 6 (0 is not counted as a move)
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
  pendingThrows: {
    teamA: null,
    teamB: null,
  },
  lives: {
    teamA: 2,
    teamB: 2,
  },
  warningMessage: null,

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
      lives: { teamA: 2, teamB: 2 },
      warningMessage: null,
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
      pendingThrows: { teamA: null, teamB: null },
      lives: { teamA: 2, teamB: 2 },
      warningMessage: null,
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
      pendingThrows: { teamA: null, teamB: null },
      lives: { teamA: 2, teamB: 2 },
      warningMessage: null,
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
      lives: { teamA: 2, teamB: 2 },
      warningMessage: null,
    });
  },

  callToss: (callerTeamId, call) => {
    const { match, opponentType } = get();
    const nextState = setTossCall(match, callerTeamId, call);
    set({ match: nextState, warningMessage: null });

    // If opponent is computer, automatically prepare computer's toss throw (1-6)
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
    set({ match: selectTossChoice(match, choice), warningMessage: null });

    // If computer won toss and must choose
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

  clearWarning: () => {
    set({ warningMessage: null });
  },

  triggerNoMoveWarning: (teamId) => {
    const { match, lives } = get();
    const teamKey = teamId === 'team_a' ? 'teamA' : 'teamB';
    const teamName = teamId === 'team_a' ? match.teamA.name : match.teamB.name;
    const currentLives = lives[teamKey];
    const newLives = Math.max(0, currentLives - 1);

    const nextLives = { ...lives, [teamKey]: newLives };

    if (newLives > 0) {
      set({
        lives: nextLives,
        warningMessage: `⚠️ WARNING for ${teamName}: 0 is not a move! Show 1 to 6. (${newLives} life left)`,
      });
    } else {
      // Out of lives! Apply penalty
      const currentInnings = match.phase === 'innings2' ? match.innings2 : match.innings1;
      const isBatting = currentInnings?.battingTeamId === (teamId === 'team_a' ? match.teamA.id : match.teamB.id);

      if (isBatting && (match.phase === 'innings1' || match.phase === 'innings2')) {
        // Batter dismissed for time wasting / no move violations
        // Resolve with equal throws to trigger OUT
        const { nextState, event } = playBall(match, 1, 1);
        set({
          match: nextState,
          lastBallEvent: {
            ...event,
            description: `OUT! ${teamName} ran out of lives (2 warnings for no move)!`,
          },
          lives: { ...nextLives, [teamKey]: 2 }, // Reset lives for next batter
          warningMessage: `🚨 OUT! ${teamName} forfeited wicket after running out of lives!`,
          pendingThrows: { teamA: null, teamB: null },
        });
      } else {
        set({
          lives: { ...nextLives, [teamKey]: 2 },
          warningMessage: `🚨 PENALTY! ${teamName} ran out of lives!`,
        });
      }
    }
  },

  setPlayerThrow: (teamId, value) => {
    // 0 is not counted as a move. If a player submits 0, trigger warning with 2 lives!
    if (value === 0) {
      get().triggerNoMoveWarning(teamId);
      return;
    }

    const { opponentType } = get();
    let currentPending = { ...get().pendingThrows };

    currentPending[teamId === 'team_a' ? 'teamA' : 'teamB'] = value;

    // If playing computer and human just made throw for Team A, computer throws randomly (1-6)
    if (opponentType === 'computer' && teamId === 'team_a' && currentPending.teamB === null) {
      currentPending.teamB = getRandomThrow();
    }

    set({ pendingThrows: currentPending, warningMessage: null });

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
      lives: { teamA: 2, teamB: 2 },
      warningMessage: null,
      pendingThrows: {
        teamA: null,
        teamB: opponentType === 'computer' ? getRandomThrow() : null,
      },
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
      pendingThrows: { teamA: null, teamB: null },
      lives: { teamA: 2, teamB: 2 },
      warningMessage: null,
    });
  },
}));
