'use client';

import { useT } from '@/engine/useT';
import { useBrowserStore } from './browserStore';
import { BOOKMARKS } from './BrowserToolbar';

export default function BrowserContent() {
  const { t } = useT();
  const isHome = useBrowserStore((s) => s.isHome);
  const navigate = useBrowserStore((s) => s.navigate);

  if (!isHome) {
    return (
      <div className="flex-[2] min-h-0 surface-app flex items-center justify-center" data-testid="browser-content">
        <p className="text-muted text-sm text-center px-4">
          Website content is displayed by the native browser layer.
        </p>
      </div>
    );
  }

  return (
    <div className="flex-[2] min-h-0 overflow-auto surface-app" data-testid="browser-content">
      <div className="flex flex-col items-center justify-center min-h-full gap-4 p-4">
        <div className="text-center">
          <div className="text-4xl sm:text-5xl mb-1">🌐</div>
          <h1 className="text-xl sm:text-2xl font-extrabold text-primary">Prism AAC Browser</h1>
          <p className="text-xs sm:text-sm text-muted mt-0.5">Browse the web with AAC support</p>
        </div>

        <div className="grid grid-cols-3 sm:grid-cols-6 gap-2 sm:gap-3 w-full max-w-lg">
          {BOOKMARKS.map(b => (
            <button
              key={b.url}
              onClick={() => navigate(b.url)}
              aria-label={b.label}
              className="aac-btn flex flex-col items-center gap-1 p-3 sm:p-4 rounded-xl surface-key border border-theme text-xs sm:text-sm font-semibold select-none min-h-[60px] sm:min-h-[80px]"
            >
              <span className="text-2xl sm:text-3xl">{b.icon}</span>
              {b.label}
            </button>
          ))}
        </div>

        <p className="text-[10px] sm:text-xs text-muted text-center max-w-xs hidden portrait:block">
          Type below to search. Tap 🌐 to switch to Browse mode, then tap Go.
        </p>
      </div>
    </div>
  );
}
