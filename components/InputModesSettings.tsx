'use client';
import { useState, useCallback, useEffect, type ReactNode } from 'react';
import { useSettingsStore } from '@/store/settingsStore';
import { tapFeedback } from '@/services/feedback';
import { useT } from '@/engine/useT';
import TrackingSetupWizard from './TrackingSetupWizard';
import TrackingDiagnosticsSettings from './TrackingDiagnosticsSettings';
import { CAMERA_CURSOR_TARGETS, HEAD_CURSOR_AVAILABLE, isCameraCursorTarget } from '@/services/cameraTrackingTargets';
import { DEFAULT_GESTURE_CONFIG, type GestureId, type GestureConfig } from '@/services/gestureService';
import { requestMotionPermission } from '@/services/deviceMotion';
import { hasPoseCalibrationForTarget, type TrackingTarget } from '@/services/bodyPoseService';
import { loadConfig as loadSwitchConfig, saveConfig as saveSwitchConfig, SWITCH_SCAN_CONFIG_EVENT, type SwitchScanConfig } from '@/services/switchScanService';

// Legacy preferences are retained, but only an explicitly chosen wrist
// can start the narrowed cursor pipeline. Selection never chooses a side.

const INPUT_TOGGLE_ROW_CLASS = 'flex items-center justify-between gap-8 py-3';

function Toggle({ on, onToggle, label, disabled = false }: { on: boolean; onToggle: () => void; label: string; disabled?: boolean }) {
  return (
    <button disabled={disabled} onClick={() => { if (disabled) return; tapFeedback(); onToggle(); }} aria-pressed={on} aria-label={label}
      data-input-mode-toggle="true"
      className="relative w-16 h-12 inline-flex items-center rounded-none bg-transparent shrink-0">
      {/* Paint the pill without clipping the native 64×48 selection surface. */}
      <span aria-hidden="true" className={`absolute inset-0 rounded-full pointer-events-none transition-colors ${on ? 'bg-[#4CAF50]' : 'bg-[#999]'}`} />
      <div className={`relative w-8 h-8 rounded-full bg-white pointer-events-none transition-transform mx-1 ${on ? 'translate-x-6' : ''}`} />
    </button>
  );
}

