'use client';

import { create } from 'zustand';

const STORAGE_KEY = 'oddoreve-player';

export interface PlayerProfile {
  id: string;
  name: string;
  username?: string;
  gamesPlayed: number;
  gamesWon: number;
  createdAt: string;
}

function generatePlayerId(): string {
  return `oe_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
}

function getStoredProfile(): PlayerProfile | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw) as PlayerProfile;
  } catch {}
  return null;
}

function saveProfile(profile: PlayerProfile) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(profile));
  } catch {}
}

interface PlayerProfileStore {
  profile: PlayerProfile | null;
  initProfile: () => void;
  createProfile: (name: string, username?: string) => PlayerProfile;
  updateName: (name: string) => void;
  recordGame: (won: boolean) => void;
  clearProfile: () => void;
}

export const usePlayerProfile = create<PlayerProfileStore>((set, get) => ({
  profile: null,

  initProfile: () => {
    if (get().profile) return;
    const existing = getStoredProfile();
    if (existing) {
      set({ profile: existing });
    }
  },

  createProfile: (name: string, username?: string) => {
    const newProfile: PlayerProfile = {
      id: generatePlayerId(),
      name: name.trim() || 'Player',
      username: username?.trim() || name.trim().toLowerCase().replace(/\s+/g, ''),
      gamesPlayed: 0,
      gamesWon: 0,
      createdAt: new Date().toISOString(),
    };
    saveProfile(newProfile);
    set({ profile: newProfile });
    return newProfile;
  },

  updateName: (name: string) => {
    const current = get().profile;
    if (!current) return;
    const updated = { ...current, name: name.trim() || 'Player' };
    saveProfile(updated);
    set({ profile: updated });
  },

  recordGame: (won: boolean) => {
    const current = get().profile;
    if (!current) return;
    const updated = {
      ...current,
      gamesPlayed: current.gamesPlayed + 1,
      gamesWon: current.gamesWon + (won ? 1 : 0),
    };
    saveProfile(updated);
    set({ profile: updated });
  },

  clearProfile: () => {
    if (typeof window !== 'undefined') {
      localStorage.removeItem(STORAGE_KEY);
    }
    set({ profile: null });
  },
}));
