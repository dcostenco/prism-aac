/**
 * overlay — floating UI rendered next to a focused text field.
 *
 * Hosts:
 *   • A Speak button (▶) that reads the field's current value
 *   • A status row that lights up the active word during TTS
 *
 * The overlay lives inside an open Shadow DOM root so the host page's
 * CSS can't clobber its layout. Position is computed from the focused
 * element's bounding rect; the overlay is anchored above the field
 * (or below, if there's not enough space above).
 *
 * Word highlight: during a speak() call the onWord callback updates
 * the highlight span. We render the spoken text inside the overlay
 * (NOT inside the host's input — mutating contentEditable risks
 * cursor jumps and framework re-renders), so the user reads along
 * inside the floating bar instead of the field itself.
 */
import type { ExtSettings } from './storage';
import { speak, cancelSpeech, type SpeakHandle } from './speak';
import { translate, pickVoiceForLang } from './translate';

const HOST_ID = 'prism-aac-ext-host';

interface OverlayInternals {
  host: HTMLElement;
  shadow: ShadowRoot;
  bar: HTMLElement;
  titleEl: HTMLElement;
  sourceLine: HTMLElement;
  statusLine: HTMLElement;
  speakBtn: HTMLButtonElement;
  pinBtn: HTMLButtonElement;
  closeBtn: HTMLButtonElement;
  /** Pin = stay visible even after focus moves elsewhere. */
  pinned: boolean;
  /** Currently anchored field, if any. */
  anchor: HTMLElement | null;
  /** In-flight speak handle (so a second tap cancels the first). */
  speaking: SpeakHandle | null;
}

let inst: OverlayInternals | null = null;

function ensureOverlay(): OverlayInternals {
  if (inst) return inst;
  const host = document.createElement('div');
  host.id = HOST_ID;
  host.style.position = 'fixed';
  host.style.top = '0';
  host.style.left = '0';
  host.style.zIndex = '2147483647';
  host.style.pointerEvents = 'none';
  host.setAttribute('data-prism-aac-ext', '1');
  host.setAttribute('aria-hidden', 'false');
  document.documentElement.appendChild(host);

  const shadow = host.attachShadow({ mode: 'open' });
  shadow.innerHTML = `
    <style>
      :host, .bar, button, span { all: initial; box-sizing: border-box; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", sans-serif; }
      .bar {
        position: absolute;
        display: none;
        flex-direction: column;
        gap: 4px;
        min-width: 280px;
        max-width: 480px;
        padding: 8px;
        background: rgba(255, 255, 255, 0.98);
        color: #1a1a1a;
        border: 1px solid rgba(0, 0, 0, 0.15);
        border-radius: 10px;
        box-shadow: 0 6px 20px rgba(0, 0, 0, 0.18);
        font-size: 14px;
        line-height: 1.4;
        pointer-events: auto;
      }
      .bar[data-visible="1"] { display: flex; }
      @media (prefers-color-scheme: dark) {
        .bar {
          background: rgba(28, 28, 30, 0.98);
          color: #f5f5f5;
          border-color: rgba(255, 255, 255, 0.18);
        }
      }
      .row { display: flex; align-items: center; gap: 6px; }
      .title { flex: 1; font-weight: 600; font-size: 12px; opacity: 0.7; }
      button {
        cursor: pointer;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        min-width: 32px;
        height: 30px;
        padding: 0 10px;
        border-radius: 6px;
        border: 1px solid transparent;
        background: #4caf50;
        color: white;
        font-weight: 600;
        font-size: 13px;
        user-select: none;
      }
      button:hover { filter: brightness(1.1); }
      button.secondary { background: transparent; color: inherit; border-color: rgba(0, 0, 0, 0.2); }
      @media (prefers-color-scheme: dark) {
        button.secondary { border-color: rgba(255, 255, 255, 0.25); }
      }
      .source {
        display: none;
        font-size: 12px;
        line-height: 1.4;
        opacity: 0.65;
        font-style: italic;
        max-height: 3em;
        overflow-y: auto;
        word-break: break-word;
        padding-bottom: 4px;
        border-bottom: 1px dashed rgba(0,0,0,0.12);
      }
      @media (prefers-color-scheme: dark) {
        .source { border-bottom-color: rgba(255,255,255,0.18); }
      }
      .source[data-visible="1"] { display: block; }
      .status {
        font-size: 14px;
        line-height: 1.5;
        max-height: 6em;
        overflow-y: auto;
        word-break: break-word;
      }
      .status .w { padding: 0 1px; border-radius: 3px; transition: background-color 90ms ease-out; }
      .status .w.active {
        background: rgba(255, 235, 59, 0.7);
        box-shadow: 0 0 0 1px rgba(255, 193, 7, 0.85);
      }
    </style>
    <div class="bar" role="region" aria-label="PrismAAC reading assistant" data-testid="prism-aac-ext-bar">
      <div class="row">
        <span class="title" data-testid="prism-aac-ext-title">📣 PrismAAC</span>
        <button class="speak" data-testid="prism-aac-ext-speak" title="Read this field aloud">▶ Speak</button>
        <button class="pin secondary" data-testid="prism-aac-ext-pin" title="Pin (stay open)">📌</button>
        <button class="close secondary" data-testid="prism-aac-ext-close" title="Hide">×</button>
      </div>
      <div class="source" data-testid="prism-aac-ext-source"></div>
      <div class="status" data-testid="prism-aac-ext-status"></div>
    </div>
  `;

  const bar = shadow.querySelector('.bar') as HTMLElement;
  const titleEl = shadow.querySelector('.title') as HTMLElement;
  const sourceLine = shadow.querySelector('.source') as HTMLElement;
  const statusLine = shadow.querySelector('.status') as HTMLElement;
  const speakBtn = shadow.querySelector('.speak') as HTMLButtonElement;
  const pinBtn = shadow.querySelector('.pin') as HTMLButtonElement;
  const closeBtn = shadow.querySelector('.close') as HTMLButtonElement;

  inst = {
    host, shadow, bar, titleEl, sourceLine, statusLine, speakBtn, pinBtn, closeBtn,
    pinned: false, anchor: null, speaking: null,
  };
  return inst;
}

