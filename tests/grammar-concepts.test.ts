/**
 * Grammar-identity symbols: a word that cannot be drawn as a thing ("whom", "whether", "et cetera",
 * the Turkish question particle) gets a language-neutral symbol of its one grammatical job instead of a sound-alike peg or a
 * picture of a different meaning. Fourteen were drawn; two were accepted (and so on, yes/no question),
 * and the other twelve (relative pronoun, comparison, such, ...) stayed words because they read as each other or as "again".
 */
import { describe, expect, it } from 'vitest';
import { loadPictureWords } from '@/constants/pictureWords';
import { builtInPhraseSymbolUrl, builtInVocabularySymbol } from '@/lib/builtInSymbols';
import concepts from '@/constants/generated/grammarConcepts.json';
import phraseSymbols from '@/constants/generated/phraseSymbols.json';
import symbolFiles from '@/constants/generated/phraseSymbolFiles.json';

type Lang = Parameters<typeof builtInVocabularySymbol>[1];
const file = (word: string, lang: Lang) => builtInVocabularySymbol(word, lang)?.url?.split('/').pop() ?? null;

interface Table { words: Record<string, string>; choose: Record<string, string>; keep?: string[] }
const TABLES = Object.fromEntries(
  Object.entries(import.meta.glob('../constants/generated/pictureWords/*.json', { eager: true, import: 'default' }))
    .map(([path, t]) => [path.split('/').pop()!.replace('.json', ''), t as Table]),
) as Record<string, Table>;

const REGISTRY = concepts as Record<string, { file: string; kind: string; means: string }>;

describe('the grammar concept registry', () => {
  it('lists exactly the reviewed symbols for their distinct grammatical jobs', () => {
    expect(Object.keys(REGISTRY).sort()).toEqual(['g-etc', 'g-past-being', 'g-qyn', 'g-third-person']);
  });

  it.each(Object.entries(REGISTRY))('%s has a drawing file, a meaning, and an English key that resolves to it', (id, c) => {
    expect(c.kind).toBe('grammar');
    expect(c.means.length).toBeGreaterThan(10);
    expect((symbolFiles.files as Record<string, { sha256: string }>)[c.file]?.sha256).toMatch(/^[a-f0-9]{64}$/);
    expect((phraseSymbols.words as Record<string, string>)[id]).toBe(c.file);
  });

  it('gives every concept its own drawing', () => {
    const files = Object.values(REGISTRY).map((c) => c.file);
    expect(new Set(files).size).toBe(files.length);
  });

  it('every hidden g-* key in a language table is a registered concept', () => {
    const used = new Set<string>();
    for (const t of Object.values(TABLES)) for (const en of Object.values(t.words)) if (en.startsWith('g-')) used.add(en);
    expect(used.size).toBeGreaterThan(0);
    for (const id of used) expect(REGISTRY[id], id).toBeDefined();
  });

  it.each(['g-rel', 'g-comp', 'g-refl', 'g-own', 'g-such', 'g-somuch', 'g-sothat', 'g-seem', 'g-acc', 'g-reg', 'g-nor', 'g-further'])(
    'the rejected concept %s ships no drawing and no key', (id) => {
      expect(REGISTRY[id]).toBeUndefined();
      expect((phraseSymbols.words as Record<string, string>)[id]).toBeUndefined();
      expect((symbolFiles.files as Record<string, unknown>)[`w-${id}.png`]).toBeUndefined();
    },
  );
});

