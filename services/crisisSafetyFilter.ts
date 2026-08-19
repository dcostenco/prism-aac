/**
 * Layer 1 — Deterministic crisis safety filter for web AAC.
 * Runs synchronously, zero network, cannot hallucinate.
 * Mirrors SafetyFilter.swift on iOS exactly.
 *
 * Called in AIChatPanel BEFORE any model/API invocation.
 * Also post-checks AI responses before display.
 */

// Compile a phrase to a Unicode-aware word-boundary regex. Prevents false positives
// e.g. "sos" inside "osmosis", "please help" inside "pleasantly helpful".
function compilePhrase(phrase: string): RegExp {
  const escaped = phrase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/ /g, '\\s+');
  return new RegExp(`(?:^|[^\\p{L}])${escaped}(?:$|[^\\p{L}])`, 'iu');
}

const CRISIS_KEYWORDS = new Set([
  'kill myself', 'end my life', 'want to die', 'suicide', 'hurt myself',
  'self harm', "can't breathe", 'cant breathe', 'choking', 'help me',
  'call 911', 'call 999', 'call 112', 'emergency', 'heart attack',
  "i'm dying", 'im dying', 'overdosed', 'i took too many',
  'not breathing', 'sos', 'please help',
]);

// Multilingual crisis keywords — same deterministic Layer 1 protection for non-English users
const CRISIS_KEYWORDS_MULTILINGUAL = new Set([
  // Spanish
  'quiero morir', 'quiero hacerme daño', 'no puedo respirar', 'necesito ayuda', 'llama al 911',
  'alguien me lastimó', 'no estoy seguro', 'tengo miedo',
  // French
  'je veux mourir', 'je veux me faire du mal', 'au secours', 'appelez le 15', 'je ne peux pas respirer',
  // Portuguese
  'quero morrer', 'me machuquei', 'socorro', 'ligue 192', 'não consigo respirar',
  // Romanian
  'vreau să mor', 'ajutor', 'nu pot respira', 'sunați la 112', 'cineva m-a rănit',
  // Russian
  'хочу умереть', 'помогите', 'не могу дышать', 'позвони 112', 'мне плохо',
  // Ukrainian
  'хочу померти', 'допоможіть', 'не можу дихати', 'зателефонуйте 112',
  // Arabic
  'أريد أن أموت', 'ساعدني', 'لا أستطيع التنفس', 'اتصل بـ 911',
  // German
  'ich will sterben', 'ich kann nicht atmen', 'hilfe', 'ruf 112 an',
  // Japanese
  'しにたい', 'たすけて', 'いきができない', '119にかけて',
  // Korean
  '죽고 싶어', '도와주세요', '숨을 못 쉬어요', '119에 전화해',
  // Chinese
  '我想死', '救命', '我不能呼吸', '打911',
  // Bulgarian
  'искам да умра', 'искам да се убия', 'самоубийство', 'нараних се',
  'не мога да дишам', 'помогнете', 'обадете се на 112', 'спешна помощ',
  'умирам', 'предозирах', 'боли ме много', 'не съм в безопасност',
]);

const MEDICAL_DOSE_KEYWORDS = new Set([
  'how many mg', 'how many pills', 'how much medication',
  'medication dose', 'drug dose', 'overdose amount',
  'how much tylenol', 'how much ibuprofen', 'maximum dose', 'lethal dose',
  // Pediatric / chronic illness dosing phrases common in AAC contexts
  'how many units', 'how many drops', 'how many ml', 'how many milligrams',
  'insulin dose', 'how much insulin', 'seizure medication dose',
]);

// Pre-compiled at module load — checkCrisisSafety is called synchronously on every
// streaming chunk (inside onChunk → enqueueSentence). Constructing RegExp objects
// inside the hot path caused 650–1300 compilations per response on low-end iOS.
const CRISIS_RES: RegExp[] = [
  ...[...CRISIS_KEYWORDS],
  ...[...CRISIS_KEYWORDS_MULTILINGUAL],
].map(compilePhrase);

const MEDICAL_RES: RegExp[] = [...MEDICAL_DOSE_KEYWORDS].map(compilePhrase);

/** Shared crisis-resource text (input and output paths render the same card). */
const CRISIS_RESPONSE_TEXT = [
  'If this is an emergency, call 911 (US) or your local emergency number now.',
  '',
  'For mental health crisis support:',
  '• Call or text 988 (Suicide & Crisis Lifeline, US)',
  '• Text HOME to 741741 (Crisis Text Line)',
  '',
  "I'm here with you. You are not alone.",
].join('\n');

/**
 * Content the MODEL must never emit — jailbreak interception only.
 *
 * Not phrase-equality with the input list: these target instruction/
 * encouragement shapes ("how to kill yourself", "you should end your life"),
 * because the bare nouns appear constantly in legitimate replies — a model
 * saying "if you are thinking about suicide, call 988" is doing its job, and
 * suppressing that reply would remove real help from a user in crisis.
 */
