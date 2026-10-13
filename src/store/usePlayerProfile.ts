'use client';

import { useState, useEffect, useCallback } from 'react';

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
  localStorage.setItem(STORAGE_KEY, JSON.stringify(profile));
}

export function usePlayerProfile() {
  const [profile, setProfile] = useState<PlayerProfile | null>(null);

  useEffect(() => {
    const existing = getStoredProfile();
    if (existing) {
      setProfile(existing);
    }
  }, []);

  const createProfile = useCallback((name: string, username?: string) => {
    const newProfile: PlayerProfile = {
      id: generatePlayerId(),
      name: name.trim() || 'Player',
      username: username?.trim() || name.trim().toLowerCase().replace(/\s+/g, ''),
      gamesPlayed: 0,
      gamesWon: 0,
      createdAt: new Date().toISOString(),
    };
    saveProfile(newProfile);
    setProfile(newProfile);
    return newProfile;
  }, []);

  const updateName = useCallback((name: string) => {
    if (!profile) return;
    const updated = { ...profile, name: name.trim() || 'Player' };
    saveProfile(updated);
    setProfile(updated);
  }, [profile]);

  const recordGame = useCallback((won: boolean) => {
    if (!profile) return;
    const updated = {
      ...profile,
      gamesPlayed: profile.gamesPlayed + 1,
      gamesWon: profile.gamesWon + (won ? 1 : 0),
    };
    saveProfile(updated);
    setProfile(updated);
  }, [profile]);

  const clearProfile = useCallback(() => {
    localStorage.removeItem(STORAGE_KEY);
    setProfile(null);
  }, []);

  return { profile, createProfile, updateName, recordGame, clearProfile };
}
