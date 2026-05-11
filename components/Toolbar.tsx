'use client';
import { useEffect, useRef, useState } from 'react';
import { useUIStore } from '@/store/uiStore';
import { useMessageStore } from '@/store/messageStore';
import { useSettingsStore, type ToolbarButtonId, DEFAULT_TOOLBAR_ORDER } from '@/store/settingsStore';
import type { SupportedLanguage } from '@/engine/i18n';
import { useSyncStatus } from './SyncProvider';
import { tapFeedback } from '@/services/feedback';
import { useT } from '@/engine/useT';
import { isVoiceInputSupported, startVoiceInput, VoiceSession } from '@/services/voiceInputService';
import { correctText } from '@/services/textCorrectService';
import { useMarketplaceStore } from '@/store/marketplaceStore';
import { getHandler } from '@/lib/marketplace/registry';
import { useScheduleStore, selectUnreadMessageCount } from '@/store/scheduleStore';
import LanguagePicker, { LanguageButton } from './LanguagePicker';

const SYNC_ICONS: Record<string, string> = {
  idle: '⬡', syncing: '🔄', synced: '🟢', offline: '🔸', error: '🔴',
};

// Built-in button registry. To add a new button:
//   1. add the id to ToolbarButtonId in settingsStore.ts
//   2. add it to DEFAULT_TOOLBAR_ORDER (or skip if it should be opt-in)
//   3. register the icon + handler factory here
// The factory receives the action callbacks + current state and returns the
// per-render button props. No new field on the registry should ship without
// also wiring it into a real consumer (per pre-commit-protocol Rule 2).
interface ButtonHandlers {
  openCategories: () => void;
  openMath: () => void;
  openAIChat: () => void;
  openAACChat: () => void;
  openCaregiver: () => void;
  openSchedule: () => void;
  openGames: () => void;
  openMarketplace: () => void;
  openPdfReader: () => void;
  openOcrCapture: () => void;
  toggleHistory: () => void;
  toggleSettings: () => void;
  triggerAlert: () => void;
  toggleSound: () => void;
  toggleMic: () => void;
  soundEnabled: boolean;
  listening: boolean;
  voiceSupported: boolean;
  /** Unread incoming-message count — drives the badge on aac_chat. */
  unreadMessages: number;
}

interface RenderedButton {
  id: string;
  icon: string;
  ariaLabel: string;
  title: string;
  onClick: () => void;
  highlighted?: boolean;
  pulsing?: boolean;
  /** Numeric overlay rendered top-right of the button (e.g. unread
   *  incoming messages on aac_chat). Falsy = no badge. */
  badge?: number;
}

function buildBuiltInButtons(t: (k: string) => string, h: ButtonHandlers): Record<ToolbarButtonId, RenderedButton | null> {
  return {
    categories: { id: 'categories', icon: '📂', ariaLabel: t('categories'), title: t('categories'), onClick: h.openCategories },
    mic: h.voiceSupported ? {
      id: 'mic',
      icon: h.listening ? '⏺' : '🎙',
      ariaLabel: h.listening ? t('stop_voice') : t('start_voice'),
      title: h.listening ? t('stop_voice') : t('start_voice'),
      onClick: h.toggleMic,
      highlighted: h.listening,
      pulsing: h.listening,
    } : null,
    schedule: { id: 'schedule', icon: '📅', ariaLabel: t('schedule'), title: t('schedule'), onClick: h.openSchedule },
    marketplace: { id: 'marketplace', icon: '🏪', ariaLabel: t('marketplace'), title: t('marketplace'), onClick: h.openMarketplace },
    alert: { id: 'alert', icon: '🚨', ariaLabel: t('alert'), title: t('alert'), onClick: h.triggerAlert },
    math: { id: 'math', icon: '🔢', ariaLabel: t('math'), title: t('math'), onClick: h.openMath },
    ai_chat: { id: 'ai_chat', icon: '✨', ariaLabel: t('ai_chat'), title: t('ai_chat'), onClick: h.openAIChat },
    aac_chat: {
      id: 'aac_chat',
      icon: '💬',
      ariaLabel: h.unreadMessages > 0
        ? `${t('aac_chat') || 'Send a message'} — ${h.unreadMessages} ${t('unread') || 'unread'}`
        : (t('aac_chat') || 'Send a message'),
      title: t('aac_chat') || 'Send a message',
      onClick: h.openAACChat,
      badge: h.unreadMessages || undefined,
    },
    notes: { id: 'notes', icon: '📋', ariaLabel: t('notes'), title: t('notes'), onClick: h.openCaregiver },
    games: { id: 'games', icon: '🎮', ariaLabel: t('games'), title: t('games'), onClick: h.openGames },
    pdf_reader: { id: 'pdf_reader', icon: '📄', ariaLabel: 'PDF reader', title: 'PDF reader', onClick: h.openPdfReader },
    ocr_capture: { id: 'ocr_capture', icon: '👁', ariaLabel: 'Screenshot reader (OCR)', title: 'Screenshot reader (OCR)', onClick: h.openOcrCapture },
    history: { id: 'history', icon: '📜', ariaLabel: t('history'), title: t('history'), onClick: h.toggleHistory },
    sound: {
      id: 'sound',
      icon: h.soundEnabled ? '🔊' : '🔇',
      ariaLabel: h.soundEnabled ? t('sound_on') : t('sound_off'),
      title: h.soundEnabled ? t('sound_on') : t('sound_off'),
      onClick: h.toggleSound,
      highlighted: h.soundEnabled,
    },
    settings: { id: 'settings', icon: '⚙️', ariaLabel: t('settings'), title: t('settings'), onClick: h.toggleSettings },
  };
}

