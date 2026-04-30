'use client';
import { useCallback, useEffect, useState } from 'react';
import { useSettingsStore } from '@/store/settingsStore';
import { t as translate, getTTSCode, isRTL, loadLanguage, isLanguageLoaded } from './i18n';

export function useT() {
  const language = useSettingsStore((s) => s.language);
  const [ready, setReady] = useState(isLanguageLoaded(language));

  useEffect(() => {
    // Async locale loader: must flip `ready` based on the network result; the
    // synchronous-set fast path avoids a re-render flash when the locale is
    // already in memory.
    /* eslint-disable react-hooks/set-state-in-effect */
    if (isLanguageLoaded(language)) { setReady(true); return; }
    setReady(false);
    loadLanguage(language).then(() => setReady(true));
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [language]);

  const tFn = useCallback((key: string) => translate(key, language), [language]);
  return { t: tFn, lang: language, ttsCode: getTTSCode(language), rtl: isRTL(language), ready };
}
