'use client';
// TODO CRITICAL: This component must be replaced with a proper EmergencyCountdownModal
// that provides countdown timer, cancel button (PIN-gated for urgent/medical),
// and spoken phrase display. The current implementation provides only a visual flash.
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
