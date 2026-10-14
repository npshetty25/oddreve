'use client';

import React, {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from 'react';
import { FilesetResolver, HandLandmarker } from '@mediapipe/tasks-vision';
import { classifyHandGesture, HandDetectionResult } from '@/vision/classifier';
import { ThrowValue } from '@/engine/types';
import { AlertCircle, RefreshCw, Loader2 } from 'lucide-react';

/** How long a finger-count sample stays in the rolling buffer used at capture time. */
const SAMPLE_WINDOW_MS = 600;

export interface WebcamHandTrackerHandle {
  /**
   * Most common finger count seen in the last 600ms (0 = fist, 6 = thumbs up), or null if
   * no hand was seen at all. Called at the end of the 3-2-1 countdown so both players throw at the same time.
   */
  captureThrow(): ThrowValue | null;
}

interface WebcamHandTrackerProps {
  playerLabel: string;
  cooldownRemaining?: number;
  /** "3" | "2" | "1" | "GO" while a synchronized countdown is running */
  countdownLabel?: string | null;
  /** Value already locked in for this ball (camera capture or keypad) */
  lockedValue?: ThrowValue | null;
  /** Hint under the badge, e.g. "Not your ball" */
  hint?: string | null;
  /** Receives the camera stream (for video chat) once it is live, null when it stops */
  onStream?: (stream: MediaStream | null) => void;
  mirror?: boolean;
}

export const WebcamHandTracker = forwardRef<WebcamHandTrackerHandle, WebcamHandTrackerProps>(
  function WebcamHandTracker(
    { playerLabel, cooldownRemaining = 0, countdownLabel = null, lockedValue = null, hint = null, onStream, mirror = true },
    ref
  ) {
    const videoRef = useRef<HTMLVideoElement | null>(null);
    const canvasRef = useRef<HTMLCanvasElement | null>(null);
    const [landmarker, setLandmarker] = useState<HandLandmarker | null>(null);
    const [isModelLoading, setIsModelLoading] = useState(true);
    const [hasPermission, setHasPermission] = useState<boolean | null>(null);
    const [errorMessage, setErrorMessage] = useState<string | null>(null);
    const [detection, setDetection] = useState<HandDetectionResult>({
      detected: false,
      fingerCount: null,
      confidence: 0,
      label: 'Waiting for hand...',
    });
    const [modelStatusText, setModelStatusText] = useState<string>('Initializing AI...');

    const animationFrameId = useRef<number | null>(null);
    const lastProcessedTime = useRef<number>(0);
    const samplesRef = useRef<{ at: number; count: ThrowValue }[]>([]);
    const onStreamRef = useRef(onStream);
    useEffect(() => {
      onStreamRef.current = onStream;
    }, [onStream]);

    useImperativeHandle(ref, () => ({
      captureThrow() {
        const now = performance.now();
        const counts = new Map<ThrowValue, number>();
        let best: ThrowValue | null = null;
        for (const s of samplesRef.current) {
          if (now - s.at > SAMPLE_WINDOW_MS) continue;
          const c = (counts.get(s.count) ?? 0) + 1;
          counts.set(s.count, c);
          // ties go to the most recent value
          if (best === null || c >= (counts.get(best) ?? 0)) best = s.count;
        }
        return best;
      },
    }));

    // Initialize MediaPipe Tasks Vision with robust multi-tiered fallback
    const initMediaPipe = useCallback(async () => {
      setIsModelLoading(true);
      setErrorMessage(null);
      setModelStatusText('Loading vision engine...');
      try {
        let vision: Awaited<ReturnType<typeof FilesetResolver.forVisionTasks>> | null = null;
        const wasmUrls = [
          'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@1.1.0/wasm',
          'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm',
          '/wasm',
        ];

        for (const url of wasmUrls) {
          try {
            vision = await FilesetResolver.forVisionTasks(url);
            if (vision) break;
          } catch (wasmErr) {
            console.warn(`FilesetResolver failed for ${url}:`, wasmErr);
          }
        }

        if (!vision) {
          throw new Error('Failed to load MediaPipe WASM runtime from CDN and local.');
        }

        setModelStatusText('Loading hand model...');
        const remoteModelUrl =
          'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task';

        let handLandmarker: HandLandmarker | null = null;
        const delegates: ('GPU' | 'CPU')[] = ['GPU', 'CPU'];
        const modelPaths = ['/models/hand_landmarker.task', remoteModelUrl];

        for (const modelPath of modelPaths) {
          if (handLandmarker) break;
          for (const delegate of delegates) {
            try {
              handLandmarker = await HandLandmarker.createFromOptions(vision, {
                baseOptions: { modelAssetPath: modelPath, delegate },
                runningMode: 'VIDEO',
                numHands: 1,
                minHandDetectionConfidence: 0.5,
                minHandPresenceConfidence: 0.5,
                minTrackingConfidence: 0.5,
              });
              if (handLandmarker) break;
            } catch (createErr) {
              console.warn(`HandLandmarker failed with ${modelPath} (${delegate}):`, createErr);
            }
          }
        }

        if (handLandmarker) {
          setLandmarker(handLandmarker);
          setIsModelLoading(false);
          setModelStatusText('AI Ready');
        } else {
          throw new Error('Could not load HandLandmarker model weights');
        }
      } catch (err) {
        console.error('HandLandmarker init error:', err);
        setIsModelLoading(false);
        setErrorMessage(`AI Model error: ${err instanceof Error ? err.message : 'Vision model failed to start'}`);
      }
    }, []);

    useEffect(() => {
      initMediaPipe();
    }, [initMediaPipe]);

    // Request webcam stream
    const startCamera = useCallback(async () => {
      try {
        setErrorMessage(null);
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
          throw new Error('Camera not supported by browser');
        }

        const stream = await navigator.mediaDevices.getUserMedia({
          video: { width: { ideal: 640 }, height: { ideal: 480 }, facingMode: 'user' },
          audio: false,
        });

        onStreamRef.current?.(stream);

        if (videoRef.current) {
          const video = videoRef.current;
          video.srcObject = stream;
          video.setAttribute('playsinline', 'true');
          video.muted = true;

          const markReadyAndPlay = async () => {
            try {
              await video.play();
            } catch (e) {
              console.warn('Autoplay prevented, awaiting user interaction:', e);
            }
            setHasPermission(true);
          };

          if (video.readyState >= 1) {
            markReadyAndPlay();
          } else {
            video.onloadedmetadata = markReadyAndPlay;
            video.onloadeddata = markReadyAndPlay;
            video.oncanplay = markReadyAndPlay;
          }
        }
      } catch (err) {
        console.error('Camera access error:', err);
        setHasPermission(false);
        const e = err as { name?: string; message?: string };
        if (e.name === 'NotAllowedError' || e.name === 'PermissionDeniedError') {
          setErrorMessage('Camera access was denied. Please allow camera permissions.');
        } else {
          setErrorMessage(`Camera error: ${e.message || 'Could not start camera'}`);
        }
      }
    }, []);

    useEffect(() => {
      startCamera();
      const video = videoRef.current;
      return () => {
        const stream = video?.srcObject as MediaStream | null | undefined;
        stream?.getTracks().forEach((track) => track.stop());
        onStreamRef.current?.(null);
      };
    }, [startCamera]);

    // Video landmark detection loop: classify every frame, keep a short rolling buffer
    useEffect(() => {
      if (!landmarker || !videoRef.current || hasPermission !== true) return;

      let isRunning = true;
      let lastTimestamp = 0;

      const connections = [
        [0, 1], [1, 2], [2, 3], [3, 4],
        [0, 5], [5, 6], [6, 7], [7, 8],
        [9, 10], [10, 11], [11, 12],
        [13, 14], [14, 15], [15, 16],
        [0, 17], [17, 18], [18, 19], [19, 20],
        [5, 9], [9, 13], [13, 17],
      ];

      const processLoop = () => {
        if (!isRunning) return;
        const video = videoRef.current;
        const canvas = canvasRef.current;

        if (video && video.readyState >= 2 && video.videoWidth > 0 && video.videoHeight > 0) {
          const perfNow = performance.now();
          if (perfNow - lastProcessedTime.current >= 33) {
            lastProcessedTime.current = perfNow;
            // Strictly increasing timestamp for detectForVideo
            const timestamp = Math.max(perfNow, lastTimestamp + 1);
            lastTimestamp = timestamp;

            try {
              const results = landmarker.detectForVideo(video, timestamp);
              const ctx = canvas?.getContext('2d');

              if (canvas && ctx) {
                if (canvas.width !== video.videoWidth || canvas.height !== video.videoHeight) {
                  canvas.width = video.videoWidth;
                  canvas.height = video.videoHeight;
                }
                ctx.clearRect(0, 0, canvas.width, canvas.height);

                if (results.landmarks && results.landmarks.length > 0) {
                  const rawLandmarks = results.landmarks[0];
                  const confidence = results.handedness?.[0]?.[0]?.score ?? 0.85;

                  ctx.fillStyle = '#a3f23d';
                  ctx.strokeStyle = '#000000';
                  ctx.lineWidth = 3;
                  ctx.beginPath();
                  for (const [s, e] of connections) {
                    const p1 = rawLandmarks[s];
                    const p2 = rawLandmarks[e];
                    ctx.moveTo(p1.x * canvas.width, p1.y * canvas.height);
                    ctx.lineTo(p2.x * canvas.width, p2.y * canvas.height);
                  }
                  ctx.stroke();
                  for (const pt of rawLandmarks) {
                    ctx.beginPath();
                    ctx.arc(pt.x * canvas.width, pt.y * canvas.height, 4, 0, 2 * Math.PI);
                    ctx.fill();
                    ctx.stroke();
                  }

                  const classified = classifyHandGesture(rawLandmarks, confidence);
                  setDetection(classified);

                  const buf = samplesRef.current;
                  if (classified.fingerCount !== null) {
                    buf.push({ at: perfNow, count: classified.fingerCount });
                  }
                  while (buf.length > 0 && perfNow - buf[0].at > SAMPLE_WINDOW_MS * 2) buf.shift();
                } else {
                  setDetection({ detected: false, fingerCount: null, confidence: 0, label: 'No hand detected' });
                }
              }
            } catch (detectionErr) {
              console.warn('detectForVideo frame error:', detectionErr);
            }
          }
        }

        animationFrameId.current = requestAnimationFrame(processLoop);
      };

      animationFrameId.current = requestAnimationFrame(processLoop);

      return () => {
        isRunning = false;
        if (animationFrameId.current) cancelAnimationFrame(animationFrameId.current);
      };
    }, [landmarker, hasPermission]);

    const seen = detection.fingerCount;
    const cooldownSeconds = Math.ceil(cooldownRemaining / 1000);

    return (
      <div className="w-full h-full relative bg-black select-none overflow-hidden" aria-label={`${playerLabel} camera`}>
        <video
          ref={videoRef}
          playsInline
          muted
          autoPlay
          className={`w-full h-full object-cover ${mirror ? 'mirror' : ''}`}
        />
        <canvas
          ref={canvasRef}
          className={`absolute inset-0 w-full h-full pointer-events-none ${mirror ? 'mirror' : ''}`}
        />

        {/* Live reading badge */}
        <div className="absolute top-2 left-2 z-10 flex items-center gap-1.5 px-2.5 py-1 bg-[#ffd60a] border-2 border-black font-num text-[10px] sm:text-[11px] font-black text-black shadow-[2px_2px_0_0_#000]">
          {isModelLoading ? (
            <>
              <Loader2 className="w-3 h-3 animate-spin" />
              <span className="uppercase">{modelStatusText}</span>
            </>
          ) : (
            <>
              <span>{seen !== null ? '👋' : detection.detected ? '🤏' : '✋'}</span>
              <span>{seen !== null ? `SEES ${seen}` : detection.detected ? 'DETECTING...' : 'SHOW HAND'}</span>
            </>
          )}
        </div>

        {lockedValue !== null && (
          <div className="absolute top-2 right-2 z-10 px-2 py-1 bg-[#a3f23d] border-2 border-black font-num text-[11px] font-black text-black shadow-[2px_2px_0_0_#000]">
            LOCKED {lockedValue}
          </div>
        )}

        {hint && (
          <div className="absolute inset-x-0 bottom-0 z-10 bg-black/70 text-center text-[11px] font-num font-black uppercase text-white py-1">
            {hint}
          </div>
        )}

        {/* Big countdown / next-ball badge */}
        {(countdownLabel || cooldownRemaining > 0) && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-20">
            <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-full bg-[#ff6fb5] border-3 sm:border-4 border-black flex flex-col items-center justify-center font-display font-black text-white shadow-[4px_4px_0_0_#000]">
              {!countdownLabel && cooldownRemaining > 0 && (
                <span className="font-num text-[8px] sm:text-[9px] leading-none">NEXT BALL</span>
              )}
              <span className="text-4xl sm:text-5xl leading-none">{countdownLabel ?? cooldownSeconds}</span>
            </div>
          </div>
        )}

        {errorMessage && (
          <div className="absolute inset-0 bg-[#f7f1e3] p-4 flex flex-col items-center justify-center text-center z-30 border-3 border-black">
            <AlertCircle className="w-8 h-8 text-[#ff3b30] mb-1" />
            <p className="text-xs font-mono text-black mb-2">{errorMessage}</p>
            <button
              onClick={() => {
                initMediaPipe();
                startCamera();
              }}
              className="nb-btn nb-btn--lime nb-btn--sm flex items-center gap-1.5 text-xs py-1 px-2.5"
            >
              <RefreshCw className="w-3 h-3" />
              <span>Retry Camera & AI</span>
            </button>
          </div>
        )}
      </div>
    );
  }
);
