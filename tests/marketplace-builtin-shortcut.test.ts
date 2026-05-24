/**
 * builtinShortcutHandler — the marketplace handler that surfaces built-in
 * toolbar features (AAC Chat, AI Chat, Schedule, Caregiver, Math) as
 * discoverable catalog entries without needing install/uninstall.
 *
 * Why it matters:
 *   validate() guards against tampered manifests injecting an unknown
 *   builtin string — without it, ctx.ui.openBuiltin gets called with
 *   arbitrary attacker-controlled input (e.g., '__proto__').
 *
 *   launch() must fall back gracefully when the host doesn't provide
 *   openBuiltin (older WKWebView shells or stub test contexts) — a
 *   crash here would freeze the marketplace panel for AAC users.
 *
 *   isActive() must always return true so the marketplace shows these
 *   entries as "installed by default" rather than showing an Install
 *   button that leads to a no-op.
 */
import { describe, it, expect, vi } from 'vitest';
import { builtinShortcutHandler } from '@/lib/marketplace/handlers/builtinShortcut';
import type { HandlerContext, ModuleManifest } from '@/lib/marketplace/types';

function makeManifest(builtin: string | undefined): ModuleManifest {
  return {
    slug: `builtin-${builtin ?? 'none'}`,
    version: '1.0.0',
    tier: 'free',
    kind: 'builtin-shortcut',
    category: 'utility',
    nameKey: 'builtin.name',
    descKey: 'builtin.desc',
    icon: '⭐',
    status: 'available',
    handlerPayload: builtin !== undefined ? { builtin } : undefined,
  };
}

function makeCtx(overrides: Partial<HandlerContext['ui']> = {}): HandlerContext {
  return {
    settings: {
      installApp: vi.fn(),
      uninstallApp: vi.fn(),
      update: vi.fn(),
      getActiveVocabSet: () => 'all',
      getInstalledApps: () => [],
    },
    ui: {
      closeSidePanel: vi.fn(),
      openCategories: vi.fn(),
      openGames: vi.fn(),
      openMarketplace: vi.fn(),
      openSettings: vi.fn(),
      openModulePanel: vi.fn(),
      openBuiltin: vi.fn(),
      ...overrides,
    },
  };
}

// ── validate ──────────────────────────────────────────────────────────────────

describe('builtinShortcutHandler — validate', () => {
  it('accepts all five valid builtin ids', () => {
    const ids = ['aac-chat', 'ai-chat', 'schedule', 'caregiver', 'math'] as const;
    for (const id of ids) {
      expect(builtinShortcutHandler.validate(makeManifest(id))).toBe(true);
    }
  });

  it('rejects unknown builtin id', () => {
    expect(builtinShortcutHandler.validate(makeManifest('malicious-string'))).toBe(false);
  });

  it('rejects __proto__ injection attempt', () => {
    expect(builtinShortcutHandler.validate(makeManifest('__proto__'))).toBe(false);
  });

  it('rejects empty builtin string', () => {
    expect(builtinShortcutHandler.validate(makeManifest(''))).toBe(false);
  });

  it('rejects manifest with no handlerPayload', () => {
    expect(builtinShortcutHandler.validate(makeManifest(undefined))).toBe(false);
  });
});

// ── isActive ──────────────────────────────────────────────────────────────────

describe('builtinShortcutHandler — isActive', () => {
  it('always returns true regardless of context', () => {
    const ctx = makeCtx();
    for (const id of ['aac-chat', 'ai-chat', 'schedule', 'caregiver', 'math'] as const) {
      expect(builtinShortcutHandler.isActive(makeManifest(id), ctx)).toBe(true);
    }
  });
});

// ── install / uninstall ───────────────────────────────────────────────────────

describe('builtinShortcutHandler — install / uninstall are no-ops', () => {
  it('install does not call any context method', () => {
    const ctx = makeCtx();
    builtinShortcutHandler.install(makeManifest('aac-chat'), ctx);
    expect(ctx.settings.installApp).not.toHaveBeenCalled();
    expect(ctx.ui.openBuiltin).not.toHaveBeenCalled();
  });

  it('uninstall does not call any context method', () => {
    const ctx = makeCtx();
    builtinShortcutHandler.uninstall(makeManifest('aac-chat'), ctx);
    expect(ctx.settings.uninstallApp).not.toHaveBeenCalled();
  });
});

// ── launch ────────────────────────────────────────────────────────────────────

describe('builtinShortcutHandler — launch', () => {
  it('calls openBuiltin with the correct builtin id', () => {
    const ctx = makeCtx();
    builtinShortcutHandler.launch!(makeManifest('ai-chat'), ctx);
    expect(ctx.ui.openBuiltin).toHaveBeenCalledWith('ai-chat');
  });

  it('calls openBuiltin with "schedule" for schedule shortcut', () => {
    const ctx = makeCtx();
    builtinShortcutHandler.launch!(makeManifest('schedule'), ctx);
    expect(ctx.ui.openBuiltin).toHaveBeenCalledWith('schedule');
  });

  it('falls back to closeSidePanel when openBuiltin is absent', () => {
    const ctx = makeCtx();
    delete (ctx.ui as { openBuiltin?: unknown }).openBuiltin;
    builtinShortcutHandler.launch!(makeManifest('aac-chat'), ctx);
    expect(ctx.ui.closeSidePanel).toHaveBeenCalled();
  });

  it('falls back to openMarketplace when payload is invalid', () => {
    const ctx = makeCtx();
    builtinShortcutHandler.launch!(makeManifest('bad-id'), ctx);
    expect(ctx.ui.openMarketplace).toHaveBeenCalled();
    expect(ctx.ui.openBuiltin).not.toHaveBeenCalled();
  });

  it('does not call openBuiltin when openBuiltin is absent and payload is invalid', () => {
    const ctx = makeCtx();
    delete (ctx.ui as { openBuiltin?: unknown }).openBuiltin;
    builtinShortcutHandler.launch!(makeManifest('bad-id'), ctx);
    expect(ctx.ui.openMarketplace).toHaveBeenCalled();
  });
});
