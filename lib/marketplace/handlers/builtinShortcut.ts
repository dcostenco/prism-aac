/**
 * builtin-shortcut handler — surfaces a built-in feature (AAC Chat,
 * AI Chat, ...) inside the marketplace catalog for discovery, without
 * trying to install it. The toolbar entry is permanent, so install /
 * uninstall are intentional no-ops; launch opens the corresponding
 * built-in panel via HandlerContext.ui.openBuiltin().
 */
import type { ModuleHandler, ModuleManifest } from '../types';

interface BuiltinShortcutPayload {
  builtin: 'aac-chat' | 'ai-chat' | 'schedule' | 'caregiver' | 'math';
}

function payload(manifest: ModuleManifest): BuiltinShortcutPayload | null {
  const p = manifest.handlerPayload as BuiltinShortcutPayload | undefined;
  if (!p || typeof p.builtin !== 'string') return null;
  return p;
}

export const builtinShortcutHandler: ModuleHandler = {
  kind: 'builtin-shortcut',

  validate(manifest) {
    return payload(manifest) !== null;
  },

  install() { /* no-op — built-in is always present */ },
  uninstall() { /* no-op */ },

  isActive() {
    // Always "active" since the toolbar entry is permanent. The marketplace
    // detail view shows this as installed-by-default.
    return true;
  },

  launch(manifest, ctx) {
    const p = payload(manifest);
    if (!p) {
      ctx.ui.openMarketplace();
      return;
    }
    if (ctx.ui.openBuiltin) {
      ctx.ui.openBuiltin(p.builtin);
    } else {
      // Older host without openBuiltin — fall back to closing the
      // marketplace so the user can find the toolbar button themselves.
      ctx.ui.closeSidePanel();
    }
  },
};
