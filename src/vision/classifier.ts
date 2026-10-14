import { ThrowValue } from '../engine/types';

export interface HandLandmark {
  x: number;
  y: number;
  z: number;
}

export interface HandDetectionResult {
  detected: boolean;
  fingerCount: ThrowValue | null;
  confidence: number;
  label: string; // e.g. "Fist (0)", "Four (4)", "Open Palm (5)", "Thumbs Up (6)"
  landmarks?: HandLandmark[];
}

// Distance in the image plane, exactly as the original handcricketomegle game does it.
function distance(a: HandLandmark, b: HandLandmark): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

/**
 * Finger counting identical to the reference game (which reads reliably in practice):
 * - index/middle/ring/pinky are "up" when the tip is > 1.3x as far from the wrist as the knuckle
 * - the thumb is "out" when its tip is > 1.05x as far from the pinky base as its IP joint
 * - no fingers: thumb out => 6 (thumbs up), otherwise 0 (fist)
 * - four fingers + thumb => 5 (open palm); otherwise the finger count (1-4)
 */
export function classifyHandGesture(
  landmarks: HandLandmark[],
  handScore: number = 0.9
): HandDetectionResult {
  if (!landmarks || landmarks.length < 21) {
    return { detected: false, fingerCount: null, confidence: 0, label: 'No hand detected' };
  }

  const wrist = landmarks[0];
  let up = 0;
  for (const [tip, knuckle] of [[8, 5], [12, 9], [16, 13], [20, 17]]) {
    if (distance(landmarks[tip], wrist) > 1.3 * distance(landmarks[knuckle], wrist)) up += 1;
  }
  const thumbOut = distance(landmarks[4], landmarks[17]) > 1.05 * distance(landmarks[3], landmarks[17]);

  let value: ThrowValue;
  let label: string;
  if (up === 0) {
    value = thumbOut ? 6 : 0;
    label = thumbOut ? 'Thumbs Up (6)' : 'Closed Fist (0)';
  } else if (up === 4 && thumbOut) {
    value = 5;
    label = 'Open Palm (5)';
  } else {
    value = up as ThrowValue;
    label = ['', 'One (1)', 'Two (2)', 'Three (3)', 'Four (4)'][up];
  }

  return { detected: true, fingerCount: value, confidence: handScore, label, landmarks };
}

/**
 * Majority-vote smoothing over a short sliding window. A single misclassified frame (or a
 * finger count passing through 3 or 4 on the way to 5) can no longer start a throw.
 */
export class GestureSmoother {
  private samples: { value: ThrowValue; t: number }[] = [];

  constructor(
    private windowMs = 450,
    private minSamples = 6,
    private minShare = 0.75
  ) {}

  public push(value: ThrowValue | null, now: number = Date.now()): ThrowValue | null {
    if (value === null) {
      this.samples = [];
      return null;
    }
    this.samples.push({ value, t: now });
    this.samples = this.samples.filter((s) => now - s.t <= this.windowMs);
    if (this.samples.length < this.minSamples) return null;

    const counts = new Map<ThrowValue, number>();
    for (const s of this.samples) counts.set(s.value, (counts.get(s.value) ?? 0) + 1);
    let best: ThrowValue | null = null;
    let bestCount = 0;
    counts.forEach((c, v) => {
      if (c > bestCount) {
        best = v;
        bestCount = c;
      }
    });
    return bestCount / this.samples.length >= this.minShare ? best : null;
  }

  public reset(): void {
    this.samples = [];
  }
}

export class ThrowStabilizer {
  private currentCandidate: ThrowValue | null = null;
  private candidateStartTime: number = 0;
  private stableThrow: ThrowValue | null = null;
  private holdDurationMs: number;

  constructor(holdDurationMs = 280) {
    this.holdDurationMs = holdDurationMs;
  }

  public update(rawValue: ThrowValue | null, now: number = Date.now()): {
    stableValue: ThrowValue | null;
    progress: number;
    currentCandidate: ThrowValue | null;
  } {
    if (rawValue === null) {
      this.currentCandidate = null;
      this.candidateStartTime = 0;
      this.stableThrow = null;
      return { stableValue: null, progress: 0, currentCandidate: null };
    }

    if (rawValue !== this.currentCandidate) {
      this.currentCandidate = rawValue;
      this.candidateStartTime = now;
      this.stableThrow = null;
      return { stableValue: null, progress: 0, currentCandidate: rawValue };
    }

    const elapsed = now - this.candidateStartTime;
    const progress = Math.min(1, elapsed / this.holdDurationMs);

    if (elapsed >= this.holdDurationMs) {
      this.stableThrow = rawValue;
    }

    return {
      stableValue: this.stableThrow,
      progress,
      currentCandidate: this.currentCandidate,
    };
  }

  public reset(): void {
    this.currentCandidate = null;
    this.candidateStartTime = 0;
    this.stableThrow = null;
  }
}
