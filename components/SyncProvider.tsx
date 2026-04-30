'use client';
import { useEffect, useState, useCallback, useRef } from 'react';
import {
  pushToCloud, pullFromCloud, subscribeToChanges,
  mergeWordFreq, mergeCustomItems, mergeHistory,
  SyncStatus, onSyncStatus, isSupabaseConfigured,
} from '@/services/syncService';
import { usePredictionStore } from '@/store/predictionStore';
import { useCategoryStore } from '@/store/categoryStore';
import { useMessageStore } from '@/store/messageStore';
import { useSettingsStore } from '@/store/settingsStore';

export function useSyncStatus(): SyncStatus {
  const [status, setStatus] = useState<SyncStatus>('idle');
  useEffect(() => onSyncStatus(setStatus), []);
  return status;
}

export default function SyncProvider({ children }: { children: React.ReactNode }) {
  const syncedRef = useRef(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const pushDebounced = useCallback(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      const pred = usePredictionStore.getState();
      const cat = useCategoryStore.getState();
      const msg = useMessageStore.getState();
      const settings = useSettingsStore.getState();

      pushToCloud({
        custom_categories: cat.customCategories,
        custom_phrases: cat.customPhrases,
        word_freq: pred.wordFreq,
        bigrams: pred.bigrams,
        history: msg.history,
        settings: { speechRate: settings.speechRate, speechVolume: settings.speechVolume },
      });
    }, 3000);
  }, []);

  useEffect(() => {
    if (syncedRef.current || !isSupabaseConfigured()) return;
    syncedRef.current = true;

    (async () => {
      const remote = await pullFromCloud();
      if (!remote) return;

      const pred = usePredictionStore.getState();
      const cat = useCategoryStore.getState();
      const msg = useMessageStore.getState();

      if (remote.word_freq) {
        const merged = mergeWordFreq(pred.wordFreq, remote.word_freq as Record<string, { count: number; lastUsed: number }>);
        usePredictionStore.setState({ wordFreq: merged });
      }
      if (remote.bigrams) {
        const merged = mergeWordFreq(pred.bigrams, remote.bigrams as Record<string, { count: number; lastUsed: number }>);
        usePredictionStore.setState({ bigrams: merged });
      }
      if (remote.custom_categories) {
        const merged = mergeCustomItems(cat.customCategories, remote.custom_categories);
        useCategoryStore.setState({ customCategories: merged });
      }
      if (remote.custom_phrases) {
        const merged = mergeCustomItems(cat.customPhrases, remote.custom_phrases);
        useCategoryStore.setState({ customPhrases: merged });
      }
      if (remote.history) {
        const merged = mergeHistory(msg.history, remote.history);
        useMessageStore.setState({ history: merged });
      }
    })();

    const unsub = subscribeToChanges((remote) => {
      const pred = usePredictionStore.getState();
      const cat = useCategoryStore.getState();
      const msg = useMessageStore.getState();

      if (remote.word_freq) usePredictionStore.setState({ wordFreq: mergeWordFreq(pred.wordFreq, remote.word_freq as Record<string, { count: number; lastUsed: number }>) });
      if (remote.bigrams) usePredictionStore.setState({ bigrams: mergeWordFreq(pred.bigrams, remote.bigrams as Record<string, { count: number; lastUsed: number }>) });
      if (remote.custom_categories) useCategoryStore.setState({ customCategories: mergeCustomItems(cat.customCategories, remote.custom_categories) });
      if (remote.custom_phrases) useCategoryStore.setState({ customPhrases: mergeCustomItems(cat.customPhrases, remote.custom_phrases) });
      if (remote.history) useMessageStore.setState({ history: mergeHistory(msg.history, remote.history) });
    });

    return () => { unsub?.(); };
  }, []);

  // Subscribe to store changes for auto-push
  useEffect(() => {
    if (!isSupabaseConfigured()) return;
    const unsubs = [
      usePredictionStore.subscribe(() => pushDebounced()),
      useCategoryStore.subscribe(() => pushDebounced()),
      useMessageStore.subscribe((s, prev) => { if (s.history !== prev.history) pushDebounced(); }),
      useSettingsStore.subscribe(() => pushDebounced()),
    ];
    return () => unsubs.forEach(u => u());
  }, [pushDebounced]);

  return <>{children}</>;
}
