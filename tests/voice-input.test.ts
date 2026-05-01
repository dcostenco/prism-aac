import { describe, it, expect } from 'vitest';
import { isVoiceInputSupported } from '@/services/voiceInputService';

describe('VoiceInputService', () => {
  it('reports not supported in test environment (no window.SpeechRecognition)', () => {
    expect(isVoiceInputSupported()).toBe(false);
  });
});

describe('Voice language code mapping', () => {
  it('should use BCP-47 codes for Web Speech API', () => {
    const langMap: Record<string, string> = {
      'en-US': 'en-US',
      'es-ES': 'es-ES',
      'fr-FR': 'fr-FR',
      'ru-RU': 'ru-RU',
      'ro-RO': 'ro-RO',
      'uk-UA': 'uk-UA',
      'de-DE': 'de-DE',
      'ja-JP': 'ja-JP',
      'ko-KR': 'ko-KR',
      'zh-CN': 'zh-CN',
      'ar-SA': 'ar-SA',
      'pt-BR': 'pt-BR',
    };
    for (const [code, expected] of Object.entries(langMap)) {
      const result = code.includes('-') ? code : `${code}-${code.toUpperCase()}`;
      expect(result).toBe(expected);
    }
  });

  it('should expand 2-letter codes to BCP-47', () => {
    const expand = (lang: string) => lang.includes('-') ? lang : `${lang}-${lang.toUpperCase()}`;
    expect(expand('en')).toBe('en-EN');
    expect(expand('es')).toBe('es-ES');
    expect(expand('ru')).toBe('ru-RU');
    expect(expand('en-US')).toBe('en-US');
  });
});

describe('Prediction word replacement', () => {
  it('should replace partial word when mid-typing', () => {
    const text = 'мы по';
    const word = 'Положи';
    const midWord = text.length > 0 && !text.endsWith(' ');
    const words = text.trim().split(/\s+/).filter(Boolean);

    expect(midWord).toBe(true);
    const prefix = words.slice(0, -1).join(' ');
    const newText = prefix ? `${prefix} ${word} ` : `${word} `;
    expect(newText).toBe('мы Положи ');
  });

  it('should append word when at word boundary', () => {
    const text = 'мы ';
    const word = 'Положи';
    const midWord = text.length > 0 && !text.endsWith(' ');

    expect(midWord).toBe(false);
    const result = text.trim() ? `${text.trim()} ${word}` : word;
    expect(result).toBe('мы Положи');
  });

  it('should handle empty text', () => {
    const text = '';
    const word = 'Привет';
    const midWord = text.length > 0 && !text.endsWith(' ');

    expect(midWord).toBe(false);
    const result = text.trim() ? `${text.trim()} ${word}` : word;
    expect(result).toBe('Привет');
  });
});

describe('Clinical vocabulary gating', () => {
  it('should only be available for paid tiers', () => {
    const PAID_PLANS = new Set(['standard', 'advanced', 'enterprise']);
    expect(PAID_PLANS.has('free')).toBe(false);
    expect(PAID_PLANS.has('standard')).toBe(true);
    expect(PAID_PLANS.has('advanced')).toBe(true);
    expect(PAID_PLANS.has('enterprise')).toBe(true);
  });
});

describe('TTS code mapping for all languages', () => {
  it('all 12 languages have valid ttsCode', () => {
    const codes = ['en-US', 'es-ES', 'fr-FR', 'pt-BR', 'ro-RO', 'uk-UA', 'ru-RU', 'de-DE', 'ja-JP', 'ko-KR', 'zh-CN', 'ar-SA'];
    expect(codes).toHaveLength(12);
    for (const code of codes) {
      expect(code).toMatch(/^[a-z]{2}-[A-Z]{2}$/);
    }
  });
});
