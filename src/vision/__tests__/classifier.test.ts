import { describe, it, expect } from 'vitest';
import { classifyHandGesture, ThrowStabilizer, GestureSmoother, HandLandmark } from '../classifier';

// Helper to build mock landmarks: wrist at (0.5, 0.8)
function createMockLandmarks(options: {
  thumbExt?: boolean;
  indexExt?: boolean;
  middleExt?: boolean;
  ringExt?: boolean;
  pinkyExt?: boolean;
}): HandLandmark[] {
  const wrist: HandLandmark = { x: 0.5, y: 0.8, z: 0 };
  const landmarks: HandLandmark[] = Array(21).fill(null).map(() => ({ x: 0.5, y: 0.8, z: 0 }));
  landmarks[0] = wrist;

  // Thumb: 0 (wrist), 2 (MCP), 3 (IP), 4 (TIP), 5 (index MCP)
  landmarks[2] = { x: 0.45, y: 0.7, z: 0 };
  landmarks[5] = { x: 0.46, y: 0.6, z: 0 }; // index MCP
  if (options.thumbExt) {
    landmarks[4] = { x: 0.25, y: 0.5, z: 0 }; // far from wrist & index MCP
  } else {
    landmarks[4] = { x: 0.48, y: 0.62, z: 0 }; // folded against index MCP
  }

  // Fingers setup
  const setFinger = (tipIdx: number, pipIdx: number, mcpIdx: number, ext: boolean, xOffset: number) => {
    landmarks[mcpIdx] = { x: xOffset, y: 0.6, z: 0 };
    landmarks[pipIdx] = { x: xOffset, y: 0.5, z: 0 };
    if (ext) {
      landmarks[tipIdx] = { x: xOffset, y: 0.2, z: 0 }; // high above PIP and MCP (far from wrist)
    } else {
      landmarks[tipIdx] = { x: xOffset, y: 0.55, z: 0 }; // folded down near MCP
    }
  };

  setFinger(8, 6, 5, !!options.indexExt, 0.46);
  setFinger(12, 10, 9, !!options.middleExt, 0.50);
  setFinger(16, 14, 13, !!options.ringExt, 0.54);
  setFinger(20, 18, 17, !!options.pinkyExt, 0.58);

  return landmarks;
}

describe('Vision Classifier & Stabilization', () => {
  it('classifies closed fist as 0', () => {
    const lms = createMockLandmarks({
      thumbExt: false,
      indexExt: false,
      middleExt: false,
      ringExt: false,
      pinkyExt: false,
    });
    const res = classifyHandGesture(lms);
    expect(res.fingerCount).toBe(0);
    expect(res.label).toBe('Closed Fist (0)');
  });

  it('classifies thumbs up as 6', () => {
    const lms = createMockLandmarks({
      thumbExt: true,
      indexExt: false,
      middleExt: false,
      ringExt: false,
      pinkyExt: false,
    });
    const res = classifyHandGesture(lms);
    expect(res.fingerCount).toBe(6);
    expect(res.label).toBe('Thumbs Up (6)');
  });

  it('classifies open palm as 5', () => {
    const lms = createMockLandmarks({
      thumbExt: true,
      indexExt: true,
      middleExt: true,
      ringExt: true,
      pinkyExt: true,
    });
    const res = classifyHandGesture(lms);
    expect(res.fingerCount).toBe(5);
    expect(res.label).toBe('Open Palm (5)');
  });

  it('classifies 1 to 4 fingers accurately', () => {
    const lms1 = createMockLandmarks({ thumbExt: false, indexExt: true });
    expect(classifyHandGesture(lms1).fingerCount).toBe(1);

    const lms2 = createMockLandmarks({ thumbExt: false, indexExt: true, middleExt: true });
    expect(classifyHandGesture(lms2).fingerCount).toBe(2);

    const lms3 = createMockLandmarks({ thumbExt: false, indexExt: true, middleExt: true, ringExt: true });
    expect(classifyHandGesture(lms3).fingerCount).toBe(3);

    const lms4 = createMockLandmarks({ thumbExt: false, indexExt: true, middleExt: true, ringExt: true, pinkyExt: true });
    expect(classifyHandGesture(lms4).fingerCount).toBe(4);
  });

  it('does not count a partially curled ring finger as a third finger', () => {
    const landmarks = createMockLandmarks({ thumbExt: false, indexExt: true, middleExt: true });
    landmarks[13] = { x: 0.54, y: 0.6, z: 0 };
    landmarks[14] = { x: 0.54, y: 0.5, z: 0 };
    landmarks[16] = { x: 0.638, y: 0.55, z: 0 };

    expect(classifyHandGesture(landmarks).fingerCount).toBe(2);
  });

  it('ThrowStabilizer requires 300ms of consistent reading before accepting throw', () => {
    const stabilizer = new ThrowStabilizer(300);
    const t0 = 1000;

    // First frame at t0: candidate 4, but not yet stable
    let res = stabilizer.update(4, t0);
    expect(res.currentCandidate).toBe(4);
    expect(res.stableValue).toBeNull();
    expect(res.progress).toBe(0);

    // Frame at t0 + 150ms: halfway there
    res = stabilizer.update(4, t0 + 150);
    expect(res.stableValue).toBeNull();
    expect(res.progress).toBe(0.5);

    // Sudden flicker at t0 + 200ms to 2: resets progress!
    res = stabilizer.update(2, t0 + 200);
    expect(res.currentCandidate).toBe(2);
    expect(res.stableValue).toBeNull();
    expect(res.progress).toBe(0);

    // Stable 2 for full 300ms (t0 + 200 to t0 + 510)
    res = stabilizer.update(2, t0 + 510);
    expect(res.stableValue).toBe(2);
    expect(res.progress).toBe(1);
  });

  it('reads the same number when the hand is rotated or tilted', () => {
    const base = createMockLandmarks({ thumbExt: false, indexExt: true, middleExt: true, ringExt: true });
    for (const deg of [-70, -35, 40, 90, 135]) {
      const r = (deg * Math.PI) / 180;
      const rotated = base.map((p) => {
        const dx = p.x - 0.5;
        const dy = p.y - 0.8;
        return {
          x: 0.5 + dx * Math.cos(r) - dy * Math.sin(r),
          y: 0.8 + dx * Math.sin(r) + dy * Math.cos(r),
          z: p.z,
        };
      });
      expect(classifyHandGesture(rotated).fingerCount).toBe(3);
    }
  });

  it('does not turn a "2" with a loose thumb into a 3', () => {
    const lms = createMockLandmarks({ thumbExt: true, indexExt: true, middleExt: true });
    expect(classifyHandGesture(lms).fingerCount).toBe(2);
  });

  it('GestureSmoother ignores a brief flicker and passes through only a clear majority', () => {
    const sm = new GestureSmoother(450, 6, 0.75);
    let out: number | null = null;
    // establish 4 with one stray frame of 3 in the middle
    const seq = [4, 4, 4, 3, 4, 4, 4, 4];
    seq.forEach((v, i) => {
      out = sm.push(v as 4 | 3, 1000 + i * 33);
    });
    expect(out).toBe(4);

    // a hand that is mid-transition (half 3, half 5) never produces a value
    const sm2 = new GestureSmoother(450, 6, 0.75);
    let last: number | null = 1;
    [3, 5, 3, 5, 3, 5, 3, 5].forEach((v, i) => {
      last = sm2.push(v as 3 | 5, 2000 + i * 33);
    });
    expect(last).toBeNull();
  });
});
