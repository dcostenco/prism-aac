'use client';
import { useRecoverablePicture } from '@/hooks/useRecoverablePicture';
import { SYMBOL_BASE_PATH } from '@/lib/pictogramSources';

/** Keep all reviewed meanings visible together, including after transport retries. */
export function useVocabularyPictureChoices(files: readonly string[], identity: string) {
  const first = useRecoverablePicture(files[0] ? `${SYMBOL_BASE_PATH}${files[0]}` : null, `${identity}|0`);
  const second = useRecoverablePicture(files[1] ? `${SYMBOL_BASE_PATH}${files[1]}` : null, `${identity}|1`);
  const third = useRecoverablePicture(files[2] ? `${SYMBOL_BASE_PATH}${files[2]}` : null, `${identity}|2`);
  const resources = [first, second, third].slice(0, files.length);
  const ready = resources.length > 0 && resources.every(resource => !!resource.url);
  return {
    ready,
    images: ready ? resources.map((resource, index) => ({
      url: resource.url!, key: resource.imageKey, onError: resource.onError, file: files[index],
    })) : [],
  };
}
