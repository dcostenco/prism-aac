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
import ComfortPlayerPanel from './ComfortPlayerPanel';
import PictureEditorPanel from './marketplace/panels/PictureEditorPanel';
import MusicComposerPanel from './marketplace/panels/MusicComposerPanel';
import MathPanel from './MathPanel';
import HistoryModal from './HistoryModal';
import SettingsModal from './SettingsModal';
import CategoryManagerModal from './CategoryManagerModal';
import EmergencyCountdownModal from './EmergencyCountdownModal';
import AlertConfirmModal from './AlertConfirmModal';
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
import { startInboxPolling } from '@/services/inboxService';
import { startContactsSync } from '@/services/contactsIntegrationService';
import { broadcastIntegrationEvent } from '@/services/integrationsService';
import { registerConnectivityListener } from '@/services/emergencyService';
import { useT } from '@/engine/useT';

const PROVIDER_LABEL: Record<string, string> = {
  'google-gmail': 'Gmail',
  'microsoft-mail': 'Outlook',
  google: 'Google',
  microsoft: 'Microsoft',
  slack: 'Slack',
  discord: 'Discord',
  github: 'GitHub',
  telegram: 'Telegram',
  sms: 'SMS',
  whatsapp: 'WhatsApp',
  viber: 'Viber',
  facebook: 'Facebook Messenger',
  imessage: 'iMessage',
  facetime: 'FaceTime',
};

class ErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null; stack: string }> {
  state: { error: Error | null; stack: string } = { error: null, stack: '' };
  static getDerivedStateFromError(error: Error) { return { error, stack: '' }; }
  componentDidCatch(error: Error, info: { componentStack: string }) {
    const stack = info.componentStack.slice(0, 500);
    console.error('[CRASH]', error.message, stack);
    this.setState({ stack });
  }
  render() {
    if (this.state.error) {
      return (
        <div className="h-svh flex flex-col bg-white p-4 overflow-auto">
          <p className="text-[#F44336] text-lg font-bold mb-1">Error — Emergency AAC Mode</p>
          <p className="text-[#F44336] text-xs mb-1 font-mono break-all">{this.state.error.message}</p>
          <pre className="text-[8px] text-gray-500 mb-2 whitespace-pre-wrap break-all">{this.state.stack}</pre>
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

// Module-level constant — panels where the QWERTY keyboard is never shown.
// Declared outside the component so a new Set is not allocated on every render.
const PANELS_WITHOUT_QWERTY = new Set([
  'math',
  'games',
  'marketplace',
  'schedule',
  'caregiver',
  'picture-editor',
  'music-composer',
  'comfort-player',
  'categories',
  'category-detail',
  'ordering',
]);

export default function PrismApp() {
  const runDecay = usePredictionStore((s) => s.runDecay);
  const ensureSeed = usePredictionStore((s) => s.ensureSeed);
  const refreshAuth = useAuthStore((s) => s.refresh);
  const [hydrated, setHydrated] = useState(false);
  // Banner shown after returning from the OAuth same-window redirect.
  // Set by the URL-handler useEffect below; auto-dismisses after 4s.
  const [connectFeedback, setConnectFeedback] = useState<{ kind: 'ok' | 'err'; msg: string } | null>(null);

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
  const categoryKeyboardOpen = useUIStore((s) => s.categoryKeyboardOpen);
  const keyboardMaximized = useUIStore((s) => s.keyboardMaximized);
  const isCategoryMode = ['categories','category-detail','ordering'].includes(sidePanel);
  const homeWithBoard = sidePanel === 'none';
  const showQwerty = isCategoryMode || homeWithBoard
    ? categoryKeyboardOpen
    : !PANELS_WITHOUT_QWERTY.has(sidePanel);
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
    // Install Watch→web alert bridge. Idempotent — safe under StrictMode.
    void import('@/services/watchAlertBridge').then((m) => m.registerWatchAlertBridge());
    // Auto-sideload: detect local Ollama → pull best prism-coder model
    import('@/services/aiService').then(m => m.autoSideload?.()).catch(() => {});
    // Pre-warm MediaPipe WASM + face models so the first startHeadTracker()
    // sees near-zero cold-start. Models are self-hosted on Vercel CDN (~9 MB
    // total) and load in ~1-2s — completing well before the user navigates
    // to Settings and enables head tracking.
    import('@/services/headTracker').then(m => m.prewarmHeadTracker?.()).catch(() => {});
    // Pre-cache all pictograms for offline — runs in background
    import('@/services/pictogramService').then(m =>
      m.precacheAllPictograms?.(useSettingsStore.getState().language, 'symbols')
    ).catch(() => {});
    const unregisterPanic = registerPanicListeners();
    const cleanupConnectivity = registerConnectivityListener();
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
      cleanupConnectivity?.();
      stopInbox();
      stopContactsSync();
    };
  }, [runDecay, seedTemplates, ensureSeed, refreshAuth]);

  // OAuth-return handler — synalux's connect callback redirects the
  // user's window to /prism-aac?connected=1&provider=<id>&scope=<key>
  // (success) or ?error=<reason> (failure). We pop the toast, broadcast
  // to other tabs so their integration cards refresh, then clean the
  // query string so a hard reload doesn't re-trigger the toast.
  //
  // Same-window navigation (replacing the popup pattern) is the only
  // OAuth flow that works reliably on iPad Safari — popups get blocked
  // or open in background tabs that the user doesn't notice. The
  // banner is the user's only confirmation that the connect succeeded;
  // skip it and they wonder if anything happened.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const sp = new URLSearchParams(window.location.search);
    const connected = sp.get('connected');
    const errParam = sp.get('error');
    const provider = sp.get('provider') || '';
    const scope = sp.get('scope') || '';
    if (!connected && !errParam) return;

    // Refine the label by scope: provider=google + scope=gmail should
    // surface "Gmail" not "Google" (paid-tier users connecting Gmail
    // expect to see Gmail in the confirmation, not the underlying
    // OAuth provider id). Same for microsoft+mail → Outlook.
    const refinedKey = provider === 'google' && scope === 'gmail'
      ? 'google-gmail'
      : provider === 'microsoft' && scope === 'mail'
        ? 'microsoft-mail'
        : provider;
    const label = PROVIDER_LABEL[refinedKey] || PROVIDER_LABEL[provider] || provider || 'provider';
    if (connected === '1') {
      setConnectFeedback({ kind: 'ok', msg: `✓ ${label} connected` });
      try {
        broadcastIntegrationEvent({
          type: 'provider-connected',
          provider,
          at: Date.now(),
        });
      } catch { /* */ }
    } else if (errParam) {
      const human = errParam === 'state_mismatch'
        ? 'Connect session expired — try again.'
        : errParam === 'missing_code'
          ? `Authorization for ${label} was cancelled.`
          : `Couldn't connect ${label}: ${errParam}`;
      setConnectFeedback({ kind: 'err', msg: human });
    }

    // Strip the query so hard-reload doesn't re-fire the toast.
    sp.delete('connected');
    sp.delete('provider');
    sp.delete('scope');
    sp.delete('error');
    const cleanedQs = sp.toString();
    const newUrl = window.location.pathname + (cleanedQs ? `?${cleanedQs}` : '') + window.location.hash;
    window.history.replaceState({}, '', newUrl);

    const t = setTimeout(() => setConnectFeedback(null), 4000);
    return () => clearTimeout(t);
  }, []);

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
    //
    // Pre-import: start the import at effect mount (no gesture required)
    // so the module is cached BEFORE the first user gesture. Without
    // this, the first gesture triggers an async import → by the time it
    // resolves, Safari's user-gesture token has expired →
    // AudioContext.resume() fails silently → context stays suspended →
    // TTS falls through to Web Speech (robotic). Fix: eager import keeps
    // the first gesture on the synchronous warmup path.
    let mod: typeof import('@/services/azureTTS') | null = null;
    import('@/services/azureTTS').then((m) => { mod = m; }).catch(() => {});
    const warmup = () => {
      if (mod) {
        // Synchronous path — preserves the current gesture token.
        try { void mod.warmupAzureAudio(); } catch { /* */ }
        return;
      }
      // Fallback: module not yet loaded (slow network). Load it now
      // and warmup after. The gesture token may be gone by then but
      // subsequent gestures will hit the sync branch.
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
        <div dir={rtl ? 'rtl' : 'ltr'} className={`${themeClass} h-svh flex flex-col overflow-hidden surface-app`} style={{ paddingTop: 'env(safe-area-inset-top)' }}>
          {/* Connect-OAuth return banner. Auto-dismisses after 4s
              (set by the URL-handler useEffect). Only confirmation
              the user gets that the OAuth same-window redirect
              succeeded. */}
          {connectFeedback && (
            <div
              role="status"
              data-testid="connect-feedback-banner"
              className={`fixed top-4 right-4 z-[200] max-w-sm rounded-xl shadow-lg px-4 py-3 text-sm font-bold ${
                connectFeedback.kind === 'ok'
                  ? 'bg-[#4CAF50] text-white'
                  : 'bg-[#F44336] text-white'
              }`}
            >
              {connectFeedback.msg}
            </div>
          )}
          <Toolbar />
          {/* Math panel takes over the full viewport — hide AAC chrome
              (banner / message / predictions / categories) so the
              cell-grid canvas + bigger keyboards have room to breathe.
              Tapping ✓ Done or ✕ closes math and the chrome returns. */}
          {sidePanel !== 'math' && sidePanel !== 'ai-chat' && sidePanel !== 'comfort-player' && !showQwerty && <GreetingBanner />}
          {sidePanel !== 'math' && sidePanel !== 'ai-chat' && sidePanel !== 'comfort-player' && <MessageBar />}
          {!PANELS_WITHOUT_QWERTY.has(sidePanel) && sidePanel !== 'ai-chat' && !isCategoryMode && !keyboardMaximized && <PredictionBar />}
          <MathPanel />
          <CaregiverPanel />
          <AIChatPanel />
          <AACChatPanel />
          <SchedulePanel />
          <GamesPanel />
          <MarketplacePanel />
          <PdfReaderPanel />
          <OcrCapturePanel />
          <ComfortPlayerPanel />
          <PictureEditorPanel />
          <MusicComposerPanel />
          {/* Category mode: full-screen cards (Image #32 pattern).
              Keyboard is a pull-up drawer toggled from inside CategoryPanel.
              All other modes: CategoryPanel stacks above keyboard as before. */}
          {sidePanel !== 'math' && sidePanel !== 'comfort-player' && sidePanel !== 'schedule' && !(showQwerty && keyboardMaximized) && (
            <div className="flex-[3] min-h-0 flex flex-col">
              <CategoryPanel />
            </div>
          )}
          {showQwerty && (
            <div
              className={
                keyboardMaximized
                  ? "flex-1 min-h-0 flex flex-row"
                  : "shrink-0 h-[clamp(170px,25svh,260px)] flex flex-row"
              }
              data-testid="keyboard-shell"
            >
              <div className="flex-1 flex flex-col">
                <Keyboard />
              </div>
              {isCategoryMode && (
                <div className="w-[clamp(72px,9vw,96px)] shrink-0 bg-[#3e2a1a] border-l-2 border-[#5c3d25]" />
              )}
            </div>
          )}
          {/* Emergency modal — mounted unconditionally at root, above all other UI */}
          <EmergencyCountdownModal />
          {/* Alert-to-caregiver confirmation + status toast. Mounted at root
              so the Watch bridge (window.prismOnWatchMessage) and the toolbar
              🚨 button both route through the same modal/status surface. */}
          <AlertConfirmModal />
          {/* True modals — settings/history are configuration UIs, not
              communication panels, so they stay as full-screen overlays. */}
          <HistoryModal />
          <SettingsModal />
          <CategoryManagerModal />
          <HeadTrackingOverlay />
          <CameraInputOverlay />
          {/* Hidden by default; activates via ?debug=tracking or
              localStorage["prism-tracking-debug"]="1". Returns null
              for end users so there is no bundle / DOM cost. */}
          <TrackingDebugOverlay />
          {/* Hidden by default; activates via ?debug=tts or
              localStorage["prism-tts-debug"]="1". Surfaces the
              Inworld → Azure → Web Speech → Native iOS
              fallback chain decisions for support. */}
          <TtsDebugOverlay />
        </div>
      </SyncProvider>
    </ErrorBoundary>
  );
}
