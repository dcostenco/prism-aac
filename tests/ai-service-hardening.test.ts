/**
 * aiService hardening tests — military grade.
 *
 * Covers the critical synalux-facing paths not tested by existing files:
 *   - fetchSynaluxProfile(): two-step lookup (/auth/session + /roles/me), null
 *     on 401/throw, free-tier fallback when roles/me fails, aac_plan preference,
 *     is_platform_admin, credentials:include guard
 *   - parseCaregiverNote(): empty input → note_only, valid JSON parsed, JSON
 *     parse failure → fallback, action cap (20), payload string caps, boostCount
 *     and newSortOrder clamp, code-fence strip
 *   - inferCardIcon(): emoji extracted from first code point, ASCII → '💬',
 *     error → '💬'
 *
 * Pattern for AI route tests: reject Ollama fetch (localhost), return JSON
 * from the Synalux cloud path so `route()` resolves deterministically.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  fetchSynaluxProfile,
  parseCaregiverNote,
  inferCardIcon,
} from '@/services/aiService';

const fetchMock = vi.fn();

beforeEach(() => {
  globalThis.fetch = fetchMock as unknown as typeof fetch;
  fetchMock.mockReset();
});

afterEach(() => vi.clearAllMocks());

// ── Helpers ────────────────────────────────────────────────────────────────

/** Return a non-streaming Synalux chat response. */
function synaluxChat(content: string): Response {
  return new Response(
    JSON.stringify({ choices: [{ message: { content } }] }),
    { status: 200, headers: { 'Content-Type': 'application/json' } },
  );
}

/**
 * Wire up fetch so that:
 *   - Ollama (localhost:11434) → 503 (unavailable)
 *   - Synalux /roles/me        → ignored by these tests (covered elsewhere)
 *   - Synalux /prism-aac/chat  → returns `content`
 *   - everything else          → 404
 */
function mockRouteToCloud(content: string): void {
  fetchMock.mockImplementation(async (url: string) => {
    if (String(url).includes('localhost:11434')) return new Response('', { status: 503 });
    if (String(url).includes('/prism-aac/chat')) return synaluxChat(content);
    return new Response('', { status: 404 });
  });
}

// ── fetchSynaluxProfile — happy path ──────────────────────────────────────

describe('fetchSynaluxProfile — happy path', () => {
  function mockSessionAndRoles(
    sessionBody: Record<string, unknown>,
    rolesBody: Record<string, unknown>,
    rolesStatus = 200,
  ) {
    fetchMock
      .mockResolvedValueOnce(
        new Response(JSON.stringify(sessionBody), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify(rolesBody), {
          status: rolesStatus,
          headers: { 'Content-Type': 'application/json' },
        }),
      );
  }

  it('returns email/name/plan when both calls succeed', async () => {
    mockSessionAndRoles(
      { user: { email: 'alice@example.com', name: 'Alice' } },
      { aac_plan: 'advanced', is_platform_admin: false },
    );
    const profile = await fetchSynaluxProfile();
    expect(profile).not.toBeNull();
    expect(profile!.email).toBe('alice@example.com');
    expect(profile!.name).toBe('Alice');
    expect(profile!.plan).toBe('advanced');
    expect(profile!.isPlatformAdmin).toBe(false);
  });

  it('prefers aac_plan over plan when both fields are present', async () => {
    mockSessionAndRoles(
      { user: { email: 'b@b.com', name: 'B' } },
      { aac_plan: 'enterprise', plan: 'standard' },
    );
    const profile = await fetchSynaluxProfile();
    expect(profile!.plan).toBe('enterprise');
  });

  it('falls back to plan field when aac_plan is absent', async () => {
    mockSessionAndRoles(
      { user: { email: 'c@c.com', name: 'C' } },
      { plan: 'standard' },
    );
    const profile = await fetchSynaluxProfile();
    expect(profile!.plan).toBe('standard');
  });

  it('extracts is_platform_admin correctly', async () => {
    mockSessionAndRoles(
      { user: { email: 'd@d.com', name: 'D' } },
      { aac_plan: 'free', is_platform_admin: true },
    );
    const profile = await fetchSynaluxProfile();
    expect(profile!.isPlatformAdmin).toBe(true);
  });

  it('falls back to email as name when name field is absent', async () => {
    mockSessionAndRoles(
      { user: { email: 'noname@x.com' } },
      { aac_plan: 'free' },
    );
    const profile = await fetchSynaluxProfile();
    expect(profile!.name).toBe('noname@x.com');
  });

  it('calls /api/auth/session with credentials:include', async () => {
    mockSessionAndRoles(
      { user: { email: 'e@e.com', name: 'E' } },
      {},
    );
    await fetchSynaluxProfile();
    const [[url, init]] = fetchMock.mock.calls as [string, RequestInit][];
    expect(url).toContain('/api/auth/session');
    expect(init.credentials).toBe('include');
  });
});

// ── fetchSynaluxProfile — session failure paths ───────────────────────────

