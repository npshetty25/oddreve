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

function distance(a: HandLandmark, b: HandLandmark): number {
  return Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);
}

/** Angle in degrees between vectors (a->b) and (b->c) turned at b: 0 = perfectly straight. */
function bendAngle(a: HandLandmark, b: HandLandmark, c: HandLandmark): number {
  const v1 = { x: b.x - a.x, y: b.y - a.y, z: b.z - a.z };
  const v2 = { x: c.x - b.x, y: c.y - b.y, z: c.z - b.z };
  const n1 = Math.hypot(v1.x, v1.y, v1.z);
  const n2 = Math.hypot(v2.x, v2.y, v2.z);
  if (n1 === 0 || n2 === 0) return 180;
  const cos = (v1.x * v2.x + v1.y * v2.y + v1.z * v2.z) / (n1 * n2);
  return (Math.acos(Math.max(-1, Math.min(1, cos))) * 180) / Math.PI;
}

// A finger counts as extended when it is straight at the PIP joint AND its tip is farther
// from the wrist than the PIP joint. Joint angles do not depend on how the hand is rotated
// or where it sits in the frame, unlike the old absolute distance ratios.
const FINGER_STRAIGHT_MAX_BEND = 55;

function isFingerExtended(
  landmarks: HandLandmark[],
  tipIdx: number,
  pipIdx: number,
  mcpIdx: number
): boolean {
  const bend = bendAngle(landmarks[mcpIdx], landmarks[pipIdx], landmarks[tipIdx]);
  const tipFarther = distance(landmarks[tipIdx], landmarks[0]) > distance(landmarks[pipIdx], landmarks[0]);
  return bend < FINGER_STRAIGHT_MAX_BEND && tipFarther;
}

// Thumb: tip must be well away from the index knuckle (measured against palm width, so it
// scales with hand size / camera distance) and farther from the pinky base than its IP joint.
function isThumbExtended(landmarks: HandLandmark[]): boolean {
  const palmWidth = distance(landmarks[5], landmarks[17]) || 1;
  const awayFromPalm = distance(landmarks[4], landmarks[5]) / palmWidth > 0.75;
  const pointsOut = distance(landmarks[4], landmarks[17]) > distance(landmarks[3], landmarks[17]) * 1.05;
  return awayFromPalm && pointsOut;
}

/**
 * Robust Hand Cricket Gesture Classifier:
 * Maps hand to exact game values 0 through 6:
 * - 0: Fist (0 extended fingers)
 * - 1: 1 finger extended (Index or Pinky)
 * - 2: 2 fingers extended (Index + Middle)
 * - 3: 3 fingers extended (Index + Middle + Ring). The thumb only matters for 5 and 6.
 * - 4: 4 fingers extended (All 4 fingers, thumb tucked)
 * - 5: Open Palm (All 5 fingers extended)
 * - 6: Thumbs Up (Thumb extended, all other 4 fingers folded into a fist)
 */
export function classifyHandGesture(
  landmarks: HandLandmark[],
  handScore: number = 0.9
): HandDetectionResult {
  if (!landmarks || landmarks.length < 21) {
    return {
      detected: false,
      fingerCount: null,
      confidence: 0,
      label: 'No hand detected',
    };
  }

  const indexExt = isFingerExtended(landmarks, 8, 6, 5);
  const middleExt = isFingerExtended(landmarks, 12, 10, 9);
  const ringExt = isFingerExtended(landmarks, 16, 14, 13);
  const pinkyExt = isFingerExtended(landmarks, 20, 18, 17);
  const mainFingersCount = (indexExt ? 1 : 0) + (middleExt ? 1 : 0) + (ringExt ? 1 : 0) + (pinkyExt ? 1 : 0);
  const thumbExt = isThumbExtended(landmarks);

  let throwVal: ThrowValue = 0;
  let label = 'Closed Fist (0)';

  // Case 6: Thumbs up -> Thumb extended, but no main fingers extended (or at most 0)
  if (thumbExt && mainFingersCount === 0) {
    throwVal = 6;
    label = 'Thumbs Up (6)';
  } else if (mainFingersCount === 4 && thumbExt) {
    // Case 5: 5 fingers -> Open Palm
    throwVal = 5;
    label = 'Open Palm (5)';
  } else if (mainFingersCount === 4) {
    // Case 4: 4 fingers extended, thumb folded
    throwVal = 4;
    label = 'Four (4)';
  } else if (mainFingersCount === 3) {
    throwVal = 3;
    label = 'Three (3)';
  } else if (mainFingersCount === 2) {
    throwVal = 2;
    label = 'Two (2)';
  } else if (mainFingersCount === 1) {
    throwVal = 1;
    label = 'One (1)';
  } else {
    throwVal = 0;
    label = 'Closed Fist (0)';
  }

  return {
    detected: true,
    fingerCount: throwVal,
    confidence: handScore,
    label,
    landmarks,
  };
}

/**
 * ThrowStabilizer requires consistent reading before lock-in so flicker doesn't register
 */
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
