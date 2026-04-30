'use client';
import { useCallback } from 'react';
import { useSettingsStore } from '@/store/settingsStore';
import { t as translate, getTTSCode, isRTL } from './i18n';

export function useT() {
  const language = useSettingsStore((s) => s.language);
  const tFn = useCallback((key: string) => translate(key, language), [language]);
  return { t: tFn, lang: language, ttsCode: getTTSCode(language), rtl: isRTL(language) };
}
