/**
 * Guards for scripts/check-spoken-collisions.mjs.
 *
 * That script needs network and an Azure key, so it cannot run in CI. But the
 * part of it most likely to rot silently — how it discovers which tile pairs
 * to check — is pure text parsing and IS testable here.
 *
 * The failure this prevents: someone adds a pair to CLINICALLY_DISTINCT_PAIRS,
 * the script's regex doesn't match the new formatting, the script quietly
 * checks fewer pairs than CI enforces, and reports "0 collisions" for a set it
 * never looked at. A release check that under-reports is worse than none,
 * because it manufactures confidence.
 */
import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import { CLINICALLY_DISTINCT_PAIRS } from '@/constants/bodyPartDistinctions';

const ROOT = path.resolve(__dirname, '..');
const SCRIPT = path.join(ROOT, 'scripts', 'check-spoken-collisions.mjs');
const CONTRACT = path.join(ROOT, 'constants', 'bodyPartDistinctions.ts');

const scriptSrc = fs.readFileSync(SCRIPT, 'utf-8');
const contractSrc = fs.readFileSync(CONTRACT, 'utf-8');

/** Reproduces exactly what the script does to find its pairs. */
function pairsAsScriptSeesThem(): Array<[string, string]> {
  const start = contractSrc.indexOf('CLINICALLY_DISTINCT_PAIRS');
  const end = contractSrc.indexOf('UNRESOLVABLE_IN_LANGUAGE');
  const block = contractSrc.slice(start, end > start ? end : undefined);
  return [...block.matchAll(/a: '([^']+)',\s*\n\s*b: '([^']+)'/g)].map((m) => [m[1], m[2]]);
}

describe('check-spoken-collisions.mjs — pair discovery', () => {
  it('sees exactly the pairs CI enforces', () => {
    const seen = pairsAsScriptSeesThem();
    const expected = CLINICALLY_DISTINCT_PAIRS.map((p) => [p.a, p.b]);
    expect(seen).toEqual(expected);
  });

  it('finds every pair, not a subset', () => {
    // The count check the script itself cannot make about its own future.
    const seen = pairsAsScriptSeesThem();
    expect(seen.length).toBe(CLINICALLY_DISTINCT_PAIRS.length);
    expect(seen.length).toBeGreaterThan(0);
  });

  it('does not duplicate the pair list in the script', () => {
    // The whole point of reading from the contract. A literal pair array in
    // the script would be free to drift.
    const suspicious = /const PAIRS\s*=\s*\[\s*\[\s*'/.test(scriptSrc);
    expect(suspicious, 'script appears to hardcode a PAIRS array again').toBe(false);
    expect(scriptSrc).toContain('CLINICALLY_DISTINCT_PAIRS');
  });
});

describe('check-spoken-collisions.mjs — recognition locale mapping', () => {
  it('maps Bengali recognition to bn-IN, not bn-BD', () => {
    // Azure synthesizes bn-BD but returns HTTP 400 for bn-BD recognition.
    // Verified by probe; if this regresses, every Bengali pair silently
    // becomes "unverified".
    const bn = scriptSrc.match(/bn:\s*\{[^}]*\}/)?.[0] ?? '';
    expect(bn).toContain("tts: 'bn-BD'");
    expect(bn).toContain("stt: 'bn-IN'");
  });

  it('gives every configured language a distinct stt locale field', () => {
    const entries = [...scriptSrc.matchAll(/^\s{2}([a-z-]{2,7}):\s*\{([^}]*)\}/gm)];
    expect(entries.length).toBeGreaterThan(10);
    for (const [, lang, body] of entries) {
      expect(body, `${lang} missing voice`).toContain('voice:');
      expect(body, `${lang} missing tts locale`).toContain('tts:');
      expect(body, `${lang} missing stt locale`).toContain('stt:');
    }
  });
});

describe('check-spoken-collisions.mjs — failure reporting', () => {
  it('treats an unverified pair as unverified, never as a pass', () => {
    // Silence must not read as success: a pair whose synthesis or recognition
    // failed has to surface, or the run reports "0 collisions" over pairs it
    // never actually checked.
    expect(scriptSrc).toContain('unverified.push');
    expect(scriptSrc).toContain('UNVERIFIED');
    expect(scriptSrc).toMatch(/do not read silence as a pass/i);
  });

  it('exits non-zero when a collision is found', () => {
    expect(scriptSrc).toMatch(/process\.exitCode\s*=\s*collisions\.length/);
  });
});

describe('check-spoken-collisions.mjs — refuses a partial parse', () => {
  it('cross-checks the parsed pair count against the contract', () => {
    // A total parse failure is obvious; a PARTIAL one is the dangerous case,
    // because the run still prints "0 collisions" over a silently reduced set.
    expect(scriptSrc).toContain('declaredCount');
    expect(scriptSrc).toMatch(/PAIRS\.length !== declaredCount/);
    expect(scriptSrc).toMatch(/Refusing to run/i);
  });

  it('tolerates the contract being reordered', () => {
    // If UNRESOLVABLE_IN_LANGUAGE ever moves above CLINICALLY_DISTINCT_PAIRS,
    // a naive slice() would go backwards and yield an empty block.
    expect(scriptSrc).toMatch(/endIdx > startIdx \? endIdx : undefined/);
  });
});
