/**
 * SSML prosody format — locks the unambiguous `rate` syntax and the
 * scale-mapping formula that prevents both "2× slow" and "chipmunk".
 *
 * History:
 *   May 2026 #1: `rate="100%"` caused chipmunk in RO mode (Azure parses
 *     unsigned % as delta: "100%" = +100% = 2× speed). Fixed to multiplier.
 *   May 2026 #2: stored rate 0.5 (default) → SSML 0.5 = 2× slow for Azure
 *     voices (RO, RU). EN escaped because Inworld discards <prosody>.
 *     Fix: ssmlRate = storedRate × 2, capped at 1.4.
 *       stored 0.5 (default) → SSML 1.0 (normal)
 *       stored 1.0 (slider max users crank to) → SSML 1.4 (fast, not chipmunk)
 *     The 1.4 cap is enforced by tts-live-diag-rate.mjs (rate ≥ 1.5 = ❌).
 *
 * These tests pin the wire format AND the mapping so neither can regress.
 */
import { describe, it, expect } from 'vitest';
import { buildSSML } from '@/services/azureTTS';

describe('buildSSML — prosody emission (stabilized 2026-05-08)', () => {
  it('emits rate as multiplier number, not unsigned percent', () => {
    const ssml = buildSSML('hello', 'ro-RO', 'friendly', 0.5, 1.0);
    // Must NOT contain the legacy "100%" form.
    expect(ssml).not.toMatch(/rate="\d+%"/);
    // stored 0.5 (default) → SSML 1.00 (normal speed).
    expect(ssml).toMatch(/rate="1\.00"/);
  });

  it('stored default 0.5 → SSML 1.00 (fixes Romanian/Russian 2× slow)', () => {
    const ssml = buildSSML('Bună ziua', 'ro-RO', 'friendly', 0.5, 1);
    expect(ssml).toMatch(/rate="1\.00"/);
  });

  it('clamps to 1.4 max — prevents chipmunk at slider=1.0 (tts-live-diag-rate gate)', () => {
    // stored 1.0 (user cranked slider) → SSML 1.40, not 2.00
    expect(buildSSML('hi', 'ro-RO', 'friendly', 1.0, 1)).toMatch(/rate="1\.40"/);
    // absurd values also cap at 1.4
    expect(buildSSML('hi', 'ro-RO', 'friendly', 10, 1)).toMatch(/rate="1\.40"/);
    // 0 falls back to default 1.0
    expect(buildSSML('hi', 'ro-RO', 'friendly', 0, 1)).toMatch(/rate="1\.00"/);
  });

  it('maps stored rate × 2, capped at 1.4 (0.25→0.50, 0.5→1.00, 0.7→1.40)', () => {
    expect(buildSSML('hi', 'ro-RO', 'friendly', 0.25, 1)).toMatch(/rate="0\.50"/);
    expect(buildSSML('hi', 'ro-RO', 'friendly', 0.5,  1)).toMatch(/rate="1\.00"/);
    expect(buildSSML('hi', 'ro-RO', 'friendly', 0.7,  1)).toMatch(/rate="1\.40"/);
    expect(buildSSML('hi', 'ro-RO', 'friendly', 1.5,  1)).toMatch(/rate="1\.40"/);
  });

  it('omits pitch attribute (we never vary it; default is correct)', () => {
    const ssml = buildSSML('hi', 'ro-RO', 'friendly', 0.5, 1);
    expect(ssml).not.toMatch(/\bpitch=/);
  });

  it('renders volume as 0..100 absolute level', () => {
    const ssml = buildSSML('hi', 'en-US', 'friendly', 0.5, 0.75);
    expect(ssml).toMatch(/volume="75"/);
  });

  it('handles NaN / non-finite rate by falling back to default normal speed', () => {
    const ssml = buildSSML('hi', 'ro-RO', 'friendly', NaN, 1);
    // NaN → webRate fallback to 0.5 → SSML 1.00 (normal).
    expect(ssml).toMatch(/rate="1\.00"/);
  });

  it('rejects negative rate, falls back to default normal', () => {
    const ssml = buildSSML('hi', 'ro-RO', 'friendly', -1, 1);
    expect(ssml).toMatch(/rate="1\.00"/);
  });

  it('escapes XML special chars in user text', () => {
    const ssml = buildSSML('a & b <c>', 'en-US', 'friendly', 1, 1);
    expect(ssml).toContain('a &amp; b &lt;c&gt;');
  });

  it('only wraps express-as for style-supported voices', () => {
    // ro-RO-AlinaNeural does NOT support styles
    const ro = buildSSML('hi', 'ro-RO', 'cheerful', 1, 1);
    expect(ro).not.toContain('mstts:express-as');
    // en-US-JennyMultilingualNeural DOES
    const en = buildSSML('hi', 'en-US', 'cheerful', 1, 1);
    expect(en).toContain('<mstts:express-as style="cheerful">');
  });
});
