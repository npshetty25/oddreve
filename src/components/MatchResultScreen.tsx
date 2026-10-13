'use client';

import React, { useEffect } from 'react';
import { MatchState } from '@/engine/types';
import { Trophy, Frown, Award, RotateCcw } from 'lucide-react';

interface MatchResultScreenProps {
  match: MatchState;
  onPlayAgain: () => void;
}

export function MatchResultScreen({ match, onPlayAgain }: MatchResultScreenProps) {
  const isTie = match.result?.winnerTeamId === 'tie';
  const isUserWinner = !isTie && match.result?.winnerTeamId === match.teamA.id;
  const winner = isTie
    ? null
    : match.result?.winnerTeamId === match.teamA.id
    ? match.teamA
    : match.teamB;

  // Only fire confetti when the user actually WINS!
  useEffect(() => {
    if (isUserWinner) {
      try {
        import('canvas-confetti').then((mod) => {
          const confetti = mod.default;
          confetti({
            particleCount: 150,
            spread: 80,
            origin: { y: 0.6 },
            colors: ['#a3f23d', '#ffd60a', '#ff6fb5', '#3b82f6'],
          });
        });
      } catch {}
    }
  }, [isUserWinner]);

  const teamAScore = match.innings1.battingTeamId === match.teamA.id
    ? match.innings1.score
    : (match.innings2?.score ?? 0);
  const teamAWickets = match.innings1.battingTeamId === match.teamA.id
    ? match.innings1.wickets
    : (match.innings2?.wickets ?? 0);

  const teamBScore = match.innings1.battingTeamId === match.teamB.id
    ? match.innings1.score
    : (match.innings2?.score ?? 0);
  const teamBWickets = match.innings1.battingTeamId === match.teamB.id
    ? match.innings1.wickets
    : (match.innings2?.wickets ?? 0);

  return (
    <div className="w-full max-w-md mx-auto nb-card bg-white border-4 border-black shadow-[8px_8px_0_0_#000] overflow-hidden animate-bounce-in select-none">
      <div className="nb-win-bar bg-[#ffd60a] border-b-4 border-black px-3 py-2 flex items-center justify-between">
        <div className="nb-dots"><i /><i /><i /></div>
        <span className="font-num text-xs uppercase font-black tracking-wider text-black">
          MATCH FINISHED
        </span>
      </div>

      <div className="p-5 sm:p-6 text-center">
        {/* Result Callout Banner */}
        {isUserWinner ? (
          <div className="border-4 border-black bg-[#a3f23d] p-5 mb-5 shadow-[5px_5px_0_0_#000]">
            <div className="flex justify-center mb-2">
              <div className="w-12 h-12 rounded-full bg-white border-3 border-black flex items-center justify-center text-2xl shadow-[2px_2px_0_0_#000]">
                🏆
              </div>
            </div>
            <h1 className="font-display text-3xl sm:text-4xl uppercase text-black leading-none">
              VICTORY!
            </h1>
            <p className="font-body text-base font-black text-black mt-1">
              YOU WON THE MATCH!
            </p>
            <p className="font-num text-xs font-bold uppercase mt-1 text-black/80">
              {match.result?.marginText}
            </p>
          </div>
        ) : isTie ? (
          <div className="border-4 border-black bg-[#ffd60a] p-5 mb-5 shadow-[5px_5px_0_0_#000]">
            <h1 className="font-display text-3xl sm:text-4xl uppercase text-black leading-none">
              MATCH TIED!
            </h1>
            <p className="font-body text-sm font-bold text-black mt-1">
              Scores level — What a battle!
            </p>
          </div>
        ) : (
          <div className="border-4 border-black bg-[#ff3b30] p-5 mb-5 shadow-[5px_5px_0_0_#000] text-white">
            <div className="flex justify-center mb-2">
              <div className="w-12 h-12 rounded-full bg-white border-3 border-black flex items-center justify-center text-2xl shadow-[2px_2px_0_0_#000]">
                💀
              </div>
            </div>
            <h1 className="font-display text-3xl sm:text-4xl uppercase text-white leading-none">
              DEFEAT!
            </h1>
            <p className="font-body text-base font-black text-white mt-1">
              {winner?.name.toUpperCase()} WON
            </p>
            <p className="font-num text-xs font-bold uppercase mt-1 text-white/90">
              {match.result?.marginText}
            </p>
          </div>
        )}

        {/* Score Summary Comparison */}
        <div className="grid grid-cols-2 gap-3 mb-5 font-num">
          <div className={`border-3 border-black p-3 shadow-[3px_3px_0_0_#000] ${
            isUserWinner ? 'bg-[#a3f23d]/20 border-black' : 'bg-[#f5f0e1]'
          }`}>
            <div className="font-bold text-xs uppercase text-[#444]">{match.teamA.name}</div>
            <div className="text-3xl font-black text-black mt-1">
              {teamAScore}
              <span className="text-sm text-[#777]">/{teamAWickets}</span>
            </div>
          </div>

          <div className={`border-3 border-black p-3 shadow-[3px_3px_0_0_#000] ${
            !isUserWinner && !isTie ? 'bg-[#ff3b30]/20 border-black' : 'bg-[#f5f0e1]'
          }`}>
            <div className="font-bold text-xs uppercase text-[#444]">{match.teamB.name}</div>
            <div className="text-3xl font-black text-black mt-1">
              {teamBScore}
              <span className="text-sm text-[#777]">/{teamBWickets}</span>
            </div>
          </div>
        </div>

        <button
          onClick={onPlayAgain}
          className="nb-btn nb-btn--lime w-full text-base border-4 flex items-center justify-center gap-2"
        >
          <RotateCcw className="w-4 h-4" />
          <span>PLAY AGAIN</span>
        </button>
      </div>
    </div>
  );
}
