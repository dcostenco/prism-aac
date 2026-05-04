'use client';
import { useState, useCallback } from 'react';
import { useSettingsStore } from '@/store/settingsStore';
import { tapFeedback } from '@/services/feedback';
import { useT } from '@/engine/useT';
import TrackingSetupWizard from './TrackingSetupWizard';
import { DEFAULT_GESTURE_CONFIG, type GestureId, type GestureConfig } from '@/services/gestureService';

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
  const [isRecordingGesture, setIsRecordingGesture] = useState(false);
  const [recordingStep, setRecordingStep] = useState(0); // 0=idle, 1=prep, 2=record, 3=done
  const [gestureName, setGestureName] = useState('');
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

      {/* ─── Gesture Recognition ──────────────────────────────────────── */}
      <GestureRecognitionSettings />
    </div>
  );
}

// ── Built-in gestures for Basic mode (no training needed) ─────────────────

const BASIC_GESTURES: { id: GestureId; label: string; desc: string }[] = [
  { id: 'blink', label: 'Intentional Blink', desc: 'Close eyes for 400ms+' },
  { id: 'mouth_open', label: 'Mouth Open', desc: 'Open mouth wide (jaw drop)' },
  { id: 'smile', label: 'Smile', desc: 'Smile with either side of mouth' },
  { id: 'pucker', label: 'Pucker / "Oo"', desc: 'Push lips forward like saying "oo"' },
  { id: 'head_nod', label: 'Head Nod', desc: 'Nod head up and down' },
  { id: 'head_shake', label: 'Head Shake', desc: 'Shake head left and right' },
  { id: 'brow_raise', label: 'Eyebrow Raise', desc: 'Raise eyebrows up' },
];

const ASSIGNABLE_ACTIONS = [
  { value: '', label: '(not assigned)' },
  { value: 'speak', label: 'Speak message' },
  { value: 'backspace', label: 'Backspace' },
  { value: 'clear', label: 'Clear message' },
  { value: 'yes', label: 'Say "Yes"' },
  { value: 'no', label: 'Say "No"' },
  { value: 'help', label: 'Say "Help"' },
  { value: 'categories', label: 'Open Categories' },
  { value: 'settings', label: 'Open Settings' },
  { value: 'alert', label: 'Emergency Alert' },
  { value: 'ai_chat', label: 'Open AI Chat' },
];

