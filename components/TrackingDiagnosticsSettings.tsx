'use client';
import { useEffect, useState } from 'react';
import { useT } from '@/engine/useT';
import { startTrackingDiagnostics, stopTrackingDiagnostics, trackingDiagnosticStatus, trackingDiagnosticReport } from '@/services/trackingDiagnostics';

export default function TrackingDiagnosticsSettings() {
  const { t } = useT();
  const [status, setStatus] = useState(trackingDiagnosticStatus);
  useEffect(() => {
    if (!status.active) return;
    const timer = setInterval(() => setStatus(trackingDiagnosticStatus()), 1000);
    return () => clearInterval(timer);
  }, [status.active]);
  const save = () => {
    stopTrackingDiagnostics();
    setStatus(trackingDiagnosticStatus());
    const url = URL.createObjectURL(new Blob([trackingDiagnosticReport()], { type: 'application/json' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = `prism-tracking-${Date.now()}.json`;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  return (
    <details data-testid="tracking-diagnostics" className="surface-key border border-theme rounded-xl p-3">
      <summary className="aac-btn font-semibold cursor-pointer">{t('tracking_diagnostics_title')}</summary>
      <p className="text-sm text-muted my-2">{t('tracking_diagnostics_privacy')}</p>
      <p data-testid="tracking-diagnostics-status" role="status" className="text-sm my-2">
        {t(status.active ? 'tracking_diagnostics_active' : status.limitReached ? 'tracking_diagnostics_limit' : 'tracking_diagnostics_stopped')} — {status.frames}
      </p>
      {status.started && !status.active && status.frames === 0 && <p role="alert" data-testid="tracking-diagnostics-empty" className="text-sm text-muted my-2">{t('tracking_diagnostics_empty')}</p>}
      <div className="flex flex-wrap gap-2">
        <button data-testid="tracking-diagnostics-start" disabled={status.started} onClick={event => { if (!event.isTrusted) return; startTrackingDiagnostics(); setStatus(trackingDiagnosticStatus()); }} className="aac-btn rounded-lg bg-[#2196F3] text-white px-3 py-2">{t('tracking_diagnostics_start')}</button>
        <button disabled={!status.active} onClick={() => { stopTrackingDiagnostics(); setStatus(trackingDiagnosticStatus()); }} className="aac-btn rounded-lg surface-bar px-3 py-2">{t('tracking_diagnostics_stop')}</button>
        <button data-testid="tracking-diagnostics-save" disabled={!status.started} onClick={event => { if (event.isTrusted) save(); }} className="aac-btn rounded-lg bg-[#4CAF50] text-white px-3 py-2">{t('tracking_diagnostics_save')}</button>
      </div>
    </details>
  );
}
