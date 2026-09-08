'use client';

import { useEffect, useState } from 'react';
import { useT } from '@/engine/useT';
import { useAuthStore } from '@/store/authStore';
import { useSettingsStore } from '@/store/settingsStore';
import { clearSavedSpeech, getSpeechCacheScope } from '@/services/azureTTS';
import { speechAudioCache, SPEECH_CACHE_POLICY, type SpeechCacheStats } from '@/services/speechAudioCache';

const MIB = 1024 * 1024;

export default function SpeechCacheSettings() {
  const { t } = useT();
  const enabled = useSettingsStore(s => s.speechCacheEnabled);
  const update = useSettingsStore(s => s.update);
  const account = useAuthStore(s => s.profile?.email);
  const [stats, setStats] = useState<SpeechCacheStats | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);
  const [revision, setRevision] = useState(0);

  useEffect(() => {
    let active = true;
    void speechAudioCache.stats(getSpeechCacheScope()).then(value => {
      if (active) setStats(value);
    });
    return () => { active = false; };
  }, [account, revision]);

  const clear = async () => {
    setBusy(true);
    setError(false);
    try { setError(!await clearSavedSpeech()); }
    catch { setError(true); }
    finally { setBusy(false); setRevision(value => value + 1); }
  };

  return <div className="mt-4 space-y-2 border-t border-theme pt-3">
    <label className="flex items-center justify-between gap-3 text-primary text-sm">
      <span>{t('speech_cache_enable')}</span>
      <input type="checkbox" checked={enabled} disabled={busy}
        onChange={event => {
          const next = event.target.checked;
          update({ speechCacheEnabled: next });
          if (!next) void clear();
        }} />
    </label>
    <p className="text-muted text-xs">{t('speech_cache_description')}</p>
    <p className="text-muted text-xs" role="status">
      {stats?.available
        ? t('speech_cache_usage').replace('{clips}', String(stats.clips))
          .replace('{used}', (stats.bytes / MIB).toFixed(1))
          .replace('{limit}', String(SPEECH_CACHE_POLICY.maxBytes / MIB))
        : t('speech_cache_unavailable')}
    </p>
    <button type="button" disabled={busy} onClick={() => void clear()}
      className="aac-btn rounded-xl px-3 py-2 text-sm surface-key text-primary border border-theme disabled:opacity-50">
      {t(busy ? 'speech_cache_clearing' : 'speech_cache_clear')}
    </button>
    {error && <p role="alert" className="text-sm text-red-500">{t('speech_cache_clear_failed')}</p>}
  </div>;
}
