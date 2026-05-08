/**
 * SSML prosody format — locks the unambiguous `rate` syntax that
 * routes correctly through Azure Neural.
 *
 * Reproduces the Romanian "chipmunk voice" bug (May 2026): a child in
 * RO mode reported the AAC TTS speaking "high pitch and too fast".
 * Root cause was `buildSSML` emitting `rate="100%"` — per Azure SSML,
 * an UNSIGNED percentage on `<prosody rate>` is a delta from default,
 * so "100%" = +100% = 2× speed. EN escaped the bug because the portal
 * routes EN through Inworld (which discards <prosody>); RO/UK go
 * straight to Azure which honored the bogus rate.
 *
 * Fix: emit a multiplier number (1.0 = default, 1.15 = 15% faster).
 * That form is documented in Azure's SSML reference and unambiguous
 * across every parser. These tests pin the exact wire format so a
 * future "let's just round to a percent" refactor can't regress this.
 */
import { describe, it, expect } from 'vitest';
import { buildSSML } from '@/services/azureTTS';

describe('buildSSML — prosody emission', () => {
  it('emits rate as multiplier number, not unsigned percent', () => {
    const ssml = buildSSML('hello', 'ro-RO', 'friendly', 0.5, 1.0);
    // Must NOT contain the legacy "100%" form (which Azure parses as +100% = 2×).
    expect(ssml).not.toMatch(/rate="\d+%"/);
    // Web Speech 0.5 (normal) → SSML 1.00 (normal multiplier).
    expect(ssml).toMatch(/rate="1\.00"/);
  });

  it('clamps absurd rate values to Azure-safe range', () => {
    // Web Speech 10 → ssmlMultiplier = 0.5 + min(1.5, 10) = 2.0 (upper clamp)
    const ssml10x = buildSSML('hi', 'ro-RO', 'friendly', 10, 1);
    expect(ssml10x).toMatch(/rate="2\.00"/);
    // Web Speech 0 → ssmlMultiplier = 0.5 + 0 = 0.5 (lower clamp)
    const ssmlZero = buildSSML('hi', 'ro-RO', 'friendly', 0, 1);
    expect(ssmlZero).toMatch(/rate="0\.50"/);
  });

  // CRITICAL — May 2026 user report: "morning routine prononsuation
  // is 2 times faster than normal in your tests.. romanian also 2
  // times slower". Root cause: prism-aac uses the Web Speech rate
  // scale [0,1] (where 0.5 IS NORMAL) everywhere. SSML was passing
  // that value as-is to <prosody rate=> which is a MULTIPLIER scale
  // (where 1.0 IS NORMAL). With default speechRate=0.5, Azure was
  // synthesizing at 0.5× speed = 2× slower than expected. This pins
  // the corrected scale conversion (ssmlMultiplier = 0.5 + webRate).
  it('default speechRate of 0.5 (Web-Speech normal) emits SSML 1.00 (normal multiplier)', () => {
    const ssml = buildSSML('Buna dimineata', 'ro-RO', 'friendly', 0.5, 1);
    expect(ssml).toMatch(/rate="1\.00"/);
    // The earlier OFF-BY-2 bug emitted rate="0.50" here → 2× slow Romanian.
    expect(ssml).not.toMatch(/rate="0\.50"/);
  });

  it('preserves the [0,1] scale: 0.4 (slightly slow) → 0.90, 0.6 (slightly fast) → 1.10', () => {
    const slow = buildSSML('hi', 'ro-RO', 'friendly', 0.4, 1);
    expect(slow).toMatch(/rate="0\.90"/);
    const fast = buildSSML('hi', 'ro-RO', 'friendly', 0.6, 1);
    expect(fast).toMatch(/rate="1\.10"/);
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
