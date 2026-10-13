/**
 * Board tiles start no picture generation while the portal has it switched off.
 *
 * Renders the real tile with the real picture service and a paid profile, and
 * records every request. A built-in tile shows its bundled symbol and asks the
 * network nothing. A custom tile may read the shared picture cache once, but
 * when the portal answers that new pictures are off it never asks for one.
 * The control shows the same recorder does see a generation request when the
 * portal allows it, so an empty list means "not asked", not "not observed".
 * Search results are covered in tests/category-panel.test.tsx.
 */
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { act, render } from '@testing-library/react';
import PhraseTile from '@/components/PhraseTile';
import { useAuthStore } from '@/store/authStore';

const PAID = { email: 'paid@example.test', name: 'Paid', plan: 'standard', isPlatformAdmin: false } as const;
let fetchSpy: ReturnType<typeof vi.fn>;

const generationOffMiss = () => new Response(JSON.stringify({ styleVersion: 3, generation: false }), {
  status: 404,
  headers: { 'Content-Type': 'application/json', 'X-AAC-Picture-Version': '3', 'X-AAC-Picture-Generation': 'off' },
});

const pictureRequests = () => fetchSpy.mock.calls.map(([url]) => String(url)).filter(url => url.includes('/prism-aac/pictogram'));
const generationRequests = () => pictureRequests().filter(url => !url.includes('cacheOnly=1'));

beforeEach(() => {
  Object.defineProperty(URL, 'createObjectURL', { configurable: true, writable: true, value: vi.fn(() => 'blob:picture') });
  fetchSpy = vi.fn(async () => generationOffMiss());
  vi.stubGlobal('fetch', fetchSpy);
  useAuthStore.setState({ profile: PAID });
});

afterEach(() => {
  useAuthStore.setState({ profile: null });
  vi.unstubAllGlobals();
});

async function settle() {
  // Long enough for the tile's picture lookup (hash + probe) to run.
  await act(async () => { await new Promise(resolve => setTimeout(resolve, 300)); });
}

it('a built-in tile on a paid plan asks the picture service nothing', async () => {
  await act(async () => { render(<PhraseTile phrase="Buckle" builtInPhraseId="ac-buckle" onClick={() => {}} />); });
  await settle();
  expect(pictureRequests()).toEqual([]);
});

it('a custom tile on a paid plan reads the cache once and never asks for a new picture while generation is off', async () => {
  await act(async () => { render(<PhraseTile phrase="Cupboard" englishPhrase="Cupboard" onClick={() => {}} />); });
  await settle();
  expect(generationRequests()).toEqual([]);
  expect(pictureRequests().length).toBeLessThanOrEqual(1);
});

it('control: the same recorder sees a generation request when the portal allows one', async () => {
  let call = 0;
  fetchSpy.mockImplementation(async () => (call++ === 0
    ? new Response(JSON.stringify({ styleVersion: 3 }), { status: 404, headers: { 'Content-Type': 'application/json', 'X-AAC-Picture-Version': '3' } })
    : new Response(new ArrayBuffer(8), { status: 200, headers: { 'Content-Type': 'image/png' } })));
  const { getPictogramUrl } = await import('@/services/pictogramService');
  expect(await getPictogramUrl('wardrobe', 'en', 'symbols-ai')).toBe('blob:picture');
  expect(generationRequests()).toHaveLength(1);
});
