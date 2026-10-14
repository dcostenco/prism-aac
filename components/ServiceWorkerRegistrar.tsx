'use client';

import { useEffect } from 'react';
import { preparePictureStorage } from '@/services/bundledPicturePack';
import {
  PRISM_AAC_SERVICE_WORKER_PATH,
  PRISM_AAC_SERVICE_WORKER_SCOPE,
  PRISM_AAC_BASE_PATH,
  PRISM_AAC_OFFLINE_NAVIGATION_HEADER,
} from '@/lib/appPaths';
import {
  SERVICE_WORKER_KILLSWITCH_KEY,
  SERVICE_WORKER_RESET_READY_EVENT,
} from '@/lib/serviceWorkerKillswitch';
import { AAC_BUILD_REPORT, AAC_BUILD_REQUEST } from '@/lib/offlinePrecacheRetention';

export default function ServiceWorkerRegistrar() {
  useEffect(() => {
    if (
      process.env.NODE_ENV !== 'production' ||
      !('serviceWorker' in navigator)
    ) {
      return;
    }

    const buildId = process.env.NEXT_PUBLIC_BUILD_ID;
    let registrationStarted = false;
    let disposed = false;
    let warmed = false;
    const reportBuild = () => {
      if (!disposed && buildId && document.readyState === 'complete') {
        navigator.serviceWorker.controller?.postMessage?.({ type: AAC_BUILD_REPORT, buildId });
      }
    };
    const requestedBuild = (event: MessageEvent) => {
      if (event.data?.type === AAC_BUILD_REQUEST) reportBuild();
    };

    const warmDocument = () => {
      if (disposed || warmed || !navigator.serviceWorker.controller) return;
      warmed = true;
      void fetch(PRISM_AAC_BASE_PATH, {
        credentials: 'same-origin', cache: 'no-store',
        headers: { [PRISM_AAC_OFFLINE_NAVIGATION_HEADER]: '1' },
      }).then(response => {
        if (!response.ok) throw new Error('Offline document could not be saved');
        reportBuild();
      }).catch((error: unknown) => {
        warmed = false;
        console.warn('[service-worker] offline document unavailable:', error);
      });
    };

    const registerAfterReset = () => {
      if (
        registrationStarted ||
        !buildId ||
        window.localStorage.getItem(SERVICE_WORKER_KILLSWITCH_KEY) !== buildId
      ) {
        return;
      }

      registrationStarted = true;
      // Activation removes obsolete precache entries. Retain installed pictures first.
      // This waits for local storage only, never for a network download.
      void preparePictureStorage()
        .then(() => {
          if (disposed) return;
          return navigator.serviceWorker.register(PRISM_AAC_SERVICE_WORKER_PATH, {
            scope: PRISM_AAC_SERVICE_WORKER_SCOPE,
          });
        })
        .then(() => { if (!disposed) return navigator.serviceWorker.ready.then(warmDocument); })
        .catch((error: unknown) => {
          registrationStarted = false;
          console.error('[service-worker] registration failed', error);
        });
    };

    const registerAfterLoad = () => {
      if (document.readyState === 'complete') { registerAfterReset(); reportBuild(); }
    };

    window.addEventListener('load', registerAfterLoad);
    window.addEventListener('online', warmDocument);
    window.addEventListener('focus', reportBuild);
    document.addEventListener('visibilitychange', reportBuild);
    navigator.serviceWorker.addEventListener('message', requestedBuild);
    navigator.serviceWorker.addEventListener('controllerchange', reportBuild);
    navigator.serviceWorker.addEventListener('controllerchange', warmDocument);
    window.addEventListener(
      SERVICE_WORKER_RESET_READY_EVENT,
      registerAfterLoad,
    );
    registerAfterLoad();

    return () => {
      disposed = true;
      window.removeEventListener('online', warmDocument);
      window.removeEventListener('focus', reportBuild);
      document.removeEventListener('visibilitychange', reportBuild);
      navigator.serviceWorker.removeEventListener('message', requestedBuild);
      navigator.serviceWorker.removeEventListener('controllerchange', reportBuild);
      navigator.serviceWorker.removeEventListener('controllerchange', warmDocument);
      window.removeEventListener('load', registerAfterLoad);
      window.removeEventListener(
        SERVICE_WORKER_RESET_READY_EVENT,
        registerAfterLoad,
      );
    };
  }, []);

  return null;
}
