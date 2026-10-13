import {
  GameFormat,
  GameMode,
  InningsState,
  MatchPhase,
  MatchState,
  PlayerStats,
  ThrowValue,
  TossCall,
  TossChoice,
  BallEvent,
} from './types';
import { resolveToss, formatOvers } from './toss';
import { cricketBallRule, baseballBallRule, BallRuleConfig } from './rules';

export interface CreateMatchParams {
  mode?: GameMode;
  format?: GameFormat;
  maxOvers?: number; // e.g. 2, or Infinity
  teamAName?: string;
  teamBName?: string;
  teamAPlayers?: string[]; // Player names
  teamBPlayers?: string[];
}

export function createInitialMatch(params: CreateMatchParams = {}): MatchState {
  const mode = params.mode ?? 'cricket';
  const format = params.format ?? '1v1';
  // 2v2 plays until both batters are out (Infinity overs by default unless explicitly specified)
  const maxOvers = params.maxOvers ?? Infinity;

  const teamAName = params.teamAName || 'Team A';
  const teamBName = params.teamBName || 'Team B';

  const defaultTeamAPlayers =
    format === '2v2'
      ? (params.teamAPlayers && params.teamAPlayers.length >= 2 ? params.teamAPlayers : ['Player A1', 'Player A2'])
      : [params.teamAPlayers?.[0] || 'Player 1'];

  const defaultTeamBPlayers =
    format === '2v2'
      ? (params.teamBPlayers && params.teamBPlayers.length >= 2 ? params.teamBPlayers : ['Player B1', 'Player B2'])
      : [params.teamBPlayers?.[0] || 'Player 2'];

  const teamA: MatchState['teamA'] = {
    id: 'team_a',
    name: teamAName,
    players: defaultTeamAPlayers.map((name, idx) => ({
      id: `a_${idx + 1}`,
      name,
      runs: 0,
      ballsFaced: 0,
      isOut: false,
      ballsBowled: 0,
      runsConceded: 0,
      wicketsTaken: 0,
    })),
  };

  const teamB: MatchState['teamB'] = {
    id: 'team_b',
    name: teamBName,
    players: defaultTeamBPlayers.map((name, idx) => ({
      id: `b_${idx + 1}`,
      name,
      runs: 0,
      ballsFaced: 0,
      isOut: false,
      ballsBowled: 0,
      runsConceded: 0,
      wicketsTaken: 0,
    })),
  };

  const initialInnings: InningsState = {
    battingTeamId: '',
    bowlingTeamId: '',
    score: 0,
    wickets: 0,
    balls: 0,
    activeBatterId: '',
    activeBowlerId: '',
    events: [],
    isCompleted: false,
  };

  return {
    mode,
    format,
    maxOvers,
    teamA,
    teamB,
    phase: 'toss_call',
    toss: {
      callerTeamId: 'team_a',
      call: 'odd',
      teamAThrow: null,
      teamBThrow: null,
      winnerTeamId: null,
      choice: null,
    },
    innings1: initialInnings,
    innings2: null,
    target: null,
    result: null,
    ballHistory: [],
  };
}

/**
 * Handle Toss Call (odd / even)
 */
export function setTossCall(
  state: MatchState,
  callerTeamId: string,
  call: TossCall
): MatchState {
  if (state.phase !== 'toss_call') return state;

  return {
    ...state,
    phase: 'toss_throw',
    toss: {
      ...state.toss,
      callerTeamId,
      call,
    },
  };
}

/**
 * Handle Toss Throws
 */
export function resolveTossThrows(
  state: MatchState,
  throwA: ThrowValue,
  throwB: ThrowValue
): MatchState {
  if (state.phase !== 'toss_throw') return state;

  const tossResult = resolveToss(
    state.toss.callerTeamId,
    state.toss.call,
    state.teamA.id,
    state.teamB.id,
    throwA,
    throwB
  );

  return {
    ...state,
    phase: 'toss_result',
    toss: {
      ...state.toss,
      teamAThrow: throwA,
      teamBThrow: throwB,
      winnerTeamId: tossResult.winnerTeamId,
      choice: null,
    },
  };
}

/**
 * Toss Winner chooses to Bat or Bowl
 */
