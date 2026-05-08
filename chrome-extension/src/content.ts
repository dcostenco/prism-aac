/**
 * content — main injected script.
 *
 * Lifecycle:
 *   1. Load settings (chrome.storage.sync) and check whether the
 *      extension is enabled for this domain.
 *   2. Attach a global focusin listener that anchors the overlay to
 *      the focused text field (input, textarea, contenteditable).
 *   3. On every input event, check whether the user just typed a
 *      sentence-end terminator; if speakOnSentenceEnd is on, speak
 *      the just-completed sentence.
 *   4. Cmd/Ctrl+Shift+S = "speak this field now" anywhere on the page.
 *   5. Re-evaluate enable + per-domain block on every settings change.
 */
import { loadSettings, subscribeSettings, isBlockedDomain, type ExtSettings } from './storage';
import { attachOverlay, bindOverlayHandlers, maybeDetachOverlay, speakAnchorValue, unmountOverlay } from './overlay';
import { extractLastSentence } from './extractLastSentence';
import { cancelSpeech } from './speak';

const SENTENCE_END = /[.?!]/;

let settings: ExtSettings | null = null;
let initialized = false;
let prevValueByField = new WeakMap<HTMLElement, string>();

function isTextField(el: EventTarget | null): el is HTMLElement {
  if (!(el instanceof HTMLElement)) return false;
  const tag = el.tagName.toLowerCase();
  if (tag === 'input') {
    const type = (el as HTMLInputElement).type.toLowerCase();
    // Skip checkbox / radio / button-shaped inputs.
    return ['text', 'search', 'email', 'url', 'tel', 'password', ''].includes(type) || type === 'textarea';
  }
  return tag === 'textarea' || el.isContentEditable;
}

function fieldValue(el: HTMLElement): string {
  const tag = el.tagName.toLowerCase();
  if (tag === 'input' || tag === 'textarea') {
    return (el as HTMLInputElement | HTMLTextAreaElement).value || '';
  }
  if (el.isContentEditable) return el.textContent || '';
  return '';
}

function onFocusIn(ev: FocusEvent): void {
  if (!settings || !settings.enabled) return;
  if (!isTextField(ev.target)) return;
  const field = ev.target as HTMLElement;
  prevValueByField.set(field, fieldValue(field));
  attachOverlay(field, settings);
}

function onFocusOut(): void {
  // Defer so a click on the overlay button doesn't immediately tear
  // it down before its handler runs.
  setTimeout(() => maybeDetachOverlay(), 150);
}

function onInput(ev: Event): void {
  if (!settings || !settings.enabled) return;
  if (!isTextField(ev.target)) return;
  const field = ev.target as HTMLElement;
  const val = fieldValue(field);
  const prev = prevValueByField.get(field) ?? '';
  prevValueByField.set(field, val);
  if (val.length <= prev.length) return; // backspace / paste-shrink — ignore

  const newChar = val.slice(prev.length, prev.length + 1) || val.slice(-1);
  if (settings.speakOnSpace && /\s/.test(newChar)) {
    const tokens = val.trim().split(/\s+/);
    const lastWord = tokens[tokens.length - 1] || '';
    if (lastWord) void speakAnchorValue(settings, lastWord);
    return;
  }
  if (settings.speakOnSentenceEnd && SENTENCE_END.test(newChar)) {
    const sentence = extractLastSentence(val);
    if (sentence) void speakAnchorValue(settings, sentence);
  }
}

function onKeyDown(ev: KeyboardEvent): void {
  // Cmd/Ctrl + Shift + S = "speak this field now". Lets the user
  // re-trigger speech without leaving the keyboard.
  if (!settings || !settings.enabled) return;
  if ((ev.metaKey || ev.ctrlKey) && ev.shiftKey && ev.key.toLowerCase() === 's') {
    ev.preventDefault();
    void speakAnchorValue(settings);
  }
  // Esc cancels speech and hides the overlay.
  if (ev.key === 'Escape') {
    cancelSpeech();
    maybeDetachOverlay();
  }
}

function init(s: ExtSettings): void {
  settings = s;
  // Check domain block first — if blocked, tear everything down.
  if (!s.enabled || isBlockedDomain(window.location.hostname, s.blockedDomains)) {
    if (initialized) {
      document.removeEventListener('focusin', onFocusIn, true);
      document.removeEventListener('focusout', onFocusOut, true);
      document.removeEventListener('input', onInput, true);
      document.removeEventListener('keydown', onKeyDown, true);
      unmountOverlay();
      initialized = false;
    }
    return;
  }
  if (initialized) return;
  bindOverlayHandlers(() => settings ?? s);
  document.addEventListener('focusin', onFocusIn, true);
  document.addEventListener('focusout', onFocusOut, true);
  document.addEventListener('input', onInput, true);
  document.addEventListener('keydown', onKeyDown, true);
  initialized = true;
}

(async () => {
  // Don't inject inside the extension's own iframes.
  if (window.location.protocol === 'chrome-extension:') return;
  const initial = await loadSettings();
  init(initial);
  subscribeSettings((next) => init(next));
})();
