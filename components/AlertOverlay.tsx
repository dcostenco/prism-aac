'use client';
import { useUIStore } from '@/store/uiStore';

export default function AlertOverlay() {
  const { isAlertFlashing } = useUIStore();
  if (!isAlertFlashing) return null;
  return (
    <div className="fixed inset-0 z-[100] pointer-events-none animate-pulse bg-white/30" />
  );
}
