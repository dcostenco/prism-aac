import { SpeechConfig } from '../../types';

// Test the Azure SSML building logic
import { getSSMLPreview, getAzureVoiceForLanguage } from '../../services/speech/azureTTS';

describe('Azure TTS', () => {
  const baseConfig: SpeechConfig = {
    rate: 0.5,
    pitch: 0,
    volume: 1.0,
    tone: 'friendly',
    language: 'en',
  };

  describe('getAzureVoiceForLanguage', () => {
    it('returns English voice for en', () => {
      expect(getAzureVoiceForLanguage('en')).toContain('en-US');
    });

    it('returns Spanish voice for es', () => {
      expect(getAzureVoiceForLanguage('es')).toContain('es-ES');
    });

    it('returns Arabic voice for ar', () => {
      expect(getAzureVoiceForLanguage('ar')).toContain('ar-SA');
    });

    it('returns Japanese voice for ja', () => {
      expect(getAzureVoiceForLanguage('ja')).toContain('ja-JP');
    });

    it('falls back to English for unknown language', () => {
      expect(getAzureVoiceForLanguage('xx')).toContain('en-US');
    });

    it('returns a voice for every supported language', () => {
      const langs = ['en', 'es', 'fr', 'pt', 'ro', 'uk', 'ru', 'de', 'ja', 'ko', 'zh', 'ar'];
      for (const lang of langs) {
        expect(getAzureVoiceForLanguage(lang)).toBeTruthy();
      }
    });
  });

  describe('getSSMLPreview', () => {
    it('wraps text in SSML speak element', () => {
      const ssml = getSSMLPreview('Hello', baseConfig);
      expect(ssml).toContain('<speak');
      expect(ssml).toContain('</speak>');
    });

    it('includes voice element', () => {
      const ssml = getSSMLPreview('Hello', baseConfig);
      expect(ssml).toContain('<voice');
      expect(ssml).toContain('</voice>');
    });

    it('includes prosody with rate and pitch', () => {
      const ssml = getSSMLPreview('Hello', { ...baseConfig, rate: 0.7, pitch: 10 });
      expect(ssml).toContain('rate="70%"');
      expect(ssml).toContain('pitch="+10%"');
    });

    it('handles negative pitch', () => {
      const ssml = getSSMLPreview('Hello', { ...baseConfig, pitch: -20 });
      expect(ssml).toContain('pitch="-20%"');
    });

    it('does not add express-as for friendly tone (default)', () => {
      const ssml = getSSMLPreview('Hello', baseConfig);
      expect(ssml).not.toContain('express-as');
    });

    it('escapes XML special characters', () => {
      const ssml = getSSMLPreview('I want < 5 & > 3', baseConfig);
      expect(ssml).toContain('&lt;');
      expect(ssml).toContain('&amp;');
      expect(ssml).toContain('&gt;');
    });

    it('handles empty text', () => {
      const ssml = getSSMLPreview('', baseConfig);
      expect(ssml).toContain('<speak');
    });

    it('uses correct voice for language', () => {
      const ssml = getSSMLPreview('Hola', { ...baseConfig, language: 'es' });
      expect(ssml).toContain('es-ES');
    });
  });
});
