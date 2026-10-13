'use client';

import React from 'react';
import { MatchState, ThrowValue, TossCall, TossChoice } from '@/engine/types';

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
    <div className="w-full max-w-xl mx-auto nb-card bg-[var(--bg-secondary)] overflow-hidden animate-slide-up">
      {/* Window title bar */}
      <div className="nb-win-bar">
        <div className="nb-dots"><i /><i /><i /></div>
        <span className="font-num text-xs uppercase font-bold tracking-wider text-[var(--text-secondary)]">
          The Toss — {match.mode === 'cricket' ? '🏏' : '⚾'} {match.format}
        </span>
      </div>

      <div className="p-6 sm:p-8">
        {/* Step 1: Call Odd or Even */}
        {match.phase === 'toss_call' && (
          <div className="text-center space-y-6">
            <div>
              <h2 className="font-display text-2xl sm:text-3xl text-[var(--text-primary)] mb-2">
                ODD OR EVEN?
              </h2>
              <p className="font-body text-sm text-[var(--text-secondary)] max-w-md mx-auto">
                <strong className="text-[var(--text-primary)]">{callerTeam.name}</strong>, make your call. Both players throw 0–6 to decide who bats or bowls.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-4 max-w-sm mx-auto">
              <button
                onClick={() => onCallToss(callerTeam.id, 'odd')}
                className="nb-btn nb-btn--yellow text-lg"
              >
                ODD
              </button>
              <button
                onClick={() => onCallToss(callerTeam.id, 'even')}
                className="nb-btn nb-btn--pink text-lg"
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
              <h2 className="font-display text-xl sm:text-2xl text-[var(--text-primary)] mb-1">
                SHOW YOUR HAND
              </h2>
              <p className="font-body text-xs text-[var(--text-secondary)]">
                {callerTeam.name} called <strong className="font-display text-[var(--accent-yellow)]">{toss.call?.toUpperCase()}</strong>. 
                Throw 0–6 via camera or buttons.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="p-4 bg-[var(--bg-primary)] border-3 border-[var(--border-color)] text-center shadow-[3px_3px_0_0_var(--shadow-color)]">
                <div className="font-num text-[10px] uppercase font-bold text-[var(--text-muted)] tracking-wider mb-1">
                  {match.teamA.name}
                </div>
                <div className="font-display text-3xl text-[var(--text-primary)]">
                  {pendingThrows.teamA !== null ? pendingThrows.teamA : '...'}
                </div>
              </div>

              <div className="p-4 bg-[var(--bg-primary)] border-3 border-[var(--border-color)] text-center shadow-[3px_3px_0_0_var(--shadow-color)]">
                <div className="font-num text-[10px] uppercase font-bold text-[var(--text-muted)] tracking-wider mb-1">
                  {match.teamB.name}
                </div>
                <div className="font-display text-3xl text-[var(--text-primary)]">
                  {pendingThrows.teamB !== null ? pendingThrows.teamB : '...'}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Step 3: Toss Result */}
        {match.phase === 'toss_result' && winnerTeam && (
          <div className="text-center space-y-6 animate-bounce-in">
            <div className="p-4 bg-[var(--accent-lime)] border-3 border-[var(--border-color)] shadow-[4px_4px_0_0_var(--shadow-color)]">
              <div className="font-num text-xs uppercase font-bold text-black tracking-wider mb-1">
                Toss Resolved
              </div>
              <div className="font-body text-sm text-black">
                {match.teamA.name} ({toss.teamAThrow}) + {match.teamB.name} ({toss.teamBThrow}) ={' '}
                <strong className="font-display text-lg">
                  {(toss.teamAThrow ?? 0) + (toss.teamBThrow ?? 0)}
                </strong>{' '}
                ({((toss.teamAThrow ?? 0) + (toss.teamBThrow ?? 0)) % 2 === 0 ? 'EVEN' : 'ODD'})
              </div>
              <div className="font-display text-xl text-black mt-2">
                🎉 {winnerTeam.name} WON THE TOSS!
              </div>
            </div>

            <div>
              <p className="font-display text-xs text-[var(--text-muted)] uppercase tracking-wider mb-3">
                {winnerTeam.name}, what will you choose?
              </p>
              <div className="grid grid-cols-2 gap-4 max-w-sm mx-auto">
                <button
                  onClick={() => onChooseToss('bat')}
                  className="nb-btn nb-btn--yellow text-base"
                >
                  BAT FIRST
                </button>
                <button
                  onClick={() => onChooseToss('bowl')}
                  className="nb-btn nb-btn--blue text-base"
                >
                  BOWL FIRST
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
