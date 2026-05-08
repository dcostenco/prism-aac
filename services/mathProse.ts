/**
 * Math text → spoken prose.
 *
 * TTS engines (Azure / Inworld / Web Speech) read raw math notation
 * literally — `x+15<12` comes out as "x plus fifteen less than twelve"
 * with no breath / phrasing, OR worse, the engine reads `<` as the
 * grapheme name, `+` as a pause, and `15` as "fifteen" with no
 * separator. The result is robotic and hard to follow.
 *
 * `mathTextToProse` rewrites the most common math + arithmetic
 * notation into plain spoken English BEFORE the text reaches TTS,
 * so a worksheet like:
 *
 *   0. x+15<12
 *   g.r. 9
 *   x<12-15
 *
 * speaks as:
 *
 *   "Problem zero. x plus 15, is less than 12. Grade 9. x is
 *    less than 12 minus 15."
 *
 * Used by the OCR-result Speak path in PdfReaderPanel. Other surfaces
 * (general AAC text, AI Chat replies) deliberately don't use this —
 * they're prose already.
 */

/** Replace each occurrence of a token (with whitespace around it) with
 *  a spoken phrase. Uses a regex that captures any surrounding
 *  whitespace so we don't double-space. */
function rewrite(text: string, pattern: RegExp, replacement: string): string {
  return text.replace(pattern, replacement);
}

/** Number-only check — used so we don't insert " minus " between a
 *  unary `-3` (negative number) and turn it into "minus 3" without
 *  a left operand. The `-` directly preceded by a digit / closing
 *  paren / variable letter (in the ORIGINAL input) IS binary
 *  subtraction; the same `-` at start-of-line / after an operator
 *  is unary negation.
 *
 *  Critical: we walk past WHITESPACE, but treat any operator char
 *  (`+`, `*`, `/`, `=`, `-`, `<`, `>`) as a left-of-`-` boundary
 *  that means "this minus is unary". Otherwise `5+-3` looks at the
 *  previous non-space char `+`, which our earlier walk treated as
 *  not-binary correctly, but we have to be explicit since the
 *  walk only checks for digits/letters and returns false for
 *  operators (so a leading operator implies unary).
 */
function isBinarySubtraction(text: string, atIndex: number): boolean {
  for (let i = atIndex - 1; i >= 0; i--) {
    const c = text[i];
    if (c === ' ' || c === '\t' || c === '\n') continue;
    // Operator on the left → this minus is unary
    if ('+-*/=<>≤≥≠≈^('.includes(c)) return false;
    // Number/variable/closer on the left → binary
    if (/[0-9a-zA-Z\)\]]/.test(c)) return true;
    return false;
  }
  return false;
}

