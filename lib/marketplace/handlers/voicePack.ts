/**
 * voice-pack handler.
 *
 * Coming-soon stub. The Phase 1 catalog ships a single voice-packs entry
 * with status='coming_soon', so install() should never be called via the
 * UI flow. Recording an install path here lets future server-published
 * voice packs (e.g. Storyteller voice bundle) drop in without a code
 * release on the client.
 */
import type { ModuleHandler } from '../types';

export const voicePackHandler: ModuleHandler = {
  kind: 'voice-pack',

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
    ctx.ui.openSettings('voice');
  },
};
