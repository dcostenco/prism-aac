'use client';

import { useEffect, useMemo, useState, useSyncExternalStore } from 'react';
import { getPictogramUrl, typedWordPicturesEnabled } from '@/services/pictogramService';
import { PicturePendingError } from '@/services/pictogramQueue';
import { resolveVocabularyPicture, reviewedVocabularyPictureChoices } from '@/lib/builtInSymbols';
import { englishSourceFor } from '@/constants/reverseTranslation';
import { watchPictureWords, pictureWordsVersion, subscribePictureWords } from '@/constants/pictureWords';
import { useRecoverablePicture } from '@/hooks/useRecoverablePicture';
import { useVocabularyPictureChoices } from '@/hooks/useVocabularyPictureChoices';
import type { PictureMode } from '@/store/settingsStore';
import type { SupportedLanguage } from '@/engine/i18n';

/**
 * What a prediction tile shows above (or instead of) its word:
 *   symbol    — the bundled symbol of the built-in phrase spelled this way
 *   generated — a generated picture for a typed or learned word (paid plans)
 *   pending   — waiting for a generated picture
 *   text      — no picture: the word alone, centred
 */
export type PredictionPictureKind = 'symbol' | 'generated' | 'pending' | 'text';

export function usePredictionPicture(
  word: string,
  language: SupportedLanguage,
  pictureMode: PictureMode,
  context?: string,
) {
  const [generatedIcon, setGeneratedIcon] = useState<{ key: string; url: string | null } | null>(null);
  const [retryAttempt, setRetryAttempt] = useState(0);

  // A predicted word that is built-in vocabulary follows its board tile: the
  // bundled symbol when its meaning has one, otherwise just the word — never a
  // generated picture the board itself would not show.
  // Re-read when a language's picture word table finishes loading.
  const tablesVersion = useSyncExternalStore(subscribePictureWords, pictureWordsVersion, pictureWordsVersion);
  // Start the language's table as soon as a tile renders. It used to start only when the prediction store first updated, so
  // a word that several tiles spell ("Más" = More, Plus, More-help) was a text tile on an idle screen and turned into its
  // picture after the first keystroke. A no-op once loaded.
  useEffect(() => watchPictureWords(language), [language]);
  const resolution = useMemo(
    () => resolveVocabularyPicture(word, language),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- tablesVersion changes the lookup's answer
    [word, language, tablesVersion],
  );
  const typedPictures = typedWordPicturesEnabled(pictureMode);
  const key = `${language}|${pictureMode}|${word}`;
  const mayGenerate = resolution.kind === 'unmapped' && typedPictures;

  useEffect(() => {
    if (!mayGenerate) return;
    // Anything else is a typed or learned word. Generated pictures are keyed
    // on English, so recover the English source when the word is vocabulary we
    // can map, and fall back to the localized word when it is not.
    let cancelled = false;
    const controller = new AbortController();
    let retryTimer: ReturnType<typeof setTimeout> | undefined;
    const english = englishSourceFor(word, language);
    getPictogramUrl(english ?? word, english ? 'en' : language, pictureMode, { text: word, lang: language }, { signal: controller.signal })
      .then((url) => { if (!cancelled) setGeneratedIcon({ key, url }); })
      .catch(error => {
        if (cancelled) return;
        if (error instanceof PicturePendingError) retryTimer = setTimeout(() => setRetryAttempt(value => value + 1), error.retryAfterMs);
        else setGeneratedIcon({ key, url: null });
      });
    return () => { cancelled = true; clearTimeout(retryTimer); controller.abort(); };
  }, [mayGenerate, key, word, language, pictureMode, retryAttempt]);

  // Keyed on the word (and language and plan) so the picture answered for the
  // previous prediction can never sit above the next one while it loads.
  const generated = generatedIcon?.key === key ? generatedIcon : null;
  let pictureUrl: string | null = null;
  let picture: PredictionPictureKind;
  if (resolution.kind === 'symbol') {
    pictureUrl = resolution.url;
    picture = 'symbol';
  } else if (resolution.kind === 'loading') {
    picture = typedPictures ? 'pending' : 'text';
  } else if (resolution.kind !== 'unmapped') {
    picture = 'text';
  } else if (!typedPictures) {
    picture = 'text';
  } else if (!generated) {
    picture = 'pending';
  } else {
    pictureUrl = generated.url;
    picture = pictureUrl ? 'generated' : 'text';
  }
  const image = useRecoverablePicture(pictureUrl, key);
  const files = context !== undefined && (resolution.kind === 'ambiguous' || resolution.kind === 'loading')
    ? reviewedVocabularyPictureChoices(word, language, context) : [];
  const alternatives = useVocabularyPictureChoices(files, `${key}|${files.join('|')}`);
  if (files.length) {
    return { picture: (alternatives.ready ? 'symbol' : 'pending') as PredictionPictureKind,
      pictureUrl: alternatives.images.length === 1 ? alternatives.images[0].url : null,
      onImageError: alternatives.images[0]?.onError ?? image.onError,
      imageKey: alternatives.images[0]?.key ?? image.imageKey,
      reason: files.length === 1 ? 'context-meaning' : 'alternative-meanings',
      alternativeImages: alternatives.images };
  }
  const failedImage = !!pictureUrl && !image.url;
  return { picture: failedImage ? 'text' : picture, pictureUrl: image.url, onImageError: image.onError,
    imageKey: image.imageKey, reason: failedImage ? 'image-error' : picture === 'generated' ? 'generated'
      : picture === 'pending' && resolution.kind === 'unmapped' ? 'generation-loading' : resolution.kind,
    alternativeImages: [] };
}
