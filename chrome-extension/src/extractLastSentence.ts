/**
 * extractLastSentence — copy-pasted from prism-aac/components/Keyboard.tsx
 * so the extension has zero dependency on the main Next.js app. Behavior
 * is identical: walk back from the just-typed terminator, skip repeated
 * terminators, slice from the prior terminator (or buffer start), trim.
 */
const SENTENCE_TERMINATORS = '.?!';

export function extractLastSentence(text: string): string {
  const trimmed = text.trimEnd();
  if (!trimmed) return '';
  let end = trimmed.length - 1;
  while (end >= 0 && SENTENCE_TERMINATORS.includes(trimmed[end])) end--;
  let start = 0;
  for (let i = end; i >= 0; i--) {
    if (SENTENCE_TERMINATORS.includes(trimmed[i])) {
      start = i + 1;
      break;
    }
  }
  return trimmed.slice(start).trim();
}
