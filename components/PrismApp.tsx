'use client';
import { useEffect, useState, Component, ReactNode } from 'react';
import Toolbar from './Toolbar';
import MessageBar from './MessageBar';
import PredictionBar from './PredictionBar';
import Keyboard from './Keyboard';
import CategoryPanel from './CategoryPanel';
import CaregiverPanel from './CaregiverPanel';
import AIChatPanel from './AIChatPanel';
import AACChatPanel from './AACChatPanel';
import SchedulePanel from './SchedulePanel';
import GamesPanel from './GamesPanel';
import MarketplacePanel from './MarketplacePanel';
import PictureEditorPanel from './marketplace/panels/PictureEditorPanel';
import MusicComposerPanel from './marketplace/panels/MusicComposerPanel';
import MathPanel from './MathPanel';
import HistoryModal from './HistoryModal';
import SettingsModal from './SettingsModal';
import AlertOverlay from './AlertOverlay';
import HeadTrackingOverlay from './HeadTrackingOverlay';
import TrackingDebugOverlay from './TrackingDebugOverlay';
import TtsDebugOverlay from './TtsDebugOverlay';
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
import { preloadKokoro } from '@/services/kokoroTTS';
import { startInboxPolling } from '@/services/inboxService';
import { startContactsSync } from '@/services/contactsIntegrationService';
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
  // Keyboard is ALWAYS visible — hard invariant. AAC users can't switch
  // to a physical keyboard, can't pick another input method, can't even
  // articulate that the keyboard disappeared. Hiding it for "more screen
  // space" trades the user's only voice for a UI win nobody asked for.
  // Every panel (categories, schedule, marketplace, math, games, notes,
  // ai-chat, aac-chat, ...) renders ABOVE the keyboard with `flex-[3]`
  // so the panel scrolls inside its share and the keyboard keeps its
  // share at the bottom — same position the user trained on. Touched
  // anywhere in PrismApp.tsx, but the contract is: never gate the
  // <Keyboard /> render on sidePanel state.
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
    // Pre-warm Kokoro neural TTS in the background. The 350MB ONNX model
    // takes 20-40s to download on first load. Without preloading, the
    // first English speech that falls past Tier 1 (cross-origin auth
    // blocked when AAC is served from prism-aac.vercel.app instead of
    // synalux.ai/prism-aac) hits Tier 3 Web Speech, which on macOS picks
    // a basic compact voice that sounds robotic. With preload, Tier 2
    // Kokoro is usually ready by the time the user triggers TTS.
    preloadKokoro();
    const unregisterPanic = registerPanicListeners();
    // Drain incoming caregiver/contact messages onto the schedule. The
    // poller is no-op until the portal /api/v1/prism-aac/inbox/poll
    // endpoint is live (silently bails on 404), so wiring it now is safe.
    const stopInbox = startInboxPolling();
    // Mirror connected-provider contacts (Telegram/WhatsApp/...) from the
    // portal into local store so the AAC user sees an instant picker.
    // Same no-op-on-404 pattern as the inbox poller.
    const stopContactsSync = startContactsSync();
    return () => {
      unregisterPanic();
      stopInbox();
      stopContactsSync();
    };
  }, [runDecay, seedTemplates, ensureSeed, refreshAuth]);

  // Warm up the SHARED AudioContext on first user interaction.
  //
  // The Inworld/Azure TTS path in services/azureTTS.ts plays audio via
  // AudioBufferSourceNode on a singleton AudioContext (ditched the legacy
  // `new Audio().play()` after `await fetch()` pattern because iOS Safari
  // silently rejects play() once the user-gesture token is consumed by the
  // await — that was the "Speak button doesn't work sometimes" bug). The
  // BufferSourceNode does NOT need a fresh gesture, but the AudioContext
  // does need to be in 'running' state before any audio plays. This warmup
  // creates+resumes the context inside the first touchstart/keydown so
  // every subsequent Speak tap plays reliably.
  useEffect(() => {
    let warmed = false;
    const warmup = async () => {
      if (warmed) return;
      warmed = true;
      try {
        // Lazy-load azureTTS so the AudioContext side-effect only fires
        // after the user gesture, not at module load time. Then call the
        // explicit warmup which creates+resumes the singleton context.
        const mod = await import('@/services/azureTTS');
        await mod.warmupAzureAudio();
      } catch { /* */ }
      window.removeEventListener('touchstart', warmup);
      window.removeEventListener('keydown', warmup);
      window.removeEventListener('pointerdown', warmup);
    };
    window.addEventListener('touchstart', warmup, { once: true, passive: true });
    window.addEventListener('keydown', warmup, { once: true });
    window.addEventListener('pointerdown', warmup, { once: true });
    return () => {
      window.removeEventListener('touchstart', warmup);
      window.removeEventListener('keydown', warmup);
      window.removeEventListener('pointerdown', warmup);
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
          <PredictionBar />
          <CategoryPanel />
          <MathPanel />
          <CaregiverPanel />
          <AIChatPanel />
          <AACChatPanel />
          <SchedulePanel />
          <GamesPanel />
          <MarketplacePanel />
          <PictureEditorPanel />
          <MusicComposerPanel />
          {/* Keyboard is unconditional — see invariant comment above. */}
          <div className="flex-1 flex flex-col min-h-0" data-testid="keyboard-shell">
            <Keyboard />
          </div>
          <AlertOverlay />
          {/* True modals — settings/history are configuration UIs, not
              communication panels, so they stay as full-screen overlays. */}
          <HistoryModal />
          <SettingsModal />
          <HeadTrackingOverlay />
          <CameraInputOverlay />
          {/* Hidden by default; activates via ?debug=tracking or
              localStorage["prism-tracking-debug"]="1". Returns null
              for end users so there is no bundle / DOM cost. */}
          <TrackingDebugOverlay />
          {/* Hidden by default; activates via ?debug=tts or
              localStorage["prism-tts-debug"]="1". Surfaces the
              Inworld → Azure → Kokoro → Web Speech → Native iOS
              fallback chain decisions for support. */}
          <TtsDebugOverlay />
        </div>
      </SyncProvider>
    </ErrorBoundary>
  );
}
