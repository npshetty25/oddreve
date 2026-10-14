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

---

## 🌐 Playing with friends (peer-to-peer)

Friend matches are **peer-to-peer WebRTC** (PeerJS). There is no game server or database:
the host's browser runs the room and the guest connects straight to it, so it works on any
static/serverless host (Vercel included) with nothing to configure.

- The host creates a room and shares the 5-letter code or invite link.
- The host must keep the game tab open for the whole match (if they leave, the room ends).
- Both players see each other's live video in 1v1. 2v2 shares game data only.
- Every ball uses a synchronized **3 - 2 - 1** countdown; each camera's most common reading
  from the last 600 ms is submitted at "GO", so both throws happen at the same moment.

### TURN relay (for strict networks)

Most connections are direct. Some corporate/mobile networks need a TURN relay. Out of the box
the app falls back to a shared public relay (best-effort, rate limited). For reliable results
create a free TURN account (e.g. Metered.ca Open Relay or Cloudflare Calls) and set:

```bash
NEXT_PUBLIC_TURN_URL=turn:your-turn-host:443,turn:your-turn-host:443?transport=tcp
NEXT_PUBLIC_TURN_USERNAME=your-username
NEXT_PUBLIC_TURN_CREDENTIAL=your-credential
```

These are public (browser-side) values, so use a TURN credential meant for client use.
