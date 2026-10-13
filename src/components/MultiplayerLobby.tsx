'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Copy, Check, Play, ArrowLeft } from 'lucide-react';
import { ServerRoom } from '@/app/api/rooms/route';
import { GameMode, GameFormat } from '@/engine/types';

interface MultiplayerLobbyProps {
  initialRoomCode?: string | null;
  playerName: string;
  gameMode: GameMode;
  gameFormat: GameFormat;
  onStartMatch: (room: ServerRoom, playerId: string) => void;
  onBack: () => void;
}

export function MultiplayerLobby({
  initialRoomCode,
  playerName,
  gameMode,
  gameFormat,
  onStartMatch,
  onBack,
}: MultiplayerLobbyProps) {
  const [lobbyView, setLobbyView] = useState<'choose' | 'create' | 'join'>(
    initialRoomCode ? 'join' : 'choose'
  );
  const [joinCodeInput, setJoinCodeInput] = useState(initialRoomCode || '');
  const [currentRoom, setCurrentRoom] = useState<ServerRoom | null>(null);
  const [myPlayerId, setMyPlayerId] = useState<string>('');
  const [copied, setCopied] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
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
        body: JSON.stringify({
          playerName: playerName || 'Host',
          mode: gameMode,
          format: gameFormat,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setCurrentRoom(data.room);
        setMyPlayerId(data.playerId);
        setLobbyView('create'); // switch to "waiting" view
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
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialRoomCode]);

  // Copy direct game link
  const handleCopyLink = () => {
    if (!currentRoom) return;
    const shareUrl = `${window.location.origin}?room=${currentRoom.code}`;
    navigator.clipboard?.writeText(shareUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
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

  const modeLabel = gameMode === 'cricket' ? '🏏 Hand Cricket' : '⚾ Baseball';
  const formatLabel = gameFormat === '2v2' ? '2v2' : '1v1';

  /* ─── CHOOSE: Create or Join ─── */
  if (!currentRoom) {
    return (
      <div className="flex flex-col h-full w-full items-center justify-center p-4 select-none">
        <div className="w-full max-w-sm bg-white border-4 border-black shadow-[6px_6px_0_0_#000] overflow-hidden animate-slide-up">
          {/* Header bar */}
          <div className="bg-[#a3f23d] border-b-4 border-black px-4 py-2 flex items-center justify-between">
            <button onClick={onBack} className="flex items-center gap-1 font-num text-xs font-black uppercase text-black hover:opacity-70">
              <ArrowLeft className="w-3.5 h-3.5" /> BACK
            </button>
            <span className="font-display text-sm font-black uppercase text-black tracking-wide">
              PLAY WITH FRIEND
            </span>
            <div className="w-14" />
          </div>

          {/* Mode badge */}
          <div className="flex items-center gap-2 px-4 py-2 bg-[#ffd60a] border-b-2 border-black">
            <span className="font-num text-[11px] font-black text-black uppercase">{modeLabel} · {formatLabel}</span>
          </div>

          {errorMsg && (
            <div className="mx-4 mt-3 p-2 bg-[#ff3b30] text-white border-2 border-black font-num text-xs font-bold shadow-[2px_2px_0_0_#000]">
              ⚠️ {errorMsg}
            </div>
          )}

          <div className="p-5 space-y-3">
            {lobbyView === 'choose' ? (
              <>
                <button
                  onClick={() => { setLobbyView('create'); handleCreateRoom(); }}
                  className="w-full py-4 bg-[#ffd60a] border-3 border-black font-display text-base font-black uppercase shadow-[4px_4px_0_0_#000] hover:translate-y-[1px] hover:shadow-[3px_3px_0_0_#000] transition-all cursor-pointer"
                >
                  🏠 CREATE ROOM
                  <div className="text-[11px] font-num font-normal mt-0.5 text-[#555]">Get a code to share with your friend</div>
                </button>
                <button
                  onClick={() => { setLobbyView('join'); }}
                  className="w-full py-4 bg-[#a3f23d] border-3 border-black font-display text-base font-black uppercase shadow-[4px_4px_0_0_#000] hover:translate-y-[1px] hover:shadow-[3px_3px_0_0_#000] transition-all cursor-pointer"
                >
                  🔗 JOIN ROOM
                  <div className="text-[11px] font-num font-normal mt-0.5 text-[#555]">Enter your friend's room code</div>
                </button>
              </>
            ) : lobbyView === 'join' ? (
              <div className="space-y-3">
                <div>
                  <label className="block font-num text-xs font-black uppercase text-black mb-1.5">
                    ENTER ROOM CODE
                  </label>
                  <input
                    type="text"
                    value={joinCodeInput}
                    onChange={(e) => setJoinCodeInput(e.target.value.toLowerCase())}
                    onKeyDown={(e) => e.key === 'Enter' && handleJoinRoom(joinCodeInput)}
                    placeholder="e.g. fs9mcg"
                    className="w-full border-3 border-black p-3 font-mono text-2xl uppercase bg-white text-black font-bold focus:outline-none shadow-[2px_2px_0_0_#000] tracking-widest text-center"
                    maxLength={8}
                    autoFocus
                  />
                </div>
                <button
                  onClick={() => handleJoinRoom(joinCodeInput)}
                  disabled={isSubmitting}
                  className="w-full py-3 bg-[#a3f23d] border-3 border-black font-display text-sm font-black uppercase shadow-[3px_3px_0_0_#000] cursor-pointer disabled:opacity-50"
                >
                  {isSubmitting ? 'JOINING...' : 'JOIN ROOM →'}
                </button>
                <button onClick={() => setLobbyView('choose')} className="w-full text-center font-num text-xs text-[#666] underline">
                  ← back
                </button>
              </div>
            ) : (
              /* Creating room, spinner */
              <div className="flex flex-col items-center justify-center py-6 space-y-2">
                <div className="w-8 h-8 border-4 border-black border-t-[#a3f23d] rounded-full animate-spin" />
                <span className="font-num text-xs font-black uppercase text-black">Creating room...</span>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  /* ─── ACTIVE LOBBY: Waiting for opponent ─── */
  const isHost = currentRoom.hostId === myPlayerId;
  const shareUrl = typeof window !== 'undefined' ? `${window.location.origin}?room=${currentRoom.code}` : '';
  const bothConnected = currentRoom.players.length >= 2;

  return (
    <div className="flex flex-col h-full w-full items-center justify-center p-3 select-none">
      <div className="w-full max-w-sm bg-white border-4 border-black shadow-[6px_6px_0_0_#000] overflow-hidden animate-slide-up">
        {/* Header */}
        <div className="bg-black border-b-4 border-black px-4 py-2 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-[#a3f23d] animate-ping" />
            <span className="font-num text-xs font-black text-[#a3f23d] uppercase">LIVE ROOM</span>
          </div>
          <button
            onClick={() => { setCurrentRoom(null); setLobbyView('choose'); onBack(); }}
            className="font-num text-[11px] text-white/70 hover:text-white uppercase underline cursor-pointer"
          >
            EXIT
          </button>
        </div>

        <div className="p-4 space-y-3">
          {/* Room Code */}
          <div className="bg-[#1a1a1a] border-3 border-black p-3 text-center">
            <div className="font-num text-[11px] text-[#aaa] uppercase mb-1">Room Code</div>
            <div className="font-mono text-4xl font-black text-[#ffd60a] tracking-widest">
              {currentRoom.code.toUpperCase()}
            </div>
          </div>

          {/* Copy link button */}
          <button
            onClick={handleCopyLink}
            className="w-full py-2.5 bg-[#ffd60a] border-3 border-black font-display text-sm font-black uppercase shadow-[3px_3px_0_0_#000] flex items-center justify-center gap-2 cursor-pointer hover:translate-y-[1px] hover:shadow-[2px_2px_0_0_#000] transition-all"
          >
            {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
            <span>{copied ? 'LINK COPIED!' : 'COPY INVITE LINK'}</span>
          </button>

          {/* Players */}
          <div className="space-y-2">
            {currentRoom.players.map((p, i) => (
              <div key={p.id} className={`flex items-center gap-2.5 px-3 py-2.5 border-3 border-black font-num text-sm font-black ${i === 0 ? 'bg-[#a3f23d]' : 'bg-[#4dabf7]'} text-black`}>
                <span className="w-2.5 h-2.5 rounded-full bg-black" />
                <span className="flex-1 truncate">{p.name}</span>
                {p.id === myPlayerId && <span className="text-[10px] font-num text-black/60">(YOU)</span>}
                {i === 0 && <span className="text-[10px] font-num text-black/60">HOST</span>}
              </div>
            ))}
            {!bothConnected && (
              <div className="flex items-center gap-2.5 px-3 py-2.5 border-3 border-dashed border-[#ccc] bg-[#f5f5f5] font-num text-sm text-[#aaa]">
                <span className="w-2.5 h-2.5 rounded-full border-2 border-[#ccc] bg-white animate-pulse" />
                <span>Waiting for friend...</span>
              </div>
            )}
          </div>

          {/* Mode */}
          <div className="flex items-center justify-center gap-2 px-2 py-1.5 bg-[#f5f5f5] border-2 border-black font-num text-[11px] text-black font-bold">
            <span>{modeLabel}</span>
            <span>·</span>
            <span>{formatLabel}</span>
          </div>

          {/* Start / Waiting CTA */}
          {bothConnected ? (
            isHost ? (
              <button
                onClick={handleStartMatchHost}
                disabled={isSubmitting}
                className="w-full py-3.5 bg-[#a3f23d] border-3 border-black font-display text-base font-black uppercase shadow-[4px_4px_0_0_#000] cursor-pointer disabled:opacity-50 flex items-center justify-center gap-2 hover:translate-y-[1px] hover:shadow-[3px_3px_0_0_#000] transition-all"
              >
                <Play className="w-5 h-5 fill-current" />
                <span>START MATCH!</span>
              </button>
            ) : (
              <div className="py-3 border-3 border-[#a3f23d] bg-[#f0ffd8] text-center">
                <div className="font-num text-xs font-black uppercase text-black">
                  ⏳ Waiting for host to start...
                </div>
              </div>
            )
          ) : (
            <div className="py-2 text-center font-num text-[11px] text-[#888]">
              Share the code above to invite your friend
            </div>
          )}

          {errorMsg && (
            <div className="p-2 bg-[#ff3b30] text-white border-2 border-black font-num text-xs font-bold">
              ⚠️ {errorMsg}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