describe('English', () => {
  it('"etc" and "etcetera" show the and-so-on symbol', () => {
    expect(file('etc', 'en')).toBe('w-g-etc.png');
    expect(file('etcetera', 'en')).toBe('w-g-etc.png');
  });

  it('"whether" shows the yes/no question symbol through its own tile', () => {
    expect(builtInPhraseSymbolUrl('cw-whether')).toBe('/prism-aac/symbols/cw-whether.png');
    expect(file('whether', 'en')).toBe('cw-whether.png');
  });

  it('"own" no longer shows the first-person "my" picture', () => {
    // "own" (my own idea) is not the possessive "my": a person reading the bar saw a picture of themself.
    expect(file('own', 'en')).toBeNull();
    expect(file('my', 'en')).toBe('cw-my.png');
  });

  it.each(['अपना', 'अपनी', 'अपने'])('Hindi "%s" (one\'s own) no longer shows the "my" picture either', async (word) => {
    // The three were hand links to "own", which showed the first-person picture; "your own" is not "my".
    await loadPictureWords('hi');
    expect(TABLES.hi.words[word]).toBeUndefined();
    expect(file(word, 'hi')).not.toBe('cw-my.png');
  });

  it.each(['whom', 'such', 'access', 'action'])('"%s", which no drawing could say apart from its neighbours, stays a word', (word) => {
    expect(file(word, 'en')).toBeNull();
  });
});

describe('words in other languages that reach a grammar symbol', () => {
  it.each([
    ['es', 'etc', 'w-g-etc.png'], ['fr', 'etc', 'w-g-etc.png'], ['pt', 'etc', 'w-g-etc.png'], ['ro', 'etc', 'w-g-etc.png'],
    ['de', 'etc', 'w-g-etc.png'], ['uk', 'тощо', 'w-g-etc.png'], ['ja', 'など', 'w-g-etc.png'],
    ['ar', 'هل', 'w-g-qyn.png'],
    ['tr', 'mi', 'w-g-qyn.png'], ['tr', 'mı', 'w-g-qyn.png'], ['tr', 'mu', 'w-g-qyn.png'], ['tr', 'mü', 'w-g-qyn.png'],
    ['tr', 'misin', 'w-g-qyn.png'], ['tr', 'mısın', 'w-g-qyn.png'], ['tr', 'miyim', 'w-g-qyn.png'], ['tr', 'miyiz', 'w-g-qyn.png'],
    ['tr', 'misiniz', 'w-g-qyn.png'], ['tr', 'mısınız', 'w-g-qyn.png'],
  ] as [Lang, string, string][])('%s "%s" shows %s', async (lang, word, expected) => {
    await loadPictureWords(lang);
    expect(file(word, lang)).toBe(expected);
  });

  it.each([
    ['ru', 'ли'], ['pl', 'czy'], ['zh-Hans', '是否'],
  ] as [Lang, string][])('%s "%s" (whether) shows the Whether tile', async (lang, word) => {
    await loadPictureWords(lang);
    expect(file(word, lang)).toBe('cw-whether.png');
  });

  it('German "ob" stays a word: it is also "als ob" (as if), which a yes/no symbol would mislead', async () => {
    // the Whether tile's German spelling reached the question symbol through the tile text;
    // the keep list (always loaded) holds it back from the first render
    await loadPictureWords('de');
    expect(builtInVocabularySymbol('ob', 'de')).toEqual({ url: null });
    // before any table has loaded it is held back too: tests/picture-keep-before-load.test.ts
  });
});

describe('removed links stay words', () => {
  // Korean 는지 / 인지 end an indirect question ("I wonder whether ..."), not a direct yes/no question, and 인지 also means
  // cognition and a revenue stamp; 기타 is both "etcetera" and "guitar"; Chinese 等 mostly means "wait" or "grade".
  it.each([['ko', '는지'], ['ko', '인지'], ['ko', '기타'], ['zh-Hans', '等']] as [string, string][])(
    '%s "%s" has no hand link to a grammar symbol', (lang, word) => {
      expect(TABLES[lang].words[word] ?? '').not.toMatch(/^g-/);
    },
  );

  it('Chinese 等 shows no and-so-on picture', async () => {
    await loadPictureWords('zh-Hans');
    expect(file('等', 'zh-Hans')).not.toBe('w-g-etc.png');
  });

  it('Korean 기타 shows no and-so-on picture', async () => {
    await loadPictureWords('ko');
    expect(file('기타', 'ko')).not.toBe('w-g-etc.png');
  });
});
