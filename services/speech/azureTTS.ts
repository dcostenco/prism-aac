import { SpeechConfig, ToneStyle } from '../../types';

// Azure Neural TTS with SSML and speaking styles (tones)
// Requires Azure Cognitive Services Speech API key (Standard+ tier)

const AZURE_VOICES: Record<string, string> = {
  'en': 'en-US-JennyMultilingualNeural',
  'es': 'es-ES-ElviraNeural',
  'fr': 'fr-FR-DeniseNeural',
  'pt': 'pt-BR-FranciscaNeural',
  'ro': 'ro-RO-AlinaNeural',
  'uk': 'uk-UA-PolinaNeural',
  'ru': 'ru-RU-SvetlanaNeural',
  'de': 'de-DE-KatjaNeural',
  'ja': 'ja-JP-NanamiNeural',
  'ko': 'ko-KR-SunHiNeural',
  'zh': 'zh-CN-XiaoxiaoNeural',
  'ar': 'ar-SA-ZariyahNeural',
};

// Voices that support speaking styles
const STYLE_SUPPORTED_VOICES = new Set([
  'en-US-JennyMultilingualNeural',
  'zh-CN-XiaoxiaoNeural',
  'ja-JP-NanamiNeural',
]);

function buildSSML(text: string, config: SpeechConfig): string {
  const voice = config.voiceId || AZURE_VOICES[config.language] || AZURE_VOICES['en'];
  const supportsStyles = STYLE_SUPPORTED_VOICES.has(voice);
  const rate = `${Math.round(config.rate * 100)}%`;
  const pitch = `${config.pitch >= 0 ? '+' : ''}${config.pitch}%`;

  let innerContent = escapeXml(text);

  // Wrap with express-as if the voice supports styles and tone is not default
  if (supportsStyles && config.tone !== 'friendly') {
    innerContent = `<mstts:express-as style="${config.tone}">${innerContent}</mstts:express-as>`;
  }

  return `<speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis"
    xmlns:mstts="http://www.w3.org/2001/mstts"
    xml:lang="${mapLanguageCode(config.language)}">
  <voice name="${voice}">
    <prosody rate="${rate}" pitch="${pitch}" volume="${Math.round(config.volume * 100)}">
      ${innerContent}
    </prosody>
  </voice>
</speak>`;
}

export async function speakWithAzureTTS(
  text: string,
  config: SpeechConfig,
  apiKey: string,
  region: string = 'eastus'
): Promise<ArrayBuffer> {
  const ssml = buildSSML(text, config);
  const endpoint = `https://${region}.tts.speech.microsoft.com/cognitiveservices/v1`;

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Ocp-Apim-Subscription-Key': apiKey,
      'Content-Type': 'application/ssml+xml',
      'X-Microsoft-OutputFormat': 'audio-24khz-96kbitrate-mono-mp3',
      'User-Agent': 'PrismAAC',
    },
    body: ssml,
  });

  if (!response.ok) {
    throw new Error(`Azure TTS failed: ${response.status} ${response.statusText}`);
  }

  return response.arrayBuffer();
}

export function getAzureVoiceForLanguage(language: string): string {
  return AZURE_VOICES[language] || AZURE_VOICES['en'];
}

export function getSSMLPreview(text: string, config: SpeechConfig): string {
  return buildSSML(text, config);
}

function escapeXml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function mapLanguageCode(lang: string): string {
  const map: Record<string, string> = {
    en: 'en-US', es: 'es-ES', fr: 'fr-FR', pt: 'pt-BR',
    ro: 'ro-RO', uk: 'uk-UA', ru: 'ru-RU', de: 'de-DE',
    ja: 'ja-JP', ko: 'ko-KR', zh: 'zh-CN', ar: 'ar-SA',
  };
  return map[lang] ?? lang;
}
