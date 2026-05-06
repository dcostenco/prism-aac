/**
 * Autocorrect safety gate — decides whether an AI suggestion is "safe"
 * to auto-apply on Speak press, vs requiring an explicit tap.
 *
 * Three lanes determine acceptance:
 *   1. Whole-input short partial (≤4 chars, 1 token, +subsequence guard)
 *   2. Mid-word completion (short trailing partial, prefix tokens match,
 *      ≤+2 trailing tokens added)
 *   3. Standard cleanup (same/±1 token, bounded Levenshtein)
 *
 * Extracted from MessageBar.tsx so the lane logic can be unit-tested
 * without dragging in React + the entire chat surface.
 */

export function levenshtein(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  if (!m) return n;
  if (!n) return m;
  let prev = new Array<number>(n + 1);
  let curr = new Array<number>(n + 1);
  for (let j = 0; j <= n; j++) prev[j] = j;
  for (let i = 1; i <= m; i++) {
    curr[0] = i;
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      curr[j] = Math.min(curr[j - 1] + 1, prev[j] + 1, prev[j - 1] + cost);
    }
    [prev, curr] = [curr, prev];
  }
  return prev[n];
}

/**
 * Returns true iff every non-whitespace character of `o` (lowercased)
 * appears in `f` IN ORDER. Used by Lane 1 to gate short-partial
 * auto-expansion: "iwa" → "I want a" preserves i,w,a; "ok" → "yes
 * please" doesn't preserve o,k and so should require an explicit tap.
 */
export function isSubsequence(o: string, f: string): boolean {
  const oChars = o.toLowerCase().replace(/\s+/g, '');
  const fChars = f.toLowerCase();
  let i = 0;
  for (const c of fChars) {
    if (oChars[i] === c) i++;
    if (i === oChars.length) return true;
  }
  return i === oChars.length;
}

export function isSafeAutoCorrection(original: string, fixed: string): boolean {
  const o = original.trim();
  const f = fixed.trim();
  if (!o || !f || o === f) return false;
  const oToks = o.split(/\s+/);
  const fToks = f.split(/\s+/);

  // Lane 1 — whole-input short-partial: 2-4 char input, 1 token, allow
  // up to 3-token expansion BUT only if input letters survive as a
  // subsequence in the expansion. Prevents "ok" → "yes please" but
  // accepts "iwa" → "I want a" (i,w,a in order).
  if (o.length <= 4 && oToks.length === 1 && fToks.length <= 3 && isSubsequence(o, f)) {
    return true;
  }

  // Lane 2 — mid-word completion with short trailing partial.
  // Shape: prefix tokens match (case-insensitive); the fixed token at
  // the partial's index starts with the partial; at most +2 trailing
  // tokens added. Catches "i Want y" → "i Want you to" and similar
  // natural completions in any language.
  if (
    fToks.length >= oToks.length
    && fToks.length <= oToks.length + 2
    && oToks[oToks.length - 1].length <= 3
  ) {
    const lastIdx = oToks.length - 1;
    let prefixMatches = true;
    for (let i = 0; i < lastIdx; i++) {
      if (oToks[i].toLowerCase() !== fToks[i].toLowerCase()) {
        prefixMatches = false;
        break;
      }
    }
    const partial = oToks[lastIdx].toLowerCase();
    const partialMatch = fToks[lastIdx]?.toLowerCase().startsWith(partial);
    if (prefixMatches && partialMatch) {
      return true;
    }
  }

  // Lane 3 — standard: same-or-±1-token cleanup with bounded
  // Levenshtein. Used for typo fixes ("программычто" → "программа
  // что") and similar small repairs that are clearly the user's
  // intent, not a paraphrase.
  if (Math.abs(oToks.length - fToks.length) > 1) return false;
  const dist = levenshtein(o.toLowerCase(), f.toLowerCase());
  return dist <= Math.max(2, Math.floor(o.length * 0.30));
}
