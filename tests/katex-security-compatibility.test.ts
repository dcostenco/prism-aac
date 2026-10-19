import { afterEach, describe, expect, it, vi } from 'vitest';
import katex from 'katex';
import { expressionToLatex } from '@/services/mathLatex';

const SCRIPT_LINK = String.raw`\href{javascript:alert(1)}{tap}`;
const EXTERNAL_IMAGE = String.raw`\includegraphics{https://example.invalid/test.png}`;
const UNSAFE_EXPRESSIONS = [SCRIPT_LINK, EXTERNAL_IMAGE];
const HTML_OPTIONS = { output: 'html' as const, throwOnError: false, strict: 'ignore' as const };
const UNTRUSTED_OPTIONS = { ...HTML_OPTIONS, trust: false };
const OWN_MACRO = { '\\prismProbe': 'x' };
const MACRO_EXPRESSION = String.raw`\prismProbe`;
const COMPATIBILITY_CASES = [
  { name: 'operator', input: '1 ÷ 3 × 2', visible: ['1', '÷', '3', '×', '2'] },
  { name: 'Greek and comparisons', input: 'α + β ≤ π', visible: ['α', 'β', '≤', 'π'] },
  { name: 'fraction and superscript', input: String.raw`\frac{1}{2} + x²`, visible: ['1', '2', 'x'] },
  { name: 'root and sum', input: String.raw`\sqrt{x} + \sum_{i=1}^{n} i`, visible: ['x', '∑', 'i'] },
];

function rendered(latex: string, options: katex.KatexOptions) {
  const node = document.createElement('div');
  node.innerHTML = katex.renderToString(latex, options);
  return node;
}

afterEach(() => { document.body.replaceChildren(); });

describe('real KaTeX security boundary', () => {
  it.each(UNSAFE_EXPRESSIONS)('does not inherit permission to render a trusted command: %s', expression => {
    const options = Object.assign(Object.create({ trust: true }), HTML_OPTIONS) as katex.KatexOptions;
    const node = rendered(expression, options);
    expect(node.querySelector('a[href], img[src]')).toBeNull();
  });

  it('ignores inherited namespace entries instead of accepting them as defined macros', () => {
    const node = rendered(MACRO_EXPRESSION, { ...UNTRUSTED_OPTIONS, macros: Object.create(OWN_MACRO) });
    expect(node.textContent).toContain(MACRO_EXPRESSION);
    expect(node.querySelector('.katex-html')).not.toBeNull();
  });

  it.each(['default', 'processor'] as const)('does not inherit internal %s metadata from an already-polluted prototype', key => {
    const previous = Object.getOwnPropertyDescriptor(Object.prototype, key);
    const poison = key === 'default' ? true : (value: unknown) => value === false ? true : value;
    let html = '';
    try {
      Object.defineProperty(Object.prototype, key, { configurable: true, writable: true, value: poison });
      html = katex.renderToString(SCRIPT_LINK, UNTRUSTED_OPTIONS);
    } finally {
      if (previous) Object.defineProperty(Object.prototype, key, previous);
      else Reflect.deleteProperty(Object.prototype, key);
    }
    const node = document.createElement('div'); node.innerHTML = html;
    expect(node.querySelector('a[href], img[src]')).toBeNull();
  });

  it('retains explicitly owned, application-controlled macros', () => {
    const node = rendered(MACRO_EXPRESSION, { ...UNTRUSTED_OPTIONS, macros: { ...OWN_MACRO } });
    expect(node.querySelector('.katex-error')).toBeNull(); expect(node.textContent).toBe('x');
  });

  it('does not evaluate an inherited trust getter as an application policy', () => {
    const policy = vi.fn(() => true);
    const prototype = Object.defineProperty({}, 'trust', { get: policy });
    const options = Object.assign(Object.create(prototype), HTML_OPTIONS) as katex.KatexOptions;
    const node = rendered(SCRIPT_LINK, options);
    expect(policy).not.toHaveBeenCalled(); expect(node.querySelector('a[href], img[src]')).toBeNull();
  });

  it('retains a caller-owned HTTPS policy without admitting a script protocol', () => {
    const options: katex.KatexOptions = { ...HTML_OPTIONS, trust: context => context.protocol === 'https' };
    const safe = rendered(String.raw`\href{https://example.invalid/}{link}`, options);
    expect(safe.querySelector('a')?.getAttribute('href')).toBe('https://example.invalid/');
    expect(rendered(SCRIPT_LINK, options).querySelector('a[href]')).toBeNull();
  });
});

describe('real KaTeX math compatibility', () => {
  it.each(COMPATIBILITY_CASES)('renders $name using the existing Unicode converter and html-only output', item => {
    const node = rendered(expressionToLatex(item.input), UNTRUSTED_OPTIONS);
    expect(node.querySelector('.katex-error')).toBeNull();
    expect(node.querySelector('.katex-html')).not.toBeNull(); expect(node.querySelector('.katex-mathml')).toBeNull();
    for (const glyph of item.visible) expect(node.textContent).toContain(glyph);
  });

  it('keeps unsupported input as readable error text instead of executable HTML', () => {
    const node = rendered(String.raw`\unknownPrismCommand{<script>}`, UNTRUSTED_OPTIONS);
    expect(node.querySelector('.katex-html')).not.toBeNull(); expect(node.querySelector('script')).toBeNull();
    expect(node.textContent).toContain('unknownPrismCommand');
  });
});
