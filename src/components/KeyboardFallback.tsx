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
  const validThrows: { val: ThrowValue; emoji: string }[] = [
    { val: 1, emoji: '☝️' },
    { val: 2, emoji: '✌️' },
    { val: 3, emoji: '🤟' },
    { val: 4, emoji: '🖖' },
    { val: 5, emoji: '🖐️' },
    { val: 6, emoji: '👍' },
  ];

  return (
    <div className="w-full">
      <div className="flex items-center justify-between mb-1.5">
        <span className="font-num text-[10px] uppercase font-bold tracking-wider text-[var(--text-muted)]">
          {playerLabel} — Tap 1 to 6 runs
        </span>
        <button
          type="button"
          onClick={() => onThrow(0)}
          disabled={disabled}
          className="font-num text-[9px] px-1.5 py-0.5 bg-[var(--bg-primary)] border border-[var(--border-color)] text-[var(--text-muted)] hover:text-red-500"
          title="0 triggers no-move warning (2 lives system)"
        >
          ✊ 0 (No Move)
        </button>
      </div>

      <div className="grid grid-cols-6 gap-1.5">
        {validThrows.map(({ val, emoji }) => (
          <button
            key={val}
            type="button"
            disabled={disabled}
            onClick={() => onThrow(val)}
            className={`flex flex-col items-center justify-center py-2 px-1 border-2 border-[var(--border-color)] font-num text-sm transition-all cursor-pointer ${
              selectedThrow === val
                ? 'bg-[var(--accent-lime)] text-black shadow-[2px_2px_0_0_var(--shadow-color)] -translate-y-0.5'
                : 'bg-[var(--bg-primary)] text-[var(--text-primary)] hover:bg-[var(--accent-yellow)] hover:-translate-y-0.5 shadow-[2px_2px_0_0_var(--shadow-color)]'
            } ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
          >
            <span className="text-lg leading-tight">{emoji}</span>
            <span className="text-xs font-black leading-tight">{val}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
