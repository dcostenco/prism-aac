/**
 * javaRuntime — tests for the snippet wrapper + error normaliser.
 *
 * No live Piston call here (that's an external network roundtrip).
 * The wrapper is the bit we own; the rest is a fetch shape the
 * playwright e2e covers indirectly.
 */
import { describe, it, expect } from 'vitest';
import { wrapJavaSnippet } from '@/services/javaRuntime';

describe('wrapJavaSnippet', () => {
  it('wraps a bare snippet in Main.main', () => {
    const r = wrapJavaSnippet('System.out.println(1 + 1);');
    expect(r.wrapped).toBe(true);
    expect(r.code).toContain('public class Main');
    expect(r.code).toContain('public static void main(String[] args)');
    expect(r.code).toContain('System.out.println(1 + 1);');
  });

  it('preserves source unchanged when a class is already declared', () => {
    const src = 'public class Foo {\n    public static void main(String[] a) { }\n}';
    const r = wrapJavaSnippet(src);
    expect(r.wrapped).toBe(false);
    expect(r.code).toBe(src);
  });

  it('preserves source unchanged when a non-public class is declared', () => {
    const src = 'class Helper {\n    int x = 5;\n}';
    const r = wrapJavaSnippet(src);
    expect(r.wrapped).toBe(false);
    expect(r.code).toBe(src);
  });

  it('indents wrapped snippet body by 8 spaces inside main', () => {
    const r = wrapJavaSnippet('int x = 5;\nint y = 10;');
    expect(r.wrapped).toBe(true);
    expect(r.code.split('\n').filter((l) => l.includes('int'))).toEqual([
      '        int x = 5;',
      '        int y = 10;',
    ]);
  });
});
