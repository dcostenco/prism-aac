/**
 * mathGridStore — Zustand wrapper + domainForCategory
 *
 * The pure engine is exercised in math-grid.test.ts; these tests cover
 * the Zustand wiring and the exported helpers that the engine tests
 * don't touch:
 *
 *   domainForCategory — maps the 19 MathCategoryId values to their
 *   AI-tutor domain string. Wrong mapping sends the wrong prompt
 *   template to the tutor (chemistry question → math explanation).
 *
 *   useMathGridStore — store wiring. Exercises the thin wrappers around
 *   the pure-engine functions so regressions in the delegation layer
 *   (e.g. wrong argument order, missing set()) are caught before they
 *   silence an AAC student's math input.
 *
 *   reset / loadFromSerialized / toSerialized — doc-level ops. A broken
 *   reset leaves stale cells from a previous problem; broken serialize
 *   loses the student's work when the caregiver exports it.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import {
  domainForCategory,
  useMathGridStore,
  type MathCategoryId,
} from '@/store/mathGridStore';

beforeEach(() => {
  useMathGridStore.getState().reset();
});

// ── domainForCategory ─────────────────────────────────────────────────────────

describe('domainForCategory', () => {
  it('maps chemistry → "chemistry"', () => {
    expect(domainForCategory('chemistry')).toBe('chemistry');
  });

  it('maps physics → "physics"', () => {
    expect(domainForCategory('physics')).toBe('physics');
  });

  it('maps programming-python → "programming-python"', () => {
    expect(domainForCategory('programming-python')).toBe('programming-python');
  });

  it('maps programming-java → "programming-java"', () => {
    expect(domainForCategory('programming-java')).toBe('programming-java');
  });

  it('maps biology → "biology"', () => {
    expect(domainForCategory('biology')).toBe('biology');
  });

  it('maps statistics → "statistics"', () => {
    expect(domainForCategory('statistics')).toBe('statistics');
  });

  it('maps music → "music"', () => {
    expect(domainForCategory('music')).toBe('music');
  });

  it('maps earth-science → "earth-science"', () => {
    expect(domainForCategory('earth-science')).toBe('earth-science');
  });

  it('maps history → "history"', () => {
    expect(domainForCategory('history')).toBe('history');
  });

  it('maps language-arts → "language-arts"', () => {
    expect(domainForCategory('language-arts')).toBe('language-arts');
  });

  it('maps all math-domain categories to "math" (default branch)', () => {
    const mathCategories: MathCategoryId[] = [
      'main', 'letters', 'adv-math', 'misc-math',
      'time-distance', 'weight', 'volume', 'geom', 'money',
    ];
    for (const cat of mathCategories) {
      expect(domainForCategory(cat)).toBe('math');
    }
  });
});

// ── useMathGridStore — setActiveMathCategory ──────────────────────────────────

describe('useMathGridStore — setActiveMathCategory', () => {
  it('defaults to "main"', () => {
    expect(useMathGridStore.getState().activeMathCategory).toBe('main');
  });

  it('updates activeMathCategory', () => {
    useMathGridStore.getState().setActiveMathCategory('chemistry');
    expect(useMathGridStore.getState().activeMathCategory).toBe('chemistry');
  });

  it('round-trips every subject category', () => {
    const cats: MathCategoryId[] = ['biology', 'statistics', 'music', 'history', 'language-arts'];
    for (const cat of cats) {
      useMathGridStore.getState().setActiveMathCategory(cat);
      expect(useMathGridStore.getState().activeMathCategory).toBe(cat);
    }
  });
});

// ── useMathGridStore — cell ops ───────────────────────────────────────────────

describe('useMathGridStore — cell read/write', () => {
  it('setCell writes a glyph', () => {
    useMathGridStore.getState().setCell(0, 0, '7');
    expect(useMathGridStore.getState().getCell(0, 0)?.glyph).toBe('7');
  });

  it('clearCell removes the glyph', () => {
    useMathGridStore.getState().setCell(1, 2, 'x');
    useMathGridStore.getState().clearCell(1, 2);
    expect(useMathGridStore.getState().getCell(1, 2)).toBeUndefined();
  });

  it('getCell returns undefined for an empty cell', () => {
    expect(useMathGridStore.getState().getCell(99, 99)).toBeUndefined();
  });
});

// ── useMathGridStore — cursor ─────────────────────────────────────────────────

describe('useMathGridStore — cursor', () => {
  it('setCursor moves the cursor', () => {
    useMathGridStore.getState().setCursor(3, 4);
    const { cursor } = useMathGridStore.getState();
    expect(cursor.r).toBe(3);
    expect(cursor.c).toBe(4);
  });

  it('moveCursorBy applies deltas', () => {
    useMathGridStore.getState().setCursor(2, 2);
    useMathGridStore.getState().moveCursorBy(1, -1);
    const { cursor } = useMathGridStore.getState();
    expect(cursor.r).toBe(3);
    expect(cursor.c).toBe(1);
  });

  it('advanceCursorRight moves cursor right by one', () => {
    useMathGridStore.getState().setCursor(0, 0);
    useMathGridStore.getState().advanceCursorRight();
    expect(useMathGridStore.getState().cursor.c).toBe(1);
  });
});

// ── useMathGridStore — commitGlyph + backspace ────────────────────────────────

describe('useMathGridStore — commitGlyph + backspaceAtCursor', () => {
  it('commitGlyph writes at cursor and advances', () => {
    useMathGridStore.getState().setCursor(0, 0);
    useMathGridStore.getState().commitGlyph('3');
    expect(useMathGridStore.getState().getCell(0, 0)?.glyph).toBe('3');
    expect(useMathGridStore.getState().cursor.c).toBe(1);
  });

  it('backspaceAtCursor clears the current cell', () => {
    useMathGridStore.getState().setCursor(0, 1);
    useMathGridStore.getState().setCell(0, 1, '9');
    useMathGridStore.getState().backspaceAtCursor();
    expect(useMathGridStore.getState().getCell(0, 1)).toBeUndefined();
  });
});

// ── useMathGridStore — reset ──────────────────────────────────────────────────

describe('useMathGridStore — reset', () => {
  it('reset clears all cells', () => {
    useMathGridStore.getState().setCell(0, 0, '5');
    useMathGridStore.getState().setCell(1, 1, '+');
    useMathGridStore.getState().reset();
    expect(useMathGridStore.getState().getCell(0, 0)).toBeUndefined();
    expect(useMathGridStore.getState().getCell(1, 1)).toBeUndefined();
  });

  it('reset returns cursor to origin', () => {
    useMathGridStore.getState().setCursor(5, 5);
    useMathGridStore.getState().reset();
    const { cursor } = useMathGridStore.getState();
    expect(cursor.r).toBe(0);
    expect(cursor.c).toBe(0);
  });
});

// ── useMathGridStore — serialize round-trip ───────────────────────────────────

describe('useMathGridStore — toSerialized / loadFromSerialized', () => {
  it('round-trips cells and cursor', () => {
    useMathGridStore.getState().setCursor(2, 3);
    useMathGridStore.getState().setCell(0, 0, '4');
    useMathGridStore.getState().setCell(0, 1, '+');
    useMathGridStore.getState().setCell(0, 2, '5');

    const snapshot = useMathGridStore.getState().toSerialized();

    useMathGridStore.getState().reset();
    expect(useMathGridStore.getState().getCell(0, 0)).toBeUndefined();

    useMathGridStore.getState().loadFromSerialized(snapshot);
    expect(useMathGridStore.getState().getCell(0, 0)?.glyph).toBe('4');
    expect(useMathGridStore.getState().getCell(0, 1)?.glyph).toBe('+');
    expect(useMathGridStore.getState().getCell(0, 2)?.glyph).toBe('5');
  });
});
