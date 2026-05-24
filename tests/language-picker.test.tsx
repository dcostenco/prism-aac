/**
 * LanguagePicker + LanguageButton tests
 *
 * Covers: language grid rendering, selection state, select/dismiss,
 * outside-click dismissal, Escape-key dismissal, LanguageButton variants.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import LanguagePicker, { LanguageButton } from '@/components/LanguagePicker';
import { LANG_META } from '@/engine/i18n';

vi.mock('@/services/feedback', () => ({ tapFeedback: vi.fn() }));

// ── LanguageButton ────────────────────────────────────────────────────────────

describe('LanguageButton', () => {
  it('renders with a button role', () => {
    render(<LanguageButton lang="en" onClick={vi.fn()} />);
    expect(screen.getByRole('button')).toBeInTheDocument();
  });

  it('calls onClick when clicked', () => {
    const onClick = vi.fn();
    render(<LanguageButton lang="en" onClick={onClick} />);
    fireEvent.click(screen.getByRole('button'));
    expect(onClick).toHaveBeenCalledOnce();
  });

  it('uses ariaLabel when provided', () => {
    render(<LanguageButton lang="en" onClick={vi.fn()} ariaLabel="Select input language" />);
    expect(screen.getByRole('button', { name: 'Select input language' })).toBeInTheDocument();
  });

  it('falls back to "Language: English. Tap to change." aria-label', () => {
    render(<LanguageButton lang="en" onClick={vi.fn()} />);
    expect(screen.getByRole('button', { name: /Language: English/i })).toBeInTheDocument();
  });
});

// ── LanguagePicker — rendering ────────────────────────────────────────────────

describe('LanguagePicker — rendering', () => {
  const EXPECTED_LANGS = LANG_META.filter((l) => l.code !== 'zh');

  it('renders a listbox with role="listbox"', () => {
    render(
      <LanguagePicker selected="en" onSelect={vi.fn()} onClose={vi.fn()} />
    );
    expect(screen.getByRole('listbox')).toBeInTheDocument();
  });

  it('renders all visible language options (excludes "zh" alias)', () => {
    render(
      <LanguagePicker selected="en" onSelect={vi.fn()} onClose={vi.fn()} />
    );
    expect(screen.getAllByRole('option').length).toBe(EXPECTED_LANGS.length);
  });

  it('selected language has aria-selected=true', () => {
    render(
      <LanguagePicker selected="fr" onSelect={vi.fn()} onClose={vi.fn()} />
    );
    const frOption = screen.getByTestId('language-option-fr');
    expect(frOption).toHaveAttribute('aria-selected', 'true');
  });

  it('non-selected languages have aria-selected=false', () => {
    render(
      <LanguagePicker selected="fr" onSelect={vi.fn()} onClose={vi.fn()} />
    );
    const enOption = screen.getByTestId('language-option-en');
    expect(enOption).toHaveAttribute('aria-selected', 'false');
  });
});

// ── LanguagePicker — selection ────────────────────────────────────────────────

describe('LanguagePicker — language selection', () => {
  it('clicking a language calls onSelect with its code', () => {
    const onSelect = vi.fn();
    render(
      <LanguagePicker selected="en" onSelect={onSelect} onClose={vi.fn()} />
    );
    fireEvent.click(screen.getByTestId('language-option-es'));
    expect(onSelect).toHaveBeenCalledWith('es');
  });

  it('clicking a language also calls onClose', () => {
    const onClose = vi.fn();
    render(
      <LanguagePicker selected="en" onSelect={vi.fn()} onClose={onClose} />
    );
    fireEvent.click(screen.getByTestId('language-option-fr'));
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('clicking the already-selected language still calls onSelect + onClose', () => {
    const onSelect = vi.fn();
    const onClose = vi.fn();
    render(
      <LanguagePicker selected="en" onSelect={onSelect} onClose={onClose} />
    );
    fireEvent.click(screen.getByTestId('language-option-en'));
    expect(onSelect).toHaveBeenCalledWith('en');
    expect(onClose).toHaveBeenCalledOnce();
  });
});

// ── LanguagePicker — dismissal ────────────────────────────────────────────────

describe('LanguagePicker — dismissal', () => {
  it('Escape key calls onClose', () => {
    const onClose = vi.fn();
    render(
      <LanguagePicker selected="en" onSelect={vi.fn()} onClose={onClose} />
    );
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('outside pointerdown calls onClose', () => {
    const onClose = vi.fn();
    const { container } = render(
      <div>
        <div data-testid="outside" />
        <LanguagePicker selected="en" onSelect={vi.fn()} onClose={onClose} />
      </div>
    );
    fireEvent.pointerDown(container.querySelector('[data-testid="outside"]')!);
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('pointerdown inside picker does NOT call onClose', () => {
    const onClose = vi.fn();
    render(
      <LanguagePicker selected="en" onSelect={vi.fn()} onClose={onClose} />
    );
    // Click inside the picker itself (not an option — the listbox container)
    fireEvent.pointerDown(screen.getByRole('listbox'));
    expect(onClose).not.toHaveBeenCalled();
  });
});
