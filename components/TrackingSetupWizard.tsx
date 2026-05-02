'use client';
import { useState, useEffect, useRef, useCallback } from 'react';
import { useSettingsStore } from '@/store/settingsStore';
import {
  startPoseTracker,
  isPoseTrackingSupported,
  savePoseCalibration,
  type PoseTrackerHandle,
  type TrackingTarget,
  type PoseCalibrationData,
} from '@/services/bodyPoseService';
import { aacSpeak } from '@/services/aacSpeak';
import { tapFeedback } from '@/services/feedback';

type Phase =
  | 'intro'
  | 'detecting'        // auto-detect which body parts are visible
  | 'calibrate-center' // hold still at center
  | 'calibrate-corners'// point to each corner
  | 'accuracy-test'    // tap random targets
  | 'complete';

interface DetectedPart {
  target: TrackingTarget;
  label: string;
  emoji: string;
  confidence: number;
}

const BODY_PARTS: Array<{ target: TrackingTarget; label: string; emoji: string }> = [
  { target: 'nose', label: 'Head', emoji: '🙂' },
  { target: 'right_wrist', label: 'Right Hand', emoji: '🤚' },
  { target: 'left_wrist', label: 'Left Hand', emoji: '🖐' },
  { target: 'right_index', label: 'Right Finger', emoji: '👆' },
  { target: 'left_index', label: 'Left Finger', emoji: '☝️' },
  { target: 'right_elbow', label: 'Right Elbow', emoji: '💪' },
  { target: 'left_elbow', label: 'Left Elbow', emoji: '💪' },
];

const CORNER_TARGETS = [
  { label: 'Top Left', x: 15, y: 15, emoji: '↖' },
  { label: 'Top Right', x: 85, y: 15, emoji: '↗' },
  { label: 'Bottom Right', x: 85, y: 85, emoji: '↘' },
  { label: 'Bottom Left', x: 15, y: 85, emoji: '↙' },
];

interface Props {
  onComplete: () => void;
  onCancel: () => void;
}