const HARMFUL_OUTPUT_RES: RegExp[] = [
  /\b(how|ways?|steps?|instructions?|guide)\b[^.?!]{0,40}\b(to|for)\b[^.?!]{0,20}\b(kill\s+(yourself|himself|herself|themselves)|commit\s+suicide|end\s+(your|his|her|their)\s+life|hurt\s+(yourself|himself|herself|themselves)|harm\s+(yourself|himself|herself|themselves))\b/i,
  /\b(you\s+should|you\s+ought\s+to|why\s+don'?t\s+you|just)\b[^.?!]{0,20}\b(kill\s+yourself|end\s+your\s+life|hurt\s+yourself|harm\s+yourself|die)\b/i,
  /\b(kill\s+yourself|kys)\b/i,
  /\b(nobody|no\s+one)\b[^.?!]{0,25}\b(would\s+miss|cares?\s+about)\s+you\b/i,
  /\b(best|easiest|painless|quickest)\s+way\s+to\s+(die|kill\s+yourself|end\s+it)\b/i,
];

// CJK-specific fast-pass: Japanese/Korean/Chinese write without word separators so
// the [^\p{L}] boundary anchors in compilePhrase() never match within natural sentences
// (e.g. "わたしはしにたいです" → "I want to die" in polite Japanese — で is \p{L}).
// Simple substring includes() is used instead.
const CJK_CRISIS_SUBSTRINGS: string[] = [
  'しにたい', 'たすけて', 'いきができない', '119にかけて',         // Japanese
  '죽고 싶어', '죽고싶어',                                     // Korean — with/without space
  '도와주세요',
  '숨을 못 쉬어요', '숨을못쉬어요',                             // Korean — with/without spaces
  '119에 전화해', '119에전화해',                               // Korean — with/without space
  '我想死', '救命', '我不能呼吸', '打911',                      // Chinese
  // Arabic: proclitic conjunctions (و ف) attach directly without a space, so the
  // [^\p{L}] word-boundary anchor fails for single-token words. Cover proclitic
  // forms (وساعدني, فساعدني) via bare includes() instead.
  'ساعدني',                                                    // Arabic 'help me'
];

export type SafetyResult =
  | { safe: true }
  | { safe: false; kind: 'crisis' | 'medical'; response: string };

/**
 * Safety check for MODEL OUTPUT. Deliberately narrower than
 * checkCrisisSafety(), which is for USER INPUT.
 *
 * The two directions mean opposite things. "help me" TYPED BY THE USER is a
 * distress signal and must surface crisis resources. The same words EMITTED
 * BY THE MODEL are usually the opposite of an emergency: the AAC system
 * prompt instructs the model to suggest ready-to-speak phrases, so a normal
 * reply ends with `**Say:** … "Can you help me talk?"`. Running the input
 * keywords over output turned that into a 911 screen.
 *
 * Reproduced live 2026-08-19 against the deployed endpoint: "what ai model
 * you are" → a benign answer whose suggestion list contained "Can you help
 * me talk?" → whole reply replaced by the crisis template. Same for any
 * reply mentioning an emergency, and for the model correctly advising
 * "call 911" — good advice the old check treated as a crisis to suppress.
 *
 * What output filtering IS for (per the enqueueSentence comment it guards):
 * intercepting a JAILBROKEN model before harmful content is spoken. That is
 * dosing/lethality information and explicit self-harm instruction — not
 * distress vocabulary, and not safety advice.
 */
export function checkModelOutputSafety(output: string): SafetyResult {
  const lower = output.toLowerCase();

  for (const re of HARMFUL_OUTPUT_RES) {
    if (re.test(lower)) {
      return {
        safe: false,
        kind: 'crisis',
        response: CRISIS_RESPONSE_TEXT,
      };
    }
  }

  for (const re of MEDICAL_RES) {
    if (re.test(lower)) {
      return {
        safe: false,
        kind: 'medical',
        response: 'For medication questions, please ask your doctor or pharmacist.',
      };
    }
  }

  return { safe: true };
}

export function checkCrisisSafety(input: string): SafetyResult {
  const lower = input.toLowerCase();

  const crisisResponse = {
    safe: false as const,
    kind: 'crisis' as const,
    response: CRISIS_RESPONSE_TEXT,
  };

  // CJK fast-pass before regex loop (word-boundary anchors fail in logographic scripts)
  for (const kw of CJK_CRISIS_SUBSTRINGS) {
    if (lower.includes(kw)) return crisisResponse;
  }

  for (const re of CRISIS_RES) {
    if (re.test(lower)) return crisisResponse;
  }

  for (const re of MEDICAL_RES) {
    if (re.test(lower)) {
      return {
        safe: false,
        kind: 'medical',
        response: 'For medication questions, please ask your doctor or pharmacist.',
      };
    }
  }

  return { safe: true };
}
