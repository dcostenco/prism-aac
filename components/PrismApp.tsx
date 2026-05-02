'use client';
import { useEffect, useState, Component, ReactNode } from 'react';
import Toolbar from './Toolbar';
import MessageBar from './MessageBar';
import PredictionBar from './PredictionBar';
import Keyboard from './Keyboard';
import CategoryPanel from './CategoryPanel';
import CaregiverPanel from './CaregiverPanel';
import AIChatPanel from './AIChatPanel';
import SchedulePanel from './SchedulePanel';
import GamesPanel from './GamesPanel';
import MarketplacePanel from './MarketplacePanel';
import PictureEditorPanel from './marketplace/panels/PictureEditorPanel';
import MathPanel from './MathPanel';
import HistoryModal from './HistoryModal';
import SettingsModal from './SettingsModal';
import AlertOverlay from './AlertOverlay';
import HeadTrackingOverlay from './HeadTrackingOverlay';
import CameraInputOverlay from './CameraInputOverlay';
import GreetingBanner from './GreetingBanner';
import SyncProvider from './SyncProvider';
import { usePredictionStore } from '@/store/predictionStore';
import { useCategoryStore } from '@/store/categoryStore';
import { useSettingsStore } from '@/store/settingsStore';
import { useMessageStore } from '@/store/messageStore';
import { useAuthStore } from '@/store/authStore';
import { useUIStore } from '@/store/uiStore';
import { keyFeedback, deleteFeedback } from '@/services/feedback';
import { aacSpeak } from '@/services/aacSpeak';
import { registerPanicListeners } from '@/services/panicService';
import { useT } from '@/engine/useT';

class ErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state: { error: Error | null } = { error: null };
  static getDerivedStateFromError(error: Error) { return { error }; }
  render() {
    if (this.state.error) {
      return (
        <div className="h-svh flex flex-col bg-white p-4">
          <p className="text-[#F44336] text-lg font-bold mb-2">Error — Emergency AAC Mode</p>
          <input
            id="emergency-input"
            type="text"
            placeholder="Type here..."
            className="border-2 border-black rounded-xl px-4 py-3 text-2xl mb-2"
            autoFocus
          />
          <div className="flex gap-2 mb-2">
            <button
              onClick={() => {
                const el = document.getElementById('emergency-input') as HTMLInputElement;
                if (el?.value && 'speechSynthesis' in window) {
                  const u = new SpeechSynthesisUtterance(el.value);
                  window.speechSynthesis.speak(u);
                }
              }}
              className="flex-1 bg-[#4CAF50] text-white px-4 py-4 rounded-xl text-xl font-bold"
            >
              ▶ Speak
            </button>
            <button onClick={() => window.location.reload()} className="bg-[#2196F3] text-white px-4 py-4 rounded-xl text-xl font-bold">
              Reload
            </button>
          </div>
          <div className="grid grid-cols-4 gap-2">
            {['Help', 'Yes', 'No', 'Stop', 'Bathroom', 'Water', 'Hungry', 'Pain'].map((w) => (
              <button key={w} onClick={() => {
                const el = document.getElementById('emergency-input') as HTMLInputElement;
                if (el) el.value = w;
                if ('speechSynthesis' in window) {
                  const u = new SpeechSynthesisUtterance(w);
                  window.speechSynthesis.speak(u);
                }
              }} className="bg-gray-100 border-2 border-gray-300 rounded-xl py-3 text-lg font-bold">
                {w}
              </button>
            ))}
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

export default function PrismApp() {
  const runDecay = usePredictionStore((s) => s.runDecay);
  const ensureSeed = usePredictionStore((s) => s.ensureSeed);
  const refreshAuth = useAuthStore((s) => s.refresh);
  const [hydrated, setHydrated] = useState(false);

  const seedTemplates = useCategoryStore((s) => s.seedTemplates);
  const highContrast = useSettingsStore((s) => s.highContrast);
  const theme = useSettingsStore((s) => s.theme);
  const sidePanel = useUIStore((s) => s.sidePanel);
  const inlinePanelOpen = sidePanel !== 'none';
  const { rtl } = useT();

  useEffect(() => {
    // SSR hydration guard: zustand persist rehydrates client-side, so we must
    // wait until after mount before rendering store-dependent content.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setHydrated(true);
    runDecay();
    seedTemplates();
    ensureSeed();
    refreshAuth();
    const unregisterPanic = registerPanicListeners();
    return unregisterPanic;
  }, [runDecay, seedTemplates, ensureSeed, refreshAuth]);

  // Warm up AudioContext on first user interaction so WASM TTS / beep
  // fallback works even when triggered by non-gesture events (AI chat,
  // remote modeling). Browsers suspend AudioContexts until user gesture.
  useEffect(() => {
    const warmup = () => {
      try {
        const ctx = new AudioContext();
        if (ctx.state === 'suspended') ctx.resume();
        ctx.close();
      } catch { /* */ }
      window.removeEventListener('touchstart', warmup);
      window.removeEventListener('keydown', warmup);
    };
    window.addEventListener('touchstart', warmup, { once: true, passive: true });
    window.addEventListener('keydown', warmup, { once: true });
    return () => {
      window.removeEventListener('touchstart', warmup);
      window.removeEventListener('keydown', warmup);
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

  if (!hydrated) {
    return <div className="h-svh surface-app" />;
  }

  const themeClass = `${theme === 'dark' ? 'dark' : ''} ${highContrast ? 'high-contrast' : ''}`.trim();

  return (
    <ErrorBoundary>
      <SyncProvider>
        <div dir={rtl ? 'rtl' : 'ltr'} className={`${themeClass} h-svh flex flex-col overflow-hidden surface-app`}>
          <Toolbar />
          <GreetingBanner />
          <MessageBar />
          {!inlinePanelOpen && <PredictionBar />}
          <CategoryPanel />
          <MathPanel />
          <CaregiverPanel />
          <AIChatPanel />
          <SchedulePanel />
          <GamesPanel />
          <MarketplacePanel />
          <PictureEditorPanel />
          {!inlinePanelOpen && (
            <div className="flex-1 flex flex-col min-h-0">
              <Keyboard />
            </div>
          )}
          <AlertOverlay />
          {/* True modals — settings/history are configuration UIs, not
              communication panels, so they stay as full-screen overlays. */}
          <HistoryModal />
          <SettingsModal />
          <HeadTrackingOverlay />
          <CameraInputOverlay />
        </div>
      </SyncProvider>
    </ErrorBoundary>
  );
}
