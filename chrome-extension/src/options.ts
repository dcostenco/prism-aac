/**
 * options — settings page wiring.
 *
 * Reads/writes via chrome.storage.sync (typed wrapper in storage.ts),
 * fills the voice dropdown from speechSynthesis.getVoices(), and
 * provides a "▶ Test voice" button so the user can hear their picks
 * before going to a real text field.
 */
import { loadSettings, saveSettings, DEFAULT_SETTINGS, type ExtSettings } from './storage';

// 50+ languages Google Translate's gtx endpoint accepts. Listed
// alphabetically by display name; the value is the BCP-47 / Google
// code (which is what gtx wants).
const LANGUAGES: Array<{ code: string; name: string }> = [
  { code: 'ar', name: 'Arabic' },
  { code: 'bn', name: 'Bengali' },
  { code: 'bg', name: 'Bulgarian' },
  { code: 'zh-CN', name: 'Chinese (Simplified)' },
  { code: 'zh-TW', name: 'Chinese (Traditional)' },
  { code: 'hr', name: 'Croatian' },
  { code: 'cs', name: 'Czech' },
  { code: 'da', name: 'Danish' },
  { code: 'nl', name: 'Dutch' },
  { code: 'en', name: 'English' },
  { code: 'et', name: 'Estonian' },
  { code: 'fi', name: 'Finnish' },
  { code: 'fr', name: 'French' },
  { code: 'de', name: 'German' },
  { code: 'el', name: 'Greek' },
  { code: 'gu', name: 'Gujarati' },
  { code: 'he', name: 'Hebrew' },
  { code: 'hi', name: 'Hindi' },
  { code: 'hu', name: 'Hungarian' },
  { code: 'id', name: 'Indonesian' },
  { code: 'it', name: 'Italian' },
  { code: 'ja', name: 'Japanese' },
  { code: 'kn', name: 'Kannada' },
  { code: 'ko', name: 'Korean' },
  { code: 'lv', name: 'Latvian' },
  { code: 'lt', name: 'Lithuanian' },
  { code: 'ms', name: 'Malay' },
  { code: 'ml', name: 'Malayalam' },
  { code: 'mr', name: 'Marathi' },
  { code: 'no', name: 'Norwegian' },
  { code: 'fa', name: 'Persian' },
  { code: 'pl', name: 'Polish' },
  { code: 'pt', name: 'Portuguese' },
  { code: 'pa', name: 'Punjabi' },
  { code: 'ro', name: 'Romanian' },
  { code: 'ru', name: 'Russian' },
  { code: 'sr', name: 'Serbian' },
  { code: 'sk', name: 'Slovak' },
  { code: 'sl', name: 'Slovenian' },
  { code: 'es', name: 'Spanish' },
  { code: 'sv', name: 'Swedish' },
  { code: 'tl', name: 'Tagalog' },
  { code: 'ta', name: 'Tamil' },
  { code: 'te', name: 'Telugu' },
  { code: 'th', name: 'Thai' },
  { code: 'tr', name: 'Turkish' },
  { code: 'uk', name: 'Ukrainian' },
  { code: 'ur', name: 'Urdu' },
  { code: 'vi', name: 'Vietnamese' },
  { code: 'cy', name: 'Welsh' },
];

function $(id: string): HTMLInputElement {
  const el = document.getElementById(id);
  if (!el) throw new Error(`Missing #${id}`);
  return el as HTMLInputElement;
}

function flashSaved(key: string): void {
  const tag = document.querySelector(`[data-saved="${key}"]`);
  if (!tag) return;
  tag.classList.add('show');
  setTimeout(() => tag.classList.remove('show'), 800);
}

function fillVoices(selected: string): void {
  const select = $('voiceURI');
  select.innerHTML = '';
  const voices = window.speechSynthesis.getVoices();
  const optDefault = document.createElement('option');
  optDefault.value = '';
  optDefault.textContent = 'OS default';
  select.append(optDefault);
  // Group by language for readability.
  const sorted = [...voices].sort((a, b) => {
    if (a.lang !== b.lang) return a.lang.localeCompare(b.lang);
    return a.name.localeCompare(b.name);
  });
  for (const v of sorted) {
    const opt = document.createElement('option');
    opt.value = v.voiceURI;
    opt.textContent = `${v.lang} — ${v.name}${v.default ? ' (default)' : ''}`;
    select.append(opt);
  }
  select.value = selected;
}

