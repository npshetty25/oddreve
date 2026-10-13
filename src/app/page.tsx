'use client';

import React, { useState } from 'react';
import { useGameStore } from '@/store/useGameStore';
import { Scoreboard } from '@/components/Scoreboard';
import { TossScreen } from '@/components/TossScreen';
import { MatchResultScreen } from '@/components/MatchResultScreen';
import { WebcamHandTracker } from '@/components/WebcamHandTracker';
import { KeyboardFallback } from '@/components/KeyboardFallback';
import { MultiplayerLobby } from '@/components/MultiplayerLobby';
import {
  HelpCircle,
  X,
  Play,
  RotateCcw,
  Bot,
  User,
  Users,
  Wifi,
  Sparkles,
  Globe,
  Camera,
  Layers,
} from 'lucide-react';

function GithubIcon({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M15 22v-4a4.8 4.8 0 0 0-1-3.5c3 0 6-2 6-5.5.08-1.25-.27-2.48-1-3.5.28-1.15.28-2.35 0-3.5 0 0-1 0-3 1.5-2.64-.5-5.36-.5-8 0C6 2 5 2 5 2c-.3 1.15-.3 2.35 0 3.5A5.403 5.403 0 0 0 4 9c0 3.5 3 5.5 6 5.5-.39.49-.68 1.05-.85 1.65-.17.6-.22 1.23-.15 1.85v4" />
      <path d="M9 18c-4.51 2-5-2-7-2" />
    </svg>
  );
}

