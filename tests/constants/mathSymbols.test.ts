import { MATH_ITEMS } from '../../constants/mathSymbols';

describe('Math Symbols', () => {
  it('has at least 20 items', () => {
    expect(MATH_ITEMS.length).toBeGreaterThanOrEqual(20);
  });

  it('all items have unique IDs', () => {
    const ids = MATH_ITEMS.map(m => m.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('all items have non-empty symbol', () => {
    for (const item of MATH_ITEMS) {
      expect(item.symbol.length).toBeGreaterThan(0);
    }
  });

  it('all items have non-empty ttsText', () => {
    for (const item of MATH_ITEMS) {
      expect(item.ttsText.trim().length).toBeGreaterThan(0);
    }
  });

  it('all items have valid category', () => {
    for (const item of MATH_ITEMS) {
      expect(['basic', 'advanced']).toContain(item.category);
    }
  });

  it('includes basic arithmetic operators', () => {
    const symbols = MATH_ITEMS.map(m => m.symbol);
    expect(symbols).toContain('+');
    expect(symbols).toContain('−');
    expect(symbols).toContain('×');
    expect(symbols).toContain('÷');
    expect(symbols).toContain('=');
  });

  it('includes all digits 0-9', () => {
    const symbols = MATH_ITEMS.map(m => m.symbol);
    for (let i = 0; i <= 9; i++) {
      expect(symbols).toContain(String(i));
    }
  });

  it('advanced items include variable and equation', () => {
    const advanced = MATH_ITEMS.filter(m => m.category === 'advanced');
    const labels = advanced.map(m => m.label.toLowerCase());
    expect(labels).toContain('variable');
    expect(labels).toContain('equation');
  });

  it('sort orders are non-negative and unique', () => {
    const orders = MATH_ITEMS.map(m => m.sortOrder);
    expect(new Set(orders).size).toBe(orders.length);
    for (const o of orders) {
      expect(o).toBeGreaterThanOrEqual(0);
    }
  });
});
