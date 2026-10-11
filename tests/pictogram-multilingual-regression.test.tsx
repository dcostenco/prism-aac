import { beforeEach, afterEach, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, renderHook, waitFor } from '@testing-library/react';
import { readFileSync } from 'node:fs';
import fixtures from './fixtures/pictogram-positive.json';

const state = vi.hoisted(() => ({ language: 'en', mode: 'symbols', generate: vi.fn() }));
vi.mock('@/services/pictogramService', () => ({
 getPictogramUrl: (...args: unknown[]) => state.generate(...args),
 typedWordPicturesEnabled: (mode: string) => mode === 'symbols-ai',
 pictureModeForProfile: () => state.mode,
}));
vi.mock('@/store/settingsStore', () => ({ useSettingsStore: (select: any) => select({ language: state.language }) }));
vi.mock('@/store/authStore', () => ({ useAuthStore: (select: any) => select({ profile: null }) }));
vi.mock('@/hooks/useNearViewport', () => ({ useNearViewport: () => ({ elementRef: { current: null }, isNearViewport: true }) }));

const APP = process.cwd();
const ES_MODULE = '@/constants/generated/pictureWords/es.json';
const RU_MODULE = '@/constants/generated/pictureWords/ru.json';
const ES_TABLE = JSON.parse(readFileSync(APP + '/constants/generated/pictureWords/es.json', 'utf8'));
const DOG_URL = '/prism-aac/symbols/an-dog.png';
const WALK_URL = '/prism-aac/symbols/cw-walk.png';
const MORE_URL = '/prism-aac/symbols/cw-more.png';
const MODES = ['symbols', 'symbols-ai'] as const;

beforeEach(() => {
 vi.resetModules();
 state.language = 'en'; state.mode = 'symbols';
 state.generate.mockReset().mockResolvedValue(null);
});
afterEach(() => {
 cleanup(); vi.useRealTimers(); vi.restoreAllMocks();
 vi.doUnmock(ES_MODULE); vi.doUnmock(RU_MODULE);
});

for (const mode of MODES) {
 it.each(fixtures)('approved $lang $word renders on the prediction hook in ' + mode, async ({ lang, word, file }) => {
  const { loadPictureWords } = await import('@/constants/pictureWords');
  await loadPictureWords(lang);
  const { usePredictionPicture } = await import('@/hooks/usePredictionPicture');
  const { result } = renderHook(() => usePredictionPicture(word, lang as any, mode));
  expect(result.current).toMatchObject({ picture: 'symbol', pictureUrl: '/prism-aac/symbols/' + file });
  expect(state.generate).not.toHaveBeenCalled();
 });
}

it.each(fixtures)('approved $lang board phrase $id keeps its picture and tap insertion', async ({ lang, word, id, file }) => {
 state.language = lang;
 const PhraseTile = (await import('@/components/PhraseTile')).default;
 const onClick = vi.fn();
 const rendered = render(<PhraseTile phrase={word} builtInPhraseId={id} onClick={onClick} />);
 const card = rendered.getByTestId('phrase-tile-card');
 expect(card.getAttribute('data-picture')).toBe('symbol');
 expect(card.querySelector('img')?.getAttribute('src')).toBe('/prism-aac/symbols/' + file);
 expect(card.textContent).toContain(word);
 fireEvent.click(card); expect(onClick).toHaveBeenCalledOnce();
 expect(state.generate).not.toHaveBeenCalled();
});

async function deferredSpanish(mode: 'symbols' | 'symbols-ai') {
 let release!: (value: unknown) => void;
 const pending = new Promise(resolve => { release = resolve; });
 vi.doMock(ES_MODULE, async () => ({ default: await pending }));
 const { usePredictionPicture } = await import('@/hooks/usePredictionPicture');
 const hook = renderHook(() => usePredictionPicture('perros', 'es', mode));
 return { ...hook, release: async () => { await act(async () => { release(ES_TABLE); }); } };
}

it('a deferred Spanish table eventually renders the approved picture in free mode', async () => {
 const hook = await deferredSpanish('symbols');
 expect(state.generate).not.toHaveBeenCalled();
 await hook.release();
 await waitFor(() => expect(hook.result.current.pictureUrl).toBe(DOG_URL));
});

it('a paid cold load waits for the approved Spanish table instead of starting generation', async () => {
 const hook = await deferredSpanish('symbols-ai');
 try { expect(state.generate).not.toHaveBeenCalled(); }
 finally { await hook.release(); }
});

