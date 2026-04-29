import { SpeechConfig, ToneStyle } from '../../types';
import { speakWithSystemTTS, stopSystemTTS, getAvailableVoices } from './systemTTS';
import { speakWithAzureTTS } from './azureTTS';
import { getSetting } from '../../db/repository';
import { Audio } from 'expo-av';

// Unified speech service — routes to system TTS or Azure Neural based on tier

let currentSound: Audio.Sound | null = null;

export async function speak(text: string, config: SpeechConfig): Promise<void> {
  if (!text.trim()) return;

  await stop();

  const azureKey = await getSetting('azure_tts_key');
  const azureRegion = await getSetting('azure_tts_region');

  if (azureKey && azureRegion) {
    try {
      const audioBuffer = await speakWithAzureTTS(text, config, azureKey, azureRegion);
      await playAudioBuffer(audioBuffer);
      return;
    } catch {
      // Fall back to system TTS on Azure failure
    }
  }

  // System TTS fallback (always available offline)
  await speakWithSystemTTS(text, config);
}

export async function stop(): Promise<void> {
  if (currentSound) {
    try {
      await currentSound.stopAsync();
      await currentSound.unloadAsync();
    } catch {
      // Ignore cleanup errors
    }
    currentSound = null;
  }
  await stopSystemTTS();
}

export async function getVoices() {
  return getAvailableVoices();
}

async function playAudioBuffer(buffer: ArrayBuffer): Promise<void> {
  // Convert ArrayBuffer to base64 for expo-av
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  const base64 = btoa(binary);
  const uri = `data:audio/mp3;base64,${base64}`;

  const { sound } = await Audio.Sound.createAsync({ uri });
  currentSound = sound;

  return new Promise<void>((resolve) => {
    sound.setOnPlaybackStatusUpdate((status) => {
      if ('didJustFinish' in status && status.didJustFinish) {
        sound.unloadAsync();
        currentSound = null;
        resolve();
      }
    });
    sound.playAsync();
  });
}
