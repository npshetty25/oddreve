export type ThrowValue = 0 | 1 | 2 | 3 | 4 | 5 | 6;

export type GameMode = 'cricket' | 'baseball';

export type GameFormat = '1v1' | '2v2';

export type TossChoice = 'bat' | 'bowl';
export type TossCall = 'odd' | 'even';

export type MatchPhase =
  | 'toss_call'
  | 'toss_throw'
  | 'toss_result'
  | 'innings1'
  | 'innings_break'
  | 'innings2'
  | 'match_over';

export interface PlayerStats {
  id: string;
  name: string;
  runs: number;
  ballsFaced: number;
  isOut: boolean;
  ballsBowled: number;
  runsConceded: number;
  wicketsTaken: number;
}

export interface BallEvent {
  innings: 1 | 2;
  ballNumber: number; // 1-indexed total balls in innings
  overString: string; // e.g. "0.1", "1.4"
  batterId: string;
  bowlerId: string;
  batterThrow: ThrowValue;
  bowlerThrow: ThrowValue;
  runsScored: number;
  isOut: boolean;
  isStrike?: boolean;
  isDouble?: boolean;
  description: string;
  scoreAfterBall: number;
  wicketsAfterBall: number;
}

export interface InningsState {
  battingTeamId: string;
  bowlingTeamId: string;
  score: number;
  wickets: number;
  balls: number; // total balls bowled in this innings
  activeBatterId: string;
  activeBowlerId: string;
  events: BallEvent[];
  isCompleted: boolean;
  endReason?: 'all_out' | 'overs_completed' | 'target_reached' | 'target_defended';
}

export interface MatchState {
  mode: GameMode;
  format: GameFormat;
  maxOvers: number; // e.g. 2 overs, or Infinity for classic unlimited
  teamA: {
    id: string;
    name: string;
    players: PlayerStats[];
  };
  teamB: {
    id: string;
    name: string;
    players: PlayerStats[];
  };
  phase: MatchPhase;
  toss: {
    callerTeamId: string;
    call: TossCall;
    teamAThrow: ThrowValue | null;
    teamBThrow: ThrowValue | null;
    winnerTeamId: string | null;
    choice: TossChoice | null;
  };
  innings1: InningsState;
  innings2: InningsState | null;
  target: number | null;
  result: {
    winnerTeamId: string | 'tie' | null;
    marginText: string;
  } | null;
  ballHistory: BallEvent[];
}

export interface BallResolutionResult {
  runs: number;
  isOut: boolean;
  isStrike?: boolean;
  isDouble?: boolean;
  description: string;
  newStrikesCount?: number;
}
