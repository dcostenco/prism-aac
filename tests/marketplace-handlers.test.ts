import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { boardTemplateHandler } from '@/lib/marketplace/handlers/boardTemplate';
import { gamePackHandler } from '@/lib/marketplace/handlers/gamePack';
import { panelHandler } from '@/lib/marketplace/handlers/panel';
import { symbolLibraryHandler } from '@/lib/marketplace/handlers/symbolLibrary';
import { vocabSetHandler } from '@/lib/marketplace/handlers/vocabSet';
import { voicePackHandler } from '@/lib/marketplace/handlers/voicePack';
import type { HandlerContext, ModuleManifest } from '@/lib/marketplace/types';

interface StubState {
  installedApps: string[];
  activeVocabSet: string;
  closeSidePanel: number;
  openCategories: number;
  openGames: number;
  openMarketplace: number;
  openSettings: number;
  openModulePanel: string[];
}

function makeCtx(initial: Partial<StubState> = {}): { ctx: HandlerContext; state: StubState } {
  const state: StubState = {
    installedApps: [],
    activeVocabSet: 'all',
    closeSidePanel: 0,
    openCategories: 0,
    openGames: 0,
    openMarketplace: 0,
    openSettings: 0,
    openModulePanel: [],
    ...initial,
  };
  const ctx: HandlerContext = {
    settings: {
      installApp: (slug) => {
        if (!state.installedApps.includes(slug)) state.installedApps.push(slug);
      },
      uninstallApp: (slug) => {
        state.installedApps = state.installedApps.filter((s) => s !== slug);
      },
      update: (partial) => {
        if (typeof partial.activeVocabSet === 'string') state.activeVocabSet = partial.activeVocabSet;
      },
      getActiveVocabSet: () => state.activeVocabSet,
      getInstalledApps: () => state.installedApps,
    },
    ui: {
      closeSidePanel: () => { state.closeSidePanel++; },
      openCategories: () => { state.openCategories++; },
      openGames: () => { state.openGames++; },
      openMarketplace: () => { state.openMarketplace++; },
      openSettings: () => { state.openSettings++; },
      openModulePanel: (id: string) => { state.openModulePanel.push(id); },
    },
  };
  return { ctx, state };
}

const VOCAB_MANIFEST: ModuleManifest = {
  slug: 'vocab-my-core',
  version: '1.0.0',
  kind: 'vocab-set',
  tier: 'free',
  category: 'vocab',
  nameKey: 'vs_my_core',
  descKey: 'vs_my_core_desc',
  icon: '⚡',
  status: 'available',
  handlerPayload: { vocabSetId: 'my-core' },
};

beforeEach(() => { vi.useFakeTimers(); });
afterEach(() => { vi.useRealTimers(); });

describe('vocabSetHandler', () => {
  it('validate accepts manifest with vocabSetId', () => {
    expect(vocabSetHandler.validate(VOCAB_MANIFEST)).toBe(true);
  });

  it('validate rejects manifest with missing payload', () => {
    expect(vocabSetHandler.validate({ ...VOCAB_MANIFEST, handlerPayload: undefined })).toBe(false);
  });

  it('validate rejects manifest with empty vocabSetId', () => {
    expect(vocabSetHandler.validate({ ...VOCAB_MANIFEST, handlerPayload: { vocabSetId: '' } })).toBe(false);
  });

  it('install sets activeVocabSet, adds to installedApps, closes panel, opens categories after delay', () => {
    const { ctx, state } = makeCtx();
    vocabSetHandler.install(VOCAB_MANIFEST, ctx);
    expect(state.activeVocabSet).toBe('my-core');
    expect(state.installedApps).toEqual(['vocab-my-core']);
    expect(state.closeSidePanel).toBe(1);
    expect(state.openCategories).toBe(0);
    vi.advanceTimersByTime(150);
    expect(state.openCategories).toBe(1);
  });

  it('install is idempotent', () => {
    const { ctx, state } = makeCtx();
    vocabSetHandler.install(VOCAB_MANIFEST, ctx);
    vocabSetHandler.install(VOCAB_MANIFEST, ctx);
    expect(state.installedApps).toEqual(['vocab-my-core']);
  });

  it('uninstall removes from installedApps and resets activeVocabSet to all when active', () => {
    const { ctx, state } = makeCtx({ installedApps: ['vocab-my-core'], activeVocabSet: 'my-core' });
    vocabSetHandler.uninstall(VOCAB_MANIFEST, ctx);
    expect(state.installedApps).toEqual([]);
    expect(state.activeVocabSet).toBe('all');
  });

  it('uninstall preserves activeVocabSet when a DIFFERENT vocab set is active', () => {
    const { ctx, state } = makeCtx({ installedApps: ['vocab-my-core'], activeVocabSet: 'wordpower' });
    vocabSetHandler.uninstall(VOCAB_MANIFEST, ctx);
    expect(state.installedApps).toEqual([]);
    expect(state.activeVocabSet).toBe('wordpower');
  });

  it('isActive true when activeVocabSet matches payload', () => {
    const { ctx } = makeCtx({ activeVocabSet: 'my-core' });
    expect(vocabSetHandler.isActive(VOCAB_MANIFEST, ctx)).toBe(true);
  });

  it('isActive false when activeVocabSet does not match', () => {
    const { ctx } = makeCtx({ activeVocabSet: 'wordpower' });
    expect(vocabSetHandler.isActive(VOCAB_MANIFEST, ctx)).toBe(false);
  });

  it('launch re-activates vocab set and opens categories', () => {
    const { ctx, state } = makeCtx();
    vocabSetHandler.launch?.(VOCAB_MANIFEST, ctx);
    expect(state.activeVocabSet).toBe('my-core');
    expect(state.openCategories).toBe(1);
  });
});

