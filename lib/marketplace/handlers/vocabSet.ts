/**
 * vocab-set handler.
 *
 * A vocab-set module activates a curated category bundle (My Core, WordPower,
 * Gateway, Aphasia, Social Chat) by writing its id to settings.activeVocabSet.
 * Categories.tsx reads activeVocabSet to filter visible categories.
 *
 * "Installed" persists in settings.installedApps so the toolbar surfaces a
 * one-tap re-launch button. "Active" is settings.activeVocabSet === payload.
 * They drift apart intentionally: a user can install several vocab sets and
 * switch the active one without uninstalling the others.
 */
import type { HandlerContext, ModuleHandler, ModuleManifest } from '../types';

interface VocabSetPayload {
  vocabSetId: string;
}

function payload(manifest: ModuleManifest): VocabSetPayload | null {
  const p = manifest.handlerPayload as VocabSetPayload | undefined;
  if (!p || typeof p.vocabSetId !== 'string' || !p.vocabSetId) return null;
  return p;
}

export const vocabSetHandler: ModuleHandler = {
  kind: 'vocab-set',

  validate(manifest) {
    return payload(manifest) !== null;
  },

  install(manifest, ctx) {
    const p = payload(manifest);
    if (!p) return;
    ctx.settings.update({ activeVocabSet: p.vocabSetId });
    ctx.settings.installApp(manifest.slug);
    ctx.ui.closeSidePanel();
    // 100ms delay matched the original MarketplacePanel behavior so the
    // close animation finished before Categories slid in. Browser-only —
    // tests using fake timers can advance them.
    if (typeof setTimeout !== 'undefined') {
      setTimeout(() => ctx.ui.openCategories(), 100);
    }
  },

  uninstall(manifest, ctx) {
    const p = payload(manifest);
    if (!p) return;
    // Preserve the active vocab set if it isn't this module — uninstalling
    // a non-active vocab pack must NOT break the active one. If we ARE the
    // active set, fall back to 'all' so categories still render.
    if (ctx.settings.getActiveVocabSet() === p.vocabSetId) {
      ctx.settings.update({ activeVocabSet: 'all' });
    }
    ctx.settings.uninstallApp(manifest.slug);
  },

  isActive(manifest, ctx) {
    const p = payload(manifest);
    if (!p) return false;
    return ctx.settings.getActiveVocabSet() === p.vocabSetId;
  },

  launch(manifest, ctx) {
    const p = payload(manifest);
    if (!p) return;
    // Re-activate this vocab set and open Categories — a one-tap re-launch.
    ctx.settings.update({ activeVocabSet: p.vocabSetId });
    ctx.ui.openCategories();
  },
};
