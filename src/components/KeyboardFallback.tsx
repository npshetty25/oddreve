'use client';

import React from 'react';
import { ThrowValue } from '@/engine/types';

interface KeyboardFallbackProps {
  playerLabel: string;
  onThrow: (val: ThrowValue) => void;
  disabled?: boolean;
  selectedThrow?: ThrowValue | null;
}

export function KeyboardFallback({
  playerLabel,
  onThrow,
  disabled = false,
  selectedThrow = null,
}: KeyboardFallbackProps) {
  const throws: { val: ThrowValue; label: string; sub: string }[] = [
    { val: 0, label: '0', sub: 'Fist' },
    { val: 1, label: '1', sub: 'One' },
    { val: 2, label: '2', sub: 'Peace' },
    { val: 3, label: '3', sub: 'Three' },
    { val: 4, label: '4', sub: 'Four' },
    { val: 5, label: '5', sub: 'Palm' },
    { val: 6, label: '6', sub: 'Thumb' },
  ];

  return (
    <div className="w-full cyber-card rounded-2xl p-3.5 border-slate-800">
      <div className="flex items-center justify-between mb-2">
        <span className="font-heading text-[11px] font-bold uppercase tracking-wider text-slate-300">
          {playerLabel} Quick Controls
        </span>
        <span className="font-mono text-[10px] text-slate-500">Tap or use camera</span>
      </div>

      <div className="grid grid-cols-7 gap-1.5 sm:gap-2">
        {throws.map(({ val, label, sub }) => (
          <button
            key={val}
            type="button"
            disabled={disabled}
            onClick={() => onThrow(val)}
            className={`cyber-btn flex flex-col items-center justify-center py-2 px-1 rounded-xl font-heading text-sm transition-all border ${
              selectedThrow === val
                ? 'bg-cyan-500 text-black border-cyan-300 shadow-md shadow-cyan-500/30 scale-105'
                : 'bg-slate-900/90 hover:bg-slate-800 text-slate-200 border-slate-700/60'
            }`}
          >
            <span className="text-base font-black leading-tight">{label}</span>
            <span className="text-[9px] font-mono text-slate-400 font-normal leading-tight">
              {sub}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}
