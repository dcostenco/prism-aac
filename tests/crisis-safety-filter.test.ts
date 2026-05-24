/**
 * crisisSafetyFilter — military-grade unit tests.
 *
 * checkCrisisSafety() is called synchronously on EVERY AI streaming chunk
 * and on every user input before an AI call. False negatives (missed crisis)
 * and false positives (blocked benign messages) are both life-safety bugs.
 *
 * Covers:
 *   - Benign input passes through
 *   - English crisis keywords (word-boundary-anchored)
 *   - English medical-dose keywords
 *   - Multilingual crisis: Spanish, French, Portuguese, Romanian, Russian,
 *     Ukrainian, German
 *   - CJK (no word separators): Japanese, Korean (with + without spaces),
 *     Chinese, Arabic proclitic forms
 *   - Word-boundary false-positive guards ("osmosis" ≠ "sos", etc.)
 *   - Case-insensitive matching
 *   - Response text contracts
 */
import { describe, it, expect } from 'vitest';
import { checkCrisisSafety } from '@/services/crisisSafetyFilter';

// ── Benign inputs ──────────────────────────────────────────────────────────

describe('checkCrisisSafety — benign inputs pass through', () => {
  it.each([
    'I want to eat pizza',
    // NOTE: "help me" and "please help" are crisis keywords that fire in ANY context
    // (conservative design — nonverbal child calling for help is treated as emergency).
    // Tests for those phrases belong in the crisis section below.
    'What is the weather today?',
    'I love my family',
    'Good morning teacher',
    'I need to go to the bathroom',
    'osmosis is a biology term',          // must NOT match "sos"
    'pleasantly helpful staff',           // must NOT match "please help" (no "please help" substring)
    'The chemistry class covers dosage levels in pharmacology',
    'How many students are in the class?',
  ])('"%s" is safe', (input) => {
    expect(checkCrisisSafety(input)).toEqual({ safe: true });
  });
});

// ── English crisis keywords ────────────────────────────────────────────────

describe('checkCrisisSafety — English crisis keywords', () => {
  it.each([
    'I want to kill myself',
    'I want to end my life',
    'I want to die',
    'suicide',
    'I am going to hurt myself',
    'self harm is what I do',
    "I can't breathe",
    "cant breathe",
    'I am choking',
    'help me please',
    'call 911 now',
    'call 999',
    'call 112 immediately',
    'this is an emergency',
    'heart attack happening',
    "i'm dying",
    'im dying',
    'I overdosed',
    'I took too many pills',
    'not breathing',
    'SOS',
    'please help',
  ])('"%s" triggers crisis response', (input) => {
    const result = checkCrisisSafety(input);
    expect(result.safe).toBe(false);
    if (!result.safe) expect(result.kind).toBe('crisis');
  });

  it('crisis response includes 988 and 741741 hotlines', () => {
    const result = checkCrisisSafety('I want to die');
    expect(result.safe).toBe(false);
    if (!result.safe) {
      expect(result.response).toContain('988');
      expect(result.response).toContain('741741');
      expect(result.response).toContain('911');
    }
  });
});

// ── Word-boundary guards ───────────────────────────────────────────────────

describe('checkCrisisSafety — word-boundary false positive guards', () => {
  it('"osmosis" does not trigger "sos"', () => {
    expect(checkCrisisSafety('osmosis experiment')).toEqual({ safe: true });
  });

  it('"pleasantly helpful" does not trigger "please help"', () => {
    expect(checkCrisisSafety('The staff is pleasantly helpful')).toEqual({ safe: true });
  });

  it('"I need a helper" does not trigger "help me"', () => {
    expect(checkCrisisSafety('I need a helper at school')).toEqual({ safe: true });
  });

  it('"emergency exit" in a neutral sentence is still flagged (keyword IS "emergency")', () => {
    // The word "emergency" IS in the crisis list — this is intentional. Any emergency
    // context from a nonverbal AAC user is taken seriously.
    const result = checkCrisisSafety('emergency exit door is broken');
    expect(result.safe).toBe(false);
    if (!result.safe) expect(result.kind).toBe('crisis');
  });
});

// ── Case-insensitive matching ──────────────────────────────────────────────

describe('checkCrisisSafety — case insensitive', () => {
  it('SUICIDE triggers crisis', () => {
    const result = checkCrisisSafety('SUICIDE');
    expect(result.safe).toBe(false);
  });

  it('Kill Myself (mixed case) triggers crisis', () => {
    const result = checkCrisisSafety('I Want To Kill Myself');
    expect(result.safe).toBe(false);
  });

  it('SOS triggers crisis', () => {
    const result = checkCrisisSafety('SOS help');
    expect(result.safe).toBe(false);
    if (!result.safe) expect(result.kind).toBe('crisis');
  });
});

// ── Medical dose keywords ──────────────────────────────────────────────────

