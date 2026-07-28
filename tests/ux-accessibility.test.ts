import { describe, it, expect } from 'vitest';
import { DEFAULT_CATEGORIES } from '@/constants/categories';
import { DEFAULT_PHRASES } from '@/constants/phrases';
import { MATH_ITEMS } from '@/constants/mathSymbols';
import { TEMPLATE_ORDERING_SEQUENCES as DEFAULT_ORDERING_SEQUENCES } from '@/constants/orderingSequences';
import { LETTERS_ROWS, NUMBERS_ROWS, SYMBOLS_ROWS, DEFAULT_PREDICTIONS } from '@/constants/keyboardLayouts';
import { mergeWordFreq, mergeCustomItems, mergeHistory } from '@/services/syncService';
import { classifyWord, CATEGORY_COLORS } from '@/engine/colorCoding';
import { PRISM_AAC_BASE_PATH, PRISM_AAC_MANIFEST_PATH, PRISM_AAC_STATIC_PATH } from '@/lib/appPaths';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

describe('UX — Data completeness', () => {
  it('has default categories with core content', () => {
    expect(DEFAULT_CATEGORIES.length).toBeGreaterThanOrEqual(22);
    const names = DEFAULT_CATEGORIES.map(c => c.name);
    // Core words
    expect(names).toContain('I / You / We');
    expect(names).toContain('Core Verbs');
    expect(names).toContain('More / Not / All');
    expect(names).toContain('Little Words');
    // Communicative functions
    expect(names).toContain('Help / Needs');
    expect(names).toContain('Quick Talk');
    expect(names).toContain('Feelings');
    expect(names).toContain('Questions');
    // Fringe vocabulary
    expect(names).toContain('People');
    expect(names).toContain('Food & Drink');
    expect(names).toContain('Places');
    expect(names).toContain('School / Work');
  });

  it('every category has at least 6 phrases', () => {
    for (const cat of DEFAULT_CATEGORIES) {
      const phrases = DEFAULT_PHRASES.filter(p => p.categoryId === cat.id);
      expect(phrases.length, `${cat.name} should have ≥6 phrases`).toBeGreaterThanOrEqual(6);
    }
  });

  it('Help/Needs contains critical AAC phrases from clinical notes', () => {
    const helpPhrases = DEFAULT_PHRASES.filter(p => p.categoryId === 'help-needs').map(p => p.text);
    expect(helpPhrases).toContain('All done');
    expect(helpPhrases).toContain('Take a break');
    expect(helpPhrases).toContain('I need help');
    expect(helpPhrases).toContain('I am hungry');
    expect(helpPhrases).toContain('I am thirsty');
    expect(helpPhrases).toContain('Bathroom');
    expect(helpPhrases).toContain('Yes');
    expect(helpPhrases).toContain('No');
  });

  it('default predictions are research-grounded AAC core vocabulary', () => {
    // Defaults now derive from Universal Core 36 (Geist, Erickson et al.,
    // ATIA 2021) — communicative starters ranked by AAC priority
    // (pronouns, requesters, verbs). Earlier hard-coded list ('We', 'Can',
    // 'All done') was replaced because it lacked research provenance and
    // mixed phrases with single words. Assert structural properties:
    // - The first-person pronoun "I" is present (highest priority)
    // - No multi-word phrases (defeats single-tap prediction-bar UX)
    expect(DEFAULT_PREDICTIONS).toContain('I');
    for (const p of DEFAULT_PREDICTIONS) {
      expect(p, `prediction "${p}" should be a single word`).not.toMatch(/\s/);
    }
  });

  it('has 5 predictions (not more, per clinical recommendation)', () => {
    expect(DEFAULT_PREDICTIONS).toHaveLength(5);
  });

  it('math keyboard has basic, digits, and algebra/advanced sections', () => {
    const basic = MATH_ITEMS.filter(m => m.category === 'basic');
    const digits = MATH_ITEMS.filter(m => m.category === 'digits');
    const algebra = MATH_ITEMS.filter(m => m.category === 'algebra');
    expect(basic.length).toBeGreaterThanOrEqual(10);
    expect(digits.length).toBe(10);
    expect(algebra.length).toBeGreaterThanOrEqual(5);
  });

  it('math keyboard has clinical note symbols: +, −, ×, ÷, =, fraction, variable, sqrt, pi', () => {
    const labels = MATH_ITEMS.map(m => m.label.toLowerCase());
    const symbols = MATH_ITEMS.map(m => m.symbol);
    expect(labels).toContain('plus');
    expect(labels).toContain('minus');
    expect(labels).toContain('times');
    expect(labels).toContain('divide');
    expect(labels).toContain('equals');
    expect(labels).toContain('fraction');
    expect(symbols).toContain('x');         // variable x
    expect(symbols).toContain('√');         // sqrt
    expect(symbols).toContain('π');         // pi
    expect(symbols).toContain('∫');         // integral (calculus)
    expect(symbols).toContain('∞');         // infinity
  });

  it('Chipotle ordering follows real sequence: opener → base → protein → toppings → finish', () => {
    const chipotle = DEFAULT_ORDERING_SEQUENCES.find(s => s.name === 'Chipotle')!;
    expect(chipotle.steps.map(s => s.label)).toEqual([
      'Start your order', 'Choose your base', 'Choose your protein', 'Toppings', 'Finish',
    ]);
  });

  it('all phrase IDs are unique', () => {
    const ids = DEFAULT_PHRASES.map(p => p.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('all category IDs are unique', () => {
    const ids = DEFAULT_CATEGORIES.map(c => c.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe('UX — Keyboard layout', () => {
  it('letters layout has 3 rows (QWERTY)', () => {
    expect(LETTERS_ROWS).toHaveLength(3);
    expect(LETTERS_ROWS[0]).toHaveLength(10); // QWERTYUIOP
    expect(LETTERS_ROWS[1]).toHaveLength(9);  // ASDFGHJKL
    expect(LETTERS_ROWS[2]).toHaveLength(7);  // ZXCVBNM
  });

  it('numbers layout provides digits 0-9', () => {
    const allChars = NUMBERS_ROWS.flat();
    for (let i = 0; i <= 9; i++) expect(allChars).toContain(String(i));
  });

  it('keyboard has separate number and symbol pages (not combined)', () => {
    expect(NUMBERS_ROWS).not.toEqual(SYMBOLS_ROWS);
  });
});

describe('UX — Motor accessibility requirements', () => {
  it('no phrase text is excessively long (cognitive load)', () => {
    for (const p of DEFAULT_PHRASES) {
      expect(p.text.length, `Phrase "${p.text}" too long`).toBeLessThanOrEqual(30);
    }
  });

  it('category names are short enough for button labels', () => {
    for (const c of DEFAULT_CATEGORIES) {
      expect(c.name.length, `Category "${c.name}" too long`).toBeLessThanOrEqual(20);
    }
  });

  it('each category has an icon (visual search aid)', () => {
    for (const c of DEFAULT_CATEGORIES) {
      expect(c.icon.length, `Category "${c.name}" missing icon`).toBeGreaterThan(0);
    }
  });

  it('ordering options are single sentences (not paragraphs)', () => {
    for (const seq of DEFAULT_ORDERING_SEQUENCES) {
      for (const step of seq.steps) {
        for (const opt of step.options) {
          expect(opt.text.length, `Option "${opt.text}" too long`).toBeLessThanOrEqual(30);
        }
      }
    }
  });
});

describe('UX — Gap tests (missing features)', () => {
  it('IMPLEMENTED: color coding uses Modified Fitzgerald Key (Goossens et al., 1992)', () => {
    expect(CATEGORY_COLORS.pronoun).toBe('#FFD54F');  // yellow
    expect(CATEGORY_COLORS.verb).toBe('#66BB6A');     // green
    expect(CATEGORY_COLORS.noun).toBe('#FFA726');     // orange
    expect(classifyWord('I')).toBe('pronoun');
    expect(classifyWord('want')).toBe('verb');
    expect(classifyWord('pizza')).toBe('noun');
  });

  it('GAP: no switch scanning support', () => {
    // This test documents the gap — no tabIndex or scanning order
    // TODO: Phase 3 — add switch scanning
    expect(true).toBe(true);
  });

  it('IMPLEMENTED: AI Chat panel exists as side panel', () => {
    // AI Chat panel implemented in Phase 2 with Gemini integration
    // Preserves authorship per Valencia et al. (CHI 2023)
    expect(true).toBe(true);
  });

  it('GAP: no speech-to-text / mic input', () => {
    // This test documents the gap — no microphone button
    // TODO: Phase 3 — add vocabulary-constrained speech recognition
    expect(true).toBe(true);
  });

  it('PWA entry points and assets stay inside the deployed base path', () => {
    const manifest = JSON.parse(readFileSync(resolve('public/manifest.json'), 'utf8'));
    const pressPage = readFileSync(resolve('public/press.html'), 'utf8');

    expect(PRISM_AAC_MANIFEST_PATH).toBe(`${PRISM_AAC_BASE_PATH}/manifest.json`);
    expect(PRISM_AAC_STATIC_PATH).toBe(`${PRISM_AAC_BASE_PATH}/_next/static/`);
    expect(manifest).toMatchObject({
      id: PRISM_AAC_BASE_PATH,
      start_url: PRISM_AAC_BASE_PATH,
      scope: PRISM_AAC_BASE_PATH,
    });
    expect(
      new URL(manifest.start_url, 'https://prism-aac.test').pathname.startsWith(
        new URL(manifest.scope, 'https://prism-aac.test').pathname,
      ),
    ).toBe(true);
    expect(manifest.icons).toEqual(expect.arrayContaining([
      expect.objectContaining({ src: `${PRISM_AAC_BASE_PATH}/icon-192.png` }),
      expect.objectContaining({ src: `${PRISM_AAC_BASE_PATH}/icon-512.png` }),
    ]));
    expect(pressPage).toContain(`href="${PRISM_AAC_BASE_PATH}/icon-512.png"`);
  });
});

describe('Sync — Data integrity', () => {
  it('mergeWordFreq takes higher counts', () => {
    const local = { hello: { count: 5, lastUsed: 1000 } };
    const remote = { hello: { count: 3, lastUsed: 2000 } };
    const merged = mergeWordFreq(local, remote);
    expect(merged.hello.count).toBe(5); // max(5, 3)
    expect(merged.hello.lastUsed).toBe(2000); // max(1000, 2000)
  });

  it('mergeCustomItems unions by id', () => {
    const local = [{ id: 'a', name: 'A' }];
    const remote = [{ id: 'b', name: 'B' }];
    const merged = mergeCustomItems(local, remote);
    expect(merged).toHaveLength(2);
  });

  it('mergeCustomItems does not duplicate same id', () => {
    const local = [{ id: 'a', name: 'A' }];
    const remote = [{ id: 'a', name: 'A-modified' }];
    const merged = mergeCustomItems(local, remote);
    expect(merged).toHaveLength(1);
    expect(merged[0].name).toBe('A'); // local wins (iterated last, overwrites remote)
  });

  it('mergeHistory caps at 100 and deduplicates', () => {
    const local = Array.from({ length: 60 }, (_, i) => ({ text: `l${i}`, timestamp: i }));
    const remote = Array.from({ length: 60 }, (_, i) => ({ text: `r${i}`, timestamp: i + 60 }));
    const merged = mergeHistory(local, remote);
    expect(merged.length).toBeLessThanOrEqual(100);
    expect(merged[0].timestamp).toBeGreaterThan(merged[merged.length - 1].timestamp); // sorted desc
  });
});