export default function TrackingSetupWizard({ onComplete, onCancel }: Props) {
  const { speechRate, speechVolume } = useSettingsStore();
  const [phase, setPhase] = useState<Phase>('intro');
  const [detected, setDetected] = useState<DetectedPart[]>([]);
  const [selectedPart, setSelectedPart] = useState<TrackingTarget | null>(null);
  const [progress, setProgress] = useState(0);
  const [cornerIdx, setCornerIdx] = useState(0);
  const [cornerSamples, setCornerSamples] = useState<Array<{ x: number; y: number }>>([]);
  const [testTargets, setTestTargets] = useState<Array<{ x: number; y: number; hit: boolean }>>([]);
  const [testIdx, setTestIdx] = useState(0);
  const [cursorPos, setCursorPos] = useState({ x: -100, y: -100 });
  const [statusText, setStatusText] = useState('');

  const handleRef = useRef<PoseTrackerHandle | null>(null);
  const sampleBufferRef = useRef<Array<{ normX: number; normY: number }>>([]);
  const detectionCountRef = useRef<Record<string, number>>({});
  const holdTimerRef = useRef(0);

  const speak = useCallback((text: string) => {
    aacSpeak(text, speechRate, speechVolume);
  }, [speechRate, speechVolume]);

  // Clean up tracker on unmount
  useEffect(() => {
    return () => { handleRef.current?.stop(); };
  }, []);

  // Listen for raw pose samples
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (detail?.normX != null) {
        sampleBufferRef.current.push({ normX: detail.normX, normY: detail.normY });
        if (sampleBufferRef.current.length > 100) sampleBufferRef.current.shift();
      }
    };
    window.addEventListener('prism-pose-sample', handler);
    return () => window.removeEventListener('prism-pose-sample', handler);
  }, []);

  // ── PHASE: Detection ──
  const startDetection = useCallback(() => {
    setPhase('detecting');
    setStatusText('Looking for you...');
    speak('Hold still. I am looking for you.');
    detectionCountRef.current = {};

    if (handleRef.current) handleRef.current.stop();

    const handle = startPoseTracker({
      dwellMs: 99999,
      sensitivity: 5,
      smoothing: 0.15,
      trackingTarget: 'nose',
      cursorSmoothing: 0.12,
      onMove(x, y) { setCursorPos({ x, y }); },
      onDwell() {},
      onStatusChange(status, activeTarget) {
        if (status === 'tracking' && activeTarget) {
          const counts = detectionCountRef.current;
          counts[activeTarget] = (counts[activeTarget] || 0) + 1;
        }
      },
    });
    handleRef.current = handle;

    // After 5 seconds, analyze which body parts were detected
    setTimeout(() => {
      const counts = detectionCountRef.current;
      const results: DetectedPart[] = [];
      for (const bp of BODY_PARTS) {
        const count = counts[bp.target] || 0;
        if (count > 5) {
          results.push({ ...bp, confidence: Math.min(100, Math.round(count / 1.5)) });
        }
      }
      results.sort((a, b) => b.confidence - a.confidence);
      setDetected(results);

      if (results.length > 0) {
        setSelectedPart(results[0].target);
        setStatusText(`Found: ${results.map(r => r.emoji).join(' ')}`);
        speak(`I can see your ${results[0].label}. Let's calibrate.`);
      } else {
        setStatusText('No body parts detected. Try moving closer.');
        speak('I cannot see you. Please move closer to the camera.');
      }
    }, 5000);
  }, [speak]);

  // ── PHASE: Calibrate Center ──
  const startCenterCalibration = useCallback(() => {
    setPhase('calibrate-center');
    sampleBufferRef.current = [];
    setProgress(0);
    setStatusText('Point to the center circle');
    speak('Point to the center of the screen. Hold still.');

    let elapsed = 0;
    const interval = setInterval(() => {
      elapsed += 100;
      setProgress(Math.min(1, elapsed / 3000));
      if (elapsed >= 3000) {
        clearInterval(interval);
        // Move to corners
        setCornerIdx(0);
        setCornerSamples([]);
        setPhase('calibrate-corners');
        setProgress(0);
        speak('Now point to the top left corner.');
        setStatusText('Point to the highlighted corner');
      }
    }, 100);

    return () => clearInterval(interval);
  }, [speak]);

  // ── PHASE: Calibrate Corners ──
  useEffect(() => {
    if (phase !== 'calibrate-corners') return;

    sampleBufferRef.current = [];
    let elapsed = 0;

    const interval = setInterval(() => {
      elapsed += 100;
      setProgress(Math.min(1, elapsed / 2500));

      if (elapsed >= 2500) {
        clearInterval(interval);

        // Average the samples from this corner
        const samples = sampleBufferRef.current;
        const avg = samples.length > 0
          ? {
              x: samples.reduce((s, v) => s + v.normX, 0) / samples.length,
              y: samples.reduce((s, v) => s + v.normY, 0) / samples.length,
            }
          : { x: 0.5, y: 0.5 };

        const newSamples = [...cornerSamples, avg];
        setCornerSamples(newSamples);

        if (cornerIdx < CORNER_TARGETS.length - 1) {
          setCornerIdx(cornerIdx + 1);
          setProgress(0);
          sampleBufferRef.current = [];
          const next = CORNER_TARGETS[cornerIdx + 1];
          speak(`Now point to ${next.label}.`);
        } else {
          // All corners captured — compute calibration
          const tl = newSamples[0];
          const tr = newSamples[1];
          const br = newSamples[2];
          const bl = newSamples[3];

          const mx = (v: number) => 1.0 - v; // mirror X for front camera
          const cal: PoseCalibrationData = {
            leftX: Math.min(mx(tl.x), mx(bl.x)),
            rightX: Math.max(mx(tr.x), mx(br.x)),
            topY: Math.min(tl.y, tr.y),
            bottomY: Math.max(bl.y, br.y),
          };

          // Ensure valid range
          if (cal.leftX >= cal.rightX) [cal.leftX, cal.rightX] = [cal.rightX, cal.leftX];
          if (cal.topY >= cal.bottomY) [cal.topY, cal.bottomY] = [cal.bottomY, cal.topY];

          savePoseCalibration(cal);
          speak('Calibration saved. Now lets test your accuracy.');

          // Generate test targets
          const targets = [];
          for (let i = 0; i < 5; i++) {
            targets.push({
              x: 15 + Math.random() * 70,
              y: 15 + Math.random() * 70,
              hit: false,
            });
          }
          setTestTargets(targets);
          setTestIdx(0);
          setPhase('accuracy-test');
          setStatusText('Tap the circles!');
        }
      }
    }, 100);

    return () => clearInterval(interval);
  }, [phase, cornerIdx, cornerSamples, speak]);

  // ── PHASE: Accuracy Test ──
  const handleTestHit = (idx: number) => {
    if (idx !== testIdx) return;
    tapFeedback();
    speak('Great!');
    setTestTargets(prev => prev.map((t, i) => i === idx ? { ...t, hit: true } : t));

    if (testIdx >= testTargets.length - 1) {
      // All targets hit
      setTimeout(() => {
        const hits = testTargets.filter(t => t.hit).length + 1; // +1 for this one
        speak(`Perfect! You hit ${hits} out of ${testTargets.length} targets.`);
        setPhase('complete');
      }, 500);
    } else {
      setTestIdx(testIdx + 1);
    }
  };

  // ── RENDER ──
  return (
    <div className="fixed inset-0 z-[10000] bg-[#0a0a1a] flex flex-col">
      {/* Header */}
      <div className="shrink-0 flex items-center justify-between px-6 py-4">
        <button onClick={onCancel} className="text-white/60 text-lg font-semibold">Cancel</button>
        <h1 className="text-white font-bold text-xl">
          {phase === 'intro' && 'Tracking Setup'}
          {phase === 'detecting' && 'Finding You...'}
          {phase === 'calibrate-center' && 'Step 1: Center'}
          {phase === 'calibrate-corners' && `Step 2: Corners (${cornerIdx + 1}/4)`}
          {phase === 'accuracy-test' && `Step 3: Test (${testIdx + 1}/${testTargets.length})`}
          {phase === 'complete' && 'Setup Complete!'}
        </h1>
        <div className="w-16" />
      </div>

      {/* Progress dots */}
      <div className="shrink-0 flex justify-center gap-2 pb-4">
        {['detecting', 'calibrate', 'test', 'done'].map((step, i) => (
          <div
            key={step}
            className={`w-3 h-3 rounded-full transition-all ${
              i <= ['detecting', 'calibrate-center', 'accuracy-test', 'complete'].indexOf(phase)
                ? 'bg-[#4CAF50] scale-125'
                : 'bg-white/20'
            }`}
          />
        ))}
      </div>

      {/* Main content */}
      <div className="flex-1 flex items-center justify-center relative overflow-hidden">

        {/* INTRO */}
        {phase === 'intro' && (
          <div className="text-center px-8 max-w-md">
            <div className="text-8xl mb-6">🎯</div>
            <h2 className="text-white text-3xl font-black mb-4">Let's Set Up Tracking</h2>
            <p className="text-white/70 text-lg mb-3">
              We'll find which body parts you can move, then calibrate the cursor to follow you.
            </p>
            <p className="text-white/50 text-sm mb-8">
              Make sure your camera can see you. This takes about 30 seconds.
            </p>
            <button
              onClick={() => { tapFeedback(); startDetection(); }}
              className="w-full py-4 rounded-2xl bg-[#4CAF50] text-white font-bold text-xl shadow-lg active:scale-95 transition-transform"
            >
              Start Setup
            </button>
          </div>
        )}

        {/* DETECTING */}
        {phase === 'detecting' && (
          <div className="text-center px-8">
            <div className="relative w-40 h-40 mx-auto mb-6">
              <div className="absolute inset-0 rounded-full border-4 border-[#4CAF50]/30 animate-ping" />
              <div className="absolute inset-4 rounded-full border-4 border-[#4CAF50]/50 animate-pulse" />
              <div className="absolute inset-0 flex items-center justify-center text-6xl">👁</div>
            </div>
            <p className="text-white text-xl font-bold mb-2">{statusText}</p>
            <p className="text-white/50">Move your hand, head, or body so I can see you</p>

            {detected.length > 0 && (
              <div className="mt-6 space-y-3">
                <p className="text-white/70 text-sm">Detected:</p>
                <div className="flex flex-wrap justify-center gap-2">
                  {detected.map(d => (
                    <button
                      key={d.target}
                      onClick={() => { tapFeedback(); setSelectedPart(d.target); }}
                      className={`px-4 py-3 rounded-2xl flex items-center gap-2 transition-all ${
                        selectedPart === d.target
                          ? 'bg-[#4CAF50] text-white scale-110 shadow-lg'
                          : 'bg-white/10 text-white/80'
                      }`}
                    >
                      <span className="text-2xl">{d.emoji}</span>
                      <span className="font-bold">{d.label}</span>
                      <span className="text-xs opacity-60">{d.confidence}%</span>
                    </button>
                  ))}
                </div>
                <button
                  onClick={() => {
                    tapFeedback();
                    if (selectedPart) {
                      useSettingsStore.getState().update({ cameraTrackingTarget: selectedPart });
                      startCenterCalibration();
                    }
                  }}
                  disabled={!selectedPart}
                  className="mt-4 w-full max-w-xs mx-auto py-3 rounded-2xl bg-[#4CAF50] text-white font-bold text-lg shadow-lg active:scale-95 transition-transform disabled:opacity-30"
                >
                  Calibrate {detected.find(d => d.target === selectedPart)?.label}
                </button>
              </div>
            )}
          </div>
        )}

        {/* CALIBRATE CENTER */}
        {phase === 'calibrate-center' && (
          <>
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="relative">
                <svg width="120" height="120" className="animate-pulse">
                  <circle cx="60" cy="60" r="55" fill="none" stroke="rgba(76,175,80,0.3)" strokeWidth="4" />
                  <circle
                    cx="60" cy="60" r="55"
                    fill="none" stroke="#4CAF50" strokeWidth="6"
                    strokeDasharray={345}
                    strokeDashoffset={345 * (1 - progress)}
                    strokeLinecap="round"
                    transform="rotate(-90 60 60)"
                  />
                </svg>
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="w-8 h-8 rounded-full bg-[#4CAF50] shadow-lg shadow-[#4CAF50]/50" />
                </div>
              </div>
            </div>
            <div className="absolute bottom-20 left-0 right-0 text-center">
              <p className="text-white text-lg font-bold">{statusText}</p>
              <p className="text-white/50 text-sm">Hold still for 3 seconds</p>
            </div>
          </>
        )}

        {/* CALIBRATE CORNERS */}
        {phase === 'calibrate-corners' && (
          <>
            {CORNER_TARGETS.map((corner, idx) => (
              <div
                key={idx}
                className={`absolute transition-all duration-500 ${idx === cornerIdx ? 'scale-100 opacity-100' : idx < cornerIdx ? 'scale-75 opacity-30' : 'scale-50 opacity-10'}`}
                style={{ left: `${corner.x}%`, top: `${corner.y}%`, transform: 'translate(-50%, -50%)' }}
              >
                {idx === cornerIdx ? (
                  <div className="relative">
                    <svg width="100" height="100">
                      <circle cx="50" cy="50" r="45" fill="none" stroke="rgba(33,150,243,0.3)" strokeWidth="4" />
                      <circle
                        cx="50" cy="50" r="45"
                        fill="none" stroke="#2196F3" strokeWidth="6"
                        strokeDasharray={283}
                        strokeDashoffset={283 * (1 - progress)}
                        strokeLinecap="round"
                        transform="rotate(-90 50 50)"
                      />
                    </svg>
                    <div className="absolute inset-0 flex items-center justify-center text-3xl">{corner.emoji}</div>
                  </div>
                ) : (
                  <div className={`w-12 h-12 rounded-full flex items-center justify-center ${idx < cornerIdx ? 'bg-[#4CAF50]' : 'bg-white/10'}`}>
                    <span className="text-xl">{idx < cornerIdx ? '✓' : corner.emoji}</span>
                  </div>
                )}
              </div>
            ))}
            <div className="absolute bottom-20 left-0 right-0 text-center">
              <p className="text-white text-lg font-bold">Point to {CORNER_TARGETS[cornerIdx]?.label}</p>
              <p className="text-white/50 text-sm">Hold for 2.5 seconds</p>
            </div>
          </>
        )}

        {/* ACCURACY TEST */}
        {phase === 'accuracy-test' && (
          <>
            {testTargets.map((target, idx) => (
              <button
                key={idx}
                onClick={() => handleTestHit(idx)}
                disabled={idx !== testIdx || target.hit}
                className={`absolute w-16 h-16 rounded-full transition-all duration-300 ${
                  target.hit
                    ? 'bg-[#4CAF50] scale-75 opacity-50'
                    : idx === testIdx
                      ? 'bg-[#FF6B6B] animate-pulse shadow-lg shadow-[#FF6B6B]/50 scale-110'
                      : 'bg-white/10 scale-75'
                }`}
                style={{
                  left: `${target.x}%`,
                  top: `${target.y}%`,
                  transform: 'translate(-50%, -50%)',
                }}
              >
                {target.hit ? <span className="text-2xl">✓</span> : idx === testIdx ? <span className="text-2xl">👆</span> : null}
              </button>
            ))}
            <div className="absolute bottom-20 left-0 right-0 text-center">
              <p className="text-white text-lg font-bold">{statusText}</p>
              <p className="text-white/50 text-sm">{testTargets.filter(t => t.hit).length}/{testTargets.length} hits</p>
            </div>
          </>
        )}

        {/* COMPLETE */}
        {phase === 'complete' && (
          <div className="text-center px-8 max-w-md">
            <div className="text-8xl mb-6 animate-bounce">🎉</div>
            <h2 className="text-white text-3xl font-black mb-4">All Set!</h2>
            <p className="text-white/70 text-lg mb-2">
              Tracking: {detected.find(d => d.target === selectedPart)?.emoji} {detected.find(d => d.target === selectedPart)?.label}
            </p>
            <p className="text-white/50 text-sm mb-8">
              The cursor will follow your movements. You can recalibrate anytime from Settings.
            </p>
            <button
              onClick={() => {
                tapFeedback();
                useSettingsStore.getState().update({ cameraInputEnabled: true });
                handleRef.current?.stop();
                onComplete();
              }}
              className="w-full py-4 rounded-2xl bg-[#4CAF50] text-white font-bold text-xl shadow-lg active:scale-95 transition-transform"
            >
              Start Using Prism AAC
            </button>
          </div>
        )}
      </div>

      {/* Status bar */}
      <div className="shrink-0 px-6 py-3 flex items-center justify-center gap-2">
        <div className={`w-2 h-2 rounded-full ${cursorPos.x > 0 ? 'bg-[#4CAF50]' : 'bg-[#FF9800]'}`} />
        <span className="text-white/40 text-xs">
          {cursorPos.x > 0 ? 'Camera active' : 'Waiting for camera...'}
        </span>
      </div>
    </div>
  );
}
