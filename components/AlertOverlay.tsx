'use client';
// DEPRECATED: EmergencyCountdownModal (mounted in PrismApp.tsx) is the real emergency UI.
// This component is kept as a minimal accessibility stub only.
import { useUIStore } from '@/store/uiStore';

export default function AlertOverlay() {
  const { isAlertFlashing } = useUIStore();
  if (!isAlertFlashing) return null;
  return (
    <div
      role="alert"
      aria-live="assertive"
      className="fixed inset-0 z-[100] pointer-events-none animate-pulse bg-white/30"
    />
  );
}
