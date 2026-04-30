'use client';
import { useCallback, useEffect, useState } from 'react';
import { useSettingsStore } from '@/store/settingsStore';
import { t as translate, getTTSCode, isRTL, loadLanguage, isLanguageLoaded } from './i18n';

export function useT() {
  const language = useSettingsStore((s) => s.language);
  const [ready, setReady] = useState(isLanguageLoaded(language));

  useEffect(() => {
    if (isLanguageLoaded(language)) { setReady(true); return; }
    setReady(false);
    loadLanguage(language).then(() => setReady(true));
  }, [language]);

  const tFn = useCallback((key: string) => translate(key, language), [language]);
  return { t: tFn, lang: language, ttsCode: getTTSCode(language), rtl: isRTL(language), ready };
}
