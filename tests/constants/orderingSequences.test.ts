import { DEFAULT_ORDERING_SEQUENCES } from '../../constants/orderingSequences';

describe('Ordering Sequences', () => {
  it('has at least 2 default sequences', () => {
    expect(DEFAULT_ORDERING_SEQUENCES.length).toBeGreaterThanOrEqual(2);
  });

  it('all sequences have unique IDs', () => {
    const ids = DEFAULT_ORDERING_SEQUENCES.map(s => s.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('all sequences have at least 2 steps', () => {
    for (const seq of DEFAULT_ORDERING_SEQUENCES) {
      expect(seq.steps.length).toBeGreaterThanOrEqual(2);
    }
  });

  it('all steps have at least 2 options', () => {
    for (const seq of DEFAULT_ORDERING_SEQUENCES) {
      for (const step of seq.steps) {
        expect(step.options.length).toBeGreaterThanOrEqual(2);
      }
    }
  });

  it('step orders are sequential within each sequence', () => {
    for (const seq of DEFAULT_ORDERING_SEQUENCES) {
      for (let i = 0; i < seq.steps.length; i++) {
        expect(seq.steps[i].stepOrder).toBe(i);
      }
    }
  });

  it('all step IDs are unique across all sequences', () => {
    const ids: string[] = [];
    for (const seq of DEFAULT_ORDERING_SEQUENCES) {
      for (const step of seq.steps) {
        ids.push(step.id);
      }
    }
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('all option IDs are unique across all sequences', () => {
    const ids: string[] = [];
    for (const seq of DEFAULT_ORDERING_SEQUENCES) {
      for (const step of seq.steps) {
        for (const opt of step.options) {
          ids.push(opt.id);
        }
      }
    }
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('Chipotle sequence follows correct ordering flow', () => {
    const chipotle = DEFAULT_ORDERING_SEQUENCES.find(s => s.id === 'seq-chipotle');
    expect(chipotle).toBeDefined();
    const labels = chipotle!.steps.map(s => s.label);
    expect(labels[0]).toContain('order');
    expect(labels[labels.length - 1]).toContain('Finish');
  });

  it('all options have non-empty text', () => {
    for (const seq of DEFAULT_ORDERING_SEQUENCES) {
      for (const step of seq.steps) {
        for (const opt of step.options) {
          expect(opt.text.trim().length).toBeGreaterThan(0);
        }
      }
    }
  });
});
