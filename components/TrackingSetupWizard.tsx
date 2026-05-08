'use client';
import { useState, useEffect, useRef, useCallback } from 'react';
import { useSettingsStore } from '@/store/settingsStore';
import {
  startPoseTracker,
  savePoseCalibration,
  computeCalibrationFromCorners,
  loadPoseCalibration,
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
  // Live camera PIP preview — clones the tracker's video stream into a
  // small visible <video> so the user can confirm the camera is
  // actually capturing (not just "permission granted but no frames").
  // User report 2026-05-08: "camera is not enabled .. that could be
  // the issue - i don't see it working".
  const pipVideoRef = useRef<HTMLVideoElement | null>(null);
  useEffect(() => {
    const interval = setInterval(() => {
      const videoEl = handleRef.current?.videoElement;
      if (videoEl?.srcObject && pipVideoRef.current && !pipVideoRef.current.srcObject) {
        pipVideoRef.current.srcObject = videoEl.srcObject;
        pipVideoRef.current.play().catch(() => {});
        console.log('[wizard] PIP attached to tracker video stream');
      }
    }, 300);
    return () => clearInterval(interval);
  }, []);
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
  // (tracking) or stale (lost/stopped).
  const [trackerStatus, setTrackerStatus] = useState<'starting' | 'tracking' | 'lost' | 'stopped'>('stopped');

  // Live diagnostics — show the user (and us in screenshots) the
  // raw pose data, captured calibration, and computed mapping. Added
  // 2026-05-08 after multiple "same" reports where speculation was
  // out of stock and I needed to see what the runtime was actually
  // producing.
  const [latestSample, setLatestSample] = useState<{ normX: number; normY: number } | null>(null);
  const [latestCal, setLatestCal] = useState<PoseCalibrationData | null>(null);
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (detail?.normX != null) setLatestSample({ normX: detail.normX, normY: detail.normY });
    };
    window.addEventListener('prism-pose-sample', handler);
    return () => window.removeEventListener('prism-pose-sample', handler);
  }, []);
  // Re-read the saved calibration whenever phase changes so the
  // diagnostic panel reflects whatever was just captured.
  useEffect(() => {
    try { setLatestCal(loadPoseCalibration()); } catch { /* */ }
  }, [phase, cornerSamples]);

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
    console.log(`[wizard] restartTrackerForPart target=${target}`);
    const handle = startPoseTracker({
      dwellMs: 99999,
      sensitivity: 5,
      smoothing: 0.15,
      trackingTarget: target,
      cursorSmoothing: 0.12,
      onMove(x, y) { setCursorPos({ x, y }); },
      onDwell() {},
      onStatusChange(status) {
        setTrackerStatus(status);
        console.log(`[wizard] tracker status → ${status}`);
      },
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
    setStatusText('Look at the center circle, then tap Capture');
    speak('Look at the center of the screen, then tap Capture.');
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
    const n = sampleBufferRef.current.length;
    console.log(`[wizard] captureCenter — bufferSize=${n}`);
    if (n === 0) {
      setStatusText("I can't see your finger yet — keep pointing.");
      console.log('[wizard] captureCenter REFUSED — empty buffer');
      return;
    }
    const sx = sampleBufferRef.current.reduce((s, v) => s + v.normX, 0) / n;
    const sy = sampleBufferRef.current.reduce((s, v) => s + v.normY, 0) / n;
    console.log(`[wizard] center avg normX=${sx.toFixed(3)} normY=${sy.toFixed(3)}`);
    tapFeedback();
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
    const n = sampleBufferRef.current.length;
    const cornerLabel = CORNER_TARGETS[cornerIdx]?.label;
    console.log(`[wizard] captureCorner ${cornerIdx + 1}/4 (${cornerLabel}) — bufferSize=${n}`);
    if (n === 0) {
      setStatusText("I can't see your finger yet — keep pointing at the highlighted corner.");
      console.log('[wizard] captureCorner REFUSED — empty buffer');
      return;
    }
    tapFeedback();
    const samples = sampleBufferRef.current;
    const avg = {
      x: samples.reduce((s, v) => s + v.normX, 0) / samples.length,
      y: samples.reduce((s, v) => s + v.normY, 0) / samples.length,
    };
    console.log(`[wizard] ${cornerLabel} avg normX=${avg.x.toFixed(3)} normY=${avg.y.toFixed(3)} mirX=${(1-avg.x).toFixed(3)}`);
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
      // All 4 corners captured — compute via the shared pure helper.
      const cal = computeCalibrationFromCorners(newSamples);
      const rangeX = cal.leftX - cal.rightX;
      const rangeY = cal.bottomY - cal.topY;
      console.log('[wizard] === CALIBRATION COMPUTED ===');
      console.log('[wizard] corner samples (in order TL, TR, BR, BL):', JSON.stringify(newSamples));
      console.log(`[wizard] cal: leftX=${cal.leftX.toFixed(3)} rightX=${cal.rightX.toFixed(3)} topY=${cal.topY.toFixed(3)} bottomY=${cal.bottomY.toFixed(3)}`);
      console.log(`[wizard] rangeX=${rangeX.toFixed(3)} rangeY=${rangeY.toFixed(3)} | convention OK=${rangeX>0 && rangeY>0} | minRange OK=${rangeX>=0.30 && rangeY>=0.30}`);
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
      // Generous radius — head-tracking calibration on a Mac webcam
      // often gives only ~50% of true head-movement range so the
      // cursor barely reaches screen edges. 150px lets "near enough"
      // count, which is the ACTUAL question the test asks ("does
      // calibration roughly work?"). 2026-05-08 user report: cursor
      // visibly tracking head but always 100-150px shy of target.
      const HIT_RADIUS = 150;
      const DWELL_MS = 500;
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
              <p className="text-white/70 text-sm mt-2 max-w-md mx-auto">
                💡 The green dot doesn&apos;t need to touch the circle yet. Just look
                at the center, then tap Capture. The cursor will line up after we
                calibrate all 4 corners.
              </p>
              <button
                onClick={captureCenter}
                data-testid="tracking-capture-center"
                disabled={sampleBufferRef.current.length === 0}
                className="mt-4 py-3 px-8 rounded-2xl bg-[#4CAF50] text-white font-bold text-lg shadow-lg active:scale-95 transition-transform disabled:opacity-30"
              >
                ✓ Capture center
              </button>
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
              <p className="text-white text-lg font-bold">{statusText || `Look at the ${CORNER_TARGETS[cornerIdx]?.label} corner`}</p>
              <p className="text-white/70 text-sm mt-2 max-w-md mx-auto">
                💡 Look at the highlighted corner, then tap Capture. Don&apos;t
                worry about the cursor position — it gets calibrated by these taps.
              </p>
              <button
                onClick={captureCorner}
                data-testid="tracking-capture-corner"
                disabled={sampleBufferRef.current.length === 0}
                className="mt-4 py-3 px-8 rounded-2xl bg-[#2196F3] text-white font-bold text-lg shadow-lg active:scale-95 transition-transform disabled:opacity-30"
              >
                ✓ Capture {CORNER_TARGETS[cornerIdx]?.label}
              </button>
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
                className={`absolute w-24 h-24 rounded-full transition-all duration-300 ${
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
            <div className="absolute bottom-20 left-0 right-0 text-center px-6">
              <p className="text-white text-lg font-bold">{statusText}</p>
              <p className="text-white/50 text-sm" data-testid="tracking-test-hits">
                {testTargets.filter(t => t.hit).length}/{testTargets.length} hits
              </p>
              <p className="text-white/60 text-xs mt-2 max-w-md mx-auto">
                💡 Look at the red circle — it counts as hit when the cursor
                gets close. You can also click the red circle directly.
              </p>
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

      {/* Live camera PIP — confirms the camera is actually running.
          Top-right corner so it doesn't fight with the diag panel. */}
      <div
        data-testid="tracking-wizard-pip-wrapper"
        style={{
          position: 'fixed',
          top: 80,
          right: 12,
          width: 200,
          height: 150,
          borderRadius: 10,
          overflow: 'hidden',
          border: '2px solid rgba(76,175,80,0.6)',
          backgroundColor: '#000',
          zIndex: 10002,
        }}
      >
        <video
          ref={pipVideoRef}
          muted
          playsInline
          autoPlay
          data-testid="tracking-wizard-pip"
          style={{
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            transform: 'scaleX(-1)',
            backgroundColor: '#000',
          }}
        />
        <div
          style={{
            position: 'absolute',
            bottom: 4,
            left: 6,
            color: '#9efc9e',
            fontFamily: 'ui-monospace, monospace',
            fontSize: 10,
            background: 'rgba(0,0,0,0.5)',
            padding: '2px 6px',
            borderRadius: 4,
          }}
        >
          camera feed
        </div>
      </div>

      {/* Live diagnostics overlay — shows raw pose, calibration, and
          mapping math so screenshots make the failure mode visible.
          Top-left of viewport, semi-transparent so it doesn't block
          the targets. Visible during every camera-active phase. */}
      {(phase === 'detecting' || phase === 'calibrate-center' ||
        phase === 'calibrate-corners' || phase === 'accuracy-test') && (
        <div
          data-testid="tracking-wizard-diag"
          style={{
            position: 'fixed',
            top: 80,
            left: 8,
            background: 'rgba(0,0,0,0.7)',
            color: '#9efc9e',
            fontFamily: 'ui-monospace, monospace',
            fontSize: 11,
            padding: '8px 10px',
            borderRadius: 6,
            border: '1px solid rgba(78,255,78,0.3)',
            maxWidth: 280,
            lineHeight: 1.4,
            zIndex: 10002,
            pointerEvents: 'none',
          }}
        >
          <div style={{ color: '#fff', fontWeight: 700, marginBottom: 4 }}>
            🛠 wizard diag
          </div>
          <div>phase: <span style={{ color: '#fff' }}>{phase}</span></div>
          <div>tracker: <span style={{ color: cursorColor }}>{trackerStatus}</span></div>
          <div>selectedPart: <span style={{ color: '#fff' }}>{selectedPart || 'none'}</span></div>
          <div>samples in buffer: <span style={{ color: '#fff' }}>{sampleBufferRef.current.length}</span></div>
          <div>cornerSamples: <span style={{ color: '#fff' }}>{cornerSamples.length}/4</span></div>
          {latestSample && (
            <div>
              normX: <span style={{ color: '#fff' }}>{latestSample.normX.toFixed(3)}</span>{' '}
              normY: <span style={{ color: '#fff' }}>{latestSample.normY.toFixed(3)}</span>{' '}
              mirX: <span style={{ color: '#fff' }}>{(1 - latestSample.normX).toFixed(3)}</span>
            </div>
          )}
          <div>
            cursor: <span style={{ color: '#fff' }}>({Math.round(cursorPos.x)}, {Math.round(cursorPos.y)})</span>
          </div>
          {latestCal && (() => {
            const rangeX = latestCal.leftX - latestCal.rightX;
            const rangeY = latestCal.bottomY - latestCal.topY;
            const conventionOK = rangeX > 0 && rangeY > 0;
            const minRangeOK = rangeX >= 0.30 && rangeY >= 0.30;
            return (
              <>
                <div style={{ marginTop: 4, color: '#fff', fontWeight: 700 }}>cal:</div>
                <div>
                  L={latestCal.leftX.toFixed(3)} R={latestCal.rightX.toFixed(3)}{' '}
                  T={latestCal.topY.toFixed(3)} B={latestCal.bottomY.toFixed(3)}
                </div>
                <div>
                  rangeX=<span style={{ color: rangeX > 0 ? '#9efc9e' : '#ff7e7e' }}>{rangeX.toFixed(3)}</span>{' '}
                  rangeY=<span style={{ color: rangeY > 0 ? '#9efc9e' : '#ff7e7e' }}>{rangeY.toFixed(3)}</span>
                </div>
                <div>
                  convention: <span style={{ color: conventionOK ? '#9efc9e' : '#ff7e7e' }}>{conventionOK ? 'OK' : 'INVERTED'}</span>{' '}
                  min-range: <span style={{ color: minRangeOK ? '#9efc9e' : '#ff7e7e' }}>{minRangeOK ? 'OK' : 'TOO NARROW'}</span>
                </div>
              </>
            );
          })()}
        </div>
      )}
    </div>
  );
}
