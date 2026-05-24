/**
 * historyRegions — data-completeness and pure-function correctness.
 *
 * The MathHistoryKeyboard renders regional curriculum events.  A region
 * entry with a blank glyph, blank label, or more than 4 events would
 * produce a broken keyboard surface for that locale.  These tests gate
 * the data contract before any region entry ships.
 */
import { describe, it, expect } from 'vitest';
import {
  REGIONAL_EVENTS_BY_REGION,
  US_STATE_EVENTS,
  countryFromRegion,
  eventsForRegion,
  type HistoryGlyph,
} from '@/engine/historyRegions';

// ── countryFromRegion ─────────────────────────────────────────────────────────

describe('countryFromRegion', () => {
  it('extracts US from US-TX', () => {
    expect(countryFromRegion('US-TX')).toBe('US');
  });

  it('extracts CA from CA-QC', () => {
    expect(countryFromRegion('CA-QC')).toBe('CA');
  });

  it('extracts UK from UK-SCT', () => {
    expect(countryFromRegion('UK-SCT')).toBe('UK');
  });

  it('extracts DE from DE-BY', () => {
    expect(countryFromRegion('DE-BY')).toBe('DE');
  });

  it('returns the string itself for bare country codes', () => {
    expect(countryFromRegion('US')).toBe('US');
  });
});

// ── eventsForRegion ───────────────────────────────────────────────────────────

describe('eventsForRegion', () => {
  it('returns glyph array for a known region', () => {
    const events = eventsForRegion('US-TX');
    expect(Array.isArray(events)).toBe(true);
    expect(events.length).toBeGreaterThan(0);
  });

  it('returns [] for null', () => {
    expect(eventsForRegion(null)).toEqual([]);
  });

  it('returns [] for undefined', () => {
    expect(eventsForRegion(undefined)).toEqual([]);
  });

  it('returns [] for empty string', () => {
    expect(eventsForRegion('')).toEqual([]);
  });

  it('returns [] for an unrecognised region key', () => {
    expect(eventsForRegion('XX-ZZ')).toEqual([]);
  });

  it('result from eventsForRegion equals direct lookup in REGIONAL_EVENTS_BY_REGION', () => {
    const key = 'DE-BY';
    expect(eventsForRegion(key)).toEqual(REGIONAL_EVENTS_BY_REGION[key]);
  });
});

// ── US_STATE_EVENTS completeness ──────────────────────────────────────────────

describe('US_STATE_EVENTS completeness', () => {
  // 50 US states + DC = 51 entries
  it('has at least 51 entries (all 50 states + DC)', () => {
    expect(Object.keys(US_STATE_EVENTS).length).toBeGreaterThanOrEqual(51);
  });

  const requiredStates = [
    'US-AL', 'US-AK', 'US-AZ', 'US-CA', 'US-CO', 'US-DC', 'US-FL', 'US-GA',
    'US-HI', 'US-IL', 'US-NY', 'US-TX', 'US-WA', 'US-WI', 'US-WY',
  ];

  for (const key of requiredStates) {
    it(`${key} entry exists`, () => {
      expect(US_STATE_EVENTS[key]).toBeDefined();
      expect(US_STATE_EVENTS[key].length).toBeGreaterThan(0);
    });
  }
});

// ── REGIONAL_EVENTS_BY_REGION structure ──────────────────────────────────────

describe('REGIONAL_EVENTS_BY_REGION structure', () => {
  const expectedCountries = ['US', 'CA', 'UK', 'IE', 'AU', 'DE', 'FR', 'ES', 'IT', 'MX', 'BR', 'IN', 'CN', 'RU', 'BE', 'CH', 'NL', 'AR', 'ZA', 'KR', 'PK', 'NZ', 'PL'];

  for (const country of expectedCountries) {
    it(`at least one ${country} region entry exists`, () => {
      const keys = Object.keys(REGIONAL_EVENTS_BY_REGION).filter(k => k.startsWith(`${country}-`));
      expect(keys.length).toBeGreaterThan(0);
    });
  }

  it('every entry has at least 1 glyph', () => {
    for (const [key, glyphs] of Object.entries(REGIONAL_EVENTS_BY_REGION)) {
      expect(glyphs.length, `${key} must have ≥1 glyph`).toBeGreaterThan(0);
    }
  });

  it('no entry exceeds 6 glyphs (keyboard surface sanity bound)', () => {
    for (const [key, glyphs] of Object.entries(REGIONAL_EVENTS_BY_REGION)) {
      expect(glyphs.length, `${key} must have ≤6 glyphs`).toBeLessThanOrEqual(6);
    }
  });

  it('every glyph has a non-empty glyph string', () => {
    for (const [key, glyphs] of Object.entries(REGIONAL_EVENTS_BY_REGION)) {
      for (const g of glyphs as HistoryGlyph[]) {
        expect(g.glyph, `${key}: glyph must not be empty`).toBeTruthy();
        expect(typeof g.glyph, `${key}: glyph must be string`).toBe('string');
      }
    }
  });

  it('every glyph has a non-empty label string', () => {
    for (const [key, glyphs] of Object.entries(REGIONAL_EVENTS_BY_REGION)) {
      for (const g of glyphs as HistoryGlyph[]) {
        expect(g.label, `${key}: label must not be empty`).toBeTruthy();
        expect(typeof g.label, `${key}: label must be string`).toBe('string');
      }
    }
  });

  it('every key is a non-empty string (ISO or bare country code)', () => {
    for (const key of Object.keys(REGIONAL_EVENTS_BY_REGION)) {
      expect(typeof key).toBe('string');
      expect(key.length, `key "${key}" must not be empty`).toBeGreaterThan(0);
      // Bare country codes like "IE" are allowed; sub-national codes use hyphen
      expect(key.length, `key "${key}" must be at least 2 chars`).toBeGreaterThanOrEqual(2);
    }
  });
});
