'use client';

import React, { useState, useEffect } from 'react';
import { useGameStore } from '@/store/useGameStore';
import { useTheme } from '@/store/useTheme';
import { usePlayerProfile } from '@/store/usePlayerProfile';
import { Scoreboard } from '@/components/Scoreboard';
import { CommentaryCard } from '@/components/CommentaryCard';
import { TossScreen } from '@/components/TossScreen';
import { MatchResultScreen } from '@/components/MatchResultScreen';
import { WebcamHandTracker } from '@/components/WebcamHandTracker';
import { KeyboardFallback } from '@/components/KeyboardFallback';
import { GameMode, GameFormat, ThrowValue } from '@/engine/types';
import {
  HelpCircle,
  X,
  RotateCcw,
  Users,
  Bot,
  ChevronRight,
  Keyboard,
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
    lives,
    warningMessage,
    setOpponentType,
    callToss,
    chooseToss,
    setPlayerThrow,
    startSecondInnings,
    resetMatch,
    initMatch,
  } = useGameStore();

  const { theme, toggleTheme } = useTheme();
  const { profile, createProfile, recordGame } = usePlayerProfile();

  const [screen, setScreen] = useState<AppScreen>('landing');
  const [opponentChoice, setOpponentChoice] = useState<OpponentChoice | null>(null);
  const [showHowToPlay, setShowHowToPlay] = useState(false);
  const [playerName, setPlayerName] = useState('');
  const [playerUsername, setPlayerUsername] = useState('');
  const [showNameModal, setShowNameModal] = useState(false);
  const [showTouchKeyboard, setShowTouchKeyboard] = useState(false);

  // Sync profile if available
  useEffect(() => {
    if (profile) {
      setPlayerName(profile.name);
      setPlayerUsername(profile.username || '');
    }
  }, [profile]);

  // Record game outcome when match ends
  useEffect(() => {
    if (match.phase === 'match_over' && match.result) {
      const isUserWin = match.result.winnerTeamId === match.teamA.id;
      recordGame(isUserWin);
    }
  }, [match.phase, match.result, match.teamA.id, recordGame]);

  const currentInnings = match.phase === 'innings2' ? match.innings2 : match.innings1;
  const isTeamABatting = currentInnings?.battingTeamId === match.teamA.id;

  // Last throws by both sides
  const userLastThrow = lastBallEvent
    ? (isTeamABatting ? lastBallEvent.batterThrow : lastBallEvent.bowlerThrow)
    : null;
  const oppLastThrow = lastBallEvent
    ? (!isTeamABatting ? lastBallEvent.batterThrow : lastBallEvent.bowlerThrow)
    : null;

  // Handle Game Start
  function handleStartGame(mode: GameMode, format: GameFormat) {
    const opp = opponentChoice === 'computer' ? 'computer' : 'human';
    const name = playerName.trim() || profile?.name || 'You';

    if (!profile) {
      createProfile(name, playerUsername);
    }

    setOpponentType(opp as 'human' | 'computer');
    initMatch({
      mode,
      format,
      teamAName: name,
      teamBName: opp === 'computer' ? 'Computer' : 'Friend',
      opponentType: opp as 'human' | 'computer',
    });
    setScreen('playing');
  }

  function handleBackToLanding() {
    resetMatch();
    setScreen('landing');
    setOpponentChoice(null);
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

            {/* Floodlights */}
            <div className="absolute top-4 left-4 sm:left-10 select-none">
              <div className="w-2.5 h-20 sm:h-28 bg-[#555] mx-auto" />
              <div className="w-10 h-6 bg-[#222] border-2 border-black mx-auto -mt-1 flex items-center justify-center">
                <div className="grid grid-cols-2 gap-1">
                  <div className="w-2 h-2 bg-[#ffd60a] shadow-[0_0_8px_#ffd60a]" />
                  <div className="w-2 h-2 bg-[#ffd60a] shadow-[0_0_8px_#ffd60a]" />
                </div>
              </div>
            </div>
            <div className="absolute top-4 right-4 sm:right-10 select-none">
              <div className="w-2.5 h-20 sm:h-28 bg-[#555] mx-auto" />
              <div className="w-10 h-6 bg-[#222] border-2 border-black mx-auto -mt-1 flex items-center justify-center">
                <div className="grid grid-cols-2 gap-1">
                  <div className="w-2 h-2 bg-[#ffd60a] shadow-[0_0_8px_#ffd60a]" />
                  <div className="w-2 h-2 bg-[#ffd60a] shadow-[0_0_8px_#ffd60a]" />
                </div>
              </div>
            </div>

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
                  Challenge a friend or the AI. Throw fingers at the webcam. Site does the umpiring!
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

            {/* Profile record pill with edit button */}
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
              <span>ONE BALL AT A TIME</span>
              <span>•</span>
              <span>ODD OR EVEN</span>
              <span>•</span>
              <span>YOUR CAMERA IS THE UMPIRE</span>
              <span>•</span>
              <span>1 TO 6 RUNS</span>
              <span>•</span>
              <span>NO SIGN UP</span>
              <span>•</span>
              <span>ODD OR EVEN</span>
              <span>•</span>
            </div>
          </div>
        </main>

        {/* Footer */}
        <footer className="w-full px-4 py-2 bg-[var(--bg-secondary)] border-t-3 border-black text-center">
          <span className="font-num text-[11px] text-[var(--text-muted)]">
            ODDOREVE — Next-Gen Webcam Hand Cricket & Baseball
          </span>
        </footer>

        {/* "CREATE YOUR NAME" Modal */}
        {showNameModal && (
          <div className="fixed inset-0 bg-[var(--overlay-bg)] z-50 flex items-center justify-center p-4">
            <div className="w-full max-w-sm border-4 border-black bg-white shadow-[8px_8px_0_0_#000] animate-bounce-in overflow-hidden">
              {/* Yellow header bar with o o o */}
              <div className="bg-[#ffd60a] border-b-4 border-black px-4 py-2 flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <span className="w-3 h-3 rounded-full border-2 border-black bg-white inline-block" />
                  <span className="w-3 h-3 rounded-full border-2 border-black bg-white inline-block" />
                  <span className="w-3 h-3 rounded-full border-2 border-black bg-white inline-block" />
                </div>
                <span className="font-num text-[11px] font-black uppercase tracking-wider text-black">
                  CREATE YOUR NAME
                </span>
                <button onClick={() => setShowNameModal(false)} className="text-black font-black">
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Modal Body */}
              <div className="p-6 bg-white space-y-4">
                <h2 className="font-display text-3xl font-black text-black leading-none uppercase">
                  CREATE<br />YOUR NAME
                </h2>

                <div className="bg-[#a3f23d] border-4 border-black p-4 space-y-3 shadow-[4px_4px_0_0_#000]">
                  <div>
                    <label className="block font-num text-[11px] font-black uppercase text-black mb-1">
                      YOUR NAME
                    </label>
                    <input
                      type="text"
                      value={playerName}
                      onChange={(e) => setPlayerName(e.target.value)}
                      placeholder="Virat Kohli"
                      className="w-full border-3 border-black px-3 py-2 font-mono text-sm bg-white text-black focus:outline-none"
                      autoFocus
                    />
                  </div>

                  <div>
                    <label className="block font-num text-[11px] font-black uppercase text-black mb-1">
                      YOUR USERNAME
                    </label>
                    <input
                      type="text"
                      value={playerUsername}
                      onChange={(e) => setPlayerUsername(e.target.value)}
                      placeholder="ViratKohliLover"
                      className="w-full border-3 border-black px-3 py-2 font-mono text-sm bg-white text-black focus:outline-none"
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          const name = playerName.trim() || 'Player';
                          createProfile(name, playerUsername);
                          setShowNameModal(false);
                          setScreen('setup');
                        }
                      }}
                    />
                  </div>

                  <button
                    onClick={() => {
                      const name = playerName.trim() || 'Player';
                      createProfile(name, playerUsername);
                      setShowNameModal(false);
                      setScreen('setup');
                    }}
                    className="w-full py-3 bg-[#e0d6c3] hover:bg-[#d0c6b3] border-3 border-black font-display text-sm font-black text-black uppercase tracking-wider shadow-[3px_3px_0_0_#000] cursor-pointer"
                  >
                    CREATE
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* How to Play Modal */}
        {showHowToPlay && <HowToPlayModal onClose={() => setShowHowToPlay(false)} />}
      </div>
    );
  }

  // ===================== SETUP SCREEN =====================
  if (screen === 'setup') {
    return (
      <div className="min-h-screen flex flex-col bg-[var(--bg-primary)]">
        {/* Top Header */}
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
                  {opponentChoice === 'computer' ? '🤖 vs Computer' : '👥 vs Friend'} — Select Format
                </span>
              </div>

              <div className="p-6 space-y-3.5">
                <h2 className="font-display text-2xl font-black text-[var(--text-primary)] text-center mb-1">
                  CHOOSE YOUR MODE
                </h2>

                {/* Cricket 1v1 */}
                <button
                  onClick={() => handleStartGame('cricket', '1v1')}
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
                  onClick={() => handleStartGame('cricket', '2v2')}
                  className="nb-btn nb-btn--pink w-full text-left flex items-center justify-between border-3"
                >
                  <div className="flex items-center gap-3">
                    <span className="text-2xl">🏏</span>
                    <div>
                      <div className="text-base font-display">CRICKET 2v2</div>
                      <div className="text-[10px] font-num font-normal opacity-80">Both batters must be out. Bowlers rotate overs.</div>
                    </div>
                  </div>
                  <ChevronRight className="w-5 h-5" />
                </button>

                {/* Baseball 1v1 */}
                <button
                  onClick={() => handleStartGame('baseball', '1v1')}
                  className="nb-btn nb-btn--blue w-full text-left flex items-center justify-between border-3"
                >
                  <div className="flex items-center gap-3">
                    <span className="text-2xl">⚾</span>
                    <div>
                      <div className="text-base font-display">BASEBALL 1v1</div>
                      <div className="text-[10px] font-num font-normal opacity-80">Diff of 1 = strike. 3 strikes = OUT. Equal = double.</div>
                    </div>
                  </div>
                  <ChevronRight className="w-5 h-5" />
                </button>

                {/* Baseball 2v2 */}
                <button
                  onClick={() => handleStartGame('baseball', '2v2')}
                  className="nb-btn nb-btn--ghost w-full text-left flex items-center justify-between border-3"
                >
                  <div className="flex items-center gap-3">
                    <span className="text-2xl">⚾</span>
                    <div>
                      <div className="text-base font-display">BASEBALL 2v2</div>
                      <div className="text-[10px] font-num font-normal opacity-80">Both batters out. Bowlers rotate by over.</div>
                    </div>
                  </div>
                  <ChevronRight className="w-5 h-5" />
                </button>
              </div>
            </div>
          </div>
        </main>
      </div>
    );
  }

  // ===================== PLAYING / GAME SCREEN =====================
  // Strictly bounded single-screen layout with ZERO scrolling on all devices
  return (
    <div className="h-screen max-h-screen overflow-hidden flex flex-col justify-between bg-[var(--bg-pitch)] p-2 sm:p-3 relative select-none">
      {/* Pitch down the center */}
      <div className="absolute inset-y-0 left-1/2 -translate-x-1/2 w-full max-w-xl bg-[#d4a373] dark:bg-[#583e26] border-x-4 border-black pointer-events-none z-0">
        {/* Cricket Stumps at the top */}
        <div className="absolute top-1.5 left-1/2 -translate-x-1/2 flex items-center gap-1.5 opacity-80">
          <div className="w-1.5 h-5 bg-black dark:bg-white rounded-t-sm" />
          <div className="w-1.5 h-5 bg-black dark:bg-white rounded-t-sm" />
          <div className="w-1.5 h-5 bg-black dark:bg-white rounded-t-sm" />
        </div>
      </div>

      {/* Top Header Bar */}
      <header className="relative z-10 w-full flex items-center justify-between flex-shrink-0 h-8 max-w-xl mx-auto">
        {/* Game Mode Pill */}
        <div className="flex items-center gap-1.5 px-2.5 py-0.5 bg-[var(--accent-lime)] border-2 sm:border-3 border-black font-num text-[11px] font-black text-black shadow-[2px_2px_0_0_#000]">
          <span>{match.mode === 'cricket' ? '🏏' : '⚾'}</span>
          <span>{match.mode === 'cricket' ? 'HAND CRICKET' : 'BASEBALL'} {match.format}</span>
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
      <main className="relative z-10 flex-1 flex flex-col justify-between max-w-xl mx-auto w-full min-h-0 py-1">
        {/* Toss Phase */}
        {(match.phase === 'toss_call' || match.phase === 'toss_throw' || match.phase === 'toss_result') && (
          <div className="flex-1 flex flex-col items-center justify-center">
            <TossScreen
              match={match}
              onCallToss={callToss}
              onThrowTossA={(val) => setPlayerThrow('team_a', val)}
              onThrowTossB={(val) => setPlayerThrow('team_b', val)}
              onChooseToss={chooseToss}
              pendingThrows={pendingThrows}
            />
          </div>
        )}

        {/* Innings Break */}
        {match.phase === 'innings_break' && (
          <div className="flex-1 flex items-center justify-center">
            <div className="nb-card bg-white p-5 text-center border-4 border-black max-w-sm w-full shadow-[6px_6px_0_0_#000]">
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
                onClick={startSecondInnings}
                className="nb-btn nb-btn--lime w-full text-sm border-3"
              >
                START CHASE →
              </button>
            </div>
          </div>
        )}

        {/* Match Result */}
        {match.phase === 'match_over' && (
          <div className="flex-1 flex items-center justify-center">
            <MatchResultScreen match={match} onPlayAgain={handleBackToLanding} />
          </div>
        )}

        {/* Live Match Gameplay */}
        {(match.phase === 'innings1' || match.phase === 'innings2') && (
          <div className="flex-1 flex flex-col justify-between min-h-0 gap-1.5 sm:gap-2">
            {/* 1. Scoreboard (sits on the pitch) */}
            <Scoreboard match={match} lastEvent={lastBallEvent} lives={lives} />

            {/* 2. Side-by-Side Video & Opponent Feeds */}
            <div className="grid grid-cols-2 gap-2 w-full flex-shrink-0">
              {/* Player 1 (You) Feed */}
              <div className="bg-white border-3 sm:border-4 border-black shadow-[4px_4px_0_0_#000] overflow-hidden flex flex-col h-[160px] sm:h-[185px]">
                {/* Yellow window bar */}
                <div className="bg-[#ffd60a] border-b-2 sm:border-b-3 border-black px-2 py-0.5 flex items-center justify-between text-black flex-shrink-0">
                  <span className="font-num text-[10px] font-black uppercase flex items-center gap-1 truncate max-w-[120px]">
                    <span className="w-2 h-2 rounded-full border border-black bg-white inline-block flex-shrink-0" />
                    {match.teamA.name} ({isTeamABatting ? 'BAT' : 'BOWL'})
                  </span>
                  {pendingThrows.teamA !== null ? (
                    <span className="font-num text-[9px] px-1 py-0.2 bg-[#a3f23d] border border-black font-black">
                      LOCKED
                    </span>
                  ) : userLastThrow !== null ? (
                    <span className="font-num text-[9px] px-1 py-0.2 bg-white border border-black font-black">
                      PLAYED: {userLastThrow}
                    </span>
                  ) : null}
                </div>

                {/* Webcam Box */}
                <div className="relative w-full flex-1 bg-black min-h-0">
                  <WebcamHandTracker
                    playerLabel={match.teamA.name}
                    isThrowRequired={pendingThrows.teamA === null}
                    onThrowConfirmed={(val) => setPlayerThrow('team_a', val)}
                  />
                </div>
              </div>

              {/* Player 2 (Opponent) Feed */}
              <div className="bg-white border-3 sm:border-4 border-black shadow-[4px_4px_0_0_#000] overflow-hidden flex flex-col h-[160px] sm:h-[185px]">
                {/* Pink window bar */}
                <div className="bg-[#ff6fb5] border-b-2 sm:border-b-3 border-black px-2 py-0.5 flex items-center justify-between text-black flex-shrink-0">
                  <span className="font-num text-[10px] font-black uppercase flex items-center gap-1 truncate max-w-[120px]">
                    <span className="w-2 h-2 rounded-full border border-black bg-white inline-block flex-shrink-0" />
                    {match.teamB.name} ({!isTeamABatting ? 'BAT' : 'BOWL'})
                  </span>
                  {pendingThrows.teamB !== null ? (
                    <span className="font-num text-[9px] px-1 py-0.2 bg-[#a3f23d] border border-black font-black">
                      READY
                    </span>
                  ) : oppLastThrow !== null ? (
                    <span className="font-num text-[9px] px-1 py-0.2 bg-white border border-black font-black">
                      PLAYED: {oppLastThrow}
                    </span>
                  ) : null}
                </div>

                {/* Opponent Display Box - CLEAR OPPONENT MOVE DISPLAY */}
                {opponentType === 'computer' ? (
                  <div className="relative w-full flex-1 bg-[#3b82f6] border-2 border-black flex flex-col items-center justify-center p-2 text-white min-h-0 select-none">
                    {oppLastThrow !== null ? (
                      <div className="flex flex-col items-center justify-center">
                        <div className="font-display text-5xl sm:text-6xl font-black text-white leading-none">
                          {oppLastThrow}
                        </div>
                        <div className="font-num text-[10px] font-black uppercase text-white/90 mt-1 bg-black/40 px-2 py-0.5 border border-white/20">
                          {match.teamB.name} THREW {oppLastThrow}
                        </div>
                      </div>
                    ) : (
                      <div className="flex flex-col items-center justify-center">
                        <div className="text-3xl mb-1">🤖</div>
                        <div className="font-num text-xs font-bold uppercase opacity-90">
                          {match.teamB.name} Ready
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="relative w-full flex-1 bg-[#f472b6] border-2 border-black flex flex-col items-center justify-center p-2 text-black min-h-0 select-none">
                    {oppLastThrow !== null ? (
                      <div className="flex flex-col items-center justify-center">
                        <div className="font-display text-5xl sm:text-6xl font-black text-black leading-none">
                          {oppLastThrow}
                        </div>
                        <div className="font-num text-[10px] font-black uppercase text-black/90 mt-1 bg-white/60 px-2 py-0.5 border border-black">
                          {match.teamB.name} THREW {oppLastThrow}
                        </div>
                      </div>
                    ) : (
                      <div className="flex flex-col items-center justify-center">
                        <div className="text-3xl mb-1">👤</div>
                        <div className="font-num text-xs font-bold uppercase">
                          Waiting for Friend
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* 3. Commentary Card (placed right below the video feeds) */}
            <CommentaryCard
              lastEvent={lastBallEvent}
              mode={match.mode}
              warningMessage={warningMessage}
            />

            {/* 4. Touch Keyboard Toggle Drawer */}
            <div className="relative flex justify-end flex-shrink-0">
              <button
                onClick={() => setShowTouchKeyboard(!showTouchKeyboard)}
                className="bg-white hover:bg-[#ffd60a] border-2 border-black px-2 py-0.5 font-num text-[10px] font-bold text-black shadow-[2px_2px_0_0_#000] flex items-center gap-1.5 cursor-pointer"
              >
                <Keyboard className="w-3 h-3" />
                <span>{showTouchKeyboard ? 'Hide keypad' : 'Touch keypad'}</span>
              </button>
            </div>

            {/* Pop-up Overlay Keyboard Fallback so it NEVER pushes layout */}
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
                  playerLabel={match.teamA.name}
                  selectedThrow={pendingThrows.teamA}
                  onThrow={(val) => {
                    setPlayerThrow('team_a', val);
                    setShowTouchKeyboard(false);
                  }}
                />
              </div>
            )}
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
            <p className="font-num text-[10px] text-[#ff3b30] mt-1.5">
              * Note: 0 (fist) is not a run throw. If no move is shown, you get a warning (2 lives limit).
            </p>
          </div>

          <div>
            <h4 className="font-display text-xs uppercase tracking-wider mb-1 text-black">
              RULES
            </h4>
            <ul className="space-y-1 text-xs font-body text-[#333] list-disc pl-4">
              <li><strong>Hold 1.5s:</strong> Keep your gesture steady to lock your throw.</li>
              <li><strong>Cricket:</strong> Batter scores their throw. If both throw the same number → OUT!</li>
              <li><strong>Baseball:</strong> Difference of 1 is a strike. 3 strikes = OUT! Same throw at 0 strikes = double runs!</li>
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
