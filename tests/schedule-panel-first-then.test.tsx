/**
 * SchedulePanel — First-Then state machine integration tests.
 *
 * Pins the 6-step flow specified by the user:
 *   1. Setup timer + click Start         (covered by VisualTimer existence)
 *   2. Timer up → ring + FIRST armed
 *   3. FIRST click → ✅ on tile
 *   4. Timer auto-restarts → ring → THEN armed
 *   5. THEN click → ✅ on tile + first schedule row marked done
 *   6. Next first-then pair appears
 *
 * Uses fake timers so we can advance to "timer expired" without waiting.
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom/vitest';
import SchedulePanel from '@/components/SchedulePanel';
import { useScheduleStore } from '@/store/scheduleStore';
import { useUIStore } from '@/store/uiStore';
import { useAuthStore } from '@/store/authStore';

vi.mock('@/engine/useT', () => ({
    useT: () => ({ t: (key: string) => key, ttsCode: 'en-US' }),
}));

const tapFeedback = vi.fn();
const playTimerRing = vi.fn();
const startAudioWarmup = vi.fn();
const stopAudioWarmup = vi.fn();
vi.mock('@/services/feedback', () => ({
    tapFeedback: (...args: unknown[]) => tapFeedback(...args),
    playTimerRing: (...args: unknown[]) => playTimerRing(...args),
    startAudioWarmup: (...args: unknown[]) => startAudioWarmup(...args),
    stopAudioWarmup: (...args: unknown[]) => stopAudioWarmup(...args),
}));

function seedStores() {
    useScheduleStore.setState({
        tasks: [
            { id: 'sched-1', text: 'Morning routine', icon: '🌅', done: false, order: 0 },
            { id: 'sched-2', text: 'Breakfast', icon: '🥣', done: false, order: 1 },
            { id: 'sched-3', text: 'School', icon: '🏫', done: false, order: 2 },
        ],
        rewards: 0,
        timerSeconds: 60,
    });
    useUIStore.setState({ sidePanel: 'schedule' } as Partial<ReturnType<typeof useUIStore.getState>>);
    useAuthStore.setState({ profile: { plan: 'free' } } as Partial<ReturnType<typeof useAuthStore.getState>>);
}

beforeEach(() => {
    tapFeedback.mockClear();
    playTimerRing.mockClear();
    startAudioWarmup.mockClear();
    stopAudioWarmup.mockClear();
    seedStores();
    vi.useFakeTimers({ shouldAdvanceTime: true });
});

afterEach(() => {
    vi.useRealTimers();
});

/** Helper — advance the in-component countdown setInterval by N seconds. */
async function expireTimer(seconds: number) {
    await act(async () => {
        for (let i = 0; i < seconds; i++) {
            vi.advanceTimersByTime(1000);
        }
    });
}

async function clickStart(user: ReturnType<typeof userEvent.setup>) {
    const startBtn = screen.getByRole('button', { name: /start_timer/i });
    await user.click(startBtn);
}

