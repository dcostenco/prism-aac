'use client';
import { useEffect } from 'react';
import { useSettingsStore } from '@/store/settingsStore';

/**
 * Keeps <html lang="…"> in sync with the user's selected language so that
 * screen readers and other assistive technology use the correct pronunciation
 * rules after a language switch (e.g. Russian, Arabic, Spanish).
 *
 * Must be a client component because it reads Zustand state and calls
 * document.documentElement at runtime.
 */
export default function HtmlLangSync() {
  const language = useSettingsStore((s) => s.language);
  useEffect(() => {
    if (typeof document !== 'undefined') {
      document.documentElement.lang = language;
    }
  }, [language]);
  return null;
}
