'use client';
/**
 * Azure Neural TTS — Paid tiers only
 *
 * Routes through Synalux /api/v1/tts endpoint (same auth as chat).
 * Server holds the Azure Speech key — no client-side secrets.
 *
 * Supports 9 emotional speaking styles via SSML express-as:
 *   friendly, cheerful, calm, serious, excited, hopeful, empathetic, sad, angry
 *
 * Voice selection per language:
 *   en → en-US-JennyMultilingualNeural (supports styles)
 *   es → es-ES-ElviraNeural
 *   ja → ja-JP-NanamiNeural (supports styles)
 *   zh → zh-CN-XiaoxiaoNeural (supports styles)
 *   ...etc
 *
 * Falls back to Web Speech API if Azure is unavailable.
 */

export type ToneStyle =
  | 'friendly' | 'cheerful' | 'calm' | 'serious' | 'excited'
  | 'hopeful' | 'empathetic' | 'sad' | 'angry';

export const TONE_OPTIONS: Array<{ id: ToneStyle; label: string; icon: string }> = [
  { id: 'friendly', label: 'Friendly', icon: '😊' },
  { id: 'cheerful', label: 'Cheerful', icon: '😄' },
  { id: 'calm', label: 'Calm', icon: '😌' },
  { id: 'serious', label: 'Serious', icon: '😐' },
  { id: 'excited', label: 'Excited', icon: '🤩' },
  { id: 'hopeful', label: 'Hopeful', icon: '🙏' },
  { id: 'empathetic', label: 'Empathetic', icon: '🤗' },
  { id: 'sad', label: 'Sad', icon: '😢' },
  { id: 'angry', label: 'Urgent', icon: '😤' },
];

const AZURE_VOICES: Record<string, string> = {
  'en-US': 'en-US-JennyMultilingualNeural',
  'es-ES': 'es-ES-ElviraNeural',
  'fr-FR': 'fr-FR-DeniseNeural',
  'pt-BR': 'pt-BR-FranciscaNeural',
  'ro-RO': 'ro-RO-AlinaNeural',
  'uk-UA': 'uk-UA-PolinaNeural',
  'ru-RU': 'ru-RU-SvetlanaNeural',
  'de-DE': 'de-DE-KatjaNeural',
  'ja-JP': 'ja-JP-NanamiNeural',
  'ko-KR': 'ko-KR-SunHiNeural',
  'zh-CN': 'zh-CN-XiaoxiaoNeural',
  'ar-SA': 'ar-SA-ZariyahNeural',
};

const STYLE_SUPPORTED = new Set([
  'en-US-JennyMultilingualNeural',
  'zh-CN-XiaoxiaoNeural',
  'ja-JP-NanamiNeural',
]);

function escapeXml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

export function buildSSML(text: string, lang: string, tone: ToneStyle, rate: number, volume: number): string {
  const voice = AZURE_VOICES[lang] || AZURE_VOICES['en-US'];
  const supportsStyles = STYLE_SUPPORTED.has(voice);
  const ratePercent = `${Math.round(rate * 100)}%`;
  const pitchPercent = '+0%';
  const volumeValue = Math.round(volume * 100);

  let inner = escapeXml(text);
  if (supportsStyles && tone !== 'friendly') {
    inner = `<mstts:express-as style="${tone}">${inner}</mstts:express-as>`;
  }

  return `<speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" xmlns:mstts="http://www.w3.org/2001/mstts" xml:lang="${lang}">
  <voice name="${voice}">
    <prosody rate="${ratePercent}" pitch="${pitchPercent}" volume="${volumeValue}">
      ${inner}
    </prosody>
  </voice>
</speak>`;
}

const SYNALUX_API = process.env.NEXT_PUBLIC_SYNALUX_API || 'https://synalux.ai/api/v1';

let currentAudio: HTMLAudioElement | null = null;
let currentBlobUrl: string | null = null;

export function stopAzureAudio(): void {
  if (currentAudio) {
    currentAudio.pause();
    currentAudio.src = '';
    currentAudio = null;
  }
  if (currentBlobUrl) {
    URL.revokeObjectURL(currentBlobUrl);
    currentBlobUrl = null;
  }
}

export async function speakAzure(
  text: string,
  lang: string,
  tone: ToneStyle,
  rate: number,
  volume: number,
  authToken: string,
): Promise<boolean> {
  const ssml = buildSSML(text, lang, tone, rate, volume);

  try {
    const res = await fetch(`${SYNALUX_API}/tts`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authToken}`,
      },
      body: JSON.stringify({ ssml, format: 'audio-24khz-96kbitrate-mono-mp3' }),
    });

    if (!res.ok) return false;

    stopAzureAudio();
    const audioBuffer = await res.arrayBuffer();
    const blob = new Blob([audioBuffer], { type: 'audio/mp3' });
    const url = URL.createObjectURL(blob);
    currentBlobUrl = url;
    const audio = new Audio(url);
    currentAudio = audio;
    audio.volume = volume;
    await audio.play();
    audio.onended = () => {
      URL.revokeObjectURL(url);
      if (currentAudio === audio) { currentAudio = null; currentBlobUrl = null; }
    };
    return true;
  } catch {
    return false;
  }
}