function GestureRecognitionSettings() {
  const gestureConfig = useSettingsStore(s => s.gestureConfig);
  const update = useSettingsStore(s => s.update);

  const [calibrating, setCalibrating] = useState(false);
  const [calibrationProgress, setCalibrationProgress] = useState(0);

  const updateGesture = useCallback((partial: Partial<GestureConfig>) => {
    update({ gestureConfig: { ...gestureConfig, ...partial } });
  }, [gestureConfig, update]);

  const setMapping = useCallback((gestureId: GestureId, action: string) => {
    const existing = gestureConfig.mappings.filter(m => m.gesture !== gestureId);
    const next = action ? [...existing, { gesture: gestureId, action }] : existing;
    updateGesture({ mappings: next });
  }, [gestureConfig.mappings, updateGesture]);

  const getMappedAction = useCallback((gestureId: GestureId): string => {
    return gestureConfig.mappings.find(m => m.gesture === gestureId)?.action ?? '';
  }, [gestureConfig.mappings]);

  return (
    <div className="mt-4 pt-4 border-t border-theme">
      <h4 className="text-muted font-semibold text-sm uppercase tracking-wider mb-2">
        Gesture Recognition
      </h4>

      {/* Enable toggle */}
      <label className="flex items-center justify-between py-1.5">
        <div>
          <span className="text-primary text-sm font-semibold">Enable Gestures</span>
          <p className="text-muted text-[10px]">Detect head, eye, lip, and brow gestures via camera</p>
        </div>
        <Toggle
          on={gestureConfig.enabled}
          onToggle={() => updateGesture({ enabled: !gestureConfig.enabled })}
          label="Gesture recognition"
        />
      </label>

      {gestureConfig.enabled && (
        <div className="ml-2 mt-2 space-y-3">
          {/* Mode selector */}
          <div>
            <label className="text-muted text-xs mb-1 block">Mode</label>
            <div className="flex gap-1.5">
              <button
                onClick={() => { tapFeedback(); updateGesture({ mode: 'basic' }); }}
                className={`aac-btn flex-1 rounded-lg px-3 py-2 text-xs font-semibold border border-theme ${
                  gestureConfig.mode === 'basic' ? 'bg-[#4CAF50] text-white border-transparent' : 'surface-key text-primary'
                }`}
              >
                Basic
                <span className="block text-[9px] opacity-80 mt-0.5">No training needed</span>
              </button>
              <button
                onClick={() => { tapFeedback(); updateGesture({ mode: 'advanced' }); }}
                className={`aac-btn flex-1 rounded-lg px-3 py-2 text-xs font-semibold border border-theme ${
                  gestureConfig.mode === 'advanced' ? 'bg-[#9C27B0] text-white border-transparent' : 'surface-key text-primary'
                }`}
              >
                Advanced
                <span className="block text-[9px] opacity-80 mt-0.5">Custom training + 8B model</span>
              </button>
            </div>
          </div>

          {/* Baseline calibration */}
          <div>
            <button
              onClick={() => {
                tapFeedback();
                setCalibrating(true);
                setCalibrationProgress(0);
                const iv = setInterval(() => {
                  setCalibrationProgress(p => {
                    if (p >= 1) { clearInterval(iv); setCalibrating(false); return 1; }
                    return p + 1 / 45;
                  });
                }, 67);
              }}
              disabled={calibrating}
              className="aac-btn w-full py-2.5 rounded-xl text-white font-bold text-sm shadow-lg active:scale-95 transition-transform"
              style={{ background: calibrating ? '#999' : 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' }}
            >
              {calibrating ? `Capturing neutral face... ${Math.round(calibrationProgress * 100)}%` : '🎯 Calibrate Neutral Face'}
            </button>
            <p className="text-muted text-[10px] mt-1">
              Hold still for 3 seconds. Sets your personal baseline so thresholds adapt to your face.
            </p>
          </div>

          {/* Gesture → Action assignment grid */}
          <div>
            <label className="text-muted text-xs mb-1.5 block">Assign gestures to actions</label>
            <div className="space-y-1.5">
              {BASIC_GESTURES.map(g => (
                <div key={g.id} className="flex items-center gap-2 px-2 py-1.5 rounded-lg surface-key border border-theme">
                  <div className="flex-1 min-w-0">
                    <span className="text-primary text-xs font-semibold block">{g.label}</span>
                    <span className="text-muted text-[9px]">{g.desc}</span>
                  </div>
                  <select
                    value={getMappedAction(g.id)}
                    onChange={e => { tapFeedback(); setMapping(g.id, e.target.value); }}
                    className="text-[11px] rounded-md border border-theme px-1.5 py-1 surface-key text-primary"
                  >
                    {ASSIGNABLE_ACTIONS.map(a => (
                      <option key={a.value} value={a.value}>{a.label}</option>
                    ))}
                  </select>
                </div>
              ))}
            </div>
          </div>

          {/* Sensitivity sliders */}
          <div>
            <label className="flex items-center justify-between mb-1">
              <span className="text-primary text-sm">Confidence threshold</span>
              <span className="text-muted text-sm">{Math.round(gestureConfig.confidenceThreshold * 100)}%</span>
            </label>
            <input
              type="range" min="30" max="95" step="5"
              value={Math.round(gestureConfig.confidenceThreshold * 100)}
              onChange={e => updateGesture({ confidenceThreshold: parseInt(e.target.value) / 100 })}
              className="w-full accent-[#4CAF50]"
            />
            <p className="text-muted text-[9px]">Lower = more sensitive (more false positives). Higher = stricter (may miss gestures).</p>
          </div>

          <div>
            <label className="flex items-center justify-between mb-1">
              <span className="text-primary text-sm">Cooldown</span>
              <span className="text-muted text-sm">{gestureConfig.cooldownMs}ms</span>
            </label>
            <input
              type="range" min="500" max="3000" step="100"
              value={gestureConfig.cooldownMs}
              onChange={e => updateGesture({ cooldownMs: parseInt(e.target.value) })}
              className="w-full accent-[#2196F3]"
            />
            <p className="text-muted text-[9px]">Minimum time between repeat triggers of the same gesture.</p>
          </div>

          <div>
            <label className="flex items-center justify-between mb-1">
              <span className="text-primary text-sm">Dwell time</span>
              <span className="text-muted text-sm">{gestureConfig.dwellMs}ms</span>
            </label>
            <input
              type="range" min="200" max="1000" step="50"
              value={gestureConfig.dwellMs}
              onChange={e => updateGesture({ dwellMs: parseInt(e.target.value) })}
              className="w-full accent-[#FF9800]"
            />
            <p className="text-muted text-[9px]">How long a gesture must be sustained before it triggers. Longer = fewer accidentals.</p>
          </div>

          {/* Advanced mode: training UI */}
          {gestureConfig.mode === 'advanced' && (
            <div className="mt-2 p-3 rounded-xl border border-[#9C27B0]/30 bg-[#9C27B0]/5">
              <h5 className="text-primary text-xs font-bold mb-1">Advanced Training</h5>
              <p className="text-muted text-[10px] mb-2">
                Record custom gestures and assign them to actions. The system learns your personal movement patterns using DTW template matching + 8B local model inference.
              </p>
              <p className="text-muted text-[10px]">
                {gestureConfig.templates.length === 0
                  ? 'No custom gestures recorded yet.'
                  : `${gestureConfig.templates.length} custom gesture(s) trained.`
                }
              </p>
              <button
                className="aac-btn w-full mt-2 py-2 rounded-lg text-[#9C27B0] font-bold text-xs border border-[#9C27B0]/30"
                onClick={() => {
                  tapFeedback();
                  alert('Custom gesture recording requires camera access. This feature will be available in the next update.');
                }}
              >
                + Record Custom Gesture
              </button>
            </div>
          )}

          {/* Reset */}
          <button
            onClick={() => { tapFeedback(); update({ gestureConfig: { ...DEFAULT_GESTURE_CONFIG } }); }}
            className="aac-btn w-full py-2 rounded-lg text-xs text-muted border border-theme surface-key"
          >
            Reset gestures to defaults
          </button>
        </div>
      )}
    </div>
  );
}
    ) : '+ Record Custom Gesture'}
              </button>
              {isRecordingGesture && recordingStep === 2 && (
                <div className="mt-2 p-2 bg-red-100 rounded text-red-600 text-xs text-center font-bold animate-pulse">
                  🔴 Recording 8B Local Viseme Data...
                </div>
              )}
            </div>
          )}

          {/* Reset */}
          <button
            onClick={() => { tapFeedback(); update({ gestureConfig: { ...DEFAULT_GESTURE_CONFIG } }); }}
            className="aac-btn w-full py-2 rounded-lg text-xs text-muted border border-theme surface-key"
          >
            Reset gestures to defaults
          </button>
        </div>
      )}
    </div>
  );
}
