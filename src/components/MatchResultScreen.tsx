'use client';

import React, { useEffect } from 'react';
import { MatchState } from '@/engine/types';

interface MatchResultScreenProps {
  match: MatchState;
  onPlayAgain: () => void;
}

export function MatchResultScreen({ match, onPlayAgain }: MatchResultScreenProps) {
  const isTie = match.result?.winnerTeamId === 'tie';
  const winner = isTie
    ? null
    : match.result?.winnerTeamId === match.teamA.id
    ? match.teamA
    : match.teamB;

  // Simple confetti effect via canvas-confetti if available
  useEffect(() => {
    if (!isTie) {
      try {
        import('canvas-confetti').then((mod) => {
          const confetti = mod.default;
          confetti({ particleCount: 100, spread: 70, origin: { y: 0.6 } });
        });
      } catch {}
    }
  }, [isTie]);

  return (
    <div className="w-full max-w-xl mx-auto nb-card bg-[var(--bg-secondary)] overflow-hidden animate-bounce-in">
      <div className="nb-win-bar">
        <div className="nb-dots"><i /><i /><i /></div>
        <span className="font-num text-xs uppercase font-bold tracking-wider text-[var(--text-secondary)]">
          Match Concluded
        </span>
      </div>

      <div className="p-6 text-center">
        <div
          className={`border-3 border-[var(--border-color)] p-5 mb-5 shadow-[4px_4px_0_0_var(--shadow-color)] ${
            isTie ? 'bg-[var(--accent-yellow)]' : 'bg-[var(--accent-lime)]'
          }`}
        >
          <h1 className="font-display text-3xl sm:text-4xl uppercase text-black">
            {isTie ? 'MATCH TIED!' : `${winner?.name} WON!`}
          </h1>
          <p className="font-num text-sm font-bold uppercase mt-1 text-black/70">
            {match.result?.marginText}
          </p>
        </div>

        {/* Score Summary */}
        <div className="grid grid-cols-2 gap-3 mb-6 font-num text-xs">
          <div className="bg-[var(--bg-primary)] border-3 border-[var(--border-color)] p-3 shadow-[2px_2px_0_0_var(--shadow-color)]">
            <div className="font-bold uppercase text-[var(--text-muted)]">{match.teamA.name}</div>
            <div className="text-2xl font-black text-[var(--text-primary)] mt-1">
              {match.innings1.battingTeamId === match.teamA.id
                ? match.innings1.score
                : match.innings2?.score ?? 0}
            </div>
          </div>
          <div className="bg-[var(--bg-primary)] border-3 border-[var(--border-color)] p-3 shadow-[2px_2px_0_0_var(--shadow-color)]">
            <div className="font-bold uppercase text-[var(--text-muted)]">{match.teamB.name}</div>
            <div className="text-2xl font-black text-[var(--text-primary)] mt-1">
              {match.innings1.battingTeamId === match.teamB.id
                ? match.innings1.score
                : match.innings2?.score ?? 0}
            </div>
          </div>
        </div>

        <button
          onClick={onPlayAgain}
          className="nb-btn nb-btn--lime w-full text-lg"
        >
          PLAY AGAIN
        </button>
      </div>
    </div>
  );
}
