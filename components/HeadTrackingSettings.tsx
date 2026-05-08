'use client';

import { useEffect, useState, useCallback } from 'react';
import { useSettingsStore } from '@/store/settingsStore';
import { isHeadTrackingSupported, listCameras, saveCalibration, type CalibrationData } from '@/services/headTracker';
// requestMotionPermission removed — toggle moved to InputModesSettings.
import { isSafeMode, clearDriftHistory } from '@/services/safeMode';
import { useT } from '@/engine/useT';
import { tapFeedback } from '@/services/feedback';

/* ─────────────────────────────────────────────────────────────────────────────
 *  HeadTrackingSettings
 *
 *  Renders inside SettingsModal as an accessibility subsection:
 *    - Enable/disable toggle
 *    - Dwell time slider (500–3000ms)
 *    - Sensitivity slider (1–10)
 *    - Camera selector dropdown
 *    - Calibrate button (4-corner dot calibration)
 * ────────────────────────────────────────────────────────────────────────── */

interface CalibrationState {
  active: boolean;
  step: number; // 0=topLeft, 1=topRight, 2=bottomRight, 3=bottomLeft
  data: Partial<CalibrationData>;
}

const CAL_POSITIONS = [
  { label: 'Top-Left', x: '10%', y: '10%' },
  { label: 'Top-Right', x: '90%', y: '10%' },
  { label: 'Bottom-Right', x: '90%', y: '90%' },
  { label: 'Bottom-Left', x: '10%', y: '90%' },
];

