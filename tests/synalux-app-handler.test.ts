/**
 * synalux-app marketplace handler — install / launch contract.
 *
 * Validates that:
 *   - Mail / Drive / etc are installable like any other marketplace module
 *   - The catalog includes both Synalux-first-party apps
 *   - launch() opens the configured portal path in a new tab via window.open,
 *     never replacing the AAC tab (motor-impaired users can't navigate back)
 *   - Bad manifests (missing path, non-absolute path) are rejected at validate()
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { synaluxAppHandler } from '@/lib/marketplace/handlers/synaluxApp';
import { LOCAL_CATALOG } from '@/lib/marketplace/manifests/local';
import type { ModuleManifest, HandlerContext } from '@/lib/marketplace/types';

function makeCtx(): HandlerContext {
  const installed = new Set<string>();
  return {
    settings: {
      installApp: vi.fn((s: string) => { installed.add(s); }),
      uninstallApp: vi.fn((s: string) => { installed.delete(s); }),
      update: vi.fn(),
      getActiveVocabSet: () => 'all',
      getInstalledApps: () => [...installed],
    },
    ui: {
      closeSidePanel: vi.fn(),
      openCategories: vi.fn(),
      openGames: vi.fn(),
      openMarketplace: vi.fn(),
      openSettings: vi.fn(),
      openModulePanel: vi.fn(),
    },
  };
}

const baseManifest: ModuleManifest = {
  slug: 'synalux-mail',
  version: '1.0.0',
  kind: 'synalux-app',
  tier: 'free',
  category: 'apps',
  nameKey: 'mp_synalux_mail',
  descKey: 'mp_synalux_mail_desc',
  icon: '✉️',
  status: 'available',
  handlerPayload: { path: '/mail' },
};

describe('synaluxAppHandler — validate()', () => {
  it('accepts a manifest with a valid absolute path', () => {
    expect(synaluxAppHandler.validate(baseManifest)).toBe(true);
  });

  it('rejects a manifest with no handlerPayload', () => {
    expect(synaluxAppHandler.validate({ ...baseManifest, handlerPayload: undefined })).toBe(false);
  });

  it('rejects a manifest with no path', () => {
    expect(synaluxAppHandler.validate({ ...baseManifest, handlerPayload: {} })).toBe(false);
  });

  it('rejects a non-absolute path (would land on the wrong host)', () => {
    expect(synaluxAppHandler.validate({ ...baseManifest, handlerPayload: { path: 'mail' } })).toBe(false);
  });

  it('rejects an external URL slipped into path (security: must stay on portal)', () => {
    expect(
      synaluxAppHandler.validate({ ...baseManifest, handlerPayload: { path: 'http://evil.example.com' } })
    ).toBe(false);
  });
});

describe('synaluxAppHandler — install / uninstall / isActive', () => {
  it('install() adds slug to installedApps', () => {
    const ctx = makeCtx();
    synaluxAppHandler.install(baseManifest, ctx);
    expect(ctx.settings.installApp).toHaveBeenCalledWith('synalux-mail');
    expect(synaluxAppHandler.isActive(baseManifest, ctx)).toBe(true);
  });

  it('uninstall() removes slug', () => {
    const ctx = makeCtx();
    synaluxAppHandler.install(baseManifest, ctx);
    synaluxAppHandler.uninstall(baseManifest, ctx);
    expect(synaluxAppHandler.isActive(baseManifest, ctx)).toBe(false);
  });
});

describe('synaluxAppHandler — launch()', () => {
  let openSpy: ReturnType<typeof vi.fn>;
  const originalOpen = global.window?.open;

  beforeEach(() => {
    openSpy = vi.fn();
    Object.defineProperty(window, 'open', { value: openSpy, writable: true, configurable: true });
  });

  afterEach(() => {
    Object.defineProperty(window, 'open', { value: originalOpen, writable: true, configurable: true });
  });

  it('opens the configured path on the portal in a new tab with safe rel attrs', () => {
    const ctx = makeCtx();
    synaluxAppHandler.launch!(baseManifest, ctx);
    expect(openSpy).toHaveBeenCalledTimes(1);
    const [url, target, features] = openSpy.mock.calls[0];
    expect(url).toMatch(/\/mail$/);
    expect(target).toBe('_blank');
    expect(features).toBe('noopener,noreferrer');
  });

  it('honors target="_self" when explicitly set in payload', () => {
    const ctx = makeCtx();
    const before = window.location.href;
    const hrefSetter = vi.fn();
    Object.defineProperty(window, 'location', {
      value: { ...window.location, set href(v: string) { hrefSetter(v); }, get href() { return before; } },
      writable: true, configurable: true,
    });
    synaluxAppHandler.launch!(
      { ...baseManifest, handlerPayload: { path: '/drive', target: '_self' } },
      ctx,
    );
    expect(hrefSetter).toHaveBeenCalled();
  });

  it('no-ops cleanly when the manifest payload is missing (defensive)', () => {
    const ctx = makeCtx();
    synaluxAppHandler.launch!({ ...baseManifest, handlerPayload: undefined }, ctx);
    expect(openSpy).not.toHaveBeenCalled();
  });
});

describe('LOCAL_CATALOG — Synalux apps registered', () => {
  it('includes synalux-mail and synalux-drive entries', () => {
    const slugs = LOCAL_CATALOG.map((m) => m.slug);
    expect(slugs).toContain('synalux-mail');
    expect(slugs).toContain('synalux-drive');
  });

  it('Synalux apps are in the "apps" category', () => {
    const apps = LOCAL_CATALOG.filter((m) => m.kind === 'synalux-app');
    for (const a of apps) expect(a.category).toBe('apps');
  });

  it('Synalux apps are free-tier (productivity, not premium content)', () => {
    const apps = LOCAL_CATALOG.filter((m) => m.kind === 'synalux-app');
    for (const a of apps) expect(a.tier).toBe('free');
  });
});