describe('fetchSynaluxProfile — session failure', () => {
  it('returns null when session call returns 401', async () => {
    fetchMock.mockResolvedValueOnce(new Response('', { status: 401 }));
    expect(await fetchSynaluxProfile()).toBeNull();
  });

  it('returns null when session fetch throws', async () => {
    fetchMock.mockRejectedValueOnce(new Error('Network down'));
    expect(await fetchSynaluxProfile()).toBeNull();
  });

  it('returns null when session body has no user.email', async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ user: { name: 'Ghost' } }), { status: 200 }),
    );
    expect(await fetchSynaluxProfile()).toBeNull();
  });

  it('returns null when session body is null', async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify(null), { status: 200 }),
    );
    expect(await fetchSynaluxProfile()).toBeNull();
  });
});

// ── fetchSynaluxProfile — roles/me failure paths (best-effort) ───────────

describe('fetchSynaluxProfile — roles/me failure (best-effort free tier)', () => {
  it('returns free-tier profile when roles/me returns 403', async () => {
    fetchMock
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ user: { email: 'f@f.com', name: 'F' } }), { status: 200 }),
      )
      .mockResolvedValueOnce(new Response('', { status: 403 }));
    const profile = await fetchSynaluxProfile();
    expect(profile).not.toBeNull();
    expect(profile!.plan).toBe('free');
    expect(profile!.email).toBe('f@f.com');
  });

  it('returns free-tier profile when roles/me throws (network error)', async () => {
    fetchMock
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ user: { email: 'g@g.com', name: 'G' } }), { status: 200 }),
      )
      .mockRejectedValueOnce(new Error('Connection refused'));
    const profile = await fetchSynaluxProfile();
    expect(profile).not.toBeNull();
    expect(profile!.plan).toBe('free');
  });

  it('returns free-tier when roles/me returns 200 but body has no plan fields', async () => {
    fetchMock
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ user: { email: 'h@h.com', name: 'H' } }), { status: 200 }),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ some_other_field: true }), { status: 200 }),
      );
    const profile = await fetchSynaluxProfile();
    expect(profile!.plan).toBe('free');
  });
});

// ── parseCaregiverNote — empty / trivial input ─────────────────────────────

