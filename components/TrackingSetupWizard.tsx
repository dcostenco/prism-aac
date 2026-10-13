'use client';
import { useState, useEffect, useLayoutEffect, useRef, useCallback } from 'react';
import { useSettingsStore } from '@/store/settingsStore';
import {
  startPoseTracker,
  savePoseCalibration,
  loadPoseCalibration,
  hasPoseCalibrationForTarget,
  getOrientation,
  DEFAULT_CALIBRATION,
  POSE_CALIBRATION_MIN_RANGE,
  freezeLearnerCalSaves,
  unfreezeLearnerCalSaves,
  applyCalibrationToActiveTracker,
  subscribePoseSamples,
  trackingTargetCandidates,
  beginPoseCalibrationDraft,
  markPoseWizardCompleted,
  type PoseCalibrationDraft,
  type PoseTrackerHandle,
  type TrackingTarget,
  type PoseCalibrationData,
} from '@/services/bodyPoseService';
import { CAMERA_CURSOR_TARGETS as CAMERA_TRACKING_TARGETS, isCameraCursorTarget } from '@/services/cameraTrackingTargets';
import { suspendCameraSelection } from '@/services/cameraSelection';
import {
  computeWizardCalibration,
  computeCenterPreviewCalibration,
} from '@/services/wizardCalibration';
import { aacSpeak } from '@/services/aacSpeak';
import { tapFeedback } from '@/services/feedback';
import { useT } from '@/engine/useT';
import { trackingLossKey } from '@/services/trackingFeedback';
import type { TrackingLossReason } from '@/services/trackingDiagnostics';
import { WRIST_PAUSE_SAMPLE_COUNT } from '@/services/wristMotion';

const WIZARD_CURSOR_SIZE = 36;
const ACCURACY_DWELL_MS = 400;
const CORNER_RING_RADIUS = 45;
const CORNER_TARGET_SIZE = 100;
const ACCURACY_TARGET_COUNT = 5;
const ACCURACY_TARGET_MIN = 15;
const ACCURACY_TARGET_RANGE = 70;

function createAccuracyTargets() {
  return Array.from({ length: ACCURACY_TARGET_COUNT }, () => ({
    x: ACCURACY_TARGET_MIN + Math.random() * ACCURACY_TARGET_RANGE,
    y: ACCURACY_TARGET_MIN + Math.random() * ACCURACY_TARGET_RANGE,
    hit: false,
  }));
}

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

function detectedStatus(parts: DetectedPart[]): string {
  return `Found: ${parts.map(part => part.emoji).join(' ')}`;
}

