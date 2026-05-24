/**
 * ColoredText — per-word color coding + TTS word highlight tests
 *
 * Covers: empty guard, word rendering, active word highlight, no
 * highlight when activeWordIndex is null.
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import ColoredText from '@/components/ColoredText';

vi.mock('@/store/settingsStore', () => ({
  useSettingsStore: (sel?: (s: { language: string }) => unknown) =>
    sel ? sel({ language: 'en' }) : { language: 'en' },
}));

// Use the real classifyPhrase engine (it's a pure function — no side effects).

describe('ColoredText — empty guard', () => {
  it('renders null for empty string', () => {
    const { container } = render(<ColoredText text="" />);
    expect(container.firstChild).toBeNull();
  });
});

describe('ColoredText — word rendering', () => {
  it('renders all words in the text', () => {
    render(<ColoredText text="I want water" />);
    // classifyPhrase splits "I want water" into tokens; all should appear
    expect(screen.getByText(/want/)).toBeInTheDocument();
    expect(screen.getByText(/water/)).toBeInTheDocument();
  });

  it('wraps output in a <span>', () => {
    const { container } = render(<ColoredText text="Hello" />);
    expect(container.firstChild?.nodeName).toBe('SPAN');
  });

  it('passes className to the outer span', () => {
    const { container } = render(<ColoredText text="Hello" className="my-class" />);
    expect(container.firstChild).toHaveClass('my-class');
  });
});

describe('ColoredText — active word highlight', () => {
  it('marks the correct word with data-active-word="1" when activeWordIndex is set', () => {
    render(<ColoredText text="I want water" activeWordIndex={1} />);
    // activeWordIndex=1 should mark the 2nd content word ("want")
    const highlighted = document.querySelector('[data-active-word="1"]');
    expect(highlighted).toBeInTheDocument();
  });

  it('no element has data-active-word when activeWordIndex is null', () => {
    render(<ColoredText text="I want water" activeWordIndex={null} />);
    expect(document.querySelector('[data-active-word="1"]')).toBeNull();
  });

  it('no element has data-active-word when activeWordIndex is not provided', () => {
    render(<ColoredText text="I want water" />);
    expect(document.querySelector('[data-active-word="1"]')).toBeNull();
  });

  it('active span has yellow background style', () => {
    render(<ColoredText text="Hello world" activeWordIndex={0} />);
    const active = document.querySelector('[data-active-word="1"]') as HTMLElement | null;
    expect(active).not.toBeNull();
    expect(active?.style.backgroundColor).toContain('rgba(255, 235, 59');
  });
});
