'use client';

/* ─────────────────────────────────────────────────────────────────────────────
 *  Morse Code Input Service for PrismAAC
 *
 *  Enables full text input for children with severe motor disabilities who
 *  can only produce ONE binary signal — a single switch press, a blink, a
 *  head nod, or a tap anywhere on screen. Morse code maps the entire
 *  alphabet, digits, and common punctuation onto sequences of short (dot)
 *  and long (dash) presses, giving these users complete text generation
 *  capability with minimal motor demand.
 *
 *  Input timing:
 *    Short press (< dotThresholdMs)    → dot  (·)
 *    Long press  (≥ dotThresholdMs)    → dash (—)
 *    Pause > charGapMs                 → commit current Morse → character
 *    Pause > wordGapMs                 → commit + insert word boundary
 *
 *  Error correction:
 *    8 consecutive dots (prosign HH)   → delete last character
 *
 *  Input sources:
 *    • Keyboard: any key (keydown/keyup timing)
 *    • Switch: external callback (signalDown / signalUp)
 *    • Touch: tap anywhere on document (touchstart/touchend)
 *
 *  Audio feedback:
 *    Short tone for dot, longer tone for dash — via Web Audio API so the
 *    user gets immediate auditory confirmation of what they entered.
 *
 *  Auto-complete:
 *    After each committed character, the service predicts likely next words
 *    from a built-in frequency-ranked English word list.
 * ────────────────────────────────────────────────────────────────────────── */

// ── Public Types ────────────────────────────────────────────────────────────

export type MorseSymbol = 'dot' | 'dash';

export interface MorseConfig {
  dotThresholdMs: number;   // max press duration for dot (default 300)
  charGapMs: number;        // silence before committing character (default 600)
  wordGapMs: number;        // silence before word boundary (default 1500)
  audioFeedback: boolean;   // play tones on dot/dash
  toneHz: number;           // frequency for feedback tones (default 600)
}

export interface MorseCallbacks {
  /** Fires immediately when a dot or dash is registered. */
  onSymbol?: (symbol: MorseSymbol, pending: string) => void;
  /** Fires when a complete character is decoded from the Morse buffer. */
  onCharacter?: (char: string, fullText: string) => void;
  /** Fires when a word boundary (space) is detected. */
  onWord?: (word: string, fullText: string) => void;
  /** Fires when auto-complete suggestions update. */
  onSuggestions?: (suggestions: string[]) => void;
  /** Fires when a character is deleted via the error-correction prosign. */
  onDelete?: (fullText: string) => void;
}

export interface MorseState {
  /** true when the service is actively listening for input */
  active: boolean;
  /** Current uncommitted Morse symbols (dots/dashes) */
  pendingSymbols: string;
  /** Full text built so far */
  text: string;
  /** Current word being typed */
  currentWord: string;
  /** Whether the signal is currently held down */
  signalDown: boolean;
}

// ── Constants ───────────────────────────────────────────────────────────────

const STORAGE_KEY = 'prism-morse-config';

const DEFAULT_CONFIG: MorseConfig = {
  dotThresholdMs: 300,
  charGapMs: 600,
  wordGapMs: 1500,
  audioFeedback: true,
  toneHz: 600,
};

/** 8 dots = HH prosign = error/delete */
const DELETE_PROSIGN = '........';

// ── Standard International Morse Code ───────────────────────────────────────

const MORSE_TO_CHAR: Record<string, string> = {
  // Letters
  '.-':     'A',
  '-...':   'B',
  '-.-.':   'C',
  '-..':    'D',
  '.':      'E',
  '..-.':   'F',
  '--.':    'G',
  '....':   'H',
  '..':     'I',
  '.---':   'J',
  '-.-':    'K',
  '.-..':   'L',
  '--':     'M',
  '-.':     'N',
  '---':    'O',
  '.--.':   'P',
  '--.-':   'Q',
  '.-.':    'R',
  '...':    'S',
  '-':      'T',
  '..-':    'U',
  '...-':   'V',
  '.--':    'W',
  '-..-':   'X',
  '-.--':   'Y',
  '--..':   'Z',

  // Digits
  '-----':  '0',
  '.----':  '1',
  '..---':  '2',
  '...--':  '3',
  '....-':  '4',
  '.....':  '5',
  '-....':  '6',
  '--...':  '7',
  '---..':  '8',
  '----.':  '9',

  // Punctuation
  '.-.-.-': '.',
  '--..--': ',',
  '..--..': '?',
  '.----.': "'",
  '-.-.--': '!',
  '-..-.':  '/',
  '-.--.':  '(',
  '-.--.-': ')',
  '.-...':  '&',
  '---...': ':',
  '-.-.-.': ';',
  '-...-':  '=',
  '.-.-.':  '+',
  '-....-': '-',
  '..--.-': '_',
  '.-..-.': '"',
  '...-..-': '$',
  '.--.-.': '@',
};

