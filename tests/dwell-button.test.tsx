/**
 * DwellButton — Phase 5A (hold-time dwell) + Phase 5D (two-hit magnify).
 *
 * Each test mounts the button with explicit overrides (so the settings
 * store doesn't leak between tests). We exercise pointer events via
 * fireEvent.pointerDown/Up — userEvent doesn't synthesize pointer events
 * in jsdom out of the box.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import DwellButton from '@/components/math/DwellButton';

beforeEach(() => {
  vi.useFakeTimers();
  // performance.now is real but we control setTimeout — when fake-timers
  // advance we also advance performance.now manually for the dwell tick.
});

afterEach(() => {
  vi.useRealTimers();
});

function pressButton(btn: HTMLElement) {
  fireEvent.pointerDown(btn, { pointerId: 1 });
}
function releaseButton(btn: HTMLElement) {
  fireEvent.pointerUp(btn, { pointerId: 1 });
}

describe('DwellButton — base path (no overrides)', () => {
  it('with holdTimeMsOverride=0 commits instantly on press', () => {
    const onCommit = vi.fn();
    render(
      <DwellButton onCommit={onCommit} holdTimeMsOverride={0} twoHitMagnifyOverride={false}>
        commit
      </DwellButton>,
    );
    const btn = screen.getByRole('button');
    pressButton(btn);
    expect(onCommit).toHaveBeenCalledTimes(1);
  });

  it('exposes data-hold-ms + data-two-hit + data-armed attributes', () => {
    render(
      <DwellButton onCommit={() => {}} holdTimeMsOverride={400} twoHitMagnifyOverride={true}>
        x
      </DwellButton>,
    );
    const btn = screen.getByRole('button');
    expect(btn).toHaveAttribute('data-hold-ms', '400');
    expect(btn).toHaveAttribute('data-two-hit', '1');
    expect(btn).toHaveAttribute('data-armed', '0');
  });
});

describe('DwellButton — two-hit magnify', () => {
  it('first press ARMS without committing', () => {
    const onCommit = vi.fn();
    render(
      <DwellButton onCommit={onCommit} holdTimeMsOverride={0} twoHitMagnifyOverride={true}>
        x
      </DwellButton>,
    );
    const btn = screen.getByRole('button');
    pressButton(btn);
    releaseButton(btn);
    expect(onCommit).not.toHaveBeenCalled();
    expect(btn).toHaveAttribute('data-armed', '1');
  });

  it('second press COMMITS and disarms (instant mode)', () => {
    const onCommit = vi.fn();
    render(
      <DwellButton onCommit={onCommit} holdTimeMsOverride={0} twoHitMagnifyOverride={true}>
        x
      </DwellButton>,
    );
    const btn = screen.getByRole('button');
    pressButton(btn); // arm
    releaseButton(btn);
    expect(btn).toHaveAttribute('data-armed', '1');
    pressButton(btn); // commit
    expect(onCommit).toHaveBeenCalledTimes(1);
    expect(btn).toHaveAttribute('data-armed', '0');
  });

  it('auto-disarms after 2 s of inactivity', () => {
    const onCommit = vi.fn();
    render(
      <DwellButton onCommit={onCommit} holdTimeMsOverride={0} twoHitMagnifyOverride={true}>
        x
      </DwellButton>,
    );
    const btn = screen.getByRole('button');
    pressButton(btn);
    releaseButton(btn);
    expect(btn).toHaveAttribute('data-armed', '1');
    act(() => { vi.advanceTimersByTime(2100); });
    expect(btn).toHaveAttribute('data-armed', '0');
    expect(onCommit).not.toHaveBeenCalled();
  });

  it('a press WHILE armed clears the auto-disarm timer (commits, no later disarm pulse)', () => {
    const onCommit = vi.fn();
    render(
      <DwellButton onCommit={onCommit} holdTimeMsOverride={0} twoHitMagnifyOverride={true}>
        x
      </DwellButton>,
    );
    const btn = screen.getByRole('button');
    pressButton(btn); // arm at t=0
    releaseButton(btn);
    act(() => { vi.advanceTimersByTime(500); });
    pressButton(btn); // commit at t=500ms
    releaseButton(btn);
    expect(onCommit).toHaveBeenCalledTimes(1);
    // Advance past the original 2s mark — no second commit, no spurious
    // re-arm should occur.
    act(() => { vi.advanceTimersByTime(2000); });
    expect(onCommit).toHaveBeenCalledTimes(1);
    expect(btn).toHaveAttribute('data-armed', '0');
  });

  it('two-hit OFF + holdTime 0 → instant commit on first press (no arming)', () => {
    const onCommit = vi.fn();
    render(
      <DwellButton onCommit={onCommit} holdTimeMsOverride={0} twoHitMagnifyOverride={false}>
        x
      </DwellButton>,
    );
    const btn = screen.getByRole('button');
    pressButton(btn);
    expect(onCommit).toHaveBeenCalledTimes(1);
    expect(btn).toHaveAttribute('data-armed', '0');
  });
});
