'use client';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSettingsStore } from '@/store/settingsStore';
import { t as translate, getTTSCode, isRTL, loadLanguage, isLanguageLoaded } from './i18n';

export function useT() {
  const language = useSettingsStore((s) => s.language);
  const outputLanguage = useSettingsStore((s) => s.outputLanguage);
  const [ready, setReady] = useState(isLanguageLoaded(language));

  useEffect(() => {
    let mounted = true;
    if (isLanguageLoaded(language)) {
      queueMicrotask(() => { if (mounted) setReady(true); });
      return;
    }
    queueMicrotask(() => { if (mounted) setReady(false); });
    loadLanguage(language).then(() => { if (mounted) setReady(true); });
    return () => { mounted = false; };
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