it('a failed table recovers on an idle mounted tile without a second language/load action', async () => {
 vi.useFakeTimers();
 const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
 vi.doMock(RU_MODULE, () => { throw new Error('one transient table failure'); });
 const { pictureWordsStatus } = await import('@/constants/pictureWords');
 const { usePredictionPicture } = await import('@/hooks/usePredictionPicture');
 const { result } = renderHook(() => usePredictionPicture('гулять', 'ru', 'symbols'));
 await act(async () => { await vi.dynamicImportSettled(); });
 expect(pictureWordsStatus('ru')).toBe('error');
 expect(warn).toHaveBeenCalledOnce();
 expect(warn).toHaveBeenCalledWith('Picture-word table load failed', 'ru', expect.any(Error));
 vi.doUnmock(RU_MODULE);
 // Advance the actual retry delay; the same mounted tile must recover without
 // another load call or language change, regardless of full-suite CPU load.
 await act(async () => {
  await vi.advanceTimersByTimeAsync(1_000);
  await vi.dynamicImportSettled();
 });
 expect(pictureWordsStatus('ru')).toBe('ready');
 expect(result.current.pictureUrl).toBe(WALK_URL);
}, 10_000);

it('a previous image error does not suppress the same healthy bundled picture after a language switch', async () => {
 const { loadPictureWords } = await import('@/constants/pictureWords');
 await loadPictureWords('es');
 const { usePredictionPicture } = await import('@/hooks/usePredictionPicture');
 const hook = renderHook(({ word, lang }) => usePredictionPicture(word, lang as any, 'symbols'),
  { initialProps: { word: 'More', lang: 'en' } });
 expect(hook.result.current.pictureUrl).toBe(MORE_URL);
 act(() => hook.result.current.onImageError());
 expect(hook.result.current.picture).toBe('text');
 hook.rerender({ word: 'Más', lang: 'es' });
 expect(hook.result.current.pictureUrl).toBe(MORE_URL);
});

it('a board tile retries the same bundled resource when its locale/content changes after an image error', async () => {
 const PhraseTile = (await import('@/components/PhraseTile')).default;
 const props = { builtInPhraseId: 'cw-more', onClick: vi.fn() };
 const tile = render(<PhraseTile {...props} phrase="More" />);
 const first = tile.getByTestId('phrase-tile-card').querySelector('img');
 expect(first).not.toBeNull();
 fireEvent.error(first!);
 expect(tile.getByTestId('phrase-tile-card').getAttribute('data-picture')).toBe('text');
 state.language = 'es';
 tile.rerender(<PhraseTile {...props} phrase="Más" />);
 expect(tile.getByTestId('phrase-tile-card').querySelector('img')?.getAttribute('src')).toBe(MORE_URL);
});

it('a late generated answer from a previous language never appears on the current tile', async () => {
 const pending = new Map<string, (value: string) => void>();
 state.generate.mockImplementation((word: string, lang: string) => new Promise(resolve => pending.set(lang, resolve)));
 const { usePredictionPicture } = await import('@/hooks/usePredictionPicture');
 const hook = renderHook(({ lang }) => usePredictionPicture('fixtureword', lang as any, 'symbols-ai'),
  { initialProps: { lang: 'en' } });
 hook.rerender({ lang: 'es' });
 await act(async () => { pending.get('en')!('blob:old-language'); });
 expect(hook.result.current.pictureUrl).toBeNull();
 await waitFor(() => expect(pending.has('es')).toBe(true));
 await act(async () => { pending.get('es')!('blob:current-language'); });
 expect(hook.result.current.pictureUrl).toBe('blob:current-language');
});

it('an idle image recovers automatically without changing the word or language', async () => {
 const { usePredictionPicture } = await import('@/hooks/usePredictionPicture');
 const hook = renderHook(() => usePredictionPicture('More', 'en', 'symbols'));
 act(() => hook.result.current.onImageError());
 expect(hook.result.current.reason).toBe('image-error');
 await waitFor(() => expect(hook.result.current.pictureUrl).toBe(MORE_URL), { timeout: 5_000 });
 expect(state.generate).not.toHaveBeenCalled();
});

it('persistent image errors exhaust a bounded retry budget', async () => {
 vi.useFakeTimers();
 const { useRecoverablePicture } = await import('@/hooks/useRecoverablePicture');
 const hook = renderHook(() => useRecoverablePicture(MORE_URL, 'stable-tile'));
 for (const delay of [1_000, 2_000]) {
  act(() => hook.result.current.onError());
  expect(hook.result.current.url).toBeNull();
  await act(async () => { await vi.advanceTimersByTimeAsync(delay); });
  expect(hook.result.current.url).toBe(MORE_URL);
 }
 act(() => hook.result.current.onError());
 await act(async () => { await vi.advanceTimersByTimeAsync(60_000); });
 expect(hook.result.current.url).toBeNull();
});

