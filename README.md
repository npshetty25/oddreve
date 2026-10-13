# HandCricket Friends 🏏⚾

A modern, browser-based hand cricket & baseball game where players throw 0–6 fingers at their webcam, powered by client-side MediaPipe landmark detection, pure unit-tested game engines, Zustand state management, and cryptographic anti-cheat multiplayer commitments.

---

## 🚀 Quick Setup & Running Locally

1. **Install dependencies**:
   ```bash
   npm install
   ```
2. **Run tests**:
   ```bash
   npm test
   ```
3. **Start local development server**:
   ```bash
   npm run dev
   ```
4. Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## ✋ Hand Gestures & Detection (Values 0–6)
- `0`: **Closed Fist** (all fingers folded)
- `1`: **One** (Index finger extended)
- `2`: **Two / Peace** (Index + Middle extended)
- `3`: **Three** (Index + Middle + Ring extended)
- `4`: **Four** (All 4 main fingers extended, thumb folded)
- `5`: **Open Palm** (All 5 digits extended: 4 fingers + thumb)
- `6`: **Thumbs Up** (Thumb extended upright, 4 fingers curled)

> **Stability Filter**: The app enforces a **300ms continuous hold** of the gesture before locking in a throw, preventing camera flicker from registering accidental inputs.
> **Keyboard Fallback**: If no camera is available or permissions are declined, players can use keys `0`–`6` (or `Q`–`U` for Player 2) directly on screen.

---

## 🎮 Game Modes

### 1. Cricket Mode (1v1 & 2v2)
- **Toss**: Players call Odd/Even and throw. Toss winner selects Bat or Bowl.
- **Innings**:
  - Batter throws $b$, Bowler throws $o$.
  - If $b = o$: **OUT!** Batter is dismissed.
  - If $b \ne o$: Batter scores $b$ runs.
- **Target Chase**: Second innings chases `Target = First Innings Score + 1`. Matches can be won, lost, or tied!

### 2. Baseball Mode
- If $|b - o| = 1$: **Strike!**
- If $b = o$:
  - Batter with **0 strikes**: Scores **$2 \times b$ runs (Double!)**.
  - Batter with **1 strike**: Counts as a **Strike** instead of a double.
- Otherwise: Batter scores $b$ runs.
- **Three Strikes = OUT!**

### 3. 2v2 Teams & Over Format
- Configurable overs (default 2 overs = 12 balls).
- Bowlers alternate each over (every 6 balls).
- Next teammate bats when active batter gets out. All out when both batters are dismissed.
- Tracks player stats: runs, balls faced, wickets taken, and runs conceded.

---

## 🌐 Phase 4: Online Multiplayer Architecture
- **Room Code**: Host creates a room with code; friends join from another browser or device.
- **Simultaneous Throws & Anti-Cheat**:
  - Each player commits a hash: `SHA-256(throwValue + ":" + nonce)`.
  - Once both commitments arrive, players reveal `throwValue` and `nonce`.
  - The server verifies matching hashes before resolving the ball, ensuring neither player can react to the other's choice.
- **Reconnection Handling**: 30-second grace period for disconnected players before match forfeiture.

---

## 🧪 Unit Tests Suite
Run Vitest with:
```bash
npm test
```
Includes 29 tests covering:
- Toss resolution (odd/even, winner assignment)
- Cricket rules (out on equal throws, run accumulation, chase win, chase loss, tie)
- Baseball rules (strike differences, doubles with 0 strikes, equal throws with 1 strike, strike 3 out)
- 2v2 rotation (over counting 1.5 → 2.0, bowler alternation, batter rotation, all-out)
- Gesture classifier & 300ms stabilization
- Multiplayer commitment & reveal cryptographic verification, room lobbies, and 30s reconnection window.
