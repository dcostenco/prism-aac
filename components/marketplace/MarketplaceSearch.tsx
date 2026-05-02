'use client';
import { useState } from 'react';
import { useT } from '@/engine/useT';

interface Props {
  value: string;
  onChange: (q: string) => void;
}

/**
 * Search input. Filter logic lives in MarketplacePanel (it knows the catalog
 * + active tab); this component is purely UI + onChange dispatch.
 *
 * No debounce — the catalog is at most ~50 items in Phase 2, so filtering
 * per-keystroke is cheap. Phase 3 (server-driven catalog) might want a 200ms
 * debounce when N grows past ~500.
 */
export default function MarketplaceSearch({ value, onChange }: Props) {
  const { t } = useT();
  const [focused, setFocused] = useState(false);
  return (
    <div className="px-3 py-2 border-b border-theme shrink-0">
      <div
        className={`flex items-center gap-2 surface-key border-2 rounded-xl px-3 py-2 ${
          focused ? 'border-[#2196F3]' : 'border-theme'
        }`}
      >
        <span aria-hidden="true" className="text-muted">🔍</span>
        <input
          type="text"
          data-testid="mp-search"
          value={value}
          placeholder={t('mp_search_placeholder')}
          aria-label={t('mp_search_placeholder')}
          onChange={(e) => onChange(e.target.value)}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          className="flex-1 bg-transparent text-primary outline-none text-base"
        />
        {value && (
          <button
            data-testid="mp-search-clear"
            aria-label={t('clear')}
            onClick={() => onChange('')}
            className="text-muted text-lg w-6 h-6 flex items-center justify-center"
          >
            ✕
          </button>
        )}
      </div>
    </div>
  );
}
