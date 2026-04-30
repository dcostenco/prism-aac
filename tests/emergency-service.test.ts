import { describe, it, expect } from 'vitest';
import { detectEmergency, buildEmergencyScript, DEFAULT_CONFIG } from '@/services/emergencyService';

describe('EmergencyService — Phrase Detection', () => {
  it('detects CRITICAL phrases (abuse/assault — uncancellable)', () => {
    const cases = [
      'Someone hurt me', "I can't breathe", 'I am not safe',
      "I don't know you", "Don't touch me", 'I said no',
      'Call 911', 'I am lost',
    ];
    for (const phrase of cases) {
      const result = detectEmergency(phrase);
      expect(result.detected, `"${phrase}" should be detected`).toBe(true);
      expect(result.severity, `"${phrase}" should be critical`).toBe('critical');
    }
  });

  it('detects URGENT phrases (cancellable with gesture)', () => {
    const cases = ['Help me', 'I need help', 'I am scared', 'Call my mom', 'Call my dad', 'I want to go home'];
    for (const phrase of cases) {
      const result = detectEmergency(phrase);
      expect(result.detected, `"${phrase}" should be detected`).toBe(true);
      expect(result.severity, `"${phrase}" should be urgent`).toBe('urgent');
    }
  });

  it('detects MEDICAL phrases (cancellable with gesture)', () => {
    const cases = ['I fell', 'It hurts', 'I feel sick', 'I feel dizzy', 'I need my medicine'];
    for (const phrase of cases) {
      const result = detectEmergency(phrase);
      expect(result.detected, `"${phrase}" should be detected`).toBe(true);
      expect(result.severity, `"${phrase}" should be medical`).toBe('medical');
    }
  });

  it('does NOT trigger on non-emergency phrases', () => {
    const safe = ['I am hungry', 'I want pizza', 'Good morning', 'Thank you',
      'I want to play', 'How are you', 'My turn', 'All done'];
    for (const phrase of safe) {
      expect(detectEmergency(phrase).detected, `"${phrase}" should NOT trigger`).toBe(false);
    }
  });

  it('is case-insensitive', () => {
    expect(detectEmergency('SOMEONE HURT ME').severity).toBe('critical');
    expect(detectEmergency('i am not safe').severity).toBe('critical');
    expect(detectEmergency('I FELL').severity).toBe('medical');
  });

  it('detects phrases within longer text', () => {
    expect(detectEmergency('Please call 911 now').detected).toBe(true);
    expect(detectEmergency('I fell and it hurts').detected).toBe(true);
  });

  it('abuse/assault phrases are ALWAYS critical (uncancellable)', () => {
    const abuseRelated = [
      'Someone hurt me', "Don't touch me", 'I said no',
      "I don't know you", 'I am not safe',
    ];
    for (const phrase of abuseRelated) {
      expect(detectEmergency(phrase).severity, `"${phrase}" must be critical/uncancellable`).toBe('critical');
    }
  });
});

describe('EmergencyService — Emergency Script', () => {
  it('builds script with full medical profile', () => {
    const config = {
      ...DEFAULT_CONFIG,
      profile: {
        name: 'Alex',
        age: 8,
        conditions: ['autism', 'epilepsy'],
        allergies: ['penicillin'],
        medications: ['Keppra 250mg'],
        address: '123 Oak Street, Room 4',
        callbackNumber: '555-0123',
      },
    };
    const script = buildEmergencyScript("I can't breathe", config);
    expect(script).toContain('Alex');
    expect(script).toContain('8-year-old');
    expect(script).toContain("I can't breathe");
    expect(script).toContain('123 Oak Street');
    expect(script).toContain('epilepsy');
    expect(script).toContain('penicillin');
    expect(script).toContain('Keppra');
    expect(script).toContain('555-0123');
    expect(script).toContain('nonverbal');
  });

  it('builds script with minimal profile (no subscription needed)', () => {
    const config = { ...DEFAULT_CONFIG, profile: { name: 'Sam' } };
    const script = buildEmergencyScript('I fell', config);
    expect(script).toContain('Sam');
    expect(script).toContain('I fell');
    expect(script).toContain('PrismAAC');
    expect(script).toContain('nonverbal');
  });

  it('includes GPS coordinates when no address', () => {
    const config = { ...DEFAULT_CONFIG, profile: { name: 'Jo' } };
    const script = buildEmergencyScript('Help me', config, { lat: 40.7128, lng: -74.006 });
    expect(script).toContain('40.71280');
    expect(script).toContain('-74.00600');
  });

  it('works with completely empty profile', () => {
    const script = buildEmergencyScript('I am not safe', DEFAULT_CONFIG);
    expect(script).toContain('PrismAAC');
    expect(script).toContain('I am not safe');
    expect(script).toContain('needs help');
  });
});
