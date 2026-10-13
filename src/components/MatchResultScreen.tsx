'use client';

import React from 'react';
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

  return (
    <div className="w-full max-w-xl mx-auto nb-card p-6 bg-[#f7f1e3] text-black text-center">
      <div className="nb-win-bar -mx-6 -mt-6 mb-6">
        <div className="nb-dots">
          <i />
          <i />
          <i />
        </div>
        <span className="font-num text-xs uppercase font-bold tracking-wider">Match Concluded</span>
      </div>

      <div
        className={`border-4 border-black p-4 mb-4 shadow-[4px_4px_0_0_#000] ${
          isTie ? 'bg-[#ffd60a]' : 'bg-[#a3f23d]'
        }`}
      >
        <h1 className="font-display text-3xl sm:text-4xl uppercase text-black">
          {isTie ? 'Match Tied!' : `${winner?.name} Won!`}
        </h1>
        <p className="font-num text-sm font-bold uppercase mt-1">
          {match.result?.marginText}
        </p>
      </div>

      {/* Score Summary */}
      <div className="grid grid-cols-2 gap-3 mb-6 font-num text-xs">
        <div className="bg-white border-2 border-black p-3">
          <div className="font-bold uppercase text-zinc-600">{match.teamA.name}</div>
          <div className="text-2xl font-black text-black mt-1">
            {match.innings1.battingTeamId === match.teamA.id
              ? match.innings1.score
              : match.innings2?.score ?? 0}
          </div>
        </div>
        <div className="bg-white border-2 border-black p-3">
          <div className="font-bold uppercase text-zinc-600">{match.teamB.name}</div>
          <div className="text-2xl font-black text-black mt-1">
            {match.innings1.battingTeamId === match.teamB.id
              ? match.innings1.score
              : match.innings2?.score ?? 0}
          </div>
        </div>
      </div>

      <button
        onClick={onPlayAgain}
        className="nb-btn nb-btn--lime w-full text-lg shadow-[6px_6px_0_0_#000]"
      >
        PLAY AGAIN
      </button>
    </div>
  );
}
