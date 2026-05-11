import { describe, it, expect, beforeEach, vi } from 'vitest';
import { useUIStore } from '@/store/uiStore';

beforeEach(() => {
  useUIStore.setState({
    sidePanel: 'none', activeCategoryId: null, activeSequenceId: null,
    activeSequenceStep: 0, keyboardMode: 'letters', isUpperCase: false,
    showHistory: false, showSettings: false, isAlertFlashing: false,
    _alertLastFiredAt: 0,  // reset cooldown between tests
  });
});

describe('UIStore — Side panel management', () => {
  it('openCategories sets panel to categories', () => {
    useUIStore.getState().openCategories();
    expect(useUIStore.getState().sidePanel).toBe('categories');
  });

  it('openCategories toggles off if already open', () => {
    useUIStore.getState().openCategories();
    useUIStore.getState().openCategories();
    expect(useUIStore.getState().sidePanel).toBe('none');
  });

  it('selectCategory sets category-detail view', () => {
    useUIStore.getState().selectCategory('help-needs');
    expect(useUIStore.getState().sidePanel).toBe('category-detail');
    expect(useUIStore.getState().activeCategoryId).toBe('help-needs');
  });

  it('backToCategories returns to category list', () => {
    useUIStore.getState().selectCategory('help-needs');
    useUIStore.getState().backToCategories();
    expect(useUIStore.getState().sidePanel).toBe('categories');
    expect(useUIStore.getState().activeCategoryId).toBeNull();
  });

  it('closeSidePanel clears everything', () => {
    useUIStore.getState().selectCategory('help-needs');
    useUIStore.getState().closeSidePanel();
    expect(useUIStore.getState().sidePanel).toBe('none');
    expect(useUIStore.getState().activeCategoryId).toBeNull();
    expect(useUIStore.getState().activeSequenceId).toBeNull();
  });

  it('openMath toggles math panel', () => {
    useUIStore.getState().openMath();
    expect(useUIStore.getState().sidePanel).toBe('math');
    useUIStore.getState().openMath();
    expect(useUIStore.getState().sidePanel).toBe('none');
  });
});

describe('UIStore — Ordering flow', () => {
  it('startOrdering sets sequence and step 0', () => {
    useUIStore.getState().startOrdering('seq-chipotle');
    expect(useUIStore.getState().sidePanel).toBe('ordering');
    expect(useUIStore.getState().activeSequenceId).toBe('seq-chipotle');
    expect(useUIStore.getState().activeSequenceStep).toBe(0);
  });

  it('nextStep increments step with bounds check', () => {
    useUIStore.getState().startOrdering('seq-chipotle');
    useUIStore.getState().nextStep(5);
    expect(useUIStore.getState().activeSequenceStep).toBe(1);
    useUIStore.getState().nextStep(5);
    expect(useUIStore.getState().activeSequenceStep).toBe(2);
  });

  it('nextStep does not exceed maxSteps', () => {
    useUIStore.getState().startOrdering('seq-chipotle');
    for (let i = 0; i < 10; i++) useUIStore.getState().nextStep(5);
    expect(useUIStore.getState().activeSequenceStep).toBe(4); // 0-indexed, max is steps.length-1
  });

  it('prevStep does not go below 0', () => {
    useUIStore.getState().startOrdering('seq-chipotle');
    useUIStore.getState().prevStep();
    expect(useUIStore.getState().activeSequenceStep).toBe(0);
  });

  it('finishOrdering returns to category-detail', () => {
    useUIStore.getState().startOrdering('seq-chipotle');
    useUIStore.getState().finishOrdering();
    expect(useUIStore.getState().sidePanel).toBe('category-detail');
    expect(useUIStore.getState().activeSequenceId).toBeNull();
  });
});

describe('UIStore — Keyboard mode', () => {
  it('cycles letters → numbers → symbols → letters', () => {
    expect(useUIStore.getState().keyboardMode).toBe('letters');
    useUIStore.getState().toggleKeyboardMode();
    expect(useUIStore.getState().keyboardMode).toBe('numbers');
    useUIStore.getState().toggleKeyboardMode();
    expect(useUIStore.getState().keyboardMode).toBe('symbols');
    useUIStore.getState().toggleKeyboardMode();
    expect(useUIStore.getState().keyboardMode).toBe('letters');
  });

  it('toggleCase flips uppercase state', () => {
    expect(useUIStore.getState().isUpperCase).toBe(false);
    useUIStore.getState().toggleCase();
    expect(useUIStore.getState().isUpperCase).toBe(true);
  });
});

describe('UIStore — Alert (motor safety)', () => {
  it('triggerAlert sets flashing true', () => {
    useUIStore.getState().triggerAlert();
    expect(useUIStore.getState().isAlertFlashing).toBe(true);
  });

  it('triggerAlert auto-clears after timeout', async () => {
    vi.useFakeTimers();
    useUIStore.getState().triggerAlert();
    expect(useUIStore.getState().isAlertFlashing).toBe(true);
    vi.advanceTimersByTime(2100);
    expect(useUIStore.getState().isAlertFlashing).toBe(false);
    vi.useRealTimers();
  });

  it('rapid-fire within 5s cooldown: second tap ignored, flash clears at 2s from first', () => {
    vi.useFakeTimers();
    useUIStore.getState().triggerAlert();
    expect(useUIStore.getState().isAlertFlashing).toBe(true);
    vi.advanceTimersByTime(1500);
    useUIStore.getState().triggerAlert(); // within 5s cooldown — blocked
    // Flash clears at 2000ms from first trigger (not reset by blocked second tap)
    vi.advanceTimersByTime(600); // 2100ms total from first trigger
    expect(useUIStore.getState().isAlertFlashing).toBe(false);
    vi.useRealTimers();
  });

  it('second alert fires after 5s cooldown expires', () => {
    vi.useFakeTimers();
    useUIStore.getState().triggerAlert();
    vi.advanceTimersByTime(5100); // cooldown expires + first flash clears
    useUIStore.getState().triggerAlert(); // should work now
    expect(useUIStore.getState().isAlertFlashing).toBe(true);
    vi.useRealTimers();
  });
});
