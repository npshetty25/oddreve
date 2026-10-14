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
  /** Which team the viewing player belongs to (online play). Defaults to team_a. */
  myTeamId?: 'team_a' | 'team_b';
  /** In 2v2 only the team captain calls the toss / picks bat or bowl. */
  isCaptain?: boolean;
}

export function CommentaryCard({
  match,
  lastEvent,
  onCallToss,
  onChooseToss,
  onPlayAgain,
  onBackToLanding,
  myTeamId = 'team_a',
  isCaptain = true,
}: CommentaryCardProps) {

  const currentInnings = match.phase === 'innings2' ? match.innings2 : match.innings1;
  const isTeamABatting = currentInnings?.battingTeamId === match.teamA.id;
  const myTeam = myTeamId === 'team_a' ? match.teamA : match.teamB;
  const oppTeam = myTeamId === 'team_a' ? match.teamB : match.teamA;
  const isUserWinner = match.phase === 'match_over' && match.result?.winnerTeamId === myTeam.id;
  const isBaseball = match.mode === 'baseball';

  // Confetti celebration when user wins
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
      <div className="w-full max-w-5xl mx-auto bg-[#ffd60a] border-3 sm:border-4 border-black shadow-[4px_4px_0_0_#000] p-3 text-black text-left flex-shrink-0 animate-slide-up">
        <h3 className="font-display text-xl sm:text-2xl uppercase tracking-tight leading-none mb-1">
          CALL ODD OR EVEN
        </h3>
        <p className="font-body text-xs text-black mb-2.5">
          {match.toss.callerTeamId === myTeam.id && isCaptain
            ? 'You are calling the toss. Choose odd or even:'
            : `⏳ Waiting for ${match.toss.callerTeamId === myTeam.id ? 'your team captain' : oppTeam.name} to call the toss...`}
        </p>
        {match.toss.callerTeamId === myTeam.id && isCaptain && (
        <div className="flex gap-2.5 max-w-xs">
          <button
            onClick={() => onCallToss?.(myTeam.id, 'odd')}
            className="flex-1 py-2 bg-white hover:bg-neutral-100 border-2 sm:border-3 border-black font-display text-sm font-black text-black uppercase shadow-[2px_2px_0_0_#000] cursor-pointer"
          >
            ODD
          </button>
          <button
            onClick={() => onCallToss?.(myTeam.id, 'even')}
            className="flex-1 py-2 bg-[#ff6fb5] hover:bg-[#ff5ca8] border-2 sm:border-3 border-black font-display text-sm font-black text-black uppercase shadow-[2px_2px_0_0_#000] cursor-pointer"
          >
            EVEN
          </button>
        </div>
        )}
      </div>
    );
  }

  // 2. TOSS THROW PHASE
  if (match.phase === 'toss_throw') {
    return (
      <div className="w-full max-w-5xl mx-auto bg-[#ffd60a] border-3 sm:border-4 border-black shadow-[4px_4px_0_0_#000] p-3 text-black text-left flex-shrink-0 animate-slide-up">
        <h3 className="font-display text-2xl sm:text-3xl font-black uppercase tracking-tight leading-none mb-1 text-black">
          TOSS THROW
        </h3>
        <p className="font-body text-xs sm:text-sm text-black">
          {match.toss.callerTeamId === myTeam.id ? 'You' : oppTeam.name} called{' '}
          <strong>{match.toss.call.toUpperCase()}</strong>. Hand up in frame — show 0 to 6 on the 3-2-1.
        </p>
      </div>
    );
  }

  // 3. TOSS RESULT PHASE
  if (match.phase === 'toss_result') {
    const isUserWinner = match.toss.winnerTeamId === myTeam.id;
    const winnerName = isUserWinner ? 'YOU' : oppTeam.name.toUpperCase();
    const callerName = match.toss.callerTeamId === myTeam.id ? 'YOU' : oppTeam.name.toUpperCase();
    const throwA = (myTeamId === 'team_a' ? match.toss.teamAThrow : match.toss.teamBThrow) ?? 0;
    const throwB = (myTeamId === 'team_a' ? match.toss.teamBThrow : match.toss.teamAThrow) ?? 0;
    const sum = throwA + throwB;
    const isEven = sum % 2 === 0;
    const outcome = isEven ? 'EVEN' : 'ODD';
    const choice = match.toss.choice;
    const roleTerm = isBaseball ? 'PITCH' : 'BOWL';

    return (
      <div className="w-full max-w-5xl mx-auto bg-[#ffd60a] border-3 sm:border-4 border-black shadow-[4px_4px_0_0_#000] p-3 sm:p-4 text-black text-left flex-shrink-0 animate-slide-up">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 mb-2">
          <h3 className="font-display text-xl sm:text-2xl font-black uppercase tracking-tight leading-none text-black">
            🪙 {isUserWinner ? 'YOU WON THE TOSS!' : `${winnerName} WON THE TOSS!`}
          </h3>
          <div className="flex items-center gap-1.5 font-num text-[11px] font-black bg-white px-2.5 py-1 border-2 border-black shadow-[1px_1px_0_0_#000]">
            <span>YOU: {throwA}</span>
            <span>+</span>
            <span>{oppTeam.name.toUpperCase()}: {throwB}</span>
            <span>=</span>
            <span className="bg-[#a3f23d] px-1">{sum} ({outcome})</span>
          </div>
        </div>

        <p className="font-num text-xs font-bold text-black/90 mb-2">
          {callerName} called <span className="uppercase underline font-black">{match.toss.call}</span>. Total is {sum} ({outcome}). {winnerName} won the toss!
        </p>

        {isUserWinner && isCaptain ? (
          <div>
            <p className="font-display text-xs sm:text-sm font-black text-black mb-2 uppercase">
              CHOOSE YOUR ROLE TO START THE MATCH:
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
                {roleTerm} FIRST
              </button>
            </div>
          </div>
        ) : (
          <div className="bg-white border-2 border-black p-2 shadow-[2px_2px_0_0_#000] max-w-md">
            <p className="font-display text-sm font-black text-black uppercase">
              {choice
                ? `📢 ${winnerName} CHOSE TO ${choice === 'bat' ? 'BAT' : roleTerm} FIRST!`
                : `⏳ ${winnerName} is choosing to bat or ${roleTerm.toLowerCase()}...`}
            </p>
          </div>
        )}
      </div>
    );
  }

  // 4. MATCH OVER PHASE
  if (match.phase === 'match_over') {
    const isUserWinner = match.result?.winnerTeamId === myTeam.id;
    const isTie = match.result?.winnerTeamId === 'tie' || match.result?.winnerTeamId === null;

    let scoreTeamA = 0;
    let scoreTeamB = 0;
    if (match.innings1?.battingTeamId === match.teamA.id) {
      scoreTeamA = match.innings1.score;
      scoreTeamB = match.innings2?.score ?? 0;
    } else {
      scoreTeamB = match.innings1.score;
      scoreTeamA = match.innings2?.score ?? 0;
    }

    const oppName = oppTeam.name;
    const myScore = myTeamId === 'team_a' ? scoreTeamA : scoreTeamB;
    const oppScore = myTeamId === 'team_a' ? scoreTeamB : scoreTeamA;
    const summaryText = isTie
      ? `Match tied at ${myScore} runs!`
      : isUserWinner
      ? `You beat ${oppName} ${myScore} to ${oppScore}.`
      : `${oppName} beat You ${oppScore} to ${myScore}.`;

    return (
      <div
        className={`w-full max-w-5xl mx-auto border-4 border-black shadow-[6px_6px_0_0_#000] p-4 sm:p-5 text-center flex-shrink-0 relative overflow-hidden animate-slide-up ${
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
          <span>{isUserWinner ? 'VICTORY' : isTie ? 'TIED MATCH' : 'DEFEAT'}</span>
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
            {isBaseball ? '⚾ Batter struck out! Hit Play Again for revenge.' : '💔 Clean bowled! Hit Play Again for revenge.'}
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
    const readyRole = isBaseball
      ? isTeamABatting ? 'READY TO BAT' : 'READY TO PITCH'
      : isTeamABatting ? 'READY TO BAT' : 'READY TO BOWL';

    return (
      <div className="w-full max-w-5xl mx-auto bg-[#ffd60a] border-3 sm:border-4 border-black shadow-[4px_4px_0_0_#000] p-4 text-black text-left flex-shrink-0 animate-slide-up">
        <h3 className="font-display text-2xl sm:text-3xl font-black uppercase tracking-tight leading-none mb-1 text-black">
          {readyRole}
        </h3>
        <p className="font-body text-xs sm:text-sm text-black">
          {isBaseball
            ? 'Show 0 to 6 on the 3-2-1. Diff of 1 = Strike! 3 Strikes = Out! Equal throw = Double!'
            : 'Show 0 to 6 fingers to the camera on the 3-2-1.'}
        </p>
      </div>
    );
  }

  // 6. LIVE EVENT RUNS COMMENTARY
  const { isOut, runsScored, batterThrow, bowlerThrow, isStrike, isDouble } = lastEvent;

  if (isBaseball) {
    let headline = 'BASE HIT!';
    let detail = `Batter ${batterThrow}, Pitcher ${bowlerThrow}.`;
    let badgeText = `+${runsScored} ON THE BOARD`;
    let badgeColor = 'bg-white text-black';

    if (isStrike) {
      headline = isOut ? 'STRIKE 3! OUT!' : 'STRIKE!';
      const isCirc = (batterThrow === 6 && bowlerThrow === 1) || (batterThrow === 1 && bowlerThrow === 6);
      detail = isOut
        ? '3 Consecutive strikes reached! Batter is OUT!'
        : isCirc
        ? `6 and 1 is a strike! (${batterThrow} vs ${bowlerThrow})`
        : `Difference of 1 is a strike! (${batterThrow} vs ${bowlerThrow})`;
      badgeText = isOut ? 'BATTER STRUCK OUT!' : 'STRIKE RECORDED!';
      badgeColor = 'bg-[#ff3b30] text-white';
    } else if (isDouble) {
      headline = '🔥 DOUBLE RUNS!';
      detail = `Equal throws (${batterThrow} = ${bowlerThrow})! 2x multiplier!`;
      badgeText = `+${runsScored} RUNS SCORED!`;
      badgeColor = 'bg-[#a3f23d] text-black';
    }

    return (
      <div className="w-full max-w-5xl mx-auto bg-[#ffd60a] border-3 sm:border-4 border-black shadow-[4px_4px_0_0_#000] p-4 text-black text-left flex-shrink-0 animate-slide-up">
        <h3 className="font-display text-2xl sm:text-3xl font-black uppercase tracking-tight leading-none mb-1 text-black">
          {headline}
        </h3>
        <p className="font-body text-xs sm:text-sm text-black mb-2.5">
          {detail}
        </p>
        <div className={`inline-block border-2 sm:border-3 border-black px-3.5 py-1.5 font-num text-xs sm:text-sm font-black shadow-[2px_2px_0_0_#000] ${badgeColor}`}>
          {badgeText}
        </div>
      </div>
    );
  }

  // Cricket live commentary
  return (
    <div className="w-full max-w-5xl mx-auto bg-[#ffd60a] border-3 sm:border-4 border-black shadow-[4px_4px_0_0_#000] p-4 text-black text-left flex-shrink-0 animate-slide-up">
      <h3 className="font-display text-2xl sm:text-3xl font-black uppercase tracking-tight leading-none mb-1 text-black">
        {isOut ? 'OUT!' : 'RUNS'}
      </h3>
      <p className="font-body text-xs sm:text-sm text-black mb-2.5">
        Batter {batterThrow}, bowler {bowlerThrow}.
      </p>
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