export function mathTextToProse(input: string): string {
  if (!input?.trim()) return input;

  let s = input;

  // ── Domain-specific abbreviations (run BEFORE general operator
  //    rewrites so e.g. "g.r." doesn't turn into "g period r period")
  s = s.replace(/\bg\.\s*r\.?\b/gi, 'Grade');
  s = s.replace(/\bGr\.\b/g, 'Grade');
  s = s.replace(/\bp\.\s*\d+\b/g, (m) => `page ${m.replace(/\D+/g, '')}`);
  s = s.replace(/\bpp\.\s*\d+/g, (m) => `pages ${m.replace(/\D+/g, '')}`);
  s = s.replace(/\bft²/g, 'square feet');
  s = s.replace(/\bm²/g, 'square meters');
  s = s.replace(/\bcm²/g, 'square centimeters');
  s = s.replace(/\bft³/g, 'cubic feet');
  s = s.replace(/\bm³/g, 'cubic meters');

  // ── Comparison operators. Order matters — do compound (≤/≥/≠) before
  //    single (</>/=) so we don't half-replace.
  s = rewrite(s, /≤|<=/g, ' is less than or equal to ');
  s = rewrite(s, /≥|>=/g, ' is greater than or equal to ');
  s = rewrite(s, /≠|!=/g, ' not equal to ');
  s = rewrite(s, /≈/g, ' approximately ');
  s = rewrite(s, /</g, ' is less than ');
  s = rewrite(s, />/g, ' is greater than ');

  // ── Subtraction first (BEFORE other operator rewrites add spaces
  //    that would confuse the binary/unary detection). Walk
  //    right-to-left so indices remain valid as we splice.
  const minusIndices: number[] = [];
  for (let i = 0; i < s.length; i++) if (s[i] === '-') minusIndices.push(i);
  for (let i = minusIndices.length - 1; i >= 0; i--) {
    const idx = minusIndices[i];
    if (isBinarySubtraction(s, idx)) {
      s = s.slice(0, idx) + ' minus ' + s.slice(idx + 1);
    } else {
      // Unary: rewrite to "negative " so TTS speaks the magnitude.
      s = s.slice(0, idx) + 'negative ' + s.slice(idx + 1);
    }
  }

  // ── Other arithmetic operators
  s = rewrite(s, /\+/g, ' plus ');
  s = rewrite(s, /×/g, ' times ');
  s = rewrite(s, /÷/g, ' divided by ');
  s = rewrite(s, /\s\*\s|(\d)\*(\d)/g, ' times ');
  s = rewrite(s, /(\d)\s*\/\s*(\d)/g, '$1 divided by $2');
  s = s.replace(/=/g, ' equals ');

  // ── Exponents (super/subscripts). After other rewrites so we don't
  //    eat them.
  s = s.replace(/²/g, ' squared ');
  s = s.replace(/³/g, ' cubed ');

  // ── Problem numbering — "0." or "1." at start of line becomes
  //    "Problem N." so the listener has a phrasing cue between
  //    problems. Otherwise TTS runs them together.
  s = s.replace(/(^|\n)\s*(\d+)\s*\.\s+/g, (_m, prefix: string, n: string) => {
    return `${prefix}Problem ${n}. `;
  });

  // ── Whitespace collapse (operator rewrites add spaces).
  s = s.replace(/[ \t]{2,}/g, ' ');
  s = s.replace(/\n{3,}/g, '\n\n');
  // Add a comma + space after each line break to give TTS a small
  // pause between independent transformations like "x+15<12 / x<12-15".
  s = s.split(/\n+/).map((l) => l.trim()).filter(Boolean).join('. ');

  return s.trim();
}

/**
 * Chunk a long prose string into TTS-safe pieces.
 *
 * The Inworld TTS backend (synalux portal's primary tier) returns
 * "Inworld TTS unavailable and Azure fallback also failed" on long
 * inputs — empirically anything over ~300 chars trips it, falls back
 * to client-side Web Speech (robotic). Short inputs (~40 chars) work
 * cleanly. Splitting OCR results into sentence-bounded chunks keeps
 * every request small enough to land on the neural tier.
 *
 * Splits on `. ` boundaries first (preserves sentence phrasing); if
 * a single sentence is itself longer than maxChars, falls back to
 * splitting on commas, then on word boundaries — never hard-cutting
 * mid-word.
 */
export function chunkForTts(text: string, maxChars = 250): string[] {
  if (!text?.trim()) return [];
  if (text.length <= maxChars) return [text];

  const out: string[] = [];
  // Sentence-level split.
  const sentences = text.split(/(?<=[.!?])\s+/);
  let current = '';
  const flush = () => { if (current.trim()) out.push(current.trim()); current = ''; };

  for (const sent of sentences) {
    if (sent.length > maxChars) {
      // A single sentence too long — split on commas.
      flush();
      const parts = sent.split(/(?<=,)\s+/);
      for (const part of parts) {
        if (part.length > maxChars) {
          // Comma-split still too long — fall back to word boundary.
          flush();
          const words = part.split(/\s+/);
          for (const w of words) {
            if ((current + ' ' + w).length > maxChars) flush();
            current = current ? `${current} ${w}` : w;
          }
        } else {
          if ((current + ' ' + part).length > maxChars) flush();
          current = current ? `${current} ${part}` : part;
        }
      }
      flush();
    } else {
      if ((current + ' ' + sent).length > maxChars) flush();
      current = current ? `${current} ${sent}` : sent;
    }
  }
  flush();
  return out;
}