// ── Frequency-Ranked Common Words for Auto-Complete ─────────────────────────
//    Kept small and AAC-focused: high-frequency words a child would use.

const COMMON_WORDS: string[] = [
  'the', 'I', 'a', 'to', 'is', 'it', 'in', 'my', 'me', 'no', 'yes',
  'want', 'go', 'help', 'please', 'more', 'eat', 'drink', 'play', 'stop',
  'mom', 'dad', 'love', 'happy', 'sad', 'hurt', 'need', 'like', 'not',
  'and', 'you', 'he', 'she', 'we', 'they', 'this', 'that', 'what',
  'where', 'when', 'why', 'how', 'can', 'do', 'have', 'good', 'bad',
  'big', 'small', 'up', 'down', 'in', 'out', 'on', 'off', 'hot', 'cold',
  'water', 'food', 'home', 'school', 'bathroom', 'bed', 'book', 'toy',
  'outside', 'inside', 'again', 'all', 'done', 'thank', 'sorry', 'hello',
  'bye', 'come', 'look', 'see', 'hear', 'feel', 'think', 'know', 'say',
  'tell', 'give', 'take', 'put', 'get', 'make', 'open', 'close', 'turn',
  'wait', 'sit', 'stand', 'walk', 'run', 'sleep', 'wake', 'read', 'write',
  'draw', 'sing', 'dance', 'music', 'movie', 'game', 'friend', 'teacher',
  'brother', 'sister', 'baby', 'dog', 'cat', 'car', 'bus', 'park',
  'doctor', 'sick', 'medicine', 'pain', 'tired', 'hungry', 'thirsty',
  'scared', 'angry', 'excited', 'favorite', 'different', 'same', 'new',
  'old', 'here', 'there', 'now', 'later', 'today', 'tomorrow', 'yesterday',
];

// ── Configuration Persistence ───────────────────────────────────────────────

export function getMorseConfig(): MorseConfig {
  if (typeof window === 'undefined') return { ...DEFAULT_CONFIG };
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<MorseConfig>;
      return { ...DEFAULT_CONFIG, ...parsed };
    }
  } catch { /* corrupt data — use defaults */ }
  return { ...DEFAULT_CONFIG };
}

export function saveMorseConfig(config: MorseConfig): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
  } catch { /* localStorage quota or disabled */ }
}

// ── Audio Feedback ──────────────────────────────────────────────────────────

let audioCtx: AudioContext | null = null;

function getAudioCtx(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  if (!audioCtx) {
    try { audioCtx = new AudioContext(); } catch { return null; }
  }
  if (audioCtx && audioCtx.state === 'suspended') {
    audioCtx.resume();
  }
  return audioCtx;
}

/**
 * Play a feedback tone. Dot = short beep (60ms), Dash = long beep (180ms).
 * Frequency is configurable via MorseConfig.toneHz.
 */
function playMorseTone(symbol: MorseSymbol, hz: number): void {
  const ctx = getAudioCtx();
  if (!ctx) return;

  const durationSec = symbol === 'dot' ? 0.06 : 0.18;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();

  osc.connect(gain);
  gain.connect(ctx.destination);

  osc.frequency.value = hz;
  osc.type = 'sine';

  gain.gain.setValueAtTime(0.12, ctx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + durationSec);

  osc.start(ctx.currentTime);
  osc.stop(ctx.currentTime + durationSec);

  // Clean up audio graph nodes once playback finishes
  osc.onended = () => { osc.disconnect(); gain.disconnect(); };
}