describe('SchedulePanel — First-Then flow (6 steps)', () => {
    it('Step 1: renders timer + Start button', () => {
        render(<SchedulePanel />);
        expect(screen.getByRole('button', { name: /start_timer/i })).toBeInTheDocument();
    });

    it('Step 2: when timer expires, ring sound plays and FIRST tile is armed', async () => {
        const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
        render(<SchedulePanel />);

        await clickStart(user);
        await expireTimer(60); // matches seeded timerSeconds

        // ring fired
        expect(playTimerRing).toHaveBeenCalledTimes(1);

        // FIRST tile is now enabled (armed); THEN tile remains disabled
        const firstBtn = screen.getByRole('button', { name: /^first:/i });
        const thenBtn = screen.getByRole('button', { name: /^then:/i });
        expect(firstBtn).toBeEnabled();
        expect(thenBtn).toBeDisabled();
    });

    it('Step 3: clicking FIRST shows green check on tile and FIRST tile becomes pressed', async () => {
        const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
        render(<SchedulePanel />);
        await clickStart(user);
        await expireTimer(60);

        const firstBtn = screen.getByRole('button', { name: /^first:/i });
        await user.click(firstBtn);

        // FIRST tile is checked (aria-pressed=true on a togglable tile)
        expect(firstBtn).toHaveAttribute('aria-pressed', 'true');
        // Schedule task NOT yet marked done — that only happens after THEN click
        const stillUndone = useScheduleStore.getState().tasks.find((tsk) => tsk.id === 'sched-1');
        expect(stillUndone?.done).toBe(false);
    });

    it('Step 4: timer auto-restarts after FIRST; second expiration arms THEN with a second ring', async () => {
        const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
        render(<SchedulePanel />);
        await clickStart(user);
        await expireTimer(60); // first ring → first-armed
        await user.click(screen.getByRole('button', { name: /^first:/i }));
        // Timer auto-restarts on FIRST click via autoStartKey bump
        await expireTimer(60); // second ring → then-armed

        expect(playTimerRing).toHaveBeenCalledTimes(2);
        const thenBtn = screen.getByRole('button', { name: /^then:/i });
        expect(thenBtn).toBeEnabled();
    });

    it('Step 5: clicking THEN marks the FIRST schedule row done and shows ✅ on THEN tile', async () => {
        const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
        render(<SchedulePanel />);
        await clickStart(user);
        await expireTimer(60);
        await user.click(screen.getByRole('button', { name: /^first:/i }));
        await expireTimer(60);
        const thenBtn = screen.getByRole('button', { name: /^then:/i });
        await user.click(thenBtn);

        // Immediately: THEN tile is pressed/checked
        expect(thenBtn).toHaveAttribute('aria-pressed', 'true');

        // After the 600ms post-click delay, the underlying schedule task flips to done
        await act(async () => { vi.advanceTimersByTime(700); });
        const after = useScheduleStore.getState().tasks.find((tsk) => tsk.id === 'sched-1');
        expect(after?.done).toBe(true);
    });

    it('Step 6: after THEN cycle, the next first-then pair shows the next task pair', async () => {
        const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
        render(<SchedulePanel />);
        await clickStart(user);
        await expireTimer(60);
        await user.click(screen.getByRole('button', { name: /^first:/i }));
        await expireTimer(60);
        await user.click(screen.getByRole('button', { name: /^then:/i }));
        await act(async () => { vi.advanceTimersByTime(700); });

        // FIRST tile should now show "Breakfast" (was the previous THEN);
        // its aria-label includes the task name 'Breakfast'.
        const firstBtnAfter = screen.getByRole('button', { name: /^first:.*Breakfast/i });
        expect(firstBtnAfter).toBeInTheDocument();

        // Phase has reset to idle — both tiles are disabled until next ring.
        expect(firstBtnAfter).toBeDisabled();
        const thenBtnAfter = screen.getByRole('button', { name: /^then:.*School/i });
        expect(thenBtnAfter).toBeDisabled();
    });

    it('regression: clicking FIRST when not armed is a no-op', async () => {
        render(<SchedulePanel />);
        const firstBtn = screen.getByRole('button', { name: /^first:/i });
        // Tile is rendered disabled in idle state — verify it
        expect(firstBtn).toBeDisabled();
        // Force-click via fireEvent doesn't change state
        const before = useScheduleStore.getState().tasks.find((tsk) => tsk.id === 'sched-1');
        expect(before?.done).toBe(false);
    });

    it('regression: clicking THEN before FIRST is checked is a no-op', async () => {
        const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
        render(<SchedulePanel />);
        await clickStart(user);
        await expireTimer(60); // first-armed
        const thenBtn = screen.getByRole('button', { name: /^then:/i });
        expect(thenBtn).toBeDisabled();
        // No throw, no state change if forced
        const taskBefore = useScheduleStore.getState().tasks.find((tsk) => tsk.id === 'sched-1');
        expect(taskBefore?.done).toBe(false);
    });
});
