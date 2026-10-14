'use client';

import { useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore } from 'react';
import { isBundledPicture, localPictureUrl, picturePackVersion, subscribePicturePack, watchPicturePack } from '@/services/bundledPicturePack';

const IMAGE_RETRY_DELAY_MS = 1_000;
const MAX_IMAGE_RETRIES = 2;

interface ResourceState {
  key: string;
  activation: number;
  attempts: number;
  waiting: boolean;
}
const useCommitEffect = typeof window === 'undefined' ? useEffect : useLayoutEffect;

/** Retry image transport failures within a fixed budget, scoped to the current tile. */
export function useRecoverablePicture(url: string | null, identity: string) {
  useSyncExternalStore(subscribePicturePack, picturePackVersion, picturePackVersion);
  const bundled = isBundledPicture(url);
  useEffect(() => bundled ? watchPicturePack() : undefined, [bundled]);
  url = localPictureUrl(url);
  const key = JSON.stringify([identity, url]);
  const [resource, setResource] = useState<ResourceState>({ key, activation: 0, attempts: 0, waiting: false });
  const active = resource.key === key ? resource
    : { key, activation: resource.activation + 1, attempts: 0, waiting: false };
  if (resource.key !== key) setResource(active);
  const { activation } = active;
  const current = useRef({ key, activation });
  useCommitEffect(() => { current.current = { key, activation }; }, [key, activation]);

  useEffect(() => {
    if (!active.waiting) return;
    const timer = setTimeout(() => {
      setResource(previous => previous.key === key && previous.activation === activation
        ? { ...previous, waiting: false } : previous);
    }, IMAGE_RETRY_DELAY_MS * active.attempts);
    return () => clearTimeout(timer);
  }, [key, activation, active.attempts, active.waiting]);

  const hidden = active.waiting || active.attempts > MAX_IMAGE_RETRIES;
  return {
    url: hidden ? null : url,
    imageKey: `${key}|${activation}|${active.attempts}`,
    onError: () => {
      if (!url || current.current.key !== key || current.current.activation !== activation) return;
      setResource(previous => {
        if (previous.key !== key || previous.activation !== activation) return previous;
        const attempts = previous.attempts + 1;
        return { key, activation, attempts, waiting: attempts <= MAX_IMAGE_RETRIES };
      });
    },
  };
}
