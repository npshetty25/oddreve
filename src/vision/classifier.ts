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
  return Math.hypot(a.x - b.x, a.y - b.y);
}

// Compare each fingertip with its own knuckle so a tilted hand is classified
// by shape rather than by its absolute y-position in the camera frame.
function isFingerExtended(
  landmarks: HandLandmark[],
  tipIdx: number,
  pipIdx: number,
  mcpIdx: number
): boolean {
  const tipPastKnuckle = distance(landmarks[tipIdx], landmarks[0]) > distance(landmarks[mcpIdx], landmarks[0]) * 1.3;
  const tipPastJoint = distance(landmarks[tipIdx], landmarks[mcpIdx]) > distance(landmarks[pipIdx], landmarks[mcpIdx]) * 1.25;
  return tipPastKnuckle && tipPastJoint;
}

function isThumbExtended(landmarks: HandLandmark[]): boolean {
  return distance(landmarks[4], landmarks[17]) > distance(landmarks[3], landmarks[17]) * 1.05;
}

/**
 * Robust Hand Cricket Gesture Classifier:
 * Maps hand to exact game values 0 through 6:
 * - 0: Fist (0 extended fingers)
 * - 1: 1 finger extended (Index or Pinky)
 * - 2: 2 fingers extended (Index + Middle)
 * - 3: 3 fingers extended (Index + Middle + Ring or Thumb + Index + Middle)
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
  } else if (mainFingersCount === 2 && thumbExt) {
    // Some people show 3 as thumb + index + middle
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
