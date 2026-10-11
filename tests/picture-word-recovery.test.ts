// @vitest-environment node
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const RU_TABLE = '@/constants/generated/pictureWords/ru.json';
const LANGUAGE_TABLE_LOAD_ERROR = 'Picture-word table load failed';
const RECOVERY_CLOCK_MS = 2_000;
const EMPTY_LANGUAGE_CASES = ['en', 'fixture-unsupported'] as const;
const WORD_CASES = [['pt', 'água'], ['es', 'más'], ['fr', 'été']] as const;
const RU_WORDS = JSON.parse(readFileSync(resolve('constants/generated/pictureWords/ru.json'), 'utf8'));

beforeEach(() => { vi.resetModules(); });
afterEach(() => { vi.doUnmock(RU_TABLE); vi.restoreAllMocks(); });

it('a transient table failure stays readable and a later explicit load recovers', async () => {
 const warning = vi.spyOn(console, 'warn').mockImplementation(() => {});
 const clock = vi.spyOn(Date, 'now').mockReturnValue(0);
 vi.doMock(RU_TABLE, () => { throw new Error('transient table failure fixture'); });
 const words = await import('@/constants/pictureWords');
 await expect(words.loadPictureWords('ru')).resolves.toBeUndefined();
 expect(words.pictureWordSource('гулять', 'ru')).toBeNull();
 expect(warning).toHaveBeenCalledWith(LANGUAGE_TABLE_LOAD_ERROR, 'ru', expect.anything());
 await Promise.all([words.loadPictureWords('ru'), words.loadPictureWords('ru')]);
 expect(warning).toHaveBeenCalledTimes(1);
 vi.doUnmock(RU_TABLE);
 clock.mockReturnValue(RECOVERY_CLOCK_MS);
 await words.loadPictureWords('ru');
 expect(words.pictureWordSource('гулять', 'ru')).toBe('walk');
});

it('concurrent loads share one import and successful tables are not reloaded', async () => {
 let imports = 0;
 vi.doMock(RU_TABLE, () => { imports += 1; return { default: RU_WORDS }; });
 const words = await import('@/constants/pictureWords');
 const first = words.loadPictureWords('ru');
 expect(words.loadPictureWords('ru')).toBe(first);
 await first;
 const version = words.pictureWordsVersion();
 await words.loadPictureWords('ru');
 expect(imports).toBe(1);
 expect(words.pictureWordsVersion()).toBe(version);
});

it.each(EMPTY_LANGUAGE_CASES)('%s keeps a legitimate empty translated-word table', async (lang) => {
 const warning = vi.spyOn(console, 'warn').mockImplementation(() => {});
 const words = await import('@/constants/pictureWords');
 await words.loadPictureWords(lang);
 const version = words.pictureWordsVersion();
 await words.loadPictureWords(lang);
 expect(words.pictureWordsVersion()).toBe(version);
 expect(warning).not.toHaveBeenCalled();
});

it('persistent failures are rate limited without claiming a successful table', async () => {
 const warning = vi.spyOn(console, 'warn').mockImplementation(() => {});
 const clock = vi.spyOn(Date, 'now').mockReturnValue(0);
 vi.doMock(RU_TABLE, () => { throw new Error('persistent table failure fixture'); });
 const words = await import('@/constants/pictureWords');
 await words.loadPictureWords('ru');
 await Promise.all([words.loadPictureWords('ru'), words.loadPictureWords('ru')]);
 expect(warning).toHaveBeenCalledTimes(1);
 clock.mockReturnValue(RECOVERY_CLOCK_MS);
 await words.loadPictureWords('ru');
 expect(warning).toHaveBeenCalledTimes(2);
 expect(words.pictureWordSource('гулять', 'ru')).toBeNull();
 expect(words.pictureWordsStatus('ru')).toBe('error');
 expect(words.pictureWordsVersion()).toBeGreaterThan(0);
});

it.each(WORD_CASES)('%s canonically equivalent %s keeps its approved picture decision', async (lang, word) => {
 const { loadPictureWords } = await import('@/constants/pictureWords');
 const { builtInVocabularySymbol } = await import('@/lib/builtInSymbols');
 await loadPictureWords(lang);
 expect(builtInVocabularySymbol(word.normalize('NFD'), lang)).toEqual(builtInVocabularySymbol(word, lang));
});
