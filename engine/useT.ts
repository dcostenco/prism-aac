'use client';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSettingsStore } from '@/store/settingsStore';
import { t as translate, getTTSCode, isRTL, loadLanguage, isLanguageLoaded } from './i18n';

export function useT() {
  const language = useSettingsStore((s) => s.language);
  const outputLanguage = useSettingsStore((s) => s.outputLanguage);
  const [ready, setReady] = useState(isLanguageLoaded(language));

  useEffect(() => {
    if (isLanguageLoaded(language)) { setReady(true); return; }
    setReady(false);
    loadLanguage(language).then(() => setReady(true));
  }, [language]);

  const t = useCallback((key: string) => translate(key, language), [language]);

  return useMemo(() => ({
    t,
    lang: language,
    ttsCode: getTTSCode(language),
    outputTtsCode: getTTSCode(outputLanguage),
    rtl: isRTL(language),
    ready,
  }), [t, language, outputLanguage, ready]);
}
