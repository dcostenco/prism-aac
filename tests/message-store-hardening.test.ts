/**
 * messageStore — text length caps + hydration validator. emergencyService
 * reads `parsed?.state?.history` from this store's persisted entry to
 * build the AI emergency context, so a tampered or runaway history
 * could trick the system or balloon the payload.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { useMessageStore } from '@/store/messageStore';

beforeEach(() => {
  if (typeof window !== 'undefined') window.localStorage.clear();
  useMessageStore.setState({
    text: '',
    undoStack: [],
    activeTone: 'friendly',
    toneMode: 'auto',
    autoSpeak: true,
    soundEnabled: true,
    history: [],
  });
});

function seedPersistedMessage(state: Record<string, unknown>): void {
  window.localStorage.setItem('prism-aac-message', JSON.stringify({ state, version: 3 }));
}

describe('messageStore — text length cap', () => {
  it('clamps appendText to MAX_TEXT_LEN', () => {
    useMessageStore.getState().appendText('a'.repeat(10_000));
    expect(useMessageStore.getState().text.length).toBeLessThanOrEqual(4000);
  });

  it('clamps setText to MAX_TEXT_LEN', () => {
    useMessageStore.getState().setText('b'.repeat(10_000));
    expect(useMessageStore.getState().text.length).toBeLessThanOrEqual(4000);
  });

  it('clamps appendChar so a stuck-key event cannot grow text past cap', () => {
    useMessageStore.setState({ text: 'a'.repeat(3999) });
    for (let i = 0; i < 100; i++) useMessageStore.getState().appendChar('x');
    expect(useMessageStore.getState().text.length).toBeLessThanOrEqual(4000);
  });
});

describe('messageStore — addToHistory cap per entry', () => {
  it('clamps a single huge history entry', () => {
    useMessageStore.getState().addToHistory('x'.repeat(10_000));
    const entry = useMessageStore.getState().history[0];
    expect(entry.text.length).toBeLessThanOrEqual(4000);
  });
});

describe('messageStore — hydration validator', () => {
  it('drops malformed history entries on rehydrate', () => {
    seedPersistedMessage({
      history: [
        { text: 'good', timestamp: 100 },
        { text: '', timestamp: 200 },                                // bad: empty text
        { text: 'x'.repeat(10000), timestamp: 300 },                 // bad: text overflow
        { timestamp: 400 },                                          // bad: missing text
        { text: 'no-ts' },                                           // bad: missing timestamp
        'string-not-object',                                         // bad
      ],
    });
    void useMessageStore.persist.rehydrate();
    const history = useMessageStore.getState().history;
    expect(history.map((h) => h.text)).toEqual(['good']);
  });

  it('caps history length at MAX_HISTORY_ENTRIES on rehydrate', () => {
    const huge = Array.from({ length: 500 }, (_, i) => ({
      text: `msg ${i}`, timestamp: i,
    }));
    seedPersistedMessage({ history: huge });
    void useMessageStore.persist.rehydrate();
    expect(useMessageStore.getState().history.length).toBeLessThanOrEqual(100);
  });

  it('rejects unknown tone string and falls back to current state default', () => {
    seedPersistedMessage({ activeTone: 'haxor', toneMode: 'manual' });
    void useMessageStore.persist.rehydrate();
    expect(['friendly', 'cheerful', 'calm', 'serious', 'excited', 'hopeful', 'empathetic', 'sad', 'angry'])
      .toContain(useMessageStore.getState().activeTone);
  });

  it('forces booleans for autoSpeak/soundEnabled even if persisted as strings', () => {
    seedPersistedMessage({ autoSpeak: 'yes', soundEnabled: 0 });
    void useMessageStore.persist.rehydrate();
    expect(typeof useMessageStore.getState().autoSpeak).toBe('boolean');
    expect(typeof useMessageStore.getState().soundEnabled).toBe('boolean');
  });
});
