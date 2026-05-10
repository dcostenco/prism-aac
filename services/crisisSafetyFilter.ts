/**
 * Layer 1 — Deterministic crisis safety filter for web AAC.
 * Runs synchronously, zero network, cannot hallucinate.
 * Mirrors SafetyFilter.swift on iOS exactly.
 *
 * Called in AIChatPanel BEFORE any model/API invocation.
 * Also post-checks AI responses before display.
 */

const CRISIS_KEYWORDS = new Set([
  'kill myself', 'end my life', 'want to die', 'suicide', 'hurt myself',
  'self harm', "can't breathe", 'cant breathe', 'choking', 'help me',
  'call 911', 'call 999', 'call 112', 'emergency', 'heart attack',
  "i'm dying", 'im dying', 'overdosed', 'i took too many',
  'not breathing', 'sos', 'please help',
]);

const MEDICAL_DOSE_KEYWORDS = new Set([
  'how many mg', 'how many pills', 'how much medication',
  'medication dose', 'drug dose', 'overdose amount',
  'how much tylenol', 'how much ibuprofen', 'maximum dose', 'lethal dose',
]);

export type SafetyResult =
  | { safe: true }
  | { safe: false; kind: 'crisis' | 'medical'; response: string };

export function checkCrisisSafety(input: string): SafetyResult {
  const lower = input.toLowerCase();

  for (const kw of CRISIS_KEYWORDS) {
    if (lower.includes(kw)) {
      return {
        safe: false,
        kind: 'crisis',
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
    }
  }

  for (const kw of MEDICAL_DOSE_KEYWORDS) {
    if (lower.includes(kw)) {
      return {
        safe: false,
        kind: 'medical',
        response: 'For medication questions, please ask your doctor or pharmacist.',
      };
    }
  }

  return { safe: true };
}
