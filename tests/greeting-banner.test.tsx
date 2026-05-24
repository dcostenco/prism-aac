/**
 * GreetingBanner — time-of-day greeting + next task tests
 *
 * Covers: sessionStorage dismissal gate, greeting text, next-task
 * display, dismiss button.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import GreetingBanner from '@/components/GreetingBanner';

// ── store / engine mocks ───────────────────────────────────────────────────────

const scheduleState = {
  tasks: [] as Array<{ id: string; text: string; textKey?: string; icon: string; done: boolean; order: number }>,
};

vi.mock('@/store/scheduleStore', () => ({
  useScheduleStore: (sel?: (s: typeof scheduleState) => unknown) =>
    sel ? sel(scheduleState) : scheduleState,
}));

vi.mock('@/engine/useT', () => ({
  useT: () => ({
    t: (k: string) => k,
    ttsCode: 'en-US',
    rtl: false,
    ready: true,
  }),
}));

beforeEach(() => {
  sessionStorage.removeItem('prism-greeting-dismissed');
  scheduleState.tasks = [];
});

// ── dismissal gate ────────────────────────────────────────────────────────────

describe('GreetingBanner — dismissal gate', () => {
  it('renders nothing when prism-greeting-dismissed is set in sessionStorage', () => {
    sessionStorage.setItem('prism-greeting-dismissed', '1');
    const { container } = render(<GreetingBanner />);
    expect(container.firstChild).toBeNull();
  });

  it('renders banner when not dismissed', async () => {
    render(<GreetingBanner />);
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /dismiss greeting/i })).toBeInTheDocument();
    });
  });
});

// ── greeting display ──────────────────────────────────────────────────────────

describe('GreetingBanner — greeting text', () => {
  it('renders a time-appropriate greeting key', async () => {
    render(<GreetingBanner />);
    await waitFor(() => {
      // The t() mock returns the key itself, so we see good_morning / good_afternoon / etc.
      const greetingEl = screen.getByText(/good_(morning|afternoon|evening|night)/i);
      expect(greetingEl).toBeInTheDocument();
    });
  });
});

// ── dismiss action ────────────────────────────────────────────────────────────

describe('GreetingBanner — dismiss', () => {
  it('clicking dismiss removes the banner from DOM', async () => {
    const { container } = render(<GreetingBanner />);
    await waitFor(() => screen.getByRole('button', { name: /dismiss greeting/i }));
    fireEvent.click(screen.getByRole('button', { name: /dismiss greeting/i }));
    expect(container.firstChild).toBeNull();
  });

  it('clicking dismiss sets prism-greeting-dismissed in sessionStorage', async () => {
    render(<GreetingBanner />);
    await waitFor(() => screen.getByRole('button', { name: /dismiss greeting/i }));
    fireEvent.click(screen.getByRole('button', { name: /dismiss greeting/i }));
    expect(sessionStorage.getItem('prism-greeting-dismissed')).toBe('1');
  });
});

// ── next task ─────────────────────────────────────────────────────────────────

describe('GreetingBanner — next task display', () => {
  it('shows next_is + task text when pending task exists', async () => {
    scheduleState.tasks = [{ id: '1', text: 'Brush teeth', icon: '🦷', done: false, order: 1 }];
    render(<GreetingBanner />);
    await waitFor(() => {
      expect(screen.getByText(/next_is/)).toBeInTheDocument();
      expect(screen.getByText(/Brush teeth/)).toBeInTheDocument();
    });
  });

  it('shows nothing extra when all tasks are done', async () => {
    scheduleState.tasks = [{ id: '1', text: 'Done task', icon: '✅', done: true, order: 1 }];
    render(<GreetingBanner />);
    await waitFor(() => screen.getByRole('button', { name: /dismiss greeting/i }));
    expect(screen.queryByText(/next_is/)).toBeNull();
  });

  it('shows nothing extra when task list is empty', async () => {
    render(<GreetingBanner />);
    await waitFor(() => screen.getByRole('button', { name: /dismiss greeting/i }));
    expect(screen.queryByText(/next_is/)).toBeNull();
  });

  it('uses t(textKey) when task has textKey instead of text', async () => {
    scheduleState.tasks = [{ id: '2', text: '', textKey: 'task_morning_meds', icon: '💊', done: false, order: 1 }];
    render(<GreetingBanner />);
    await waitFor(() => {
      expect(screen.getByText(/task_morning_meds/)).toBeInTheDocument();
    });
  });
});