/** Short confirmation beep when a character is successfully decoded. */
function playCharConfirmTone(hz: number): void {
  const ctx = getAudioCtx();
  if (!ctx) return;

  const osc = ctx.createOscillator();
  const gain = ctx.createGain();

  osc.connect(gain);
  gain.connect(ctx.destination);

  osc.frequency.value = hz * 1.5; // higher pitch for distinction
  osc.type = 'sine';

  gain.gain.setValueAtTime(0.06, ctx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.04);

  osc.start(ctx.currentTime);
  osc.stop(ctx.currentTime + 0.04);

  osc.onended = () => { osc.disconnect(); gain.disconnect(); };
}

/** Low tone for delete confirmation. */
function playDeleteTone(hz: number): void {
  const ctx = getAudioCtx();
  if (!ctx) return;

  const osc = ctx.createOscillator();
  const gain = ctx.createGain();

  osc.connect(gain);
  gain.connect(ctx.destination);

  osc.frequency.value = hz * 0.5; // lower pitch for delete
  osc.type = 'triangle';

  gain.gain.setValueAtTime(0.08, ctx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.1);

  osc.start(ctx.currentTime);
  osc.stop(ctx.currentTime + 0.1);

  osc.onended = () => { osc.disconnect(); gain.disconnect(); };
}

// ── Auto-Complete ───────────────────────────────────────────────────────────

/**
 * Given a partial word prefix, return up to 5 likely completions
 * from the built-in AAC word list.
 */
function getSuggestions(prefix: string): string[] {
  if (!prefix || prefix.length === 0) return [];

  const lower = prefix.toLowerCase();
  const matches: string[] = [];

  for (const word of COMMON_WORDS) {
    if (word.toLowerCase().startsWith(lower) && word.toLowerCase() !== lower) {
      matches.push(word);
      if (matches.length >= 5) break;
    }
  }

  return matches;
}

// ── Morse Decode ────────────────────────────────────────────────────────────

function decodeMorse(symbols: string): string | null {
  return MORSE_TO_CHAR[symbols] ?? null;
}

// ── Core Engine State ───────────────────────────────────────────────────────

let active = false;
let config: MorseConfig = { ...DEFAULT_CONFIG };
let callbacks: MorseCallbacks = {};

// Timing state
let pressStartTime = 0;
let isDown = false;

// Symbol buffer (dots and dashes for current character)
let symbolBuffer = '';

// Text accumulation
let fullText = '';
let currentWord = '';

// Timers for gap detection
let charGapTimer: ReturnType<typeof setTimeout> | null = null;
let wordGapTimer: ReturnType<typeof setTimeout> | null = null;

// ── Gap Timer Management ────────────────────────────────────────────────────

function clearGapTimers(): void {
  if (charGapTimer !== null) {
    clearTimeout(charGapTimer);
    charGapTimer = null;
  }
  if (wordGapTimer !== null) {
    clearTimeout(wordGapTimer);
    wordGapTimer = null;
  }
}

function startGapTimers(): void {
  clearGapTimers();

  if (symbolBuffer.length === 0) return;

  // Character gap timer: after charGapMs of silence, commit the character
  charGapTimer = setTimeout(() => {
    commitCharacter();
  }, config.charGapMs);

  // Word gap timer: after wordGapMs of silence, also insert a space
  wordGapTimer = setTimeout(() => {
    commitWordBoundary();
  }, config.wordGapMs);
}

// ── Character / Word Commit ─────────────────────────────────────────────────

function commitCharacter(): void {
  if (symbolBuffer.length === 0) return;

  // Clear the character gap timer (word gap timer may still be pending)
  if (charGapTimer !== null) {
    clearTimeout(charGapTimer);
    charGapTimer = null;
  }

  // Check for delete prosign (8 dots)
  if (symbolBuffer === DELETE_PROSIGN || symbolBuffer.length >= 8 && !symbolBuffer.includes('-')) {
    handleDelete();
    symbolBuffer = '';
    return;
  }

  const decoded = decodeMorse(symbolBuffer);
  symbolBuffer = '';

  if (decoded === null) {
    // Unrecognized Morse sequence — discard silently
    return;
  }

  fullText += decoded;
  currentWord += decoded;

  if (config.audioFeedback) {
    playCharConfirmTone(config.toneHz);
  }

  callbacks.onCharacter?.(decoded, fullText);

  // Fire auto-complete suggestions based on current partial word
  const suggestions = getSuggestions(currentWord);
  callbacks.onSuggestions?.(suggestions);
}

