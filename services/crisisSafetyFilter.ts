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

export type SafetyResult =
  | { safe: true }
  | { safe: false; kind: 'crisis' | 'medical'; response: string };

export function checkCrisisSafety(input: string): SafetyResult {
  const lower = input.toLowerCase();

  const crisisResponse = {
    safe: false as const,
    kind: 'crisis' as const,
    response: [
      'If this is an emergency, call 911 (US) or your local emergency number now.',
      '',
      'For mental health crisis support:',
      '• Call or text 988 (Suicide & Crisis Lifeline, US)',
      '• Text HOME to 741741 (Crisis Text Line)',
      '',
      "I'm here with you. You are not alone.",
    ].join('\n'),
  };

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