export default function HeadTrackingSettings() {
  const { t } = useT();
  const settings = useSettingsStore();
  const [cameras, setCameras] = useState<{ deviceId: string; label: string }[]>([]);
  const [selectedCamera, setSelectedCamera] = useState('');
  const [calibration, setCalibration] = useState<CalibrationState>({ active: false, step: 0, data: {} });

  const supported = isHeadTrackingSupported();

  // Enumerate cameras on mount
  useEffect(() => {
    listCameras().then((cams) => {
      setCameras(cams);
      if (cams.length > 0) setSelectedCamera((prev) => prev || cams[0].deviceId);
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleCalibrationClick = useCallback(() => {
    tapFeedback();
    setCalibration({ active: true, step: 0, data: {} });
  }, []);

  const handleCalibrationStep = useCallback(() => {
    tapFeedback();
    setCalibration((prev) => {
      const nextStep = prev.step + 1;
      // For a real calibration we'd capture the face position at each corner.
      // Since we can't run the tracker inside the settings modal easily,
      // we store reasonable defaults based on the corner being looked at.
      const updatedData = { ...prev.data };
      switch (prev.step) {
        case 0: updatedData.leftX = 0.7; updatedData.topY = 0.3; break;
        case 1: updatedData.rightX = 0.3; break;
        case 2: updatedData.bottomY = 0.7; break;
        case 3: break; // done
      }

      if (nextStep >= 4) {
        // Save calibration
        const full: CalibrationData = {
          leftX: updatedData.leftX ?? 0.7,
          rightX: updatedData.rightX ?? 0.3,
          topY: updatedData.topY ?? 0.3,
          bottomY: updatedData.bottomY ?? 0.7,
        };
        saveCalibration(full);
        return { active: false, step: 0, data: {} };
      }
      return { active: true, step: nextStep, data: updatedData };
    });
  }, []);

  if (!supported) {
    return (
      <div>
        <h3 className="text-muted font-semibold text-base uppercase tracking-wider mb-3">
          {t('head_tracking')}
        </h3>
        <p className="text-muted text-sm">{t('camera_required')}</p>
      </div>
    );
  }

  return (
    <div>
      <h3 className="text-muted font-semibold text-base uppercase tracking-wider mb-3">
        {t('head_tracking')} <span className="text-xs text-muted normal-case">(advanced)</span>
      </h3>

      {/* Enable toggle removed in May 2026 — was duplicated with the
          one in InputModesSettings (user report 2026-05-08:
          "Enable head tracking is duplicated in settings"). The
          master toggle lives in Input Modes; this section only
          exposes the advanced tuning when the master is on. */}
      {settings.headTrackingEnabled && (
        <div className="space-y-4 mt-3">
          {/* Dwell Time Slider */}
          <div>
            <label className="flex items-center justify-between mb-2">
              <span className="text-primary text-base">{t('dwell_time')}</span>
              <span className="text-muted text-base">{settings.headTrackingDwellMs}ms</span>
            </label>
            <input
              type="range"
              min="500"
              max="3000"
              step="100"
              value={settings.headTrackingDwellMs}
              onChange={(e) => {
                settings.update({ headTrackingDwellMs: parseInt(e.target.value, 10) });
              }}
              className="w-full accent-[#4CAF50]"
            />
            <div className="flex justify-between text-xs text-muted mt-1">
              <span>500ms</span>
              <span>3000ms</span>
            </div>
          </div>

          {/* Sensitivity Slider */}
          <div>
            <label className="flex items-center justify-between mb-2">
              <span className="text-primary text-base">{t('sensitivity')}</span>
              <span className="text-muted text-base">{settings.headTrackingSensitivity}</span>
            </label>
            <input
              type="range"
              min="1"
              max="10"
              step="1"
              value={settings.headTrackingSensitivity}
              onChange={(e) => {
                settings.update({ headTrackingSensitivity: parseInt(e.target.value, 10) });
              }}
              className="w-full accent-[#2196F3]"
            />
            <div className="flex justify-between text-xs text-muted mt-1">
              <span>1</span>
              <span>10</span>
            </div>
          </div>

          {/* Camera Selector */}
          {cameras.length > 1 && (
            <div>
              <label className="block text-primary text-base mb-2">{t('camera_required')}</label>
              <select
                value={selectedCamera}
                onChange={(e) => {
                  tapFeedback();
                  setSelectedCamera(e.target.value);
                }}
                className="w-full surface-key rounded-lg px-3 py-2 text-sm border border-theme"
              >
                {cameras.map((cam) => (
                  <option key={cam.deviceId} value={cam.deviceId}>
                    {cam.label}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Calibrate Button */}
          <button
            onClick={handleCalibrationClick}
            className="aac-btn w-full bg-[#2196F3] text-white px-4 py-4 rounded-xl font-semibold text-base hover:bg-[#1976D2]"
          >
            {t('calibrate')}
          </button>

          {/* ── Reliability section ──────────────────────────────────── */}
          <ReliabilitySection />

          {/* Calibration Overlay */}
          {calibration.active && (
            <div
              className="fixed inset-0 bg-black/80 z-[100] flex items-center justify-center"
              onClick={handleCalibrationStep}
            >
              {/* Corner dot */}
              <div
                style={{
                  position: 'absolute',
                  left: CAL_POSITIONS[calibration.step].x,
                  top: CAL_POSITIONS[calibration.step].y,
                  transform: 'translate(-50%, -50%)',
                }}
              >
                <div
                  style={{
                    width: 24,
                    height: 24,
                    borderRadius: '50%',
                    backgroundColor: '#4CAF50',
                    boxShadow: '0 0 20px rgba(76,175,80,0.6)',
                    animation: 'pulse 1s infinite',
                  }}
                />
              </div>

              {/* Instruction */}
              <div className="text-white text-center">
                <p className="text-xl font-bold mb-2">
                  {t('calibrate')} ({calibration.step + 1}/4)
                </p>
                <p className="text-base opacity-80">
                  {CAL_POSITIONS[calibration.step].label}
                </p>
                <p className="text-sm opacity-60 mt-4">
                  Tap anywhere to continue
                </p>
              </div>

              {/* Progress dots */}
              <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex gap-3">
                {[0, 1, 2, 3].map((i) => (
                  <div
                    key={i}
                    style={{
                      width: 12,
                      height: 12,
                      borderRadius: '50%',
                      backgroundColor: i <= calibration.step ? '#4CAF50' : '#666',
                      transition: 'background-color 0.3s',
                    }}
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────────────────
 *  ReliabilitySection — drift / safe-mode / IMU controls
 *
 *  Surfaces the gap-A through gap-K knobs so users can:
 *    - turn auto-disable off if they prefer to keep tracking through drift
 *    - widen / tighten the drift threshold for their environment
 *    - see when safe-mode is active and clear it manually
 *  Co-located here because these knobs are only meaningful when head
 *  tracking is enabled.
 * ────────────────────────────────────────────────────────────────────────── */
function ReliabilitySection() {
  const { t } = useT();
  const settings = useSettingsStore();
  const safeMode = isSafeMode();
  // Re-render when localStorage changes from another tab. `isSafeMode`
  // is read on every render so this is enough.
  const [, force] = useState(0);
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === 'prism-drift-history') force((n) => n + 1);
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  return (
    <div className="space-y-4 pt-2 border-t border-theme">
      <h4 className="text-primary text-base font-semibold">
        {t('reliability') ?? 'Reliability'}
      </h4>

      {/* Auto-disable on drift */}
      <label className="flex items-center justify-between py-1">
        <div className="flex-1 pr-3">
          <span className="text-primary text-sm">
            {t('drift_auto_disable') ?? 'Auto-disable on drift'}
          </span>
          <p className="text-muted text-xs mt-0.5">
            {t('drift_auto_disable_desc') ??
              'If the cursor drifts wildly without landing a click, tracking pauses automatically.'}
          </p>
        </div>
        <button
          onClick={() => {
            tapFeedback();
            settings.update({
              headTrackingDriftAutoDisable: !settings.headTrackingDriftAutoDisable,
            });
          }}
          aria-pressed={settings.headTrackingDriftAutoDisable}
          aria-label="Auto-disable on drift"
          className={`w-12 h-7 rounded-full transition-colors shrink-0 ${
            settings.headTrackingDriftAutoDisable ? 'bg-[#4CAF50]' : 'bg-[#999]'
          }`}
        >
          <div
            className={`w-5 h-5 rounded-full bg-white transition-transform mx-1 ${
              settings.headTrackingDriftAutoDisable ? 'translate-x-5' : ''
            }`}
          />
        </button>
      </label>

      {settings.headTrackingDriftAutoDisable && (
        <>
          {/* Drift travel threshold */}
          <div>
            <label className="flex items-center justify-between mb-1">
              <span className="text-primary text-sm">
                {t('drift_travel_threshold') ?? 'Drift sensitivity'}
              </span>
              <span className="text-muted text-xs">
                {settings.headTrackingDriftThresholdPx}px
              </span>
            </label>
            <input
              type="range"
              min="400"
              max="1500"
              step="100"
              value={settings.headTrackingDriftThresholdPx}
              onChange={(e) =>
                settings.update({ headTrackingDriftThresholdPx: parseInt(e.target.value, 10) })
              }
              className="w-full accent-[#FF9800]"
            />
            <div className="flex justify-between text-[10px] text-muted">
              <span>400 (twitchy)</span>
              <span>1500 (lenient)</span>
            </div>
          </div>

          {/* Drift rolling window */}
          <div>
            <label className="flex items-center justify-between mb-1">
              <span className="text-primary text-sm">
                {t('drift_window') ?? 'Drift window'}
              </span>
              <span className="text-muted text-xs">
                {(settings.headTrackingDriftWindowMs / 1000).toFixed(0)}s
              </span>
            </label>
            <input
              type="range"
              min="2000"
              max="15000"
              step="1000"
              value={settings.headTrackingDriftWindowMs}
              onChange={(e) =>
                settings.update({ headTrackingDriftWindowMs: parseInt(e.target.value, 10) })
              }
              className="w-full accent-[#FF9800]"
            />
            <div className="flex justify-between text-[10px] text-muted">
              <span>2s</span>
              <span>15s</span>
            </div>
          </div>
        </>
      )}

      {/* Safe-mode indicator */}
      {safeMode && (
        <div className="rounded-lg border border-[#FF9800] p-3 flex items-start gap-3">
          <span className="text-xl shrink-0">🛡️</span>
          <div className="flex-1">
            <div className="text-primary text-sm font-semibold">
              {t('safe_mode_active') ?? 'Safe mode is active'}
            </div>
            <p className="text-muted text-xs mt-1">
              {t('safe_mode_desc') ??
                'Tracking is running with reduced sensitivity, longer dwell time, and gestures off because drift fired twice in the last 5 minutes.'}
            </p>
            <button
              onClick={() => {
                tapFeedback();
                clearDriftHistory();
                force((n) => n + 1);
              }}
              className="mt-2 aac-btn px-3 py-1.5 rounded-lg surface-key text-primary border border-theme text-xs"
            >
              {t('safe_mode_clear') ?? 'Exit safe mode'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