function bindCheckbox(id: keyof ExtSettings & string, current: boolean): void {
  const el = $(id);
  el.checked = current;
  el.addEventListener('change', async () => {
    await saveSettings({ [id]: el.checked } as Partial<ExtSettings>);
    flashSaved(id);
  });
}

function bindRange(id: 'rate' | 'volume' | 'pitch', current: number): void {
  const el = $(id);
  const numEl = document.getElementById(id + 'Num');
  el.value = String(current);
  if (numEl) numEl.textContent = current.toFixed(2);
  el.addEventListener('input', () => {
    const n = parseFloat(el.value);
    if (numEl) numEl.textContent = n.toFixed(2);
  });
  el.addEventListener('change', async () => {
    const n = parseFloat(el.value);
    await saveSettings({ [id]: n } as Partial<ExtSettings>);
  });
}

(async () => {
  const settings: ExtSettings = await loadSettings();

  bindCheckbox('enabled', settings.enabled);
  bindCheckbox('speakOnSentenceEnd', settings.speakOnSentenceEnd);
  bindCheckbox('speakOnSpace', settings.speakOnSpace);
  bindCheckbox('showOverlay', settings.showOverlay);

  bindRange('rate', settings.rate);
  bindRange('volume', settings.volume);
  bindRange('pitch', settings.pitch);

  // Voices load asynchronously in some browsers — re-fill when the
  // voiceschanged event fires.
  fillVoices(settings.voiceURI);
  window.speechSynthesis.addEventListener('voiceschanged', () => fillVoices($('voiceURI').value));
  $('voiceURI').addEventListener('change', async () => {
    await saveSettings({ voiceURI: $('voiceURI').value });
  });

  // Translate-while-speaking pickers.
  const sourceLang = $('sourceLanguage');
  const targetLang = $('targetLanguage');
  for (const { code, name } of LANGUAGES) {
    const o1 = document.createElement('option');
    o1.value = code; o1.textContent = `${name} (${code})`;
    sourceLang.append(o1);
    const o2 = document.createElement('option');
    o2.value = code; o2.textContent = `${name} (${code})`;
    targetLang.append(o2);
  }
  sourceLang.value = settings.sourceLanguage;
  targetLang.value = settings.targetLanguage;
  sourceLang.addEventListener('change', async () => {
    await saveSettings({ sourceLanguage: sourceLang.value });
  });
  targetLang.addEventListener('change', async () => {
    await saveSettings({ targetLanguage: targetLang.value });
  });

  const blocked = document.getElementById('blockedDomains') as HTMLTextAreaElement;
  blocked.value = settings.blockedDomains.join('\n');
  blocked.addEventListener('change', async () => {
    const domains = blocked.value
      .split('\n')
      .map((l) => l.trim())
      .filter((l) => l && !/^#/.test(l));
    await saveSettings({ blockedDomains: domains });
  });

  document.getElementById('testVoice')?.addEventListener('click', () => {
    const u = new SpeechSynthesisUtterance(
      'Hello! This is the PrismAAC reading assistant. Type a sentence and I will speak it back.',
    );
    u.rate = parseFloat($('rate').value);
    u.volume = parseFloat($('volume').value);
    u.pitch = parseFloat($('pitch').value);
    const uri = $('voiceURI').value;
    if (uri) {
      const v = window.speechSynthesis.getVoices().find((vv) => vv.voiceURI === uri);
      if (v) u.voice = v;
    }
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(u);
  });

  // First-run sanity log so the user can confirm they're on a fresh
  // install vs upgraded settings.
  const isFresh = JSON.stringify(settings) === JSON.stringify(DEFAULT_SETTINGS);
  if (isFresh) {
    console.info('[prism-aac-ext] Settings are at defaults — first run.');
  }
})();
