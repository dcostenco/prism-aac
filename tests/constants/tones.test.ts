import { TONES, STANDARD_TIER_TONES, ADVANCED_TIER_TONES } from '../../constants/tones';

describe('Tones', () => {
  it('has exactly 9 tone definitions', () => {
    expect(TONES).toHaveLength(9);
  });

  it('all tones have unique IDs', () => {
    const ids = TONES.map(t => t.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('all tones have non-empty labels', () => {
    for (const tone of TONES) {
      expect(tone.label.trim().length).toBeGreaterThan(0);
    }
  });

  it('all tones have emoji icons', () => {
    for (const tone of TONES) {
      expect(tone.icon.length).toBeGreaterThan(0);
    }
  });

  it('all tones have azureStyle', () => {
    for (const tone of TONES) {
      expect(tone.azureStyle.length).toBeGreaterThan(0);
    }
  });

  it('friendly is the first tone (default)', () => {
    expect(TONES[0].id).toBe('friendly');
  });

  it('standard tier has exactly 5 tones', () => {
    expect(STANDARD_TIER_TONES).toHaveLength(5);
  });

  it('advanced tier includes all tones', () => {
    expect(ADVANCED_TIER_TONES).toHaveLength(9);
  });

  it('standard tier tones are a subset of advanced', () => {
    for (const tone of STANDARD_TIER_TONES) {
      expect(ADVANCED_TIER_TONES).toContain(tone);
    }
  });
});
