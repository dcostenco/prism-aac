/**
 * lib/uuid — randomId() uniqueness and prefix contracts
 *
 * Note: crypto.randomUUID is mocked in setup.ts (non-configurable), so
 * tests verify the interface contracts (string, unique, prefix) without
 * asserting UUID format.
 */
import { describe, it, expect } from 'vitest';
import { randomId } from '@/lib/uuid';

describe('randomId', () => {
  it('returns a non-empty string', () => {
    const id = randomId();
    expect(typeof id).toBe('string');
    expect(id.length).toBeGreaterThan(0);
  });

  it('prepends prefix when provided', () => {
    expect(randomId('msg-')).toMatch(/^msg-/);
    expect(randomId('tile-')).toMatch(/^tile-/);
  });

  it('returns empty prefix when prefix is empty string', () => {
    const id = randomId('');
    expect(typeof id).toBe('string');
  });

  it('returns unique values on 20 sequential calls', () => {
    const ids = new Set(Array.from({ length: 20 }, () => randomId()));
    expect(ids.size).toBe(20);
  });

  it('prefix-tagged IDs are also unique across 20 calls', () => {
    const ids = new Set(Array.from({ length: 20 }, () => randomId('item-')));
    expect(ids.size).toBe(20);
  });

  it('IDs with different prefixes on same underlying ID are distinct strings', () => {
    // Different prefixes should never produce the same output
    // (prefix is prepended, not replacing any UUID segment)
    const a = randomId('a-');
    const b = randomId('b-');
    expect(a).not.toBe(b);
    expect(a.startsWith('a-')).toBe(true);
    expect(b.startsWith('b-')).toBe(true);
  });
});