it('an old image error callback cannot hide the current resource', async () => {
 const { useRecoverablePicture } = await import('@/hooks/useRecoverablePicture');
 const hook = renderHook(({ url }) => useRecoverablePicture(url, 'same-slot'),
  { initialProps: { url: MORE_URL } });
 const oldError = hook.result.current.onError;
 hook.rerender({ url: DOG_URL });
 act(() => oldError());
 expect(hook.result.current.url).toBe(DOG_URL);
});

it('returning to an exhausted resource starts a new activation and ignores abandoned errors', async () => {
 vi.useFakeTimers();
 const { useRecoverablePicture } = await import('@/hooks/useRecoverablePicture');
 const hook = renderHook(({ url }) => useRecoverablePicture(url, 'same-slot'),
  { initialProps: { url: MORE_URL } });
 const oldError = hook.result.current.onError;
 for (const delay of [1_000, 2_000]) {
  act(() => hook.result.current.onError());
  await act(async () => { await vi.advanceTimersByTimeAsync(delay); });
 }
 act(() => hook.result.current.onError());
 expect(hook.result.current.url).toBeNull();
 hook.rerender({ url: DOG_URL });
 expect(hook.result.current.url).toBe(DOG_URL);
 hook.rerender({ url: MORE_URL });
 expect(hook.result.current.url).toBe(MORE_URL);
 act(() => oldError());
 expect(hook.result.current.url).toBe(MORE_URL);
});

it('failed-table background retries stop when the last tile unmounts', async () => {
 vi.useFakeTimers();
 const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
 vi.doMock(RU_MODULE, () => { throw new Error('persistent table fixture'); });
 const { usePredictionPicture } = await import('@/hooks/usePredictionPicture');
 const hook = renderHook(() => usePredictionPicture('гулять', 'ru', 'symbols'));
 await vi.waitFor(() => expect(warn).toHaveBeenCalledOnce());
 hook.unmount();
 await act(async () => { await vi.advanceTimersByTimeAsync(10_000); });
 expect(warn).toHaveBeenCalledOnce();
});

it('a persistent active-language failure stops after the initial import and two retries', async () => {
 vi.useFakeTimers();
 const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
 vi.doMock(RU_MODULE, () => { throw new Error('persistent table fixture'); });
 const { usePredictionPicture } = await import('@/hooks/usePredictionPicture');
 renderHook(() => usePredictionPicture('гулять', 'ru', 'symbols'));
 await vi.waitFor(() => expect(warn).toHaveBeenCalledTimes(3), { timeout: 5_000, interval: 100 });
 await act(async () => { await vi.advanceTimersByTimeAsync(60_000); });
 expect(warn).toHaveBeenCalledTimes(3);
});

it('a generated board picture is keyed to its displayed language and content', async () => {
 state.mode = 'symbols-ai';
 state.generate.mockResolvedValueOnce(DOG_URL).mockReturnValueOnce(new Promise(() => {}));
 const PhraseTile = (await import('@/components/PhraseTile')).default;
 const props = { englishPhrase: 'Dog', onClick: vi.fn() };
 const tile = render(<PhraseTile {...props} phrase="Dog" />);
 await waitFor(() => expect(tile.getByTestId('phrase-tile-card').querySelector('img')?.getAttribute('src')).toBe(DOG_URL));
 state.language = 'es';
 tile.rerender(<PhraseTile {...props} phrase="Perro" />);
 expect(tile.getByTestId('phrase-tile-card').getAttribute('data-picture')).toBe('pending');
 expect(tile.getByTestId('phrase-tile-card').querySelector('img')).toBeNull();
});

it('an explicit caregiver picture survives language and plan changes', async () => {
 const PhraseTile = (await import('@/components/PhraseTile')).default;
 const props = { customImageUrl: DOG_URL, onClick: vi.fn() };
 const tile = render(<PhraseTile {...props} phrase="Dog" />);
 state.language = 'es'; state.mode = 'symbols-ai';
 tile.rerender(<PhraseTile {...props} phrase="Perro" />);
 expect(tile.getByTestId('phrase-tile-card').getAttribute('data-picture')).toBe('custom');
 expect(tile.getByTestId('phrase-tile-card').querySelector('img')?.getAttribute('src')).toBe(DOG_URL);
 expect(state.generate).not.toHaveBeenCalled();
});

it.each(['için', 'İçin', 'İÇİN'])('Turkish %s retains its approved For picture across casing', async word => {
 const { loadPictureWords } = await import('@/constants/pictureWords');
 await loadPictureWords('tr');
 const { resolveVocabularyPicture } = await import('@/lib/builtInSymbols');
 expect(resolveVocabularyPicture(word, 'tr')).toMatchObject({ kind: 'symbol', url: '/prism-aac/symbols/cw-for.png' });
});
