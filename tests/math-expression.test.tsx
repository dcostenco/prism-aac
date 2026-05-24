/**
 * MathExpression — KaTeX rendering component tests
 *
 * Covers: empty/placeholder state, KaTeX render invocation, error
 * fallback to plain text, aria-live="polite" attribute.
 *
 * KaTeX is mocked — we test the component's contract with the render
 * engine, not KaTeX internals.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import MathExpression from '@/components/MathExpression';

// ── mocks ─────────────────────────────────────────────────────────────────────

const katexRenderMock = vi.fn();

// vi.mock hoists — the factory runs before the module under test loads.
vi.mock('katex', () => ({
  default: {
    render: (...args: unknown[]) => katexRenderMock(...args),
  },
}));

vi.mock('katex/dist/katex.min.css', () => ({}));

vi.mock('@/services/mathLatex', () => ({
  expressionToLatex: (expr: string) => `\\text{${expr}}`,
}));

beforeEach(() => {
  vi.clearAllMocks();
});

// ── empty / placeholder ───────────────────────────────────────────────────────

describe('MathExpression — empty expression', () => {
  it('renders an empty span when expression is empty string', async () => {
    const { container } = render(<MathExpression expression="" />);
    await waitFor(() => {
      const span = container.querySelector('span');
      expect(span).toBeInTheDocument();
      expect(span?.textContent).toBe('');
    });
  });

  it('shows placeholder text when expression is empty', async () => {
    const { container } = render(
      <MathExpression expression="" placeholder="Enter expression" />
    );
    await waitFor(() => {
      expect(container.querySelector('span')?.textContent).toBe('Enter expression');
    });
  });

  it('does NOT call katex.render for empty expression', async () => {
    render(<MathExpression expression="" />);
    // Wait for effect to settle
    await waitFor(() => expect(katexRenderMock).not.toHaveBeenCalled());
  });
});

// ── non-empty expression ──────────────────────────────────────────────────────

describe('MathExpression — non-empty expression', () => {
  it('calls katex.render with the latex string for non-empty expression', async () => {
    render(<MathExpression expression="5 + 3" />);
    await waitFor(() => {
      expect(katexRenderMock).toHaveBeenCalledWith(
        '\\text{5 + 3}',
        expect.any(HTMLElement),
        expect.objectContaining({ throwOnError: false }),
      );
    });
  });

  it('falls back to raw expression text when katex.render throws', async () => {
    katexRenderMock.mockImplementationOnce(() => { throw new Error('render fail'); });
    const { container } = render(<MathExpression expression="bad expr" />);
    await waitFor(() => {
      expect(container.querySelector('span')?.textContent).toBe('bad expr');
    });
  });
});

// ── accessibility ─────────────────────────────────────────────────────────────

describe('MathExpression — accessibility', () => {
  it('outer span has aria-live="polite"', () => {
    const { container } = render(<MathExpression expression="" />);
    expect(container.querySelector('span')).toHaveAttribute('aria-live', 'polite');
  });

  it('passes className to the span', () => {
    const { container } = render(<MathExpression expression="" className="math-display" />);
    expect(container.querySelector('span')).toHaveClass('math-display');
  });
});
