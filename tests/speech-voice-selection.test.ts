/**
 * speechService — getBestOfflineVoice and getVoiceStatus
 *
 * These are the voice selection logic that determines which OS voice is used
 * for Tier 2 / Tier 3 TTS fallback. An AAC user who is offline depends
 * entirely on this path. The selection hierarchy is:
 *
 *   1. Premium / Neural (highest quality — name contains "Premium" or "Neural")
 *   2. Enhanced (non-Compact, name contains "Enhanced")
 *   3. Known-quality voices by name (KNOWN_QUALITY_VOICES table per lang)
 *   4. Non-Compact voice (last resort before Compact)
 *   5. First voice found (absolute fallback — quality "basic")
 *
 * getVoiceStatus derives the user-facing download nudge message from
 * getBestOfflineVoice; broken messages produce phantom or empty prompts
 * in Settings → Voice.
 *
 * Implementation note: speechService.ts caches voices in a module-level
 * `cachedVoices` array. getVoices() updates the cache only when it returns
 * a non-empty list. Tests that want a specific voice set call setVoices()
 * before getBestOfflineVoice to force the cache update. Tests that want
 * "no voice for language X" use the 'zz' sentinel language, which is never
 * added to any voice list in this file.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getBestOfflineVoice, getVoiceStatus } from '@/services/speechService';

function makeVoice(name: string, lang: string): SpeechSynthesisVoice {
  return { name, lang, voiceURI: name, default: false, localService: true } as SpeechSynthesisVoice;
}

function setVoices(voices: SpeechSynthesisVoice[]) {
  vi.mocked(window.speechSynthesis.getVoices).mockReturnValue(voices);
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(window.speechSynthesis.getVoices).mockReturnValue([]);
});

// ── getBestOfflineVoice ───────────────────────────────────────────────────────

describe('getBestOfflineVoice — no voices', () => {
  it('returns voice=null quality=none when no voice for the requested language', () => {
    // 'zz' is never in any voice list — safe sentinel
    const result = getBestOfflineVoice('zz');
    expect(result.voice).toBeNull();
    expect(result.quality).toBe('none');
  });

  it('returns none when only voices for a different language exist', () => {
    setVoices([makeVoice('Samantha', 'en-US')]);
    const result = getBestOfflineVoice('fr');
    expect(result.voice).toBeNull();
    expect(result.quality).toBe('none');
  });
});

describe('getBestOfflineVoice — Premium tier', () => {
  it('returns quality=premium when name includes "Premium"', () => {
    setVoices([
      makeVoice('Samantha', 'en-US'),
      makeVoice('Ava (Premium)', 'en-US'),
    ]);
    const { quality, voice } = getBestOfflineVoice('en');
    expect(quality).toBe('premium');
    expect(voice?.name).toBe('Ava (Premium)');
  });

  it('returns quality=premium when name includes "Neural"', () => {
    setVoices([
      makeVoice('Aria Neural', 'en-US'),
      makeVoice('Samantha', 'en-US'),
    ]);
    const { quality } = getBestOfflineVoice('en-US');
    expect(quality).toBe('premium');
  });

  it('prefers Premium/Neural over Enhanced', () => {
    setVoices([
      makeVoice('Alice Enhanced', 'en-US'),
      makeVoice('Bob Neural', 'en-US'),
    ]);
    const { quality, voice } = getBestOfflineVoice('en');
    expect(quality).toBe('premium');
    expect(voice?.name).toBe('Bob Neural');
  });
});

describe('getBestOfflineVoice — Enhanced tier', () => {
  it('returns quality=enhanced when name includes "Enhanced" (non-Compact)', () => {
    setVoices([
      makeVoice('Samantha Enhanced', 'en-US'),
    ]);
    const { quality } = getBestOfflineVoice('en');
    expect(quality).toBe('enhanced');
  });

  it('does NOT pick "Enhanced" voice that also contains "Compact"', () => {
    setVoices([
      makeVoice('Samantha Enhanced Compact', 'en-US'),
    ]);
    // Should fall through to known-quality or basic, not enhanced
    const { quality } = getBestOfflineVoice('en');
    expect(quality).not.toBe('enhanced');
  });
});

describe('getBestOfflineVoice — known quality voice names (KNOWN_QUALITY_VOICES table)', () => {
  it('returns quality=enhanced for a known-quality English voice (Ava)', () => {
    setVoices([
      makeVoice('Ava', 'en-US'),
      makeVoice('Albert Compact', 'en-US'), // low-quality junk that sorts before Ava alphabetically
    ]);
    const { quality, voice } = getBestOfflineVoice('en');
    expect(quality).toBe('enhanced');
    expect(voice?.name).toBe('Ava');
  });

  it('returns quality=enhanced for known-quality Japanese voice (Kyoko)', () => {
    setVoices([makeVoice('Kyoko', 'ja-JP')]);
    const { quality } = getBestOfflineVoice('ja');
    expect(quality).toBe('enhanced');
  });

  it('skips known-quality voice if it is a Compact variant', () => {
    setVoices([
      makeVoice('Samantha Compact', 'en-US'),
      makeVoice('Ava Compact', 'en-US'),
    ]);
    // Both known-quality voices are Compact — falls through to non-Compact → basic
    // All are Compact so the non-Compact filter also fails → absolute last resort
    const { quality } = getBestOfflineVoice('en');
    expect(quality).toBe('basic');
  });
});

describe('getBestOfflineVoice — basic tier', () => {
  it('prefers a non-Compact voice over a Compact one', () => {
    setVoices([
      makeVoice('Albert Compact', 'en-US'),
      makeVoice('Nora', 'en-US'),
    ]);
    const { quality, voice } = getBestOfflineVoice('en');
    expect(quality).toBe('basic');
    expect(voice?.name).toBe('Nora');
  });

  it('returns the first voice when only Compact voices exist', () => {
    setVoices([makeVoice('Samantha Compact', 'en-US')]);
    const { quality, voice } = getBestOfflineVoice('en');
    expect(quality).toBe('basic');
    expect(voice?.name).toBe('Samantha Compact');
  });
});

describe('getBestOfflineVoice — language matching', () => {
  it('matches by BCP-47 prefix (lang="en", voice.lang="en-US")', () => {
    setVoices([makeVoice('Samantha', 'en-US')]);
    const { voice } = getBestOfflineVoice('en');
    expect(voice).not.toBeNull();
  });

  it('matches by full tag (lang="en-US", voice.lang="en-US")', () => {
    setVoices([makeVoice('Samantha', 'en-US')]);
    const { voice } = getBestOfflineVoice('en-US');
    expect(voice).not.toBeNull();
  });

  it('does not match wrong-family lang (en voice for fr query)', () => {
    setVoices([makeVoice('Samantha', 'en-US')]);
    const { voice, quality } = getBestOfflineVoice('fr');
    expect(voice).toBeNull();
    expect(quality).toBe('none');
  });
});

// ── getVoiceStatus ────────────────────────────────────────────────────────────

describe('getVoiceStatus', () => {
  it('premium voice → needsDownload=false, empty message', () => {
    setVoices([makeVoice('Ava Premium', 'en-US')]);
    const { quality, needsDownload, message } = getVoiceStatus('en');
    expect(quality).toBe('premium');
    expect(needsDownload).toBe(false);
    expect(message).toBe('');
  });

  it('enhanced voice → needsDownload=true, mentions "Premium voice available"', () => {
    setVoices([makeVoice('Samantha Enhanced', 'en-US')]);
    const { quality, needsDownload, message } = getVoiceStatus('en');
    expect(quality).toBe('enhanced');
    expect(needsDownload).toBe(true);
    expect(message).toMatch(/Premium voice available/);
  });

  it('basic voice → needsDownload=true, mentions "Enhanced voice recommended"', () => {
    setVoices([makeVoice('Albert Compact', 'en-US')]);
    const { needsDownload, message } = getVoiceStatus('en');
    expect(needsDownload).toBe(true);
    expect(message).toMatch(/Enhanced voice recommended/);
  });

  it('no voice installed → needsDownload=true, mentions "No voice installed"', () => {
    // 'zz' never in any voice list → quality 'none'
    const { quality, needsDownload, message } = getVoiceStatus('zz');
    expect(quality).toBe('none');
    expect(needsDownload).toBe(true);
    expect(message).toMatch(/No voice installed/);
  });
});