/** Disposes the overlay entirely (used when the extension is disabled
 *  via settings). Safe to call when not yet mounted. */
export function unmountOverlay(): void {
  if (!inst) return;
  cancelSpeech();
  inst.host.remove();
  inst = null;
}

/** Position the bar above (or below) the anchor field. */
function positionBar(self: OverlayInternals) {
  if (!self.anchor) return;
  const rect = self.anchor.getBoundingClientRect();
  const barRect = self.bar.getBoundingClientRect();
  const margin = 6;
  const aboveTop = rect.top - barRect.height - margin;
  const belowTop = rect.bottom + margin;
  const useAbove = aboveTop > 8;
  self.bar.style.top = `${useAbove ? aboveTop : belowTop}px`;
  // Horizontally clamp into the viewport.
  const left = Math.max(8, Math.min(rect.left, window.innerWidth - barRect.width - 8));
  self.bar.style.left = `${left}px`;
}

/** Render the spoken text into the status line as one span per word
 *  so we can highlight the active word during TTS. */
function renderStatusWords(self: OverlayInternals, text: string): void {
  self.statusLine.replaceChildren();
  const words = text.match(/\S+|\s+/g) ?? [];
  for (const tok of words) {
    if (/\s+/.test(tok)) {
      self.statusLine.append(document.createTextNode(tok));
    } else {
      const span = document.createElement('span');
      span.className = 'w';
      span.textContent = tok;
      self.statusLine.append(span);
    }
  }
}

function setActiveWord(self: OverlayInternals, idx: number): void {
  const spans = self.statusLine.querySelectorAll<HTMLSpanElement>('.w');
  spans.forEach((s, i) => {
    if (i === idx) s.classList.add('active');
    else s.classList.remove('active');
  });
  // Scroll the active word into view inside the status line.
  const active = spans[idx];
  if (active && active.scrollIntoView) {
    active.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  }
}

function clearActiveWord(self: OverlayInternals): void {
  const spans = self.statusLine.querySelectorAll<HTMLSpanElement>('.w');
  spans.forEach((s) => s.classList.remove('active'));
}

/** Speak the value of the currently anchored field — used by both the
 *  Speak button click and the sentence-end auto-trigger.
 *
 *  When settings.targetLanguage is set, this:
 *    1. Hits Google Translate's free gtx endpoint to translate the
 *       source text into the target language.
 *    2. Renders BOTH the source (small italic line) and the
 *       translation (full size, with word highlight) in the overlay.
 *    3. Picks a Web Speech voice matching the target language so the
 *       translation is read aloud with the right phonemes.
 *
 *  When targetLanguage is empty (default), it just renders + speaks
 *  the source text — no network call. */
