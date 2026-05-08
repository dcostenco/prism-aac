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
const SW_KILLSWITCH_VERSION = '2026-05-08-math-prose-9';

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
        {/* Kill-switch — runs FIRST so it executes before any stale
            chunk loads. Build-time constant content, no user input. */}
        <script dangerouslySetInnerHTML={{ __html: swKillswitchScript }} />
      </head>
      <body className="h-full overflow-hidden">{children}</body>
    </html>
  );
}
