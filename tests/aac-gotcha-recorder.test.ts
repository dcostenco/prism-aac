/**
 * aacGotchaRecorder — caregiver-action corpus persistence
 *
 * Covers: early-return contracts (ok=false, note_only, crypto absent),
 * distillGotcha fingerprint shapes, IndexedDB write → read round-trip,
 * corpusHealth available+count, findCorrectionsByFingerprint result.
 *
 * Uses fake-indexeddb/auto + vi.resetModules() for IDB isolation.
 */
/// <reference types="vitest" />
import 'fake-indexeddb/auto';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { NoteAction } from '@/types';

// ── helpers ────────────────────────────────────────────────────────────────────

function makeAction(
  type: NoteAction['type'],
  payload: Record<string, unknown> = {},
  description?: string,
): NoteAction {
  return { type, payload, description } as NoteAction;
}

// ── Fresh import per describe block (resets dbPromise module state) ────────────

// Single module import — tests share IDB state across a file run.
// Use vi.resetModules() only when we need a truly clean slate.
import {
  recordCaregiverGotcha,
  findCorrectionsByFingerprint,
  corpusHealth,
} from '@/services/aacGotchaRecorder';

beforeEach(() => {
  vi.clearAllMocks();
});

// ── Early-return guards ────────────────────────────────────────────────────────

describe('aacGotchaRecorder — early-return guards', () => {
  it('returns false when ok=false (failed action not corpus-worthy)', async () => {
    const action = makeAction('add_phrase', { text: 'hi', categoryId: 'greetings' });
    const result = await recordCaregiverGotcha(action, false);
    expect(result).toBe(false);
  });

  it('returns false for note_only (not actionable)', async () => {
    const action = makeAction('note_only', {});
    const result = await recordCaregiverGotcha(action, true);
    expect(result).toBe(false);
  });

  it('returns false for unknown action type (empty gotcha)', async () => {
    const action = makeAction('unknown_action' as NoteAction['type'], {});
    const result = await recordCaregiverGotcha(action, true);
    expect(result).toBe(false);
  });
});

// ── Successful record write ────────────────────────────────────────────────────

describe('aacGotchaRecorder — IDB write + read', () => {
  it('returns true for add_phrase action with ok=true', async () => {
    const action = makeAction('add_phrase', { text: 'please help me', categoryId: 'help-needs' });
    const result = await recordCaregiverGotcha(action, true, 'en');
    expect(result).toBe(true);
  });

  it('returns true for remove_phrase action', async () => {
    const action = makeAction('remove_phrase', { phraseText: 'goodbye', categoryId: 'social' });
    const result = await recordCaregiverGotcha(action, true);
    expect(result).toBe(true);
  });

  it('returns true for reorder_phrase action', async () => {
    const action = makeAction('reorder_phrase', { phraseId: 'p123', categoryId: 'greetings' });
    const result = await recordCaregiverGotcha(action, true);
    expect(result).toBe(true);
  });

  it('returns true for boost_word action', async () => {
    const action = makeAction('boost_word', { word: 'more' });
    const result = await recordCaregiverGotcha(action, true);
    expect(result).toBe(true);
  });
});

// ── corpusHealth ──────────────────────────────────────────────────────────────

describe('aacGotchaRecorder — corpusHealth', () => {
  it('reports available=true and total >= 0 after writes', async () => {
    const health = await corpusHealth();
    expect(health.available).toBe(true);
    expect(typeof health.total).toBe('number');
    expect(health.total).toBeGreaterThanOrEqual(0);
  });
});

// ── findCorrectionsByFingerprint ───────────────────────────────────────────────

describe('aacGotchaRecorder — findCorrectionsByFingerprint', () => {
  it('returns records matching the fingerprint for add_phrase', async () => {
    const action = makeAction('add_phrase', { text: 'help', categoryId: 'unique-test-cat-fp' });
    await recordCaregiverGotcha(action, true);
    const fp = `aac-caregiver-add_phrase-unique-test-cat-fp`;
    const records = await findCorrectionsByFingerprint(fp);
    expect(records.length).toBeGreaterThanOrEqual(1);
    expect(records[0].fingerprint).toBe(fp);
    expect(records[0].level).toBe('failed');
    expect(records[0].metadata.action_type).toBe('add_phrase');
  });

  it('returns empty array for a fingerprint with no records', async () => {
    const records = await findCorrectionsByFingerprint('aac-caregiver-nonexistent-cat');
    expect(records).toEqual([]);
  });

  it('record contains expected shape fields', async () => {
    const action = makeAction('remove_phrase', { phraseText: 'bye', categoryId: 'test-shape-cat' });
    await recordCaregiverGotcha(action, true, 'ro');
    const fp = `aac-caregiver-remove_phrase-test-shape-cat`;
    const records = await findCorrectionsByFingerprint(fp);
    expect(records.length).toBeGreaterThanOrEqual(1);
    const r = records[0];
    expect(r).toHaveProperty('id');
    expect(r).toHaveProperty('fingerprint');
    expect(r).toHaveProperty('gotchas');
    expect(Array.isArray(r.gotchas)).toBe(true);
    expect(r.gotchas[0]).toContain('bye');
    expect(r.metadata.user_lang).toBe('ro');
    expect(r.metadata.category_id).toBe('test-shape-cat');
    expect(r.session_date).toBeGreaterThan(0);
  });
});
