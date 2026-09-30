'use client';
import { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import {
  initHandDetector,
  detectHand,
  destroyHandDetector,
  accumulateHandScan,
  finalizeScan,
  resetScanAccumulator,
  saveProfile,
  setActiveProfile,
  getActiveProfile,
  autoTuneFromTremor,
  recordTouchSample,
  enableContinuousLearning,
  HandProfile,
} from '@/services/handProfileService';
import { tapFeedback, keyFeedback } from '@/services/feedback';
import { useT } from '@/engine/useT';

const SCAN_TARGET_FRAMES = 30;
const TOUCH_TARGETS = 20;

interface CalibrationTarget {
  x: number;
  y: number;
  label: string;
}

function generateTargets(count: number): CalibrationTarget[] {
  const targets: CalibrationTarget[] = [];
  const labels = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');
  const cols = 5;
  const rows = Math.ceil(count / cols);

  for (let i = 0; i < count; i++) {
    const col = i % cols;
    const row = Math.floor(i / cols);
    targets.push({
      x: 15 + (col / (cols - 1)) * 70,
      y: 25 + (row / Math.max(rows - 1, 1)) * 50,
      label: labels[i % labels.length],
    });
  }
  return targets;
}

export default function HandCalibration({ onClose }: { onClose: () => void }) {
  const { t } = useT();
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [phase, setPhase] = useState<'init' | 'scan' | 'touch' | 'tremor' | 'done' | 'error'>('init');
  const [scanProgress, setScanProgress] = useState(0);
  const [touchIndex, setTouchIndex] = useState(0);
  const [status, setStatus] = useState('');
  const [profile, setProfile] = useState<HandProfile | null>(null);
  const [profileName, setProfileName] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const streamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef(0);
  const scanRunRef = useRef(0);
  const scanCountRef = useRef(0);
  const touchTargets = useMemo(() => generateTargets(TOUCH_TARGETS), []);
  const touchOffsetsRef = useRef<Array<{ dx: number; dy: number }>>([]);

  // ── Phase 1: Initialize camera + MediaPipe ──
  const startScan = useCallback(async () => {
    const runId = ++scanRunRef.current;
    cancelAnimationFrame(rafRef.current);
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    resetScanAccumulator();
    scanCountRef.current = 0;
    touchOffsetsRef.current = [];
    setTouchIndex(0);
    setScanProgress(0);
    setProfile(null);
    setErrorMessage('');
    setPhase('init');
    setStatus(t('starting') || 'Starting...');

    const ok = await initHandDetector();
    if (runId !== scanRunRef.current) return;
    if (!ok) {
      setStatus('');
      setErrorMessage('Hand tracking could not start. Try again. If it keeps failing, close calibration and reopen it.');
      setPhase('error');
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 640 }, height: { ideal: 480 }, facingMode: 'user' },
        audio: false,
      });
      if (runId !== scanRunRef.current) {
        stream.getTracks().forEach(track => track.stop());
        return;
      }
      streamRef.current = stream;

      const video = videoRef.current!;
      video.srcObject = stream;
      await video.play();
      if (runId !== scanRunRef.current) return;

      setPhase('scan');
      setStatus('Hold your hand in front of the camera');
      const tick = () => {
        if (runId !== scanRunRef.current) return;
        if (scanCountRef.current >= SCAN_TARGET_FRAMES) {
          const geo = finalizeScan();
          const p: HandProfile = {
            ...getActiveProfile(),
            id: `profile-${Date.now()}`,
            name: '',
            ...geo,
            created: new Date().toISOString(),
            lastCalibrated: new Date().toISOString(),
          };
          stream.getTracks().forEach(track => track.stop());
          if (streamRef.current === stream) streamRef.current = null;
          setProfile(p);
          setPhase('touch');
          setStatus('Tap each highlighted letter');
          return;
        }

        const landmarks = detectHand(video, performance.now());
        if (landmarks) {
          accumulateHandScan(landmarks, video.videoWidth, video.videoHeight);
          scanCountRef.current++;
          setScanProgress(scanCountRef.current);
        }

        rafRef.current = requestAnimationFrame(tick);
      };

      rafRef.current = requestAnimationFrame(tick);
    } catch {
      if (runId !== scanRunRef.current) return;
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
        streamRef.current = null;
      }
      destroyHandDetector();
      setStatus('');
      setErrorMessage('Camera access is required to scan your hand. Allow camera access, close other camera apps, then try again.');
      setPhase('error');
    }
  }, [t]);

  // ── Phase 2: Touch calibration ──
  const handleCalibrationTouch = useCallback((e: React.TouchEvent | React.MouseEvent) => {
    if (phase !== 'touch' || touchIndex >= TOUCH_TARGETS) return;

    let rawX: number, rawY: number;
    if ('touches' in e) {
      const touch = e.touches[0] || (e as React.TouchEvent).changedTouches[0];
      rawX = touch.clientX;
      rawY = touch.clientY;
    } else {
      rawX = e.clientX;
      rawY = e.clientY;
    }

    keyFeedback();
    recordTouchSample(rawX, rawY);

    const target = touchTargets[touchIndex];
    const targetX = (target.x / 100) * window.innerWidth;
    const targetY = (target.y / 100) * window.innerHeight;

    touchOffsetsRef.current.push({
      dx: targetX - rawX,
      dy: targetY - rawY,
    });

    const nextIdx = touchIndex + 1;
    setTouchIndex(nextIdx);

    if (nextIdx >= TOUCH_TARGETS) {
      // Compute average offsets
      const offsets = touchOffsetsRef.current;
      let sumDx = 0, sumDy = 0;
      for (const o of offsets) { sumDx += o.dx; sumDy += o.dy; }
      const avgDx = Math.round(sumDx / offsets.length);
      const avgDy = Math.round(sumDy / offsets.length);

      setProfile(prev => prev ? {
        ...prev,
        xOffset: Math.max(-15, Math.min(15, avgDx)),
        yOffset: Math.max(-20, Math.min(-2, avgDy)),
        touchSamples: TOUCH_TARGETS,
      } : null);

      setPhase('tremor');
      setStatus('Hold finger still on screen for 3 seconds');
    }
  }, [phase, touchIndex, touchTargets]);

  // ── Phase 3: Tremor measurement ──
  const tremorTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const tremorDoneRef = useRef(false);

  const handleTremorTouch = useCallback((e: React.TouchEvent) => {
    if (phase !== 'tremor' || tremorDoneRef.current) return;

    const touch = e.touches[0];
    if (touch) recordTouchSample(touch.clientX, touch.clientY);
  }, [phase]);

  const handleTremorStart = useCallback(() => {
    if (phase !== 'tremor') return;
    tremorDoneRef.current = false;
    tremorTimerRef.current = setTimeout(() => {
      tremorDoneRef.current = true;
      if (profile) {
        const tuned = autoTuneFromTremor(profile);
        setProfile(tuned);
      }
      setPhase('done');
      setStatus('Calibration complete');
    }, 3000);
  }, [phase, profile]);

  const handleTremorEnd = useCallback(() => {
    if (tremorTimerRef.current) {
      clearTimeout(tremorTimerRef.current);
      tremorTimerRef.current = null;
    }
  }, []);

  // ── Save & Close ──
  const handleSave = useCallback(() => {
    if (!profile) return;
    tapFeedback();
    const finalProfile = { ...profile, name: profileName || 'My Hand' };
    saveProfile(finalProfile);
    setActiveProfile(finalProfile.id);
    enableContinuousLearning();
    onClose();
  }, [profile, profileName, onClose]);

  // ── Cleanup ──
  useEffect(() => {
    const scanRun = scanRunRef;
    return () => {
      scanRun.current++;
      cancelAnimationFrame(rafRef.current);
      if (streamRef.current) streamRef.current.getTracks().forEach(t => t.stop());
      if (tremorTimerRef.current) clearTimeout(tremorTimerRef.current);
      destroyHandDetector();
    };
  }, []);

  const currentTarget = phase === 'touch' && touchIndex < TOUCH_TARGETS
    ? touchTargets[touchIndex]
    : null;

  return (
    <div data-testid="hand-calibration" className="fixed inset-0 z-[100] surface-app flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 surface-bar border-b border-theme">
        <h2 data-testid="hand-calibration-title" className="text-primary font-bold text-lg">
          {phase === 'init' && 'Hand Calibration'}
          {phase === 'scan' && 'Scanning Hand...'}
          {phase === 'touch' && `Touch Calibration (${touchIndex}/${TOUCH_TARGETS})`}
          {phase === 'tremor' && 'Tremor Measurement'}
          {phase === 'done' && 'Calibration Complete'}
          {phase === 'error' && 'Hand Calibration'}
        </h2>
        <button onClick={onClose} aria-label="Close hand calibration" className="text-muted text-xl">✕</button>
      </div>

      {/* Status */}
      <div className="px-4 py-2 text-center">
        <p data-testid="hand-calibration-status" className="text-muted text-sm">{status}</p>
      </div>

      {/* Main area */}
      <div className="flex-1 relative overflow-hidden">
        {/* Camera preview (during scan) */}
        {(phase === 'init' || phase === 'scan') && (
          <div className="absolute inset-0 flex items-center justify-center">
            <video
              ref={videoRef}
              playsInline
              muted
              autoPlay
              className="w-full max-w-md rounded-2xl border-4 border-theme"
              style={{ transform: 'scaleX(-1)' }}
            />
            <canvas ref={canvasRef} className="hidden" />
            {phase === 'scan' && (
              <div className="absolute bottom-8 left-1/2 -translate-x-1/2 w-64">
                <div className="h-3 rounded-full bg-gray-200 overflow-hidden">
                  <div
                    className="h-full bg-[#4CAF50] transition-all"
                    style={{ width: `${(scanProgress / SCAN_TARGET_FRAMES) * 100}%` }}
                  />
                </div>
                <p data-testid="hand-scan-progress" className="text-center text-sm text-muted mt-1">{scanProgress}/{SCAN_TARGET_FRAMES} frames</p>
              </div>
            )}
          </div>
        )}

        {/* Recoverable initialization failure */}
        {phase === 'error' && (
          <div className="absolute inset-0 flex items-center justify-center p-6">
            <div role="alert" className="surface-key w-full max-w-md rounded-2xl border border-theme p-6 text-center shadow-lg">
              <div className="text-5xl mb-3" aria-hidden="true">🤚</div>
              <h3 className="text-primary text-xl font-bold mb-2">Hand scan unavailable</h3>
              <p className="text-muted text-sm mb-5">{errorMessage}</p>
              <div className="flex flex-col sm:flex-row gap-3">
                <button
                  onClick={startScan}
                  className="aac-btn flex-1 bg-[#2196F3] text-white rounded-xl py-3 font-bold"
                >
                  Retry Hand Scan
                </button>
                <button
                  onClick={onClose}
                  className="aac-btn flex-1 surface-bar text-primary border border-theme rounded-xl py-3 font-bold"
                >
                  Close Calibration
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Touch calibration targets */}
        {phase === 'touch' && (
          <div
            className="absolute inset-0"
            onTouchStart={handleCalibrationTouch}
            onClick={handleCalibrationTouch}
          >
            {currentTarget && (
              <div
                className="absolute flex items-center justify-center w-16 h-16 rounded-full bg-[#2196F3] text-white text-2xl font-bold animate-pulse shadow-lg"
                style={{
                  left: `${currentTarget.x}%`,
                  top: `${currentTarget.y}%`,
                  transform: 'translate(-50%, -50%)',
                }}
              >
                {currentTarget.label}
              </div>
            )}
            <p className="absolute bottom-8 left-1/2 -translate-x-1/2 text-muted text-lg font-semibold">
              Tap the blue circle
            </p>
          </div>
        )}

        {/* Tremor measurement */}
        {phase === 'tremor' && (
          <div
            className="absolute inset-0 flex items-center justify-center"
            onTouchStart={handleTremorStart}
            onTouchMove={handleTremorTouch}
            onTouchEnd={handleTremorEnd}
          >
            <div className="w-32 h-32 rounded-full border-4 border-[#FF9800] flex items-center justify-center animate-pulse">
              <span className="text-4xl">👆</span>
            </div>
            <p className="absolute bottom-8 text-muted text-lg font-semibold text-center px-8">
              Press and hold your finger on the circle for 3 seconds
            </p>
          </div>
        )}

        {/* Results */}
        {phase === 'done' && profile && (
          <div className="p-6 space-y-4 max-w-md mx-auto">
            <div className="surface-key rounded-xl p-4 border border-theme space-y-2">
              <div className="flex justify-between">
                <span className="text-muted">Hand</span>
                <span className="text-primary font-bold capitalize">{profile.handedness}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted">Palm Width</span>
                <span className="text-primary font-bold">{profile.palmWidthPx}px</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted">Index Finger</span>
                <span className="text-primary font-bold">{profile.fingerLengthsPx[1]}px</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted">Approach Angle</span>
                <span className="text-primary font-bold">{profile.approachAngle}°</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted">Touch Y-Offset</span>
                <span className="text-primary font-bold">{profile.yOffset}px</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted">Touch X-Offset</span>
                <span className="text-primary font-bold">{profile.xOffset}px</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted">Tremor Frequency</span>
                <span className="text-primary font-bold">{profile.tremorFreqHz} Hz</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted">Tremor Amplitude</span>
                <span className="text-primary font-bold">{profile.tremorAmplPx}px</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted">EMA Alpha (auto-tuned)</span>
                <span className="text-primary font-bold">{profile.emaAlpha}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted">Dead Zone (auto-tuned)</span>
                <span className="text-primary font-bold">{profile.deadZonePx}px</span>
              </div>
            </div>

            <input
              type="text"
              value={profileName}
              onChange={(e) => setProfileName(e.target.value)}
              placeholder="Profile name (e.g., My Hand)"
              className="w-full surface-key rounded-xl px-4 py-3 text-lg border border-theme"
            />

            <button
              onClick={handleSave}
              className="aac-btn w-full bg-[#4CAF50] text-white rounded-xl py-4 text-xl font-bold"
            >
              Save Profile & Start
            </button>
          </div>
        )}
      </div>

      {/* Start button (init phase) */}
      {phase === 'init' && !status && (
        <div className="p-6">
          <button
            onClick={startScan}
            className="aac-btn w-full bg-[#2196F3] text-white rounded-xl py-4 text-xl font-bold"
          >
            Start Hand Scan
          </button>
          <p className="text-muted text-sm text-center mt-2">
            Hold your hand 30cm from the camera. We&apos;ll scan your hand shape, then calibrate touch precision.
          </p>
        </div>
      )}
    </div>
  );
}
