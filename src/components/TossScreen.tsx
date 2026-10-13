'use client';

import React, { useState, useEffect } from 'react';
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
  const isComputerOpponent = match.teamB.name.toLowerCase().includes('computer');
  const isComputerWinner = winnerTeam?.id === match.teamB.id && isComputerOpponent;

  const [isFlipping, setIsFlipping] = useState(false);

  // If computer won toss, auto-pick bat or bowl after 1.5s
  useEffect(() => {
    if (match.phase === 'toss_result' && isComputerWinner) {
      const timer = setTimeout(() => {
        const choice: TossChoice = Math.random() > 0.5 ? 'bat' : 'bowl';
        onChooseToss(choice);
      }, 1500);
      return () => clearTimeout(timer);
    }
  }, [match.phase, isComputerWinner, onChooseToss]);

  const tossThrows: { val: ThrowValue; emoji: string }[] = [
    { val: 1, emoji: '☝️' },
    { val: 2, emoji: '✌️' },
    { val: 3, emoji: '🤟' },
    { val: 4, emoji: '🖖' },
    { val: 5, emoji: '🖐️' },
    { val: 6, emoji: '👍' },
  ];

  return (
    <div className="w-full max-w-md mx-auto bg-white border-4 border-black shadow-[8px_8px_0_0_#000] overflow-hidden animate-slide-up select-none">
      {/* Yellow top bar */}
      <div className="bg-[#ffd60a] border-b-4 border-black px-3 py-2 flex items-center justify-between text-black">
        <div className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded-full border-2 border-black bg-white inline-block" />
          <span className="w-3 h-3 rounded-full border-2 border-black bg-white inline-block" />
          <span className="w-3 h-3 rounded-full border-2 border-black bg-white inline-block" />
        </div>
        <span className="font-num text-xs font-black uppercase tracking-wider">
          THE TOSS — {match.mode.toUpperCase()}
        </span>
        <span className="text-xs font-black">🪙</span>
      </div>

      <div className="p-5 sm:p-6 text-center">
        {/* Step 1: Call Odd or Even */}
        {match.phase === 'toss_call' && (
          <div className="space-y-4">
            <div>
              <div className="text-4xl mb-2 animate-bounce">🪙</div>
              <h2 className="font-display text-3xl font-black text-black leading-none uppercase">
                ODD OR EVEN?
              </h2>
              <p className="font-body text-xs text-[#444] mt-1.5">
                <strong>{callerTeam.name}</strong>, call odd or even! Both will throw 1–6 to decide who bats or bowls.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3 pt-2">
              <button
                onClick={() => onCallToss(callerTeam.id, 'odd')}
                className="py-3 bg-[#ffd60a] hover:bg-[#eec600] border-3 border-black font-display text-base font-black text-black uppercase shadow-[3px_3px_0_0_#000] cursor-pointer"
              >
                ODD
              </button>
              <button
                onClick={() => onCallToss(callerTeam.id, 'even')}
                className="py-3 bg-[#ff6fb5] hover:bg-[#ef5fa5] border-3 border-black font-display text-base font-black text-black uppercase shadow-[3px_3px_0_0_#000] cursor-pointer"
              >
                EVEN
              </button>
            </div>
          </div>
        )}

        {/* Step 2: Throw fingers */}
        {match.phase === 'toss_throw' && (
          <div className="space-y-4">
            <div>
              <div className="inline-block bg-[#ffd60a] border-2 border-black font-num text-[11px] font-black uppercase px-2 py-0.5 mb-2 shadow-[2px_2px_0_0_#000]">
                {callerTeam.name} CALLED {toss.call?.toUpperCase()}
              </div>
              <h2 className="font-display text-2xl font-black text-black leading-none uppercase">
                THROW YOUR NUMBER
              </h2>
              <p className="font-body text-xs text-[#555] mt-1">
                Tap 1 to 6 below or show your hand to the camera!
              </p>
            </div>

            {/* Quick toss buttons */}
            <div className="grid grid-cols-6 gap-1.5 py-1">
              {tossThrows.map(({ val, emoji }) => (
                <button
                  key={val}
                  onClick={() => {
                    setIsFlipping(true);
                    onThrowTossA(val);
                    if (isComputerOpponent) {
                      const compVal = (Math.floor(Math.random() * 6) + 1) as ThrowValue;
                      onThrowTossB(compVal);
                    }
                  }}
                  className="py-2 flex flex-col items-center justify-center bg-[#f5f0e1] hover:bg-[#a3f23d] border-2 border-black font-num text-sm transition-all shadow-[2px_2px_0_0_#000] cursor-pointer"
                >
                  <span className="text-base">{emoji}</span>
                  <span className="text-xs font-black">{val}</span>
                </button>
              ))}
            </div>

            {/* Status indicators */}
            <div className="grid grid-cols-2 gap-2 pt-1 font-num text-xs">
              <div className="p-2 border-2 border-black bg-[#f5f0e1]">
                <div className="text-[10px] text-[#666] uppercase">{match.teamA.name}</div>
                <div className="font-black text-lg">
                  {pendingThrows.teamA !== null ? `✓ ${pendingThrows.teamA}` : 'Throwing...'}
                </div>
              </div>
              <div className="p-2 border-2 border-black bg-[#f5f0e1]">
                <div className="text-[10px] text-[#666] uppercase">{match.teamB.name}</div>
                <div className="font-black text-lg">
                  {pendingThrows.teamB !== null ? `✓ ${pendingThrows.teamB}` : 'Ready'}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Step 3: Toss Result */}
        {match.phase === 'toss_result' && winnerTeam && (
          <div className="space-y-4 animate-bounce-in">
            <div className="p-4 bg-[#a3f23d] border-3 border-black shadow-[4px_4px_0_0_#000]">
              <div className="font-num text-[10px] uppercase font-black text-black mb-1">
                TOSS TOTAL
              </div>
              <div className="font-body text-xs text-black">
                {match.teamA.name} ({toss.teamAThrow}) + {match.teamB.name} ({toss.teamBThrow}) ={' '}
                <strong className="font-display text-base">
                  {(toss.teamAThrow ?? 0) + (toss.teamBThrow ?? 0)}
                </strong>{' '}
                ({((toss.teamAThrow ?? 0) + (toss.teamBThrow ?? 0)) % 2 === 0 ? 'EVEN' : 'ODD'})
              </div>
              <div className="font-display text-xl sm:text-2xl text-black mt-2 leading-tight">
                🎉 {winnerTeam.name.toUpperCase()} WON THE TOSS!
              </div>
            </div>

            {isComputerWinner ? (
              <div className="p-3 bg-[#f5f0e1] border-2 border-black font-num text-xs text-black">
                🤖 Computer is deciding to Bat or Bowl...
              </div>
            ) : (
              <div>
                <p className="font-num text-xs font-black uppercase text-black mb-2.5">
                  CHOOSE YOUR ROLE:
                </p>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    onClick={() => onChooseToss('bat')}
                    className="py-3 bg-[#ffd60a] hover:bg-[#eec600] border-3 border-black font-display text-sm font-black text-black uppercase shadow-[3px_3px_0_0_#000] cursor-pointer"
                  >
                    🏏 BAT FIRST
                  </button>
                  <button
                    onClick={() => onChooseToss('bowl')}
                    className="py-3 bg-[#3b82f6] hover:bg-[#2563eb] border-3 border-black font-display text-sm font-black text-white uppercase shadow-[3px_3px_0_0_#000] cursor-pointer"
                  >
                    🎳 BOWL FIRST
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