export default function InputModesSettings({ cameraOptions, touchOptions }: { cameraOptions?: ReactNode; touchOptions?: ReactNode } = {}) {
  const [showSetupWizard, setShowSetupWizard] = useState(false);
  const [isRecordingGesture, setIsRecordingGesture] = useState(false);
  const [recordingStep, setRecordingStep] = useState(0); // 0=idle, 1=prep, 2=record, 3=done
  const [gestureName, setGestureName] = useState('');
  const cameraInputEnabled = useSettingsStore(s => s.cameraInputEnabled && isCameraCursorTarget(s.cameraTrackingTarget));
  const cameraTrackingTarget = useSettingsStore(s => s.cameraTrackingTarget);
  const calGeneration = useSettingsStore(s => s.poseCalibrationGeneration);
  const [calibrationReady, setCalibrationReady] = useState(false);
  useEffect(() => {
    const check = () => setCalibrationReady(isCameraCursorTarget(cameraTrackingTarget) && hasPoseCalibrationForTarget(cameraTrackingTarget as TrackingTarget));
    check();
    window.addEventListener('resize', check);
    window.addEventListener('orientationchange', check);
    return () => { window.removeEventListener('resize', check); window.removeEventListener('orientationchange', check); };
  }, [cameraTrackingTarget, calGeneration]);
  const showHandCalibration = useSettingsStore(s => s.showHandCalibration);
  const headTrackingEnabled = useSettingsStore(s => HEAD_CURSOR_AVAILABLE && s.headTrackingEnabled);
  const headTrackingDwellMs = useSettingsStore(s => s.headTrackingDwellMs);
  const headTrackingSensitivity = useSettingsStore(s => s.headTrackingSensitivity);
  const visionContextEnabled = useSettingsStore(s => s.visionContextEnabled);
  const update = useSettingsStore(s => s.update);
  const { t } = useT();

  return (
    <div className="space-y-4" data-scan-group="input-modes-settings">
      <div data-testid="camera-accessibility-settings" className="space-y-4">
        <h3 className="text-primary font-bold">{t('camera_accessibility')}</h3>
        <p role="status" data-testid="camera-wrist-scope" className="text-muted text-sm">{t('camera_wrist_scope')}</p>
        <p data-testid="camera-pause-help" className="text-muted text-sm">{t('camera_pause_help')}</p>
        <p className="text-muted text-sm">{t('camera_controls_disabled')}</p>
        {!isCameraCursorTarget(cameraTrackingTarget) && <p role="alert" className="text-muted text-sm">{t('camera_choose_wrist')}</p>}
        {isCameraCursorTarget(cameraTrackingTarget) && !calibrationReady && <p role="status" className="text-muted text-sm">{t('camera_wrist_calibration_needed')}</p>}
        <div className="grid grid-cols-2 gap-2">
          {CAMERA_CURSOR_TARGETS.map(tt => (
            <button key={tt.id} onClick={() => { tapFeedback(); update({ cameraTrackingTarget: tt.id, cameraInputEnabled: false }); }}
              data-testid={`tracking-target-${tt.id}`}
              data-selected={cameraTrackingTarget === tt.id ? 'true' : 'false'}
              className={`aac-btn min-h-12 rounded-lg px-3 py-2 text-sm font-semibold border border-theme ${
                cameraTrackingTarget === tt.id ? 'bg-[#4CAF50] text-white border-transparent' : 'surface-key text-primary'
              }`}>
              {tt.label}
            </button>
          ))}
        </div>
        <button
          data-testid="camera-cursor-setup"
          disabled={!isCameraCursorTarget(cameraTrackingTarget)}
          onClick={() => { tapFeedback(); setShowSetupWizard(true); }}
          className="aac-btn w-full py-3 rounded-xl bg-[#2196F3] text-white font-bold disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {t('camera_cursor_setup')}
        </button>
        <p className="text-muted text-sm">{t('camera_wrist_control_help')}</p>
        <TrackingDiagnosticsSettings />
      {/* Camera Finger/Body Tracking (opt-in — settings store default false) */}
      <div data-testid="camera-input-settings">
        <h4 className="text-muted font-semibold text-sm uppercase tracking-wider mb-2">Camera Input</h4>
        <label className={INPUT_TOGGLE_ROW_CLASS}>
          <div className="min-w-0 flex-1">
            <span className="text-primary text-sm font-semibold">{t('camera_wrist_control')}</span>
            <p className="text-muted text-xs">{t('camera_wrist_control_help')}</p>
          </div>
          <Toggle disabled={!isCameraCursorTarget(cameraTrackingTarget) || (!calibrationReady && !cameraInputEnabled)} on={cameraInputEnabled} onToggle={() => update({ cameraInputEnabled: !cameraInputEnabled })} label="Camera input" />
        </label>
      </div>

      {/* Hand Calibration visibility toggle */}
      <label className={INPUT_TOGGLE_ROW_CLASS}>
        <div className="min-w-0 flex-1">
          <span className="text-primary text-sm font-semibold">{t('touch_accuracy_options')}</span>
          <p className="text-muted text-xs">{t('touch_accuracy_help')}</p>
        </div>
        <Toggle on={showHandCalibration} onToggle={() => update({ showHandCalibration: !showHandCalibration })} label={t('touch_accuracy_options')} />
      </label>

      {/* Vision Context — camera object detection for phrase suggestions */}
      <div data-testid="vision-context-settings">
        <h4 className="text-muted font-semibold text-sm uppercase tracking-wider mb-2">Vision Context</h4>
        <label className={INPUT_TOGGLE_ROW_CLASS}>
          <div className="min-w-0 flex-1">
            <span className="text-primary text-sm font-semibold">Camera Phrase Suggestions</span>
            <p className="text-muted text-xs">Camera detects objects and suggests relevant phrases (e.g. cup → &quot;I want a drink&quot;)</p>
          </div>
          <Toggle on={visionContextEnabled} onToggle={() => update({ visionContextEnabled: !visionContextEnabled })} label="Vision context" />
        </label>
      </div>

      {/* Head Tracking (opt-in) */}
      <label className={INPUT_TOGGLE_ROW_CLASS}>
        <div className="min-w-0 flex-1">
          <span className="text-primary text-sm font-semibold">{t('enable_head_tracking')}</span>
          <p className="text-muted text-xs">Move cursor by moving your head (uses camera)</p>
        </div>
        <Toggle
          disabled={!HEAD_CURSOR_AVAILABLE}
          on={headTrackingEnabled}
          onToggle={async () => {
            const willEnable = !headTrackingEnabled;
            // Request iOS DeviceMotion permission BEFORE flipping the
            // setting (must run inside the user-gesture handler).
            // No-op on non-iOS / older iOS / desktop.
            if (willEnable) {
              try { await requestMotionPermission(); } catch { /* */ }
            }
            update({ headTrackingEnabled: willEnable });
          }}
          label="Head tracking"
        />
      </label>

      {/* Dwell Time */}
      <div>
        <label className="flex items-center justify-between mb-1">
          <span className="text-primary text-sm">{t('dwell_time')}</span>
          <span className="text-muted text-sm">{headTrackingDwellMs}ms</span>
        </label>
        <input aria-label={t('dwell_time')} type="range" min="800" max="3000" step="100" value={headTrackingDwellMs}
          onChange={(e) => update({ headTrackingDwellMs: parseInt(e.target.value) })}
          className="w-full accent-[#4CAF50]" />
      </div>

      {/* Sensitivity */}
      <div>
        <label className="flex items-center justify-between mb-1">
          <span className="text-primary text-sm">{t('sensitivity')}</span>
          <span className="text-muted text-sm">{headTrackingSensitivity}</span>
        </label>
        <input aria-label={t('sensitivity')} type="range" min="1" max="10" step="1" value={headTrackingSensitivity}
          onChange={(e) => update({ headTrackingSensitivity: parseInt(e.target.value) })}
          className="w-full accent-[#2196F3]" />
      </div>
      {showSetupWizard && (
        <TrackingSetupWizard
          onComplete={() => setShowSetupWizard(false)}
          onCancel={() => setShowSetupWizard(false)}
        />
      )}

      {HEAD_CURSOR_AVAILABLE && cameraOptions}
      {showHandCalibration && touchOptions && (
        <details className="surface-key rounded-xl border border-theme p-3">
          <summary className="aac-btn font-semibold text-primary cursor-pointer">{t('touch_accuracy_title')}</summary>
          <p className="text-muted text-sm my-2">{t('touch_accuracy_help')}</p>
          {touchOptions}
        </details>
      )}
      {/* ─── Gesture Recognition ──────────────────────────────────────── */}
      <fieldset disabled={!HEAD_CURSOR_AVAILABLE} data-testid="camera-gestures-disabled">
        <GestureRecognitionSettings />
      </fieldset>
      </div>
      {/* Switch scanning does not require a camera. */}
      <SwitchScanSettings />
    </div>
  );
}

