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
    const p = payload(manifest);
    if (!p) {
      // Bad manifest — fall back to the marketplace panel so the user has
      // somewhere to go.
      ctx.ui.openMarketplace();
      return;
    }
    // The uiStore knows which panelIds map to mounted panel components.
    // Unknown ids no-op; Phase 4 wires picture-editor, later phases wire
    // music-composer / video-composer / aac-designer.
    ctx.ui.openModulePanel(p.panelId);
  },

  renderPanel() {
    // Module panels mount via PrismApp.tsx + sidePanel state — no inline
    // render needed. This hook is reserved for future inline render cases
    // (e.g. a tool-strip module that lives inside MarketplaceDetail).
    return null;
  },
};