export function selectTossChoice(state: MatchState, choice: TossChoice): MatchState {
  if (state.phase !== 'toss_result' || !state.toss.winnerTeamId) return state;

  const winnerTeamId = state.toss.winnerTeamId;
  const otherTeamId = winnerTeamId === state.teamA.id ? state.teamB.id : state.teamA.id;

  const battingTeamId = choice === 'bat' ? winnerTeamId : otherTeamId;
  const bowlingTeamId = choice === 'bat' ? otherTeamId : winnerTeamId;

  const battingTeam = battingTeamId === state.teamA.id ? state.teamA : state.teamB;
  const bowlingTeam = bowlingTeamId === state.teamA.id ? state.teamA : state.teamB;

  const innings1: InningsState = {
    battingTeamId,
    bowlingTeamId,
    score: 0,
    wickets: 0,
    balls: 0,
    activeBatterId: battingTeam.players[0].id,
    activeBowlerId: bowlingTeam.players[0].id,
    events: [],
    isCompleted: false,
  };

  return {
    ...state,
    phase: 'innings1',
    toss: {
      ...state.toss,
      choice,
    },
    innings1,
  };
}

/**
 * Advance / start Innings 2 from innings_break
 */
export function startInnings2(state: MatchState): MatchState {
  if (state.phase !== 'innings_break') return state;

  const battingTeamId = state.innings1.bowlingTeamId;
  const bowlingTeamId = state.innings1.battingTeamId;

  const battingTeam = battingTeamId === state.teamA.id ? state.teamA : state.teamB;
  const bowlingTeam = bowlingTeamId === state.teamA.id ? state.teamA : state.teamB;

  const innings2: InningsState = {
    battingTeamId,
    bowlingTeamId,
    score: 0,
    wickets: 0,
    balls: 0,
    activeBatterId: battingTeam.players[0].id,
    activeBowlerId: bowlingTeam.players[0].id,
    events: [],
    isCompleted: false,
  };

  return {
    ...state,
    phase: 'innings2',
    target: state.innings1.score + 1,
    innings2,
  };
}

/**
 * Pure function: resolveBall
 * (state, throwA, throwB) -> newState + event
 *
 * In 1v1:
 * - Batting player throws `batterThrow`
 * - Bowling player throws `bowlerThrow`
 * We determine which throw belongs to batter and bowler based on active batting team.
 */
