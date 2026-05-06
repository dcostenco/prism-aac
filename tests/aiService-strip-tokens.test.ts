/**
 * stripModelControlTokens — pin the bug fix that removed `<|synalux_think|>`
 * leakage from translateAI / askAI / parseCaregiverNote responses.
 *
 * Bug surfaced: AAC translation pane (MessageBar.tsx) rendered
 *   "🌐 <|synalux_think|> The user said 'I want more apples'. This is
 *    a non-clinical, personal request..."
 * instead of the Romanian translation. The model leaked its hidden
 * thinking section through to the UI because the server didn't filter
 * Synalux's custom chat-template control tokens.
 */
import { stripModelControlTokens } from '../services/aiService';

describe('stripModelControlTokens', () => {
  it('returns empty for empty input (no crash on first-token streams)', () => {
    expect(stripModelControlTokens('')).toBe('');
  });

  it('returns the input untouched when there are no control tokens', () => {
    expect(stripModelControlTokens('Vreau mai multe mere')).toBe('Vreau mai multe mere');
  });

  it('strips a paired <|synalux_think|>...<|synalux_end|> block and keeps the answer', () => {
    const raw = 'Prefix <|synalux_think|>chain of thought here<|synalux_end|> Answer text';
    expect(stripModelControlTokens(raw)).toBe('Prefix  Answer text'.trim().replace(/\s+/g, ' '));
  });

  it('strips a paired block that uses <|synalux_answer|> as the close marker', () => {
    const raw = '<|synalux_think|>thinking…<|synalux_answer|>Vreau mai multe mere';
    expect(stripModelControlTokens(raw)).toBe('Vreau mai multe mere');
  });

  it('strips a paired block that uses </synalux_think> closing form', () => {
    const raw = '<|synalux_think|>internal<|/synalux_think|>Final';
    expect(stripModelControlTokens(raw)).toBe('Final');
  });

  it('strips an UNTERMINATED think block (stream cut off mid-thought)', () => {
    // This is the EXACT screenshot bug — model started thinking and the
    // stream ended before it ever emitted the close tag. Without this
    // branch, the entire reasoning leaked into the translation pane.
    const screenshotBug =
      '<|synalux_think|> The user said "I want more apples". This is a non-clinical, personal request that falls outside my scope of capabilities as a clinical workflow assistant. My tools are for managing patients, schedules, notes,';
    expect(stripModelControlTokens(screenshotBug)).toBe('');
  });

  it('strips unterminated think block but keeps any preceding answer text', () => {
    const raw = 'Vreau mere <|synalux_think|>second-guessing the translation here, ran out of tokens';
    expect(stripModelControlTokens(raw)).toBe('Vreau mere');
  });

  it('strips other stray control tokens (im_end, eot, endoftext from base-model leaks)', () => {
    expect(stripModelControlTokens('Hello<|im_end|>')).toBe('Hello');
    expect(stripModelControlTokens('Hi <|eot|>')).toBe('Hi');
    expect(stripModelControlTokens('Bye<|endoftext|>')).toBe('Bye');
  });

  it('handles multiple paired blocks in one response', () => {
    const raw =
      'A <|synalux_think|>t1<|synalux_end|> B <|synalux_think|>t2<|synalux_end|> C';
    // Whitespace between segments is preserved by the regex (single space
    // each), then trim() removes leading/trailing.
    expect(stripModelControlTokens(raw)).toMatch(/^A\s+B\s+C$/);
  });

  it('does NOT strip naturally-occurring "<|>" or angle-quoted text', () => {
    // Must not be over-aggressive — the trigger requires <| ... |> with
    // a token-name body.
    expect(stripModelControlTokens('use the <not a token> form')).toBe('use the <not a token> form');
    expect(stripModelControlTokens('a < b | c > d')).toBe('a < b | c > d');
  });

  it('trims trailing whitespace produced by token removal', () => {
    expect(stripModelControlTokens('Final <|im_end|>')).toBe('Final');
    expect(stripModelControlTokens('  <|synalux_think|>x<|synalux_end|>  Hi  ')).toBe('Hi');
  });

  it('case-insensitively matches stray tokens (model casing drift)', () => {
    expect(stripModelControlTokens('Yes<|IM_END|>')).toBe('Yes');
    expect(stripModelControlTokens('OK<|EndOfText|>')).toBe('OK');
  });
});
