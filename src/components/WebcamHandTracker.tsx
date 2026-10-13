'use client';

import React, { useEffect, useRef, useState, useCallback } from 'react';
import { FilesetResolver, HandLandmarker } from '@mediapipe/tasks-vision';
import { classifyHandGesture, ThrowStabilizer, HandDetectionResult } from '@/vision/classifier';
import { ThrowValue } from '@/engine/types';
import { Camera, CameraOff, AlertCircle, RefreshCw } from 'lucide-react';

interface WebcamHandTrackerProps {
  playerLabel: string;
  isThrowRequired: boolean;
  onThrowConfirmed: (value: ThrowValue) => void;
  mirror?: boolean;
}

export function WebcamHandTracker({
  playerLabel,
  isThrowRequired,
  onThrowConfirmed,
  mirror = true,
}: WebcamHandTrackerProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [landmarker, setLandmarker] = useState<HandLandmarker | null>(null);
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [statusText, setStatusText] = useState<string>('Loading camera model...');
  const [detection, setDetection] = useState<HandDetectionResult>({
    detected: false,
    fingerCount: null,
    confidence: 0,
    label: 'Waiting for hand...',
  });
  const [holdProgress, setHoldProgress] = useState<number>(0);
  const [confirmedValue, setConfirmedValue] = useState<ThrowValue | null>(null);

  const stabilizerRef = useRef(new ThrowStabilizer(250));
  const animationFrameId = useRef<number | null>(null);
  const lastProcessedTime = useRef<number>(0);

  // Initialize MediaPipe Tasks Vision with local assets fallback to cdn
  useEffect(() => {
    let isCancelled = false;

    async function initMediaPipe() {
      try {
        setStatusText('Loading AI model...');
        // Try local wasm first, then fallback to CDN
        let vision;
        try {
          vision = await FilesetResolver.forVisionTasks('/wasm');
        } catch (localErr) {
          console.warn('Local wasm fallback to cdn', localErr);
          vision = await FilesetResolver.forVisionTasks(
            'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.18/wasm'
          );
        }

        if (isCancelled) return;

        // Try local model task first, then cdn
        let handLandmarker: HandLandmarker;
        try {
          handLandmarker = await HandLandmarker.createFromOptions(vision, {
            baseOptions: {
              modelAssetPath: '/models/hand_landmarker.task',
              delegate: 'GPU',
            },
            runningMode: 'VIDEO',
            numHands: 1,
            minHandDetectionConfidence: 0.4,
            minHandPresenceConfidence: 0.4,
            minTrackingConfidence: 0.4,
          });
        } catch (modelErr) {
          handLandmarker = await HandLandmarker.createFromOptions(vision, {
            baseOptions: {
              modelAssetPath:
                'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task',
            },
            runningMode: 'VIDEO',
            numHands: 1,
            minHandDetectionConfidence: 0.4,
            minHandPresenceConfidence: 0.4,
            minTrackingConfidence: 0.4,
          });
        }

        if (!isCancelled) {
          setLandmarker(handLandmarker);
          setStatusText('Camera live - Show hand');
        }
      } catch (err: any) {
        console.error('HandLandmarker init error:', err);
        setErrorMessage(
          'Failed to initialize hand tracking vision model. You can still use the 0-6 throw buttons below.'
        );
      }
    }

    initMediaPipe();
    return () => {
      isCancelled = true;
    };
  }, []);

  // Request Webcam Stream
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
        videoRef.current.srcObject = stream;
        videoRef.current.setAttribute('playsinline', 'true');
        videoRef.current.onloadedmetadata = () => {
          videoRef.current?.play().catch((e) => console.log('Video play error:', e));
          setHasPermission(true);
        };
      }
    } catch (err: any) {
      console.error('Camera access error:', err);
      setHasPermission(false);
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        setErrorMessage('Camera access was denied. Please allow camera permissions in your browser or click Retry.');
      } else if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
        setErrorMessage('No camera found on your device.');
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

    const processLoop = () => {
      if (!isRunning) return;
      const video = videoRef.current;
      const canvas = canvasRef.current;

      if (video && video.readyState >= 2 && video.videoWidth > 0 && video.videoHeight > 0) {
        const now = performance.now();
        if (now - lastProcessedTime.current >= 33) {
          lastProcessedTime.current = now;

          try {
            const results = landmarker.detectForVideo(video, now);
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

                // Draw skeleton landmarks in neo-brutalist handcricket style
                ctx.fillStyle = '#a3f23d'; // gc-lime
                ctx.strokeStyle = '#000000';
                ctx.lineWidth = 4;

                // Draw lines between connected joints
                const connections = [
                  [0,1],[1,2],[2,3],[3,4], // Thumb
                  [0,5],[5,6],[6,7],[7,8], // Index
                  [9,10],[10,11],[11,12],  // Middle
                  [13,14],[14,15],[15,16], // Ring
                  [0,17],[17,18],[18,19],[19,20], // Pinky
                  [5,9],[9,13],[13,17]     // Palm
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
                  ctx.arc(pt.x * canvas.width, pt.y * canvas.height, 5, 0, 2 * Math.PI);
                  ctx.fill();
                  ctx.stroke();
                }

                // Classify gesture
                const classified = classifyHandGesture(rawLandmarks, confidence);
                setDetection(classified);

                // Stabilization
                if (isThrowRequired && classified.fingerCount !== null) {
                  const stable = stabilizerRef.current.update(classified.fingerCount, Date.now());
                  setHoldProgress(stable.progress);

                  if (stable.stableValue !== null && confirmedValue !== stable.stableValue) {
                    setConfirmedValue(stable.stableValue);
                    onThrowConfirmed(stable.stableValue);
                    stabilizerRef.current.reset();
                  }
                } else {
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
          } catch (e) {
            // Processing skip
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
  }, [landmarker, hasPermission, isThrowRequired, confirmedValue, onThrowConfirmed]);

  useEffect(() => {
    if (isThrowRequired) {
      setConfirmedValue(null);
      stabilizerRef.current.reset();
      setHoldProgress(0);
    }
  }, [isThrowRequired]);

  return (
    <div className="gc-tile w-full aspect-square relative border-[4px] border-black bg-black shadow-[6px_6px_0_0_#000] overflow-hidden select-none">
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

      {/* Top Left Hand Tag Badge */}
      <div
        className={`gc-hand ${
          detection.detected ? 'gc-hand--ok' : 'gc-hand--none'
        } absolute top-3 left-3 z-10 flex items-center gap-1.5 px-3 py-1.5 rounded-full border-2 border-black font-mono text-xs font-bold shadow-[2px_2px_0_0_#000] ${
          detection.detected ? 'bg-[#a3f23d] text-black' : 'bg-[#fff] text-black'
        }`}
      >
        <span
          className={`w-2 h-2 rounded-full border border-black ${
            detection.detected ? 'bg-black animate-ping' : 'bg-red-500'
          }`}
        />
        <span>
          {detection.detected
            ? `${detection.fingerCount} Runs (${detection.label})`
            : statusText}
        </span>
      </div>

      {/* Camera Error / Permission Overlay */}
      {errorMessage && (
        <div className="absolute inset-0 bg-[#f7f1e3] p-5 flex flex-col items-center justify-center text-center z-20 border-4 border-black">
          <AlertCircle className="w-10 h-10 text-[#ff3b30] mb-2" />
          <h3 className="font-display uppercase text-base text-black mb-1">Camera Needed</h3>
          <p className="text-xs font-mono text-black max-w-xs mb-4">{errorMessage}</p>
          <button
            onClick={startCamera}
            className="gc-btn gc-btn--sm gc-btn--lime flex items-center gap-2"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Retry Camera</span>
          </button>
        </div>
      )}

      {/* Progress Hold Meter */}
      {isThrowRequired && holdProgress > 0 && holdProgress < 1 && (
        <div className="absolute bottom-10 left-4 right-4 z-20 bg-white border-2 border-black p-1 shadow-[3px_3px_0_0_#000]">
          <div className="flex justify-between text-[10px] font-mono font-bold text-black uppercase mb-0.5">
            <span>Hold throw steady: {detection.fingerCount}</span>
            <span>{(holdProgress * 100).toFixed(0)}%</span>
          </div>
          <div className="w-full h-2 bg-[#f7f1e3] border border-black overflow-hidden">
            <div
              className="h-full bg-[#a3f23d]"
              style={{ width: `${holdProgress * 100}%` }}
            />
          </div>
        </div>
      )}

      {/* Locked Throw Banner */}
      {confirmedValue !== null && (
        <div className="absolute inset-0 bg-[#a3f23d]/90 backdrop-blur-[2px] flex flex-col items-center justify-center z-20 animate-in fade-in">
          <div className="font-mono text-xs uppercase font-bold text-black border-2 border-black bg-white px-2 py-0.5 mb-1 shadow-[2px_2px_0_0_#000]">
            Throw Locked
          </div>
          <div className="font-display text-6xl text-black font-black">
            {confirmedValue}
          </div>
        </div>
      )}

      {/* Bottom Corner Label Tag */}
      <div className="gc-tile-tag absolute bottom-0 left-0 bg-[#ffd60a] border-t-2 border-r-2 border-black font-mono text-[10px] uppercase font-bold px-2.5 py-1 text-black">
        {playerLabel}
      </div>
    </div>
  );
}
