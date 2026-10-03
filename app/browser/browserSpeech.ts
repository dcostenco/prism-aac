'use client';

import { create } from 'zustand';
import { speakComposedMessage } from '@/services/speakMessage';
import { stopSpeech } from '@/services/speechService';
import { warmupAzureAudio } from '@/services/azureTTS';
import { useMessageStore } from '@/store/messageStore';

// The browser's Say: one controller for the toolbar button, the keyboard key
// and Enter. Speak used to wait up to 8 s for the cloud voice with no sign of
// progress, and pressing again restarted the request (14 s to first speech).

/** Longest wait for the cloud voice before the device voice speaks instead. */
export const BROWSER_CLOUD_VOICE_BUDGET_MS = 1500;

interface BrowserSpeechState {
  /** True from Say until speech ends or is stopped. */
  speaking: boolean;
}

export const useBrowserSpeech = create<BrowserSpeechState>(() => ({ speaking: false }));

// Each Say gets a number; only the latest may clear `speaking` when it ends,
// so an old utterance that finishes late cannot hide a newer one's Stop.
let generation = 0;

/** Stop speaking now. */
export function stopBrowserSpeech(): void {
  generation += 1;
  stopSpeech();
  useBrowserSpeech.setState({ speaking: false });
}

/** Say the message, or stop if the browser is already speaking. */
export function sayOrStop(text: string): void {
  if (useBrowserSpeech.getState().speaking) {
    stopBrowserSpeech();
    return;
  }
  const message = text.trim();
  if (!message || !useMessageStore.getState().soundEnabled) return;
  void warmupAzureAudio();
  const mine = ++generation;
  useBrowserSpeech.setState({ speaking: true });
  void speakComposedMessage(message, { cloudTimeoutMs: BROWSER_CLOUD_VOICE_BUDGET_MS })
    .catch(() => { /* speakComposedMessage falls back on its own; nothing to add here */ })
    .finally(() => {
      if (generation === mine) useBrowserSpeech.setState({ speaking: false });
    });
}
