'use client';

import React, { useState, useEffect } from 'react';
import { RoomManager, RoomState } from '@/multiplayer/roomManager';
import { createCommitment, generateNonce } from '@/multiplayer/commitment';
import { GameMode, GameFormat, ThrowValue } from '@/engine/types';
import { Users, Wifi, Copy, Check, Play, AlertCircle } from 'lucide-react';

interface MultiplayerLobbyProps {
  onStartRoomGame: (room: RoomManager) => void;
}

export function MultiplayerLobby({ onStartRoomGame }: MultiplayerLobbyProps) {
  const [roomCode, setRoomCode] = useState('');
  const [playerName, setPlayerName] = useState('Player 1');
  const [roomManager, setRoomManager] = useState<RoomManager | null>(null);
  const [roomState, setRoomState] = useState<RoomState | null>(null);
  const [copied, setCopied] = useState(false);
  const [isJoining, setIsJoining] = useState(false);

  // Poll room state locally when room exists
  useEffect(() => {
    if (!roomManager) return;
    const interval = setInterval(() => {
      setRoomState({ ...roomManager.getRoomState() });
    }, 500);
    return () => clearInterval(interval);
  }, [roomManager]);

  const handleCreateRoom = () => {
    const code = Math.random().toString(36).substring(2, 7).toUpperCase();
    const manager = new RoomManager(code, 'player_host', playerName || 'Host');
    setRoomManager(manager);
    setRoomState(manager.getRoomState());
  };

  const handleJoinSimulatedFriend = () => {
    if (!roomManager) return;
    roomManager.joinRoom('player_friend', 'Friend Bob');
    setRoomState({ ...roomManager.getRoomState() });
  };

  const handleCopyCode = () => {
    if (!roomState) return;
    navigator.clipboard?.writeText(roomState.roomCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="w-full max-w-2xl mx-auto bg-slate-900/90 border border-slate-800 rounded-3xl p-6 md:p-8 backdrop-blur shadow-2xl">
      <div className="flex items-center justify-between pb-4 border-b border-slate-800 mb-6">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-2xl bg-cyan-950 text-cyan-400 border border-cyan-800/60">
            <Wifi className="w-6 h-6 animate-pulse" />
          </div>
          <div>
            <h2 className="text-xl font-black text-white">Online Multiplayer Lobby</h2>
            <p className="text-xs text-slate-400">
              WebRTC Video + Cryptographic Anti-Cheat Throw Commitments
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-950 text-emerald-400 border border-emerald-800">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
          PartyKit / WebRTC Ready
        </div>
      </div>

      {!roomState ? (
        <div className="space-y-6">
          <div>
            <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">
              Your Player Name
            </label>
            <input
              type="text"
              value={playerName}
              onChange={(e) => setPlayerName(e.target.value)}
              className="w-full px-4 py-3 rounded-2xl bg-slate-950 border border-slate-800 text-white font-semibold focus:outline-none focus:border-cyan-500"
              placeholder="Enter your name"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <button
              onClick={handleCreateRoom}
              className="py-4 px-6 rounded-2xl font-black text-white bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 shadow-xl shadow-cyan-600/30 transition-all active:scale-95"
            >
              CREATE NEW ROOM
            </button>

            <button
              onClick={() => setIsJoining(true)}
              className="py-4 px-6 rounded-2xl font-black text-white bg-slate-800 hover:bg-slate-700 border border-slate-700 transition-all active:scale-95"
            >
              JOIN WITH CODE
            </button>
          </div>

          {isJoining && (
            <div className="p-4 rounded-2xl bg-slate-950/80 border border-slate-800 flex gap-2">
              <input
                type="text"
                placeholder="Enter 5-character Room Code"
                value={roomCode}
                onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
                className="flex-1 px-4 py-2 bg-slate-900 border border-slate-700 rounded-xl text-white font-mono uppercase"
              />
              <button
                onClick={() => {
                  const manager = new RoomManager(roomCode || 'ROOM', 'player_guest', playerName || 'Guest');
                  setRoomManager(manager);
                  setRoomState(manager.getRoomState());
                }}
                className="px-5 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white font-bold"
              >
                Join
              </button>
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-6">
          {/* Room Code Card */}
          <div className="flex items-center justify-between p-4 rounded-2xl bg-slate-950 border border-cyan-500/30">
            <div>
              <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                Share Room Code with Friend
              </div>
              <div className="text-3xl font-black text-cyan-400 font-mono tracking-widest mt-0.5">
                {roomState.roomCode}
              </div>
            </div>
            <button
              onClick={handleCopyCode}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold bg-cyan-950 hover:bg-cyan-900 text-cyan-300 border border-cyan-800"
            >
              {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
              <span>{copied ? 'Copied!' : 'Copy Code'}</span>
            </button>
          </div>

          {/* Lobby Settings (Host Control) */}
          <div className="p-4 rounded-2xl bg-slate-950/60 border border-slate-800 space-y-3">
            <div className="text-xs font-bold text-slate-300 uppercase">Host Match Settings</div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <span className="text-[11px] text-slate-400">Game Mode:</span>
                <div className="flex gap-2 mt-1">
                  <button
                    onClick={() => roomManager?.setConfig('cricket', roomState.format, roomState.maxOvers)}
                    className={`flex-1 py-1.5 rounded-lg text-xs font-bold border ${
                      roomState.mode === 'cricket'
                        ? 'bg-cyan-600 text-white border-cyan-400'
                        : 'bg-slate-800 text-slate-300 border-slate-700'
                    }`}
                  >
                    🏏 Cricket
                  </button>
                  <button
                    onClick={() => roomManager?.setConfig('baseball', roomState.format, roomState.maxOvers)}
                    className={`flex-1 py-1.5 rounded-lg text-xs font-bold border ${
                      roomState.mode === 'baseball'
                        ? 'bg-amber-600 text-white border-amber-400'
                        : 'bg-slate-800 text-slate-300 border-slate-700'
                    }`}
                  >
                    ⚾ Baseball
                  </button>
                </div>
              </div>

              <div>
                <span className="text-[11px] text-slate-400">Format:</span>
                <div className="flex gap-2 mt-1">
                  <button
                    onClick={() => roomManager?.setConfig(roomState.mode, '1v1', 2)}
                    className={`flex-1 py-1.5 rounded-lg text-xs font-bold border ${
                      roomState.format === '1v1'
                        ? 'bg-indigo-600 text-white border-indigo-400'
                        : 'bg-slate-800 text-slate-300 border-slate-700'
                    }`}
                  >
                    1v1
                  </button>
                  <button
                    onClick={() => roomManager?.setConfig(roomState.mode, '2v2', 2)}
                    className={`flex-1 py-1.5 rounded-lg text-xs font-bold border ${
                      roomState.format === '2v2'
                        ? 'bg-indigo-600 text-white border-indigo-400'
                        : 'bg-slate-800 text-slate-300 border-slate-700'
                    }`}
                  >
                    2v2 (2 Overs)
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Players in Room */}
          <div>
            <div className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">
              Players Connected ({Object.keys(roomState.players).length}/{roomState.format === '2v2' ? 4 : 2})
            </div>
            <div className="space-y-2">
              {Object.values(roomState.players).map((p) => (
                <div
                  key={p.id}
                  className="flex items-center justify-between p-3 rounded-xl bg-slate-950 border border-slate-800"
                >
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
                    <span className="font-bold text-sm text-white">{p.name}</span>
                    {p.isHost && (
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-cyan-950 text-cyan-300 border border-cyan-800">
                        Host
                      </span>
                    )}
                  </div>
                  <span className="text-xs text-slate-400 uppercase font-semibold">
                    {p.teamId === 'team_a' ? 'Team A' : 'Team B'}
                  </span>
                </div>
              ))}
            </div>

            {Object.keys(roomState.players).length < 2 && (
              <button
                onClick={handleJoinSimulatedFriend}
                className="mt-3 w-full py-2.5 rounded-xl border border-dashed border-cyan-500/40 text-xs font-bold text-cyan-400 hover:bg-cyan-950/20"
              >
                + Simulate Peer Connection (2nd Player Join)
              </button>
            )}
          </div>

          {/* Start Match CTA */}
          <button
            onClick={() => {
              if (roomManager) {
                roomManager.startMatch();
                onStartRoomGame(roomManager);
              }
            }}
            className="w-full py-4 rounded-2xl font-black text-lg bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 shadow-xl shadow-emerald-500/30 transition-all active:scale-95 flex items-center justify-center gap-2"
          >
            <Play className="w-5 h-5 fill-current" />
            <span>LAUNCH MULTIPLAYER MATCH</span>
          </button>
        </div>
      )}
    </div>
  );
}
