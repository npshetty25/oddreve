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

/**
 * Robust finger extension check:
 * Works in both upright hand orientation and angled orientations.
 * In hand cricket, users face their hand towards the camera.
 * 1. Primary: Distance from wrist (0) to TIP is significantly greater than wrist to PIP.
 * 2. Secondary: Tip-to-MCP vector aligns with PIP-to-MCP vector and Tip is farther than PIP from MCP.
 * 3. Distance from TIP to MCP is greater than PIP to MCP.
 */
function isFingerExtended(
  landmarks: HandLandmark[],
  tipIdx: number,
  pipIdx: number,
  mcpIdx: number
): boolean {
  const wrist = landmarks[0];
  const tip = landmarks[tipIdx];
  const pip = landmarks[pipIdx];
  const mcp = landmarks[mcpIdx];

  const distTipWrist = Math.hypot(tip.x - wrist.x, tip.y - wrist.y);
  const distPipWrist = Math.hypot(pip.x - wrist.x, pip.y - wrist.y);

  const distTipMcp = Math.hypot(tip.x - mcp.x, tip.y - mcp.y);
  const distPipMcp = Math.hypot(pip.x - mcp.x, pip.y - mcp.y);

  // If tip is higher than PIP and MCP in vertical screen coordinates (smaller y = higher)
  const isUprightExtended = tip.y < pip.y && pip.y < mcp.y;

  // General distance check regardless of rotation
  const isDistExtended = distTipWrist > distPipWrist * 1.08 && distTipMcp > distPipMcp * 1.15;

  return isUprightExtended || isDistExtended;
}

/**
 * Robust thumb check:
 * - When making a fist, thumb is folded across the palm/fingers (tip is close to index/middle MCP).
 * - When extended (palm or thumbs up), thumb tip is spread far from index MCP (5) and pinky MCP (17).
 */
function isThumbExtended(landmarks: HandLandmark[]): boolean {
  const thumbTip = landmarks[4];
  const thumbIp = landmarks[3];
  const thumbMcp = landmarks[2];
  const indexMcp = landmarks[5];
  const wrist = landmarks[0];

  const distTipWrist = Math.hypot(thumbTip.x - wrist.x, thumbTip.y - wrist.y);
  const distMcpWrist = Math.hypot(thumbMcp.x - wrist.x, thumbMcp.y - wrist.y);
  const distTipIndexMcp = Math.hypot(thumbTip.x - indexMcp.x, thumbTip.y - indexMcp.y);

  // Thumbs up check: thumb tip is vertically above thumb MCP & wrist, and far from index
  const isThumbsUpOriented = thumbTip.y < thumbIp.y && thumbIp.y < thumbMcp.y && distTipIndexMcp > 0.08;

  const isSpread = distTipWrist > distMcpWrist * 1.05 && distTipIndexMcp > 0.10;

  return isThumbsUpOriented || isSpread;
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
  const thumbExt = isThumbExtended(landmarks);

  const mainFingersCount = (indexExt ? 1 : 0) + (middleExt ? 1 : 0) + (ringExt ? 1 : 0) + (pinkyExt ? 1 : 0);

  let throwVal: ThrowValue = 0;
  let label = 'Closed Fist (0)';

  // Case 6: Thumbs up -> Thumb extended, but zero or at most 1 slightly loose finger
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
