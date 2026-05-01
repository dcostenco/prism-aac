import { describe, it, expect } from 'vitest';

function simulatePredictionTap(text: string, word: string): string {
  const midWord = text.length > 0 && !text.endsWith(' ');
  const words = text.trim().split(/\s+/).filter(Boolean);

  if (midWord && words.length > 0) {
    const prefix = words.slice(0, -1).join(' ');
    return prefix ? `${prefix} ${word} ` : `${word} `;
  }
  return text.trim() ? `${text.trim()} ${word}` : word;
}

describe('Prediction word replacement', () => {
  it('replaces partial word when mid-typing', () => {
    expect(simulatePredictionTap('мы по', 'Положи')).toBe('мы Положи ');
  });

  it('replaces single partial word', () => {
    expect(simulatePredictionTap('при', 'Привет')).toBe('Привет ');
  });

  it('appends when text ends with space', () => {
    expect(simulatePredictionTap('мы ', 'Положи')).toBe('мы Положи');
  });

  it('handles empty text', () => {
    expect(simulatePredictionTap('', 'Привет')).toBe('Привет');
  });

  it('replaces last word in long sentence', () => {
    expect(simulatePredictionTap('я хочу пи', 'пить')).toBe('я хочу пить ');
  });

  it('appends after completed sentence', () => {
    expect(simulatePredictionTap('я хочу ', 'пить')).toBe('я хочу пить');
  });

  it('handles single character partial', () => {
    expect(simulatePredictionTap('д', 'да')).toBe('да ');
  });
});
