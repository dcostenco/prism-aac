'use client';

import type { MouseEvent } from 'react';
import { PRISM_AAC_BASE_PATH } from '@/lib/appPaths';

export default function TermsBackLink() {
  const closeEmbeddedTerms = (event: MouseEvent<HTMLAnchorElement>) => {
    const frame = window.frameElement as HTMLElement | null;
    if (frame?.dataset.aacTermsFrame !== 'true' || window.parent === window) return;

    try {
      const origin = window.location.origin;
      if (window.parent.location.origin !== origin) return;
      event.preventDefault();
      window.parent.postMessage({ type: 'aac-terms-close' }, origin);
    } catch {
      // A cross-origin parent keeps the ordinary standalone navigation behavior.
    }
  };

  return (
    <a
      className="inline-flex min-h-11 items-center rounded-md text-sm font-medium text-blue-700 underline-offset-4 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
      href={PRISM_AAC_BASE_PATH}
      onClick={closeEmbeddedTerms}
    >
      ← Prism AAC
    </a>
  );
}