describe('parseCaregiverNote — empty input', () => {
  it('returns note_only for an empty string without calling route', async () => {
    const result = await parseCaregiverNote('');
    expect(result.actions[0].type).toBe('note_only');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('returns note_only for whitespace-only input', async () => {
    const result = await parseCaregiverNote('   \n\t  ');
    expect(result.actions[0].type).toBe('note_only');
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

// ── parseCaregiverNote — valid JSON parse ─────────────────────────────────

describe('parseCaregiverNote — valid AI response', () => {
  it('parses a single add_phrase action from a clean JSON array', async () => {
    const payload = JSON.stringify([
      { type: 'add_phrase', description: 'Add "more" to Food', payload: { categoryId: 'food', text: 'more' } },
    ]);
    mockRouteToCloud(payload);
    const result = await parseCaregiverNote('Add more to food');
    expect(result.actions).toHaveLength(1);
    expect(result.actions[0].type).toBe('add_phrase');
    expect((result.actions[0].payload as { text: string }).text).toBe('more');
  });

  it('strips code fences (```json ... ```) before parsing', async () => {
    const payload = '```json\n[{"type":"note_only","description":"obs","payload":{}}]\n```';
    mockRouteToCloud(payload);
    const result = await parseCaregiverNote('Just an observation');
    expect(result.actions[0].type).toBe('note_only');
  });

  it('strips plain ``` fences before parsing', async () => {
    const payload = '```\n[{"type":"note_only","description":"obs","payload":{}}]\n```';
    mockRouteToCloud(payload);
    const result = await parseCaregiverNote('Observation');
    expect(result.actions[0].type).toBe('note_only');
  });

  it('returns note_only when AI returns malformed JSON', async () => {
    mockRouteToCloud('this is not json at all');
    const result = await parseCaregiverNote('Do something');
    expect(result.actions[0].type).toBe('note_only');
    expect(result.summary).toBe('Saved as note');
  });

  it('returns note_only when AI returns valid JSON but not an array', async () => {
    mockRouteToCloud('{"type":"add_phrase"}');
    const result = await parseCaregiverNote('Do something');
    expect(result.actions[0].type).toBe('note_only');
  });

  it('summary joins action descriptions with semicolon', async () => {
    const payload = JSON.stringify([
      { type: 'add_phrase', description: 'First', payload: {} },
      { type: 'add_phrase', description: 'Second', payload: {} },
    ]);
    mockRouteToCloud(payload);
    const result = await parseCaregiverNote('Add two phrases');
    expect(result.summary).toBe('First; Second');
  });

  it('filters out actions whose type is not a string', async () => {
    const payload = JSON.stringify([
      { type: 42, description: 'Bad', payload: {} },
      { type: 'note_only', description: 'Good', payload: {} },
    ]);
    mockRouteToCloud(payload);
    const result = await parseCaregiverNote('Mixed');
    expect(result.actions).toHaveLength(1);
    expect(result.actions[0].type).toBe('note_only');
  });
});

// ── parseCaregiverNote — action cap (≤ 20) ────────────────────────────────

describe('parseCaregiverNote — action cap', () => {
  it('caps parsed actions at 20 even when AI returns more', async () => {
    const actions = Array.from({ length: 30 }, (_, i) => ({
      type: 'add_phrase',
      description: `Action ${i}`,
      payload: { text: `phrase${i}` },
    }));
    mockRouteToCloud(JSON.stringify(actions));
    const result = await parseCaregiverNote('Add thirty phrases');
    expect(result.actions).toHaveLength(20);
  });
});

// ── parseCaregiverNote — payload field capping ────────────────────────────

describe('parseCaregiverNote — payload field capping', () => {
  it('caps text payload at 500 characters', async () => {
    const longText = 'x'.repeat(600);
    const payload = JSON.stringify([
      { type: 'add_phrase', description: 'd', payload: { text: longText } },
    ]);
    mockRouteToCloud(payload);
    const result = await parseCaregiverNote('Long text');
    expect((result.actions[0].payload as { text: string }).text).toHaveLength(500);
  });

  it('caps name payload at 80 characters', async () => {
    const longName = 'n'.repeat(200);
    const payload = JSON.stringify([
      { type: 'add_category', description: 'd', payload: { name: longName } },
    ]);
    mockRouteToCloud(payload);
    const result = await parseCaregiverNote('Long name');
    expect((result.actions[0].payload as { name: string }).name).toHaveLength(80);
  });

  it('clamps boostCount to 0 when negative', async () => {
    const payload = JSON.stringify([
      { type: 'boost_word', description: 'd', payload: { word: 'test', boostCount: -5 } },
    ]);
    mockRouteToCloud(payload);
    const result = await parseCaregiverNote('Negative boost');
    expect((result.actions[0].payload as { boostCount: number }).boostCount).toBe(0);
  });

  it('clamps boostCount to 100 when over 100', async () => {
    const payload = JSON.stringify([
      { type: 'boost_word', description: 'd', payload: { word: 'test', boostCount: 999 } },
    ]);
    mockRouteToCloud(payload);
    const result = await parseCaregiverNote('Huge boost');
    expect((result.actions[0].payload as { boostCount: number }).boostCount).toBe(100);
  });

  it('clamps newSortOrder to 0 when negative', async () => {
    const payload = JSON.stringify([
      { type: 'reorder_phrase', description: 'd', payload: { phraseId: 'p1', newSortOrder: -100, categoryId: 'food' } },
    ]);
    mockRouteToCloud(payload);
    const result = await parseCaregiverNote('Negative sort');
    expect((result.actions[0].payload as { newSortOrder: number }).newSortOrder).toBe(0);
  });

  it('clamps newSortOrder to 10000 when over 10000', async () => {
    const payload = JSON.stringify([
      { type: 'reorder_phrase', description: 'd', payload: { phraseId: 'p1', newSortOrder: 99999, categoryId: 'food' } },
    ]);
    mockRouteToCloud(payload);
    const result = await parseCaregiverNote('Over-the-top sort');
    expect((result.actions[0].payload as { newSortOrder: number }).newSortOrder).toBe(10000);
  });

  it('caps description field at 500 characters', async () => {
    const longDesc = 'd'.repeat(600);
    const payload = JSON.stringify([
      { type: 'note_only', description: longDesc, payload: {} },
    ]);
    mockRouteToCloud(payload);
    const result = await parseCaregiverNote('Long desc');
    expect(result.actions[0].description).toHaveLength(500);
  });
});

// ── inferCardIcon ─────────────────────────────────────────────────────────

describe('inferCardIcon — emoji extraction and fallback', () => {
  it('returns the first character when AI returns a valid emoji', async () => {
    mockRouteToCloud('🍎');
    const icon = await inferCardIcon('apple');
    expect(icon).toBe('🍎');
  });

  it('returns "💬" when AI returns plain ASCII text (no emoji)', async () => {
    mockRouteToCloud('apple');
    const icon = await inferCardIcon('apple');
    expect(icon).toBe('💬');
  });

  it('returns "💬" when AI response is empty', async () => {
    mockRouteToCloud('');
    const icon = await inferCardIcon('unknown');
    expect(icon).toBe('💬');
  });

  it('returns "💬" when both Ollama and Synalux throw (offline)', async () => {
    fetchMock.mockRejectedValue(new Error('Network down'));
    const icon = await inferCardIcon('food');
    expect(icon).toBe('💬');
  });

  it('returns first emoji even when trailing text follows it', async () => {
    mockRouteToCloud('🌊 water');
    const icon = await inferCardIcon('water');
    expect(icon).toBe('🌊');
  });

  it('handles multi-codepoint emoji (surrogate pair) as a single icon', async () => {
    // 👨‍👩‍👧 = man+ZWJ+woman+ZWJ+girl (spread iterates by code point, not UTF-16 unit)
    mockRouteToCloud('👨‍👩‍👧');
    const icon = await inferCardIcon('family');
    // Must return non-ASCII (the emoji), not '💬'
    const cp = icon.codePointAt(0) ?? 0;
    expect(cp).toBeGreaterThan(127);
  });
});
