/**
 * messageStore — tone/speak toggles and history actions
 *
 * The existing suites cover text composition (appendWord, appendText, etc.),
 * undo, and length clamping. These tests cover the remaining action paths:
 *
 *   setTone — BCBA or user picks a TTS voice style. Must flip toneMode to
 *   'manual' so the adaptive engine doesn't override the explicit choice.
 *   A broken setTone leaves the AAC user's emotional expression requests
 *   silently ignored (they pick "excited" but the engine uses "friendly").
 *
 *   setToneMode — explicit mode override. 'auto' re-enables adaptive tone
 *   switching after a manual override. 'manual' freezes the current tone.
 *
 *   toggleAutoSpeak — speak-on-select toggle. An AAC user may need to
 *   silence TTS while composing. A stuck toggle (always true) means the
 *   user can't compose quietly; stuck false means they lose speech output.
 *
 *   toggleSound — sound/chime toggle for incoming messages. Stuck-on
 *   disturbs the user; stuck-off hides new message notifications.
 *
 *   addToHistory — persists each sent phrase for HistoryModal and for
 *   emergencyService.getRecentHistory. Must prepend (most-recent first)
 *   and clamp the per-entry text length.
 *
 *   clearHistory — wipes the history array (user requests privacy/reset).
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { useMessageStore } from '@/store/messageStore';

// Mock adaptiveEngine + emergencyService dynamic imports so test runs don't
// trigger real network calls or emergency timers.
vi.mock('@/services/adaptiveEngine', () => ({
  recordMessage: vi.fn(),
}));
vi.mock('@/services/emergencyService', () => ({
  detectEmergency: vi.fn(() => ({ detected: false })),
  triggerEmergency: vi.fn(),
}));

beforeEach(() => {
  useMessageStore.setState({
    text: '',
    undoStack: [],
    activeTone: 'friendly',
    toneMode: 'auto',
    autoSpeak: true,
    soundEnabled: true,
    history: [],
  });
  vi.clearAllMocks();
});

// ── setTone ───────────────────────────────────────────────────────────────────

describe('messageStore — setTone', () => {
  it('updates activeTone to the specified tone', () => {
    useMessageStore.getState().setTone('cheerful');
    expect(useMessageStore.getState().activeTone).toBe('cheerful');
  });

  it('flips toneMode to "manual" so adaptive engine does not override', () => {
    expect(useMessageStore.getState().toneMode).toBe('auto');
    useMessageStore.getState().setTone('calm');
    expect(useMessageStore.getState().toneMode).toBe('manual');
  });

  it('overrides a previously set tone', () => {
    useMessageStore.getState().setTone('excited');
    useMessageStore.getState().setTone('sad');
    expect(useMessageStore.getState().activeTone).toBe('sad');
  });
});

// ── setToneMode ───────────────────────────────────────────────────────────────

describe('messageStore — setToneMode', () => {
  it('switches to manual mode', () => {
    useMessageStore.getState().setToneMode('manual');
    expect(useMessageStore.getState().toneMode).toBe('manual');
  });

  it('switches back to auto mode after manual override', () => {
    useMessageStore.getState().setTone('calm');           // sets manual
    useMessageStore.getState().setToneMode('auto');       // back to auto
    expect(useMessageStore.getState().toneMode).toBe('auto');
  });

  it('is idempotent — setting auto twice stays auto', () => {
    useMessageStore.getState().setToneMode('auto');
    useMessageStore.getState().setToneMode('auto');
    expect(useMessageStore.getState().toneMode).toBe('auto');
  });
});

// ── toggleAutoSpeak ───────────────────────────────────────────────────────────

describe('messageStore — toggleAutoSpeak', () => {
  it('turns autoSpeak off when it was on', () => {
    expect(useMessageStore.getState().autoSpeak).toBe(true);
    useMessageStore.getState().toggleAutoSpeak();
    expect(useMessageStore.getState().autoSpeak).toBe(false);
  });

  it('turns autoSpeak back on when it was off', () => {
    useMessageStore.getState().toggleAutoSpeak(); // off
    useMessageStore.getState().toggleAutoSpeak(); // on
    expect(useMessageStore.getState().autoSpeak).toBe(true);
  });
});

// ── toggleSound ───────────────────────────────────────────────────────────────

describe('messageStore — toggleSound', () => {
  it('turns sound off when it was on', () => {
    expect(useMessageStore.getState().soundEnabled).toBe(true);
    useMessageStore.getState().toggleSound();
    expect(useMessageStore.getState().soundEnabled).toBe(false);
  });

  it('turns sound back on after being disabled', () => {
    useMessageStore.getState().toggleSound(); // off
    useMessageStore.getState().toggleSound(); // on
    expect(useMessageStore.getState().soundEnabled).toBe(true);
  });
});

// ── addToHistory ──────────────────────────────────────────────────────────────

describe('messageStore — addToHistory', () => {
  it('prepends the new entry (most-recent first)', () => {
    useMessageStore.getState().addToHistory('First message');
    useMessageStore.getState().addToHistory('Second message');
    const history = useMessageStore.getState().history;
    expect(history[0].text).toBe('Second message');
    expect(history[1].text).toBe('First message');
  });

  it('stores a timestamp on each entry', () => {
    useMessageStore.getState().addToHistory('Hello');
    const entry = useMessageStore.getState().history[0];
    expect(typeof entry.timestamp).toBe('number');
    expect(entry.timestamp).toBeGreaterThan(0);
  });

  it('clamps entry text to 4000 chars', () => {
    const huge = 'x'.repeat(10000);
    useMessageStore.getState().addToHistory(huge);
    const entry = useMessageStore.getState().history[0];
    expect(entry.text.length).toBeLessThanOrEqual(4000);
  });

  it('caps history at 100 entries — oldest entries are dropped', () => {
    for (let i = 0; i < 110; i++) {
      useMessageStore.getState().addToHistory(`msg ${i}`);
    }
    expect(useMessageStore.getState().history).toHaveLength(100);
  });
});

// ── clearHistory ──────────────────────────────────────────────────────────────

describe('messageStore — clearHistory', () => {
  it('empties the history array', () => {
    useMessageStore.getState().addToHistory('Some message');
    useMessageStore.getState().clearHistory();
    expect(useMessageStore.getState().history).toHaveLength(0);
  });

  it('is idempotent — second call on empty history does not throw', () => {
    expect(() => {
      useMessageStore.getState().clearHistory();
      useMessageStore.getState().clearHistory();
    }).not.toThrow();
  });
});
