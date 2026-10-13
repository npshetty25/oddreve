'use client';

import React from 'react';
import { MatchState, BallEvent } from '@/engine/types';
import { formatOvers } from '@/engine/toss';

interface ScoreboardProps {
  match: MatchState;
  lastEvent: BallEvent | null;
}

export function Scoreboard({ match, lastEvent }: ScoreboardProps) {
  if (!match) return null;
  const currentInnings = match.phase === 'innings2' ? match.innings2 : match.innings1;
  const isTeamABatting = currentInnings?.battingTeamId === match.teamA.id;
  const isSecondInnings = match.phase === 'innings2';
  const isBaseball = match.mode === 'baseball';

  // Calculate scores
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

  // Count consecutive strikes on active batter in baseball mode
  let currentStrikes = 0;
  if (isBaseball && currentInnings) {
    for (let i = currentInnings.events.length - 1; i >= 0; i--) {
      const prev = currentInnings.events[i];
      if (prev.batterId !== currentInnings.activeBatterId) break;
      if (prev.isOut) break;
      if (prev.isStrike) {
        currentStrikes++;
      } else {
        break; // consecutive strikes only
      }
    }
  }

  const isMatchOver = match.phase === 'match_over';
  const runsNeeded =
    match.target !== null && isSecondInnings
      ? Math.max(0, match.target - (isTeamABatting ? teamAScore : teamBScore))
      : match.target !== null
      ? match.target
      : null;

  return (
    <div className="w-full max-w-5xl mx-auto flex-shrink-0">
      {/* High-Contrast Black Score Card */}
      <div className="bg-black text-white border-3 sm:border-4 border-black shadow-[4px_4px_0_0_#000] px-3 py-2 sm:px-4 sm:py-2.5 select-none relative">
        <div className="flex items-center justify-between">
          {/* Team A (You) */}
          <div className="flex-1 text-left flex flex-col items-start justify-center">
            <span className="font-num text-[11px] sm:text-xs font-black text-[#a3f23d] uppercase tracking-wider truncate max-w-[160px]">
              {match.teamA.name === 'Team A' ? 'YOU' : match.teamA.name.toUpperCase()}
            </span>
            <div className="flex items-baseline gap-1.5 mt-0.5">
              <span className="font-display text-3xl sm:text-4xl md:text-5xl font-black text-white leading-none">
                {teamAScore}
              </span>
              {isMatchOver ? (
                <span className="font-num text-xs sm:text-sm font-bold text-[#ff6fb5] lowercase">
                  out
                </span>
              ) : match.format === '2v2' ? (
                <span className="font-num text-xs text-[#888]">
                  /{teamAWickets} {isBaseball ? 'outs' : ''}
                </span>
              ) : null}
            </div>

            {/* Role pill badge */}
            {isTeamABatting && !isMatchOver && (
              <span className="mt-1 px-2 py-0.5 bg-[#a3f23d] text-black font-num text-[9px] font-black uppercase rounded-full shadow-[1px_1px_0_0_#000]">
                {isBaseball ? '⚾ BATTING' : 'BATTING'}
              </span>
            )}
            {!isTeamABatting &&
              !isMatchOver &&
              match.phase !== 'toss_call' &&
              match.phase !== 'toss_throw' &&
              match.phase !== 'toss_result' && (
                <span className="mt-1 px-2 py-0.5 bg-[#4dabf7] text-black font-num text-[9px] font-black uppercase rounded-full shadow-[1px_1px_0_0_#000]">
                  {isBaseball ? 'PITCHING' : 'BOWLING'}
                </span>
              )}
          </div>

          {/* Center VS & Baseball Strikes / Mode info */}
          <div className="px-3 flex flex-col items-center justify-center">
            <div className="w-7 h-7 sm:w-8 sm:h-8 bg-[#ff6fb5] border-2 sm:border-3 border-black flex items-center justify-center font-display text-sm font-black text-black shadow-[2px_2px_0_0_#000]">
              v
            </div>

            {/* Baseball Strikes Indicator */}
            {isBaseball && !isMatchOver && (
              <div className="mt-1 flex items-center gap-1 bg-[#1a1a1a] border border-[#333] px-1.5 py-0.5 rounded">
                <span className="font-num text-[9px] text-[#ffd60a] font-bold">STRIKES</span>
                <div className="flex gap-0.5">
                  {[1, 2, 3].map((s) => (
                    <div
                      key={s}
                      className={`w-2.5 h-2.5 rounded-full border border-black ${
                        s <= currentStrikes ? 'bg-[#ffd60a]' : 'bg-[#444]'
                      }`}
                      title={`Strike ${s}`}
                    />
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Team B (Computer / Opponent) */}
          <div className="flex-1 text-right flex flex-col items-end justify-center">
            <span className="font-num text-[11px] sm:text-xs font-black text-[#a3f23d] uppercase tracking-wider truncate max-w-[160px]">
              {match.teamB.name.toUpperCase()}
            </span>
            <div className="flex items-baseline justify-end gap-1.5 mt-0.5">
              <span className="font-display text-3xl sm:text-4xl md:text-5xl font-black text-white leading-none">
                {teamBScore}
              </span>
              {isMatchOver ? (
                <span className="font-num text-xs sm:text-sm font-bold text-[#ff6fb5] lowercase">
                  out
                </span>
              ) : match.format === '2v2' ? (
                <span className="font-num text-xs text-[#888]">
                  /{teamBWickets} {isBaseball ? 'outs' : ''}
                </span>
              ) : null}
            </div>

            {/* Role pill badge */}
            {!isTeamABatting &&
              !isMatchOver &&
              match.phase !== 'toss_call' &&
              match.phase !== 'toss_throw' &&
              match.phase !== 'toss_result' && (
                <span className="mt-1 px-2 py-0.5 bg-[#a3f23d] text-black font-num text-[9px] font-black uppercase rounded-full shadow-[1px_1px_0_0_#000]">
                  {isBaseball ? '⚾ BATTING' : 'BATTING'}
                </span>
              )}
            {isTeamABatting && !isMatchOver && (
              <span className="mt-1 px-2 py-0.5 bg-[#4dabf7] text-black font-num text-[9px] font-black uppercase rounded-full shadow-[1px_1px_0_0_#000]">
                {isBaseball ? 'PITCHING' : 'BOWLING'}
              </span>
            )}
          </div>
        </div>

        {/* 2v2 Active Players Bar */}
        {match.format === '2v2' && currentInnings && (
          <div className="mt-1.5 pt-1 border-t border-[#333] flex items-center justify-between text-[9px] font-num text-[#aaa]">
            <div>
              <span className="text-[#a3f23d] font-bold">Batter:</span>{' '}
              {currentInnings.battingTeamId === match.teamA.id
                ? match.teamA.players.find((p) => p.id === currentInnings.activeBatterId)?.name
                : match.teamB.players.find((p) => p.id === currentInnings.activeBatterId)?.name}
            </div>
            <div>
              <span className="text-[#ffd60a] font-bold">
                {isBaseball ? 'Pitcher:' : 'Bowler:'}
              </span>{' '}
              {currentInnings.bowlingTeamId === match.teamA.id
                ? match.teamA.players.find((p) => p.id === currentInnings.activeBowlerId)?.name
                : match.teamB.players.find((p) => p.id === currentInnings.activeBowlerId)?.name}
            </div>
          </div>
        )}

        {/* Target Strip Below: "NEEDS X TO WIN" */}
        {(isSecondInnings || isMatchOver) && runsNeeded !== null && (
          <div className="mt-2 -mx-3 -mb-2 sm:-mx-4 sm:-mb-2.5 bg-[#ffd60a] border-t-2 border-black py-1 px-2 text-center">
            <span className="font-num text-[11px] sm:text-xs font-black uppercase text-black tracking-wider">
              {isMatchOver ? `TARGET WAS ${match.target}` : `NEEDS ${runsNeeded} TO WIN`}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
