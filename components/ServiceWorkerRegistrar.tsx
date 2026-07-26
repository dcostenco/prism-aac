'use client';

import { useEffect } from 'react';
import {
  PRISM_AAC_SERVICE_WORKER_PATH,
  PRISM_AAC_SERVICE_WORKER_SCOPE,
} from '@/lib/appPaths';
import {
  SERVICE_WORKER_KILLSWITCH_KEY,
  SERVICE_WORKER_RESET_READY_EVENT,
} from '@/lib/serviceWorkerKillswitch';

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

    const registerAfterReset = () => {
      if (
        registrationStarted ||
        !buildId ||
        window.localStorage.getItem(SERVICE_WORKER_KILLSWITCH_KEY) !== buildId
      ) {
        return;
      }

      registrationStarted = true;
      void navigator.serviceWorker
        .register(PRISM_AAC_SERVICE_WORKER_PATH, {
          scope: PRISM_AAC_SERVICE_WORKER_SCOPE,
        })
        .catch((error: unknown) => {
          registrationStarted = false;
          console.error('[service-worker] registration failed', error);
        });
    };

    const registerAfterLoad = () => {
      if (document.readyState === 'complete') registerAfterReset();
    };

    window.addEventListener('load', registerAfterLoad);
    window.addEventListener(
      SERVICE_WORKER_RESET_READY_EVENT,
      registerAfterLoad,
    );
    registerAfterLoad();

    return () => {
      window.removeEventListener('load', registerAfterLoad);
      window.removeEventListener(
        SERVICE_WORKER_RESET_READY_EVENT,
        registerAfterLoad,
      );
    };
  }, []);

  return null;
}
