/**
 * Split text for the cloud voice, which accepts at most `max` characters per
 * request. Without this, everything past the limit was silently dropped from
 * a spoken message.
 *
 * The chunks concatenate back to exactly the input, so the part not yet spoken
 * can be handed to the device voice unchanged. Each chunk ends, in order of
 * preference, at a sentence end, after a space, or at a hard cut on a character
 * boundary: never inside an accented letter, an emoji or a joined emoji sequence.
 */

/** The most text one cloud speech request accepts (the portal enforces the same). */
export const CLOUD_SPEECH_MAX_CHARS = 500;

/** Marks that end a sentence without needing a following space. */
const FULL_STOPS = new Set(['。', '！', '？', '؟', '।', '॥', '።', '፧', '፨', '\n']);
/** Marks that end a sentence only when followed by a space ("3.5" is not a sentence end). */
const SPACED_STOPS = new Set(['.', '!', '?', '…']);

const isHighSurrogate = (code: number) => code >= 0xd800 && code <= 0xdbff;

function sentenceCut(text: string, max: number): number {
  for (let i = max - 1; i > 0; i--) {
    const ch = text[i];
    if (FULL_STOPS.has(ch)) return i + 1;
    if (SPACED_STOPS.has(ch) && /\s/.test(text[i + 1] ?? '')) return i + 1;
  }
  return 0;
}

function spaceCut(text: string, max: number): number {
  for (let i = max - 1; i > 0; i--) {
    if (/\s/.test(text[i])) return i + 1;
  }
  return 0;
}

type GraphemeSegmenter = { segment(text: string): Iterable<{ index: number }> };
type SegmenterConstructor = new (locale?: string, options?: { granularity: 'grapheme' }) => GraphemeSegmenter;

/** The last character (grapheme) boundary at or before max. Where Intl.Segmenter
 *  is missing, at least a surrogate pair is never split. */
function hardCut(text: string, max: number): number {
  const Segmenter = (Intl as unknown as { Segmenter?: SegmenterConstructor }).Segmenter;
  if (Segmenter) {
    let cut = 0;
    for (const { index } of new Segmenter(undefined, { granularity: 'grapheme' }).segment(text)) {
      if (index > max) break;
      cut = index;
    }
    if (cut > 0) return cut;
  }
  return isHighSurrogate(text.charCodeAt(max - 1)) ? max - 1 : max;
}

export function splitForCloudSpeech(text: string, max: number): string[] {
  if (!(max > 1) || text.length <= max) return [text];
  const chunks: string[] = [];
  let rest = text;
  while (rest.length > max) {
    const cut = sentenceCut(rest, max) || spaceCut(rest, max) || hardCut(rest, max);
    chunks.push(rest.slice(0, cut));
    rest = rest.slice(cut);
  }
  if (rest) chunks.push(rest);
  return chunks;
}
