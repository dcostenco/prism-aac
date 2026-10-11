/**
 * Bundled picture symbols for built-in phrases and categories.
 *
 * The locally saved pack provides Prism AAC symbols for the built-in tiles.
 * Each picture was chosen for one meaning, so the lookups must
 * never hand a picture to a phrase, word or category that means something else.
 */
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import phraseSymbols from '@/constants/generated/phraseSymbols.json';
import symbolFiles from '@/constants/generated/phraseSymbolFiles.json';
import picturePack from '@/constants/generated/picturePack.json';
import grammarConcepts from '@/constants/generated/grammarConcepts.json';
import { DEFAULT_PHRASES } from '@/constants/phrases';
import { DEFAULT_CATEGORIES } from '@/constants/categories';
import { PROFANITY, SENSITIVE } from '@/engine/ageBlocklist';
import {
  builtInCategorySymbolUrl,
  builtInPhraseSymbolUrl,
  builtInVocabularySymbol,
  isBuiltInPhraseId,
} from '@/lib/builtInSymbols';

const SYMBOL_DIR = join(process.cwd(), 'public', 'symbols');
const phrases: Record<string, string> = phraseSymbols.phrases;
const categories: Record<string, string> = phraseSymbols.categories;
const words: Record<string, string> = phraseSymbols.words;
const files: Record<string, { sha256: string }> = symbolFiles.files;
const url = (file: string) => `/prism-aac/symbols/${file}`;

describe('symbol library files', () => {
  it('maps only built-in phrase ids, and nearly all of them', () => {
    const ids = new Set(DEFAULT_PHRASES.map((p) => p.id));
    expect(Object.keys(phrases).filter((id) => !ids.has(id))).toEqual([]);
    expect(Object.keys(phrases).length).toBeGreaterThan(1400);
  });

  it('gives every built-in category a symbol, and nothing else', () => {
    const ids = DEFAULT_CATEGORIES.map((c) => c.id).sort();
    expect(Object.keys(categories).sort()).toEqual(ids);
  });

  it('records exactly the referenced library while keeping its artwork outside public assets', () => {
    const referenced = new Set([...Object.values(phrases), ...Object.values(categories), ...Object.values(words)]);
    // Retired artwork stays approved so validated older offline packs remain usable.
    const retained = symbolFiles.retainedFiles ?? [];
    expect(new Set(retained).size).toBe(retained.length);
    expect(retained.every(file => !referenced.has(file) && Object.prototype.hasOwnProperty.call(files, file))).toBe(true);
    const installed = new Set([...referenced, ...retained]);
    const onDisk = readdirSync(SYMBOL_DIR);
    expect(onDisk).toEqual(['ATTRIBUTION.txt']);
    expect(Object.keys(files).sort()).toEqual([...installed].sort());
    expect(picturePack.fileCount).toBe(installed.size);
  });

  it('records approved image checksums for validation when the pack is installed', () => {
    expect(Object.values(files).every(({ sha256 }) => /^[a-f0-9]{64}$/.test(sha256))).toBe(true);
  });

  it('bounds downloads and accounts for every pack byte', () => {
    expect(picturePack.chunks.every(chunk => chunk.byteLength > 0 && chunk.byteLength <= 2_500_000)).toBe(true);
    expect(picturePack.chunks.reduce((sum, chunk) => sum + chunk.byteLength, 0)).toBe(picturePack.byteLength);
    expect(picturePack.version).toMatch(/^[a-f0-9]{64}$/);
  });

  it('carries a notice saying where the pictures come from', () => {
    const attribution = readFileSync(join(SYMBOL_DIR, 'ATTRIBUTION.txt'), 'utf8');
    expect(attribution).toContain('made for Prism AAC');
    expect(attribution).toContain('Synalux LLC');
    // the pictures were reviewed before release, but not every one by a person: the notice and the manifest say only that
    const manifest = readFileSync(join(SYMBOL_DIR, '..', '..', 'constants', 'generated', 'phraseSymbolFiles.json'), 'utf8');
    for (const text of [attribution, manifest]) expect(text).not.toMatch(/reviewed by hand/);
  });

  it('gives no symbol to a phrase containing a profane or sensitive word', () => {
    const flagged = Object.keys(phrases).filter((id) => {
      const text = DEFAULT_PHRASES.find((p) => p.id === id)!.text.toLowerCase();
      return text.split(/[^\p{L}\p{N}]+/u).some((w) => PROFANITY.has(w) || SENSITIVE.has(w));
    });
    expect(flagged).toEqual([]);
  });
});

