'use client';
import { useEffect, useState } from 'react';
import { getPictogramUrl, pictureModeForProfile, typedWordPicturesEnabled } from '@/services/pictogramService';
import { PicturePendingError } from '@/services/pictogramQueue';
import { builtInPhraseSymbolUrl, isBuiltInPhraseId } from '@/lib/builtInSymbols';
import { useSettingsStore } from '@/store/settingsStore';
import { useAuthStore } from '@/store/authStore';
import { useNearViewport } from '@/hooks/useNearViewport';
import { useRecoverablePicture } from '@/hooks/useRecoverablePicture';
import FittedTileLabel from './FittedTileLabel';

interface Props {
  phrase: string;
  englishPhrase?: string;
  /** Id of the built-in phrase this tile shows. Omit for a custom phrase. */
  builtInPhraseId?: string;
  customImageUrl?: string;
  className?: string;
  style?: React.CSSProperties;
  onClick: () => void;
  ariaLabel?: string;
  compact?: boolean;
}

/**
 * What the tile shows above (or instead of) its word:
 *   custom    — a picture the caregiver chose
 *   symbol    — the bundled symbol approved for this built-in phrase
 *   generated — a generated picture for a typed phrase (paid plans)
 *   pending   — waiting for a generated picture
 *   text      — no picture: the word alone, centred and larger
 */
type Picture =
  | { kind: 'custom' | 'symbol' | 'generated'; url: string }
  | { kind: 'pending' | 'text' };

export default function PhraseTile({ phrase, englishPhrase, builtInPhraseId, customImageUrl, className, style, onClick, ariaLabel }: Props) {
  const language = useSettingsStore((s) => s.language);
  const profile = useAuthStore((s) => s.profile);
  const pictureMode = pictureModeForProfile(profile);
  const builtIn = isBuiltInPhraseId(builtInPhraseId);
  const generatedFor = englishPhrase || phrase;
  const wantsGenerated = !customImageUrl && !builtIn && typedWordPicturesEnabled(pictureMode);
  const requestKey = JSON.stringify([generatedFor, phrase, language, pictureMode]);
  const [generated, setGenerated] = useState<{ key: string; url: string | null } | null>(null);
  const [retryAttempt, setRetryAttempt] = useState(0);
  const { elementRef, isNearViewport } = useNearViewport<HTMLButtonElement>(wantsGenerated);

  useEffect(() => {
    if (!wantsGenerated || !isNearViewport) return;
    let cancelled = false;
    let retryTimer: ReturnType<typeof setTimeout> | undefined;
    getPictogramUrl(generatedFor, 'en', pictureMode, { text: phrase, lang: language }).then((url) => {
      if (!cancelled) setGenerated({ key: requestKey, url });
    }).catch((error) => {
      if (cancelled) return;
      // A busy or rate-limited portal is not a final answer: ask again after
      // its wait, as prediction tiles do, instead of leaving a text tile.
      if (error instanceof PicturePendingError) retryTimer = setTimeout(() => setRetryAttempt(value => value + 1), error.retryAfterMs);
      else setGenerated({ key: requestKey, url: null });
    });
    return () => { cancelled = true; clearTimeout(retryTimer); };
  }, [generatedFor, phrase, wantsGenerated, pictureMode, language, isNearViewport, requestKey, retryAttempt]);

  let picture: Picture;
  if (customImageUrl) {
    picture = { kind: 'custom', url: customImageUrl };
  } else if (builtIn) {
    const symbolUrl = builtInPhraseSymbolUrl(builtInPhraseId);
    picture = symbolUrl ? { kind: 'symbol', url: symbolUrl } : { kind: 'text' };
  } else if (!wantsGenerated) {
    picture = { kind: 'text' };
  } else if (generated?.key === requestKey) {
    picture = generated.url ? { kind: 'generated', url: generated.url } : { kind: 'text' };
  } else {
    picture = { kind: 'pending' };
  }
  const requestedUrl = 'url' in picture ? picture.url : null;
  const image = useRecoverablePicture(requestedUrl, JSON.stringify([requestKey, builtInPhraseId, customImageUrl]));
  if (requestedUrl && !image.url) picture = { kind: 'text' };
  const imageUrl = image.url;
  const textTile = picture.kind === 'text';

  return (
    <button
      ref={elementRef}
      onClick={onClick}
      aria-label={ariaLabel ?? phrase}
      data-testid="phrase-tile-card"
      data-picture={picture.kind}
      className={`aac-phrase-tile ${className ?? ''}`}
      style={{
        border: '2px solid var(--border-strong, #000)',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        ...style,
      }}
    >
      {!textTile && (
        <div className="aac-tile-icon" style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'transparent', borderRadius: '8px 8px 0 0', overflow: 'hidden', minHeight: 0 }}>
          {imageUrl && (
            <img
              key={image.imageKey}
              src={imageUrl}
              alt=""
              aria-hidden
              loading="lazy"
              // Fill the well, whatever the file's intrinsic size.
              style={{ width: '100%', height: '100%', maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }}
              onError={image.onError}
            />
          )}
        </div>
      )}
      <FittedTileLabel
        text={phrase}
        testId="phrase-tile-label"
        className={`aac-tile-label aac-phrase-label${textTile ? ' aac-text-tile-label' : ''}`}
        style={textTile ? undefined : { borderTop: '1px solid rgba(0,0,0,0.2)' }}
      />
    </button>
  );
}
