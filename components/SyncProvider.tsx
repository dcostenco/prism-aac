'use client';
import { useEffect, useState, useCallback, useRef } from 'react';
import {
  pushToCloud, pushToCloudKeepalive, pullFromCloud, subscribeToChanges,
  mergeWordFreq, mergeCustomItems, mergeHistory,
  SyncStatus, onSyncStatus, isSupabaseConfigured,
} from '@/services/syncService';
import { usePredictionStore } from '@/store/predictionStore';
import { useCategoryStore } from '@/store/categoryStore';
import { useMessageStore } from '@/store/messageStore';
import { useSettingsStore } from '@/store/settingsStore';
import { useAuthStore } from '@/store/authStore';

export function useSyncStatus(): SyncStatus {
  const [status, setStatus] = useState<SyncStatus>('idle');
  useEffect(() => onSyncStatus(setStatus), []);
  return status;
}

export default function SyncProvider({ children }: { children: React.ReactNode }) {
  const syncedRef = useRef(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const gatherSyncPayload = useCallback(() => {
    const pred = usePredictionStore.getState();
    const cat = useCategoryStore.getState();
    const msg = useMessageStore.getState();
    const settings = useSettingsStore.getState();
    return {
      custom_categories: cat.customCategories,
      custom_phrases: cat.customPhrases,
      word_freq: pred.wordFreq,
      bigrams: pred.bigrams,
      history: msg.history,
      settings: { speechRate: settings.speechRate, speechVolume: settings.speechVolume },
    };
  }, []);

  const pushDebounced = useCallback(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => pushToCloud(gatherSyncPayload()), 3000);
  }, [gatherSyncPayload]);

  // Proactive periodic sync every 30s while app is open.
  // Keeps cloud delta small so pagehide only needs a tiny sendBeacon.
  // iOS Safari has no Background Sync API — this is the only reliable path.
  useEffect(() => {
    if (!isSupabaseConfigured()) return;
    const periodicSync = setInterval(() => {
      if (!isSupabaseConfigured() || !useAuthStore.getState().profile) return;
      pushToCloud(gatherSyncPayload());
    }, 30_000);
    return () => clearInterval(periodicSync);
  }, [gatherSyncPayload]);

  useEffect(() => {
    if (syncedRef.current || !isSupabaseConfigured()) return;
    syncedRef.current = true;

    (async () => {
      let remote: Awaited<ReturnType<typeof pullFromCloud>>;
      try { remote = await pullFromCloud(); } catch { return; }
      if (!remote) return;

      const pred = usePredictionStore.getState();
      const cat = useCategoryStore.getState();
      const msg = useMessageStore.getState();

      // Batch prediction updates into ONE setState call to avoid multiple
      // rapid Zustand notifications that cascade into React #300 crashes.
      const predUpdate: Record<string, unknown> = {};
      if (remote.word_freq) predUpdate.wordFreq = mergeWordFreq(pred.wordFreq, remote.word_freq as Record<string, { count: number; lastUsed: number }>);
      if (remote.bigrams) predUpdate.bigrams = mergeWordFreq(pred.bigrams, remote.bigrams as Record<string, { count: number; lastUsed: number }>);
      if (Object.keys(predUpdate).length) usePredictionStore.setState(predUpdate as any);

      const catUpdate: Record<string, unknown> = {};
      if (remote.custom_categories) catUpdate.customCategories = mergeCustomItems(cat.customCategories, remote.custom_categories);
      if (remote.custom_phrases) catUpdate.customPhrases = mergeCustomItems(cat.customPhrases, remote.custom_phrases);
      if (Object.keys(catUpdate).length) useCategoryStore.setState(catUpdate as any);

      if (remote.history) useMessageStore.setState({ history: mergeHistory(msg.history, remote.history) });
    })();

    const unsub = subscribeToChanges((remote) => {
      const pred = usePredictionStore.getState();
      const cat = useCategoryStore.getState();
      const msg = useMessageStore.getState();

      // Batch into single setState calls per store to prevent React #300 cascade
      const rPred: Record<string, unknown> = {};
      if (remote.word_freq) rPred.wordFreq = mergeWordFreq(pred.wordFreq, remote.word_freq as Record<string, { count: number; lastUsed: number }>);
      if (remote.bigrams) rPred.bigrams = mergeWordFreq(pred.bigrams, remote.bigrams as Record<string, { count: number; lastUsed: number }>);
      if (Object.keys(rPred).length) usePredictionStore.setState(rPred as any);
      const rCat: Record<string, unknown> = {};
      if (remote.custom_categories) rCat.customCategories = mergeCustomItems(cat.customCategories, remote.custom_categories);
      if (remote.custom_phrases) rCat.customPhrases = mergeCustomItems(cat.customPhrases, remote.custom_phrases);
      if (Object.keys(rCat).length) useCategoryStore.setState(rCat as any);
      if (remote.history) useMessageStore.setState({ history: mergeHistory(msg.history, remote.history) });
    });

    return () => { unsub?.(); };
  }, []);

  // Subscribe to store changes for auto-push
  useEffect(() => {
    if (!isSupabaseConfigured()) return;
    const unsubs = [
      usePredictionStore.subscribe((s, prev) => { if (s.wordFreq !== prev.wordFreq || s.bigrams !== prev.bigrams) pushDebounced(); }),
      useCategoryStore.subscribe((s, prev) => { if (s.customCategories !== prev.customCategories || s.customPhrases !== prev.customPhrases) pushDebounced(); }),
      useMessageStore.subscribe((s, prev) => { if (s.history !== prev.history) pushDebounced(); }),
      useSettingsStore.subscribe((s, prev) => { if (s.speechRate !== prev.speechRate || s.speechVolume !== prev.speechVolume) pushDebounced(); }),
    ];

    // Flush pending sync on page hide (child presses sleep button, closes tab).
    // Uses keepalive fetch so the request survives page teardown.
    const onPageHide = () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
        debounceRef.current = null;
        const pred = usePredictionStore.getState();
        const cat = useCategoryStore.getState();
        const msg = useMessageStore.getState();
        const settings = useSettingsStore.getState();
        pushToCloudKeepalive({
          custom_categories: cat.customCategories,
          custom_phrases: cat.customPhrases,
          word_freq: pred.wordFreq,
          bigrams: pred.bigrams,
          history: msg.history,
          settings: { speechRate: settings.speechRate, speechVolume: settings.speechVolume },
        });
      }
    };
    const onVisChange = () => { if (document.visibilityState === 'hidden') onPageHide(); };
    window.addEventListener('pagehide', onPageHide);
    document.addEventListener('visibilitychange', onVisChange);

    return () => {
      unsubs.forEach(u => u());
      window.removeEventListener('pagehide', onPageHide);
      document.removeEventListener('visibilitychange', onVisChange);
    };
  }, [pushDebounced]);

  return <>{children}</>;
}