describe('symbolLibraryHandler', () => {
  const m: ModuleManifest = {
    slug: 'symbol-libraries',
    version: '1.0.0',
    kind: 'symbol-library',
    tier: 'free',
    category: 'symbols',
    nameKey: 'mp_symbol_libraries',
    descKey: 'mp_symbol_libraries_desc',
    icon: '📚',
    status: 'available',
  };

  it('install adds to installedApps', () => {
    const { ctx, state } = makeCtx();
    symbolLibraryHandler.install(m, ctx);
    expect(state.installedApps).toEqual(['symbol-libraries']);
  });

  it('uninstall removes from installedApps', () => {
    const { ctx, state } = makeCtx({ installedApps: ['symbol-libraries'] });
    symbolLibraryHandler.uninstall(m, ctx);
    expect(state.installedApps).toEqual([]);
  });

  it('isActive reflects installedApps membership', () => {
    const { ctx } = makeCtx({ installedApps: ['symbol-libraries'] });
    expect(symbolLibraryHandler.isActive(m, ctx)).toBe(true);
  });

  it('launch opens settings', () => {
    const { ctx, state } = makeCtx();
    symbolLibraryHandler.launch?.(m, ctx);
    expect(state.openSettings).toBe(1);
  });
});

describe('boardTemplateHandler', () => {
  const m: ModuleManifest = {
    slug: 'board-templates',
    version: '1.0.0',
    kind: 'board-template',
    tier: 'free',
    category: 'vocab',
    nameKey: 'mp_board_templates',
    descKey: 'mp_board_templates_desc',
    icon: '📋',
    status: 'available',
  };

  it('install adds to installedApps and closes panel', () => {
    const { ctx, state } = makeCtx();
    boardTemplateHandler.install(m, ctx);
    expect(state.installedApps).toEqual(['board-templates']);
    expect(state.closeSidePanel).toBe(1);
  });

  it('uninstall removes from installedApps', () => {
    const { ctx, state } = makeCtx({ installedApps: ['board-templates'] });
    boardTemplateHandler.uninstall(m, ctx);
    expect(state.installedApps).toEqual([]);
  });
});

describe('gamePackHandler', () => {
  const m: ModuleManifest = {
    slug: 'game-packs',
    version: '1.0.0',
    kind: 'game-pack',
    tier: 'free',
    category: 'games',
    nameKey: 'mp_game_packs',
    descKey: 'mp_game_packs_desc',
    icon: '🎮',
    status: 'available',
    handlerPayload: { entry: 'panel' },
  };

  it('install adds to installedApps, closes panel, opens games after delay', () => {
    const { ctx, state } = makeCtx();
    gamePackHandler.install(m, ctx);
    expect(state.installedApps).toEqual(['game-packs']);
    expect(state.closeSidePanel).toBe(1);
    expect(state.openGames).toBe(0);
    vi.advanceTimersByTime(150);
    expect(state.openGames).toBe(1);
  });

  it('launch opens games immediately', () => {
    const { ctx, state } = makeCtx();
    gamePackHandler.launch?.(m, ctx);
    expect(state.openGames).toBe(1);
  });
});

describe('voicePackHandler', () => {
  const m: ModuleManifest = {
    slug: 'voice-packs',
    version: '0.0.0',
    kind: 'voice-pack',
    tier: 'standard',
    category: 'voices',
    nameKey: 'mp_voice_packs',
    descKey: 'mp_voice_packs_desc',
    icon: '🎙',
    status: 'coming_soon',
  };

  it('install records the install (for future server-published packs)', () => {
    const { ctx, state } = makeCtx();
    voicePackHandler.install(m, ctx);
    expect(state.installedApps).toEqual(['voice-packs']);
  });

  it('launch opens voice settings', () => {
    const { ctx, state } = makeCtx();
    voicePackHandler.launch?.(m, ctx);
    expect(state.openSettings).toBe(1);
  });
});

describe('panelHandler', () => {
  const m: ModuleManifest = {
    slug: 'picture-editor',
    version: '0.0.0',
    kind: 'panel',
    tier: 'standard',
    category: 'tools',
    nameKey: 'mp_picture_editor',
    descKey: 'mp_picture_editor_desc',
    icon: '🖼',
    status: 'coming_soon',
    handlerPayload: { panelId: 'picture-editor' },
  };

  it('validate rejects manifest with no panelId', () => {
    expect(panelHandler.validate({ ...m, handlerPayload: undefined })).toBe(false);
  });

  it('validate accepts manifest with panelId', () => {
    expect(panelHandler.validate(m)).toBe(true);
  });

  it('install records install', () => {
    const { ctx, state } = makeCtx();
    panelHandler.install(m, ctx);
    expect(state.installedApps).toEqual(['picture-editor']);
  });

  it('renderPanel returns null (panels mount via PrismApp sidePanel state)', () => {
    expect(panelHandler.renderPanel?.(m, makeCtx().ctx)).toBeNull();
  });

  it('launch dispatches openModulePanel with the manifest panelId', () => {
    const { ctx, state } = makeCtx();
    panelHandler.launch?.(m, ctx);
    expect(state.openModulePanel).toEqual(['picture-editor']);
  });

  it('launch falls back to openMarketplace when manifest is missing payload', () => {
    const { ctx, state } = makeCtx();
    panelHandler.launch?.({ ...m, handlerPayload: undefined }, ctx);
    expect(state.openMarketplace).toBe(1);
    expect(state.openModulePanel).toEqual([]);
  });
});
