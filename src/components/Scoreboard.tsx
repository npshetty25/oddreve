'use client';

import React from 'react';
import { MatchState, BallEvent } from '@/engine/types';
import { Flame, Shield, Target, Zap, Activity } from 'lucide-react';

interface ScoreboardProps {
  match: MatchState;
  lastEvent: BallEvent | null;
}

export function Scoreboard({ match, lastEvent }: ScoreboardProps) {
  const currentInningsNum = match.phase === 'innings2' ? 2 : 1;
  const currentInnings = currentInningsNum === 1 ? match.innings1 : match.innings2;

  const isTeamABatting = currentInnings?.battingTeamId === match.teamA.id;
  const battingTeam = isTeamABatting ? match.teamA : match.teamB;
  const bowlingTeam = isTeamABatting ? match.teamB : match.teamA;

  const activeBatter = battingTeam?.players.find((p) => p.id === currentInnings?.activeBatterId);
  const activeBowler = bowlingTeam?.players.find((p) => p.id === currentInnings?.activeBowlerId);

  const scoreA =
    match.innings1.battingTeamId === match.teamA.id
      ? match.innings1.score
      : match.innings2?.battingTeamId === match.teamA.id
      ? match.innings2.score
      : 0;

  const scoreB =
    match.innings1.battingTeamId === match.teamB.id
      ? match.innings1.score
      : match.innings2?.battingTeamId === match.teamB.id
      ? match.innings2.score
      : 0;

  return (
    <div className="w-full max-w-4xl mx-auto flex flex-col gap-4">
      {/* Target Banner */}
      {match.target !== null && (
        <div className="cyber-card py-2.5 px-5 rounded-2xl flex items-center justify-between border-amber-500/30 bg-amber-950/30 text-amber-300">
          <div className="flex items-center gap-2">
            <Target className="w-4 h-4 text-amber-400" />
            <span className="font-heading font-black text-xs uppercase tracking-wider">
              Chase Target: {match.target} Runs
            </span>
          </div>
          <span className="font-mono text-xs font-semibold text-amber-200">
            Need {Math.max(0, match.target - (currentInnings?.score ?? 0))} runs to win
          </span>
        </div>
      )}

      {/* Main Stadium Board */}
      <div className="cyber-card rounded-3xl p-5 sm:p-6 border-slate-700/80 shadow-2xl relative overflow-hidden">
        {/* Subtle glow accent */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-80 h-16 bg-cyan-500/10 blur-2xl pointer-events-none" />

        {/* Top Meta info */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-800/80 mb-5">
          <div className="flex items-center gap-2">
            <span className="px-3 py-1 rounded-full text-[10px] font-heading font-bold uppercase tracking-wider bg-cyan-500/10 text-cyan-400 border border-cyan-500/30">
              {match.mode} • {match.format}
            </span>
            <span className="text-xs font-mono font-medium text-slate-400">
              Innings {currentInningsNum} of 2
            </span>
          </div>

          <div className="text-xs font-mono text-slate-400">
            Total Balls Bowled: <strong className="text-white font-bold">{currentInnings?.balls ?? 0}</strong>
          </div>
        </div>

        {/* 3-Column Score Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-center">
          {/* Team A Column */}
          <div className="flex flex-col items-center md:items-start text-center md:text-left">
            <div className="flex items-center gap-1.5 mb-1">
              <span className="font-heading font-black text-xl text-white tracking-tight">
                {match.teamA.name}
              </span>
              {isTeamABatting && (
                <span className="px-2 py-0.5 rounded-full text-[9px] font-heading font-extrabold uppercase bg-emerald-500/20 text-emerald-400 border border-emerald-500/40">
                  Batting
                </span>
              )}
            </div>

            <div className="font-mono text-5xl font-black text-cyan-400 tracking-tight my-1">
              {scoreA}
              {match.format === '2v2' && isTeamABatting && (
                <span className="text-2xl text-slate-400 font-light">/{currentInnings?.wickets}</span>
              )}
            </div>

            <div className="text-xs font-mono text-slate-400">
              {isTeamABatting
                ? `Batter: ${activeBatter?.name || 'Player 1'} (${activeBatter?.runs || 0}r)`
                : `Bowler: ${activeBowler?.name || 'Player 1'}`}
            </div>
          </div>

          {/* Center VS & Stadium Status */}
          <div className="flex flex-col items-center justify-center p-4 rounded-2xl bg-slate-900/60 border border-slate-800 text-center">
            <span className="font-heading font-black text-2xl text-slate-300 tracking-wider">VS</span>
            <span className="text-[11px] font-mono text-slate-500 mt-1 uppercase">
              {match.format === '2v2' ? 'Play until both out' : '1 Wicket Format'}
            </span>
          </div>

          {/* Team B Column */}
          <div className="flex flex-col items-center md:items-end text-center md:text-right">
            <div className="flex items-center gap-1.5 mb-1 flex-row-reverse md:flex-row">
              {!isTeamABatting && (
                <span className="px-2 py-0.5 rounded-full text-[9px] font-heading font-extrabold uppercase bg-purple-500/20 text-purple-400 border border-purple-500/40">
                  Batting
                </span>
              )}
              <span className="font-heading font-black text-xl text-white tracking-tight">
                {match.teamB.name}
              </span>
            </div>

            <div className="font-mono text-5xl font-black text-purple-400 tracking-tight my-1">
              {scoreB}
              {match.format === '2v2' && !isTeamABatting && (
                <span className="text-2xl text-slate-400 font-light">/{currentInnings?.wickets}</span>
              )}
            </div>

            <div className="text-xs font-mono text-slate-400">
              {!isTeamABatting
                ? `Batter: ${activeBatter?.name || 'Player 2'} (${activeBatter?.runs || 0}r)`
                : `Bowler: ${activeBowler?.name || 'Player 2'}`}
            </div>
          </div>
        </div>

        {/* Last Ball Event Card */}
        {lastEvent && (
          <div
            className={`mt-5 p-3.5 rounded-2xl text-center text-sm font-heading font-bold border transition-all animate-in fade-in zoom-in-95 ${
              lastEvent.isOut
                ? 'bg-rose-950/60 border-rose-500/40 text-rose-300'
                : lastEvent.isDouble
                ? 'bg-amber-950/60 border-amber-500/40 text-amber-300'
                : lastEvent.isStrike
                ? 'bg-orange-950/60 border-orange-500/40 text-orange-300'
                : 'bg-emerald-950/60 border-emerald-500/40 text-emerald-300'
            }`}
          >
            <div className="flex items-center justify-center gap-2">
              <Activity className="w-4 h-4 animate-pulse" />
              <span>
                {lastEvent.description} (Batter threw {lastEvent.batterThrow} vs Bowler {lastEvent.bowlerThrow})
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
