'use client';

import { useEffect, useMemo, useState } from 'react';
import { useSettingsStore } from '@/store/settingsStore';
import { useT } from '@/engine/useT';
import { tapFeedback } from '@/services/feedback';
import { speak } from '@/services/speechService';
import {
  fetchVoiceCatalog,
  voicesForLanguage,
  type VoiceEntry,
  type VoiceGender,
} from '@/services/voiceCatalogService';

/**
 * VoicePicker — paid-only Voice settings sub-panel.
 *
 * Shows the voices available for the user's current outputLanguage. User can
 * filter by gender and pick a specific voice; choice is stored per-language
 * in settingsStore.voicePreferences.
 *
 * Voice catalog comes from the Synalux portal (/api/v1/tts/voices) — single
 * source of truth, not duplicated here.
 */
export default function VoicePicker() {
  const { t } = useT();
  const language = useSettingsStore((s) => s.language);
  const outputLanguage = useSettingsStore((s) => s.outputLanguage);
  const voicePreferences = useSettingsStore((s) => s.voicePreferences);
  const setVoiceForLang = useSettingsStore((s) => s.setVoiceForLang);

  const activeLang = outputLanguage || language;
  const baseLang = activeLang.toLowerCase().split(/[-_]/)[0];

  const [catalog, setCatalog] = useState<VoiceEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [genderFilter, setGenderFilter] = useState<VoiceGender | 'any'>('any');
  const [previewing, setPreviewing] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetchVoiceCatalog().then((entries) => {
      if (!cancelled) {
        setCatalog(entries);
        setLoading(false);
      }
    });
    return () => { cancelled = true; };
  }, []);

  const langVoices = useMemo(() => voicesForLanguage(catalog, baseLang), [catalog, baseLang]);
  const filteredVoices = useMemo(() => {
    if (genderFilter === 'any') return langVoices;
    return langVoices.filter((v) => v.gender === genderFilter);
  }, [langVoices, genderFilter]);

  const currentVoiceId = voicePreferences[baseLang];

  const handlePick = (voiceId: string) => {
    tapFeedback();
    if (currentVoiceId === voiceId) {
      // Tap selected voice again = clear (back to platform default)
      setVoiceForLang(baseLang, undefined);
    } else {
      setVoiceForLang(baseLang, voiceId);
    }
  };

  const handlePreview = async (voiceId: string) => {
    tapFeedback();
    setPreviewing(voiceId);
    // Briefly set the pref so speak() forwards this voiceId, then restore.
    const prior = voicePreferences[baseLang];
    setVoiceForLang(baseLang, voiceId);
    try {
      await speak(t('voice_preview_sample'), 0.5, 1.0, activeLang as string);
    } finally {
      // Restore prior preference after preview
      setVoiceForLang(baseLang, prior);
      setPreviewing(null);
    }
  };

  if (loading) {
    return <p className="text-muted text-sm">{t('voice_loading')}</p>;
  }

  if (catalog.length === 0) {
    // Could be 403 (free tier) or network error — message is generic.
    return <p className="text-muted text-sm">{t('voice_unavailable')}</p>;
  }

  if (langVoices.length === 0) {
    return (
      <p className="text-muted text-sm">
        {t('voice_no_voices_for_lang')} ({baseLang})
      </p>
    );
  }

  return (
    <div className="space-y-3">
      {/* Gender filter chips */}
      <div className="flex gap-2">
        {(['any', 'female', 'male'] as const).map((g) => (
          <button
            key={g}
            onClick={() => { tapFeedback(); setGenderFilter(g); }}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition ${
              genderFilter === g
                ? 'bg-[#4CAF50] text-white'
                : 'surface-key text-primary border border-theme'
            }`}
          >
            {t(g === 'any' ? 'voice_filter_any' : g === 'female' ? 'voice_filter_female' : 'voice_filter_male')}
          </button>
        ))}
      </div>

      {/* Voice list */}
      <div className="space-y-1.5">
        {filteredVoices.map((v) => {
          const isSelected = currentVoiceId === v.voiceId;
          const isPreviewing = previewing === v.voiceId;
          return (
            <div
              key={v.voiceId}
              className={`flex items-center justify-between rounded-lg px-3 py-2.5 border transition ${
                isSelected
                  ? 'bg-[#4CAF50]/10 border-[#4CAF50]'
                  : 'surface-key border-theme'
              }`}
            >
              <button
                onClick={() => handlePick(v.voiceId)}
                className="flex-1 text-left"
                aria-label={`Select voice ${v.displayName}`}
                aria-pressed={isSelected}
              >
                <div className="text-primary font-medium text-sm flex items-center gap-2">
                  {v.displayName}
                  {isSelected && <span className="text-[#4CAF50] text-xs">✓ {t('voice_selected')}</span>}
                </div>
                {v.description && (
                  <div className="text-muted text-xs mt-0.5">{v.description}</div>
                )}
              </button>
              <button
                onClick={() => handlePreview(v.voiceId)}
                disabled={isPreviewing}
                aria-label={`Preview ${v.displayName}`}
                className="ml-2 px-2.5 py-1.5 rounded-md text-xs font-semibold border border-theme hover:bg-[#2196F3]/10 disabled:opacity-50"
              >
                {isPreviewing ? '…' : `▶ ${t('voice_preview')}`}
              </button>
            </div>
          );
        })}
      </div>

      {/* Reset to default */}
      {currentVoiceId && (
        <button
          onClick={() => { tapFeedback(); setVoiceForLang(baseLang, undefined); }}
          className="text-[#F44336] text-sm hover:underline"
        >
          {t('voice_reset_default')}
        </button>
      )}
    </div>
  );
}
