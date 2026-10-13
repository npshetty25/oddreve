# ODDOREVE 🏏⚾

**ODDOREVE** is a next-generation browser-based hand cricket and baseball game powered by client-side MediaPipe landmark detection, pure TypeScript game mechanics, Zustand state management, and cryptographic anti-cheat multiplayer commitments.

Developed by [@npshetty25](https://github.com/npshetty25).

---

## ⚡ Quick Start

```bash
# Install dependencies
npm install

# Run unit tests (29 tests)
npm test

# Run local development server
npm run dev
```

Visit [http://localhost:3000](http://localhost:3000) in your browser.

---

## ✋ Hand Gestures & Landmark Detection (Values 0–6)

- **`0`**: Closed Fist (all fingers tucked)
- **`1`**: One (index finger extended)
- **`2`**: Two / Peace (index + middle fingers extended)
- **`3`**: Three (index + middle + ring extended)
- **`4`**: Four (four fingers extended, thumb folded)
- **`5`**: Open Palm (all 5 digits extended)
- **`6`**: Thumbs Up (upright thumb, other fingers folded)

> **Stabilizer Engine**: Enforces a ~280ms consistent hold to eliminate camera jitter before locking in a throw.
> **Accessible Fallback**: Integrated 0–6 quick tap buttons and keyboard shortcuts are always available if no camera is connected.

---

## 🎮 Game Modes

### 1. Cricket Mode
- **Toss**: One player calls Odd or Even; both throw. Sum determines the toss winner, who elects to Bat or Bowl.
- **Innings**: Batter scores their throw. If both throws match, the batter is **OUT**!
- **Target Chase**: Second innings chases `Target = First Innings Score + 1`.

### 2. Baseball Mode
- $|b - o| = 1 \implies$ **Strike** (3 strikes = OUT).
- $b = o$: If 0 strikes $\implies$ **Double Runs ($2 \times b$)**; if 1 strike $\implies$ counts as a Strike.
- Otherwise $\implies$ batter scores $b$ runs.

### 3. 2v2 Team Format (Until Both Batters Are Out)
- Two named players per team.
- Innings continues until both batters on the team are dismissed.
- Bowling alternates every over (every 6 balls).

### 4. 🤖 Play Against Computer
- Play solo matches against an automated bot that participates in tosses and throws simultaneously.

---

## 🌐 Anti-Cheat Online Multiplayer

- **Room Code**: Host creates a room and shares the 5-character code.
- **Cryptographic Commitments**:
  1. Each player submits a commitment hash: $\text{SHA-256}(throwValue + \text{":"} + nonce)$.
  2. Once both commitments arrive at the server, both players reveal their throw + nonce.
  3. The server validates that the reveals match their hashes before resolving the ball, preventing either player from waiting to see the other's hand.
- **Reconnection Window**: 30-second grace period before forfeiture.

---

## 🧪 Testing

```bash
npm test
```

Runs 29 tests across:
- Cricket rules & chase resolution
- Baseball strikes, doubles, and strike-out conditions
- 2v2 rotation and all-out state
- Vision classifier & stability filtering
- Multiplayer commitment-reveal cryptography and lobby state transitions
