/**
 * PhraseTile — AAC vocabulary tile tests
 *
 * Covers: rendering, click handler, aria-label fallback,
 * pictogram loading, and graceful no-icon fallback.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import PhraseTile from '@/components/PhraseTile';

// ── service / store mocks ─────────────────────────────────────────────────────

const getPictogramUrlMock = vi.fn(async () => null as string | null);
const pictureModeForProfileMock = vi.fn(() => 'none' as const);

vi.mock('@/services/pictogramService', () => ({
  getPictogramUrl: (...args: unknown[]) => getPictogramUrlMock(...args),
  pictureModeForProfile: (...args: unknown[]) => pictureModeForProfileMock(...args),
}));

vi.mock('@/store/settingsStore', () => ({
  useSettingsStore: (sel?: (s: { language: string }) => unknown) =>
    sel ? sel({ language: 'en' }) : { language: 'en' },
}));

vi.mock('@/store/authStore', () => ({
  useAuthStore: (sel?: (s: { profile: null }) => unknown) =>
    sel ? sel({ profile: null }) : { profile: null },
}));

beforeEach(() => {
  vi.clearAllMocks();
  getPictogramUrlMock.mockResolvedValue(null);
  pictureModeForProfileMock.mockReturnValue('none' as const);
});

// ── rendering ─────────────────────────────────────────────────────────────────

describe('PhraseTile — rendering', () => {
  it('renders the phrase text', () => {
    render(<PhraseTile phrase="Help me" onClick={vi.fn()} />);
    expect(screen.getByText('Help me')).toBeInTheDocument();
  });

  it('uses phrase as aria-label when ariaLabel prop not provided', () => {
    render(<PhraseTile phrase="Water please" onClick={vi.fn()} />);
    expect(screen.getByRole('button', { name: 'Water please' })).toBeInTheDocument();
  });

  it('uses ariaLabel prop when provided (overrides phrase)', () => {
    render(<PhraseTile phrase="Hi" ariaLabel="Say hi" onClick={vi.fn()} />);
    expect(screen.getByRole('button', { name: 'Say hi' })).toBeInTheDocument();
  });

  it('renders as a button element', () => {
    render(<PhraseTile phrase="Go" onClick={vi.fn()} />);
    expect(screen.getByRole('button')).toBeInTheDocument();
  });
});

// ── click ─────────────────────────────────────────────────────────────────────

describe('PhraseTile — click handler', () => {
  it('calls onClick when tapped', () => {
    const onClick = vi.fn();
    render(<PhraseTile phrase="Go" onClick={onClick} />);
    fireEvent.click(screen.getByRole('button'));
    expect(onClick).toHaveBeenCalledOnce();
  });

  it('calls onClick not onClick of a different tile', () => {
    const onClick1 = vi.fn();
    const onClick2 = vi.fn();
    render(
      <>
        <PhraseTile phrase="Yes" onClick={onClick1} />
        <PhraseTile phrase="No" onClick={onClick2} />
      </>
    );
    fireEvent.click(screen.getByRole('button', { name: 'Yes' }));
    expect(onClick1).toHaveBeenCalledOnce();
    expect(onClick2).not.toHaveBeenCalled();
  });
});

// ── pictogram ─────────────────────────────────────────────────────────────────

describe('PhraseTile — pictogram loading', () => {
  it('shows img when getPictogramUrl resolves a URL', async () => {
    getPictogramUrlMock.mockResolvedValueOnce('https://example.com/pic.png');
    const { container } = render(<PhraseTile phrase="Dog" onClick={vi.fn()} />);
    // The img has aria-hidden + alt="" so its ARIA role is "none" (decorative).
    // Query the raw DOM element directly rather than by role.
    await waitFor(() => {
      const img = container.querySelector('img');
      expect(img).toBeInTheDocument();
      expect(img).toHaveAttribute('src', 'https://example.com/pic.png');
    });
  });

  it('renders no img when getPictogramUrl returns null', async () => {
    getPictogramUrlMock.mockResolvedValueOnce(null);
    render(<PhraseTile phrase="Cat" onClick={vi.fn()} />);
    // Let effect run
    await waitFor(() => expect(getPictogramUrlMock).toHaveBeenCalled());
    expect(screen.queryByRole('img', { hidden: true })).toBeNull();
  });

  it('calls getPictogramUrl with englishPhrase when provided', async () => {
    render(<PhraseTile phrase="Agua" englishPhrase="Water" onClick={vi.fn()} />);
    await waitFor(() => expect(getPictogramUrlMock).toHaveBeenCalledWith('Water', 'en', expect.anything()));
  });

  it('calls getPictogramUrl with phrase when englishPhrase is absent', async () => {
    render(<PhraseTile phrase="Help" onClick={vi.fn()} />);
    await waitFor(() => expect(getPictogramUrlMock).toHaveBeenCalledWith('Help', 'en', expect.anything()));
  });
});