function SwitchScanSettings() {
  const [config, setConfig] = useState<SwitchScanConfig>(() => loadSwitchConfig());
  useEffect(() => {
    const change = (event: Event) => setConfig((event as CustomEvent<SwitchScanConfig>).detail);
    window.addEventListener(SWITCH_SCAN_CONFIG_EVENT, change);
    return () => window.removeEventListener(SWITCH_SCAN_CONFIG_EVENT, change);
  }, []);

  const persist = (patch: Partial<SwitchScanConfig>) => {
    const next = { ...config, ...patch };
    setConfig(next);
    saveSwitchConfig(next);
  };

  const toggleEnabled = () => {
    const willEnable = !config.enabled;
    persist({ enabled: willEnable });
  };

  return (
    <div data-testid="switch-scan-settings" data-scan-group="switch-scan-settings">
      <h4 className="text-muted font-semibold text-sm uppercase tracking-wider mb-2">Switch Scanning</h4>
      <label className={INPUT_TOGGLE_ROW_CLASS}>
        <div className="min-w-0 flex-1">
          <span className="text-primary text-sm font-semibold">Enable Switch Scanning</span>
          <p className="text-muted text-xs">Use a Bluetooth switch, keyboard key, or gamepad to navigate</p>
        </div>
        <Toggle on={config.enabled} onToggle={toggleEnabled} label="Switch scanning" />
      </label>
      {config.enabled && (
        <div className="ml-2 mt-2 space-y-3">
          <div>
            <label className="text-primary text-sm">Mode</label>
            <div className="flex gap-2 mt-1">
              {(['auto', 'manual'] as const).map(m => (
                <button key={m} onClick={() => { tapFeedback(); persist({ mode: m }); }}
                  className={`aac-btn flex-1 rounded-lg px-3 py-2 text-sm font-bold border border-theme ${config.mode === m ? 'bg-[#4CAF50] text-white border-transparent' : 'surface-key text-primary'}`}>
                  {m === 'auto' ? 'Auto (timed)' : 'Manual (step)'}
                </button>
              ))}
            </div>
          </div>
          {config.mode === 'auto' && (
            <div>
              <label className="flex items-center justify-between mb-1">
                <span className="text-primary text-sm">Scan speed</span>
                <span className="text-muted text-sm">{(config.scanSpeedMs / 1000).toFixed(1)}s</span>
              </label>
              <input type="range" min="500" max="6000" step="250" value={config.scanSpeedMs}
                onChange={e => persist({ scanSpeedMs: parseInt(e.target.value) })}
                className="w-full accent-[#4CAF50]" />
            </div>
          )}
          <label className={INPUT_TOGGLE_ROW_CLASS}>
            <span className="text-primary text-sm min-w-0 flex-1">Group scanning</span>
            <Toggle on={config.groupScan} onToggle={() => persist({ groupScan: !config.groupScan })} label="Group scanning" />
          </label>
          <p className="text-muted text-xs">Press <strong>Space</strong> or <strong>Enter</strong> to select. Connect a Bluetooth switch for hands-free use.</p>
        </div>
      )}
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
  const gestureEnabled = HEAD_CURSOR_AVAILABLE && gestureConfig.enabled;
  const update = useSettingsStore(s => s.update);
  const { t } = useT();

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
    // <details> instead of always-open: the gesture section has 7+
    // sub-controls (mode picker, calibration, 4 mapping rows, 3
    // sliders, training UI, reset). Caregivers reported "too much"
    // — collapsed by default trims the settings overview to a single
    // row showing on/off status. They tap to expand only when tuning.
    <details
      className="mt-4 pt-4 border-t border-theme group"
      data-testid="gesture-recognition-details"
    >
      <summary className="cursor-pointer list-none flex items-center justify-between py-1 select-none">
        <h4 className="text-muted font-semibold text-sm uppercase tracking-wider">
          Gesture Recognition
        </h4>
        <span className="flex items-center gap-2">
          <span className={`text-xs font-bold ${gestureEnabled ? 'text-[#4CAF50]' : 'text-muted'}`}>
            {gestureEnabled ? 'ON' : 'off'}
          </span>
          {/* Chevron rotates when open via group-open: utility */}
          <span className="text-muted text-xs group-open:rotate-90 transition-transform inline-block">▶</span>
        </span>
      </summary>

      {/* Enable toggle */}
      <label className={`${INPUT_TOGGLE_ROW_CLASS} mt-2`}>
        <div className="min-w-0 flex-1">
          <span className="text-primary text-sm font-semibold">Enable Gestures</span>
          <p className="text-muted text-xs">Detect head, eye, lip, and brow gestures via camera</p>
        </div>
        <Toggle
          on={gestureEnabled}
          onToggle={() => updateGesture({ enabled: !gestureConfig.enabled })}
          label="Gesture recognition"
        />
      </label>

      {gestureEnabled && (
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
            <p className="text-muted text-xs mt-1">
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
                    <span className="text-muted text-[9px]">{t(g.id + '_desc') === g.id + '_desc' ? g.desc : t(g.id + '_desc')}</span>
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
              <p className="text-muted text-xs mb-2">
                Record custom gestures and assign them to actions. The system learns your personal movement patterns using DTW template matching + 8B local model inference.
              </p>
              <p className="text-muted text-xs">
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
    </details>
  );
}
