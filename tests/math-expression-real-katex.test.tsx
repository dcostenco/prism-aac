import React from 'react';
import { cleanup, render, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import MathExpression from '@/components/MathExpression';

const MATH_EXPRESSION = String.raw`\frac{1}{2} + α² ≤ π`;
const UNTRUSTED_EXPRESSIONS = [
  String.raw`\href{javascript:alert(1)}{tap}`,
  String.raw`\includegraphics{https://example.invalid/test.png}`,
];
const PROTOTYPE_TRUST_KEY = 'trust';

afterEach(() => cleanup());

describe('MathExpression with the actual KaTeX engine', () => {
  it('preserves fractions, Greek, superscripts, html-only output and aria-live', async () => {
    const view = render(<MathExpression expression={MATH_EXPRESSION} />);
    await waitFor(() => expect(view.container.querySelector('.katex-html')).not.toBeNull());
    expect(view.container.querySelector('.katex-error')).toBeNull();
    expect(view.container.querySelector('.katex-mathml')).toBeNull();
    expect(view.container.querySelector('span[aria-live="polite"]')).not.toBeNull();
    for (const glyph of ['1', '2', 'α', '≤', 'π']) expect(view.container.textContent).toContain(glyph);
  });

  it.each(UNTRUSTED_EXPRESSIONS)('does not create active links or resources from expression %s', async expression => {
    const view = render(<MathExpression expression={expression} />);
    await waitFor(() => expect(view.container.querySelector('.katex-html')).not.toBeNull());
    expect(view.container.querySelector('a[href], img[src], script')).toBeNull();
  });

  it('continues to deny trusted commands when Object.prototype already carries trust=true', async () => {
    const previous = Object.getOwnPropertyDescriptor(Object.prototype, PROTOTYPE_TRUST_KEY);
    try {
      Object.defineProperty(Object.prototype, PROTOTYPE_TRUST_KEY, { configurable: true, writable: true, value: true });
      const view = render(<MathExpression expression={UNTRUSTED_EXPRESSIONS[0]} />);
      await waitFor(() => expect(view.container.querySelector('.katex-html')).not.toBeNull());
      expect(view.container.querySelector('a[href], img[src], script')).toBeNull();
    } finally {
      if (previous) Object.defineProperty(Object.prototype, PROTOTYPE_TRUST_KEY, previous);
      else Reflect.deleteProperty(Object.prototype, PROTOTYPE_TRUST_KEY);
    }
  });

  it('clears an earlier formatted expression when a new empty value is supplied', async () => {
    const view = render(<MathExpression expression={MATH_EXPRESSION} />);
    await waitFor(() => expect(view.container.querySelector('.katex-html')).not.toBeNull());
    view.rerender(<MathExpression expression="" />);
    await waitFor(() => expect(view.container.textContent).toBe(''));
    expect(view.container.querySelector('.katex')).toBeNull();
  });
});
