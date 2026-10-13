'use client';

import React, { useEffect } from 'react';
import confetti from 'canvas-confetti';
import { MatchState, BallEvent, TossCall, TossChoice } from '@/engine/types';

interface CommentaryCardProps {
  match: MatchState;
  lastEvent: BallEvent | null;
  onCallToss?: (callerTeamId: string, call: TossCall) => void;
  onChooseToss?: (choice: TossChoice) => void;
  onPlayAgain?: () => void;
  onBackToLanding?: () => void;
}

export function CommentaryCard({
  match,
  lastEvent,
  onCallToss,
  onChooseToss,
  onPlayAgain,
  onBackToLanding,
}: CommentaryCardProps) {
  if (!match) return null;

  const currentInnings = match.phase === 'innings2' ? match.innings2 : match.innings1;
  const isTeamABatting = currentInnings?.battingTeamId === match.teamA.id;
  const isUserWinner = match.phase === 'match_over' && match.result?.winnerTeamId === match.teamA.id;

  // Real canvas-confetti celebration when you win!
  useEffect(() => {
    if (isUserWinner) {
      confetti({
        particleCount: 120,
        spread: 80,
        origin: { y: 0.6 },
        colors: ['#a3f23d', '#ffd60a', '#ff6fb5', '#3b82f6', '#ffffff'],
      });
      const timer = setTimeout(() => {
        confetti({
          particleCount: 70,
          angle: 60,
          spread: 60,
          origin: { x: 0.05, y: 0.7 },
        });
        confetti({
          particleCount: 70,
          angle: 120,
          spread: 60,
          origin: { x: 0.95, y: 0.7 },
        });
      }, 350);
      return () => clearTimeout(timer);
    }
  }, [isUserWinner]);

  // 1. TOSS CALL PHASE
  if (match.phase === 'toss_call') {
    return (
      <div className="w-full max-w-2xl sm:max-w-3xl md:max-w-[740px] mx-auto bg-[#ffd60a] border-3 sm:border-4 border-black shadow-[4px_4px_0_0_#000] p-3 text-black text-left flex-shrink-0 animate-slide-up">
        <h3 className="font-display text-xl sm:text-2xl uppercase tracking-tight leading-none mb-1">
          CALL ODD OR EVEN
        </h3>
        <p className="font-body text-xs text-black mb-2.5">
          You are calling the toss. Choose odd or even:
        </p>
        <div className="flex gap-2.5 max-w-xs">
          <button
            onClick={() => onCallToss?.('team_a', 'odd')}
            className="flex-1 py-2 bg-white hover:bg-neutral-100 border-2 sm:border-3 border-black font-display text-sm font-black text-black uppercase shadow-[2px_2px_0_0_#000] cursor-pointer"
          >
            ODD
          </button>
          <button
            onClick={() => onCallToss?.('team_a', 'even')}
            className="flex-1 py-2 bg-[#ff6fb5] hover:bg-[#ff5ca8] border-2 sm:border-3 border-black font-display text-sm font-black text-black uppercase shadow-[2px_2px_0_0_#000] cursor-pointer"
          >
            EVEN
          </button>
        </div>
      </div>
    );
  }

  // 2. TOSS THROW PHASE (Matches Reference Image 1)
  if (match.phase === 'toss_throw') {
    return (
      <div className="w-full max-w-2xl sm:max-w-3xl md:max-w-[740px] mx-auto bg-[#ffd60a] border-3 sm:border-4 border-black shadow-[4px_4px_0_0_#000] p-3 text-black text-left flex-shrink-0 animate-slide-up">
        <h3 className="font-display text-2xl sm:text-3xl font-black uppercase tracking-tight leading-none mb-1 text-black">
          TOSS THROW
        </h3>
        <p className="font-body text-xs sm:text-sm text-black">
          Hand up in frame. The throw happens on one.
        </p>
      </div>
    );
  }

  // 3. TOSS RESULT PHASE (Shows Bat or Bowl buttons inline without opening a dialog!)
  if (match.phase === 'toss_result') {
    const isUserWinner = match.toss.winnerTeamId === match.teamA.id;
    const throwA = match.toss.teamAThrow ?? 0;
    const throwB = match.toss.teamBThrow ?? 0;
    const sum = throwA + throwB;
    const isEven = sum % 2 === 0;

    return (
      <div className="w-full max-w-2xl sm:max-w-3xl md:max-w-[740px] mx-auto bg-[#ffd60a] border-3 sm:border-4 border-black shadow-[4px_4px_0_0_#000] p-3 text-black text-left flex-shrink-0 animate-slide-up">
        <div className="flex items-center justify-between mb-1">
          <h3 className="font-display text-xl sm:text-2xl font-black uppercase tracking-tight leading-none text-black">
            {isUserWinner ? 'YOU WON THE TOSS!' : 'COMPUTER WON THE TOSS!'}
          </h3>
          <span className="font-num text-[11px] font-black bg-white px-2 py-0.5 border-2 border-black">
            {throwA} + {throwB} = {sum} ({isEven ? 'EVEN' : 'ODD'})
          </span>
        </div>

        {isUserWinner ? (
          <div>
            <p className="font-body text-xs text-black mb-2">
              Choose your role to start the match:
            </p>
            <div className="flex gap-2.5 max-w-xs">
              <button
                onClick={() => onChooseToss?.('bat')}
                className="flex-1 py-2 bg-white hover:bg-neutral-100 border-2 sm:border-3 border-black font-display text-xs sm:text-sm font-black text-black uppercase shadow-[2px_2px_0_0_#000] cursor-pointer"
              >
                BAT FIRST
              </button>
              <button
                onClick={() => onChooseToss?.('bowl')}
                className="flex-1 py-2 bg-[#ff6fb5] hover:bg-[#ff5ca8] border-2 sm:border-3 border-black font-display text-xs sm:text-sm font-black text-black uppercase shadow-[2px_2px_0_0_#000] cursor-pointer"
              >
                BOWL FIRST
              </button>
            </div>
          </div>
        ) : (
          <p className="font-body text-xs text-black font-bold">
            Computer is deciding to bat or bowl...
          </p>
        )}
      </div>
    );
  }

  // 4. MATCH OVER PHASE (Matches Reference Image 3 & 5)
  if (match.phase === 'match_over') {
    const isUserWinner = match.result?.winnerTeamId === match.teamA.id;
    const isTie = match.result?.winnerTeamId === null;

    let scoreTeamA = 0;
    let scoreTeamB = 0;
    if (match.innings1?.battingTeamId === match.teamA.id) {
      scoreTeamA = match.innings1.score;
      scoreTeamB = match.innings2?.score ?? 0;
    } else {
      scoreTeamB = match.innings1.score;
      scoreTeamA = match.innings2?.score ?? 0;
    }

    const summaryText = isTie
      ? `Match tied at ${scoreTeamA} runs!`
      : isUserWinner
      ? `You beat Computer ${scoreTeamA} to ${scoreTeamB}.`
      : `Computer beat You ${scoreTeamB} to ${scoreTeamA}.`;

    return (
      <div
        className={`w-full max-w-2xl sm:max-w-3xl md:max-w-[740px] mx-auto border-4 border-black shadow-[6px_6px_0_0_#000] p-4 sm:p-5 text-center flex-shrink-0 relative overflow-hidden animate-slide-up ${
          isUserWinner
            ? 'bg-[#a3f23d] text-black'
            : isTie
            ? 'bg-[#ffd60a] text-black'
            : 'bg-[#ff3b30] text-white animate-shake'
        }`}
      >
        {/* Confetti decoration for Winner */}
        {isUserWinner && (
          <>
            <div className="absolute top-1 left-2 w-3 h-2 bg-[#ffd60a] border border-black rotate-12 animate-ping" />
            <div className="absolute top-2 left-8 w-2 h-3 bg-[#ff6fb5] border border-black -rotate-45" />
            <div className="absolute top-1 right-3 w-3 h-2 bg-[#3b82f6] border border-black rotate-45" />
            <div className="absolute top-3 right-8 w-2 h-3 bg-[#ffd60a] border border-black -rotate-12 animate-bounce" />
            <div className="absolute bottom-2 left-4 w-2 h-3 bg-[#3b82f6] border border-black rotate-45" />
            <div className="absolute bottom-1 right-5 w-3 h-2 bg-[#ff6fb5] border border-black -rotate-12" />
          </>
        )}

        {/* Tag Pill */}
        <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-white text-black border-2 border-black font-num text-[11px] font-black uppercase shadow-[2px_2px_0_0_#000] mb-2">
          <span>{isUserWinner ? '🏆' : isTie ? '🤝' : '💀'}</span>
          <span>{isUserWinner ? 'MATCH OVER' : isTie ? 'TIED MATCH' : 'DEFEAT'}</span>
        </div>

        {/* Big Headline */}
        <h2 className="font-display text-4xl sm:text-5xl font-black uppercase tracking-tight leading-none mb-1 drop-shadow-[2px_2px_0_#000]">
          {isUserWinner ? 'YOU WON!' : isTie ? 'MATCH TIED!' : 'YOU LOST!'}
        </h2>

        {/* Subtitle */}
        <p className="font-num text-sm sm:text-base font-bold mb-1 opacity-95">
          {summaryText}
        </p>

        {/* Extra commentary line */}
        {!isUserWinner && !isTie && (
          <p className="font-body text-xs font-bold text-white/90 mb-3">
            💔 Clean bowled! Hit Play Again for revenge.
          </p>
        )}
        {isUserWinner && (
          <p className="font-body text-xs font-bold text-black/90 mb-3">
            🎉 Brilliant performance! Champion of the pitch!
          </p>
        )}

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-3 max-w-xs sm:max-w-sm mx-auto mt-2">
          <button
            onClick={onPlayAgain}
            className="w-full py-2.5 bg-black hover:bg-neutral-800 text-white border-3 border-black font-display text-xs sm:text-sm font-black uppercase shadow-[3px_3px_0_0_#000] cursor-pointer"
          >
            PLAY AGAIN
          </button>
          <button
            onClick={onBackToLanding}
            className="w-full py-2.5 bg-white hover:bg-neutral-100 text-black border-3 border-black font-display text-xs sm:text-sm font-black uppercase shadow-[3px_3px_0_0_#000] cursor-pointer"
          >
            ← BACK
          </button>
        </div>
      </div>
    );
  }

  // 5. READY / WAITING FOR FIRST BALL
  if (!lastEvent) {
    return (
      <div className="w-full max-w-2xl sm:max-w-3xl md:max-w-[740px] mx-auto bg-[#ffd60a] border-3 sm:border-4 border-black shadow-[4px_4px_0_0_#000] p-4 text-black text-left flex-shrink-0 animate-slide-up">
        <h3 className="font-display text-2xl sm:text-3xl font-black uppercase tracking-tight leading-none mb-1 text-black">
          {isTeamABatting ? 'READY TO BAT' : 'READY TO BOWL'}
        </h3>
        <p className="font-body text-xs sm:text-sm text-black">
          Show 1 to 6 fingers at camera to lock your throw.
        </p>
      </div>
    );
  }

  // 6. LIVE EVENT RUNS COMMENTARY (Matches Reference Image 4)
  const { isOut, runsScored, batterThrow, bowlerThrow } = lastEvent;

  return (
    <div className="w-full max-w-2xl sm:max-w-3xl md:max-w-[740px] mx-auto bg-[#ffd60a] border-3 sm:border-4 border-black shadow-[4px_4px_0_0_#000] p-4 text-black text-left flex-shrink-0 animate-slide-up">
      <h3 className="font-display text-2xl sm:text-3xl font-black uppercase tracking-tight leading-none mb-1 text-black">
        {isOut ? 'OUT!' : 'RUNS'}
      </h3>

      <p className="font-body text-xs sm:text-sm text-black mb-2.5">
        Batter {batterThrow}, bowler {bowlerThrow}.
      </p>

      {/* Prominent White Box with +X ON THE BOARD (Matches Reference Image 4) */}
      <div className="inline-block bg-white text-black border-2 sm:border-3 border-black px-3.5 py-1.5 font-num text-xs sm:text-sm font-black shadow-[2px_2px_0_0_#000]">
        {isOut ? (
          <span className="text-[#ff3b30]">WICKET FALLS!</span>
        ) : (
          <span>+{runsScored} ON THE BOARD</span>
        )}
      </div>
    </div>
  );
}
