# Language coverage audit — 2026-07-27

Audit of every language-keyed surface in prism-aac, run while adding Amharic
(`am`), Swahili (`sw`) and Bengali (`bn`). Numbers are measured from the repo,
not from prior documentation.

## Reconciling the phrase count

Three different figures were circulating ("5000+", "1261", "1500+"). They are
measurements of different things:

| Figure | What it actually is |
| --- | --- |
| **1512** | `DEFAULT_PHRASES` in `constants/phrases.ts` — the real phrase inventory, across 50 categories. This is the "1500+". |
| **1261** | Entries in `constants/phraseTranslations.ts` before this change. Not the phrase count — the count of phrases that had *any* translation. |
| **40** | Ids in `phraseTranslations.ts` with no matching phrase (`chip-*`, `gen-*`). These are **not** orphans — they come from `constants/orderingSequences.ts`. |

So the pre-existing gap was **291 phrases with zero translations in any
language** (1512 − (1261 − 40)).

## Surface-by-surface state

| Surface | File | Before | After |
| --- | --- | --- | --- |
| UI strings | `i18n/translations.json` → `i18n/<lang>.json` | 418 keys × 25 locales, 100% | 418 × 28, 100% |
| AAC phrases | `constants/phraseTranslations.ts` | 1261 ids, 77–100% per language | 1552 ids, gap closed |
| Offline dictionary | `constants/offlineDictionary.ts` | 500 words × 25 | 500 × 28 |
| Vision phrases | `constants/visionPhrases.ts` | 9 scenes × 22 langs × 8 | 9 × 25 × 8 |
| Grammar rules | `constants/languageRules.ts` | 25 | 28 |
| Keyboard layouts | `constants/keyboardLayouts.ts` | 25 | 28 (+ Ge'ez vowel-order model) |
| Prediction seeds | `constants/predictionSeeds/*.ts` | 14 full, 9 stubs, 1 partial | see below |
| TTS voices | `portal/src/shared/voice-catalog.ts` | 25 langs | 28 (am/sw/bn **unverified**) |

## Finding 1 — nine corpus sections are empty in every single locale

**This is the most serious thing in this audit and it predates this change.**

Prediction seeds are built from the offline phrase corpus (outside this repo;
path configurable via `PRISM_CORPUS_DIR`), one `<lang>.json` per locale.
The English source corpus declares 35 sections but **9 of them are empty
arrays**, and they are empty in all 14 locales that had a corpus:

```
needs_bathroom            0
questions_basic_wh        0
requests_permission       0
health_pain               0
family_extended_friends   0
safety_critical           0      <-- emergency utterances
safety_urgent             0      <-- emergency utterances
time_scheduling_waiting   0
clinical_breaks_sensory   0
```

Consequence: the on-device word-prediction model has **no training signal for
pain, bathroom needs, permission requests, or emergencies** — in any language.
For an AAC device these are among the highest-stakes utterances a user will
ever need to produce quickly, and they are exactly where prediction should be
strongest.

The English corpus itself needs authoring here; this is not a translation
problem and cannot be fixed by the translation pipeline. Nothing in this change
addresses it. **Recommend treating this as a standalone clinical-content task**
with BCBA/SLP review, not an engineering one.

## Finding 2 — why 9 languages had stub prediction seeds

`he, hi, id, it, nl, pl, tl, tr, vi` shipped ~2.3 KB hand-written skeleton seeds
against ~1 MB corpus-derived seeds for the mature languages, and `bg` had a
partial 189 KB. Root cause: `offline_phrases/` only ever contained 14 locales,
so `build_prediction_seeds.py` had nothing to build from for the rest. Sprint
1–3 languages got UI strings and phrase translations but never a corpus.

Addressed by translating the corpus for those 9 plus `bg` and the 3 new
languages, then regenerating seeds. Result:

| Locale | unigrams before | after |
| --- | --- | --- |
| he, hi, id, it, nl, pl, tl, tr, vi | 47–50 | 1500 |
| am, sw, bn | — | 1500 |

Note this inherits Finding 1 — the regenerated seeds are built from a source
corpus that is still missing its safety sections.

## Finding 2b — the seed generator in the repo is NOT the one that built the seeds

`prism-training/build_prediction_seeds.py` produces **1500** unigrams per
locale from the corpus alone. The committed seeds for the 14 mature locales
contain **19,940** (en), of which only ~5,000 are wordfreq top-5000 and ~15,000
come from a vocabulary-expansion step present in neither that script nor
`wordfreq`. Their headers cite `training/build_prediction_seeds.py` — a path
that **does not exist** on this machine — and the header counts (e.g. "5513
uni") disagree with the files' actual contents.

So the surviving script is a degraded fork of whatever generated the shipping
seeds, and running it over everything silently downgraded 14 healthy locales
from ~20k to 1.5k unigrams. Caught by three prediction tests
(`prediction-store.integration.test.ts`) asserting prefix completions and that
Russian "дуб" survives corpus expansion.

**Action taken:** the 14 mature locales plus `bg` (1902 → 1500, also a
regression) were restored from `HEAD` and are untouched by this change. Only
the 9 stubs and the 3 new locales carry newly built seeds. Nothing was
downgraded.

**Follow-up needed:** recover the real generator, or reimplement the expansion
step, before regenerating any mature seed. Until then
`prism-training/build_prediction_seeds.py` should be treated as safe only for
locales that have no corpus-derived seed yet. Two fixes were made to it here —
Ethiopic/danda punctuation stripping, and a guard so a locale with a seed but
no corpus is no longer silently dropped from `SUPPORTED_SEED_LANGS`.

## Finding 3 — Chinese variants share one translation bucket

`zh-Hans`, `zh-Hant` and `zh-HK` all resolve to the `zh` bucket in
`getPhraseText()`. This is deliberate and documented at the call site, but it
means Traditional and Cantonese users see Simplified-derived phrase text. Not
changed here; flagging so it isn't mistaken for a coverage gap in the table above.

## Finding 4 — the new Azure voice IDs are unverified

`am-ET-*`, `sw-TZ-*` and `bn-BD-*` entries were written from Azure's published
neural voice list but **not** confirmed against the live endpoint:
`AZURE_SPEECH_KEY` is an empty placeholder in every local `.env`, and the real
key exists only in Vercel.

This is the same failure mode that produced corrupt audio for the
Kalina/Alina/Polina Inworld entries — a plausible voice id that the provider
does not serve fails at synthesis time, in the user's hands. Verify before
shipping:

```bash
vercel env pull .env.verify --environment=production
curl -H "Ocp-Apim-Subscription-Key: $AZURE_SPEECH_KEY" \
  "https://$AZURE_SPEECH_REGION.tts.speech.microsoft.com/cognitiveservices/voices/list" \
  | jq -r '.[].ShortName' | grep -E '^(am-ET|sw-TZ|bn-BD)'
```

## Ge'ez input model

Amharic is an abugida: 33 consonants × 7 vowel orders = 231 fused glyphs. A flat
231-key grid is not usable on an AAC device, and a 33-key grid alone can only
produce 1st-order forms — which cannot spell most Amharic words.

Unicode lays the fidel out so each consonant series occupies 8 contiguous
codepoints with the vowel orders at offsets 0–6, so the transform is arithmetic
rather than a 231-entry table:

```
ሀ U+1200 (ə)  ሁ +1 (u)  ሂ +2 (i)  ሃ +3 (a)  ሄ +4 (e)  ህ +5 (ɨ)  ሆ +6 (o)
```

All 33 bases were verified 8-aligned. `applyGeezVowelOrder()` refuses to inflect
an already-inflected glyph — without that guard, repeated taps walk into the
next consonant's series (ሉ+1 → ሊ → … → ሐ).

Bengali needs no equivalent: its vowel signs are standalone combining
codepoints, so it follows the existing Devanagari (`hi`) layout pattern.

## Open risk — font coverage for Ge'ez and Bengali is unverified

`app/layout.tsx` loads Geist with `subsets: ["latin"]`, so the app font has no
Ethiopic or Bengali glyphs and both scripts render through the system fallback
chain (`system-ui, -apple-system, sans-serif`).

This is the same path Arabic, Hebrew, Devanagari and CJK already take and those
ship fine, so it is not a new regression. But Ethiopic has thinner system
coverage than the others — it depends on Kefa (macOS/iOS), Ebrima (Windows) or
Noto Sans Ethiopic (Android), and older Android builds may lack it. A missing
glyph renders as tofu (□), which on an AAC keyboard means unreadable keys.

**Not verified in a real browser on any target device.** Worth a device check
on iOS and low-end Android before release; if it fails, the fix is a subsetted
Noto Sans Ethiopic / Noto Sans Bengali webfont scoped to those locales.

## Translation provenance — read this before claiming language support

Every string produced by `scripts/translate-corpus.mjs` is machine-generated by
`gemini-3.6-flash` and recorded as **unreviewed** in
`i18n/provenance/machine-translations.json`.

```bash
npm run i18n:review-status            # summary
npm run i18n:review-status -- --lang=am --strict
```

Nothing in the pipeline can mark a string reviewed; that is a human action.
Concrete reasons this matters, both found by spot-checking ~20 strings:

- `speak` → Swahili **"Soma"** (*read*) instead of *"Sema"*. That is the primary
  action button on the device.
- `Too hot` → Swahili **"Inamoto sana"**, which should be *"Ni moto sana"*.

Two errors in a 20-string sample. Neither is detectable by any test in this
repo. **28 languages are wired; 25 are reviewed.**

## Pipeline bugs found and fixed during this change

Both were introduced by the new `scripts/translate-corpus.mjs` and both were
caught by tests, but only after they had already written bad output:

1. **First language dropped from every entry.** The language-extraction regex
   used `(?:^|[,{]\s*)`, but the captured entry body excludes the opening brace
   and begins with a space — so the leading language never matched. `ro` led
   almost every row and went **1046 → 0** while the file kept the same entry
   count and shape, `tsc` stayed clean, and 264 unrelated tests stayed green.
   Recovered by merging `HEAD` back as ground truth; all original counts
   restored exactly. Guarded by per-language coverage floors in
   `tests/phrase-translations.test.ts`.

2. **Deliberate empty-string translations deleted — three times, three
   different code paths.** `cw-to` is intentionally `''` for `ru`/`uk` because
   neither language uses an infinitive particle. A truthiness test treats that
   as "no translation":
   - the **emit filter** dropped the key entirely, resurrecting the English "to";
   - the **`--missing-only` filter** then reported it as missing and
     re-translated it, producing `ru: 'К'` — a preposition Russian does not want
     there;
   - the same pattern was present in the **UI matrix filter** and was fixed
     before it could fire.

   All three now test `typeof v === 'string'` rather than truthiness. Worth
   remembering as a class: in translation data, empty string is a *value*, and
   `!x` cannot tell "absent" from "deliberately blank".

3. **Escaping multiplied on every read→write round trip** (found only by an
   adversarial value-level diff against `HEAD` after everything was "done" and
   green). The file reader captured string-literal bodies without unescaping
   (`J\'ai`), and the emitter re-escaped them — so `J'ai faim` shipped as
   `J\'ai faim`, and strings that passed through two rewrites as
   `Je m\\\'appelle`. 107 pre-existing strings plus new Swahili values with
   orthographic apostrophes (`Nong'ona`, `Ng'ambo`) were corrupted. Coverage
   floors are blind to this: a mangled value still counts as translated. The
   reader now unescapes; the file was repaired by re-merging `HEAD` as ground
   truth (value-diff after repair: 0 missing, 0 changed); and
   `tests/phrase-translations.test.ts` now asserts no value contains a literal
   backslash and pins the exact strings that were corrupted.

A fourth issue, a provenance write race between concurrent jobs, silently
erased the `vision` surface record; fixed with merge-on-write, then superseded
by deriving provenance from git state (`npm run i18n:provenance`).

## Fixed — apostrophes in Swahili prediction tokenization

`build_prediction_seeds.py` stripped `'` as punctuation, but in Swahili ng' is
a letter (velar nasal — `ng'ombe`, `king'ora`). Fixed with a locale-conditional
shield (`APOSTROPHE_IS_LETTER = {"sw"}`): word-internal apostrophes survive,
edge/quoting apostrophes still strip, and elision languages (fr `l'`, it `l'`,
nl `'t`) are deliberately unchanged to stay consistent with the mature seeds we
cannot regenerate. The `sw` seed was rebuilt via the new `--langs` scoped mode,
which regenerates named locales only and leaves `index.ts` and every other seed
untouched — the safe default given Finding 2b.

The general lesson, consistent with prior incidents in this repo: a script that
rewrites a whole data file can lose a column without changing the file's shape,
and neither a typecheck nor a broad green suite will notice.
