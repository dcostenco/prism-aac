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

describe('buildSSML — prosody emission (stabilized 2026-05-08)', () => {
  it('emits rate as multiplier number, not unsigned percent', () => {
    const ssml = buildSSML('hello', 'ro-RO', 'friendly', 1.0, 1.0);
    // Must NOT contain the legacy "100%" form (Azure parses as +100% = 2×).
    expect(ssml).not.toMatch(/rate="\d+%"/);
    expect(ssml).toMatch(/rate="1\.00"/);
  });

  it('clamps absurd rate values to Azure-safe range', () => {
    const ssml10x = buildSSML('hi', 'ro-RO', 'friendly', 10, 1);
    expect(ssml10x).toMatch(/rate="2\.00"/);
    const ssmlZero = buildSSML('hi', 'ro-RO', 'friendly', 0, 1);
    expect(ssmlZero).toMatch(/rate="1\.00"/);  // 0 falls back to default 1
  });

  it('passes rate through as multiplier (0.9 → "0.90", 1.5 → "1.50")', () => {
    expect(buildSSML('hi', 'ro-RO', 'friendly', 0.9, 1)).toMatch(/rate="0\.90"/);
    expect(buildSSML('hi', 'ro-RO', 'friendly', 1.5, 1)).toMatch(/rate="1\.50"/);
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
