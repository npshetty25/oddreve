'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Copy, Check, Send, Users, Play, ArrowLeft, QrCode } from 'lucide-react';
import { ServerRoom } from '@/app/api/rooms/route';

interface MultiplayerLobbyProps {
  initialRoomCode?: string | null;
  playerName: string;
  onStartMatch: (room: ServerRoom, playerId: string) => void;
  onBack: () => void;
}

export function MultiplayerLobby({
  initialRoomCode,
  playerName,
  onStartMatch,
  onBack,
}: MultiplayerLobbyProps) {
  const [mode, setMode] = useState<'create' | 'join'>(initialRoomCode ? 'join' : 'create');
  const [joinCodeInput, setJoinCodeInput] = useState(initialRoomCode || '');
  const [currentRoom, setCurrentRoom] = useState<ServerRoom | null>(null);
  const [myPlayerId, setMyPlayerId] = useState<string>('');
  const [copied, setCopied] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [chatInput, setChatInput] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const pollIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Poll room updates every 600ms once inside a room
  useEffect(() => {
    if (!currentRoom?.code) return;

    const fetchRoom = async () => {
      try {
        const res = await fetch(`/api/rooms/${currentRoom.code}`);
        const data = await res.json();
        if (data.success && data.room) {
          setCurrentRoom(data.room);
          // If host started match, trigger start for guest!
          if (data.room.stage === 'playing') {
            onStartMatch(data.room, myPlayerId);
          }
        }
      } catch (e) {
        // network retry
      }
    };

    pollIntervalRef.current = setInterval(fetchRoom, 600);
    return () => {
      if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
    };
  }, [currentRoom?.code, myPlayerId, onStartMatch]);

  // Create Room
  const handleCreateRoom = async () => {
    setIsSubmitting(true);
    setErrorMsg(null);
    try {
      const res = await fetch('/api/rooms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ playerName: playerName || 'Host', mode: 'cricket', format: '1v1' }),
      });
      const data = await res.json();
      if (data.success) {
        setCurrentRoom(data.room);
        setMyPlayerId(data.playerId);
      } else {
        setErrorMsg(data.error || 'Failed to create room');
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to connect');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Join Room
  const handleJoinRoom = async (codeToJoin: string) => {
    const trimmed = codeToJoin.trim().toLowerCase();
    if (!trimmed) {
      setErrorMsg('Please enter a room code');
      return;
    }
    setIsSubmitting(true);
    setErrorMsg(null);
    try {
      const playerId = `player_${Date.now().toString(36)}`;
      const res = await fetch(`/api/rooms/${trimmed}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'join', playerId, playerName: playerName || 'Friend' }),
      });
      const data = await res.json();
      if (data.success) {
        setCurrentRoom(data.room);
        setMyPlayerId(data.playerId || playerId);
      } else {
        setErrorMsg(data.error || 'Room not found or full');
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to join room');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Auto-join if initialRoomCode was provided in URL
  useEffect(() => {
    if (initialRoomCode && !currentRoom) {
      handleJoinRoom(initialRoomCode);
    }
  }, [initialRoomCode]);

  // Copy direct game link
  const handleCopyLink = () => {
    if (!currentRoom) return;
    const shareUrl = `${window.location.origin}?room=${currentRoom.code}`;
    navigator.clipboard?.writeText(shareUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Send Chat Message
  const handleSendChat = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInput.trim() || !currentRoom) return;
    const text = chatInput.trim();
    setChatInput('');
    try {
      await fetch(`/api/rooms/${currentRoom.code}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'chat',
          sender: playerName || 'Player',
          text,
        }),
      });
    } catch (e) {
      // ignore
    }
  };

  // Host starts the match
  const handleStartMatchHost = async () => {
    if (!currentRoom) return;
    setIsSubmitting(true);
    try {
      const res = await fetch(`/api/rooms/${currentRoom.code}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'start' }),
      });
      const data = await res.json();
      if (data.success) {
        onStartMatch(data.room, myPlayerId);
      } else {
        setErrorMsg(data.error || 'Could not start match');
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to start');
    } finally {
      setIsSubmitting(false);
    }
  };

  // 1. Initial State: Choose Create or Join Room
  if (!currentRoom) {
    return (
      <div className="w-full max-w-xl mx-auto bg-white border-4 border-black shadow-[8px_8px_0_0_#000] p-6 animate-slide-up select-none">
        <div className="flex items-center justify-between pb-3 border-b-3 border-black mb-5">
          <button onClick={onBack} className="nb-btn nb-btn--ghost nb-btn--sm flex items-center gap-1">
            <ArrowLeft className="w-4 h-4" />
            <span>BACK</span>
          </button>
          <span className="font-display text-base uppercase font-black text-black">
            PLAY WITH A FRIEND
          </span>
          <div className="w-8" />
        </div>

        {errorMsg && (
          <div className="mb-4 p-2.5 bg-[#ff3b30] text-white border-2 border-black font-num text-xs font-bold shadow-[2px_2px_0_0_#000]">
            ⚠️ {errorMsg}
          </div>
        )}

        <div className="flex gap-2 mb-6">
          <button
            onClick={() => {
              setMode('create');
              setErrorMsg(null);
            }}
            className={`flex-1 py-2.5 font-display text-sm font-black uppercase border-3 border-black transition-all shadow-[3px_3px_0_0_#000] ${
              mode === 'create' ? 'bg-[#ffd60a] text-black' : 'bg-neutral-100 text-neutral-600'
            }`}
          >
            CREATE ROOM
          </button>
          <button
            onClick={() => {
              setMode('join');
              setErrorMsg(null);
            }}
            className={`flex-1 py-2.5 font-display text-sm font-black uppercase border-3 border-black transition-all shadow-[3px_3px_0_0_#000] ${
              mode === 'join' ? 'bg-[#a3f23d] text-black' : 'bg-neutral-100 text-neutral-600'
            }`}
          >
            JOIN ROOM
          </button>
        </div>

        {mode === 'create' ? (
          <div className="space-y-4 text-center">
            <div className="p-4 bg-[#f5f0e1] border-2 border-black text-left">
              <span className="font-num text-xs font-bold text-[#444] uppercase block mb-1">
                HOST NAME
              </span>
              <span className="font-display text-lg text-black">{playerName || 'You'}</span>
            </div>
            <p className="font-body text-xs text-[#555]">
              Creates a private room with a shareable invite code and link. Your friend can join from any phone or computer!
            </p>
            <button
              onClick={handleCreateRoom}
              disabled={isSubmitting}
              className="nb-btn nb-btn--yellow w-full py-3.5 text-base border-3"
            >
              {isSubmitting ? 'CREATING ROOM...' : 'CREATE ROOM & GET LINK'}
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            <div>
              <label className="block font-num text-xs font-bold uppercase text-black mb-1.5">
                ENTER 6-DIGIT ROOM CODE
              </label>
              <input
                type="text"
                value={joinCodeInput}
                onChange={(e) => setJoinCodeInput(e.target.value.toLowerCase())}
                placeholder="e.g. fs9mcg"
                className="w-full border-3 border-black p-3 font-mono text-lg uppercase bg-white text-black font-bold focus:outline-none shadow-[2px_2px_0_0_#000]"
                maxLength={8}
                autoFocus
              />
            </div>
            <button
              onClick={() => handleJoinRoom(joinCodeInput)}
              disabled={isSubmitting}
              className="nb-btn nb-btn--lime w-full py-3 text-base border-3"
            >
              {isSubmitting ? 'JOINING ROOM...' : 'JOIN FRIEND\'S ROOM →'}
            </button>
          </div>
        )}
      </div>
    );
  }

  // 2. Active Lobby State (Replicating User's Wordle Multiplayer Layout from Image 1)
  const isHost = currentRoom.hostId === myPlayerId;
  const shareUrl = typeof window !== 'undefined' ? `${window.location.origin}?room=${currentRoom.code}` : '';
  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=160x160&data=${encodeURIComponent(shareUrl)}`;

  return (
    <div className="w-full max-w-4xl mx-auto bg-[#1e1b4b] border-4 border-black shadow-[10px_10px_0_0_#000] p-4 sm:p-6 text-white animate-slide-up select-none">
      {/* Top Header */}
      <div className="flex items-center justify-between pb-3 border-b-2 border-white/20 mb-4">
        <button
          onClick={() => {
            setCurrentRoom(null);
            onBack();
          }}
          className="px-3 py-1 bg-white/10 hover:bg-white/20 border-2 border-white text-xs font-display uppercase tracking-wider cursor-pointer"
        >
          ← EXIT LOBBY
        </button>
        <div className="flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full bg-[#a3f23d] animate-ping" />
          <span className="font-num text-xs uppercase font-bold text-white/90">
            ROOM: {currentRoom.code}
          </span>
        </div>
      </div>

      {errorMsg && (
        <div className="mb-4 p-2 bg-red-600 border border-white text-xs font-bold">
          {errorMsg}
        </div>
      )}

      {/* 3-Column Layout Matching Image 1 */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-start">
        {/* Left Column: Share Key / QR Code / Room Code / Copy Link */}
        <div className="md:col-span-4 bg-white/5 border-2 border-white/20 p-4 space-y-3.5">
          <h3 className="font-display text-sm uppercase tracking-wider text-white/90">
            Share Key
          </h3>

          {/* QR Code Container */}
          <div className="w-40 h-40 mx-auto bg-white p-2 border-3 border-black shadow-[3px_3px_0_0_#000] flex items-center justify-center">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={qrUrl}
              alt="Scan QR code to join room"
              className="w-full h-full object-contain"
            />
          </div>

          <div>
            <span className="text-[11px] font-num uppercase text-white/70 block">
              Room Code
            </span>
            <span className="font-mono text-3xl font-black text-[#ffd60a] tracking-wider block">
              {currentRoom.code}
            </span>
          </div>

          {/* Yellow Copy Link Button Matching Image 1 */}
          <button
            onClick={handleCopyLink}
            className="w-full py-2.5 bg-[#eab308] hover:bg-[#ca8a04] text-black border-2 border-black font-display text-xs font-black uppercase flex items-center justify-center gap-2 shadow-[2px_2px_0_0_#000] cursor-pointer"
          >
            {copied ? <Check className="w-4 h-4 text-black" /> : <Copy className="w-4 h-4 text-black" />}
            <span>{copied ? 'LINK COPIED!' : 'COPY LINK'}</span>
          </button>

          <div className="pt-1 text-[11px] font-num text-white/70">
            Mode: <strong className="text-white">Competitive</strong>
            <p className="text-[10px] text-white/50 mt-0.5">Hand Cricket 1v1</p>
          </div>
        </div>

        {/* Middle Column: Status / Waiting for Players / Start Match CTA */}
        <div className="md:col-span-5 flex flex-col items-center justify-center min-h-[260px] p-4 text-center bg-white/5 border-2 border-white/20 space-y-4">
          <div className="text-3xl animate-bounce">🏏</div>

          {currentRoom.players.length < 2 ? (
            <div className="space-y-1.5">
              <h2 className="font-display text-2xl font-black text-white">
                Waiting for players...
              </h2>
              <p className="font-body text-xs text-white/70 max-w-xs">
                Competitive mode requires 2 players. Share the link or room code with your friend!
              </p>
            </div>
          ) : (
            <div className="space-y-3 w-full">
              <div className="p-3 bg-[#a3f23d] text-black border-2 border-black shadow-[3px_3px_0_0_#000]">
                <h2 className="font-display text-xl font-black">
                  BOTH PLAYERS CONNECTED!
                </h2>
                <p className="font-num text-xs font-bold mt-0.5">
                  {currentRoom.players[0].name} vs {currentRoom.players[1].name}
                </p>
              </div>

              {isHost ? (
                <button
                  onClick={handleStartMatchHost}
                  disabled={isSubmitting}
                  className="w-full py-3 bg-[#ffd60a] hover:bg-[#eab308] text-black border-3 border-black font-display text-base font-black uppercase shadow-[4px_4px_0_0_#000] cursor-pointer flex items-center justify-center gap-2"
                >
                  <Play className="w-5 h-5 fill-current" />
                  <span>START MATCH NOW</span>
                </button>
              ) : (
                <div className="p-3 bg-white/10 border border-white/30 text-xs font-num font-bold text-white/90">
                  Waiting for host to start the match...
                </div>
              )}
            </div>
          )}
        </div>

        {/* Right Column: Players List & Live Chat Matching Image 1 */}
        <div className="md:col-span-3 space-y-3">
          {/* Players Card */}
          <div className="bg-white/5 border-2 border-white/20 p-3">
            <div className="font-num text-xs font-bold uppercase text-white/70 mb-2">
              Players ({currentRoom.players.length})
            </div>
            <div className="space-y-1.5">
              {currentRoom.players.map((p) => (
                <div
                  key={p.id}
                  className="flex items-center gap-2 px-2.5 py-1.5 bg-white/10 border border-white/20 font-num text-xs font-bold"
                >
                  <span className="w-2 h-2 rounded-full bg-[#a3f23d]" />
                  <span className="truncate">
                    {p.name} {p.id === myPlayerId ? '(You)' : ''}
                  </span>
                </div>
              ))}
              {currentRoom.players.length < 2 && (
                <div className="flex items-center gap-2 px-2.5 py-1.5 bg-white/5 border border-dashed border-white/20 font-num text-xs text-white/40">
                  <span className="w-2 h-2 rounded-full bg-white/30" />
                  <span>Waiting...</span>
                </div>
              )}
            </div>
          </div>

          {/* Chat Box Matching Image 1 */}
          <div className="bg-white/5 border-2 border-white/20 p-3 flex flex-col h-56">
            <div className="text-[11px] font-num uppercase text-white/60 mb-1">
              Room Chat
            </div>
            <div className="flex-1 overflow-y-auto space-y-1.5 pr-1 font-body text-xs text-left mb-2">
              {currentRoom.chat.map((msg, idx) => (
                <div key={idx} className="leading-snug">
                  <span className="font-bold text-[#ffd60a]">{msg.sender}: </span>
                  <span className="text-white/90">{msg.text}</span>
                </div>
              ))}
            </div>

            <form onSubmit={handleSendChat} className="flex gap-1 mt-auto">
              <input
                type="text"
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                placeholder="Chat..."
                className="flex-1 px-2 py-1 bg-white/10 border border-white/30 text-xs text-white focus:outline-none"
              />
              <button
                type="submit"
                className="px-2.5 py-1 bg-[#eab308] hover:bg-[#ca8a04] text-black font-num text-xs font-black uppercase cursor-pointer"
              >
                Send
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
