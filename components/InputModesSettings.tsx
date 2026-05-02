'use client';
import { useState } from 'react';
import { useSettingsStore } from '@/store/settingsStore';
import { tapFeedback } from '@/services/feedback';
import { useT } from '@/engine/useT';
import TrackingSetupWizard from './TrackingSetupWizard';

const TRACKING_TARGETS = [
  { id: 'right_index', label: 'Right Index Finger' },
  { id: 'left_index', label: 'Left Index Finger' },
  { id: 'right_wrist', label: 'Right Wrist' },
  { id: 'left_wrist', label: 'Left Wrist' },
  { id: 'right_elbow', label: 'Right Elbow' },
  { id: 'left_elbow', label: 'Left Elbow' },
  { id: 'nose', label: 'Nose (Head)' },
  { id: 'right_shoulder', label: 'Right Shoulder' },
  { id: 'left_shoulder', label: 'Left Shoulder' },
];

function Toggle({ on, onToggle, label }: { on: boolean; onToggle: () => void; label: string }) {
  return (
    <button onClick={() => { tapFeedback(); onToggle(); }} aria-pressed={on} aria-label={label}
      className={`w-12 h-7 rounded-full transition-colors shrink-0 ${on ? 'bg-[#4CAF50]' : 'bg-[#999]'}`}>
      <div className={`w-5 h-5 rounded-full bg-white transition-transform mx-1 ${on ? 'translate-x-5' : ''}`} />
    </button>
  );
}

export default function InputModesSettings() {
  const [showSetupWizard, setShowSetupWizard] = useState(false);
  const cameraInputEnabled = useSettingsStore(s => s.cameraInputEnabled);
  const cameraTrackingTarget = useSettingsStore(s => s.cameraTrackingTarget);
  const showHandCalibration = useSettingsStore(s => s.showHandCalibration);
  const headTrackingEnabled = useSettingsStore(s => s.headTrackingEnabled);
  const headTrackingDwellMs = useSettingsStore(s => s.headTrackingDwellMs);
  const headTrackingSensitivity = useSettingsStore(s => s.headTrackingSensitivity);
  const update = useSettingsStore(s => s.update);
  const { t } = useT();

  return (
    <div className="space-y-4">
      {/* Camera Finger/Body Tracking (DEFAULT ON) */}
      <div>
        <h4 className="text-muted font-semibold text-sm uppercase tracking-wider mb-2">Camera Input (Default)</h4>
        <label className="flex items-center justify-between py-1.5">
          <div>
            <span className="text-primary text-sm font-semibold">Camera Finger Tracking</span>
            <p className="text-muted text-[10px]">Camera tracks your finger/arm and moves cursor on screen</p>
          </div>
          <Toggle on={cameraInputEnabled} onToggle={() => update({ cameraInputEnabled: !cameraInputEnabled })} label="Camera input" />
        </label>
        {cameraInputEnabled && (
          <div className="ml-2 mt-1 space-y-1">
            <label className="text-muted text-xs">Track:</label>
            <div className="grid grid-cols-3 gap-1">
              {TRACKING_TARGETS.map(tt => (
                <button key={tt.id} onClick={() => { tapFeedback(); update({ cameraTrackingTarget: tt.id }); }}
                  className={`aac-btn rounded-lg px-2 py-1.5 text-[10px] font-semibold border border-theme ${
                    cameraTrackingTarget === tt.id ? 'bg-[#4CAF50] text-white border-transparent' : 'surface-key text-primary'
                  }`}>
                  {tt.label}
                </button>
              ))}
            </div>
            <button
              onClick={() => { tapFeedback(); setShowSetupWizard(true); }}
              className="aac-btn w-full mt-2 py-2.5 rounded-xl text-white font-bold text-sm shadow-lg active:scale-95 transition-transform"
              style={{ background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' }}
            >
              🎯 Set Up Tracking
            </button>
            <p className="text-muted text-[10px] mt-1">Guided setup: detects your body, calibrates cursor, tests accuracy</p>
          </div>
        )}
      </div>

      {/* Hand Calibration visibility toggle */}
      <label className="flex items-center justify-between py-1.5">
        <div>
          <span className="text-primary text-sm font-semibold">Hand Calibration Settings</span>
          <p className="text-muted text-[10px]">Show hand profile + per-finger button mapping in Settings</p>
        </div>
        <Toggle on={showHandCalibration} onToggle={() => update({ showHandCalibration: !showHandCalibration })} label="Hand calibration settings" />
      </label>

      {/* Head Tracking (opt-in) */}
      <label className="flex items-center justify-between py-1.5">
        <div>
          <span className="text-primary text-sm font-semibold">{t('enable_head_tracking')}</span>
          <p className="text-muted text-[10px]">Move cursor by moving your head (uses camera)</p>
        </div>
        <Toggle on={headTrackingEnabled} onToggle={() => update({ headTrackingEnabled: !headTrackingEnabled })} label="Head tracking" />
      </label>

      {/* Dwell Time */}
      <div>
        <label className="flex items-center justify-between mb-1">
          <span className="text-primary text-sm">{t('dwell_time')}</span>
          <span className="text-muted text-sm">{headTrackingDwellMs}ms</span>
        </label>
        <input type="range" min="500" max="3000" step="100" value={headTrackingDwellMs}
          onChange={(e) => update({ headTrackingDwellMs: parseInt(e.target.value) })}
          className="w-full accent-[#4CAF50]" />
      </div>

      {/* Sensitivity */}
      <div>
        <label className="flex items-center justify-between mb-1">
          <span className="text-primary text-sm">{t('sensitivity')}</span>
          <span className="text-muted text-sm">{headTrackingSensitivity}</span>
        </label>
        <input type="range" min="1" max="10" step="1" value={headTrackingSensitivity}
          onChange={(e) => update({ headTrackingSensitivity: parseInt(e.target.value) })}
          className="w-full accent-[#2196F3]" />
      </div>
      {showSetupWizard && (
        <TrackingSetupWizard
          onComplete={() => setShowSetupWizard(false)}
          onCancel={() => setShowSetupWizard(false)}
        />
      )}
    </div>
  );
}