describe('built-in phrase lookup', () => {
  it('recognises built-in ids only', () => {
    expect(isBuiltInPhraseId('ac-buckle')).toBe(true);
    expect(isBuiltInPhraseId('3f2b9c1e-custom')).toBe(false);
    expect(isBuiltInPhraseId('constructor')).toBe(false);
    expect(isBuiltInPhraseId('__proto__')).toBe(false);
    expect(isBuiltInPhraseId(undefined)).toBe(false);
  });

  it('returns the symbol for a phrase that has one', () => {
    expect(builtInPhraseSymbolUrl('ac-buckle')).toBe(url('ac-buckle.png'));
    expect(builtInPhraseSymbolUrl('cw-want')).toBe(url('cw-want.png'));
    expect(builtInPhraseSymbolUrl('cw-help')).toBe(url('cw-help.png'));
  });

  it('gives a phrase that means the same word the same picture', () => {
    // "Go" in Actions and "Go" in Core Verbs are one word, so one picture.
    expect(builtInPhraseSymbolUrl('ac-go')).toBe(builtInPhraseSymbolUrl('cw-go-core'));
    expect(builtInPhraseSymbolUrl('ac-go')).not.toBeNull();
  });

  it('keeps homographs apart: one spelling, two meanings, two pictures', () => {
    // March the month and march the verb; orange the colour and the fruit.
    expect(builtInPhraseSymbolUrl('tm-mar')).not.toBe(builtInPhraseSymbolUrl('ac-march'));
    expect(builtInPhraseSymbolUrl('co-orange')).not.toBe(builtInPhraseSymbolUrl('fd-orange'));
  });

  it('returns null — a word tile — where no picture carries the meaning', () => {
    // Rare grammar words and calendar dates stay words.
    expect(builtInPhraseSymbolUrl('cw-unless')).toBeNull();
    expect(builtInPhraseSymbolUrl('tdate-1')).toBeNull();
    expect(builtInPhraseSymbolUrl('constructor')).toBeNull();
  });

  it('uses reviewed child figures for basic child vocabulary', () => {
    for (const id of ['pp-boy', 'pp-girl', 'pp-kid']) {
      expect(builtInPhraseSymbolUrl(id)).toBe(url(`${id}.png`));
    }
  });
});

describe('built-in category lookup', () => {
  it('returns the symbol for a built-in category', () => {
    expect(builtInCategorySymbolUrl({ id: 'feelings' })).toBe(url('cat-feelings.png'));
    expect(builtInCategorySymbolUrl({ id: 'animals-pets' })).toBe(url('cat-animals-pets.png'));
  });

  it('keeps the emoji for a category the user made, even with a built-in id', () => {
    expect(builtInCategorySymbolUrl({ id: 'feelings', isCustom: true })).toBeNull();
    expect(builtInCategorySymbolUrl({ id: '3f2b9c1e-custom' })).toBeNull();
    expect(builtInCategorySymbolUrl({ id: '__proto__' })).toBeNull();
  });
});

