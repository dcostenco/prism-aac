/**
 * translateService unit tests — pins the May 2026 RU→IT regression
 * where the offline dict was leaking English fallbacks into non-English
 * targets. User typed "хочу больше свободы" with RU→IT selected and
 * saw "Want più свободы" — English+Italian+Russian mush.
 *
 * Root cause: getPhraseText returns the English fallback when no entry
 * exists for the target lang. The dict builder was registering that
 * English string as the "translation" for the RU→IT pair.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

beforeEach(() => {
  vi.resetModules();
});

describe('translateTextSync (offline dict)', () => {
  it('does not leak English fallbacks into non-English target dict (RU→IT regression)', async () => {
    const { translateTextSync } = await import('@/services/translateService');
    const out = translateTextSync('хочу', 'ru', 'it');
    // The fix: when IT has no entry, the dict must NOT contain "Want"
    // for "хочу". Acceptable outcomes are either an actual Italian
    // translation (if AAC_VOCABULARY has one) or the source word
    // itself — but NEVER the English fallback "Want".
    expect(out.toLowerCase()).not.toBe('want');
  });

  it('does not produce English+target mush for multi-word RU→IT', async () => {
    const { translateTextSync } = await import('@/services/translateService');
    const out = translateTextSync('хочу больше свободы', 'ru', 'it');
    // Must not contain "Want" (English-fallback leak) — that was the
    // exact symptom in the user's screenshot.
    expect(out).not.toMatch(/\bWant\b/i);
  });

  it('returns text unchanged when from===to', async () => {
    const { translateTextSync } = await import('@/services/translateService');
    expect(translateTextSync('hello', 'en', 'en')).toBe('hello');
  });

  it('returns empty string unchanged', async () => {
    const { translateTextSync } = await import('@/services/translateService');
    expect(translateTextSync('', 'ru', 'it')).toBe('');
  });

  it('translates a known Romanian phrase to English', async () => {
    const { translateTextSync } = await import('@/services/translateService');
    // "vreau" is in the cw-want phrase entry as Romanian for "Want"
    const out = translateTextSync('vreau', 'ro', 'en');
    expect(out.toLowerCase()).toContain('want');
  });

  it('translates a known English word to a real Romanian translation', async () => {
    const { translateTextSync } = await import('@/services/translateService');
    const out = translateTextSync('want', 'en', 'ro');
    // ro entry for cw-want is "Vreau"
    expect(out.toLowerCase()).toContain('vreau');
  });
});

describe('translateService LANG_NAMES coverage', () => {
  // Indirect check via SCRIPT_FOR_LANG: looksLikeTargetLang for IT
  // should accept Latin-script responses (Italian uses Latin), and
  // reject Cyrillic ones (the kind of regression where the AI replies
  // in the source language).
  it('Italian is recognised as Latin-script for AI-refine validation', async () => {
    // Re-import — the script regex map is module-scoped
    const mod = await import('@/services/translateService');
    // We can't test looksLikeTargetLang directly (not exported), but
    // we can confirm via the public API path: a refined translation
    // must be Latin-script to be cached for Italian. Use the sync
    // path since it doesn't require AI.
    const out = mod.translateTextSync('hello', 'en', 'it');
    // After the fix, IT entries either come from AAC_VOCABULARY or
    // not at all — but English must not leak. Accept any non-Cyrillic
    // string here (it's a smoke check, not the main test).
    expect(out).not.toMatch(/\p{Script=Cyrillic}/u);
  });
});
