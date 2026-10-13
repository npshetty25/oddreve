'use client';

import React from 'react';
import { MatchState, BallEvent } from '@/engine/types';
import { formatOvers } from '@/engine/toss';

interface ScoreboardProps {
  match: MatchState;
  lastEvent: BallEvent | null;
  lives?: { teamA: number; teamB: number };
}

export function Scoreboard({ match, lastEvent, lives = { teamA: 2, teamB: 2 } }: ScoreboardProps) {
  const currentInnings = match.phase === 'innings2' ? match.innings2 : match.innings1;
  if (!currentInnings) return null;

  const isTeamABatting = currentInnings.battingTeamId === match.teamA.id;
  const isSecondInnings = match.phase === 'innings2';
  const overString = formatOvers(currentInnings.balls);

  // Correct score determination per innings
  let teamAScore = 0;
  let teamAWickets = 0;
  let teamBScore = 0;
  let teamBWickets = 0;

  if (match.innings1) {
    if (match.innings1.battingTeamId === match.teamA.id) {
      teamAScore = match.innings1.score;
      teamAWickets = match.innings1.wickets;
    } else {
      teamBScore = match.innings1.score;
      teamBWickets = match.innings1.wickets;
    }
  }

  if (match.innings2) {
    if (match.innings2.battingTeamId === match.teamA.id) {
      teamAScore = match.innings2.score;
      teamAWickets = match.innings2.wickets;
    } else {
      teamBScore = match.innings2.score;
      teamBWickets = match.innings2.wickets;
    }
  }

  return (
    <div className="w-full max-w-xl mx-auto flex-shrink-0">
      {/* High-Contrast Black Score Card */}
      <div className="bg-black text-white border-3 sm:border-4 border-black shadow-[4px_4px_0_0_#000] px-3 py-1.5 sm:px-4 sm:py-2 select-none">
        <div className="flex items-center justify-between">
          {/* Team A (You) */}
          <div className="flex-1 text-left">
            <div className="flex items-center gap-1.5 mb-0.5">
              <span className="font-num text-xs sm:text-sm font-black text-[#a3f23d] uppercase tracking-wider truncate max-w-[120px]">
                {match.teamA.name}
              </span>
              {isTeamABatting && (
                <span className="font-num text-[9px] px-1 py-0.2 bg-[#a3f23d] text-black font-black uppercase">
                  BAT
                </span>
              )}
            </div>
            <div className="flex items-baseline gap-1">
              <span className="font-display text-3xl sm:text-4xl font-black text-white leading-none">
                {teamAScore}
              </span>
              <span className="font-num text-xs text-[#888]">
                /{teamAWickets}
              </span>
            </div>
            {/* Lives indicator */}
            <div className="font-num text-[10px] text-[#ffd60a] flex items-center gap-1 mt-0.5">
              <span>LIVES:</span>
              <span>{lives.teamA === 2 ? '❤️❤️' : lives.teamA === 1 ? '❤️' : '💀'}</span>
            </div>
          </div>

          {/* Center VS / Target Badge */}
          <div className="px-2 flex flex-col items-center justify-center">
            <div className="w-6 h-6 bg-[#ff6fb5] border-2 border-black flex items-center justify-center font-display text-xs text-black shadow-[2px_2px_0_0_#000]">
              v
            </div>
            {isSecondInnings && match.target ? (
              <div className="font-num text-[9px] font-bold text-[#ff3b30] mt-0.5 whitespace-nowrap">
                TARGET {match.target}
              </div>
            ) : (
              <div className="font-num text-[9px] text-[#aaa] mt-0.5 whitespace-nowrap">
                {overString} ov
              </div>
            )}
          </div>

          {/* Team B (Opponent) */}
          <div className="flex-1 text-right">
            <div className="flex items-center justify-end gap-1.5 mb-0.5">
              {!isTeamABatting && (
                <span className="font-num text-[9px] px-1 py-0.2 bg-[#a3f23d] text-black font-black uppercase">
                  BAT
                </span>
              )}
              <span className="font-num text-xs sm:text-sm font-black text-[#a3f23d] uppercase tracking-wider truncate max-w-[120px]">
                {match.teamB.name}
              </span>
            </div>
            <div className="flex items-baseline justify-end gap-1">
              <span className="font-display text-3xl sm:text-4xl font-black text-white leading-none">
                {teamBScore}
              </span>
              <span className="font-num text-xs text-[#888]">
                /{teamBWickets}
              </span>
            </div>
            {/* Lives indicator */}
            <div className="font-num text-[10px] text-[#ffd60a] flex items-center justify-end gap-1 mt-0.5">
              <span>LIVES:</span>
              <span>{lives.teamB === 2 ? '❤️❤️' : lives.teamB === 1 ? '❤️' : '💀'}</span>
            </div>
          </div>
        </div>

        {/* 2v2 Active Players Bar */}
        {match.format === '2v2' && (
          <div className="mt-1 pt-1 border-t border-[#333] flex items-center justify-between text-[9px] font-num text-[#aaa]">
            <div>
              <span className="text-[#a3f23d] font-bold">Striker:</span>{' '}
              {currentInnings.battingTeamId === match.teamA.id
                ? match.teamA.players.find((p) => p.id === currentInnings.activeBatterId)?.name
                : match.teamB.players.find((p) => p.id === currentInnings.activeBatterId)?.name}
            </div>
            <div>
              <span className="text-[#ffd60a] font-bold">Bowler:</span>{' '}
              {currentInnings.bowlingTeamId === match.teamA.id
                ? match.teamA.players.find((p) => p.id === currentInnings.activeBowlerId)?.name
                : match.teamB.players.find((p) => p.id === currentInnings.activeBowlerId)?.name}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