describe('frequent prediction words', () => {
  const norm = (t: string) => t.trim().toLowerCase().replace(/^[\p{P}\s]+|[\p{P}\s]+$/gu, '').replace(/\s+/g, ' ');
  const builtInWords = new Set(DEFAULT_PHRASES.map((p) => norm(p.text)));

  it('lists lowercase English words only, contractions with a straight apostrophe', () => {
    // The only other keys are the hidden ids of the grammar symbols (tests/grammar-concepts.test.ts).
    expect(Object.keys(words).filter((w) => !/^[a-z]+(?:'[a-z]+)?$/.test(w)).sort()).toEqual(Object.keys(grammarConcepts).sort());
    expect(Object.keys(words).length).toBeGreaterThan(500);
  });

  it('pictures the completions of "i wou", except the homograph', () => {
    // would / wouldn't / would've / wounded / wound: "wound" is also the past of
    // "wind", so it gets no bundled picture.
    for (const w of ['would', "wouldn't", "would've", 'wounded']) {
      expect(builtInVocabularySymbol(w, 'en')?.url, w).toMatch(/^\/prism-aac\/symbols\/w-/);
    }
    expect(builtInVocabularySymbol('wound', 'en')).toBeNull();
  });

  it('matches a contraction typed with a typographic apostrophe', () => {
    const straight = builtInVocabularySymbol("don't", 'en');
    expect(straight?.url).toBeTruthy();
    expect(builtInVocabularySymbol('don\u2019t', 'en')).toEqual(straight);
    expect(builtInVocabularySymbol('DON\u2019T', 'en')).toEqual(straight);
  });

  it('never lists a built-in phrase word, so it cannot override a homograph or word tile', () => {
    expect(Object.keys(words).filter((w) => builtInWords.has(w))).toEqual([]);
  });

  it('gives no picture to a profane or sensitive word', () => {
    expect(Object.keys(words).filter((w) => PROFANITY.has(w) || SENSITIVE.has(w))).toEqual([]);
  });

  it('shows the base word picture for a word form', () => {
    expect(builtInVocabularySymbol('going', 'en')).toEqual({ url: builtInPhraseSymbolUrl('cw-go-core') });
    expect(builtInVocabularySymbol('Wanted', 'en')).toEqual({ url: builtInPhraseSymbolUrl('cw-want') });
  });

  it('shows the word for built-in vocabulary whose predicted sense has no picture', () => {
    // The board's "May" is the month; typed, "may" is nearly always the verb.
    const wordOnly: string[] = (phraseSymbols as { wordOnly?: string[] }).wordOnly ?? [];
    expect(wordOnly).toContain('may');
    expect(builtInVocabularySymbol('may', 'en')).toEqual({ url: null });
    expect(builtInVocabularySymbol('May', 'en')).toEqual({ url: null });
    // Every entry is built-in vocabulary: a word without a phrase needs no exception.
    expect(wordOnly.filter((w) => !builtInWords.has(w))).toEqual([]);
  });

  it('keeps a built-in homograph as a word even when a prediction word could match it', () => {
    expect(builtInVocabularySymbol('Fall', 'en')).toEqual({ url: null });
    expect(builtInVocabularySymbol('back', 'en')).toEqual({ url: null });
  });

  it('applies to English only; another language needs a curated English source', () => {
    expect(builtInVocabularySymbol('going', 'de')).toBeNull();
  });
});

describe('built-in vocabulary lookup (prediction bar)', () => {
  it('finds the symbol for an unambiguous English word, in any case', () => {
    expect(builtInVocabularySymbol('More', 'en')).toEqual({ url: url('cw-more.png') });
    expect(builtInVocabularySymbol('more', 'en')).toEqual({ url: url('cw-more.png') });
  });

  it('finds the shared picture for a word that appears in several categories', () => {
    expect(builtInVocabularySymbol('go', 'en')).toEqual({ url: builtInPhraseSymbolUrl('cw-go-core') });
  });

  it('shows the word when one spelling has meanings with different symbols', () => {
    // Fall: the verb (falling over) and the season (autumn leaves).
    expect(builtInVocabularySymbol('Fall', 'en')).toEqual({ url: null });
    expect(builtInVocabularySymbol('March', 'en')).toEqual({ url: null });
  });

  it('never borrows a picture through a shared translation', () => {
    // German "weiß" is both "know" and "white": the colour for "I know" would
    // say something else. Spanish "tocar" is both "touch" and the game "tag".
    expect(builtInVocabularySymbol('weiß', 'de')).toEqual({ url: null });
    expect(builtInVocabularySymbol('tocar', 'es')).toEqual({ url: null });
  });

  it('shows the word for built-in vocabulary that stays a word tile', () => {
    expect(builtInVocabularySymbol('unless', 'en')).toEqual({ url: null });
  });

  it('returns null for a word that is not built-in vocabulary', () => {
    expect(builtInVocabularySymbol('zzzznotaword', 'en')).toBeNull();
    expect(builtInVocabularySymbol('', 'en')).toBeNull();
    expect(builtInVocabularySymbol('   ', 'de')).toBeNull();
  });
});
