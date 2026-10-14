'use client';

import React, { useState, useEffect } from 'react';
import { useGameStore } from '@/store/useGameStore';
import { useTheme } from '@/store/useTheme';
import { usePlayerProfile } from '@/store/usePlayerProfile';
import { Scoreboard } from '@/components/Scoreboard';
import { CommentaryCard } from '@/components/CommentaryCard';
import { ServerRoom } from '@/app/api/rooms/route';
import { WebcamHandTracker } from '@/components/WebcamHandTracker';
import { KeyboardFallback } from '@/components/KeyboardFallback';
import { GameMode, GameFormat, ThrowValue, TossCall, TossChoice } from '@/engine/types';
import {
  HelpCircle,
  X,
  Users,
  Bot,
  ChevronRight,
  Keyboard,
  Copy,
  Check,
  UserPlus,
} from 'lucide-react';

/* =========================================== */
/* Screen Flow: 'landing' -> 'setup' -> 'playing' */
/* =========================================== */
type AppScreen = 'landing' | 'setup' | 'playing';
type OpponentChoice = 'friend' | 'computer';

export default function Home() {
  const {
    match,
    opponentType,
    lastBallEvent,
    pendingThrows,
    ballCycle,
    setOpponentType,
    callToss,
    chooseToss,
    setPlayerThrow,
    startSecondInnings,
    resetMatch,
    initMatch,
  } = useGameStore();

  const { theme, toggleTheme } = useTheme();
  const { profile, initProfile, createProfile, recordGame } = usePlayerProfile();

  // Initialize profile from local storage on mount
  useEffect(() => {
    initProfile();
  }, [initProfile]);

  const [screen, setScreen] = useState<AppScreen>('landing');
  const [opponentChoice, setOpponentChoice] = useState<OpponentChoice | null>(null);
  const [showHowToPlay, setShowHowToPlay] = useState(false);
  const [playerName, setPlayerName] = useState('');
  const [playerUsername, setPlayerUsername] = useState('');
  const [showNameModal, setShowNameModal] = useState(false);
  const [showTouchKeyboard, setShowTouchKeyboard] = useState(false);

  // Online Multiplayer State
  const [activeRoom, setActiveRoom] = useState<ServerRoom | null>(null);
  const [myMultiplayerId, setMyMultiplayerId] = useState<string>('');
  const [joinCodeInput, setJoinCodeInput] = useState('');
  const [isJoiningRoom, setIsJoiningRoom] = useState(false);
  const [joinError, setJoinError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [ballCooldownRemaining, setBallCooldownRemaining] = useState(0);

  // Give both players three seconds to see the result before the next ball.
  useEffect(() => {
    if (!lastBallEvent || (match.phase !== 'innings1' && match.phase !== 'innings2')) {
      setBallCooldownRemaining(0);
      return;
    }

    const cooldownEndsAt = Date.now() + 3000;
    const updateRemaining = () => {
      setBallCooldownRemaining(Math.max(0, cooldownEndsAt - Date.now()));
    };

    updateRemaining();
    const timer = window.setInterval(updateRemaining, 100);
    return () => window.clearInterval(timer);
  }, [ballCycle, lastBallEvent?.ballNumber, match.phase]);

  // Auto-detect URL ?room=code on mount and jump straight into match
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const roomCode = params.get('room');
      if (roomCode) {
        handleJoinFriendMatch(roomCode.trim().toLowerCase());
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Sync online room state every 500ms when playing in a multiplayer room
  useEffect(() => {
    if (!activeRoom || screen !== 'playing') return;

    const interval = setInterval(async () => {
      try {
        const res = await fetch(`/api/rooms/${activeRoom.code}`);
        const data = await res.json();
        if (data.success && data.room) {
          setActiveRoom(data.room);
          if (data.room.match) {
            useGameStore.setState({
              match: data.room.match,
              lastBallEvent: data.room.lastEvent,
              ballCycle: data.room.ballCycle,
              pendingThrows: data.room.pendingThrows,
            });
          }
        }
      } catch (e) {
        // network retry
      }
    }, 500);

    return () => clearInterval(interval);
  }, [activeRoom, screen]);

  // Sync profile if available
  useEffect(() => {
    if (profile) {
      setPlayerName((prev) => (prev !== profile.name ? profile.name : prev));
      setPlayerUsername((prev) => (prev !== (profile.username || '') ? profile.username || '' : prev));
    }
  }, [profile?.name, profile?.username]);

  // Record game outcome when match ends
  useEffect(() => {
    if (match.phase === 'match_over' && match.result) {
      const isUserWin = match.result.winnerTeamId === match.teamA.id;
      recordGame(isUserWin);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [match.phase, match.result, match.teamA.id]);

  const currentInnings = match.phase === 'innings2' ? match.innings2 : match.innings1;
  const isTeamABatting = currentInnings?.battingTeamId === match.teamA.id;
  const isBaseball = match.mode === 'baseball';
  const is2v2 = match.format === '2v2';

  // Determine local player and opponent identity
  const isHost = activeRoom
    ? activeRoom.players.find((p) => p.id === myMultiplayerId)?.teamId === 'team_a'
    : true;
  const myTeamId = isHost ? 'team_a' : 'team_b';

  const myName = activeRoom
    ? (isHost ? match.teamA.name : match.teamB.name)
    : (match.teamA.name === 'Team A' ? 'YOU' : match.teamA.name);
  const oppName = activeRoom
    ? (isHost ? match.teamB.name : match.teamA.name)
    : match.teamB.name;

  const myIsBatting = isHost ? isTeamABatting : !isTeamABatting;
  const oppIsBatting = !myIsBatting;

  const myThrowReady = isHost ? pendingThrows.teamA !== null : pendingThrows.teamB !== null;
  const oppThrowReady = isHost ? pendingThrows.teamB !== null : pendingThrows.teamA !== null;
  const isBallCooldown = ballCooldownRemaining > 0;

  const myThrowRequired =
    match.phase === 'toss_throw' ||
    ((match.phase === 'innings1' || match.phase === 'innings2') &&
      !isBallCooldown &&
      (isHost ? pendingThrows.teamA === null : pendingThrows.teamB === null));

  // Last throws by both sides
  const userLastThrow = lastBallEvent
    ? (isTeamABatting ? lastBallEvent.batterThrow : lastBallEvent.bowlerThrow)
    : null;
  const oppLastThrow = lastBallEvent
    ? (!isTeamABatting ? lastBallEvent.batterThrow : lastBallEvent.bowlerThrow)
    : null;
  const oppDisplayedThrow = isHost ? oppLastThrow : userLastThrow;

  // Copy shareable link
  const handleCopyInviteLink = () => {
    if (!activeRoom) return;
    const shareUrl = `${window.location.origin}?room=${activeRoom.code}`;
    navigator.clipboard?.writeText(shareUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Handlers for Local or Multiplayer Actions
  const handlePlayerThrow = async (val: ThrowValue) => {
    if (isBallCooldown) return;

    if (activeRoom) {
      const action = match.phase === 'toss_throw' ? 'toss_throw' : 'throw';
      try {
        await fetch(`/api/rooms/${activeRoom.code}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action, teamId: myTeamId, value: val }),
        });
      } catch (e) {
        // network retry
      }
    } else {
      setPlayerThrow('team_a', val);
    }
  };

  const handleCallToss = async (callerTeamId: string, call: TossCall) => {
    if (activeRoom) {
      try {
        await fetch(`/api/rooms/${activeRoom.code}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'toss_call', callerTeamId: myTeamId, call }),
        });
      } catch (e) {
        // network retry
      }
    } else {
      callToss(callerTeamId, call);
    }
  };

  const handleChooseToss = async (choice: TossChoice) => {
    if (activeRoom) {
      try {
        await fetch(`/api/rooms/${activeRoom.code}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'toss_choice', choice }),
        });
      } catch (e) {
        // network retry
      }
    } else {
      chooseToss(choice);
    }
  };

  const handleStartSecondInnings = async () => {
    if (activeRoom) {
      try {
        await fetch(`/api/rooms/${activeRoom.code}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'start_innings_2' }),
        });
      } catch (e) {
        // network retry
      }
    } else {
      startSecondInnings();
    }
  };

  const handlePlayAgain = async () => {
    if (activeRoom) {
      try {
        await fetch(`/api/rooms/${activeRoom.code}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'start' }),
        });
      } catch (e) {
        // network retry
      }
    } else {
      resetMatch();
      initMatch({ mode: match.mode, format: match.format, opponentType });
    }
  };

  // Start Offline / Computer Game
  function handleStartComputerGame(mode: GameMode, format: GameFormat) {
    const name = playerName.trim() || profile?.name || 'You';
    if (!profile) {
      createProfile(name, playerUsername);
    }
    setOpponentType('computer');
    initMatch({
      mode,
      format,
      teamAName: name,
      teamBName: 'Computer',
      opponentType: 'computer',
    });
    setScreen('playing');
  }

  // Create Room & jump straight into match screen
  async function handleCreateFriendRoom(mode: GameMode, format: GameFormat) {
    const name = playerName.trim() || profile?.name || 'You';
    if (!profile) {
      createProfile(name, playerUsername);
    }
    setJoinError(null);
    try {
      const res = await fetch('/api/rooms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ playerName: name, mode, format }),
      });
      const data = await res.json();
      if (data.success && data.room) {
        setActiveRoom(data.room);
        setMyMultiplayerId(data.playerId);
        setOpponentType('human');
        initMatch({
          mode,
          format,
          teamAName: name,
          teamBName: 'Waiting for friend...',
          opponentType: 'human',
        });
        setScreen('playing');
      } else {
        setJoinError(data.error || 'Failed to create room');
      }
    } catch (err: any) {
      setJoinError(err.message || 'Network error');
    }
  }

  // Join Existing Room
  async function handleJoinFriendMatch(code: string) {
    const trimmed = code.trim().toLowerCase();
    if (!trimmed) {
      setJoinError('Please enter a room code');
      return;
    }
    setIsJoiningRoom(true);
    setJoinError(null);
    const name = playerName.trim() || profile?.name || 'Friend';
    try {
      const playerId = `player_${Date.now().toString(36)}`;
      const res = await fetch(`/api/rooms/${trimmed}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'join', playerId, playerName: name }),
      });
      const data = await res.json();
      if (data.success && data.room) {
        setActiveRoom(data.room);
        setMyMultiplayerId(data.playerId || playerId);
        setOpponentType('human');
        initMatch({
          mode: data.room.mode,
          format: data.room.format,
          teamAName: data.room.players[0]?.name || 'Player 1',
          teamBName: name,
          opponentType: 'human',
        });
        if (data.room.match) {
          useGameStore.setState({
            match: data.room.match,
            lastBallEvent: data.room.lastEvent,
            ballCycle: data.room.ballCycle,
            pendingThrows: data.room.pendingThrows,
          });
        }
        setScreen('playing');
      } else {
        setJoinError(data.error || 'Room not found or full');
      }
    } catch (err: any) {
      setJoinError(err.message || 'Failed to join room');
    } finally {
      setIsJoiningRoom(false);
    }
  }

  function handleBackToLanding() {
    resetMatch();
    setActiveRoom(null);
    setMyMultiplayerId('');
    setScreen('landing');
    setOpponentChoice(null);
    setJoinError(null);
  }

  // ===================== LANDING PAGE =====================
  if (screen === 'landing') {
    return (
      <div className="min-h-screen flex flex-col bg-[var(--bg-primary)]">
        {/* Top Header */}
        <header className="w-full flex items-center justify-between px-4 sm:px-6 py-2.5 border-b-4 border-black bg-[var(--bg-secondary)] select-none">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-[var(--accent-lime)] border-2 border-black flex items-center justify-center shadow-[2px_2px_0_0_#000]">
              <span className="font-display text-xs text-black">OE</span>
            </div>
            <span className="font-display text-lg tracking-wider text-[var(--text-primary)]">
              ODDOREVE
            </span>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={toggleTheme}
              className="theme-toggle"
              aria-label="Toggle dark/light theme"
              title="Toggle theme"
            >
              <div className="theme-toggle-knob" />
            </button>

            <button
              onClick={() => setShowHowToPlay(true)}
              className="nb-btn nb-btn--ghost nb-btn--sm"
            >
              <HelpCircle className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">How to Play</span>
            </button>
          </div>
        </header>

        {/* Stadium Hero Area */}
        <main className="flex-1 flex flex-col justify-between">
          <div className="stadium-bg relative flex-1 flex flex-col items-center justify-center px-4 py-8 sm:py-12 min-h-[65vh]">
            {/* Stadium Pitch Markings */}
            <div className="absolute inset-y-0 w-28 sm:w-36 bg-[#d4a373] dark:bg-[#583e26] border-x-4 border-black/30 pointer-events-none opacity-40" />

            {/* Clouds */}
            <svg className="absolute top-8 left-[8%] w-28 h-14 animate-float-slow opacity-80" viewBox="0 0 200 80">
              <ellipse className="cloud" cx="100" cy="50" rx="80" ry="30" />
              <ellipse className="cloud" cx="60" cy="40" rx="50" ry="25" />
              <ellipse className="cloud" cx="140" cy="40" rx="50" ry="25" />
            </svg>
            <svg className="absolute top-16 right-[10%] w-24 h-12 animate-float-delayed opacity-80" viewBox="0 0 200 80">
              <ellipse className="cloud" cx="100" cy="50" rx="70" ry="25" />
              <ellipse className="cloud" cx="55" cy="42" rx="45" ry="20" />
              <ellipse className="cloud" cx="145" cy="42" rx="45" ry="20" />
            </svg>

            {/* Big Pop-Art Title */}
            <div className="relative z-10 text-center animate-slide-up">
              <div className="inline-block mb-3">
                <h1 className="font-display text-5xl sm:text-7xl md:text-8xl tracking-tight leading-none">
                  <span className="bg-white text-black px-3.5 py-1.5 inline-block border-4 border-black shadow-[5px_5px_0_0_#000] -rotate-2">
                    ODD
                  </span>
                  <span className="bg-[var(--accent-pink)] text-black px-3.5 py-1.5 inline-block border-4 border-black shadow-[5px_5px_0_0_#000] rotate-1 -ml-1">
                    OR
                  </span>
                  <span className="bg-[var(--accent-lime)] text-black px-3.5 py-1.5 inline-block border-4 border-black shadow-[5px_5px_0_0_#000] -rotate-1 -ml-1">
                    EVE
                  </span>
                </h1>
              </div>

              <div className="block mt-2">
                <p className="nb-card inline-block bg-[var(--bg-secondary)] px-5 py-2 font-body text-xs sm:text-sm text-[var(--text-primary)] max-w-md mx-auto shadow-[4px_4px_0_0_#000]">
                  Play hand cricket & baseball using your webcam. Real-time umpire with zero arguments!
                </p>
              </div>
            </div>

            {/* Main Action Buttons */}
            <div className="relative z-10 mt-8 w-full max-w-sm sm:max-w-md mx-auto space-y-3.5 animate-slide-up" style={{ animationDelay: '0.15s' }}>
              <button
                onClick={() => {
                  setOpponentChoice('friend');
                  if (!profile) {
                    setShowNameModal(true);
                  } else {
                    setScreen('setup');
                  }
                }}
                className="nb-btn nb-btn--yellow w-full text-base sm:text-lg flex items-center justify-between border-4"
              >
                <div className="flex items-center gap-3">
                  <Users className="w-5 h-5" />
                  <span>PLAY A FRIEND</span>
                </div>
                <ChevronRight className="w-5 h-5" />
              </button>

              <button
                onClick={() => {
                  setOpponentChoice('computer');
                  if (!profile) {
                    setShowNameModal(true);
                  } else {
                    setScreen('setup');
                  }
                }}
                className="nb-btn nb-btn--lime w-full text-base sm:text-lg flex items-center justify-between border-4"
              >
                <div className="flex items-center gap-3">
                  <Bot className="w-5 h-5" />
                  <span>PLAY THE COMPUTER</span>
                </div>
                <ChevronRight className="w-5 h-5" />
              </button>
            </div>

            {/* Profile record pill */}
            {profile && (
              <div className="relative z-10 mt-4 animate-slide-up" style={{ animationDelay: '0.3s' }}>
                <button
                  onClick={() => setShowNameModal(true)}
                  className="bg-[var(--bg-secondary)] border-2 border-black px-3 py-1.5 flex items-center gap-2 shadow-[2px_2px_0_0_#000] cursor-pointer hover:bg-[var(--accent-yellow)] transition-colors"
                  title="Click to edit name"
                >
                  <span className="w-2 h-2 rounded-full bg-[var(--accent-lime)]" />
                  <span className="font-num text-xs font-bold text-[var(--text-primary)]">
                    {profile.name} {profile.username ? `@${profile.username}` : ''}
                  </span>
                  <span className="font-num text-[10px] text-[var(--text-muted)]">
                    ({profile.gamesWon}W / {profile.gamesPlayed}P)
                  </span>
                  <span className="text-[10px] text-[var(--text-muted)] underline ml-1">Edit</span>
                </button>
              </div>
            )}
          </div>

          {/* Marquee Ticker */}
          <div className="marquee-bar">
            <div className="marquee-content">
              <span>YOUR CAMERA IS THE UMPIRE</span>
              <span>•</span>
              <span>1 TO 6 RUNS</span>
              <span>•</span>
              <span>NO SIGN UP</span>
              <span>•</span>
              <span>ODD OR EVEN</span>
              <span>•</span>
              <span>HAND CRICKET & BASEBALL</span>
              <span>•</span>
              <span>YOUR CAMERA IS THE UMPIRE</span>
              <span>•</span>
            </div>
          </div>
        </main>

        {/* Modals */}
        {showHowToPlay && <HowToPlayModal onClose={() => setShowHowToPlay(false)} />}
        {showNameModal && (
          <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
            <div className="nb-card bg-white p-5 max-w-sm w-full border-4 border-black shadow-[6px_6px_0_0_#000] animate-bounce-in">
              <h3 className="font-display text-lg mb-2 text-black">YOUR PLAYER NAME</h3>
              <input
                type="text"
                value={playerName}
                onChange={(e) => setPlayerName(e.target.value)}
                placeholder="Enter name"
                className="w-full border-3 border-black p-2 font-display text-base mb-3 bg-white text-black"
                maxLength={14}
                autoFocus
              />
              <button
                onClick={() => {
                  createProfile(playerName.trim() || 'Player', playerUsername);
                  setShowNameModal(false);
                  if (opponentChoice) setScreen('setup');
                }}
                className="nb-btn nb-btn--lime w-full text-sm border-3"
              >
                SAVE & CONTINUE →
              </button>
            </div>
          </div>
        )}
      </div>
    );
  }

  // ===================== SETUP SCREEN =====================
  if (screen === 'setup') {
    return (
      <div className="min-h-screen flex flex-col bg-[var(--bg-primary)]">
        <header className="w-full flex items-center justify-between px-4 sm:px-6 py-2.5 border-b-4 border-black bg-[var(--bg-secondary)] select-none">
          <button onClick={handleBackToLanding} className="nb-btn nb-btn--ghost nb-btn--sm">
            ← BACK
          </button>
          <span className="font-display text-base tracking-wider text-[var(--text-primary)]">
            ODDOREVE
          </span>
          <button onClick={toggleTheme} className="theme-toggle" aria-label="Toggle theme">
            <div className="theme-toggle-knob" />
          </button>
        </header>

        <main className="flex-1 flex items-center justify-center px-4 py-8">
          <div className="w-full max-w-md animate-slide-up">
            <div className="nb-card bg-[var(--bg-secondary)] overflow-hidden border-4">
              <div className="nb-win-bar">
                <div className="nb-dots"><i /><i /><i /></div>
                <span className="font-num text-xs uppercase font-bold tracking-wider text-[var(--text-secondary)]">
                  {opponentChoice === 'computer' ? '🤖 vs Computer' : '👥 vs Friend'} — Select Mode
                </span>
              </div>

              <div className="p-6 space-y-3.5">
                <h2 className="font-display text-2xl font-black text-[var(--text-primary)] text-center mb-1">
                  CHOOSE YOUR MODE
                </h2>

                {joinError && (
                  <div className="p-2 bg-[#ff3b30] text-white border-2 border-black font-num text-xs font-bold shadow-[2px_2px_0_0_#000]">
                    ⚠️ {joinError}
                  </div>
                )}

                {/* Cricket 1v1 */}
                <button
                  onClick={() => {
                    if (opponentChoice === 'friend') {
                      handleCreateFriendRoom('cricket', '1v1');
                    } else {
                      handleStartComputerGame('cricket', '1v1');
                    }
                  }}
                  className="nb-btn nb-btn--yellow w-full text-left flex items-center justify-between border-3"
                >
                  <div className="flex items-center gap-3">
                    <span className="text-2xl">🏏</span>
                    <div>
                      <div className="text-base font-display">CRICKET 1v1</div>
                      <div className="text-[10px] font-num font-normal opacity-80">Classic hand cricket. Equal throw = OUT!</div>
                    </div>
                  </div>
                  <ChevronRight className="w-5 h-5" />
                </button>

                {/* Cricket 2v2 */}
                <button
                  onClick={() => {
                    if (opponentChoice === 'friend') {
                      handleCreateFriendRoom('cricket', '2v2');
                    } else {
                      handleStartComputerGame('cricket', '2v2');
                    }
                  }}
                  className="nb-btn nb-btn--pink w-full text-left flex items-center justify-between border-3"
                >
                  <div className="flex items-center gap-3">
                    <span className="text-2xl">🏏</span>
                    <div>
                      <div className="text-base font-display">CRICKET 2v2</div>
                      <div className="text-[10px] font-num font-normal opacity-80">Both batters out. 4 active player boxes!</div>
                    </div>
                  </div>
                  <ChevronRight className="w-5 h-5" />
                </button>

                {/* Baseball 1v1 */}
                <button
                  onClick={() => {
                    if (opponentChoice === 'friend') {
                      handleCreateFriendRoom('baseball', '1v1');
                    } else {
                      handleStartComputerGame('baseball', '1v1');
                    }
                  }}
                  className="nb-btn nb-btn--blue w-full text-left flex items-center justify-between border-3"
                >
                  <div className="flex items-center gap-3">
                    <span className="text-2xl">⚾</span>
                    <div>
                      <div className="text-base font-display">BASEBALL 1v1</div>
                      <div className="text-[10px] font-num font-normal opacity-80">Diff of 1 = Strike! 3 Strikes = Out! Equal = Double!</div>
                    </div>
                  </div>
                  <ChevronRight className="w-5 h-5" />
                </button>

                {/* Baseball 2v2 */}
                <button
                  onClick={() => {
                    if (opponentChoice === 'friend') {
                      handleCreateFriendRoom('baseball', '2v2');
                    } else {
                      handleStartComputerGame('baseball', '2v2');
                    }
                  }}
                  className="nb-btn nb-btn--ghost w-full text-left flex items-center justify-between border-3"
                >
                  <div className="flex items-center gap-3">
                    <span className="text-2xl">⚾</span>
                    <div>
                      <div className="text-base font-display">BASEBALL 2v2</div>
                      <div className="text-[10px] font-num font-normal opacity-80">2v2 Baseball diamond match. 4 player boxes!</div>
                    </div>
                  </div>
                  <ChevronRight className="w-5 h-5" />
                </button>

                {/* Join Existing Friend Room Section */}
                {opponentChoice === 'friend' && (
                  <div className="pt-3 border-t-2 border-black/20 space-y-2">
                    <div className="font-num text-xs font-black uppercase text-black">
                      OR JOIN FRIEND'S ROOM CODE:
                    </div>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={joinCodeInput}
                        onChange={(e) => setJoinCodeInput(e.target.value.toLowerCase())}
                        onKeyDown={(e) => e.key === 'Enter' && handleJoinFriendMatch(joinCodeInput)}
                        placeholder="e.g. fs9mcg"
                        className="flex-1 border-3 border-black p-2 font-mono text-base uppercase bg-white text-black font-bold focus:outline-none shadow-[2px_2px_0_0_#000] text-center"
                        maxLength={8}
                      />
                      <button
                        onClick={() => handleJoinFriendMatch(joinCodeInput)}
                        disabled={isJoiningRoom}
                        className="px-4 py-2 bg-[#a3f23d] border-3 border-black font-display text-xs font-black uppercase shadow-[2px_2px_0_0_#000] cursor-pointer disabled:opacity-50"
                      >
                        {isJoiningRoom ? 'JOINING...' : 'JOIN →'}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </main>
      </div>
    );
  }

  // ===================== PLAYING / GAME SCREEN =====================
  // Full-width stadium layout with zero side gaps & zero vertical scrolling
  return (
    <div className="h-screen max-h-screen overflow-hidden flex flex-col justify-between bg-[#0e131a] p-1.5 sm:p-2.5 relative select-none">
      {/* Stadium Pitch down the center */}
      <div className="absolute inset-y-0 left-1/2 -translate-x-1/2 w-full max-w-5xl bg-[#d4a373] dark:bg-[#583e26] border-x-4 border-black pointer-events-none z-0">
        {match.mode === 'cricket' ? (
          <>
            {/* Cricket Stumps at the top */}
            <div className="absolute top-1.5 left-1/2 -translate-x-1/2 flex items-center gap-1.5 opacity-80">
              <div className="w-1.5 h-5 bg-black dark:bg-white rounded-t-sm" />
              <div className="w-1.5 h-5 bg-black dark:bg-white rounded-t-sm" />
              <div className="w-1.5 h-5 bg-black dark:bg-white rounded-t-sm" />
            </div>
            {/* Bowling Crease */}
            <div className="absolute top-7 left-0 right-0 h-1 bg-white/70" />
            {/* Cricket Stumps at the bottom */}
            <div className="absolute bottom-1.5 left-1/2 -translate-x-1/2 flex items-center gap-1.5 opacity-80">
              <div className="w-1.5 h-5 bg-black dark:bg-white rounded-t-sm" />
              <div className="w-1.5 h-5 bg-black dark:bg-white rounded-t-sm" />
              <div className="w-1.5 h-5 bg-black dark:bg-white rounded-t-sm" />
            </div>
            <div className="absolute bottom-7 left-0 right-0 h-1 bg-white/70" />
          </>
        ) : (
          <>
            {/* Baseball Diamond Visuals */}
            <div className="absolute top-3 left-1/2 -translate-x-1/2 w-5 h-5 bg-white border-2 border-black rotate-45 shadow-[1px_1px_0_#000]" />
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-10 h-2.5 bg-white border-2 border-black shadow-[1px_1px_0_#000]" />
            <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex flex-col items-center">
              <div className="w-6 h-3 bg-white border-2 border-black border-b-0 shadow-[1px_1px_0_#000]" />
              <div className="w-0 h-0 border-l-[12px] border-l-transparent border-r-[12px] border-r-transparent border-t-[8px] border-t-white" />
            </div>
            <div className="absolute top-6 left-1/4 bottom-6 w-0.5 bg-white/40 -rotate-12" />
            <div className="absolute top-6 right-1/4 bottom-6 w-0.5 bg-white/40 rotate-12" />
          </>
        )}
      </div>

      {/* Floating Desktop Room Invite Pill (when in multiplayer) */}
      {activeRoom && (
        <div className="hidden lg:flex items-center gap-2 absolute right-4 top-3 bg-black/80 border-3 border-black px-3 py-1.5 text-white shadow-[4px_4px_0_0_#000] z-20">
          <span className="w-2 h-2 rounded-full bg-[#a3f23d] animate-ping" />
          <span className="font-num text-xs font-black text-[#a3f23d]">
            ROOM {activeRoom.code.toUpperCase()}
          </span>
          <button
            onClick={handleCopyInviteLink}
            className="ml-2 px-2 py-0.5 bg-[#ffd60a] hover:bg-[#ffc700] text-black font-num text-[11px] font-black uppercase border border-black flex items-center gap-1 cursor-pointer"
          >
            <Copy className="w-3 h-3" />
            {copied ? 'COPIED!' : 'COPY LINK'}
          </button>
        </div>
      )}

      {/* Top Header Bar */}
      <header className="relative z-10 w-full flex items-center justify-between flex-shrink-0 h-8 max-w-5xl mx-auto">
        {/* Game Mode Pill */}
        <div className="flex items-center gap-1.5 px-2.5 py-0.5 bg-[var(--accent-lime)] border-2 sm:border-3 border-black font-num text-[11px] font-black text-black shadow-[2px_2px_0_0_#000]">
          <span>{isBaseball ? '⚾' : '🏏'}</span>
          <span>{isBaseball ? 'BASEBALL' : 'HAND CRICKET'} {match.format}</span>
        </div>

        <div className="flex items-center gap-2">
          <button onClick={toggleTheme} className="theme-toggle" aria-label="Toggle theme">
            <div className="theme-toggle-knob" />
          </button>
          <button
            onClick={handleBackToLanding}
            className="nb-btn nb-btn--ghost nb-btn--sm py-1 px-2.5 text-xs bg-white text-black border-2 border-black shadow-[2px_2px_0_0_#000]"
          >
            ← BACK
          </button>
        </div>
      </header>

      {/* Main Gameplay Screen Area */}
      <main className="relative z-10 flex-1 flex flex-col items-center justify-between gap-1.5 sm:gap-2 max-w-5xl mx-auto w-full min-h-0 py-0.5">
        {/* Innings Break Notification Overlay */}
        {match.phase === 'innings_break' && (
          <div className="absolute inset-0 z-30 flex items-center justify-center p-4 bg-black/60">
            <div className="nb-card bg-white p-5 text-center border-4 border-black max-w-sm w-full shadow-[6px_6px_0_0_#000] animate-bounce-in">
              <div className="p-3 mb-3 bg-[#ffd60a] border-3 border-black shadow-[3px_3px_0_0_#000]">
                <h2 className="font-display text-lg text-black">
                  {match.innings1.battingTeamId === match.teamA.id
                    ? match.teamA.name
                    : match.teamB.name}{' '}
                  Scored {match.innings1.score}!
                </h2>
              </div>
              <p className="font-num text-xs text-black mb-3">
                Target → <strong className="font-display text-lg text-[#ff3b30]">{match.target}</strong> runs
              </p>
              <button
                onClick={handleStartSecondInnings}
                className="nb-btn nb-btn--lime w-full text-sm border-3"
              >
                START SECOND INNINGS →
              </button>
            </div>
          </div>
        )}

        {/* 1. Scoreboard */}
        <Scoreboard match={match} lastEvent={lastBallEvent} />

        {/* Ball History Strip */}
        {match.ballHistory.length > 0 && (
          <div className="w-full max-w-5xl mx-auto flex-shrink-0">
            <div className="flex items-center gap-1 overflow-x-auto px-1 py-1 bg-black/80 border-2 border-black no-scrollbar">
              {match.ballHistory.slice(-20).map((ball, i) => (
                <div
                  key={i}
                  className={`flex-shrink-0 w-6 h-6 sm:w-7 sm:h-7 flex items-center justify-center font-num text-[11px] sm:text-xs font-black border-2 border-black ${
                    ball.isOut
                      ? 'bg-[#ff3b30] text-white animate-pulse'
                      : ball.isDouble
                      ? 'bg-[#a3f23d] text-black'
                      : ball.isStrike
                      ? 'bg-[#ffd60a] text-black'
                      : ball.runsScored === 0
                      ? 'bg-[#444] text-white'
                      : ball.runsScored >= 4
                      ? 'bg-[#4dabf7] text-black'
                      : 'bg-white text-black'
                  }`}
                  title={ball.description}
                >
                  {ball.isOut ? (isBaseball ? 'K' : 'W') : ball.isStrike ? 'S' : ball.isDouble ? '2x' : ball.runsScored}
                </div>
              ))}
              <span className="font-num text-[10px] text-white/60 ml-1.5 flex-shrink-0">← balls</span>
            </div>
          </div>
        )}

        {/* 2. Feeds: 4 boxes in 2v2 mode, or 2 large boxes in 1v1 mode */}
        {is2v2 ? (
          /* 2v2: 4 boxes in a 2x2 grid */
          <div className="grid grid-cols-2 gap-2 sm:gap-3 w-full flex-shrink-0">
            {/* Box 1: You (Camera) - Top Left */}
            <div className="bg-white border-3 sm:border-4 border-black shadow-[4px_4px_0_0_#000] overflow-hidden flex flex-col h-[300px] sm:h-[360px] md:h-[420px]">
              <div className="bg-[#ffd60a] border-b-2 sm:border-b-3 border-black px-2 py-0.5 flex items-center justify-between text-black flex-shrink-0">
                <div className="flex items-center gap-1 font-num text-[11px] font-black uppercase truncate">
                  <span className="w-2 h-2 rounded-full border border-black bg-white inline-block" />
                  <span>{myName} (YOU)</span>
                  <span className="opacity-75">[{myIsBatting ? 'BAT' : isBaseball ? 'PITCH' : 'BOWL'}]</span>
                </div>
                {myThrowReady && (
                  <span className="font-num text-[9px] px-1 bg-[#a3f23d] border border-black font-black">READY</span>
                )}
              </div>
              <div className="relative w-full flex-1 bg-black min-h-0 overflow-hidden">
                <WebcamHandTracker
                  playerLabel={myName}
                  isThrowRequired={myThrowRequired}
                  ballCycle={ballCycle}
                  cooldownRemaining={ballCooldownRemaining}
                  onThrowConfirmed={handlePlayerThrow}
                />
              </div>
            </div>

            {/* Box 2: Opponent 1 - Top Right */}
            <div className="bg-white border-3 sm:border-4 border-black shadow-[4px_4px_0_0_#000] overflow-hidden flex flex-col h-[300px] sm:h-[360px] md:h-[420px]">
              <div className="bg-[#ff6fb5] border-b-2 sm:border-b-3 border-black px-2 py-0.5 flex items-center justify-between text-black flex-shrink-0">
                <div className="flex items-center gap-1 font-num text-[11px] font-black uppercase truncate">
                  <span className="w-2 h-2 rounded-full border border-black bg-white inline-block" />
                  <span>{oppName.toUpperCase()} 1</span>
                  <span className="opacity-75">[{oppIsBatting ? 'BAT' : isBaseball ? 'PITCH' : 'BOWL'}]</span>
                </div>
                {oppThrowReady && (
                  <span className="font-num text-[9px] px-1 bg-[#a3f23d] border border-black font-black">READY</span>
                )}
              </div>
              <div className="relative w-full flex-1 bg-[#2563eb] border-2 border-black flex flex-col items-center justify-center p-2 text-white min-h-0 select-none overflow-hidden">
                {activeRoom && activeRoom.players.length < 2 ? (
                  <div className="flex flex-col items-center justify-center text-center">
                    <span className="font-num text-[11px] font-black text-[#ffd60a]">WAITING FOR FRIEND...</span>
                    <button
                      onClick={handleCopyInviteLink}
                      className="mt-1 px-2 py-0.5 bg-[#ffd60a] text-black font-num text-[10px] font-bold border border-black cursor-pointer"
                    >
                      {copied ? 'COPIED!' : 'COPY LINK'}
                    </button>
                  </div>
                ) : (
                  <>
                    <Bot className="w-8 h-8 text-white drop-shadow-[1px_1px_0_#000]" />
                    {oppDisplayedThrow !== null && (
                      <div className="font-display text-3xl font-black text-white leading-none mt-0.5 drop-shadow-[2px_2px_0_#000]">
                        {oppDisplayedThrow}
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>

            {/* Box 3: Teammate (Player A2) - Bottom Left */}
            <div className="bg-white border-3 sm:border-4 border-black shadow-[4px_4px_0_0_#000] overflow-hidden flex flex-col h-[300px] sm:h-[360px] md:h-[420px]">
              <div className="bg-[#ffd60a] border-b-2 sm:border-b-3 border-black px-2 py-0.5 flex items-center justify-between text-black flex-shrink-0">
                <div className="flex items-center gap-1 font-num text-[11px] font-black uppercase truncate">
                  <span className="w-2 h-2 rounded-full border border-black bg-white inline-block" />
                  <span>{match.teamA.players[1]?.name || 'TEAMMATE'}</span>
                  <span className="opacity-75">[PARTNER]</span>
                </div>
              </div>
              <div className="relative w-full flex-1 bg-[#1e293b] flex flex-col items-center justify-center p-2 text-white min-h-0 select-none">
                <Users className="w-8 h-8 text-[#a3f23d] drop-shadow-[1px_1px_0_#000]" />
                <span className="font-num text-[10px] text-white/70 uppercase mt-1">
                  {match.teamA.players[1]?.isOut ? '❌ OUT' : 'ON DECK'}
                </span>
              </div>
            </div>

            {/* Box 4: Opponent 2 (Player B2) - Bottom Right */}
            <div className="bg-white border-3 sm:border-4 border-black shadow-[4px_4px_0_0_#000] overflow-hidden flex flex-col h-[300px] sm:h-[360px] md:h-[420px]">
              <div className="bg-[#ff6fb5] border-b-2 sm:border-b-3 border-black px-2 py-0.5 flex items-center justify-between text-black flex-shrink-0">
                <div className="flex items-center gap-1 font-num text-[11px] font-black uppercase truncate">
                  <span className="w-2 h-2 rounded-full border border-black bg-white inline-block" />
                  <span>{match.teamB.players[1]?.name || 'OPPONENT 2'}</span>
                  <span className="opacity-75">[PARTNER]</span>
                </div>
              </div>
              <div className="relative w-full flex-1 bg-[#1e3a8a] flex flex-col items-center justify-center p-2 text-white min-h-0 select-none">
                <Users className="w-8 h-8 text-[#ffd60a] drop-shadow-[1px_1px_0_#000]" />
                <span className="font-num text-[10px] text-white/70 uppercase mt-1">
                  {match.teamB.players[1]?.isOut ? '❌ OUT' : 'ON DECK'}
                </span>
              </div>
            </div>
          </div>
        ) : (
          /* 1v1: 2 large side-by-side feeds */
          <div className="grid grid-cols-2 gap-2 sm:gap-3 w-full flex-shrink-0">
            {/* Player 1 (You) Feed */}
            <div className="bg-white border-3 sm:border-4 border-black shadow-[4px_4px_0_0_#000] overflow-hidden flex flex-col h-[270px] sm:h-[300px] md:h-[330px]">
              {/* Yellow window bar */}
              <div className="bg-[#ffd60a] border-b-2 sm:border-b-3 border-black px-2.5 py-1 flex items-center justify-between text-black flex-shrink-0">
                <div className="flex items-center gap-1.5 font-num text-[11px] sm:text-xs font-black uppercase truncate max-w-[160px]">
                  <span className="w-2.5 h-2.5 rounded-full border border-black bg-white inline-block flex-shrink-0" />
                  <span>{myName}</span>
                  {match.phase === 'innings1' || match.phase === 'innings2' ? (
                    <span className="opacity-75">
                      ({myIsBatting ? 'BAT' : isBaseball ? 'PITCH' : 'BOWL'})
                    </span>
                  ) : null}
                </div>
                {myThrowReady ? (
                  <span className="font-num text-[9px] px-1.5 py-0.5 bg-[#a3f23d] border border-black font-black">
                    READY
                  </span>
                ) : null}
              </div>

              {/* Webcam Box */}
              <div className="relative w-full flex-1 bg-black min-h-0 overflow-hidden">
                <WebcamHandTracker
                  playerLabel={myName}
                  isThrowRequired={myThrowRequired}
                  ballCycle={ballCycle}
                  cooldownRemaining={ballCooldownRemaining}
                  onThrowConfirmed={handlePlayerThrow}
                />
              </div>
            </div>

            {/* Player 2 (Computer / Opponent) Feed */}
            <div className="bg-white border-3 sm:border-4 border-black shadow-[4px_4px_0_0_#000] overflow-hidden flex flex-col h-[270px] sm:h-[300px] md:h-[330px]">
              {/* Pink window bar */}
              <div className="bg-[#ff6fb5] border-b-2 sm:border-b-3 border-black px-2.5 py-1 flex items-center justify-between text-black flex-shrink-0">
                <div className="flex items-center gap-1.5 font-num text-[11px] sm:text-xs font-black uppercase truncate max-w-[160px]">
                  <div className="flex items-center gap-1">
                    <span className="w-2 h-2 rounded-full border border-black bg-white inline-block flex-shrink-0" />
                    <span className="w-2 h-2 rounded-full border border-black bg-white inline-block flex-shrink-0" />
                    <span className="w-2 h-2 rounded-full border border-black bg-white inline-block flex-shrink-0" />
                  </div>
                  <span>{oppName.toUpperCase()}</span>
                  {match.phase === 'innings1' || match.phase === 'innings2' ? (
                    <span className="opacity-75">
                      ({oppIsBatting ? 'BAT' : isBaseball ? 'PITCH' : 'BOWL'})
                    </span>
                  ) : null}
                </div>
                {oppThrowReady ? (
                  <span className="font-num text-[9px] px-1.5 py-0.5 bg-[#a3f23d] border border-black font-black">
                    READY
                  </span>
                ) : null}
              </div>

              {/* Opponent Card / Waiting State */}
              <div className="relative w-full flex-1 bg-[#2563eb] border-2 border-black flex flex-col items-center justify-center p-2 text-white min-h-0 select-none overflow-hidden">
                {activeRoom && activeRoom.players.length < 2 ? (
                  /* In-game waiting state for friend with room code & copy button */
                  <div className="flex flex-col items-center justify-center text-center p-3 w-full h-full animate-slide-up">
                    <div className="w-3.5 h-3.5 rounded-full bg-[#a3f23d] animate-ping mb-2" />
                    <span className="font-num text-xs sm:text-sm font-black uppercase tracking-wider text-[#ffd60a] mb-1">
                      WAITING FOR FRIEND TO JOIN...
                    </span>
                    <div className="bg-black/70 border-3 border-black px-4 py-1.5 mb-2.5 shadow-[2px_2px_0_0_#000]">
                      <span className="font-mono text-3xl font-black text-white tracking-widest">
                        {activeRoom.code.toUpperCase()}
                      </span>
                    </div>
                    <button
                      onClick={handleCopyInviteLink}
                      className="px-4 py-2 bg-[#ffd60a] hover:bg-[#ffc700] text-black border-2 border-black font-display text-xs sm:text-sm font-black uppercase shadow-[3px_3px_0_0_#000] flex items-center gap-2 cursor-pointer transition-all"
                    >
                      {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                      <span>{copied ? 'LINK COPIED!' : 'COPY INVITE LINK'}</span>
                    </button>
                    <span className="font-num text-[10px] text-white/80 mt-2 max-w-xs">
                      Share this code or link with your friend to connect instantly!
                    </span>
                  </div>
                ) : activeRoom ? (
                  /* Connected Friend */
                  <div className="flex flex-col items-center justify-center mb-1">
                    <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-white/20 border-3 border-white flex items-center justify-center mb-1 shadow-[2px_2px_0_#000]">
                      <Users className="w-9 h-9 sm:w-11 sm:h-11 text-white" />
                    </div>
                    <span className="font-num text-xs sm:text-sm font-black uppercase tracking-wider text-white">
                      {oppName}
                    </span>
                  </div>
                ) : (
                  /* Retro Robot SVG */
                  <svg
                    viewBox="0 0 24 24"
                    fill="currentColor"
                    className="w-16 h-16 sm:w-20 sm:h-20 text-white drop-shadow-[2px_2px_0_#000]"
                  >
                    <rect x="11" y="1" width="2" height="3" rx="1" />
                    <circle cx="12" cy="1" r="1.5" />
                    <rect x="4" y="4" width="16" height="10" rx="2" />
                    <rect x="7" y="7" width="3" height="3" rx="0.5" fill="#2563eb" />
                    <rect x="14" y="7" width="3" height="3" rx="0.5" fill="#2563eb" />
                    <rect x="9" y="11" width="6" height="1.5" rx="0.5" fill="#2563eb" />
                    <rect x="2" y="7" width="2" height="4" rx="1" />
                    <rect x="20" y="7" width="2" height="4" rx="1" />
                    <path d="M5 15h14v5a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2v-5z" />
                    <rect x="2" y="16" width="2" height="4" rx="1" />
                    <rect x="20" y="16" width="2" height="4" rx="1" />
                  </svg>
                )}

                {/* Throw Number Display */}
                {(activeRoom ? activeRoom.players.length >= 2 : true) &&
                  (oppDisplayedThrow !== null || match.phase === 'match_over') && (
                    <div className="font-display text-5xl sm:text-6xl font-black text-white leading-none mt-1 animate-bounce-in drop-shadow-[2px_2px_0_#000]">
                      {oppDisplayedThrow !== null ? oppDisplayedThrow : 0}
                    </div>
                  )}
              </div>
            </div>
          </div>
        )}

        {/* 3. Commentary Card */}
        <CommentaryCard
          match={match}
          lastEvent={lastBallEvent}
          onCallToss={handleCallToss}
          onChooseToss={handleChooseToss}
          onPlayAgain={handlePlayAgain}
          onBackToLanding={handleBackToLanding}
        />

        {/* 4. Touch Keyboard Toggle Drawer */}
        <div className="relative w-full flex justify-end flex-shrink-0">
          <button
            onClick={() => setShowTouchKeyboard(!showTouchKeyboard)}
            className="bg-white hover:bg-[#ffd60a] border-2 border-black px-2.5 py-0.5 font-num text-[10px] font-bold text-black shadow-[2px_2px_0_0_#000] flex items-center gap-1.5 cursor-pointer"
          >
            <Keyboard className="w-3 h-3" />
            <span>{showTouchKeyboard ? 'Hide keypad' : 'Touch keypad'}</span>
          </button>
        </div>

        {/* Pop-up Overlay Keyboard Fallback */}
        {showTouchKeyboard && (
          <div className="fixed bottom-12 left-1/2 -translate-x-1/2 w-full max-w-md bg-white border-3 border-black p-2.5 shadow-[6px_6px_0_0_#000] z-50 animate-slide-up">
            <div className="flex justify-between items-center mb-1">
              <span className="font-num text-[10px] font-black uppercase text-black">
                TOUCH KEYPAD CONTROLS
              </span>
              <button onClick={() => setShowTouchKeyboard(false)} className="text-black font-black">
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
            <KeyboardFallback
              playerLabel={myName}
              selectedThrow={isHost ? pendingThrows.teamA : pendingThrows.teamB}
              disabled={isBallCooldown}
              onThrow={(val) => {
                handlePlayerThrow(val);
                setShowTouchKeyboard(false);
              }}
            />
          </div>
        )}
      </main>
    </div>
  );
}

/* =========================================== */
/* How To Play Modal                           */
/* =========================================== */
function HowToPlayModal({ onClose }: { onClose: () => void }) {
  return (
    <div className="fixed inset-0 bg-[var(--overlay-bg)] z-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-white border-4 border-black shadow-[8px_8px_0_0_#000] max-h-[90vh] overflow-y-auto animate-bounce-in">
        <div className="bg-[#ffd60a] border-b-4 border-black px-4 py-2 flex items-center justify-between text-black">
          <span className="font-display text-sm uppercase tracking-wider font-black">
            HOW TO PLAY ODDOREVE
          </span>
          <button onClick={onClose} className="p-1 hover:bg-black/10">
            <X className="w-4 h-4 text-black" />
          </button>
        </div>

        <div className="p-5 space-y-4 text-black text-left">
          <p className="font-body text-xs text-[#333]">
            ODDOREVE is the classic hand cricket game played over webcam. Show your fingers to the camera — the AI reads your throws in real time with zero arguments!
          </p>

          <div>
            <h4 className="font-display text-xs uppercase tracking-wider mb-1.5 text-black">
              HAND THROWS (1 TO 6 RUNS)
            </h4>
            <div className="grid grid-cols-2 gap-1.5 font-num text-xs">
              {[
                ['☝️ One finger', '1 run'],
                ['✌️ Peace sign', '2 runs'],
                ['🤟 Three fingers', '3 runs'],
                ['🖖 Four fingers', '4 runs'],
                ['🖐️ Open palm', '5 runs'],
                ['👍 Thumbs up', '6 runs'],
              ].map(([gesture, value]) => (
                <div key={gesture} className="p-1.5 bg-[#f5f0e1] border-2 border-black text-black">
                  <strong>{gesture}</strong> → {value}
                </div>
              ))}
            </div>
            <p className="font-num text-[10px] text-[#666] mt-1.5">
              * Note: Valid run throws are 1 to 6 fingers.
            </p>
          </div>

          <div>
            <h4 className="font-display text-xs uppercase tracking-wider mb-1 text-black">
              RULES
            </h4>
            <ul className="space-y-1 text-xs font-body text-[#333] list-disc pl-4">
              <li><strong>Hold 1.5s:</strong> Keep your gesture steady to lock your throw.</li>
              <li><strong>Cricket:</strong> Batter scores their throw. If both throw the same number → OUT!</li>
              <li><strong>Baseball:</strong> Difference of 1 (or 6 and 1) is a strike. 3 consecutive strikes = OUT! Same throw at 0 strikes = double runs! Hits reset strike count.</li>
              <li><strong>2v2 Mode:</strong> Both batters must be dismissed. Bowlers rotate every 6 balls (1 over).</li>
            </ul>
          </div>

          <button onClick={onClose} className="nb-btn nb-btn--lime w-full text-xs border-3">
            GOT IT, LET'S PLAY!
          </button>
        </div>
      </div>
    </div>
  );
}
