import type { Metadata, Viewport } from "next";
import { Geist } from "next/font/google";
import "./globals.css";

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
const SW_KILLSWITCH_VERSION = '2026-05-09-gaze-jitter-fix-39';

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
      st.cameraInputEnabled = false;
      st.headTrackingEnabled = false;
      st.showHandCalibration = false;
      s.state = typeof s.state === 'string' ? JSON.stringify(st) : st;
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
          return Promise.all(keys.map(function(k){ return caches.delete(k); }));
        });
      })
      .then(function(){ window.location.reload(); })
      .catch(function(){});
  } catch (e) {}
})();
`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${geist.variable} h-full`}>
      <head>
        {/* Tracking emergency reset — runs FIRST so the user can
            escape a bad calibration via ?reset=tracking before any
            overlay mounts. Build-time constant content, no user input. */}
        <script dangerouslySetInnerHTML={{ __html: trackingResetScript }} />
        {/* Kill-switch — runs FIRST so it executes before any stale
            chunk loads. Build-time constant content, no user input. */}
        <script dangerouslySetInnerHTML={{ __html: swKillswitchScript }} />
      </head>
      <body className="h-full overflow-hidden">{children}</body>
    </html>
  );
}