describe('checkCrisisSafety — medical dose keywords', () => {
  it.each([
    'how many mg should I take',
    'how many pills is safe',
    'how much medication per day',
    'medication dose for children',
    'drug dose calculation',
    'overdose amount threshold',
    'how much tylenol is too much',
    'maximum dose of ibuprofen',
    'lethal dose for adults',
    'insulin dose adjustment',
    'how much insulin per meal',
    'seizure medication dose',
  ])('"%s" triggers medical response', (input) => {
    const result = checkCrisisSafety(input);
    expect(result.safe).toBe(false);
    if (!result.safe) {
      expect(result.kind).toBe('medical');
      expect(result.response).toContain('doctor');
    }
  });

  it('medical response directs to doctor / pharmacist', () => {
    const result = checkCrisisSafety('lethal dose of medication');
    expect(result.safe).toBe(false);
    if (!result.safe) {
      expect(result.kind).toBe('medical');
      expect(result.response).toMatch(/doctor|pharmacist/i);
    }
  });
});

// ── Multilingual crisis keywords ──────────────────────────────────────────

describe('checkCrisisSafety — multilingual crisis (non-CJK)', () => {
  it.each([
    // Spanish
    ['quiero morir', 'es'],
    ['no puedo respirar', 'es'],
    ['necesito ayuda', 'es'],
    // French
    ['je veux mourir', 'fr'],
    ['au secours', 'fr'],
    // Portuguese
    ['quero morrer', 'pt'],
    ['socorro', 'pt'],
    // Romanian
    ['vreau să mor', 'ro'],
    ['ajutor', 'ro'],
    // Russian
    ['хочу умереть', 'ru'],
    ['помогите', 'ru'],
    // Ukrainian
    ['хочу померти', 'uk'],
    ['допоможіть', 'uk'],
    // German
    ['ich will sterben', 'de'],
    ['hilfe', 'de'],
  ] as [string, string][])('"%s" (%s) triggers crisis', (input) => {
    const result = checkCrisisSafety(input);
    expect(result.safe).toBe(false);
    if (!result.safe) expect(result.kind).toBe('crisis');
  });
});

// ── CJK crisis (no word separators) ───────────────────────────────────────

describe('checkCrisisSafety — CJK crisis (logographic, no spaces)', () => {
  it('Japanese "しにたい" (want to die) triggers crisis', () => {
    const result = checkCrisisSafety('しにたい');
    expect(result.safe).toBe(false);
    if (!result.safe) expect(result.kind).toBe('crisis');
  });

  it('Japanese "たすけて" (help me) triggers crisis', () => {
    expect(checkCrisisSafety('たすけて').safe).toBe(false);
  });

  it('Chinese "我想死" (I want to die) triggers crisis', () => {
    expect(checkCrisisSafety('我想死').safe).toBe(false);
  });

  it('Chinese "救命" (help) triggers crisis', () => {
    expect(checkCrisisSafety('救命').safe).toBe(false);
  });

  it('Korean "죽고 싶어" (want to die, with space) triggers crisis', () => {
    expect(checkCrisisSafety('죽고 싶어').safe).toBe(false);
  });

  it('Korean "죽고싶어" (want to die, no space) triggers crisis', () => {
    expect(checkCrisisSafety('죽고싶어').safe).toBe(false);
  });

  it('Korean "도와주세요" (please help me) triggers crisis', () => {
    expect(checkCrisisSafety('도와주세요').safe).toBe(false);
  });

  it('Arabic "ساعدني" (help me) triggers crisis even with proclitic prefix', () => {
    // Proclitic: وساعدني = "and help me" — the bare includes() check must catch it
    expect(checkCrisisSafety('وساعدني').safe).toBe(false);
  });

  it('Japanese crisis phrase embedded in a sentence still triggers', () => {
    expect(checkCrisisSafety('わたしは しにたいです').safe).toBe(false);
  });
});

// ── Return-type shape ──────────────────────────────────────────────────────

describe('checkCrisisSafety — return type contract', () => {
  it('safe:true has no kind or response fields', () => {
    const result = checkCrisisSafety('hello');
    expect(result).toEqual({ safe: true });
    expect('kind' in result).toBe(false);
    expect('response' in result).toBe(false);
  });

  it('crisis result has safe:false, kind:"crisis", non-empty response', () => {
    const result = checkCrisisSafety('suicide');
    expect(result.safe).toBe(false);
    if (!result.safe) {
      expect(result.kind).toBe('crisis');
      expect(result.response.length).toBeGreaterThan(10);
    }
  });

  it('medical result has safe:false, kind:"medical", non-empty response', () => {
    const result = checkCrisisSafety('lethal dose');
    expect(result.safe).toBe(false);
    if (!result.safe) {
      expect(result.kind).toBe('medical');
      expect(result.response.length).toBeGreaterThan(10);
    }
  });

  it('does not throw on empty string', () => {
    expect(() => checkCrisisSafety('')).not.toThrow();
    expect(checkCrisisSafety('')).toEqual({ safe: true });
  });

  it('does not throw on very long input (1MB string)', () => {
    const huge = 'a'.repeat(1_000_000);
    expect(() => checkCrisisSafety(huge)).not.toThrow();
    expect(checkCrisisSafety(huge)).toEqual({ safe: true });
  });
});