export function playBall(
  state: MatchState,
  teamAThrow: ThrowValue,
  teamBThrow: ThrowValue
): { nextState: MatchState; event: BallEvent } {
  if (state.phase !== 'innings1' && state.phase !== 'innings2') {
    throw new Error(`Cannot play ball in phase ${state.phase}`);
  }

  const currentInningsNum = state.phase === 'innings1' ? 1 : 2;
  const innings = currentInningsNum === 1 ? { ...state.innings1 } : { ...state.innings2! };

  const isTeamABatting = innings.battingTeamId === state.teamA.id;
  const batterThrow = isTeamABatting ? teamAThrow : teamBThrow;
  const bowlerThrow = isTeamABatting ? teamBThrow : teamAThrow;

  // Resolve rule config
  const ruleConfig: BallRuleConfig =
    state.mode === 'baseball' ? baseballBallRule : cricketBallRule;

  // For baseball, count current strikes on active batter
  let currentStrikes = 0;
  if (state.mode === 'baseball') {
    // Count consecutive strikes for current active batter since last wicket or reset
    // Strikes count towards batter's wicket.
    for (let i = innings.events.length - 1; i >= 0; i--) {
      const prev = innings.events[i];
      if (prev.batterId !== innings.activeBatterId) break;
      if (prev.isOut) break;
      if (prev.isStrike) {
        currentStrikes++;
      }
    }
  }

  const resolution = ruleConfig.resolveBall(batterThrow, bowlerThrow, {
    currentStrikes,
  });

  const nextBalls = innings.balls + 1;
  const overString = formatOvers(nextBalls);
  const nextScore = innings.score + resolution.runs;
  const nextWickets = innings.wickets + (resolution.isOut ? 1 : 0);

  const event: BallEvent = {
    innings: currentInningsNum,
    ballNumber: nextBalls,
    overString,
    batterId: innings.activeBatterId,
    bowlerId: innings.activeBowlerId,
    batterThrow,
    bowlerThrow,
    runsScored: resolution.runs,
    isOut: resolution.isOut,
    isStrike: resolution.isStrike,
    isDouble: resolution.isDouble,
    description: resolution.description,
    scoreAfterBall: nextScore,
    wicketsAfterBall: nextWickets,
  };

  // Update player stats
  const battingTeamCopy =
    innings.battingTeamId === state.teamA.id ? { ...state.teamA } : { ...state.teamB };
  const bowlingTeamCopy =
    innings.bowlingTeamId === state.teamA.id ? { ...state.teamA } : { ...state.teamB };

  battingTeamCopy.players = battingTeamCopy.players.map((p) => {
    if (p.id === innings.activeBatterId) {
      return {
        ...p,
        runs: p.runs + resolution.runs,
        ballsFaced: p.ballsFaced + 1,
        isOut: p.isOut || resolution.isOut,
      };
    }
    return p;
  });

  bowlingTeamCopy.players = bowlingTeamCopy.players.map((p) => {
    if (p.id === innings.activeBowlerId) {
      return {
        ...p,
        ballsBowled: p.ballsBowled + 1,
        runsConceded: p.runsConceded + resolution.runs,
        wicketsTaken: p.wicketsTaken + (resolution.isOut ? 1 : 0),
      };
    }
    return p;
  });

  const totalBatters = battingTeamCopy.players.length;
  const isAllOut = nextWickets >= totalBatters;
  const maxBalls = state.maxOvers !== Infinity ? state.maxOvers * 6 : Infinity;
  const isOversFinished = nextBalls >= maxBalls;

  // Next batter in 2v2 if out
  let nextBatterId = innings.activeBatterId;
  if (resolution.isOut && !isAllOut) {
    const remainingBatter = battingTeamCopy.players.find((p) => !p.isOut);
    if (remainingBatter) {
      nextBatterId = remainingBatter.id;
    }
  }

  // Next bowler in 2v2 when over completes (every 6 balls)
  let nextBowlerId = innings.activeBowlerId;
  if (state.format === '2v2' && nextBalls % 6 === 0 && bowlingTeamCopy.players.length > 1) {
    const otherBowler = bowlingTeamCopy.players.find((p) => p.id !== innings.activeBowlerId);
    if (otherBowler) {
      nextBowlerId = otherBowler.id;
    }
  }

  innings.score = nextScore;
  innings.wickets = nextWickets;
  innings.balls = nextBalls;
  innings.activeBatterId = nextBatterId;
  innings.activeBowlerId = nextBowlerId;
  innings.events = [...innings.events, event];

  const updatedTeamA = innings.battingTeamId === state.teamA.id ? battingTeamCopy : bowlingTeamCopy;
  const updatedTeamB = innings.battingTeamId === state.teamB.id ? battingTeamCopy : bowlingTeamCopy;

  let nextPhase: MatchPhase = state.phase;
  let matchResult = state.result;

  if (currentInningsNum === 1) {
    if (isAllOut || isOversFinished) {
      innings.isCompleted = true;
      innings.endReason = isAllOut ? 'all_out' : 'overs_completed';
      nextPhase = 'innings_break';
    }

    return {
      nextState: {
        ...state,
        phase: nextPhase,
        teamA: updatedTeamA,
        teamB: updatedTeamB,
        innings1: innings,
        target: innings.isCompleted ? innings.score + 1 : state.target,
        ballHistory: [...state.ballHistory, event],
      },
      event,
    };
  } else {
    // Innings 2: Chase!
    const target = state.target!;
    const chasePassed = nextScore >= target;

    if (chasePassed) {
      innings.isCompleted = true;
      innings.endReason = 'target_reached';
      nextPhase = 'match_over';
      const winnerTeam = innings.battingTeamId === state.teamA.id ? state.teamA : state.teamB;
      const wicketsInHand = totalBatters - nextWickets;
      matchResult = {
        winnerTeamId: innings.battingTeamId,
        marginText: `${winnerTeam.name} won by ${wicketsInHand} wicket${wicketsInHand === 1 ? '' : 's'}!`,
      };
    } else if (isAllOut || isOversFinished) {
      innings.isCompleted = true;
      nextPhase = 'match_over';

      if (nextScore === target - 1) {
        // Equal scores = Tie!
        matchResult = {
          winnerTeamId: 'tie',
          marginText: 'Match Tied!',
        };
      } else {
        // Bowling team won (defended target)
        innings.endReason = 'target_defended';
        const defendingTeam =
          innings.bowlingTeamId === state.teamA.id ? state.teamA : state.teamB;
        const runsMargin = (target - 1) - nextScore;
        matchResult = {
          winnerTeamId: innings.bowlingTeamId,
          marginText: `${defendingTeam.name} won by ${runsMargin} run${runsMargin === 1 ? '' : 's'}!`,
        };
      }
    }

    return {
      nextState: {
        ...state,
        phase: nextPhase,
        teamA: updatedTeamA,
        teamB: updatedTeamB,
        innings2: innings,
        result: matchResult,
        ballHistory: [...state.ballHistory, event],
      },
      event,
    };
  }
}