export default function Home() {
  const {
    match,
    opponentType,
    lastBallEvent,
    pendingThrows,
    setMode,
    setFormat,
    setOpponentType,
    callToss,
    chooseToss,
    setPlayerThrow,
    startSecondInnings,
    resetMatch,
    initMatch,
  } = useGameStore();

  const [activeTab, setActiveTab] = useState<'play' | 'online'>('play');
  const [showHowToPlay, setShowHowToPlay] = useState<boolean>(false);

  const currentInnings = match.phase === 'innings2' ? match.innings2 : match.innings1;
  const isTeamABatting = currentInnings?.battingTeamId === match.teamA.id;

  return (
    <div className="min-h-screen bg-[#07090e] stadium-grid text-slate-100 flex flex-col justify-between selection:bg-cyan-500 selection:text-black relative">
      {/* Background Ambient Glows */}
      <div className="fixed top-0 left-1/2 -translate-x-1/2 w-[800px] h-[350px] ambient-glow-cyan pointer-events-none -z-10" />
      <div className="fixed bottom-0 right-0 w-[500px] h-[350px] ambient-glow-purple pointer-events-none -z-10" />

      {/* Top Navbar */}
      <header className="w-full border-b border-slate-800/80 bg-slate-950/75 backdrop-blur-xl px-4 sm:px-6 py-3.5 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-3">
          {/* Logo Brand */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-cyan-500 to-emerald-400 p-[1.5px] shadow-lg shadow-cyan-500/20">
              <div className="w-full h-full bg-[#07090e] rounded-2xl flex items-center justify-center">
                <span className="font-heading font-black text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-emerald-400 text-sm">
                  ODD
                </span>
              </div>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="font-heading font-black text-lg tracking-wider text-white">
                  ODDOREVE
                </h1>
                <span className="px-2 py-0.5 rounded-full text-[9px] font-mono font-bold bg-cyan-950 text-cyan-400 border border-cyan-800/60">
                  v2.0
                </span>
              </div>
              <p className="text-[11px] text-slate-400 font-sans hidden sm:block">
                Webcam & Landmark Powered Hand Cricket
              </p>
            </div>
          </div>

          {/* Controls Cluster */}
          <div className="flex flex-wrap items-center gap-2">
            {/* Opponent Selector */}
            <div className="flex rounded-xl bg-slate-900/90 border border-slate-800 p-0.5">
              <button
                onClick={() => setOpponentType('computer')}
                className={`px-3 py-1 rounded-lg text-xs font-heading transition-all ${
                  opponentType === 'computer'
                    ? 'bg-gradient-to-r from-cyan-500 to-blue-600 text-black font-black shadow-md shadow-cyan-500/20'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                🤖 Computer
              </button>
              <button
                onClick={() => setOpponentType('human')}
                className={`px-3 py-1 rounded-lg text-xs font-heading transition-all ${
                  opponentType === 'human'
                    ? 'bg-gradient-to-r from-cyan-500 to-blue-600 text-black font-black shadow-md shadow-cyan-500/20'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                👥 Local 1v1
              </button>
            </div>

            {/* Mode Switcher */}
            <div className="flex rounded-xl bg-slate-900/90 border border-slate-800 p-0.5">
              <button
                onClick={() => setMode('cricket')}
                className={`px-3 py-1 rounded-lg text-xs font-heading transition-all ${
                  match.mode === 'cricket'
                    ? 'bg-emerald-500 text-black font-black shadow-md shadow-emerald-500/20'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                🏏 Cricket
              </button>
              <button
                onClick={() => setMode('baseball')}
                className={`px-3 py-1 rounded-lg text-xs font-heading transition-all ${
                  match.mode === 'baseball'
                    ? 'bg-amber-500 text-black font-black shadow-md shadow-amber-500/20'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                ⚾ Baseball
              </button>
            </div>

            {/* Format Switcher */}
            <div className="flex rounded-xl bg-slate-900/90 border border-slate-800 p-0.5">
              <button
                onClick={() => setFormat('1v1')}
                className={`px-3 py-1 rounded-lg text-xs font-heading transition-all ${
                  match.format === '1v1'
                    ? 'bg-purple-500 text-white font-black shadow-md shadow-purple-500/20'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                1v1
              </button>
              <button
                onClick={() => setFormat('2v2')}
                className={`px-3 py-1 rounded-lg text-xs font-heading transition-all ${
                  match.format === '2v2'
                    ? 'bg-purple-500 text-white font-black shadow-md shadow-purple-500/20'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                2v2 (Until Out)
              </button>
            </div>

            {/* Online Tab Switcher */}
            <button
              onClick={() => setActiveTab(activeTab === 'play' ? 'online' : 'play')}
              className={`cyber-btn px-3 py-1.5 rounded-xl text-xs font-heading flex items-center gap-1.5 border ${
                activeTab === 'online'
                  ? 'bg-cyan-500 text-black border-cyan-400 shadow-md shadow-cyan-500/30'
                  : 'bg-slate-900 hover:bg-slate-800 text-slate-300 border-slate-800'
              }`}
            >
              <Wifi className="w-3.5 h-3.5" />
              <span>{activeTab === 'online' ? 'Arena' : 'Online Rooms'}</span>
            </button>

            {/* Rules Modal Button */}
            <button
              onClick={() => setShowHowToPlay(true)}
              className="p-2 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-300 hover:text-white transition-all"
              title="How to play"
            >
              <HelpCircle className="w-4 h-4" />
            </button>

            {/* Reset Button */}
            <button
              onClick={resetMatch}
              className="p-2 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-300 hover:text-white transition-all"
              title="Reset match"
            >
              <RotateCcw className="w-4 h-4" />
            </button>

            {/* GitHub Profile Link */}
            <a
              href="https://github.com/npshetty25"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-800 text-xs font-mono font-semibold text-slate-300 hover:text-white transition-all"
            >
              <GithubIcon className="w-3.5 h-3.5 text-cyan-400" />
              <span>npshetty25</span>
            </a>
          </div>
        </div>
      </header>

      {/* Main Game Stage */}
      <main className="w-full max-w-7xl mx-auto px-4 sm:px-6 py-6 flex-1 flex flex-col justify-center gap-6">
        {activeTab === 'online' ? (
          <MultiplayerLobby
            onStartRoomGame={(roomManager) => {
              const rState = roomManager.getRoomState();
              if (rState.match) {
                initMatch({
                  mode: rState.mode,
                  format: rState.format,
                  maxOvers: rState.maxOvers,
                  teamAName: rState.match.teamA.name,
                  teamBName: rState.match.teamB.name,
                });
                setActiveTab('play');
              }
            }}
          />
        ) : match.phase === 'toss_call' ||
          match.phase === 'toss_throw' ||
          match.phase === 'toss_result' ? (
          <div className="flex flex-col gap-6 items-center">
            <TossScreen
              match={match}
              onCallToss={callToss}
              onThrowTossA={(val) => setPlayerThrow('team_a', val)}
              onThrowTossB={(val) => setPlayerThrow('team_b', val)}
              onChooseToss={chooseToss}
              pendingThrows={pendingThrows}
            />

            {/* During toss_throw, show camera for immediate engagement */}
            {match.phase === 'toss_throw' && (
              <div className="w-full max-w-sm flex flex-col gap-3">
                <WebcamHandTracker
                  playerLabel={match.teamA.name}
                  isThrowRequired={pendingThrows.teamA === null}
                  onThrowConfirmed={(val) => setPlayerThrow('team_a', val)}
                />
                <KeyboardFallback
                  playerLabel={match.teamA.name}
                  selectedThrow={pendingThrows.teamA}
                  onThrow={(val) => setPlayerThrow('team_a', val)}
                />
              </div>
            )}
          </div>
        ) : match.phase === 'innings_break' ? (
          <div className="w-full max-w-md mx-auto cyber-card rounded-3xl p-8 text-center animate-in fade-in zoom-in-95 border-amber-500/30">
            <div className="text-xs font-mono font-bold text-amber-400 uppercase tracking-widest mb-2">
              Innings Interval
            </div>
            <h2 className="font-heading font-black text-3xl text-white mb-2">
              {match.innings1.battingTeamId === match.teamA.id
                ? match.teamA.name
                : match.teamB.name}{' '}
              Scored {match.innings1.score} Runs!
            </h2>
            <div className="p-4 rounded-2xl bg-amber-950/40 border border-amber-500/30 text-amber-300 font-heading font-bold text-lg my-4">
              Target for{' '}
              <span className="text-white">
                {match.innings1.bowlingTeamId === match.teamA.id
                  ? match.teamA.name
                  : match.teamB.name}
              </span>{' '}
              is <span className="text-amber-400 font-mono text-2xl">{match.target} runs</span>
            </div>
            <button
              onClick={startSecondInnings}
              className="cyber-btn w-full py-4 rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-400 hover:from-emerald-400 hover:to-teal-300 text-black font-heading font-black text-lg tracking-wider shadow-xl shadow-emerald-500/20 border border-emerald-400/40"
            >
              START 2ND INNINGS CHASE
            </button>
          </div>
        ) : match.phase === 'match_over' ? (
          <MatchResultScreen match={match} onPlayAgain={resetMatch} />
        ) : (
          /* Live Match Screen */
          <div className="w-full flex flex-col gap-6 items-center">
            <Scoreboard match={match} lastEvent={lastBallEvent} />

            {/* 2-Player Interactive Stadium Grid */}
            <div className="w-full max-w-4xl grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
              {/* Player 1 Card (Webcam + Fallback) */}
              <div className="cyber-card rounded-3xl p-5 border-slate-800 flex flex-col gap-3">
                <div className="flex items-center justify-between pb-2 border-b border-slate-800">
                  <div>
                    <h3 className="font-heading font-black text-base text-white">
                      {match.teamA.name}
                    </h3>
                    <span className="text-[11px] font-mono text-slate-400">
                      Role:{' '}
                      <strong className={isTeamABatting ? 'text-emerald-400' : 'text-cyan-400'}>
                        {isTeamABatting ? 'BATTER' : 'BOWLER'}
                      </strong>
                    </span>
                  </div>

                  <span
                    className={`px-3 py-1 rounded-xl text-xs font-mono font-bold border ${
                      pendingThrows.teamA !== null
                        ? 'bg-cyan-950 text-cyan-400 border-cyan-500/40 shadow-sm shadow-cyan-500/20'
                        : 'bg-slate-900 text-slate-400 border-slate-800 animate-pulse'
                    }`}
                  >
                    {pendingThrows.teamA !== null
                      ? `Locked: ${pendingThrows.teamA}`
                      : 'Show Hand 0–6'}
                  </span>
                </div>

                <WebcamHandTracker
                  playerLabel={match.teamA.name}
                  isThrowRequired={pendingThrows.teamA === null}
                  onThrowConfirmed={(val) => setPlayerThrow('team_a', val)}
                />

                <KeyboardFallback
                  playerLabel={match.teamA.name}
                  selectedThrow={pendingThrows.teamA}
                  onThrow={(val) => setPlayerThrow('team_a', val)}
                />
              </div>

              {/* Player 2 or Computer Card */}
              <div className="cyber-card rounded-3xl p-5 border-slate-800 flex flex-col gap-3">
                <div className="flex items-center justify-between pb-2 border-b border-slate-800">
                  <div>
                    <h3 className="font-heading font-black text-base text-white">
                      {match.teamB.name}
                    </h3>
                    <span className="text-[11px] font-mono text-slate-400">
                      Role:{' '}
                      <strong className={!isTeamABatting ? 'text-emerald-400' : 'text-purple-400'}>
                        {!isTeamABatting ? 'BATTER' : 'BOWLER'}
                      </strong>
                    </span>
                  </div>

                  <span
                    className={`px-3 py-1 rounded-xl text-xs font-mono font-bold border ${
                      pendingThrows.teamB !== null
                        ? 'bg-purple-950 text-purple-400 border-purple-500/40'
                        : 'bg-slate-900 text-slate-400 border-slate-800'
                    }`}
                  >
                    {pendingThrows.teamB !== null
                      ? `Ready: ${opponentType === 'computer' ? '🤖' : pendingThrows.teamB}`
                      : 'Awaiting Hand'}
                  </span>
                </div>

                {opponentType === 'computer' ? (
                  <div className="w-full aspect-square rounded-2xl bg-gradient-to-b from-slate-900 to-slate-950 border border-slate-800 flex flex-col items-center justify-center p-6 text-center relative overflow-hidden">
                    <div className="w-20 h-20 rounded-3xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-4xl mb-3 shadow-lg shadow-purple-500/10">
                      🤖
                    </div>
                    <h4 className="font-heading font-black text-lg text-white uppercase tracking-wider mb-1">
                      AI Opponent Active
                    </h4>
                    <p className="text-xs text-slate-400 max-w-xs font-sans">
                      Simultaneous throw resolves in real time as soon as your webcam gesture locks.
                    </p>
                    {pendingThrows.teamB !== null && (
                      <div className="mt-4 px-4 py-1.5 rounded-full bg-purple-950 text-purple-400 border border-purple-500/30 text-xs font-mono font-bold">
                        Computer Ready
                      </div>
                    )}
                  </div>
                ) : (
                  <>
                    <div className="w-full aspect-square rounded-2xl bg-slate-950 border border-slate-800 flex flex-col items-center justify-center p-6 text-center">
                      <div className="text-3xl mb-2">👤</div>
                      <div className="font-heading font-black text-base text-white uppercase mb-1">
                        Player 2 Controls
                      </div>
                      <p className="text-xs text-slate-400 font-sans">
                        Use the 0–6 buttons below to enter Player 2 throw
                      </p>
                      {pendingThrows.teamB !== null && (
                        <div className="font-mono text-5xl font-black text-purple-400 mt-4">
                          {pendingThrows.teamB}
                        </div>
                      )}
                    </div>

                    <KeyboardFallback
                      playerLabel={match.teamB.name}
                      selectedThrow={pendingThrows.teamB}
                      onThrow={(val) => setPlayerThrow('team_b', val)}
                    />
                  </>
                )}
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Cyber Footer */}
      <footer className="w-full border-t border-slate-800/80 bg-slate-950/80 backdrop-blur-md px-4 py-3">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-2 text-xs font-mono text-slate-400">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span>ODDOREVE Engine Live</span>
            <span>•</span>
            <span>AI Landmark Recognition</span>
          </div>

          <div className="flex items-center gap-3">
            <span>Built by</span>
            <a
              href="https://github.com/npshetty25"
              target="_blank"
              rel="noopener noreferrer"
              className="text-cyan-400 font-bold hover:underline flex items-center gap-1"
            >
              <GithubIcon className="w-3.5 h-3.5" />
              <span>@npshetty25</span>
            </a>
          </div>
        </div>
      </footer>

      {/* Modern How to Play Dialog */}
      {showHowToPlay && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-50 flex items-center justify-center p-4 animate-in fade-in">
          <div className="w-full max-w-lg cyber-card rounded-3xl p-6 sm:p-8 max-h-[90vh] overflow-y-auto border-cyan-500/30">
            <div className="flex items-center justify-between pb-4 border-b border-slate-800 mb-5">
              <div className="flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-cyan-400" />
                <h3 className="font-heading font-black text-lg text-white uppercase tracking-wider">
                  How To Play ODDOREVE
                </h3>
              </div>
              <button
                onClick={() => setShowHowToPlay(false)}
                className="p-1.5 rounded-xl bg-slate-900 border border-slate-800 text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs sm:text-sm text-slate-300 leading-relaxed mb-5">
              ODDOREVE is the classic hand cricket game played over webcam. The browser AI reads your
              finger gesture in real time with anti-cheat lock-in so nobody argues over throws.
            </p>

            <h4 className="font-heading font-bold text-xs uppercase tracking-wider text-cyan-400 mb-2">
              Valid Gesture Throws (0–6)
            </h4>
            <div className="grid grid-cols-2 gap-2 text-xs font-mono mb-5">
              <div className="p-2.5 rounded-xl bg-slate-900/90 border border-slate-800">
                <strong className="text-white">1–4:</strong> fingers extended
              </div>
              <div className="p-2.5 rounded-xl bg-slate-900/90 border border-slate-800">
                <strong className="text-white">5:</strong> open palm
              </div>
              <div className="p-2.5 rounded-xl bg-slate-900/90 border border-slate-800">
                <strong className="text-white">6:</strong> thumbs up
              </div>
              <div className="p-2.5 rounded-xl bg-slate-900/90 border border-slate-800">
                <strong className="text-white">0:</strong> closed fist
              </div>
            </div>

            <h4 className="font-heading font-bold text-xs uppercase tracking-wider text-cyan-400 mb-2">
              Match Rules
            </h4>
            <ul className="space-y-1.5 text-xs text-slate-300 font-sans mb-6 list-disc pl-4">
              <li>
                <strong>Toss:</strong> Call odd or even, both throw, winner chooses bat or bowl.
              </li>
              <li>
                <strong>Cricket Batting:</strong> Batter scores whatever they threw. If both throw the same number, batter is OUT!
              </li>
              <li>
                <strong>Baseball Mode:</strong> Differences of 1 are strikes (3 strikes = OUT). Throws of the same number with 0 strikes score double!
              </li>
              <li>
                <strong>2v2 Format:</strong> Both batters must be dismissed before the innings ends.
              </li>
            </ul>

            <button
              onClick={() => setShowHowToPlay(false)}
              className="cyber-btn w-full py-3.5 rounded-2xl bg-cyan-500 hover:bg-cyan-400 text-black font-heading font-black text-sm uppercase tracking-wider"
            >
              GOT IT, LET'S PLAY!
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
