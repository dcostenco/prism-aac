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
import PdfReaderPanel from './PdfReaderPanel';
import OcrCapturePanel from './OcrCapturePanel';
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
  // Keyboard visibility — refined invariant.
  //
  // Original rule: ALWAYS show the qwerty no matter which panel is
  // open, so the AAC user never loses their only input method.
  //
  // 2026-05-07 user feedback: this rule was too blunt. The Math panel
  // ships its OWN input keyboard (operators + numbers + variables); when
  // we also rendered the qwerty below it, the user got a clipped
  // double-keyboard ("broken keyboards" report). Same shape for any
  // future panel that owns its input layer.
  //
  // New rule: hide the global qwerty ONLY for panels that have their
  // own primary keyboard or that don't need typing at all. The user
  // still has a working interaction model — just not the qwerty:
  //   • math:               math cell-grid keyboard
  //   • games:              tap-to-play game cards, no typing
  //   • marketplace:        browse-and-tap, no typing
  //   • schedule:           date/time pickers + tap, no typing
  //   • caregiver:          settings UI
  //   • picture-editor:     drawing canvas
  //   • music-composer:     note tiles
  //
  // For ai-chat / aac-chat the qwerty STAYS — those are the panels
  // that need typed input. Keeping qwerty mounted there with a sane
  // min-height was earlier added to fix the "only the top two rows
  // are visible" squeeze when a flex-[3] panel sat above.
  //
  // User reports May 2026 (Images #19, #20, #21):
  //   • Games panel had a full qwerty under it eating ~40% of screen
  //     ("why is keyboard needed for games?")
  //   • Marketplace / Schedule had the same — keyboard for nothing.
  // The fix is the allow-list below.
  const PANELS_WITHOUT_QWERTY = new Set([
    'math',
    'games',
    'marketplace',
    'schedule',
    'caregiver',
    'picture-editor',
    'music-composer',
  ]);
  const showQwerty = !PANELS_WITHOUT_QWERTY.has(sidePanel);
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
    // Re-arm warmup on EVERY user gesture, not once per page-load.
    // 2026-05-08 user report: tutor / prediction-tile speech was
    // silent because aacSpeak fires 5-15 s after the click that
    // launched the AI request — by then the click's gesture token
    // is gone, the AudioContext that the page-load warmup created
    // has auto-suspended (browser quirk on inactive tabs), and
    // resume() inside decodeAndPlay can't transition back without
    // a fresh gesture. The previous `{ once: true }` listener fired
    // exactly once at first load and then disarmed itself, leaving
    // every subsequent speak vulnerable.
    //
    // New rule: every user gesture (touchstart / keydown /
    // pointerdown / click) re-warms the AudioContext synchronously.
    // warmupAzureAudio is idempotent — getAudioContext() returns the
    // singleton, ctx.resume() on a 'running' context is a no-op, so
    // the per-gesture overhead is negligible.
    //
    // azureTTS lazy-loaded once via a module-level cache; subsequent
    // gestures call mod.warmupAzureAudio() directly with no import
    // re-fetch.
    let mod: typeof import('@/services/azureTTS') | null = null;
    const warmup = () => {
      if (mod) {
        // Synchronous path — preserves the current gesture token.
        try { void mod.warmupAzureAudio(); } catch { /* */ }
        return;
      }
      // First call: load the module asynchronously, then warmup.
      // Subsequent gestures hit the sync branch above.
      import('@/services/azureTTS').then((m) => {
        mod = m;
        try { void m.warmupAzureAudio(); } catch { /* */ }
      }).catch(() => { /* offline / blocked */ });
    };
    window.addEventListener('touchstart', warmup, { passive: true });
    window.addEventListener('keydown', warmup);
    window.addEventListener('pointerdown', warmup);
    window.addEventListener('click', warmup);
    return () => {
      window.removeEventListener('touchstart', warmup);
      window.removeEventListener('keydown', warmup);
      window.removeEventListener('pointerdown', warmup);
      window.removeEventListener('click', warmup);
    };
  }, []);

  // iOS Safari audio-session reset on last camera lease release.
  // Once getUserMedia has run in the tab (TrackingSetupWizard PIP,
  // bodyPoseService, headTracker, reliabilityProbe), Safari may park the
  // audio session in PlayAndRecord and route AudioContext.destination to
  // earpiece (silent from speakers) — persists across location.reload().
  // When the last camera consumer drops, close the AudioContext so the
  // next gesture's warmup creates a fresh playback-only context. Skipped
  // mid-utterance (resetSharedAudioContextIfIdle checks activeSources).
  useEffect(() => {
    let unsub: (() => void) | null = null;
    void Promise.all([
      import('@/services/cameraStream'),
      import('@/services/azureTTS'),
    ]).then(([cs, tts]) => {
      unsub = cs.onAllLeasesReleased(() => {
        try { tts.resetSharedAudioContextIfIdle(); } catch { /* */ }
      });
    }).catch(() => { /* offline / blocked */ });
    return () => { if (unsub) unsub(); };
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
          {/* Math panel takes over the full viewport — hide AAC chrome
              (banner / message / predictions / categories) so the
              cell-grid canvas + bigger keyboards have room to breathe.
              Tapping ✓ Done or ✕ closes math and the chrome returns. */}
          {sidePanel !== 'math' && <GreetingBanner />}
          {sidePanel !== 'math' && <MessageBar />}
          {sidePanel !== 'math' && <PredictionBar />}
          {sidePanel !== 'math' && <CategoryPanel />}
          <MathPanel />
          <CaregiverPanel />
          <AIChatPanel />
          <AACChatPanel />
          <SchedulePanel />
          <GamesPanel />
          <MarketplacePanel />
          <PdfReaderPanel />
          <OcrCapturePanel />
          <PictureEditorPanel />
          <MusicComposerPanel />
          {/* Keyboard — hidden only for panels with their own input
              keyboard (math). For every other panel the qwerty stays
              mounted; the min-h prevents flex-[3] panels from squeezing
              it down to a 2-row clipped sliver. */}
          {showQwerty && (
            <div
              // Floor / cap chosen so all 4 rows (qwerty + utility) get
              // ≥ 60px each across every supported viewport. The
              // previous floor of 180px collapsed to ~30-40px rows on
              // iPad landscape with a flex-[3] panel above (May 2026
              // user screenshots #37 / #38 — Chat IA + Send Message
              // panels showed compressed rows). 280px floor / 38svh
              // grow / 440px cap.
              className="flex-1 flex flex-col min-h-[clamp(280px,38svh,440px)]"
              data-testid="keyboard-shell"
            >
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
