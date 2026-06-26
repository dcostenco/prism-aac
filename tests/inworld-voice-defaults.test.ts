/**
 * Voice catalog service — default voice resolution.
 *
 * The portal is the single source of truth for voice routing. The client
 * resolves defaults via fetchVoiceCatalog() + defaultVoiceForLanguage().
 * No hardcoded voice names in the public repo.
 */
import { describe, it, expect } from 'vitest';
import { voicesForLanguage, defaultVoiceForLanguage, VoiceEntry } from '@/services/voiceCatalogService';

const MOCK_CATALOG: VoiceEntry[] = [
  { voiceId: 'V1', lang: 'en', backend: 'inworld', gender: 'female', displayName: 'Voice1', tags: ['default'] },
  { voiceId: 'V2', lang: 'en', backend: 'inworld', gender: 'male',   displayName: 'Voice2', tags: ['warm'] },
  { voiceId: 'V3', lang: 'es', backend: 'inworld', gender: 'female', displayName: 'Voice3', tags: ['default'] },
  { voiceId: 'V4', lang: 'bg', backend: 'inworld', gender: 'female', displayName: 'Voice4', tags: ['default'] },
  { voiceId: 'V5', lang: 'ro', backend: 'inworld', gender: 'female', displayName: 'Voice5', tags: ['default'] },
];

describe('voicesForLanguage', () => {
  it('returns exact lang match', () => {
    expect(voicesForLanguage(MOCK_CATALOG, 'en')).toHaveLength(2);
    expect(voicesForLanguage(MOCK_CATALOG, 'es')).toHaveLength(1);
  });

  it('falls back to base lang for regional codes', () => {
    expect(voicesForLanguage(MOCK_CATALOG, 'en-US')).toHaveLength(2);
    expect(voicesForLanguage(MOCK_CATALOG, 'es-MX')).toHaveLength(1);
  });

  it('returns empty for unknown lang', () => {
    expect(voicesForLanguage(MOCK_CATALOG, 'xx')).toHaveLength(0);
  });
});

describe('defaultVoiceForLanguage', () => {
  it('returns the voice tagged "default"', () => {
    expect(defaultVoiceForLanguage(MOCK_CATALOG, 'en')).toBe('V1');
    expect(defaultVoiceForLanguage(MOCK_CATALOG, 'es')).toBe('V3');
  });

  it('returns first match when no default tag', () => {
    const noDefault: VoiceEntry[] = [
      { voiceId: 'X1', lang: 'fr', backend: 'inworld', gender: 'female', displayName: 'X' },
    ];
    expect(defaultVoiceForLanguage(noDefault, 'fr')).toBe('X1');
  });

  it('returns null for unknown lang', () => {
    expect(defaultVoiceForLanguage(MOCK_CATALOG, 'xx')).toBeNull();
  });

  it('resolves bg/ro without hardcoded voice names', () => {
    expect(defaultVoiceForLanguage(MOCK_CATALOG, 'bg')).toBe('V4');
    expect(defaultVoiceForLanguage(MOCK_CATALOG, 'ro')).toBe('V5');
  });
});

describe('empty catalog fallback (cold-start / offline / free tier)', () => {
  it('defaultVoiceForLanguage returns null on empty catalog', () => {
    expect(defaultVoiceForLanguage([], 'en')).toBeNull();
    expect(defaultVoiceForLanguage([], 'bg')).toBeNull();
    expect(defaultVoiceForLanguage([], 'ro')).toBeNull();
  });

  it('three-tier lookup resolves to VOICE_FALLBACK when catalog is empty', () => {
    const VOICE_FALLBACK = 'Sarah';
    const voicePref: Record<string, string> = {};
    for (const lang of ['en', 'bg', 'ro', 'uk', 'ru', 'es', 'fr', 'de']) {
      const voiceId = voicePref[lang]
        || defaultVoiceForLanguage([], lang)
        || VOICE_FALLBACK;
      expect(voiceId).toBe(VOICE_FALLBACK);
    }
  });

  it('catalog voice wins over fallback when catalog is loaded', () => {
    const VOICE_FALLBACK = 'Sarah';
    const voiceId = defaultVoiceForLanguage(MOCK_CATALOG, 'en') || VOICE_FALLBACK;
    expect(voiceId).toBe('V1');
  });

  it('user preference wins over everything', () => {
    const VOICE_FALLBACK = 'Sarah';
    const voicePref: Record<string, string> = { en: 'CustomVoice' };
    const voiceId = voicePref['en']
      || defaultVoiceForLanguage(MOCK_CATALOG, 'en')
      || VOICE_FALLBACK;
    expect(voiceId).toBe('CustomVoice');
  });
});
