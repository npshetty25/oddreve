'use client';

import React from 'react';
import { MatchState, ThrowValue, TossCall, TossChoice } from '@/engine/types';
import { Sparkles, Coins, ArrowRight, ShieldCheck, Flame } from 'lucide-react';

interface TossScreenProps {
  match: MatchState;
  onCallToss: (callerTeamId: string, call: TossCall) => void;
  onThrowTossA: (val: ThrowValue) => void;
  onThrowTossB: (val: ThrowValue) => void;
  onChooseToss: (choice: TossChoice) => void;
  pendingThrows: { teamA: ThrowValue | null; teamB: ThrowValue | null };
}

export function TossScreen({
  match,
  onCallToss,
  onThrowTossA,
  onThrowTossB,
  onChooseToss,
  pendingThrows,
}: TossScreenProps) {
  const toss = match.toss;
  const callerTeam = toss.callerTeamId === match.teamA.id ? match.teamA : match.teamB;
  const winnerTeam = toss.winnerTeamId === match.teamA.id ? match.teamA : match.teamB;

  return (
    <div className="w-full max-w-xl mx-auto cyber-card rounded-3xl p-6 sm:p-8 border border-slate-700/60 shadow-2xl relative overflow-hidden animate-in fade-in zoom-in-95">
      {/* Background radial accent */}
      <div className="absolute -top-20 -right-20 w-44 h-44 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-20 -left-20 w-44 h-44 bg-purple-500/10 rounded-full blur-3xl pointer-events-none" />

      {/* Header Badge */}
      <div className="flex items-center justify-between pb-5 border-b border-slate-800/80 mb-6">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400">
            <Coins className="w-4 h-4 animate-bounce" />
          </div>
          <div>
            <span className="font-heading text-xs tracking-wider uppercase text-slate-400 block">
              Match Kickoff
            </span>
            <span className="font-heading font-black text-white text-base">The Official Toss</span>
          </div>
        </div>

        <span className="text-[10px] font-mono font-semibold px-2.5 py-1 rounded-full bg-slate-800 text-slate-300 border border-slate-700">
          Phase 1 of 3
        </span>
      </div>

      {/* Step 1: Call Odd or Even */}
      {match.phase === 'toss_call' && (
        <div className="text-center space-y-6">
          <div>
            <h2 className="text-2xl sm:text-3xl font-heading font-black text-white tracking-tight mb-2">
              CALL ODD OR EVEN
            </h2>
            <p className="text-xs sm:text-sm text-slate-400 font-sans max-w-md mx-auto">
              <strong className="text-cyan-400">{callerTeam.name}</strong>, make your call. Then both players throw 0–6 to decide who bats or bowls!
            </p>
          </div>

          <div className="grid grid-cols-2 gap-4 max-w-md mx-auto">
            <button
              onClick={() => onCallToss(callerTeam.id, 'odd')}
              className="cyber-btn py-5 px-6 rounded-2xl bg-gradient-to-br from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-black font-heading font-black text-lg tracking-wider shadow-lg shadow-cyan-500/20 border border-cyan-400/40"
            >
              ODD
            </button>
            <button
              onClick={() => onCallToss(callerTeam.id, 'even')}
              className="cyber-btn py-5 px-6 rounded-2xl bg-gradient-to-br from-purple-500 to-indigo-600 hover:from-purple-400 hover:to-indigo-500 text-white font-heading font-black text-lg tracking-wider shadow-lg shadow-purple-500/20 border border-purple-400/40"
            >
              EVEN
            </button>
          </div>
        </div>
      )}

      {/* Step 2: Throw fingers */}
      {match.phase === 'toss_throw' && (
        <div className="text-center space-y-6">
          <div>
            <h2 className="text-2xl font-heading font-black text-white uppercase tracking-tight mb-1">
              Show Your Hand At Camera
            </h2>
            <p className="text-xs text-slate-400 font-sans">
              {callerTeam.name} called <strong className="text-amber-400 uppercase font-mono">{toss.call}</strong>. Throw 0–6 on your camera or use the buttons below.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="p-4 rounded-2xl bg-slate-900/90 border border-slate-800 text-center">
              <div className="text-[11px] font-heading font-bold text-slate-400 uppercase tracking-wider mb-1">
                {match.teamA.name}
              </div>
              <div className="text-3xl font-heading font-black text-cyan-400">
                {pendingThrows.teamA !== null ? pendingThrows.teamA : 'Waiting...'}
              </div>
            </div>

            <div className="p-4 rounded-2xl bg-slate-900/90 border border-slate-800 text-center">
              <div className="text-[11px] font-heading font-bold text-slate-400 uppercase tracking-wider mb-1">
                {match.teamB.name}
              </div>
              <div className="text-3xl font-heading font-black text-purple-400">
                {pendingThrows.teamB !== null ? pendingThrows.teamB : 'Waiting...'}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Step 3: Result & Winner Choice */}
      {match.phase === 'toss_result' && winnerTeam && (
        <div className="text-center space-y-6 animate-in fade-in">
          <div className="p-4 rounded-2xl bg-cyan-950/40 border border-cyan-500/30 text-center">
            <div className="text-xs font-mono text-cyan-400 uppercase tracking-wider font-semibold mb-1">
              Toss Resolved
            </div>
            <div className="text-sm text-slate-300">
              {match.teamA.name} ({toss.teamAThrow}) + {match.teamB.name} ({toss.teamBThrow}) ={' '}
              <strong className="text-white font-mono text-base font-bold">
                {(toss.teamAThrow ?? 0) + (toss.teamBThrow ?? 0)}
              </strong>{' '}
              ({((toss.teamAThrow ?? 0) + (toss.teamBThrow ?? 0)) % 2 === 0 ? 'EVEN' : 'ODD'})
            </div>
            <div className="text-xl font-heading font-black text-cyan-300 mt-2">
              🎉 {winnerTeam.name} Won The Toss!
            </div>
          </div>

          <div>
            <p className="text-xs font-heading uppercase text-slate-400 mb-3 tracking-wider">
              {winnerTeam.name}, What Will You Choose?
            </p>
            <div className="grid grid-cols-2 gap-4 max-w-sm mx-auto">
              <button
                onClick={() => onChooseToss('bat')}
                className="cyber-btn py-4 px-6 rounded-2xl bg-emerald-500 hover:bg-emerald-400 text-black font-heading font-black text-base shadow-lg shadow-emerald-500/20 border border-emerald-400/40"
              >
                BAT FIRST
              </button>
              <button
                onClick={() => onChooseToss('bowl')}
                className="cyber-btn py-4 px-6 rounded-2xl bg-amber-500 hover:bg-amber-400 text-black font-heading font-black text-base shadow-lg shadow-amber-500/20 border border-amber-400/40"
              >
                BOWL FIRST
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
