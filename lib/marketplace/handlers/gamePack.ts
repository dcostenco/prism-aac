/**
 * game-pack handler.
 *
 * Phase 1: the single "Game Packs" catalog entry just opens GamesPanel —
 * matches existing behavior so users don't lose the games button.
 *
 * Phase 4+ introduces real game-pack content (themed bundles, e.g. "Animals
 * Pack", "Vehicles Pack") with downloaded JSON content. The handler will
 * grow to register games into a runtime catalog that GamesPanel reads.
 */
import type { ModuleHandler } from '../types';

export const gamePackHandler: ModuleHandler = {
  kind: 'game-pack',

  validate() {
    return true;
  },

  install(manifest, ctx) {
    ctx.settings.installApp(manifest.slug);
    ctx.ui.closeSidePanel();
    if (typeof setTimeout !== 'undefined') {
      setTimeout(() => ctx.ui.openGames(), 100);
    }
  },

  uninstall(manifest, ctx) {
    ctx.settings.uninstallApp(manifest.slug);
  },

  isActive(manifest, ctx) {
    return ctx.settings.getInstalledApps().includes(manifest.slug);
  },

  launch(_manifest, ctx) {
    ctx.ui.openGames();
  },
};
