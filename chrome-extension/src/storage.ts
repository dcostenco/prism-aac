/**
 * storage — typed wrapper over chrome.storage.sync.
 *
 * Settings live in chrome.storage.sync so they ride with the user's
 * Chrome profile across devices (no PrismAAC account required). All
 * keys are scoped under `prism-aac-ext.` to avoid collisions with
 * other extensions sharing the same namespace.
 */

export interface ExtSettings {
  /** Master enable for the per-page reading assistant. Default true. */
  enabled: boolean;
  /** Speak the just-completed sentence on .?!. Default true — this is
   *  the dealbreaker feature for the user persona. */
  speakOnSentenceEnd: boolean;
  /** Speak each completed word on space. Default false (less common
   *  ask, can be noisy). */
  speakOnSpace: boolean;
  /** Show the floating overlay above focused fields. When false the
   *  user opts into a quieter mode (Speak still works via shortcut). */
  showOverlay: boolean;
  /** Web Speech API rate (0.1..10, default 1.0). */
  rate: number;
  /** Web Speech API volume (0..1, default 1.0). */
  volume: number;
  /** Web Speech API pitch (0..2, default 1.0). */
  pitch: number;
  /** Voice URI from speechSynthesis.getVoices(); empty = OS default. */
  voiceURI: string;
  /** Translate-and-speak target language (BCP-47 like 'es', 'fr', 'ro').
   *  Empty = no translation, speak the source text. When set, the
   *  extension hits Google Translate's free gtx endpoint, then speaks
   *  the translated string with a voice matching this language. */
  targetLanguage: string;
  /** Source language hint for the translator. 'auto' = let the
   *  translator detect; matches the dropdown's "Auto-detect" option. */
  sourceLanguage: string;
  /** Domains where the extension is disabled. Lowercase, no scheme. */
  blockedDomains: string[];
}

export const DEFAULT_SETTINGS: ExtSettings = {
  enabled: true,
  speakOnSentenceEnd: true,
  speakOnSpace: false,
  showOverlay: true,
  rate: 1.0,
  volume: 1.0,
  pitch: 1.0,
  voiceURI: '',
  targetLanguage: '',
  sourceLanguage: 'auto',
  blockedDomains: [],
};

const STORAGE_KEY = 'prism-aac-ext.settings';

export async function loadSettings(): Promise<ExtSettings> {
  try {
    const got = await chrome.storage.sync.get(STORAGE_KEY);
    const stored = got[STORAGE_KEY];
    if (!stored || typeof stored !== 'object') return { ...DEFAULT_SETTINGS };
    return { ...DEFAULT_SETTINGS, ...stored };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

export async function saveSettings(s: Partial<ExtSettings>): Promise<void> {
  const current = await loadSettings();
  const merged = { ...current, ...s };
  await chrome.storage.sync.set({ [STORAGE_KEY]: merged });
}

/** Subscribe to settings changes — cleanup with the returned function. */
export function subscribeSettings(
  fn: (s: ExtSettings) => void,
): () => void {
  const handler = (changes: { [key: string]: chrome.storage.StorageChange }) => {
    if (!(STORAGE_KEY in changes)) return;
    const newValue = changes[STORAGE_KEY].newValue;
    if (newValue && typeof newValue === 'object') {
      fn({ ...DEFAULT_SETTINGS, ...newValue });
    }
  };
  chrome.storage.onChanged.addListener(handler);
  return () => chrome.storage.onChanged.removeListener(handler);
}

/** True if the current page's hostname is on the blocked list. */
export function isBlockedDomain(hostname: string, blocked: string[]): boolean {
  const h = hostname.toLowerCase().replace(/^www\./, '');
  return blocked.some((d) => h === d.toLowerCase() || h.endsWith('.' + d.toLowerCase()));
}
