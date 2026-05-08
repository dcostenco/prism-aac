'use client';
import { useState, useEffect, useRef, useCallback } from 'react';
import { useSettingsStore } from '@/store/settingsStore';
import {
  startPoseTracker,
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
  // Held by a useEffect below so startDetection's auto-advance can call
  // it without a TDZ on the const-declared startCenterCalibration.
  // Without this, setPhase('calibrate-center') rendered the calibration
  // UI but the 3-second interval never started → calibration stuck.
  const startCenterCalibrationRef = useRef<(() => void) | null>(null);

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

  // Tracker live-status — exposed in the wizard's status bar so the
  // user knows whether the camera cursor is following their body
  // (tracking) or stale (lost/stopped). Without this, the cursor
  // froze at last-known position and the user couldn't tell why
  // the test wasn't registering hits.
  const [trackerStatus, setTrackerStatus] = useState<'starting' | 'tracking' | 'lost' | 'stopped'>('stopped');

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
        setTrackerStatus(status);
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
        const top = results[0];
        setSelectedPart(top.target);
        setStatusText(`Found: ${results.map(r => r.emoji).join(' ')}`);
        speak(`I can see your ${top.label}. Let's calibrate.`);
        // Auto-advance after 1.5s — users were reading the static
        // confidence percentage as a stalled progress bar. The
        // "Calibrate Head" button is still rendered for the grace
        // window if the user wants to switch body parts.
        useSettingsStore.getState().update({ cameraTrackingTarget: top.target });
        setTimeout(() => {
          // Bug fix: previously this only called setPhase('calibrate-
          // center'), which rendered the calibration UI but NEVER
          // started the 3-second interval (that lives inside
          // startCenterCalibration). Result: user saw "Hold still for
          // 3 seconds" forever. The "circular useCallback dep" comment
          // was wrong — calling the function isn't circular, it just
          // means the deps array needs it. Stash the callback in a ref
          // OR call directly. Direct call is simpler.
          startCenterCalibrationRef.current?.();
        }, 1500);
      } else {
        setStatusText('No body parts detected. Try moving closer.');
        speak('I cannot see you. Please move closer to the camera.');
      }
    }, 5000);
  }, [speak]);

  // After detection picks a body part, restart the pose tracker with
  // THAT target — not the hardcoded 'nose' from startDetection. User
  // report 2026-05-08 (Image #27): "test still failing.. nothing i
  // can do" / "it appears to be a fake test" / "cursor is not moving
  // when i point to corners". Root cause: the wizard's tracker stayed
  // on 'nose' forever, so moving a hand never moved the cursor.
  const restartTrackerForPart = useCallback((target: TrackingTarget) => {
    if (handleRef.current) handleRef.current.stop();
    const handle = startPoseTracker({
      dwellMs: 99999, // disable dwell-click during calibration
      sensitivity: 5,
      smoothing: 0.15,
      trackingTarget: target,
      cursorSmoothing: 0.12,
      onMove(x, y) { setCursorPos({ x, y }); },
      onDwell() {},
      onStatusChange(status) { setTrackerStatus(status); },
    });
    handleRef.current = handle;
  }, []);

  // ── PHASE: Calibrate Center ──
  // Calibration is user-driven, NOT timer-driven. The previous
  // implementation auto-advanced after 3s regardless of whether the
  // user was actually pointing. Now: user taps Capture when ready.
  const startCenterCalibration = useCallback(() => {
    setPhase('calibrate-center');
    sampleBufferRef.current = [];
    setProgress(0);
    setStatusText('Point to the center circle, then tap Capture');
    speak('Point to the center of the screen, then tap Capture.');
    // Critical: re-spin the tracker on the selected part so the
    // cursor actually follows the user's hand/finger, not their nose.
    if (selectedPart) restartTrackerForPart(selectedPart);
  }, [speak, selectedPart, restartTrackerForPart]);

  // Visual progress: while in a calibration phase, animate the ring
  // based on how many samples we have (caps at 30 → "ready"). The
  // user can capture at any point — this is just feedback.
  useEffect(() => {
    if (phase !== 'calibrate-center' && phase !== 'calibrate-corners') return;
    const interval = setInterval(() => {
      const n = sampleBufferRef.current.length;
      setProgress(Math.min(1, n / 30));
    }, 100);
    return () => clearInterval(interval);
  }, [phase]);

  /** User taps the Capture button — average the current sample buffer
   *  and advance. Refuses to advance if the buffer is empty (no pose
   *  data) so we don't bake (0.5, 0.5) into the calibration. */
  const captureCenter = useCallback(() => {
    if (sampleBufferRef.current.length === 0) {
      setStatusText("I can't see your finger yet — keep pointing.");
      return;
    }
    tapFeedback();
    // Center isn't strictly used for the bounds calculation (corners
    // define the rect) but capturing here proves the tracker sees the
    // finger before we ask for 4 corners.
    sampleBufferRef.current = [];
    setCornerIdx(0);
    setCornerSamples([]);
    setPhase('calibrate-corners');
    setProgress(0);
    setStatusText('Point to the highlighted corner, then tap Capture');
    speak('Now point to the top left corner.');
  }, [speak]);

  // Keep the ref pointing at the latest startCenterCalibration so
  // earlier-declared callbacks (startDetection) can invoke it without
  // a TDZ violation. The deps array refreshes when speak changes.
  useEffect(() => {
    startCenterCalibrationRef.current = startCenterCalibration;
  }, [startCenterCalibration]);

  // ── PHASE: Calibrate Corners — user-driven ──
  // Capture handler for corners, called when the user taps Capture.
  // Refuses to advance if no pose samples (same guard as center).
  const captureCorner = useCallback(() => {
    if (sampleBufferRef.current.length === 0) {
      setStatusText("I can't see your finger yet — keep pointing at the highlighted corner.");
      return;
    }
    tapFeedback();
    const samples = sampleBufferRef.current;
    const avg = {
      x: samples.reduce((s, v) => s + v.normX, 0) / samples.length,
      y: samples.reduce((s, v) => s + v.normY, 0) / samples.length,
    };
    const newSamples = [...cornerSamples, avg];
    setCornerSamples(newSamples);
    sampleBufferRef.current = [];
    setProgress(0);

    if (cornerIdx < CORNER_TARGETS.length - 1) {
      setCornerIdx(cornerIdx + 1);
      const next = CORNER_TARGETS[cornerIdx + 1];
      speak(`Now point to ${next.label}.`);
      setStatusText(`Point to ${next.label}, then tap Capture`);
    } else {
      // All 4 corners captured — compute calibration rect
      const tl = newSamples[0];
      const tr = newSamples[1];
      const br = newSamples[2];
      const bl = newSamples[3];
      const mx = (v: number) => 1.0 - v;
      const cal: PoseCalibrationData = {
        leftX: Math.min(mx(tl.x), mx(bl.x)),
        rightX: Math.max(mx(tr.x), mx(br.x)),
        topY: Math.min(tl.y, tr.y),
        bottomY: Math.max(bl.y, br.y),
      };
      if (cal.leftX >= cal.rightX) [cal.leftX, cal.rightX] = [cal.rightX, cal.leftX];
      if (cal.topY >= cal.bottomY) [cal.topY, cal.bottomY] = [cal.bottomY, cal.topY];
      savePoseCalibration(cal);
      speak('Calibration saved. Now lets test your accuracy.');

      const targets = Array.from({ length: 5 }, () => ({
        x: 15 + Math.random() * 70,
        y: 15 + Math.random() * 70,
        hit: false,
      }));
      setTestTargets(targets);
      setTestIdx(0);
      setPhase('accuracy-test');
      setStatusText('Look at each red circle until it goes green');
    }
  }, [cornerIdx, cornerSamples, speak]);

  // ── PHASE: Accuracy Test ──
  const handleTestHit = useCallback((idx: number) => {
    if (idx !== testIdx) return;
    tapFeedback();
    speak('Great!');
    setTestTargets(prev => prev.map((t, i) => i === idx ? { ...t, hit: true } : t));

    if (testIdx >= testTargets.length - 1) {
      setTimeout(() => {
        const hits = testTargets.filter(t => t.hit).length + 1;
        speak(`Perfect! You hit ${hits} out of ${testTargets.length} targets.`);
        setPhase('complete');
      }, 500);
    } else {
      setTestIdx(testIdx + 1);
    }
  }, [testIdx, testTargets, speak]);

  // Camera-cursor dwell detection — fires handleTestHit when the
  // camera-tracked cursor stays within the active target's radius
  // for ~700ms. Without this the user had to physically mouse-click
  // each circle, defeating the point of the test ("does the camera
  // cursor land on what you point at?"). User report 2026-05-08 —
  // calibration stuck at "Step 3: Test (1/5) — 0/5 hits" with the
  // cursor visibly on the target but no hit firing.
  const dwellHitRef = useRef<{ idx: number; start: number } | null>(null);
  useEffect(() => {
    if (phase !== 'accuracy-test') { dwellHitRef.current = null; return; }
    const interval = setInterval(() => {
      const target = testTargets[testIdx];
      if (!target || target.hit) return;
      // Targets are positioned in % of viewport; convert to px.
      const tx = (target.x / 100) * window.innerWidth;
      const ty = (target.y / 100) * window.innerHeight;
      const dx = cursorPos.x - tx;
      const dy = cursorPos.y - ty;
      const dist = Math.sqrt(dx * dx + dy * dy);
      // 64px button half-width = 32px; add 32px slack for jitter.
      const HIT_RADIUS = 64;
      const DWELL_MS = 700;
      if (dist <= HIT_RADIUS) {
        if (dwellHitRef.current?.idx !== testIdx) {
          dwellHitRef.current = { idx: testIdx, start: Date.now() };
        } else if (Date.now() - dwellHitRef.current.start >= DWELL_MS) {
          dwellHitRef.current = null;
          handleTestHit(testIdx);
        }
      } else {
        if (dwellHitRef.current?.idx === testIdx) dwellHitRef.current = null;
      }
    }, 80);
    return () => clearInterval(interval);
  }, [phase, testIdx, testTargets, cursorPos.x, cursorPos.y, handleTestHit]);

  // Live-cursor — render a dot at cursorPos on EVERY phase except
  // intro/complete so the user can verify in real time that pointing
  // their hand actually moves the cursor. User report 2026-05-08:
  // "it doesnt show tracing when i point to the corners of a screen.
  // Can you improve it so i will see in a reality that i pointing
  // correct? Cursor is not moving".
  const cursorVisible = (phase === 'detecting' || phase === 'calibrate-center' ||
                          phase === 'calibrate-corners' || phase === 'accuracy-test')
                          && cursorPos.x > 0 && cursorPos.y > 0;
  const cursorColor = trackerStatus === 'tracking' ? '#4CAF50'
    : trackerStatus === 'lost' ? '#FF9800'
    : '#9E9E9E';

  // ── RENDER ──
  return (
    <div
      className="fixed inset-0 z-[10000] bg-[#0a0a1a] flex flex-col"
      data-testid="tracking-setup-wizard"
      data-phase={phase}
      data-tracker-status={trackerStatus}
    >
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
            <h2 className="text-white text-3xl font-black mb-4">Let&apos;s Set Up Tracking</h2>
            <p className="text-white/70 text-lg mb-3">
              We&apos;ll find which body parts you can move, then calibrate the cursor to follow you.
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
            <div className="absolute bottom-20 left-0 right-0 text-center px-6">
              <p className="text-white text-lg font-bold">{statusText}</p>
              <button
                onClick={captureCenter}
                data-testid="tracking-capture-center"
                disabled={sampleBufferRef.current.length === 0}
                className="mt-4 py-3 px-8 rounded-2xl bg-[#4CAF50] text-white font-bold text-lg shadow-lg active:scale-95 transition-transform disabled:opacity-30"
              >
                ✓ Capture center
              </button>
              <p className="text-white/40 text-xs mt-2">Tap when you&apos;re pointing at the center</p>
              <button
                onClick={() => {
                  tapFeedback();
                  setCornerSamples([{x:0.2,y:0.2},{x:0.8,y:0.2},{x:0.8,y:0.8},{x:0.2,y:0.8}]);
                  const targets = Array.from({length: 5}, () => ({
                    x: 15 + Math.random() * 70, y: 15 + Math.random() * 70, hit: false
                  }));
                  setTestTargets(targets);
                  setTestIdx(0);
                  setPhase('accuracy-test');
                  setStatusText('Look at each red circle until it goes green');
                }}
                data-testid="tracking-calibrate-skip"
                className="mt-3 text-white/50 text-xs underline block mx-auto"
              >
                Skip calibration → use defaults
              </button>
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
            <div className="absolute bottom-20 left-0 right-0 text-center px-6">
              <p className="text-white text-lg font-bold">{statusText || `Point to ${CORNER_TARGETS[cornerIdx]?.label}`}</p>
              <button
                onClick={captureCorner}
                data-testid="tracking-capture-corner"
                disabled={sampleBufferRef.current.length === 0}
                className="mt-4 py-3 px-8 rounded-2xl bg-[#2196F3] text-white font-bold text-lg shadow-lg active:scale-95 transition-transform disabled:opacity-30"
              >
                ✓ Capture {CORNER_TARGETS[cornerIdx]?.label}
              </button>
              <p className="text-white/40 text-xs mt-2">Tap when you&apos;re pointing at the corner</p>
              <button
                onClick={() => {
                  tapFeedback();
                  const filled = [...cornerSamples];
                  while (filled.length < 4) {
                    filled.push({ x: 0.5, y: 0.5 });
                  }
                  setCornerSamples(filled);
                  const targets = Array.from({length: 5}, () => ({
                    x: 15 + Math.random() * 70, y: 15 + Math.random() * 70, hit: false
                  }));
                  setTestTargets(targets);
                  setTestIdx(0);
                  setPhase('accuracy-test');
                  setStatusText('Look at each red circle until it goes green');
                }}
                data-testid="tracking-corners-skip"
                className="mt-3 text-white/50 text-xs underline block mx-auto"
              >
                Skip → use defaults
              </button>
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
                data-testid={`tracking-test-target-${idx}`}
                data-active={idx === testIdx ? 'true' : 'false'}
                data-hit={target.hit ? 'true' : 'false'}
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
            {/* Global cursor (rendered below outside the per-phase
                blocks) shows the camera-tracked position. The accuracy
                test handler runs the dwell-on-target hit detection. */}
            <div className="absolute bottom-20 left-0 right-0 text-center">
              <p className="text-white text-lg font-bold">{statusText}</p>
              <p className="text-white/50 text-sm" data-testid="tracking-test-hits">
                {testTargets.filter(t => t.hit).length}/{testTargets.length} hits
              </p>
              {/* Skip — escape hatch when the user can't complete the
                  test (low light, occluded camera, motor difficulty).
                  Saves the calibration we already captured in step 2
                  and proceeds to "complete" without forcing the user
                  to abandon the wizard via Cancel and lose progress. */}
              <button
                onClick={() => { tapFeedback(); setPhase('complete'); }}
                data-testid="tracking-test-skip"
                className="mt-3 text-white/50 text-xs underline"
              >
                Skip test → save calibration anyway
              </button>
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

      {/* Live camera-cursor — visible during every phase that uses
          the camera so the user can verify in real time that pointing
          their hand actually moves the cursor. Color reflects status:
          green = tracking, orange = lost, grey = stopped/starting. */}
      {cursorVisible && (
        <div
          data-testid="tracking-wizard-cursor"
          style={{
            position: 'fixed',
            left: cursorPos.x - 18,
            top: cursorPos.y - 18,
            width: 36,
            height: 36,
            borderRadius: '50%',
            backgroundColor: cursorColor,
            border: '3px solid white',
            boxShadow: `0 0 20px ${cursorColor}99, 0 0 40px ${cursorColor}55`,
            pointerEvents: 'none',
            transition: 'left 0.06s linear, top 0.06s linear, background-color 0.2s ease',
            zIndex: 10001,
          }}
        />
      )}

      {/* Status bar — explicit tracking-status text so the user knows
          why the cursor isn't moving (lost = camera can't see the
          tracked body part; stopped = tracker not running; tracking =
          all good). */}
      <div className="shrink-0 px-6 py-3 flex items-center justify-center gap-2"
           data-testid="tracking-wizard-status">
        <div className={`w-2 h-2 rounded-full`} style={{ backgroundColor: cursorColor }} />
        <span className="text-white/60 text-xs font-semibold">
          {trackerStatus === 'tracking' && `Tracking ${selectedPart ? `your ${BODY_PARTS.find(b => b.target === selectedPart)?.label.toLowerCase() ?? 'finger'}` : 'you'}`}
          {trackerStatus === 'lost' && (selectedPart ? `Camera can't see your ${BODY_PARTS.find(b => b.target === selectedPart)?.label.toLowerCase() ?? 'finger'} — move into frame` : 'Camera lost — move into frame')}
          {trackerStatus === 'starting' && 'Loading camera…'}
          {trackerStatus === 'stopped' && 'Camera not running'}
        </span>
      </div>
    </div>
  );
}
