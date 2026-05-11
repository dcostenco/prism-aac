import type { Metadata, Viewport } from "next";
import { Geist } from "next/font/google";
import { headers, cookies } from "next/headers";
import "./globals.css";
import HtmlLangSync from "@/components/HtmlLangSync";

const geist = Geist({ variable: "--font-geist", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Prism AAC",
  description: "Augmentative and Alternative Communication app",
  manifest: "/manifest.json",
  appleWebApp: { capable: true, statusBarStyle: "black-translucent", title: "Prism AAC" },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: "#f6f7fb",
  viewportFit: 'cover',
};

// SW kill-switch version. Bump whenever a deploy needs to evict a
// previously-registered Service Worker on every client. The inline
// script below compares the version in localStorage against this
// constant: on mismatch it unregisters all SWs under the current
// origin, deletes every Cache Storage entry, sets the new version,
// and reloads. End users self-heal automatically — no Develop-menu
// intervention. (May 2026: bumped to 2026-05-08-pdf-fix after users
// were stuck on Apr-30 SW serving stale chunks where PDF reader
// blew up on clinical PDFs.)
// Auto-bumped on every Vercel deploy via NEXT_PUBLIC_BUILD_ID (= short git SHA).
// Local dev falls back to a static string so repeated hot-reloads don't
// clear the cache on every refresh.
const SW_KILLSWITCH_VERSION = process.env.NEXT_PUBLIC_BUILD_ID || '2026-05-10-tts-fix';

// Emergency reset URL — the user's tracking calibration left them
// unable to reach Settings to disable. Visiting any page with
// `?reset=tracking` (or `#reset=tracking`) clears the relevant
// settings flags and reloads. Runs FIRST in the head so it executes
// before any tracking overlay can mount and steal pointer events.
const trackingResetScript = `
(function(){
  try {
    if (typeof window === 'undefined') return;
    var q = window.location.search + window.location.hash;
    if (q.indexOf('reset=tracking') === -1) return;
    var raw = window.localStorage.getItem('prism-aac-settings');
    if (raw) {
      var s = JSON.parse(raw);
      var st = typeof s.state === 'string' ? JSON.parse(s.state) : (s.state || {});
      if (typeof st !== 'object' || Array.isArray(st) || st === null) st = {};
      st.cameraInputEnabled = false;
      st.headTrackingEnabled = false;
      st.showHandCalibration = false;
      s.state = typeof s.state === 'string' ? JSON.stringify(st) : st;
      // Preserve version so Zustand migration runs correctly on next hydration
      // s.version is intentionally not modified here — only st (state) fields are changed.
      if (s.version !== undefined) { /* version preserved */ }
      window.localStorage.setItem('prism-aac-settings', JSON.stringify(s));
    }
    // Also drop any saved tracking calibrations that might be degenerate.
    try {
      var keysToRemove = [];
      for (var i = 0; i < window.localStorage.length; i++) {
        var k = window.localStorage.key(i);
        if (k && (k === 'prism-head-calibration' ||
                  k === 'prism-pose-calibration' ||
                  k.indexOf('prism-pose-calibration-') === 0)) {
          keysToRemove.push(k);
        }
      }
      keysToRemove.forEach(function(k){ window.localStorage.removeItem(k); });
    } catch(e){}
    var clean = window.location.pathname;
    window.location.replace(clean);
  } catch (e) {}
})();
`;

const swKillswitchScript = `
(function(){
  try {
    if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return;

    // ── Auto-reload when a new SW takes control ────────────────────────
    // When a new build is deployed: new SW installs → skipWaiting activates
    // it immediately → clientsClaim gives it control → controllerchange fires
    // → we reload once so the page runs the new JS bundles.
    // This is the standard PWA update pattern — zero user action needed.
    // Guard against infinite-reload loop: a compromised CDN SW claiming control
    // would fire controllerchange repeatedly. Limit to one reload per session.
    var _reloaded = false;
    navigator.serviceWorker.addEventListener('controllerchange', function() {
      if (_reloaded) return;
      _reloaded = true;
      window.location.reload();
    });

    // ── Kill-switch: force-clear on version bump ───────────────────────
    // Used only when the SW needs a full reset (e.g. corrupted cache).
    // Normal updates are handled by controllerchange above.
    var KEY = 'prism-aac-sw-killswitch';
    var V = ${JSON.stringify(SW_KILLSWITCH_VERSION)};
    if (window.localStorage.getItem(KEY) === V) return;
    window.localStorage.setItem(KEY, V);
    Promise.resolve()
      .then(function(){ return navigator.serviceWorker.getRegistrations(); })
      .then(function(regs){ return Promise.all(regs.map(function(r){ return r.unregister(); })); })
      .then(function(){
        if (typeof caches === 'undefined') return;
        return caches.keys().then(function(keys){
          var toDelete = keys.filter(function(k){
            return !k.includes('precache') && !k.includes('serwist');
          });
          return Promise.all(toDelete.map(function(k){ return caches.delete(k); }));
        });
      })
      .then(function(){ window.location.reload(); })
      .catch(function(){});
  } catch (e) {}
})();
`;

// Supported language codes — must stay in sync with SupportedLanguage in engine/i18n.ts.
const SUPPORTED_LANGS = ['en','es','fr','pt','ro','uk','ru','de','ja','ko','zh','ar','hi','it','pl','he','nl','vi','tl','tr','id'];

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  // Read the per-request nonce injected by middleware.ts so inline scripts
  // can be whitelisted without 'unsafe-inline' in the CSP.
  const headerStore = await headers();
  const nonce = headerStore.get('x-nonce') ?? '';

  // Read the persisted language preference from a cookie written by
  // settingsStore when the user changes language. Falls back to 'en'.
  const cookieStore = await cookies();
  const lang = (() => {
    try {
      const v = cookieStore.get('prism-aac-settings-lang')?.value;
      if (v && SUPPORTED_LANGS.includes(v)) return v;
    } catch { /* cookies() may throw during static generation */ }
    return 'en';
  })();

  return (
    <html lang={lang} className={`${geist.variable} h-full`}>
      <head>
        {/* SECURITY R13: these scripts contain ONLY build-time constants. Never interpolate user data. */}
        {/* Tracking emergency reset — runs FIRST so the user can
            escape a bad calibration via ?reset=tracking before any
            overlay mounts. Build-time constant content, no user input. */}
        <script nonce={nonce} dangerouslySetInnerHTML={{ __html: trackingResetScript }} />
        {/* SECURITY R13: these scripts contain ONLY build-time constants. Never interpolate user data. */}
        {/* Kill-switch — runs FIRST so it executes before any stale
            chunk loads. Build-time constant content, no user input. */}
        <script nonce={nonce} dangerouslySetInnerHTML={{ __html: swKillswitchScript }} />
      </head>
      <body className="h-full overflow-hidden">
        <HtmlLangSync />
        {children}
      </body>
    </html>
  );
}
