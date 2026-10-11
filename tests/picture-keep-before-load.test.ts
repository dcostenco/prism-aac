/**
 * The keep decisions ("this built-in word has a second common meaning, so it stays a word") must hold from the first
 * render. They used to live only in each language's lazily loaded table: before that import arrived, the bar showed the
 * rejected picture (Korean 등 = back or lamp showed a back, Arabic ظهر, Spanish atrás, Chinese 空 ...), and after a failed
 * import it kept showing it. They now ship in constants/generated/pictureKeep.json, which is always loaded.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import keepFile from '@/constants/generated/pictureKeep.json';
import primaryFile from '@/constants/generated/basicVocabularyPictures.json';

interface Table { keep?: string[] }
const TABLES = Object.fromEntries(
  Object.entries(import.meta.glob('../constants/generated/pictureWords/*.json', { eager: true, import: 'default' }))
    .map(([path, t]) => [path.split('/').pop()!.replace('.json', ''), t as Table]),
) as Record<string, Table>;
const KEEP = keepFile as Record<string, string[]>;
const entries = Object.entries(KEEP).flatMap(([lang, words]) => words.map((w) => [lang, w] as const));
const PRIMARY = primaryFile.languages as Record<string, Record<string, { file: string }>>;

beforeEach(() => { vi.resetModules(); });

describe('keep decisions before a language table has loaded', () => {
  it('there are some', () => {
    expect(entries.length).toBeGreaterThanOrEqual(23);
  });

  it.each(entries)('%s "%s" applies its reviewed primary or keep decision while cold', async (lang, word) => {
    const { builtInVocabularySymbol } = await import('@/lib/builtInSymbols');
    const { pictureWordSource } = await import('@/constants/pictureWords');
    expect(pictureWordSource(word, lang)).toBeNull(); // really cold: nothing of the table is in memory
    const primary = PRIMARY[lang]?.[word];
    expect(builtInVocabularySymbol(word, lang as never)).toEqual({ url: primary ? `/prism-aac/symbols/${primary.file}` : null });
  });

  it('a word that is not on the list still shows its own phrase picture cold', async () => {
    const { builtInVocabularySymbol } = await import('@/lib/builtInSymbols');
    expect(builtInVocabularySymbol('espalda', 'es')?.url).toBe('/prism-aac/symbols/hb-back.png');
  });

  it('answers false for a language with no keep list, including names that exist on every object', async () => {
    const { pictureKept } = await import('@/constants/pictureWords');
    expect(pictureKept('x', 'xx')).toBe(false);
    expect(pictureKept('x', 'constructor')).toBe(false);
    expect(pictureKept('x', '__proto__')).toBe(false);
  });
});

describe('the always-loaded copy matches the tables', () => {
  it('lists exactly the keep words of every language table', () => {
    const fromTables = Object.fromEntries(
      Object.entries(TABLES).filter(([, t]) => t.keep?.length).map(([lang, t]) => [lang, [...t.keep!].sort()]),
    );
    const copy = Object.fromEntries(Object.entries(KEEP).map(([lang, w]) => [lang, [...w].sort()]));
    expect(copy).toEqual(fromTables);
  });
});
