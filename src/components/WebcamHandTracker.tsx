'use client';

import React, { useEffect, useRef, useState, useCallback } from 'react';
import { FilesetResolver, HandLandmarker } from '@mediapipe/tasks-vision';
import { classifyHandGesture, ThrowStabilizer, HandDetectionResult } from '@/vision/classifier';
import { ThrowValue } from '@/engine/types';
import { AlertCircle, RefreshCw, Loader2 } from 'lucide-react';

interface WebcamHandTrackerProps {
  playerLabel: string;
  isThrowRequired: boolean;
  ballCycle?: number;
  onThrowConfirmed: (value: ThrowValue) => void;
  mirror?: boolean;
}

export function WebcamHandTracker({
  playerLabel,
  isThrowRequired,
  ballCycle = 0,
  onThrowConfirmed,
  mirror = true,
}: WebcamHandTrackerProps) {
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
  const [holdProgress, setHoldProgress] = useState<number>(0);
  const [confirmedValue, setConfirmedValue] = useState<ThrowValue | null>(null);

  const [modelStatusText, setModelStatusText] = useState<string>('Initializing AI...');

  // References for timing, cooldown, and single fire per ball
  const hasFiredRef = useRef(false);
  // Responsive hold duration: 320ms for fast, natural recognition
  const stabilizerRef = useRef(new ThrowStabilizer(320));
  const animationFrameId = useRef<number | null>(null);
  const lastProcessedTime = useRef<number>(0);
  const lastFiredTime = useRef<number>(0);

  // Initialize MediaPipe Tasks Vision with robust multi-tiered fallback
  useEffect(() => {
    let isCancelled = false;

    async function initMediaPipe() {
      setIsModelLoading(true);
      setModelStatusText('Loading vision engine...');
      try {
        let vision: any = null;
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

        if (isCancelled) return;
        if (!vision) {
          throw new Error('Failed to load MediaPipe WASM runtime from CDN and local.');
        }

        setModelStatusText('Loading hand model...');
        const remoteModelUrl =
          'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task';

        let handLandmarker: HandLandmarker | null = null;

        // Try delegates: GPU first, fallback to CPU
        const delegates: ('GPU' | 'CPU')[] = ['GPU', 'CPU'];
        const modelPaths = ['/models/hand_landmarker.task', remoteModelUrl];

        for (const modelPath of modelPaths) {
          if (handLandmarker) break;
          for (const delegate of delegates) {
            try {
              handLandmarker = await HandLandmarker.createFromOptions(vision, {
                baseOptions: {
                  modelAssetPath: modelPath,
                  delegate,
                },
                runningMode: 'VIDEO',
                numHands: 1,
                minHandDetectionConfidence: 0.3,
                minHandPresenceConfidence: 0.3,
                minTrackingConfidence: 0.3,
              });
              if (handLandmarker) {
                console.log(`HandLandmarker initialized successfully with ${modelPath} (${delegate})`);
                break;
              }
            } catch (createErr) {
              console.warn(`HandLandmarker failed with ${modelPath} (${delegate}):`, createErr);
            }
          }
        }

        if (isCancelled) return;

        if (handLandmarker) {
          setLandmarker(handLandmarker);
          setIsModelLoading(false);
          setModelStatusText('AI Ready');
        } else {
          throw new Error('Could not load HandLandmarker model weights');
        }
      } catch (err: any) {
        console.error('HandLandmarker init error:', err);
        setIsModelLoading(false);
        setErrorMessage(`AI Model error: ${err.message || 'Vision model failed to start'}`);
      }
    }

    initMediaPipe();
    return () => {
      isCancelled = true;
    };
  }, []);

  // Request Webcam Stream with multi-event play readiness
  const startCamera = useCallback(async () => {
    try {
      setErrorMessage(null);
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error('Camera not supported by browser');
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 640 },
          height: { ideal: 480 },
          facingMode: 'user',
        },
        audio: false,
      });

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
    } catch (err: any) {
      console.error('Camera access error:', err);
      setHasPermission(false);
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        setErrorMessage('Camera access was denied. Please allow camera permissions.');
      } else {
        setErrorMessage(`Camera error: ${err.message || 'Could not start camera'}`);
      }
    }
  }, []);

  useEffect(() => {
    startCamera();
    return () => {
      if (videoRef.current && videoRef.current.srcObject) {
        const stream = videoRef.current.srcObject as MediaStream;
        stream.getTracks().forEach((track) => track.stop());
      }
    };
  }, [startCamera]);

  // Video Landmark detection loop
  useEffect(() => {
    if (!landmarker || !videoRef.current || hasPermission !== true) return;

    let isRunning = true;
    let lastTimestamp = 0;

    const processLoop = () => {
      if (!isRunning) return;
      const video = videoRef.current;
      const canvas = canvasRef.current;

      if (video && video.readyState >= 2 && video.videoWidth > 0 && video.videoHeight > 0) {
        const perfNow = performance.now();
        if (perfNow - lastProcessedTime.current >= 33) {
          lastProcessedTime.current = perfNow;
          // Ensure strictly monotonically increasing timestamp for detectForVideo
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

                // Draw skeleton landmarks in neo-brutalist style
                ctx.fillStyle = '#a3f23d';
                ctx.strokeStyle = '#000000';
                ctx.lineWidth = 3;

                const connections = [
                  [0, 1], [1, 2], [2, 3], [3, 4],
                  [0, 5], [5, 6], [6, 7], [7, 8],
                  [9, 10], [10, 11], [11, 12],
                  [13, 14], [14, 15], [15, 16],
                  [0, 17], [17, 18], [18, 19], [19, 20],
                  [5, 9], [9, 13], [13, 17],
                ];

                ctx.beginPath();
                for (const [s, e] of connections) {
                  const p1 = rawLandmarks[s];
                  const p2 = rawLandmarks[e];
                  ctx.moveTo(p1.x * canvas.width, p1.y * canvas.height);
                  ctx.lineTo(p2.x * canvas.width, p2.y * canvas.height);
                }
                ctx.stroke();

                for (let i = 0; i < rawLandmarks.length; i++) {
                  const pt = rawLandmarks[i];
                  ctx.beginPath();
                  ctx.arc(pt.x * canvas.width, pt.y * canvas.height, 4, 0, 2 * Math.PI);
                  ctx.fill();
                  ctx.stroke();
                }

                // Classify gesture
                const classified = classifyHandGesture(rawLandmarks, confidence);
                setDetection(classified);

                // Stabilization & Throw detection: valid throws are 1 to 6
                const isCooldownDone = Date.now() - lastFiredTime.current > 400;

                if (
                  isThrowRequired &&
                  !hasFiredRef.current &&
                  isCooldownDone &&
                  classified.fingerCount !== null &&
                  classified.fingerCount >= 1 &&
                  classified.fingerCount <= 6
                ) {
                  const stable = stabilizerRef.current.update(classified.fingerCount, Date.now());
                  setHoldProgress(stable.progress);

                  if (stable.stableValue !== null) {
                    hasFiredRef.current = true;
                    lastFiredTime.current = Date.now();
                    setConfirmedValue(stable.stableValue);
                    onThrowConfirmed(stable.stableValue);
                    stabilizerRef.current.reset();
                  }
                } else if (!isThrowRequired || !isCooldownDone) {
                  stabilizerRef.current.reset();
                  setHoldProgress(0);
                }
              } else {
                setDetection({
                  detected: false,
                  fingerCount: null,
                  confidence: 0,
                  label: 'No hand detected',
                });
                stabilizerRef.current.reset();
                setHoldProgress(0);
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
      if (animationFrameId.current) {
        cancelAnimationFrame(animationFrameId.current);
      }
    };
  }, [landmarker, hasPermission, isThrowRequired, onThrowConfirmed]);

  // Clean reset when ballCycle increments or when a throw is newly required
  useEffect(() => {
    hasFiredRef.current = false;
    setConfirmedValue(null);
    stabilizerRef.current.reset();
    setHoldProgress(0);
  }, [ballCycle, isThrowRequired]);

  const activeNumber = confirmedValue ?? (detection.fingerCount && detection.fingerCount >= 1 && detection.fingerCount <= 6 ? detection.fingerCount : null);

  return (
    <div className="w-full h-full relative bg-black select-none overflow-hidden">
      {/* Video & Canvas */}
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

      {/* Top Left Status Badge: "👋 SEES 2" or "✋ NO HAND" or loading */}
      <div className="absolute top-2 left-2 z-10 flex items-center gap-1.5 px-2.5 py-1 bg-[#ffd60a] border-2 border-black font-num text-[10px] sm:text-[11px] font-black text-black shadow-[2px_2px_0_0_#000]">
        {isModelLoading ? (
          <>
            <Loader2 className="w-3 h-3 animate-spin" />
            <span className="uppercase">{modelStatusText}</span>
          </>
        ) : (
          <>
            <span>{activeNumber !== null ? '👋' : detection.detected ? '🤏' : '✋'}</span>
            <span>
              {activeNumber !== null
                ? `SEES ${activeNumber}`
                : detection.detected
                ? 'DETECTING...'
                : 'SHOW HAND'}
            </span>
          </>
        )}
      </div>

      {/* Center Pink Circular Number Badge */}
      {activeNumber !== null && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-20">
          <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-[#ff6fb5] border-3 sm:border-4 border-black flex items-center justify-center font-display text-3xl sm:text-4xl font-black text-white shadow-[4px_4px_0_0_#000] animate-bounce-in">
            {activeNumber}
          </div>
        </div>
      )}

      {/* Camera Error / Permission Overlay */}
      {errorMessage && (
        <div className="absolute inset-0 bg-[#f7f1e3] p-4 flex flex-col items-center justify-center text-center z-30 border-3 border-black">
          <AlertCircle className="w-8 h-8 text-[#ff3b30] mb-1" />
          <p className="text-xs font-mono text-black mb-2">{errorMessage}</p>
          <button
            onClick={startCamera}
            className="nb-btn nb-btn--lime nb-btn--sm flex items-center gap-1.5 text-xs py-1 px-2.5"
          >
            <RefreshCw className="w-3 h-3" />
            <span>Retry Camera</span>
          </button>
        </div>
      )}

      {/* Hold Progress Meter */}
      {isThrowRequired && holdProgress > 0 && holdProgress < 1 && (
        <div className="absolute bottom-2 left-3 right-3 z-20 bg-white border-2 border-black p-0.5 shadow-[2px_2px_0_0_#000]">
          <div className="w-full h-1.5 bg-[#f7f1e3] border border-black overflow-hidden">
            <div
              className="h-full bg-[#a3f23d]"
              style={{ width: `${holdProgress * 100}%` }}
            />
          </div>
        </div>
      )}
    </div>
  );
}