const BODY_PARTS = CAMERA_TRACKING_TARGETS.map(part => ({
  target: part.id, label: part.label, emoji: part.emoji,
}));

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
  // Own setup before sibling passive effects can start an overlay tracker.
  // A target change during setup must not let the overlay stop this tracker.
  useLayoutEffect(() => suspendCameraSelection(), []);
  const { speechRate, speechVolume, update: updateSettings } = useSettingsStore();
  // This wizard enables CameraInputOverlay, not the independent Head Tracking
  // gaze mode. Calibrate the same body-camera pipeline and chosen sensitivity.
  const cameraSensitivity = useSettingsStore(s => s.headTrackingSensitivity);
  const [phase, setPhase] = useState<Phase>('intro');
  const [detected, setDetected] = useState<DetectedPart[]>([]);
  const [selectedPart, setSelectedPart] = useState<TrackingTarget | null>(null);
  const [progress, setProgress] = useState(0);
  const [cornerIdx, setCornerIdx] = useState(0);
  const [cornerSamples, setCornerSamples] = useState<Array<{ x: number; y: number }>>([]);
  const [testTargets, setTestTargets] = useState<Array<{ x: number; y: number; hit: boolean; cameraHit?: boolean }>>([]);
  const accuracyTargetRef = useRef<HTMLButtonElement | null>(null);
  const cornerTargetRef = useRef<HTMLDivElement | null>(null);
  const accuracyInstructionsRef = useRef<HTMLDivElement | null>(null);
  const diagnosticRef = useRef<HTMLDivElement | null>(null);
  const pipWrapperRef = useRef<HTMLDivElement | null>(null);
  const { t } = useT();
  const [testIdx, setTestIdx] = useState(0);
  const [cursorPos, setCursorPos] = useState({ x: -100, y: -100 });
  const [statusText, setStatusText] = useState('');
  const [setupError, setSetupError] = useState<string | null>(null);
  const [lossReason, setLossReason] = useState<TrackingLossReason | null>(null);
  const motionPausedRef = useRef(false);
  const selectionReadyRef = useRef(false);
  const cursorPausedRef = useRef(false);

  const handleRef = useRef<PoseTrackerHandle | null>(null);
  const calibrationDraftRef = useRef<PoseCalibrationDraft | null>(null);
  const calibrationSkippedRef = useRef(false);
  const completedOrientationRef = useRef<'landscape' | 'portrait' | null>(null);
  const sampleBufferRef = useRef<Array<{ normX: number; normY: number }>>([]);
  const samplingAllowedRef = useRef(false);
  const detectionCountRef = useRef<Record<string, number>>({});
  // Captured center sample (raw normX/normY of the user's neutral pose).
  // Used by captureCorner's narrow-range fallback to anchor a default-
  // width calibration on the user's actual posture, so users who can't
  // physically reach screen corners (head tracking on a sofa, limited
  // mobility) still get a usable cursor mapping.
  const centerSampleRef = useRef<{ normX: number; normY: number } | null>(null);
  // Tracks setTimeout handles spawned by startDetection so we can
  // clear them on unmount. Without this, a fast Cancel after Get
  // Started left two timers (5000ms + 1500ms) firing on a stale
  // component, mutating state on a destroyed wizard.
  // Identified in May 2026 military-grade review.
  const detectionTimersRef = useRef<ReturnType<typeof setTimeout>[]>([]);
  const mountedRef = useRef(true);
  // Live camera PIP preview. Initially attached the srcObject ONCE
  // and got stuck on a stale (stopped) MediaStream after the tracker
  // restarted for the selected body part — user report 2026-05-08
  // "camera feed was visible for 1 sec or so before diagnostics,
  // then started black". Now: every 300ms compare the current
  // tracker's srcObject with the PIP's, and re-attach whenever they
  // differ. Also detect when the stream's tracks have ended (camera
  // released) and clear the PIP so the user sees "no feed" honestly
  // instead of a frozen frame.
  const pipVideoRef = useRef<HTMLVideoElement | null>(null);
  useEffect(() => {
    const interval = setInterval(() => {
      const pip = pipVideoRef.current;
      if (!pip) return;
      const videoEl = handleRef.current?.videoElement;
      const trackerStream = videoEl?.srcObject as MediaStream | null;
      const pipStream = pip.srcObject as MediaStream | null;
      if (trackerStream && trackerStream !== pipStream) {
        pip.srcObject = trackerStream;
        pip.play().catch(() => {});
        console.log(`[wizard] PIP (re)attached — stream tracks=${trackerStream.getTracks().length}`);
      } else if (pipStream) {
        const live = pipStream.getVideoTracks().some(t => t.readyState === 'live');
        if (!live) {
          pip.srcObject = null;
          console.log('[wizard] PIP cleared — stream tracks ended');
        }
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

  // Clean up tracker + pending timers + mark unmounted on cleanup.
  // Re-arm mountedRef on every mount: useRef preserves identity across
  // a React StrictMode dev mount → cleanup → remount cycle, AND across
  // any parent-driven remount. Without this re-arm, the cleanup of the
  // first lifecycle stuck mountedRef.current = false on the same ref
  // the remount inherits, and every detection timer's early-exit guard
  // fired silently (May 2026 — wizard "can't pass step 1" investigation).
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      handleRef.current?.stop();
      calibrationDraftRef.current?.rollback();
      calibrationDraftRef.current = null;
      for (const id of detectionTimersRef.current) clearTimeout(id);
      detectionTimersRef.current = [];
      // Always unfreeze + bump generation on unmount — CameraInputOverlay
      // then restarts with the saved cal AFTER the wizard is gone (no conflict).
      unfreezeLearnerCalSaves();
      const s = useSettingsStore.getState();
      if (s.cameraInputEnabled) {
        s.update({ poseCalibrationGeneration: s.poseCalibrationGeneration + 1 });
      }
    };
  }, []);

  // Listen for raw pose samples
  useEffect(() => {
    return subscribePoseSamples(detail => {
      if (samplingAllowedRef.current && detail?.normX != null) {
        motionPausedRef.current = detail.motionPaused === true;
        selectionReadyRef.current = detail.selectionReady === true;
        sampleBufferRef.current.push({ normX: detail.normX, normY: detail.normY });
        if (sampleBufferRef.current.length > 100) sampleBufferRef.current.shift();
      }
    });
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
  interface PoseSampleDetail {
    normX: number;
    normY: number;
    noiseFloor?: number;
    visibility?: number;
    egoSuppressed?: boolean;
  }
  const [latestSample, setLatestSample] = useState<PoseSampleDetail | null>(null);
  const [latestCal, setLatestCal] = useState<PoseCalibrationData | null>(null);
  // Throttle pose-sample updates to ~5Hz — the diag panel doesn't
  // need 30Hz refresh for human-readable display, and 30 React
  // re-renders per second is real CPU/battery drain on iPad mini 6
  // for AAC users running the wizard for extended setup sessions.
  // The latest sample is captured on every event into a ref; the
  // 200ms tick reads the ref into state once per cycle.
  // Identified in May 2026 military-grade review.
  const latestSampleRef = useRef<PoseSampleDetail | null>(null);
  useEffect(() => {
    const unsubscribe = subscribePoseSamples(detail => {
      if (detail?.normX != null) {
        latestSampleRef.current = {
          normX: detail.normX,
          normY: detail.normY,
          noiseFloor: detail.noiseFloor,
          visibility: detail.visibility,
          egoSuppressed: detail.egoSuppressed,
        };
      }
    });
    const flushInterval = setInterval(() => {
      if (latestSampleRef.current) setLatestSample(latestSampleRef.current);
    }, 200);
    return () => {
      unsubscribe();
      clearInterval(flushInterval);
    };
  }, []);
  // Re-read the saved calibration whenever phase changes so the
  // diagnostic panel reflects whatever was just captured.
  useEffect(() => {
    try { setLatestCal(loadPoseCalibration()); } catch { /* */ }
  }, [phase, cornerSamples]);

  // ── PHASE: Detection ──
  const startDetection = useCallback(() => {
    if (!isCameraCursorTarget(useSettingsStore.getState().cameraTrackingTarget)) {
      setSetupError(t('camera_choose_wrist'));
      return;
    }
    try {
      calibrationDraftRef.current = beginPoseCalibrationDraft();
      calibrationSkippedRef.current = false;
      setSetupError(null);
    } catch (error) {
      setSetupError(error instanceof Error ? error.message : t('error'));
      return;
    }
    const requested = BODY_PARTS.find(part => part.target === useSettingsStore.getState().cameraTrackingTarget)
      ?? BODY_PARTS.find(part => part.target === 'right_wrist')!;
    setPhase('detecting');
    setSelectedPart(null);
    setStatusText('Looking for you...');
    speak('Hold still. I am looking for you.');
    detectionCountRef.current = {};
    completedOrientationRef.current = null;
    centerSampleRef.current = null;
    // Freeze learner saves for the entire wizard run. The online learner
    // overwrites DEFAULT_CALIBRATION within seconds — freezing it keeps
    // the wizard-set cal stable throughout Steps 1–2.
    freezeLearnerCalSaves();
    // Stage a factory preview without changing the saved calibration, so the running tracker's
    // preview cursor uses DEFAULT_CALIBRATION (a sensible starting
    // mapping) instead of a stale posture-mismatched cal from a
    // prior wizard session. Without this, users on Step 1 see the
    // cursor wandering off the center target because the saved cal's
    // midpoint was anchored on a different posture.
    // 2026-05-08 user report (Image #47/#48): saved cal midpoint
    // (0.470, 0.586) didn't match user's CURRENT neutral pose
    // (mirX=0.533, normY=0.689) — preview cursor offset by ~100px.
    // Only explicit confirmation replaces the durable calibration.
    try { savePoseCalibration(DEFAULT_CALIBRATION); applyCalibrationToActiveTracker(DEFAULT_CALIBRATION); } catch { /* */ }

    if (handleRef.current) handleRef.current.stop();

    const handle = startPoseTracker({
      dwellMs: 99999,
      sensitivity: cameraSensitivity,
      smoothing: 0.15,
      trackingTarget: requested.target,
      selectedTargetOnly: true,
      requireHeadPresence: true,
      calibrationMode: 'setup',
      cursorSmoothing: 0.12,
      onTrackingLoss(reason) { setLossReason(reason); motionPausedRef.current = false; selectionReadyRef.current = false; },
      onMotionStateChange(motion) { cursorPausedRef.current = motion.selectionReady === true; },
      onMove(x, y) { setCursorPos({ x, y }); },
      onDwell() {},
      onStatusChange(status, activeTarget) {
        samplingAllowedRef.current = status === 'tracking';
        setTrackerStatus(status);
        if (status === 'tracking' || status === 'starting') setLossReason(null);
        if (status === 'tracking' && activeTarget) {
          const counts = detectionCountRef.current;
          counts[activeTarget] = (counts[activeTarget] || 0) + 1;
        }
      },
    });
    handleRef.current = handle;

    // After 5 seconds, analyze which body parts were detected.
    // Timer is tracked + cleared on unmount so a quick Cancel
    // doesn't leave a stale closure mutating destroyed state.
    let noDetectionAnnounced = false;
    const analyzeDetection = () => {
      if (!mountedRef.current) return;
      const counts = detectionCountRef.current;
      const results: DetectedPart[] = [];
      for (const bp of BODY_PARTS) {
        // Aggregate modes need not see six frames of the same side. The
        // runtime may legitimately alternate sides as visibility changes.
        const count = trackingTargetCandidates(bp.target).reduce((sum, target) => sum + (counts[target] || 0), 0);
        if (count > 5) {
          results.push({ ...bp, confidence: Math.min(100, Math.round(count / 1.5)) });
        }
      }
      results.sort((a, b) => b.confidence - a.confidence);
      setDetected(results);

      const matched = results.find(part => part.target === requested.target);
      if (matched) {
        const top = matched;
        setSelectedPart(top.target);
        setStatusText(detectedStatus(results));
        speak(`I can see your ${top.label}. Let's calibrate.`);
        const advanceTimer = setTimeout(() => {
          if (!mountedRef.current) return;
          startCenterCalibrationRef.current?.();
        }, 1500);
        detectionTimersRef.current.push(advanceTimer);
      } else {
        setStatusText(results.length > 0 ? detectedStatus(results) : 'No body parts detected. Try moving closer.');
        if (!noDetectionAnnounced && results.length === 0) {
          speak('I cannot see you. Please move closer to the camera.');
          noDetectionAnnounced = true;
        }
        // Camera permission/model loading can outlast the first deadline.
        // Keep checking fresh results rather than getting permanently stuck
        // after declaring failure before the first usable frame arrives.
        const retryTimer = setTimeout(() => {
          detectionTimersRef.current = detectionTimersRef.current.filter(id => id !== retryTimer);
          analyzeDetection();
        }, 1000);
        detectionTimersRef.current.push(retryTimer);
      }
    };
    const detectTimer = setTimeout(analyzeDetection, 5000);
    detectionTimersRef.current.push(detectTimer);
  }, [speak, cameraSensitivity, t]);

  // Setup and the runtime overlay must use the same requested mode,
  // including aggregate modes that can switch to the more visible side.
  const restartTrackerForPart = useCallback((target: TrackingTarget) => {
    if (handleRef.current) handleRef.current.stop();
    console.log(`[wizard] restartTrackerForPart target=${target}`);
    const handle = startPoseTracker({
      dwellMs: 99999,
      sensitivity: cameraSensitivity,
      smoothing: 0.15,
      trackingTarget: target,
      selectedTargetOnly: true,
      requireHeadPresence: true,
      calibrationMode: 'setup',
      cursorSmoothing: 0.12,
      onTrackingLoss(reason) { setLossReason(reason); motionPausedRef.current = false; selectionReadyRef.current = false; },
      onMotionStateChange(motion) { cursorPausedRef.current = motion.selectionReady === true; },
      onMove(x, y) {
        if (samplingAllowedRef.current) setCursorPos({ x, y });
      },
      onDwell() {},
      onStatusChange(status, activeTarget) {
        const matches = status === 'tracking' && trackingTargetCandidates(target).some(candidate => candidate === activeTarget);
        samplingAllowedRef.current = matches;
        if (!matches) sampleBufferRef.current = [];
        // Runtime fallback is useful outside setup, but cannot silently
        // calibrate a different body part. Wait for the selected part again.
        const setupStatus = status === 'tracking' && !matches ? 'lost' : status;
        setTrackerStatus(setupStatus);
        if (setupStatus === 'tracking' || setupStatus === 'starting') setLossReason(null);
        console.log(`[wizard] tracker status → ${setupStatus}`);
      },
    });
    handleRef.current = handle;
  }, [cameraSensitivity]);

  // ── PHASE: Calibrate Center ──
  // Calibration is user-driven, NOT timer-driven. The previous
  // implementation auto-advanced after 3s regardless of whether the
  // user was actually pointing. Now: user taps Capture when ready.
  const startCenterCalibration = useCallback(() => {
    for (const id of detectionTimersRef.current) clearTimeout(id);
    detectionTimersRef.current = [];
    setPhase('calibrate-center');
    sampleBufferRef.current = [];
    setProgress(0);
    setStatusText(t('tracking_setup_center_hint'));
    speak(t('tracking_setup_center_guide'));
    // Critical: re-spin the tracker on the selected part so the
    // cursor actually follows the user's hand/finger, not their nose.
    if (selectedPart) restartTrackerForPart(selectedPart);
  }, [speak, selectedPart, restartTrackerForPart, t]);

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

  // Observe for accessible auto-capture, but do not chase the running
  // mean with a new map every two seconds. captureCenter applies the
  // neutral mapping once, after a capture, without erasing measured noise.
  useEffect(() => {
    if (phase !== 'calibrate-center') return;
    let stableCount = 0;
    const id = setInterval(() => {
      const buf = sampleBufferRef.current;
      if (buf.length < 20) return;
      // Auto-capture: stable-hold path (best case — low jitter users).
      if (buf.length >= 50) {
        const isStable = samplingAllowedRef.current && selectionReadyRef.current;
        if (isStable) {
          stableCount++;
          if (stableCount >= 2) {
            console.log('[wizard] auto-capture center — stable hold');
            captureCenterCallbackRef.current?.();
            return;
          }
        } else {
          stableCount = 0;
        }
      }
      // After twenty seconds, a measured pause can use the current samples
      // without requiring absolute stillness. Earlier travel is not neutral.
      if (buf.length >= 20 && samplingAllowedRef.current && selectionReadyRef.current) {
        const w = typeof window !== 'undefined' ? (window as unknown as {__centerPhaseStart?:number}) : null;
        const elapsed = w ? (performance.now() - (w.__centerPhaseStart ?? performance.now())) : 0;
        if (elapsed >= 20_000) {
          console.log('[wizard] auto-capture center — 20s timeout (high jitter / movement)');
          captureCenterCallbackRef.current?.();
        }
      }
    }, 2000);
    return () => clearInterval(id);
  }, [phase]);

  // Stamp the phase-start time so the center hard timeout can measure elapsed.
  useEffect(() => {
    if (phase === 'calibrate-center' && typeof window !== 'undefined') {
      (window as unknown as {__centerPhaseStart:number}).__centerPhaseStart = performance.now();
    }
  }, [phase]);

  /** User taps Capture — average the latest raw sample window
   *  and advance. Refuses to advance if the buffer is empty (no pose
   *  data) so we don't bake (0.5, 0.5) into the calibration. */
  const captureCenter = useCallback(() => {
    const samples = sampleBufferRef.current.slice(-WRIST_PAUSE_SAMPLE_COUNT);
    const n = samples.length;
    console.log(`[wizard] captureCenter — bufferSize=${n}`);
    if (n === 0) {
      setStatusText(t('tracking_setup_center_guide'));
      console.log('[wizard] captureCenter REFUSED — empty buffer');
      return;
    }
    const sx = samples.reduce((s, v) => s + v.normX, 0) / n;
    const sy = samples.reduce((s, v) => s + v.normY, 0) / n;
    console.log(`[wizard] center avg normX=${sx.toFixed(3)} normY=${sy.toFixed(3)}`);
    centerSampleRef.current = { normX: sx, normY: sy };

    // Apply preview calibration centered on captured neutral.
    // wizardCalibration.computeCenterPreviewCalibration anchors the cursor
    // on the user's actual neutral pose — overrides DEFAULT_CALIBRATION's
    // generic midpoint so Step-2 cursor tracks correctly from the first frame.
    try {
      handleRef.current?.setCalibration(
        computeCenterPreviewCalibration({ normX: sx, normY: sy })
      );
    } catch { /* best-effort */ }

    tapFeedback();
    sampleBufferRef.current = [];
    setCornerIdx(0);
    setCornerSamples([]);
    setPhase('calibrate-corners');
    setProgress(0);
    const guide = t('tracking_setup_corner_guide').replace('{corner}', CORNER_TARGETS[0].label);
    setStatusText(guide);
    speak(guide);
  }, [speak, t]);

  // Keep the ref pointing at the latest startCenterCalibration so
  // earlier-declared callbacks (startDetection) can invoke it without
  // a TDZ violation. The deps array refreshes when speak changes.
  useEffect(() => {
    startCenterCalibrationRef.current = startCenterCalibration;
  }, [startCenterCalibration]);

  // Ref for captureCenter — allows the live-recentering/auto-capture
  // interval (declared above captureCenter due to React hooks ordering)
  // to call captureCenter without a forward-reference TDZ error.
  const captureCenterCallbackRef = useRef<(() => void) | null>(null);
  useEffect(() => { captureCenterCallbackRef.current = captureCenter; }, [captureCenter]);

  const skipCalibration = useCallback(() => {
    if (!mountedRef.current || !calibrationDraftRef.current) return;
    tapFeedback();
    // The explicit tracker setter also saves. Keep that preview write
    // inside our draft before rolling it back, never after the rollback.
    handleRef.current?.setCalibration(DEFAULT_CALIBRATION);
    calibrationDraftRef.current?.rollback();
    calibrationDraftRef.current = null;
    calibrationSkippedRef.current = true;
    // Defaults remain a preview only. Skip never replaces a saved profile,
    // even after center capture or an external saved-profile change.
    setCornerSamples([]);
    setTestTargets(createAccuracyTargets());
    setTestIdx(0);
    completedOrientationRef.current = getOrientation();
    setPhase('accuracy-test');
    setStatusText(t('tracking_setup_skip_notice'));
  }, [t]);

  // ── PHASE: Calibrate Corners — user-driven ──
  // Capture handler for corners, called when the user taps Capture.
  // Refuses to advance if no pose samples (same guard as center).
  const captureCorner = useCallback(() => {
    const n = sampleBufferRef.current.length;
    const cornerLabel = CORNER_TARGETS[cornerIdx]?.label;
    console.log(`[wizard] captureCorner ${cornerIdx + 1}/4 (${cornerLabel}) — bufferSize=${n}`);
    if (n === 0) {
      setStatusText(t('tracking_setup_center_guide'));
      console.log('[wizard] captureCorner REFUSED — empty buffer');
      return;
    }
    tapFeedback();
    const samples = sampleBufferRef.current.slice(-WRIST_PAUSE_SAMPLE_COUNT);
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
      const guide = t('tracking_setup_corner_guide').replace('{corner}', next.label);
      speak(guide);
      setStatusText(guide);
    } else {
      // All 4 corners captured — delegate to wizardCalibration service.
      // computeWizardCalibration handles: mirror, narrow-range fallback,
      // and re-centering on the captured Step-1 neutral pose.
      const { cal, usedFallbackRange, rangeX, rangeY } = computeWizardCalibration(
        centerSampleRef.current,
        newSamples,
      );
      console.log('[wizard] === CALIBRATION COMPUTED ===');
      console.log('[wizard] corner samples:', JSON.stringify(newSamples));
      console.log(`[wizard] final cal: L=${cal.leftX.toFixed(3)} R=${cal.rightX.toFixed(3)} T=${cal.topY.toFixed(3)} B=${cal.bottomY.toFixed(3)} rangeX=${rangeX.toFixed(3)} rangeY=${rangeY.toFixed(3)} fallback=${usedFallbackRange}`);

      cal.wizardCompleted = true;
      cal.trackingTarget = selectedPart ?? undefined;
      cal.orientation = getOrientation();
      savePoseCalibration(cal);
      applyCalibrationToActiveTracker(cal);
      unfreezeLearnerCalSaves();
      // T-5 FIX (v3): flag stored IN calibration data (per-user).
      // Also set global key for backward compat with older code paths.
      try { markPoseWizardCompleted(); } catch {}
      // Increment generation → CameraInputOverlay restarts tracker with new cal.
      // Also enable tracking in case it was disabled.
      updateSettings({
        cameraInputEnabled: true,
        // NOTE: poseCalibrationGeneration NOT incremented here — wizard is still
        // mounted. Incrementing would trigger CameraInputOverlay to restart and
        // stop the wizard's tracker mid-accuracy-test. Generation bumped in
        // onComplete (after wizard unmounts) and in Cancel path.
      });
      speak(t('tracking_accuracy_unverified'));

      setTestTargets(createAccuracyTargets());
      setTestIdx(0);
      completedOrientationRef.current = getOrientation();
      setPhase('accuracy-test');
      setStatusText('Look at each red circle until it goes green');
    }
  }, [cornerIdx, cornerSamples, speak, t]);

  // ── PHASE: Accuracy Test ──
  const handleTestHit = useCallback((idx: number, hit = true, cameraHit = false) => {
    if (!mountedRef.current || idx !== testIdx || testTargets[idx]?.hit) return;
    if (hit) {
      tapFeedback();
      speak('Great!');
      setTestTargets(prev => prev.map((target, i) => i === idx ? { ...target, hit: true, cameraHit } : target));
    }

    if (testIdx >= testTargets.length - 1) {
      const timer = setTimeout(() => {
        if (!mountedRef.current) return;
        const hits = testTargets.filter(target => target.cameraHit).length + (hit && cameraHit ? 1 : 0);
        speak(t('tracking_camera_hits').replace('{hits}', String(hits)).replace('{total}', String(testTargets.length)));
        setPhase('complete');
      }, 500);
      detectionTimersRef.current.push(timer);
    } else {
      setTestIdx(testIdx + 1);
    }
  }, [testIdx, testTargets, speak, t]);

  // Camera-cursor dwell detection — fires handleTestHit when the
  // camera-tracked cursor stays within the active target's radius
  // for 400ms. Without this the user had to physically mouse-click
  // each circle, defeating the point of the test ("does the camera
  // cursor land on what you point at?"). User report 2026-05-08 —
  // calibration stuck at "Step 3: Test (1/5) — 0/5 hits" with the
  // cursor visibly on the target but no hit firing.
  const dwellHitRef = useRef<{ idx: number; start: number } | null>(null);
  useEffect(() => {
    if (phase !== 'accuracy-test' || trackerStatus !== 'tracking') {
      dwellHitRef.current = null;
      return;
    }
    const interval = setInterval(() => {
      const target = testTargets[testIdx];
      if (!target || target.hit) return;
      if (!samplingAllowedRef.current || !cursorPausedRef.current) { dwellHitRef.current = null; return; }
      const element = accuracyTargetRef.current;
      const bounds = element?.getBoundingClientRect();
      const { x, y } = cursorPosRef.current;
      // Verify the visible circle, not a larger invisible acceptance area.
      // Read the latest movement without restarting this timer every frame.
      const radius = bounds ? Math.min(bounds.width, bounds.height) / 2 : 0;
      const fits = bounds && Math.hypot(x - bounds.left - bounds.width / 2,
        y - bounds.top - bounds.height / 2) + WIZARD_CURSOR_SIZE / 2 <= radius;
      const overlapsTarget = (panel: HTMLElement | null) => {
        const rect = panel?.getBoundingClientRect();
        return bounds && rect && rect.width > 0 && rect.height > 0 &&
          bounds.left < rect.right && bounds.right > rect.left &&
          bounds.top < rect.bottom && bounds.bottom > rect.top;
      };
      const covered = overlapsTarget(diagnosticRef.current) || overlapsTarget(pipWrapperRef.current) ||
        overlapsTarget(accuracyInstructionsRef.current);
      // Pointer-transparent diagnostics still obscure the circle visually.
      const inViewport = bounds && bounds.left >= 0 && bounds.top >= 0 &&
        bounds.right <= window.innerWidth && bounds.bottom <= window.innerHeight;
      if (fits && inViewport && !covered && element?.contains(document.elementFromPoint(x, y))) {
        if (dwellHitRef.current?.idx !== testIdx) {
          dwellHitRef.current = { idx: testIdx, start: Date.now() };
        } else if (Date.now() - dwellHitRef.current.start >= ACCURACY_DWELL_MS) {
          dwellHitRef.current = null;
          handleTestHit(testIdx, true, true);
        }
      } else {
        if (dwellHitRef.current?.idx === testIdx) dwellHitRef.current = null;
      }
    }, 80);
    return () => clearInterval(interval);
  }, [phase, trackerStatus, testIdx, testTargets, handleTestHit]);

  // Accuracy test auto-complete — after 10s per target, skip and
  // advance without manufacturing a hit. Calibration was staged in captureCorner; the
  // accuracy test is verification only. Limited-mobility users can't
  // reach all 5 randomly-placed targets so the test would never pass
  // otherwise. User confirmed (Image #62): 0/5 hits, no way to complete.
  const testStartRef = useRef<number>(0);
  const testIdxRef = useRef(testIdx);
  useEffect(() => { testIdxRef.current = testIdx; }, [testIdx]);
  const handleTestHitRef = useRef<((idx: number, hit?: boolean) => void) | null>(null);
  useEffect(() => { handleTestHitRef.current = handleTestHit; }, [handleTestHit]);
  useEffect(() => {
    if (phase !== 'accuracy-test') return;
    testStartRef.current = Date.now();
  }, [phase, testIdx]);
  useEffect(() => {
    if (phase !== 'accuracy-test') return;
    const id = setInterval(() => {
      if (Date.now() - testStartRef.current >= 10_000) {
        console.log(`[wizard] auto-advance test target ${testIdxRef.current + 1} — 10s timeout`);
        handleTestHitRef.current?.(testIdxRef.current, false);
      }
    }, 500);
    return () => clearInterval(id);
  }, [phase]);

  // Corner auto-capture — two triggers:
  //   1. PROXIMITY: full cursor inside the visible corner ring for 1.5s
  //   2. TIMEOUT: after 5s on a corner, capture whatever position
  //      the cursor is at (best-effort). If user can't move cursor
  //      to the corner, the narrow-range fallback uses center-only
  //      cal anyway. If they can, it captures their real range.
  //      Either way the wizard completes automatically — user doesn't
  //      need to interact at all with corners.
  const cornerStartRef = useRef<number>(0);
  const cornerDwellRef = useRef<{ idx: number; start: number } | null>(null);
  const captureCornercallbackRef = useRef<(() => void) | null>(null);
  const cursorPosRef = useRef(cursorPos);
  const cornerIdxRef = useRef(cornerIdx);
  useEffect(() => { captureCornercallbackRef.current = captureCorner; }, [captureCorner]);
  useEffect(() => { cursorPosRef.current = cursorPos; }, [cursorPos]);
  useEffect(() => { cornerIdxRef.current = cornerIdx; }, [cornerIdx]);

  // Reset the 5s timer ONLY when phase enters calibrate-corners or cornerIdx changes.
  // NOT on cursor movement — cursor movement was resetting it every frame,
  // preventing the 5s timeout from ever firing (bug found Image #60).
  useEffect(() => {
    if (phase !== 'calibrate-corners') return;
    cornerStartRef.current = Date.now();
    cornerDwellRef.current = null;
  }, [phase, cornerIdx]);

  useEffect(() => {
    if (phase !== 'calibrate-corners') {
      cornerDwellRef.current = null;
      return;
    }
    const CORNER_DWELL_MS = 1500;
    const CORNER_TIMEOUT_MS = 5000;
    const id = setInterval(() => {
      if (!samplingAllowedRef.current || !selectionReadyRef.current || sampleBufferRef.current.length === 0) {
        cornerDwellRef.current = null; return;
      }
      const elapsed = Date.now() - cornerStartRef.current;
      const curIdx = cornerIdxRef.current;
      // Comfortable-range fallback: capture only a qualified pause after 5s,
      // never an arbitrary moving frame or a stale/lost cursor position.
      if (elapsed >= CORNER_TIMEOUT_MS) {
        console.log(`[wizard] auto-capture corner ${curIdx + 1} — timeout ${CORNER_TIMEOUT_MS}ms`);
        cornerDwellRef.current = null;
        captureCornercallbackRef.current?.();
        return;
      }
      // Proximity path — fires when cursor holds near the corner target.
      const corner = CORNER_TARGETS[curIdx];
      if (!corner) return;
      const bounds = cornerTargetRef.current?.getBoundingClientRect();
      if (!bounds || bounds.width === 0 || bounds.height === 0) return;
      const tx = bounds.left + bounds.width / 2;
      const ty = bounds.top + bounds.height / 2;
      const { x, y } = cursorPosRef.current;
      const dist = Math.sqrt((x - tx) ** 2 + (y - ty) ** 2);
      // A large viewport-relative radius includes neutral after targets move
      // into a reserved workarea. Only an actual visible fit is a corner pause.
      const ringRadius = Math.min(bounds.width, bounds.height) * CORNER_RING_RADIUS / CORNER_TARGET_SIZE;
      if (dist + WIZARD_CURSOR_SIZE / 2 <= ringRadius) {
        if (!cornerDwellRef.current || cornerDwellRef.current.idx !== curIdx) {
          cornerDwellRef.current = { idx: curIdx, start: Date.now() };
        } else if (Date.now() - cornerDwellRef.current.start >= CORNER_DWELL_MS) {
          console.log(`[wizard] auto-capture corner ${curIdx + 1} — proximity dist=${Math.round(dist)}px`);
          cornerDwellRef.current = null;
          captureCornercallbackRef.current?.();
        }
      } else {
        cornerDwellRef.current = null;
      }
    }, 200);
    return () => { clearInterval(id); cornerDwellRef.current = null; };
  }, [phase]);

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
  const cameraHits = testTargets.filter(target => target.cameraHit).length;
  const accuracyPassed = testTargets.length > 0 && cameraHits === testTargets.length;

  // ── RENDER ──
  return (
    <div
      className="fixed inset-0 z-[10000] bg-[#0a0a1a] flex flex-col"
      data-testid="tracking-setup-wizard"
      data-phase={phase}
      data-tracker-status={trackerStatus}
      data-pose-sample-count={sampleBufferRef.current.length}
      data-physical-pause={motionPausedRef.current ? 'true' : 'false'}
      data-selection-ready={selectionReadyRef.current ? 'true' : 'false'}
    >
      {/* Header */}
      <div className="tracking-wizard-header shrink-0 flex items-center justify-between px-6 py-4">
        <button
          onClick={() => {
            handleRef.current?.stop();
            calibrationDraftRef.current?.rollback();
            calibrationDraftRef.current = null;
            // Disable finger/camera tracking on cancel so the user
            // isn't left with an uncalibrated tracker after abandoning
            // the wizard mid-run.
            unfreezeLearnerCalSaves();
            updateSettings({ cameraInputEnabled: false });
            onCancel();
          }}
          className="text-white/60 text-lg font-semibold"
        >Cancel</button>
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

      {setupError && <p role="alert" className="px-6 py-2 text-red-300">{t('error')} {setupError}</p>}
      {/* Progress dots */}
      <div className="tracking-wizard-progress shrink-0 flex justify-center gap-2 pb-4">
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
      <div className="tracking-wizard-layout" data-camera-active={phase !== 'intro' && phase !== 'complete' ? 'true' : 'false'}>
      <div className="tracking-wizard-workarea" data-testid="tracking-wizard-workarea">

        {/* INTRO */}
        {phase === 'intro' && (
          <div className="tracking-wizard-intro text-center px-8 max-w-lg">
            <div className="text-8xl mb-6">🎯</div>
            <h2 className="text-white text-3xl font-black mb-4">Let&apos;s Set Up Tracking</h2>
            <p className="text-white/70 text-lg mb-4">{t('camera_wrist_scope')}</p>
            <ul className="text-white/80 text-sm mb-6 text-left bg-white/5 rounded-xl p-4 space-y-2">
              <li className="flex gap-2"><span>1️⃣</span><span>{t('tracking_setup_center_guide')}</span></li>
              <li className="flex gap-2"><span>2️⃣</span><span>{t('tracking_setup_corner_guide').replace('{corner}', CORNER_TARGETS[0].label)}</span></li>
              <li className="flex gap-2"><span>3️⃣</span><span>{t('tracking_setup_manual_capture')}</span></li>
              <li className="flex gap-2"><span>4️⃣</span><span>Watch the camera preview to confirm you&apos;re visible.</span></li>
            </ul>
            <p className="text-white/50 text-xs mb-6">
              {t('tracking_setup_exit_help')}
            </p>
            <button
              onClick={() => { tapFeedback(); startDetection(); }}
              data-testid="tracking-setup-start"
              className="w-full py-4 rounded-2xl bg-[#4CAF50] text-white font-bold text-xl shadow-lg active:scale-95 transition-transform"
            >
              Start Setup
            </button>
          </div>
        )}

        {/* DETECTING */}
        {phase === 'detecting' && (
          <div className="text-center px-8 max-w-md">
            <div className="relative w-40 h-40 mx-auto mb-6">
              <div className="absolute inset-0 rounded-full border-4 border-[#4CAF50]/30 animate-ping" />
              <div className="absolute inset-4 rounded-full border-4 border-[#4CAF50]/50 animate-pulse" />
              <div className="absolute inset-0 flex items-center justify-center text-6xl">👁</div>
            </div>
            <p className="text-white text-xl font-bold mb-2">{statusText}</p>
            <p className="text-white/60 text-sm">
              {t('tracking_setup_center_guide')}
            </p>

            {detected.length > 0 && (
              <div className="mt-6 space-y-3">
                <p className="text-white/70 text-sm">Detected:</p>
                <div className="flex flex-wrap justify-center gap-2">
                  {detected.map(d => (
                    <button
                      key={d.target}
                      onClick={() => {
                        tapFeedback();
                        for (const id of detectionTimersRef.current) clearTimeout(id);
                        detectionTimersRef.current = [];
                        setSelectedPart(d.target);
                      }}
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
            <div className="fixed inset-0 pointer-events-none flex items-center justify-center">
              <div className="relative">
                <svg data-testid="tracking-center-target" width="120" height="120" className="animate-pulse">
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
          </>
        )}

        {/* CALIBRATE CORNERS */}
        {phase === 'calibrate-corners' && (
          <>
            {CORNER_TARGETS.map((corner, idx) => (
              <div
                key={idx}
                ref={idx === cornerIdx ? cornerTargetRef : undefined}
                data-testid={`tracking-corner-target-${idx}`}
                className={`absolute pointer-events-none transition-all duration-500 ${idx === cornerIdx ? 'scale-100 opacity-100' : idx < cornerIdx ? 'scale-75 opacity-30' : 'scale-50 opacity-10'}`}
                style={{ left: `clamp(${CORNER_TARGET_SIZE / 2}px, ${corner.x}%, calc(100% - ${CORNER_TARGET_SIZE / 2}px))`, top: `clamp(${CORNER_TARGET_SIZE / 2}px, ${corner.y}%, calc(100% - ${CORNER_TARGET_SIZE / 2}px))`, transform: 'translate(-50%, -50%)' }}
              >
                {idx === cornerIdx ? (
                  <div className="relative">
                    <svg width={CORNER_TARGET_SIZE} height={CORNER_TARGET_SIZE}>
                      <circle cx="50" cy="50" r={CORNER_RING_RADIUS} fill="none" stroke="rgba(33,150,243,0.3)" strokeWidth="4" />
                      <circle
                        cx="50" cy="50" r={CORNER_RING_RADIUS}
                        fill="none" stroke="#2196F3" strokeWidth="6"
                        strokeDasharray={283}
                        strokeDashoffset={283 * (1 - progress)}
                        strokeLinecap="round"
                        transform="rotate(-90 50 50)"
                      />
                    </svg>
                    <div className="absolute inset-0 flex items-center justify-center text-3xl text-white">{corner.emoji}</div>
                  </div>
                ) : (
                  <div className={`w-12 h-12 rounded-full flex items-center justify-center ${idx < cornerIdx ? 'bg-[#4CAF50]' : 'bg-white/10'}`}>
                    <span className="text-xl">{idx < cornerIdx ? '✓' : corner.emoji}</span>
                  </div>
                )}
              </div>
            ))}
          </>
        )}

        {/* ACCURACY TEST */}
        {phase === 'accuracy-test' && (
          <>
            {testTargets.map((target, idx) => (
              <button
                key={idx}
                ref={idx === testIdx ? accuracyTargetRef : undefined}
                onClick={() => handleTestHit(idx)}
                data-testid={`tracking-test-target-${idx}`}
                data-active={idx === testIdx ? 'true' : 'false'}
                data-hit={target.hit ? 'true' : 'false'}
                data-camera-hit={target.cameraHit ? 'true' : 'false'}
                disabled={idx !== testIdx || target.hit}
                className={`absolute w-24 h-24 rounded-full transition-all duration-300 ${
                  target.hit
                    ? 'bg-[#4CAF50] scale-75 opacity-50'
                    : idx === testIdx
                      ? 'bg-[#FF6B6B] animate-pulse shadow-lg shadow-[#FF6B6B]/50 scale-110'
                      : 'bg-white/10 scale-75'
                }`}
                style={{
                  left: `clamp(60px, ${target.x}%, calc(100% - 60px))`,
                  top: `clamp(60px, ${target.y}%, calc(100% - 60px))`,
                  zIndex: idx === testIdx ? 1 : 0,
                  pointerEvents: idx === testIdx ? 'auto' : 'none',
                  transform: 'translate(-50%, -50%)',
                }}
              >
                {target.hit ? <span className="text-2xl">✓</span> : idx === testIdx ? <span className="text-2xl">👆</span> : null}
              </button>
            ))}
            {/* Global cursor (rendered below outside the per-phase
                blocks) shows the camera-tracked position. The accuracy
                test handler runs the dwell-on-target hit detection. */}
          </>
        )}

        {/* COMPLETE */}
        {phase === 'complete' && (
          <div className="tracking-wizard-complete text-center px-8 max-w-md max-h-full overflow-y-auto">
            <div className="tracking-wizard-result-icon text-8xl mb-6">{accuracyPassed ? '🎉' : 'ℹ️'}</div>
            <h2 className="text-white text-3xl font-black mb-4">{t('done')}</h2>
            <p className="text-white/70 text-lg mb-2">
              Tracking: {detected.find(d => d.target === selectedPart)?.emoji} {detected.find(d => d.target === selectedPart)?.label}
            </p>
            <p className="text-white/80 text-sm mb-8" data-testid="tracking-accuracy-result"
              data-camera-hits={cameraHits} data-accuracy-passed={accuracyPassed ? 'true' : 'false'}>
              {t(accuracyPassed ? 'tracking_accuracy_passed' : 'tracking_accuracy_unverified')}
              <br />
              {t('tracking_camera_hits').replace('{hits}', String(cameraHits)).replace('{total}', String(testTargets.length))}
            </p>
            {calibrationSkippedRef.current && <p role="status" data-testid="tracking-skip-notice" className="text-white/70 text-sm mb-2">
              {t('tracking_setup_skip_notice')}
            </p>}
            <button
              data-testid="tracking-confirm"
              onClick={() => {
                tapFeedback();
                try {
                  if (!calibrationSkippedRef.current) {
                    if (!selectedPart || !calibrationDraftRef.current) throw new Error(t('camera_wrist_calibration_needed'));
                    calibrationDraftRef.current.commit(completedOrientationRef.current ?? undefined, selectedPart);
                  }
                  calibrationDraftRef.current = null;
                  setSetupError(null);
                } catch (error) {
                  setSetupError(error instanceof Error ? error.message : t('error'));
                  return;
                }
                unfreezeLearnerCalSaves();
                useSettingsStore.getState().update({
                  ...(selectedPart ? { cameraTrackingTarget: selectedPart } : {}),
                  cameraInputEnabled: !!selectedPart && hasPoseCalibrationForTarget(selectedPart),
                  poseCalibrationGeneration: useSettingsStore.getState().poseCalibrationGeneration + 1,
                });
                handleRef.current?.stop();
                onComplete();
              }}
              className="w-full py-4 rounded-2xl bg-[#4CAF50] text-white font-bold text-xl shadow-lg active:scale-95 transition-transform"
            >
              {t('save')} &amp; {t('done')}
            </button>
          </div>
        )}
      </div>
      {(phase === 'calibrate-center' || phase === 'calibrate-corners' || phase === 'accuracy-test') && (
        <div ref={accuracyInstructionsRef} className="tracking-wizard-guide" data-testid="tracking-wizard-guide">
          {phase === 'calibrate-center' && (
            <div className="text-center">
              <p className="text-white text-lg font-bold">{statusText}</p>
              <p className="text-white/80 text-sm mt-2 max-w-md mx-auto">
                {t('tracking_setup_center_guide')}
              </p>
              <p className="text-white/50 text-xs mt-1 max-w-md mx-auto">
                💡 The cursor isn&apos;t aligned yet — that&apos;s what these 4 captures fix.
              </p>
              <button
                onClick={captureCenter}
                data-testid="tracking-capture-center"
                disabled={sampleBufferRef.current.length === 0}
                className="mt-4 py-3 px-8 rounded-2xl bg-[#4CAF50] text-white font-bold text-lg shadow-lg active:scale-95 transition-transform disabled:opacity-30"
              >
                ✓ Capture center{sampleBufferRef.current.length > 0 ? ` (${sampleBufferRef.current.length})` : ''}
              </button>
              <button
                onClick={skipCalibration}
                data-testid="tracking-calibrate-skip"
                className="mt-3 text-white/50 text-xs underline block mx-auto"
              >
                {t('tracking_setup_skip_calibration')}
              </button>
            </div>
          )}
          {phase === 'calibrate-corners' && (
            <div className="text-center">
              <p className="text-white text-xl font-bold">
                {`Step ${cornerIdx + 1} of 4: ${CORNER_TARGETS[cornerIdx]?.label}`}
              </p>
              <p className="text-white/90 text-base mt-2 max-w-lg mx-auto">
                {t('tracking_setup_corner_guide').replace('{corner}', CORNER_TARGETS[cornerIdx]?.label ?? '')}
              </p>
              <p className="text-white/50 text-xs mt-1 max-w-md mx-auto">
                💡 {t('tracking_setup_corner_pause')}
              </p>
              <button
                onClick={captureCorner}
                data-testid="tracking-capture-corner"
                disabled={sampleBufferRef.current.length === 0}
                className="mt-4 py-3 px-8 rounded-2xl bg-[#2196F3] text-white font-bold text-lg shadow-lg active:scale-95 transition-transform disabled:opacity-30"
              >
                ✓ Capture {CORNER_TARGETS[cornerIdx]?.label}{sampleBufferRef.current.length > 0 ? ` (${sampleBufferRef.current.length})` : ''}
              </button>
              {/* Limited-mobility path — prominent, clearly worded.
                  The captured-neutral preview is already live. This
                  button finalises the draft for accuracy testing without
                  requiring 4 corners; Save & Done persists it. */}
              {centerSampleRef.current && (
                <button
                  onClick={() => {
                    const center = centerSampleRef.current;
                    if (!mountedRef.current || !center) return;
                    tapFeedback();
                    // Finalize the same captured neutral mapping as preview,
                    // including the live learner's completed-calibration lock.
                    const cal = { ...computeCenterPreviewCalibration(center), wizardCompleted: true,
                      trackingTarget: selectedPart ?? undefined, orientation: getOrientation() };
                    savePoseCalibration(cal);
                    applyCalibrationToActiveTracker(cal);
                    unfreezeLearnerCalSaves();
                    updateSettings({
                      cameraInputEnabled: true,
                      // NOTE: poseCalibrationGeneration NOT incremented here — wizard is still
        // mounted. Incrementing would trigger CameraInputOverlay to restart and
        // stop the wizard's tracker mid-accuracy-test. Generation bumped in
        // onComplete (after wizard unmounts) and in Cancel path.
                    });
                    setTestTargets(createAccuracyTargets());
                    setTestIdx(0);
                    completedOrientationRef.current = getOrientation();
                    setPhase('accuracy-test');
                    setStatusText('Look at each red circle until it goes green');
                    speak(t('tracking_accuracy_unverified'));
                  }}
                  data-testid="tracking-save-center-only"
                  className="mt-3 py-2 px-6 rounded-xl bg-white/10 text-white text-sm font-semibold block mx-auto active:scale-95 transition-transform"
                >
                  {t('tracking_setup_center_only')} →
                </button>
              )}
              <button
                onClick={skipCalibration}
                data-testid="tracking-corners-skip"
                className="mt-2 text-white/40 text-xs underline block mx-auto"
              >
                {t('tracking_setup_skip_calibration')}
              </button>
            </div>
          )}
          {phase === 'accuracy-test' && (
            <div className="text-center">
              <p className="text-white text-lg font-bold">{statusText}</p>
              <p className="text-white/50 text-sm" data-testid="tracking-test-hits">
                {t('tracking_camera_hits').replace('{hits}', String(cameraHits)).replace('{total}', String(testTargets.length))}
              </p>
              <p className="text-white/80 text-sm mt-2 max-w-lg mx-auto">
                {t('tracking_setup_corner_guide').replace('{corner}', '🔴')}{' '}
                When the green cursor lands on the red circle, it turns green. You can also
                click the red circle directly.
              </p>
              <button
                onClick={() => { tapFeedback(); setPhase('complete'); }}
                data-testid="tracking-test-skip"
                className="mt-3 text-white/50 text-xs underline"
              >
                Skip test → save calibration anyway
              </button>
            </div>
          )}
        </div>
      )}
      <div className="tracking-wizard-support">
      {/* Live preview and diagnostics share a reserved support region,
          outside the calibration workarea and its capture controls. */}
      <div
        className="tracking-wizard-preview"
        ref={pipWrapperRef}
        data-testid="tracking-wizard-pip-wrapper"
        style={{

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

      {/* Raw pose/calibration diagnostics stay available during every
          camera-active phase without covering any target. */}
      {(phase === 'detecting' || phase === 'calibrate-center' ||
        phase === 'calibrate-corners' || phase === 'accuracy-test') && (
        <div
          className="tracking-wizard-diagnostics"
          ref={diagnosticRef}
          data-testid="tracking-wizard-diag"
          data-calibration-left-x={latestCal?.leftX}
          data-calibration-right-x={latestCal?.rightX}
          data-calibration-top-y={latestCal?.topY}
          data-calibration-bottom-y={latestCal?.bottomY}
          data-calibration-completed={latestCal?.wizardCompleted ? 'true' : 'false'}
          style={{

            background: 'rgba(0,0,0,0.7)',
            color: '#9efc9e',
            fontFamily: 'ui-monospace, monospace',

            padding: '8px 10px',
            borderRadius: 6,
            border: '1px solid rgba(78,255,78,0.3)',

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
          <div>cursor: <span style={{ color: '#fff' }}>({Math.round(cursorPos.x)}, {Math.round(cursorPos.y)})</span></div>
          {latestSample && (
            <>
              <div className="tracking-wizard-diagnostic-wide">
                normX: <span style={{ color: '#fff' }}>{latestSample.normX.toFixed(3)}</span>{' '}
                normY: <span style={{ color: '#fff' }}>{latestSample.normY.toFixed(3)}</span>{' '}
                mirX: <span style={{ color: '#fff' }}>{(1 - latestSample.normX).toFixed(3)}</span>
              </div>
              {latestSample.visibility != null && (
                <div>
                  visibility: <span style={{
                    color: (latestSample.visibility ?? 0) >= 0.5 ? '#9efc9e' : '#ffd47e',
                  }}>{(latestSample.visibility ?? 0).toFixed(2)}</span>
                </div>
              )}
              {latestSample.noiseFloor != null && (
                <div>
                  noise: <span style={{
                    color: (latestSample.noiseFloor ?? 0) < 0.01 ? '#9efc9e'
                      : (latestSample.noiseFloor ?? 0) < 0.03 ? '#ffd47e' : '#ff7e7e',
                  }}>{(latestSample.noiseFloor ?? 0).toFixed(4)}</span>
                  {' '}
                  <span style={{ color: '#aaa' }}>
                    ({(latestSample.noiseFloor ?? 0) < 0.005 ? 'quiet'
                      : (latestSample.noiseFloor ?? 0) < 0.02 ? 'normal'
                      : (latestSample.noiseFloor ?? 0) < 0.05 ? 'jittery' : 'heavy'})
                  </span>
                </div>
              )}
              {latestSample.egoSuppressed && (
                <div style={{ color: '#ff7e7e' }}>⛔ ego-motion suppressed</div>
              )}
            </>
          )}
          {latestCal && (() => {
            const rangeX = latestCal.leftX - latestCal.rightX;
            const rangeY = latestCal.bottomY - latestCal.topY;
            const conventionOK = rangeX > 0 && rangeY > 0;
            const minRangeOK = rangeX >= POSE_CALIBRATION_MIN_RANGE && rangeY >= POSE_CALIBRATION_MIN_RANGE;
            return (
              <>
                <div className="tracking-wizard-diagnostic-wide" style={{ marginTop: 4, color: '#fff', fontWeight: 700 }}>cal:</div>
                <div className="tracking-wizard-diagnostic-wide">
                  L={latestCal.leftX.toFixed(3)} R={latestCal.rightX.toFixed(3)}{' '}
                  T={latestCal.topY.toFixed(3)} B={latestCal.bottomY.toFixed(3)}
                </div>
                <div className="tracking-wizard-diagnostic-wide">
                  rangeX=<span style={{ color: rangeX > 0 ? '#9efc9e' : '#ff7e7e' }}>{rangeX.toFixed(3)}</span>{' '}
                  rangeY=<span style={{ color: rangeY > 0 ? '#9efc9e' : '#ff7e7e' }}>{rangeY.toFixed(3)}</span>
                </div>
                <div className="tracking-wizard-diagnostic-wide">
                  convention: <span style={{ color: conventionOK ? '#9efc9e' : '#ff7e7e' }}>{conventionOK ? 'OK' : 'INVERTED'}</span>{' '}
                  min-range: <span style={{ color: minRangeOK ? '#9efc9e' : '#ff7e7e' }}>{minRangeOK ? 'OK' : 'TOO NARROW'}</span>
                </div>
              </>
            );
          })()}
        </div>
      )}
      </div>
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
            left: cursorPos.x - WIZARD_CURSOR_SIZE / 2,
            top: cursorPos.y - WIZARD_CURSOR_SIZE / 2,
            width: WIZARD_CURSOR_SIZE,
            height: WIZARD_CURSOR_SIZE,
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
      <div className="tracking-wizard-status shrink-0 px-6 py-3 flex items-center justify-center gap-2"
           data-testid="tracking-wizard-status">
        <div className={`w-2 h-2 rounded-full`} style={{ backgroundColor: cursorColor }} />
        <span className="text-white/60 text-xs font-semibold">
          {trackerStatus === 'tracking' && `Tracking ${selectedPart ? `your ${BODY_PARTS.find(b => b.target === selectedPart)?.label.toLowerCase() ?? 'finger'}` : 'you'}`}
          {trackerStatus === 'lost' && (lossReason ? t(trackingLossKey(lossReason)) : t('tracking_unavailable'))}
          {trackerStatus === 'starting' && 'Loading camera…'}
          {trackerStatus === 'stopped' && (lossReason ? t(trackingLossKey(lossReason)) : 'Camera not running')}
        </span>
      </div>


    </div>
  );
}
