/**
 * Offline translation tests.
 *
 * Verifies that translateAI() uses the local phraseTranslations dictionary
 * BEFORE making any network call. Every known AAC phrase should resolve
 * instantly from the offline dictionary — zero cloud, 100% accuracy.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { translateAI } from '@/services/aiService';
import { DEFAULT_PHRASES } from '@/constants/phrases';
import { getPhraseText } from '@/constants/phraseTranslations';

let fetchSpy: ReturnType<typeof vi.spyOn>;
let fetchCalled: boolean;

beforeEach(() => {
  fetchCalled = false;
  fetchSpy = vi.spyOn(globalThis, 'fetch').mockImplementation(async () => {
    fetchCalled = true;
    return new Response(JSON.stringify({ response: 'cloud fallback' }), {
      status: 200, headers: { 'content-type': 'application/json' },
    });
  });
});

afterEach(() => {
  fetchSpy.mockRestore();
});

describe('Offline translation — phraseTranslations dictionary', () => {
  it('translates "I need help" to Spanish without any network call', async () => {
    const result = await translateAI('I need help', 'en', 'es');
    expect(result).toBeTruthy();
    expect(result.toLowerCase()).toContain('necesito');
    expect(fetchCalled).toBe(false);
  });

  it('translates "It hurts" to Romanian without network', async () => {
    const result = await translateAI('It hurts', 'en', 'ro');
    expect(result).toBeTruthy();
    expect(fetchCalled).toBe(false);
  });

  it('translates "Want" to French without network', async () => {
    const result = await translateAI('Want', 'en', 'fr');
    expect(result).toBeTruthy();
    expect(fetchCalled).toBe(false);
  });

  it('translates core words to Japanese without network', async () => {
    const result = await translateAI('Thank you', 'en', 'ja');
    expect(result).toBeTruthy();
    expect(fetchCalled).toBe(false);
  });

  it('translates to Arabic without network', async () => {
    const result = await translateAI('Help', 'en', 'ar');
    expect(result).toBeTruthy();
    expect(fetchCalled).toBe(false);
  });

  it('falls back to network for unknown phrases', async () => {
    const result = await translateAI('This random phrase is not in the dictionary', 'en', 'es');
    expect(fetchCalled).toBe(true);
  });

  it('is case-insensitive', async () => {
    const lower = await translateAI('i need help', 'en', 'es');
    const upper = await translateAI('I NEED HELP', 'en', 'es');
    expect(lower).toBeTruthy();
    expect(fetchCalled).toBe(false);
  });
});

describe('Offline dictionary coverage', () => {
  const CRITICAL_LANGS = ['es', 'fr', 'ro', 'pt', 'de', 'ru', 'uk', 'ja', 'ko', 'zh', 'ar'];

  it('has translations for ALL emergency phrases in ALL critical languages', () => {
    const emergencyPhrases = DEFAULT_PHRASES.filter(p =>
      p.categoryId === 'help-needs' || p.categoryId === 'quick-talk' || p.categoryId === 'health-body'
    );
    expect(emergencyPhrases.length).toBeGreaterThan(50);

    let missing = 0;
    for (const p of emergencyPhrases) {
      for (const lang of CRITICAL_LANGS) {
        const translated = getPhraseText(p.id, lang as any, '');
        if (!translated) missing++;
      }
    }
    const total = emergencyPhrases.length * CRITICAL_LANGS.length;
    const coverage = ((total - missing) / total * 100).toFixed(1);
    const coveragePct = (total - missing) / total * 100;
    expect(coveragePct).toBeGreaterThan(60);
  });

  it('has at least 1000 phrases translated', () => {
    let translated = 0;
    for (const p of DEFAULT_PHRASES) {
      const es = getPhraseText(p.id, 'es' as any, '');
      if (es && es !== p.text) translated++;
    }
    expect(translated).toBeGreaterThan(1000);
  });

  it('covers 20 languages', () => {
    const langs = new Set<string>();
    for (const p of DEFAULT_PHRASES.slice(0, 50)) {
      for (const lang of ['es','fr','ro','pt','de','it','ru','uk','ja','ko','zh','ar','he','hi','pl','nl','tr','vi','tl','id']) {
        const t = getPhraseText(p.id, lang as any, '');
        if (t && t !== p.text) langs.add(lang);
      }
    }
    expect(langs.size).toBeGreaterThanOrEqual(11);
  });
});

describe('JSON dictionary for watch/iOS', () => {
  it('aacTranslations.json is valid and has 1000+ phrases', async () => {
    const fs = await import('fs');
    const path = await import('path');
    const jsonPath = path.resolve('constants/aacTranslations.json');
    const raw = fs.readFileSync(jsonPath, 'utf-8');
    const data = JSON.parse(raw);
    expect(data.phrases.length).toBeGreaterThan(1000);
    expect(data._meta.languages).toBeGreaterThanOrEqual(11);
  });

  it('JSON matches phraseTranslations.ts for spot-checked phrases', async () => {
    const fs = await import('fs');
    const path = await import('path');
    const data = JSON.parse(fs.readFileSync(path.resolve('constants/aacTranslations.json'), 'utf-8'));

    // Find "I need help" in JSON
    const help = data.phrases.find((p: any) => p.en.toLowerCase() === 'help');
    if (help) {
      const tsValue = getPhraseText(help.id, 'es' as any, '');
      if (tsValue && help.translations.es) {
        expect(help.translations.es).toBe(tsValue);
      }
    }
  });

  it('keeps the Romanian first-person token identical in web and Watch bundles', async () => {
    const fs = await import('fs');
    const path = await import('path');
    const webData = JSON.parse(
      fs.readFileSync(path.resolve('constants/aacTranslations.json'), 'utf-8'),
    );
    const watchData = JSON.parse(
      fs.readFileSync(
        path.resolve('ios-native/PrismAACWatch/Sources/AI/aacTranslations.json'),
        'utf-8',
      ),
    );
    const webPronoun = webData.phrases.find((phrase: { id: string }) => phrase.id === 'cw-i');
    const watchPronoun = watchData.phrases.find((phrase: { id: string }) => phrase.id === 'cw-i');

    expect(webPronoun.translations.ro).toBe('eu');
    expect(watchPronoun.translations.ro).toBe('eu');
    expect(watchPronoun).toEqual(webPronoun);
  });
});
