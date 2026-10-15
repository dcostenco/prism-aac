/**
 * The cloud voice takes at most CLOUD_SPEECH_MAX_CHARS per request. Long
 * messages are split, never cut: everything past the limit used to be dropped.
 */
import { describe, expect, it } from 'vitest';
import { splitForCloudSpeech } from '@/services/speechChunks';

const sentence = (n: number) => `Sentence number ${n} tells the nurse something important. `;

describe('splitForCloudSpeech', () => {
  it('keeps short text whole', () => {
    expect(splitForCloudSpeech('I need help.', 500)).toEqual(['I need help.']);
  });

  it('loses nothing: the chunks concatenate back to the exact text, each within the limit', () => {
    const text = Array.from({ length: 40 }, (_, i) => sentence(i)).join('') + 'The last words matter most.';
    const chunks = splitForCloudSpeech(text, 500);
    expect(chunks.length).toBeGreaterThan(1);
    expect(chunks.join('')).toBe(text);
    for (const chunk of chunks) expect(chunk.length).toBeLessThanOrEqual(500);
    expect(chunks.at(-1)).toContain('The last words matter most.');
  });

  it('ends chunks at a sentence end when there is one', () => {
    const text = 'a'.repeat(30) + '. ' + 'b '.repeat(20);
    expect(splitForCloudSpeech(text, 40)[0]).toBe('a'.repeat(30) + '.');
  });

  it('does not treat a decimal point as a sentence end', () => {
    const text = 'Give 2.5 ml now and call me back right away please';
    for (const chunk of splitForCloudSpeech(text, 20)) expect(chunk.endsWith('2.')).toBe(false);
  });

  it('ends chunks at full-width and non-Latin sentence marks that need no space', () => {
    const zh = '我需要帮助。'.repeat(3);
    expect(splitForCloudSpeech(zh, 10)).toEqual(['我需要帮助。', '我需要帮助。', '我需要帮助。']);
    const am = 'እርዳታ እፈልጋለሁ።'.repeat(2);
    expect(splitForCloudSpeech(am, 15)[0]).toBe('እርዳታ እፈልጋለሁ።');
  });

  it('falls back to a space, then to a hard cut for text with neither', () => {
    expect(splitForCloudSpeech('one two three four', 9)).toEqual(['one two ', 'three ', 'four']);
    expect(splitForCloudSpeech('abcdefghij', 4)).toEqual(['abcd', 'efgh', 'ij']);
  });

  it('never splits an emoji or other surrogate pair', () => {
    const text = 'abc😀def';
    const chunks = splitForCloudSpeech(text, 4);
    expect(chunks.join('')).toBe(text);
    expect(chunks).toContain('😀de');
    for (const chunk of chunks) expect(chunk).not.toMatch(/[\uD800-\uDBFF]$/);
  });

  it('never cuts through an accented letter or a joined emoji sequence', async () => {
    const accent = 'e\u0301'; // é written as e + combining acute
    const family = '\u{1F468}\u200D\u{1F469}\u200D\u{1F467}'; // one emoji, five code points
    for (const unit of [accent, family]) {
      const text = 'x'.repeat(9) + unit + 'y'.repeat(9);
      const chunks = splitForCloudSpeech(text, 10);
      expect(chunks.join('')).toBe(text);
      expect(chunks.some(c => c.includes(unit))).toBe(true);
    }
  });
});
