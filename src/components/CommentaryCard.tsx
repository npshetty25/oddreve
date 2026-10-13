'use client';

import React from 'react';
import { BallEvent, GameMode } from '@/engine/types';

interface CommentaryCardProps {
  lastEvent: BallEvent | null;
  mode: GameMode;
  warningMessage?: string | null;
}

export function CommentaryCard({ lastEvent, mode, warningMessage }: CommentaryCardProps) {
  // If there's an active warning message, show it prominently
  if (warningMessage) {
    return (
      <div className="w-full max-w-xl mx-auto bg-[#ff3b30] border-4 border-black shadow-[6px_6px_0_0_#000] p-4 text-white animate-bounce-in">
        <div className="font-display text-xl sm:text-2xl uppercase tracking-wider mb-1">
          WARNING!
        </div>
        <p className="font-body text-sm font-bold text-white mb-2">
          {warningMessage}
        </p>
        <div className="inline-block bg-white text-black border-2 border-black font-num text-xs font-black px-3 py-1 shadow-[2px_2px_0_0_#000]">
          VALID THROWS: 1 TO 6 RUNS
        </div>
      </div>
    );
  }

  if (!lastEvent) {
    return (
      <div className="w-full max-w-xl mx-auto bg-[#ffd60a] border-4 border-black shadow-[6px_6px_0_0_#000] p-4 text-black text-left">
        <h3 className="font-display text-2xl sm:text-3xl uppercase tracking-tight leading-none mb-1">
          {mode === 'cricket' ? 'READY TO BOWL' : 'BATTER UP!'}
        </h3>
        <p className="font-body text-xs sm:text-sm text-black mb-3">
          {mode === 'cricket'
            ? 'Show 1 to 6 fingers at camera for ~2s to lock your throw.'
            : 'Baseball rules: Difference of 1 is a strike! 3 strikes = OUT.'}
        </p>
        <div className="inline-block bg-white border-2 border-black font-num text-xs sm:text-sm font-black px-3 py-1 shadow-[2px_2px_0_0_#000]">
          SHOW HAND (1–6)
        </div>
      </div>
    );
  }

  const { isOut, runsScored, isStrike, isDouble, batterThrow, bowlerThrow, description } = lastEvent;

  // Determine main header
  let headline = 'RUNS';
  let badgeText = `+${runsScored} ON THE BOARD`;
  let bgColor = 'bg-[#ffd60a]'; // yellow

  if (isOut) {
    headline = 'OUT!';
    badgeText = isStrike ? 'STRIKE 3 — BATTER OUT!' : 'WICKET FALLS!';
    bgColor = 'bg-[#ff3b30] text-white'; // red
  } else if (isDouble) {
    headline = 'DOUBLE RUNS!';
    badgeText = `+${runsScored} RUNS (DOUBLE!)`;
    bgColor = 'bg-[#a3f23d]'; // lime
  } else if (isStrike) {
    headline = 'STRIKE!';
    badgeText = 'STRIKE CALLED';
    bgColor = 'bg-[#ff6fb5]'; // pink
  }

  return (
    <div className={`w-full max-w-xl mx-auto border-4 border-black shadow-[6px_6px_0_0_#000] p-4 text-black text-left transition-all ${bgColor}`}>
      <h3 className="font-display text-2xl sm:text-3xl uppercase tracking-tight leading-none mb-1">
        {headline}
      </h3>

      <div className="font-body text-xs sm:text-sm mb-2 opacity-90">
        Batter {batterThrow}, bowler {bowlerThrow}. {description}
      </div>

      {/* Baseball Strike Dots */}
      {mode === 'baseball' && (
        <div className="flex items-center gap-2 mb-2 font-num text-xs font-bold">
          <span>STRIKES:</span>
          <div className="flex items-center gap-1.5">
            {[1, 2, 3].map((strikeNum) => {
              const active = isOut
                ? true
                : isStrike && strikeNum <= (lastEvent.wicketsAfterBall > 0 ? 0 : 2);
              return (
                <span
                  key={strikeNum}
                  className={`w-3.5 h-3.5 rounded-full border-2 border-black ${
                    active ? 'bg-red-600' : 'bg-white'
                  }`}
                />
              );
            })}
          </div>
        </div>
      )}

      {/* Prominent White Badge Box */}
      <div className="inline-block bg-white text-black border-2 border-black font-num text-xs sm:text-sm font-black px-3 py-1 shadow-[2px_2px_0_0_#000]">
        {badgeText}
      </div>
    </div>
  );
}