export async function speakAnchorValue(settings: ExtSettings, textOverride?: string): Promise<void> {
  const self = ensureOverlay();
  const sourceText = textOverride ?? readFieldValue(self.anchor);
  if (!sourceText || !sourceText.trim()) return;
  if (self.speaking) self.speaking.cancel();

  let spokenText = sourceText;
  let voiceOverride: SpeechSynthesisVoice | null = null;
  let langOverride: string | undefined;

  if (settings.targetLanguage) {
    // Show "Translating…" so the user sees something is happening
    // during the network roundtrip.
    self.sourceLine.textContent = sourceText;
    self.sourceLine.dataset.visible = '1';
    self.statusLine.replaceChildren(document.createTextNode('Translating…'));
    try {
      spokenText = await translate(sourceText, settings.sourceLanguage || 'auto', settings.targetLanguage);
    } catch {
      spokenText = sourceText;
    }
    voiceOverride = pickVoiceForLang(settings.targetLanguage);
    langOverride = settings.targetLanguage;
  } else {
    self.sourceLine.textContent = '';
    self.sourceLine.dataset.visible = '0';
  }

  renderStatusWords(self, spokenText);
  self.speaking = speak(spokenText, settings, {
    onWord: (idx) => setActiveWord(self, idx),
    onEnd: () => { self.speaking = null; clearActiveWord(self); },
    onError: () => { self.speaking = null; clearActiveWord(self); },
    voiceOverride,
    langOverride,
  });
}

/** Read the current text content of the focused field (input,
 *  textarea, or contenteditable). Returns '' for unsupported elements. */
function readFieldValue(el: HTMLElement | null): string {
  if (!el) return '';
  const tag = el.tagName.toLowerCase();
  if (tag === 'input' || tag === 'textarea') {
    return (el as HTMLInputElement | HTMLTextAreaElement).value || '';
  }
  if (el.isContentEditable) {
    return el.textContent || '';
  }
  return '';
}

/** Attach the overlay to a focused field. Idempotent: re-anchoring on
 *  the same field is a no-op. */
export function attachOverlay(field: HTMLElement, settings: ExtSettings): void {
  if (!settings.showOverlay) return;
  const self = ensureOverlay();
  self.anchor = field;
  self.bar.dataset.visible = '1';
  positionBar(self);
}

/** Hide the overlay if not pinned. Called on focusout / Esc. */
export function maybeDetachOverlay(): void {
  if (!inst) return;
  if (inst.pinned) return;
  if (inst.speaking) return; // don't hide mid-speech
  inst.bar.dataset.visible = '0';
  inst.anchor = null;
  clearActiveWord(inst);
  inst.statusLine.replaceChildren();
  inst.sourceLine.textContent = '';
  inst.sourceLine.dataset.visible = '0';
}

/** Wire the bar's button click handlers. Call once on init. */
export function bindOverlayHandlers(getSettings: () => ExtSettings): void {
  const self = ensureOverlay();
  self.speakBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    void speakAnchorValue(getSettings());
  });
  self.pinBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    self.pinned = !self.pinned;
    self.pinBtn.style.background = self.pinned ? '#ff9800' : 'transparent';
    self.pinBtn.style.color = self.pinned ? 'white' : '';
    self.pinBtn.title = self.pinned ? 'Unpin' : 'Pin (stay open)';
  });
  self.closeBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    self.pinned = false;
    cancelSpeech();
    if (self.speaking) self.speaking.cancel();
    self.speaking = null;
    maybeDetachOverlay();
  });

  // Reposition on viewport resize / scroll while anchored.
  const reposition = () => { if (self.anchor) positionBar(self); };
  window.addEventListener('resize', reposition);
  window.addEventListener('scroll', reposition, true);
}

/** Test-only access — visible for unit tests, never for production. */
export const __testing = { renderStatusWords, charIndexToWordIndex_indirect: (text: string, idx: number) => {
  // Mirrored for tests; the real one is in speak.ts (not exported).
  const m = text.slice(0, idx).match(/\S+/g);
  return m ? m.length : 0;
}};
