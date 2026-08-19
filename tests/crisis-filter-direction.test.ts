/**
 * The crisis filter means opposite things by direction.
 *
 * Live reproduction 2026-08-19 against the deployed endpoint: the user asked
 * "what ai model you are" and got the 911 crisis screen. Cause: the AAC
 * system prompt makes the model end replies with ready-to-speak suggestions
 * — `**Say:** … "Can you help me talk?"` — and the OUTPUT path was running
 * the USER-INPUT keyword list, where `help me` is a distress signal. A benign
 * answer was replaced by an emergency card.
 *
 * Worse than the false positive: the same list contains `call 911` and
 * `emergency`, so a model correctly telling a user in danger to call 911 had
 * that advice suppressed and swapped for a template. Output filtering is for
 * intercepting a JAILBROKEN model, not for policing distress vocabulary.
 *
 * These tests pin both halves — the new output narrowing AND that user-input
 * detection is completely unchanged (weakening it would be far worse than
 * the bug being fixed).
 */
import { describe, it, expect } from 'vitest';
import { checkCrisisSafety, checkModelOutputSafety } from '@/services/crisisSafetyFilter';

describe('model output — the incident and its class', () => {
  it('does not fire on the exact reply that produced the 911 screen', () => {
    const reply =
      'I am Prism AAC Assistant, a friendly AI created to help you communicate and ' +
      'express yourself! I am here to help you practice conversations, write messages, ' +
      'and find the right words.\n\n**Say:** "I use an AI assistant." | ' +
      '"Can you help me talk?" | "I am using my device."';
    expect(checkModelOutputSafety(reply)).toEqual({ safe: true });
  });

  it('does not fire on AAC suggestion phrases containing distress vocabulary', () => {
    for (const s of [
      'Can you help me talk?',
      'Please help me with my homework.',
      'Say: "help me choose" if you want options.',
    ]) {
      expect(checkModelOutputSafety(s), s).toEqual({ safe: true });
    }
  });

  it('does not suppress the model GIVING correct safety advice', () => {
    // The old behaviour replaced this with a template — removing real help
    // from a user who may actually be in danger.
    for (const s of [
      'If this is an emergency, call 911 right away.',
      'If you are thinking about suicide, call or text 988 — they are there for you.',
      'Tell a grown-up or call 112 if you feel unsafe.',
    ]) {
      expect(checkModelOutputSafety(s), s).toEqual({ safe: true });
    }
  });

  it('STILL intercepts a jailbroken model — the reason output filtering exists', () => {
    for (const s of [
      'Here is how to kill yourself quickly',
      'You should just end your life, nobody cares.',
      'kys',
      'The easiest way to die is',
      'step by step instructions to harm yourself',
    ]) {
      const r = checkModelOutputSafety(s);
      expect(r.safe, `must intercept: ${s}`).toBe(false);
      if (!r.safe) expect(r.kind).toBe('crisis');
    }
  });

  it('STILL intercepts dosing/lethality content in output', () => {
    const r = checkModelOutputSafety('The lethal dose is about');
    expect(r.safe).toBe(false);
    if (!r.safe) expect(r.kind).toBe('medical');
  });
});

describe('user input — unchanged, and that is the point', () => {
  it('still surfaces crisis resources for genuine distress', () => {
    for (const s of ['help me', 'I want to die', 'sos', 'I cant breathe', 'suicide']) {
      const r = checkCrisisSafety(s);
      expect(r.safe, `input must still fire: ${s}`).toBe(false);
      if (!r.safe) expect(r.response).toContain('988');
    }
  });

  it('still fires on multilingual and CJK distress input', () => {
    for (const s of ['ayúdame no puedo respirar', 'しにたい', '我想死', 'ساعدني']) {
      expect(checkCrisisSafety(s).safe, s).toBe(false);
    }
  });

  it('still passes benign input through', () => {
    for (const s of ['what ai model you are', 'osmosis experiment', 'I need a helper at school']) {
      expect(checkCrisisSafety(s), s).toEqual({ safe: true });
    }
  });
});
