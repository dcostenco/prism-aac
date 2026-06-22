'use client';

import nextDynamic from 'next/dynamic';
import { useEffect, useState } from 'react';
import Keyboard from '@/components/Keyboard';
import MessageBar from '@/components/MessageBar';
import PredictionBar from '@/components/PredictionBar';
import SyncProvider from '@/components/SyncProvider';
import { useSettingsStore } from '@/store/settingsStore';
import { useMessageStore } from '@/store/messageStore';
import { useUIStore } from '@/store/uiStore';
import { usePredictionStore } from '@/store/predictionStore';
import { registerPanicListeners } from '@/services/panicService';
import { registerConnectivityListener } from '@/services/emergencyService';
import { keyFeedback, deleteFeedback } from '@/services/feedback';
import { aacSpeak } from '@/services/aacSpeak';
import { useT } from '@/engine/useT';
import BrowserToolbar from './BrowserToolbar';
import BrowserContent from './BrowserContent';

const HeadTrackingOverlay = nextDynamic(() => import('@/components/HeadTrackingOverlay'), { ssr: false });
const CameraInputOverlay = nextDynamic(() => import('@/components/CameraInputOverlay'), { ssr: false });
const EmergencyCountdownModal = nextDynamic(() => import('@/components/EmergencyCountdownModal'), { ssr: false });
const AlertConfirmModal = nextDynamic(() => import('@/components/AlertConfirmModal'), { ssr: false });
const SettingsModal = nextDynamic(() => import('@/components/SettingsModal'), { ssr: false });
const HistoryModal = nextDynamic(() => import('@/components/HistoryModal'), { ssr: false });
const TrackingDebugOverlay = nextDynamic(() => import('@/components/TrackingDebugOverlay'), { ssr: false });

export const dynamic = 'force-dynamic';

export default function BrowserPage() {
  const [hydrated, setHydrated] = useState(false);
  const theme = useSettingsStore((s) => s.theme);
  const highContrast = useSettingsStore((s) => s.highContrast);
  const keyboardMaximized = useUIStore((s) => s.keyboardMaximized);
  const runDecay = usePredictionStore((s) => s.runDecay);
  const ensureSeed = usePredictionStore((s) => s.ensureSeed);
  const { rtl } = useT();
  const [compactMode, setCompactMode] = useState(false);

  useEffect(() => {
    const check = () => setCompactMode(window.matchMedia('(orientation: landscape)').matches && window.innerHeight < 500);
    check();
    window.addEventListener('resize', check);
    window.addEventListener('orientationchange', check);
    return () => { window.removeEventListener('resize', check); window.removeEventListener('orientationchange', check); };
  }, []);

  useEffect(() => {
    setHydrated(true);
    runDecay();
    ensureSeed();
    const unregisterPanic = registerPanicListeners();
    const cleanupConnectivity = registerConnectivityListener();
    import('@/services/headTracker').then(m => m.prewarmHeadTracker?.()).catch(() => {});
    return () => { unregisterPanic(); cleanupConnectivity?.(); };
  }, [runDecay, ensureSeed]);

  useEffect(() => {
    let mod: typeof import('@/services/azureTTS') | null = null;
    import('@/services/azureTTS').then((m) => { mod = m; }).catch(() => {});
    const warmup = () => {
      if (mod) { try { void mod.warmupAzureAudio(); } catch {} return; }
      import('@/services/azureTTS').then((m) => { mod = m; try { void m.warmupAzureAudio(); } catch {} }).catch(() => {});
    };
    window.addEventListener('touchstart', warmup, { passive: true });
    window.addEventListener('pointerdown', warmup);
    window.addEventListener('click', warmup);
    return () => {
      window.removeEventListener('touchstart', warmup);
      window.removeEventListener('pointerdown', warmup);
      window.removeEventListener('click', warmup);
    };
  }, []);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
      if (e.key === 'Tab' || e.key === 'Escape') return;
      if ((e.target as HTMLElement)?.closest('[role="dialog"]')) return;
      if (e.key === ' ' && document.activeElement?.tagName === 'BUTTON') return;
      const store = useMessageStore.getState();
      if (e.key === 'Backspace') { e.preventDefault(); deleteFeedback(); store.deleteLastChar(); }
      else if (e.key === 'Enter') {
        e.preventDefault();
        const current = store.text.trim();
        if (current) {
          store.addToHistory(current);
          const ss = useSettingsStore.getState();
          aacSpeak(current, ss.speechRate, ss.speechVolume);
        }
      }
      else if (e.key.length === 1 && !e.ctrlKey && !e.metaKey) { e.preventDefault(); keyFeedback(); store.appendChar(e.key); }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  if (!hydrated) return <div className="h-svh surface-app" />;

  const themeClass = `${theme === 'dark' ? 'dark' : ''} ${highContrast ? 'high-contrast' : ''}`.trim();

  return (
    <SyncProvider>
      <div dir={rtl ? 'rtl' : 'ltr'} className={`${themeClass} h-svh flex flex-col overflow-hidden surface-app`} style={{ paddingTop: 'env(safe-area-inset-top)', paddingLeft: 'env(safe-area-inset-left)', paddingRight: 'env(safe-area-inset-right)' }}>
        <BrowserToolbar />
        <BrowserContent />
        {!compactMode && <MessageBar />}
        {!compactMode && <PredictionBar />}
        <div className={keyboardMaximized ? 'flex-1 min-h-0 flex flex-row' : 'shrink-0 flex flex-row'} style={{ height: keyboardMaximized ? undefined : compactMode ? 'clamp(80px, 30svh, 140px)' : 'clamp(170px, 25svh, 260px)' }} data-testid="keyboard-shell">
          <div className="flex-1 flex flex-col"><Keyboard /></div>
        </div>
        <EmergencyCountdownModal />
        <AlertConfirmModal />
        <HistoryModal />
        <SettingsModal />
        <HeadTrackingOverlay />
        <CameraInputOverlay />
        <TrackingDebugOverlay />
      </div>
    </SyncProvider>
  );
}
