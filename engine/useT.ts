'use client';
import { useCallback, useEffect, useState } from 'react';
import { useSettingsStore } from '@/store/settingsStore';
import { t as translate, getTTSCode, isRTL, loadLanguage, isLanguageLoaded } from './i18n';

export function useT() {
  const language = useSettingsStore((s) => s.language);
  const outputLanguage = useSettingsStore((s) => s.outputLanguage);
  const [ready, setReady] = useState(isLanguageLoaded(language));

  useEffect(() => {
    /* eslint-disable react-hooks/set-state-in-effect */
    if (isLanguageLoaded(language)) { setReady(true); return; }
    setReady(false);
    loadLanguage(language).then(() => setReady(true));
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [language]);

  const tFn = useCallback((key: string) => translate(key, language), [language]);
  return {
    t: tFn,
    lang: language,
    ttsCode: getTTSCode(language),
    outputTtsCode: getTTSCode(outputLanguage),
    rtl: isRTL(language),
    ready,
  };
}
