/**
 * board-template handler.
 *
 * Board templates are pre-built category+phrase bundles that a caregiver can
 * import to seed a new board. Phase 1 only supports the meta entry — an
 * "open chooser" stub. Phase 3+ adds individual templates with content URLs
 * and a content-fetch step.
 */
import type { ModuleHandler } from '../types';

export const boardTemplateHandler: ModuleHandler = {
  kind: 'board-template',

  validate() {
    return true;
  },

  install(manifest, ctx) {
    ctx.settings.installApp(manifest.slug);
    ctx.ui.closeSidePanel();
  },

  uninstall(manifest, ctx) {
    ctx.settings.uninstallApp(manifest.slug);
  },

  isActive(manifest, ctx) {
    return ctx.settings.getInstalledApps().includes(manifest.slug);
  },

  launch(_manifest, ctx) {
    // Until per-template content lands (Phase 3), launching the parent entry
    // returns to the marketplace where the user can browse children.
    ctx.ui.openMarketplace();
  },
};
