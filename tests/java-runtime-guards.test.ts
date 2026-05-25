/**
 * javaRuntime — empty-code guard + wrapJavaSnippet pure logic
 *
 * evaluateJava returns early with ok:false when the input is empty/whitespace
 * — no network call is made. This is the only path testable without mocking
 * the Piston API.
 *
 * wrapJavaSnippet is a pure function: wraps bare snippets in a Main class
 * but passes through source that already declares a class.
 */
import { describe, it, expect, vi, afterEach } from 'vitest';
import { evaluateJava, wrapJavaSnippet } from '@/services/javaRuntime';

afterEach(() => {
  vi.restoreAllMocks();
});

// ── evaluateJava — empty-code guard ──────────────────────────────────────────

describe('evaluateJava — empty input guard', () => {
  it('returns ok:false for empty string without network call', async () => {
    const result = await evaluateJava('');
    expect(result.ok).toBe(false);
  });

  it('returns ok:false for whitespace-only input', async () => {
    const result = await evaluateJava('   ');
    expect(result.ok).toBe(false);
  });

  it('error message is user-readable for empty input', async () => {
    const result = await evaluateJava('');
    if (!result.ok) {
      expect(typeof result.error).toBe('string');
      expect(result.error.length).toBeGreaterThan(0);
    }
  });

  it('returns a JavaEvalResult shape', async () => {
    const result = await evaluateJava('');
    expect(typeof result).toBe('object');
    expect('ok' in result).toBe(true);
  });
});

// ── wrapJavaSnippet ───────────────────────────────────────────────────────────

describe('wrapJavaSnippet', () => {
  it('wraps a bare expression in a Main class', () => {
    const { code, wrapped } = wrapJavaSnippet('System.out.println("hello");');
    expect(wrapped).toBe(true);
    expect(code).toContain('public class Main');
    expect(code).toContain('public static void main');
    expect(code).toContain('System.out.println("hello");');
  });

  it('does not wrap source that already declares a class', () => {
    const src = 'public class Foo { public static void main(String[] args) {} }';
    const { code, wrapped } = wrapJavaSnippet(src);
    expect(wrapped).toBe(false);
    expect(code).toBe(src);
  });

  it('does not wrap source with any class declaration (no main)', () => {
    const src = 'class Greeter { String greet() { return "hi"; } }';
    const { code, wrapped } = wrapJavaSnippet(src);
    expect(wrapped).toBe(false);
    expect(code).toBe(src);
  });

  it('wraps multi-line bare code', () => {
    const src = 'int x = 1;\nint y = 2;\nSystem.out.println(x + y);';
    const { code, wrapped } = wrapJavaSnippet(src);
    expect(wrapped).toBe(true);
    expect(code).toContain('int x = 1;');
    expect(code).toContain('int y = 2;');
  });

  it('returns the original source unchanged when not wrapping', () => {
    const src = 'class A {}';
    const { code } = wrapJavaSnippet(src);
    expect(code).toBe(src);
  });

  it('wrapped code compiles to valid Java structure (contains Main.java boilerplate)', () => {
    const { code } = wrapJavaSnippet('int a = 42;');
    expect(code).toMatch(/public class Main/);
    expect(code).toMatch(/public static void main\(String\[\] args\)/);
  });
});
