/**
 * symbol-library handler.
 *
 * Today this is a marker for "open Settings → Pictogram source". Phase 3
 * will fetch alternative ARASAAC mirrors / SymbolStix bundles. Until then,
 * installing flips installedApps (so the toolbar shows the launcher) and
 * deep-links to Settings.
 */
import type { ModuleHandler } from '../types';

export const symbolLibraryHandler: ModuleHandler = {
  kind: 'symbol-library',

  validate() {
    return true;
  },

  install(manifest, ctx) {
    ctx.settings.installApp(manifest.slug);
  },

  uninstall(manifest, ctx) {
    ctx.settings.uninstallApp(manifest.slug);
  },

  isActive(manifest, ctx) {
    return ctx.settings.getInstalledApps().includes(manifest.slug);
  },

  launch(_manifest, ctx) {
    ctx.ui.openSettings('symbol-libraries');
  },
};
