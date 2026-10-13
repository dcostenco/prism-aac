/**
 * Board tiles never start paid picture generation, even on a paid plan.
 *
 * Renders the real tile with the real picture service and a paid profile,
 * and records every request: none may reach the generation route. The
 * control shows the same recorder does see a prediction-bar request, so an
 * empty list means "not asked", not "not observed". Search results are
 * covered in tests/category-panel.test.tsx.
 */
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { act, render } from '@testing-library/react';
import PhraseTile from '@/components/PhraseTile';
import { useAuthStore } from '@/store/authStore';

const PAID = { email: 'paid@example.test', name: 'Paid', plan: 'standard', isPlatformAdmin: false } as const;
let fetchSpy: ReturnType<typeof vi.fn>;

const generationRequests = () =>
  fetchSpy.mock.calls.filter(([url]) => String(url).includes('/prism-aac/pictogram'));

beforeEach(() => {
  Object.defineProperty(URL, 'createObjectURL', { configurable: true, writable: true, value: vi.fn(() => 'blob:picture') });
  fetchSpy = vi.fn(async () => new Response(new ArrayBuffer(8), { status: 200, headers: { 'Content-Type': 'image/png' } }));
  vi.stubGlobal('fetch', fetchSpy);
  useAuthStore.setState({ profile: PAID });
});

afterEach(() => {
  useAuthStore.setState({ profile: null });
  vi.unstubAllGlobals();
});

it('a board tile on a paid plan makes no generation request', async () => {
  await act(async () => { render(<PhraseTile phrase="Cupboard" englishPhrase="Cupboard" onClick={() => {}} />); });
  // Long enough for the tile's picture lookup (hash + request) to run.
  await act(async () => { await new Promise(resolve => setTimeout(resolve, 200)); });
  expect(generationRequests()).toEqual([]);
});

it('control: the same recorder sees a prediction-bar request on a paid plan', async () => {
  const { getPictogramUrl } = await import('@/services/pictogramService');
  expect(await getPictogramUrl('wardrobe', 'en', 'symbols-ai', { generated: true })).toBe('blob:picture');
  expect(generationRequests()).toHaveLength(1);
});