function commitWordBoundary(): void {
  clearGapTimers();

  // If there are pending symbols, commit the character first
  if (symbolBuffer.length > 0) {
    commitCharacter();
  }

  // Only insert a space if we have text and it doesn't already end with a space
  if (fullText.length > 0 && !fullText.endsWith(' ')) {
    const completedWord = currentWord;
    fullText += ' ';
    currentWord = '';

    callbacks.onWord?.(completedWord, fullText);
    callbacks.onSuggestions?.([]);
  }
}

function handleDelete(): void {
  if (fullText.length === 0) return;

  // If current word has characters, remove the last one
  if (currentWord.length > 0) {
    currentWord = currentWord.slice(0, -1);
    fullText = fullText.slice(0, -1);
  } else {
    // We're at a word boundary — remove the trailing space and
    // reconstruct currentWord from remaining text
    fullText = fullText.trimEnd();
    if (fullText.length > 0) {
      fullText = fullText.slice(0, -1); // remove last char
    }
    const lastSpaceIdx = fullText.lastIndexOf(' ');
    currentWord = lastSpaceIdx >= 0 ? fullText.slice(lastSpaceIdx + 1) : fullText;
  }

  if (config.audioFeedback) {
    playDeleteTone(config.toneHz);
  }

  callbacks.onDelete?.(fullText);

  // Update suggestions for the new state
  const suggestions = getSuggestions(currentWord);
  callbacks.onSuggestions?.(suggestions);
}

// ── Signal Handling (core binary input) ─────────────────────────────────────

/**
 * Call when the binary signal begins (switch pressed, key pressed, screen
 * touched). Records the timestamp for duration measurement.
 */
function handleSignalDown(): void {
  if (!active) return;

  isDown = true;
  pressStartTime = performance.now();

  // Incoming input — cancel any pending gap timers because the user is
  // still actively inputting
  clearGapTimers();
}

/**
 * Call when the binary signal ends (switch released, key released, touch
 * ended). Measures duration to classify as dot or dash.
 */
function handleSignalUp(): void {
  if (!active || !isDown) return;

  isDown = false;
  const duration = performance.now() - pressStartTime;

  const symbol: MorseSymbol = duration < config.dotThresholdMs ? 'dot' : 'dash';
  const morseChar = symbol === 'dot' ? '.' : '-';

  symbolBuffer += morseChar;

  // Audio feedback
  if (config.audioFeedback) {
    playMorseTone(symbol, config.toneHz);
  }

  // Notify callback with current pending buffer for visual display
  callbacks.onSymbol?.(symbol, symbolBuffer);

  // Start gap timers — if the user stays silent long enough, the
  // character or word will be committed
  startGapTimers();
}

// ── Input Source: Keyboard ──────────────────────────────────────────────────

function onKeyDown(e: KeyboardEvent): void {
  // Ignore modifier keys, repeats, and keys that should pass through
  if (e.repeat) return;
  if (e.key === 'Tab' || e.key === 'Escape') return;
  if (e.metaKey || e.ctrlKey || e.altKey) return;

  // Ignore if user is typing in an input field (let normal typing work)
  const tag = document.activeElement?.tagName;
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;

  e.preventDefault();
  handleSignalDown();
}

function onKeyUp(e: KeyboardEvent): void {
  if (e.key === 'Tab' || e.key === 'Escape') return;
  if (e.metaKey || e.ctrlKey || e.altKey) return;

  const tag = document.activeElement?.tagName;
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;

  e.preventDefault();
  handleSignalUp();
}

// ── Input Source: Touch ─────────────────────────────────────────────────────

function onTouchStart(e: TouchEvent): void {
  // Don't capture touches on interactive elements (buttons, links, etc.)
  const target = e.target as HTMLElement;
  if (target.closest('button, a, [role="button"], input, textarea, select')) return;

  e.preventDefault();
  handleSignalDown();
}

function onTouchEnd(e: TouchEvent): void {
  const target = e.target as HTMLElement;
  if (target.closest('button, a, [role="button"], input, textarea, select')) return;

  e.preventDefault();
  handleSignalUp();
}

// ── Lifecycle ───────────────────────────────────────────────────────────────

/**
 * Start listening for Morse code input from all configured sources.
 *
 * @param userConfig - Override any config values. Merged with persisted config.
 * @param userCallbacks - Callbacks for visual/audio feedback integration.
 * @returns A cleanup function equivalent to stopMorseInput().
 */
