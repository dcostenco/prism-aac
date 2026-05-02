/**
 * panel handler — generic carrier for full-UI modules.
 *
 * Picture Editor (painter), Music Composer, Video Composer, AAC Designer
 * are all `kind: 'panel'` modules. Phase 1 leaves the actual panel
 * components unwritten; the handler simply tracks install state so a real
 * implementation can drop in later by:
 *   1. Building components/marketplace/panels/<panelId>.tsx
 *   2. Adding a switch case in renderPanel() below
 *   3. Flipping the manifest status from 'coming_soon' to 'available'
 *
 * The renderPanel hook returns null today so MarketplacePanel can ask
 * "do I have something to render?" and degrade gracefully.
 */
import type { ModuleHandler, ModuleManifest } from '../types';

interface PanelPayload {
  panelId: string;
}

function payload(manifest: ModuleManifest): PanelPayload | null {
  const p = manifest.handlerPayload as PanelPayload | undefined;
  if (!p || typeof p.panelId !== 'string' || !p.panelId) return null;
  return p;
}

export const panelHandler: ModuleHandler = {
  kind: 'panel',

  validate(manifest) {
    return payload(manifest) !== null;
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

  launch(manifest, ctx) {
    // Until a panel component exists, returning to the marketplace is the
    // safest UX — the user still sees their installed apps and can switch.
    // Phase 4-7 replace this with sidePanel state that mounts the real
    // panel component.
    void manifest;
    ctx.ui.openMarketplace();
  },

  renderPanel() {
    // No real panels exist yet. Phase 4 (Picture Editor / Painter) lands
    // first; subsequent phases add the others.
    return null;
  },
};
