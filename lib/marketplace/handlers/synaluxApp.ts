/**
 * synalux-app handler
 * --------------------
 * First-party Synalux web apps (Mail, Drive, ...) registered in the
 * marketplace so PrismAAC users — and any other client that consumes the
 * shared catalog — can install them alongside vocab packs and games.
 *
 * Install:    add slug to settingsStore.installedApps so the toolbar
 *             surfaces an `app:<slug>` button.
 * Launch:     open the live Synalux URL (configured via handlerPayload.path).
 *             The user's existing portal session cookie carries auth.
 *             Opens in a new tab to keep the AAC session running — many
 *             AAC users can't navigate back without help, so we never
 *             replace the current tab.
 *
 * Configuration (manifest.handlerPayload):
 *   path           — required; portal-relative path (e.g. "/mail", "/drive")
 *   target         — optional; "_blank" (default) or "_self"
 *   externalLabel  — optional; analytics tag, defaults to slug
 */
import type { ModuleHandler, ModuleManifest, HandlerContext } from '../types';

const PORTAL_BASE = (typeof process !== 'undefined' && process.env?.NEXT_PUBLIC_SYNALUX_PORTAL_URL)
  ? process.env.NEXT_PUBLIC_SYNALUX_PORTAL_URL
  : 'https://synalux.ai';

interface SynaluxAppPayload {
  path: string;
  target?: '_blank' | '_self';
  externalLabel?: string;
}

function getPayload(manifest: ModuleManifest): SynaluxAppPayload | null {
  const p = manifest.handlerPayload as SynaluxAppPayload | undefined;
  if (!p || typeof p.path !== 'string' || !p.path.startsWith('/')) return null;
  return p;
}

export const synaluxAppHandler: ModuleHandler = {
  kind: 'synalux-app',

  validate(manifest) {
    return getPayload(manifest) !== null;
  },

  install(manifest, ctx: HandlerContext) {
    ctx.settings.installApp(manifest.slug);
  },

  uninstall(manifest, ctx: HandlerContext) {
    ctx.settings.uninstallApp(manifest.slug);
  },

  isActive(manifest, ctx: HandlerContext) {
    return ctx.settings.getInstalledApps().includes(manifest.slug);
  },

  launch(manifest, _ctx: HandlerContext) {
    const payload = getPayload(manifest);
    if (!payload) return;
    const url = `${PORTAL_BASE}${payload.path}`;
    const target = payload.target || '_blank';
    if (typeof window === 'undefined') return;
    if (target === '_self') {
      window.location.href = url;
    } else {
      // noopener+noreferrer for security; new tab so the AAC session stays
      // alive and reachable for users with motor / cognitive limitations.
      window.open(url, '_blank', 'noopener,noreferrer');
    }
  },
};
