'use client';
import { useEffect, useState } from 'react';
import { getPictogramUrl, pictureModeForProfile } from '@/services/pictogramService';
import { useSettingsStore } from '@/store/settingsStore';
import { useAuthStore } from '@/store/authStore';
import { useNearViewport } from '@/hooks/useNearViewport';

interface Props {
  phrase: string;
  englishPhrase?: string;
  customImageUrl?: string;
  className?: string;
  style?: React.CSSProperties;
  onClick: () => void;
  ariaLabel?: string;
  compact?: boolean;
}

export default function PhraseTile({ phrase, englishPhrase, customImageUrl, className, style, onClick, ariaLabel }: Props) {
  const language = useSettingsStore((s) => s.language);
  const profile = useAuthStore((s) => s.profile);
  const pictureMode = pictureModeForProfile(profile);
  const [fetchedIconUrl, setFetchedIconUrl] = useState<string | null>(null);
  const { elementRef, isNearViewport } = useNearViewport<HTMLButtonElement>(
    !customImageUrl,
  );

  useEffect(() => {
    if (customImageUrl) return;
    if (!isNearViewport) return;
    let cancelled = false;
    const searchPhrase = englishPhrase || phrase;
    getPictogramUrl(searchPhrase, 'en', pictureMode).then((url) => {
      if (!cancelled) setFetchedIconUrl(url);
    }).catch(() => { if (!cancelled) setFetchedIconUrl(null); });
    return () => { cancelled = true; };
  }, [phrase, englishPhrase, customImageUrl, pictureMode, language, isNearViewport]);
  const iconUrl = customImageUrl || fetchedIconUrl;

  return (
    <button
      ref={elementRef}
      onClick={onClick}
      aria-label={ariaLabel ?? phrase}
      data-testid="phrase-tile-card"
      className={`aac-phrase-tile ${className ?? ''}`}
      style={{
        border: '2px solid var(--border-strong, #000)',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        ...style,
      }}
    >
      <div className="aac-tile-icon" style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg-surface, white)', borderRadius: '8px 8px 0 0', overflow: 'hidden', minHeight: 0 }}>
        {iconUrl && (
          <img
            src={iconUrl}
            alt=""
            aria-hidden
            loading="lazy"
            style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }}
            onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }}
          />
        )}
      </div>
      <div
        data-testid="phrase-tile-label"
        className="aac-tile-label aac-phrase-label"
        style={{ borderTop: '1px solid rgba(0,0,0,0.2)' }}
      >
        {phrase}
      </div>
    </button>
  );
}