// Marketplace app ID → (icon, label-key). Apps not in this map fall back to
// a generic puzzle-piece icon so they're still clickable. Keep in sync with
// MarketplacePanel CATALOG.
const APP_ICON_MAP: Record<string, { icon: string; labelKey?: string; label?: string }> = {
  'symbol-libraries': { icon: '📚', labelKey: 'mp_symbol_libraries' },
  'board-templates': { icon: '📋', labelKey: 'mp_board_templates' },
  'vocab-my-core': { icon: '⚡', labelKey: 'vs_my_core' },
  'vocab-wordpower': { icon: '💪', labelKey: 'vs_wordpower' },
  'vocab-gateway': { icon: '🚪', labelKey: 'vs_gateway' },
  'vocab-aphasia': { icon: '🧠', labelKey: 'vs_aphasia' },
  'vocab-social-chat': { icon: '💬', labelKey: 'vs_social_chat' },
  'game-packs': { icon: '🎮', labelKey: 'mp_game_packs' },
  'voice-packs': { icon: '🎙', labelKey: 'mp_voice_packs' },
  'picture-editor': { icon: '🖼', labelKey: 'mp_picture_editor' },
  'music-composer': { icon: '🎵', labelKey: 'mp_music_composer' },
  'aac-designer': { icon: '🎨', labelKey: 'mp_aac_designer' },
  'video-composer': { icon: '🎬', labelKey: 'mp_video_composer' },
  // Synalux first-party apps (kind: 'synalux-app' in the marketplace catalog).
  // Tap launches via synaluxAppHandler.launch() → opens portal URL in a new tab.
  'synalux-mail': { icon: '✉️', labelKey: 'mp_synalux_mail' },
  'synalux-drive': { icon: '📂', labelKey: 'mp_synalux_drive' },
};

function appButton(
  appId: string,
  t: (k: string) => string,
  openMarketplace: () => void,
  launchInstalled: (appId: string) => boolean,
): RenderedButton {
  const meta = APP_ICON_MAP[appId];
  const labelText = meta?.labelKey ? t(meta.labelKey) : (meta?.label ?? appId);
  return {
    id: `app:${appId}`,
    icon: meta?.icon ?? '🧩',
    ariaLabel: labelText,
    title: labelText,
    // First try the marketplace handler's launch() — this is what makes
    // synalux-mail / synalux-drive actually open their portal URL. If no
    // handler is registered (e.g. catalog hasn't loaded yet) or the
    // handler doesn't define launch (e.g. vocab-set), fall back to opening
    // the marketplace panel so the user always sees something happen.
    onClick: () => {
      if (!launchInstalled(appId)) openMarketplace();
    },
  };
}