export function startMorseInput(
  userConfig?: Partial<MorseConfig>,
  userCallbacks?: MorseCallbacks,
): () => void {
  // Stop any existing session
  if (active) {
    stopMorseInput();
  }

  config = { ...getMorseConfig(), ...userConfig };
  callbacks = userCallbacks || {};

  // Reset state
  symbolBuffer = '';
  fullText = '';
  currentWord = '';
  isDown = false;
  pressStartTime = 0;
  active = true;

  if (typeof document === 'undefined') return () => stopMorseInput();

  // Keyboard: any key acts as the switch
  document.addEventListener('keydown', onKeyDown, true);
  document.addEventListener('keyup', onKeyUp, true);

  // Touch: tap anywhere on screen
  document.addEventListener('touchstart', onTouchStart, { capture: true, passive: false });
  document.addEventListener('touchend', onTouchEnd, { capture: true, passive: false });

  return () => stopMorseInput();
}

/**
 * Stop listening for Morse code input. Commits any pending symbols first
 * so the user doesn't lose in-progress input.
 */
export function stopMorseInput(): void {
  if (!active) return;

  // Commit any pending symbols before shutting down
  if (symbolBuffer.length > 0) {
    commitCharacter();
  }

  active = false;
  isDown = false;
  clearGapTimers();

  if (typeof document === 'undefined') return;

  document.removeEventListener('keydown', onKeyDown, true);
  document.removeEventListener('keyup', onKeyUp, true);
  document.removeEventListener('touchstart', onTouchStart, true);
  document.removeEventListener('touchend', onTouchEnd, true);

  // Close audio context to free resources
  if (audioCtx) {
    audioCtx.close().catch(() => {});
    audioCtx = null;
  }
}

// ── External Switch Input (callback-driven) ─────────────────────────────────

/**
 * For external switch devices that provide their own event mechanism
 * (Bluetooth switches, eye trackers, sip-and-puff, etc.), expose the
 * raw signal handlers so they can be called directly.
 *
 * Usage:
 *   const morse = startMorseInput(config, callbacks);
 *   externalSwitch.onPress = () => morseSignalDown();
 *   externalSwitch.onRelease = () => morseSignalUp();
 */
export function morseSignalDown(): void {
  handleSignalDown();
}

export function morseSignalUp(): void {
  handleSignalUp();
}

// ── State Inspection ────────────────────────────────────────────────────────

/**
 * Get the current Morse input state (read-only snapshot).
 */
export function getMorseState(): MorseState {
  return {
    active,
    pendingSymbols: symbolBuffer,
    text: fullText,
    currentWord,
    signalDown: isDown,
  };
}

/**
 * Get the full text accumulated so far.
 */
export function getMorseText(): string {
  return fullText;
}

/**
 * Clear all accumulated text and reset the input buffer.
 * Does not stop the service — keeps listening for input.
 */
export function clearMorseText(): void {
  symbolBuffer = '';
  fullText = '';
  currentWord = '';
  clearGapTimers();
  callbacks.onSuggestions?.([]);
}

/**
 * Accept an auto-complete suggestion, replacing the current partial word.
 * Inserts the completed word and a trailing space.
 */
export function acceptSuggestion(word: string): void {
  if (!active) return;

  // Remove the current partial word from fullText
  if (currentWord.length > 0) {
    fullText = fullText.slice(0, -currentWord.length);
  }

  // Insert the completed word + space
  fullText += word + ' ';
  currentWord = '';
  symbolBuffer = '';
  clearGapTimers();

  callbacks.onWord?.(word, fullText);
  callbacks.onSuggestions?.([]);
}

// ── Morse Code Reference (utility export) ───────────────────────────────────

/**
 * Returns the Morse code pattern for a given character, for display in a
 * reference chart or help screen.
 */
export function charToMorse(char: string): string | null {
  const upper = char.toUpperCase();
  for (const [morse, ch] of Object.entries(MORSE_TO_CHAR)) {
    if (ch === upper) return morse;
  }
  return null;
}

/**
 * Returns the full Morse code lookup table for building reference UIs.
 */
export function getMorseTable(): Record<string, string> {
  // Return char → morse (inverted from internal representation)
  const table: Record<string, string> = {};
  for (const [morse, char] of Object.entries(MORSE_TO_CHAR)) {
    table[char] = morse;
  }
  return table;
}
