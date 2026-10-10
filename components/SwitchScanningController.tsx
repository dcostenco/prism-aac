'use client';

import { useEffect, useState } from 'react';
import { useT } from '@/engine/useT';
import { suspendCameraSelection, finishSwitchScanOwnershipStaging } from '@/services/cameraSelection';
import { getState, loadConfig, saveConfig, startScan, stopScan, observeKeyboardPresses,
  SWITCH_SCAN_CONFIG_EVENT, type SwitchScanConfig } from '@/services/switchScanService';

/** One app-lifetime owner; Settings edits configuration, not scanner lifetime. */
export default function SwitchScanningController() {
  const [config, setConfig] = useState(loadConfig);
  const [scan, setScan] = useState(getState);
  const [restart, setRestart] = useState(0);
  const { t } = useT();
  useEffect(() => {
    const releaseKeyboard = observeKeyboardPresses();
    const change = (event: Event) => setConfig((event as CustomEvent<SwitchScanConfig>).detail);
    window.addEventListener(SWITCH_SCAN_CONFIG_EVENT, change);
    return () => { window.removeEventListener(SWITCH_SCAN_CONFIG_EVENT, change); releaseKeyboard(); };
  }, []);
  useEffect(() => {
    if (!config.enabled) { stopScan(); return; }
    let mounted = true;
    // Explicit switch selection owns activation; preserve camera preferences
    // and release them on Stop. Combined camera-to-switch routing is deferred.
    const release = suspendCameraSelection();
    startScan(config, { onStateChange: state => { if (mounted) setScan(state); } });
    finishSwitchScanOwnershipStaging();
    return () => { mounted = false; stopScan(); release(); };
  }, [config, restart]);
  if (!config.enabled) return null;
  const running = scan.phase !== 'idle';
  return (
    <div data-testid="switch-scan-controller" data-phase={scan.phase}
      data-scan-group="switch-scan-controls" className="shrink-0 flex items-center gap-2 px-3 py-1 border-b border-theme surface-bar">
      <div className="min-w-0 flex-1">
        <p role="status" className="text-primary text-sm font-semibold">{t(running ? 'scan_active' : 'scan_stopped')}</p>
        <p className="text-muted text-xs">{t('scan_keys')}</p>
      </div>
      {!running && <button className="aac-btn relative min-h-11 px-3 rounded-none bg-transparent text-primary text-sm"
        onClick={() => setRestart(value => value + 1)}>
        <span aria-hidden="true" className="absolute inset-0 rounded-lg surface-key pointer-events-none" />
        <span className="relative pointer-events-none">{t('scan_start')}</span>
      </button>}
      <button className="aac-btn relative min-h-11 px-3 rounded-none bg-transparent text-primary text-sm"
        onClick={() => saveConfig({ ...config, enabled: false })}>
        <span aria-hidden="true" className="absolute inset-0 rounded-lg surface-key pointer-events-none" />
        <span className="relative pointer-events-none">{t('scan_stop')}</span>
      </button>
    </div>
  );
}
