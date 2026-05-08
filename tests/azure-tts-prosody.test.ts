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
    expect(ssml).not.toMatch(/rate="\d+%"/);
    // Web Speech 0.5 (normal) → SSML 1.00 (normal multiplier).
    expect(ssml).toMatch(/rate="1\.00"/);
  });

  it('clamps absurd rate values to Azure-safe range', () => {
    // Web Speech 10 clamps to 1, then ssmlMultiplier = 0.6 + 0.8 = 1.40
    const ssml10x = buildSSML('hi', 'ro-RO', 'friendly', 10, 1);
    expect(ssml10x).toMatch(/rate="1\.40"/);
    // Web Speech 0 → ssmlMultiplier = 0.6 (lower output)
    const ssmlZero = buildSSML('hi', 'ro-RO', 'friendly', 0, 1);
    expect(ssmlZero).toMatch(/rate="0\.60"/);
  });

  // CRITICAL: scale handling rev 2.
  // - User report 1 (Romanian "2× slow"): rate=0.5 used to pass as
  //   SSML "0.50" = half speed.
  // - User report 2 ("morning routine high pitch / chipmunk"):
  //   first conversion attempt `0.5 + webRate` produced SSML 1.5
  //   when slider was at max 1.0 → 1.5× chipmunk.
  // - Fix: linear `0.6 + 0.8 × webRate` keeps the safe range
  //   [0.7, 1.4] across the full slider, with 0.5 → 1.0 (normal).
  //   No slider position can produce ≥ 1.5× (chipmunk threshold).
  it('default speechRate of 0.5 emits SSML 1.00 (normal multiplier)', () => {
    const ssml = buildSSML('Buna dimineata', 'ro-RO', 'friendly', 0.5, 1);
    expect(ssml).toMatch(/rate="1\.00"/);
    expect(ssml).not.toMatch(/rate="0\.50"/);
  });

  it('slider at max (1.0) produces SSML 1.40 — fast but NOT chipmunk', () => {
    const ssml = buildSSML('morning routine', 'en-US', 'friendly', 1.0, 1);
    expect(ssml).toMatch(/rate="1\.40"/);
    // The "morning routine high pitch" regression emitted 1.50+ here.
    expect(ssml).not.toMatch(/rate="1\.5\d"/);
  });

  it('slider at min (0.1) stays intelligible at SSML 0.68', () => {
    const ssml = buildSSML('slow speech', 'en-US', 'friendly', 0.1, 1);
    // 0.6 + 0.8 × 0.1 = 0.68, rounded to 2 decimals
    expect(ssml).toMatch(/rate="0\.68"/);
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