export default function Toolbar() {
  const { openCategories, openMath, openCaregiver, openAIChat, openAACChat, openSchedule, openGames, openMarketplace, openPdfReader, openOcrCapture, toggleHistory, toggleSettings, triggerAlert } = useUIStore();
  const { soundEnabled, toggleSound, appendText } = useMessageStore();
  const language = useSettingsStore((s) => s.language);
  const outputLanguage = useSettingsStore((s) => s.outputLanguage);
  const updateSettings = useSettingsStore((s) => s.update);
  const toolbarConfig = useSettingsStore((s) => s.toolbarConfig);
  const installedApps = useSettingsStore((s) => s.installedApps);
  const syncStatus = useSyncStatus();
  const { t, ttsCode } = useT();
  const [listening, setListening] = useState(false);
  const [showLangPicker, setShowLangPicker] = useState<'input' | 'output' | null>(null);
  const voiceRef = useRef<VoiceSession | null>(null);
  const langRef = useRef<HTMLDivElement>(null);
  const voiceSupported = isVoiceInputSupported();
  const unreadMessages = useScheduleStore(selectUnreadMessageCount);

  useEffect(() => () => { voiceRef.current?.stop(); voiceRef.current = null; setListening(false); }, [language]);
  useEffect(() => {
    if (!showLangPicker) return;
    const handler = (e: MouseEvent) => {
      if (langRef.current && !langRef.current.contains(e.target as Node)) setShowLangPicker(null);
    };
    document.addEventListener('pointerdown', handler);
    return () => document.removeEventListener('pointerdown', handler);
  }, [showLangPicker]);

  const toggleMic = () => {
    tapFeedback();
    if (voiceRef.current) { voiceRef.current.stop(); voiceRef.current = null; setListening(false); return; }
    const session = startVoiceInput({
      lang: ttsCode,
      onInterim: () => {},
      onFinal: async (txt) => { const fixed = await correctText(txt.trim(), language); if (!voiceRef.current) return; appendText((fixed || txt).trim() + ' '); },
      onError: () => { voiceRef.current?.stop(); voiceRef.current = null; setListening(false); },
    });
    if (session) { voiceRef.current = session; setListening(true); }
  };

  const handlers: ButtonHandlers = {
    openCategories, openMath, openAIChat, openAACChat, openCaregiver, openSchedule, openGames, openMarketplace,
    openPdfReader, openOcrCapture,
    toggleHistory, toggleSettings, triggerAlert,
    toggleSound: () => { tapFeedback(); toggleSound(); },
    toggleMic,
    soundEnabled, listening, voiceSupported,
    unreadMessages,
  };

  // Try the marketplace handler's launch() for an installed app. Returns
  // true if the handler launched it; false if no handler / no launch fn so
  // the caller can fall back to opening the marketplace panel.
  const launchInstalled = (appId: string): boolean => {
    const manifest = useMarketplaceStore.getState().findBySlug(appId);
    if (!manifest) return false;
    const handler = getHandler(manifest.kind);
    if (!handler?.launch) return false;
    handler.launch(manifest, {
      settings: {
        installApp: useSettingsStore.getState().installApp,
        uninstallApp: useSettingsStore.getState().uninstallApp,
        update: useSettingsStore.getState().update,
        getActiveVocabSet: () => useSettingsStore.getState().activeVocabSet,
        getInstalledApps: () => useSettingsStore.getState().installedApps,
      },
      ui: {
        closeSidePanel: () => {},
        openCategories,
        openGames,
        openMarketplace,
        openSettings: () => toggleSettings(),
        openModulePanel: () => {},
        openBuiltin: (name) => {
          if (name === 'aac-chat') openAACChat();
          else if (name === 'ai-chat') openAIChat();
          else if (name === 'schedule') openSchedule();
          else if (name === 'caregiver') openCaregiver();
          else if (name === 'math') openMath();
        },
      },
    });
    return true;
  };

  // eslint-disable-next-line react-hooks/refs
  const builtIns = buildBuiltInButtons(t, handlers);

  // Resolve the visible button list from config:
  //   - iterate toolbarConfig.order for built-in ids that are enabled
  //   - then append installed marketplace apps (in install order)
  // Disabled ids (enabled[id]===false) stay in `order` but skip rendering;
  // they reappear in original position when re-enabled.
  // Forward-compat: any id in DEFAULT_TOOLBAR_ORDER that's missing from a
  // persisted user config gets appended at the end so new built-ins show
  // up after upgrade without a migration.
  const visibleIds: string[] = [];
  const seen = new Set<ToolbarButtonId>();
  for (const id of toolbarConfig.order) {
    if (id === 'settings' || toolbarConfig.enabled[id] !== false) visibleIds.push(id);
    seen.add(id);
  }
  for (const id of DEFAULT_TOOLBAR_ORDER) {
    if (!seen.has(id) && (id === 'settings' || toolbarConfig.enabled[id] !== false)) visibleIds.push(id);
  }
  const appIds = installedApps.map((a) => `app:${a}`);
  const allButtons = [...visibleIds, ...appIds];

  const btnClass = 'aac-btn w-[clamp(2.25rem,7vw,3.25rem)] h-[clamp(2.25rem,7svh,3.25rem)] rounded-full text-[clamp(1rem,3.5vw,1.5rem)] select-none border border-theme shrink-0 flex items-center justify-center';
  const tap = (fn: () => void) => () => { tapFeedback(); fn(); };

  function renderButton(id: string): React.ReactNode {
    if (id.startsWith('app:')) {
      const b = appButton(id.slice(4), t, openMarketplace, launchInstalled);
      return (
        <button
          key={id}
          className={`${btnClass} surface-key text-primary`}
          onClick={tap(b.onClick)}
          aria-label={b.ariaLabel}
          title={b.title}
        >{b.icon}</button>
      );
    }
    const b = builtIns[id as ToolbarButtonId];
    if (!b) return null; // mic when voice unsupported, etc.
    const colorClasses = b.highlighted
      ? (b.id === 'sound' ? 'bg-[#4CAF50] text-white border-transparent' : (b.id === 'mic' ? 'bg-[#F44336] text-white border-transparent' : 'surface-key text-primary'))
      : 'surface-key text-primary';
    const pulseClass = b.pulsing ? 'animate-pulse' : '';
    return (
      <button
        key={id}
        className={`${btnClass} ${colorClasses} ${pulseClass} relative`}
        onClick={tap(b.onClick)}
        aria-label={b.ariaLabel}
        title={b.title}
        aria-pressed={b.highlighted}
      >
        {b.icon}
        {b.badge && b.badge > 0 ? (
          <span
            data-testid={`toolbar-badge-${b.id}`}
            className="absolute -top-1 -right-1 min-w-[1.1rem] h-[1.1rem] px-1 rounded-full bg-[#F44336] text-white text-[0.65rem] font-bold flex items-center justify-center border border-white shadow"
            aria-hidden
          >
            {b.badge > 99 ? '99+' : b.badge}
          </span>
        ) : null}
      </button>
    );
  }

  return (
    <div className="flex items-center justify-between px-1 py-[clamp(0.1rem,0.3svh,0.25rem)] surface-bar shrink-0 border-b border-theme relative">
      {/* Single-row toolbar with horizontal overflow scroll. Earlier
          revision used `flex-wrap` so installed marketplace apps could
          break onto a second row, but that doubled the toolbar height
          and pushed every panel below DOWN — users reported "screens
          overlapping / messed up" the moment they installed anything.
          Horizontal scroll keeps the toolbar a fixed single-row
          height; the user pans the strip if it overflows. */}
      <div
        className="flex flex-nowrap gap-1 items-center min-w-0 overflow-x-auto overflow-y-hidden flex-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        data-testid="aac-toolbar-strip"
      >
        {allButtons.map((id) => renderButton(id))}
      </div>

      {/* Language pair selector — input → output. Both buttons use the
          shared LanguageButton/LanguagePicker so the toolbar and the
          chat panels render the picker identically. */}
      <div ref={langRef} className="flex items-center gap-1 relative shrink-0 ml-2">
        <LanguageButton
          lang={language}
          variant="input"
          onClick={() => setShowLangPicker(showLangPicker === 'input' ? null : 'input')}
          ariaLabel="Input language"
        />
        <span className="text-xs text-muted">→</span>
        <LanguageButton
          lang={outputLanguage}
          variant={outputLanguage !== language ? 'output-mismatch' : 'output'}
          onClick={() => setShowLangPicker(showLangPicker === 'output' ? null : 'output')}
          ariaLabel="Output language"
        />
        {showLangPicker && (
          <LanguagePicker
            selected={showLangPicker === 'input' ? language : outputLanguage}
            onSelect={(code) => {
              if (showLangPicker === 'input') {
                const prev = useSettingsStore.getState();
                const sync = prev.language === prev.outputLanguage;
                updateSettings({ language: code, ...(sync ? { outputLanguage: code } : {}) });
              } else {
                updateSettings({ outputLanguage: code });
              }
            }}
            onClose={() => setShowLangPicker(null)}
            anchor="right"
          />
        )}
      </div>

      {/* Sync status indicator — informational only, not a toolbar button. */}
      <span className="text-[8px] text-dim ml-1 shrink-0" title={`Sync: ${syncStatus}`}>{SYNC_ICONS[syncStatus] ?? '⬡'}</span>
    </div>
  );
}
