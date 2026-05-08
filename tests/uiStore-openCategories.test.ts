/**
 * openCategories — navigation contract.
 *
 * User report May 2026: "When I click on 'folder Icon' to access
 * picture symbols, nothing happens" (Image #8). Earlier revision
 * mapped 'category-detail' → 'none' on tap, which from inside a
 * detail view felt like a no-op (the user expected to navigate UP to
 * the categories list, not close the whole panel).
 *
 * The fix preserves toggle-to-close from the top level, but inside a
 * detail / ordering flow tap goes UP one level instead of all the way
 * out.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { useUIStore } from '@/store/uiStore';

beforeEach(() => {
  useUIStore.setState({
    sidePanel: 'none',
    activeCategoryId: null,
    activeSequenceId: null,
    activeSequenceStep: 0,
  });
});

describe('useUIStore.openCategories', () => {
  it('opens categories from "none"', () => {
    useUIStore.getState().openCategories();
    expect(useUIStore.getState().sidePanel).toBe('categories');
  });

  it('opens categories from any other panel (math, marketplace, etc.)', () => {
    useUIStore.setState({ sidePanel: 'math' });
    useUIStore.getState().openCategories();
    expect(useUIStore.getState().sidePanel).toBe('categories');

    useUIStore.setState({ sidePanel: 'marketplace' });
    useUIStore.getState().openCategories();
    expect(useUIStore.getState().sidePanel).toBe('categories');
  });

  it('closes categories on second tap from the top level', () => {
    useUIStore.setState({ sidePanel: 'categories' });
    useUIStore.getState().openCategories();
    expect(useUIStore.getState().sidePanel).toBe('none');
  });

  it('navigates UP from category-detail to the categories list (not close)', () => {
    // Pre-fix: this case mapped to 'none' and read as "tap does nothing"
    // from the user's perspective.
    useUIStore.setState({ sidePanel: 'category-detail', activeCategoryId: 'core-verbs' });
    useUIStore.getState().openCategories();
    const s = useUIStore.getState();
    expect(s.sidePanel).toBe('categories');
    expect(s.activeCategoryId).toBeNull();
  });

  it('navigates UP from ordering flow to the categories list', () => {
    useUIStore.setState({
      sidePanel: 'ordering',
      activeCategoryId: 'core-verbs',
      activeSequenceId: 'seq-1',
      activeSequenceStep: 2,
    });
    useUIStore.getState().openCategories();
    const s = useUIStore.getState();
    expect(s.sidePanel).toBe('categories');
    expect(s.activeCategoryId).toBeNull();
    expect(s.activeSequenceId).toBeNull();
  });

  it('always clears activeCategoryId on open', () => {
    useUIStore.setState({ sidePanel: 'math', activeCategoryId: 'leftover-from-prior-session' });
    useUIStore.getState().openCategories();
    expect(useUIStore.getState().activeCategoryId).toBeNull();
  });
});
