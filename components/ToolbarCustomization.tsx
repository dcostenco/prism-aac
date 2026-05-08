'use client';
import { useSettingsStore, DEFAULT_TOOLBAR_ORDER, type ToolbarButtonId } from '@/store/settingsStore';
import { tapFeedback } from '@/services/feedback';

// Per-button display metadata. Keep in sync with the icon map in Toolbar.tsx
// — both files are derived from the same conceptual list, but kept separate
// so this Settings component can stay simple (icons + labels only) and the
// Toolbar can wire handlers/state.
const BUILTIN_META: Record<ToolbarButtonId, { icon: string; label: string }> = {
  categories:  { icon: '📂', label: 'Categories' },
  mic:         { icon: '🎙', label: 'Microphone' },
  schedule:    { icon: '📅', label: 'Schedule' },
  marketplace: { icon: '🏪', label: 'Marketplace' },
  alert:       { icon: '🚨', label: 'Emergency Alert' },
  math:        { icon: '🔢', label: 'Math' },
  ai_chat:     { icon: '✨', label: 'AI Chat' },
  aac_chat:    { icon: '💬', label: 'Send Message' },
  notes:       { icon: '📋', label: 'Caregiver Notes' },
  games:       { icon: '🎮', label: 'Games' },
  pdf_reader:  { icon: '📄', label: 'PDF Reader' },
  ocr_capture: { icon: '👁', label: 'Screenshot Reader (OCR)' },
  history:     { icon: '📜', label: 'History' },
  sound:       { icon: '🔊', label: 'Sound Toggle' },
  settings:    { icon: '⚙️', label: 'Settings' },
};

const APP_META: Record<string, { icon: string; label: string }> = {
  'symbol-libraries': { icon: '📚', label: 'Symbol Libraries' },
  'board-templates':  { icon: '📋', label: 'Board Templates' },
  'vocab-my-core':    { icon: '⚡', label: 'My Core Vocabulary' },
  'vocab-wordpower':  { icon: '💪', label: 'WordPower Vocabulary' },
  'vocab-gateway':    { icon: '🚪', label: 'Gateway Vocabulary' },
  'vocab-aphasia':    { icon: '🧠', label: 'Aphasia Vocabulary' },
  'vocab-social-chat':{ icon: '💬', label: 'Social Chat Vocabulary' },
  'game-packs':       { icon: '🎮', label: 'Game Packs' },
  'voice-packs':      { icon: '🎙', label: 'Voice Packs' },
  'picture-editor':   { icon: '🖼', label: 'Picture Editor' },
  'music-composer':   { icon: '🎵', label: 'Music Composer' },
  'aac-designer':     { icon: '🎨', label: 'AAC Designer' },
  'video-composer':   { icon: '🎬', label: 'Video Composer' },
};

export default function ToolbarCustomization() {
  const toolbarConfig = useSettingsStore((s) => s.toolbarConfig);
  const installedApps = useSettingsStore((s) => s.installedApps);
  const toggle = useSettingsStore((s) => s.toolbarToggle);
  const move = useSettingsStore((s) => s.toolbarMove);
  const reset = useSettingsStore((s) => s.toolbarReset);
  const uninstallApp = useSettingsStore((s) => s.uninstallApp);

  // Combine built-ins (in saved order) + installed apps (in saved order),
  // appending any DEFAULT built-ins missing from saved order so newly-added
  // built-ins surface after upgrade.
  const seen = new Set<ToolbarButtonId>();
  const builtIns: ToolbarButtonId[] = [];
  for (const id of toolbarConfig.order) { builtIns.push(id); seen.add(id); }
  for (const id of DEFAULT_TOOLBAR_ORDER) { if (!seen.has(id)) builtIns.push(id); }

  const apps = installedApps.map((a) => `app:${a}`);
  const items = [...builtIns, ...apps];

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <p className="text-muted text-xs">
          Reorder buttons with ↑/↓, toggle visibility, or uninstall marketplace apps.
        </p>
        <button
          className="aac-btn rounded-lg px-3 py-1.5 text-xs surface-key text-primary border border-theme"
          onClick={() => { tapFeedback(); reset(); }}
          aria-label="Reset toolbar to defaults"
        >Reset</button>
      </div>

      <div className="space-y-1">
        {items.map((id, idx) => {
          const isApp = id.startsWith('app:');
          const appId = isApp ? id.slice(4) : null;
          const meta = isApp
            ? (APP_META[appId!] ?? { icon: '🧩', label: appId! })
            : BUILTIN_META[id as ToolbarButtonId];
          const enabled = !isApp ? (toolbarConfig.enabled[id as ToolbarButtonId] !== false) : true;
          const canMoveUp = idx > 0;
          const canMoveDown = idx < items.length - 1;

          return (
            <div
              key={id}
              className="flex items-center gap-2 px-2 py-1.5 rounded-lg surface-key border border-theme"
            >
              <span className="text-xl shrink-0">{meta.icon}</span>
              <span className="flex-1 text-sm text-primary">
                {meta.label}
                {isApp && <span className="ml-2 text-[10px] text-muted">(marketplace)</span>}
                {!enabled && <span className="ml-2 text-[10px] text-[#FF9800]">(hidden)</span>}
              </span>

              <button
                className="aac-btn w-7 h-7 rounded-md surface-bar text-primary text-sm border border-theme disabled:opacity-30"
                onClick={() => { tapFeedback(); move(id, -1); }}
                disabled={!canMoveUp}
                aria-label={`Move ${meta.label} up`}
              >↑</button>
              <button
                className="aac-btn w-7 h-7 rounded-md surface-bar text-primary text-sm border border-theme disabled:opacity-30"
                onClick={() => { tapFeedback(); move(id, 1); }}
                disabled={!canMoveDown}
                aria-label={`Move ${meta.label} down`}
              >↓</button>

              {isApp ? (
                <button
                  className="aac-btn w-7 h-7 rounded-md bg-[#F44336] text-white text-xs"
                  onClick={() => { tapFeedback(); uninstallApp(appId!); }}
                  aria-label={`Uninstall ${meta.label}`}
                  title="Uninstall"
                >×</button>
              ) : id === 'settings' ? (
                <span className="w-12 h-7 flex items-center justify-center text-[10px] text-muted" title="Settings cannot be hidden">🔒</span>
              ) : (
                <button
                  className={`aac-btn w-12 h-7 rounded-full transition-colors ${
                    enabled ? 'bg-[#4CAF50]' : 'bg-[#999]'
                  }`}
                  onClick={() => { tapFeedback(); toggle(id); }}
                  aria-pressed={enabled}
                  aria-label={`${enabled ? 'Hide' : 'Show'} ${meta.label}`}
                >
                  <div className={`w-5 h-5 rounded-full bg-white transition-transform mx-1 ${enabled ? 'translate-x-5' : ''}`} />
                </button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
