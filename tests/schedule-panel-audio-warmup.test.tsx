/**
 * SchedulePanel — audio warmup + edit/reorder/preset behaviors.
 *
 * Pins the regression we just fixed in v0.6.0:
 *   - startAudioWarmup() fires when the user clicks Start (keeps the
 *     AudioContext alive across the silent timer wait so the chime
 *     actually plays when timer expires)
 *   - stopAudioWarmup() fires when user clicks Stop, Reset, or after the
 *     THEN-cycle completes
 *   - editTask updates a task's text and drops the i18n binding
 *   - addTask via preset attaches the textKey
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

async function clickStart(user: ReturnType<typeof userEvent.setup>) {
    await user.click(screen.getByRole('button', { name: /start_timer/i }));
}

describe('SchedulePanel — audio warmup lifecycle', () => {
    it('clicking Start triggers startAudioWarmup', async () => {
        const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
        render(<SchedulePanel />);
        await clickStart(user);

        expect(startAudioWarmup).toHaveBeenCalledTimes(1);
    });

    it('clicking Stop triggers stopAudioWarmup', async () => {
        const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
        render(<SchedulePanel />);
        await clickStart(user); // start_timer
        // After start, the same button now reads "stop"
        await user.click(screen.getByRole('button', { name: /^stop$/i }));

        expect(stopAudioWarmup).toHaveBeenCalled();
    });

    it('clicking Reset triggers stopAudioWarmup', async () => {
        const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
        render(<SchedulePanel />);
        await clickStart(user);
        await user.click(screen.getByRole('button', { name: /^reset$/i }));

        expect(stopAudioWarmup).toHaveBeenCalled();
    });

    it('full first-then cycle stops the warmup after THEN click + 600ms settle', async () => {
        const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
        render(<SchedulePanel />);
        await clickStart(user); // warmup starts

        // Run timer to expiry, click FIRST, run timer again, click THEN
        await act(async () => { vi.advanceTimersByTime(60_000); });
        await user.click(screen.getByRole('button', { name: /^first:/i }));
        await act(async () => { vi.advanceTimersByTime(60_000); });
        await user.click(screen.getByRole('button', { name: /^then:/i }));

        // 600ms settle — toggleDone + stopAudioWarmup fire here
        await act(async () => { vi.advanceTimersByTime(700); });

        expect(stopAudioWarmup).toHaveBeenCalled();
    });
});

describe('SchedulePanel — preset activity grid', () => {
    it('+Add Task opens a preset grid; clicking a preset adds task with textKey', async () => {
        const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
        render(<SchedulePanel />);

        await user.click(screen.getByRole('button', { name: /add_task/i }));
        // The preset grid renders many activity buttons
        const brushButton = await screen.findByRole('button', { name: /sched_preset_brush/i });
        await user.click(brushButton);

        const tasks = useScheduleStore.getState().tasks;
        const added = tasks.find((tsk) => tsk.textKey === 'sched_preset_brush');
        expect(added).toBeDefined();
        expect(added?.icon).toBe('🪥');
    });

    it('+Add Task → custom text drops the textKey', async () => {
        const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
        render(<SchedulePanel />);

        await user.click(screen.getByRole('button', { name: /add_task/i }));
        const inputs = screen.getAllByPlaceholderText(/add_task/i);
        const customInput = inputs[inputs.length - 1] as HTMLInputElement;
        await user.type(customInput, 'Music practice');
        await user.click(screen.getByRole('button', { name: /^add$/i }));

        const tasks = useScheduleStore.getState().tasks;
        const added = tasks.find((tsk) => tsk.text === 'Music practice');
        expect(added).toBeDefined();
        expect(added?.textKey).toBeUndefined();
    });
});

describe('SchedulePanel — inline edit', () => {
    it('clicking the ✏️ on a task opens an editable input that saves on blur', async () => {
        const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
        render(<SchedulePanel />);

        // The first task ('Morning routine') edit button
        const editBtns = screen.getAllByRole('button', { name: /^edit$/i });
        await user.click(editBtns[0]);

        const editInput = screen.getByRole('textbox', { name: /edit_task/i }) as HTMLInputElement;
        expect(editInput).toBeInTheDocument();
        await user.clear(editInput);
        await user.type(editInput, 'Wake-up routine');
        // Blur to commit
        editInput.blur();

        const tasks = useScheduleStore.getState().tasks;
        const updated = tasks.find((tsk) => tsk.id === 'sched-1');
        expect(updated?.text).toBe('Wake-up routine');
        expect(updated?.textKey).toBeUndefined(); // i18n binding dropped on custom edit
    });

    it('Escape during edit cancels without modifying the task', async () => {
        const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
        render(<SchedulePanel />);

        const editBtns = screen.getAllByRole('button', { name: /^edit$/i });
        await user.click(editBtns[0]);

        const editInput = screen.getByRole('textbox', { name: /edit_task/i }) as HTMLInputElement;
        await user.clear(editInput);
        await user.type(editInput, 'should not save');
        await user.keyboard('{Escape}');

        const tasks = useScheduleStore.getState().tasks;
        const unchanged = tasks.find((tsk) => tsk.id === 'sched-1');
        expect(unchanged?.text).toBe('Morning routine');
    });
});

describe('scheduleStore — editTask', () => {
    it('updates text in place', () => {
        useScheduleStore.getState().editTask('sched-1', { text: 'Breakfast & meds' });
        const t = useScheduleStore.getState().tasks.find((x) => x.id === 'sched-1');
        expect(t?.text).toBe('Breakfast & meds');
    });

    it('drops textKey when patch.textKey === null', () => {
        useScheduleStore.setState({
            tasks: [{ id: 'k', text: 'X', icon: '🌅', textKey: 'foo', done: false, order: 0 }],
            rewards: 0, timerSeconds: 60,
        } as Partial<ReturnType<typeof useScheduleStore.getState>>);
        useScheduleStore.getState().editTask('k', { textKey: null });
        const t = useScheduleStore.getState().tasks.find((x) => x.id === 'k');
        expect(t?.textKey).toBeUndefined();
    });

    it('updates icon without touching text', () => {
        useScheduleStore.getState().editTask('sched-1', { icon: '⏰' });
        const t = useScheduleStore.getState().tasks.find((x) => x.id === 'sched-1');
        expect(t?.icon).toBe('⏰');
        expect(t?.text).toBe('Morning routine');
    });
});
