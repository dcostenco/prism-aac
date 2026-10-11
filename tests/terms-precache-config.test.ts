import { describe, expect, it, vi } from 'vitest';
import { PRISM_AAC_PUBLIC_PRECACHE_PATTERNS } from '@/lib/appPaths';

const capture = vi.hoisted(() => ({ init: vi.fn((options: unknown) => (config: unknown) => config) }));
vi.mock('@serwist/next', () => ({ default: capture.init }));

describe('Terms installation is independent of opening the legal page', () => {
  it('adds the deployed Terms document while preserving public-file discovery', async () => {
    const { default: config } = await import('../next.config');
    const options = capture.init.mock.calls[0][0] as {
      additionalPrecacheEntries?: unknown;
      globPublicPatterns: string[];
      manifestTransforms?: ((entries: { url: string; revision?: string }[]) => Promise<{
        manifest: { url: string; revision?: string }[]; warnings: string[];
      }>)[];
    };
    expect(options.additionalPrecacheEntries).toBeUndefined();
    expect(options.globPublicPatterns).toEqual(PRISM_AAC_PUBLIC_PRECACHE_PATTERNS);
    expect(options.manifestTransforms).toHaveLength(1);
    const publicEntry = { url: '/prism-aac/manifest.json', revision: 'existing' };
    const result = await options.manifestTransforms![0]([publicEntry]);
    expect(result.manifest).toContainEqual(publicEntry);
    expect(result.manifest).toContainEqual({ url: '/prism-aac/terms', revision: config.env!.NEXT_PUBLIC_BUILD_ID, size: 0 });
    expect(config.outputFileTracingIncludes?.['/terms']).toContain('./TERMS.md');
    expect(result.warnings).toEqual([]);
  });
});
