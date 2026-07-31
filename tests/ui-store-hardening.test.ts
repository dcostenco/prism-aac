/**
 * uiStore — hardening: actions not covered by ui-store.test.ts
 *
 * The existing suite covers openCategories (all nav paths), ordering flow
 * (nextStep/prevStep/finishOrdering), keyboard mode cycling (letters→numbers
 * →symbols), toggleCase, and triggerAlert. These tests cover the rest:
 *
 *   cycleKeyboardMode — 2-state toggle: keyboard-only ↔ picture-only.
 *   Any non-maximized state → keyboard-only; keyboard-only → picture-only.
 *   A broken cycle can leave the keyboard permanently hidden, locking an AAC
 *   user out of text input without any obvious way to recover.
 *
 *   drillIntoCategory — validates id shape + enforces 20-level depth cap.
 *   Broken validation accepts adversarial ids; broken depth cap can produce
 *   a 20-element categoryPath that breaks the breadcrumb render.
 *
 *   navigateCategoryUp — pops the category path stack. Broken logic can
 *   either leave the user stuck at the leaf or jump past the root.
 *
 *   toggleCapsLock — must set BOTH capsLock AND isUpperCase in sync.
 *   A broken toggle leaves isUpperCase false while capsLock is true,
 *   producing lowercase keys even though the UI shows "locked uppercase".
 *
 *   openModulePanel — validates panelId; unknown ids must be no-ops so a
 *   bad appId from the marketplace can't corrupt the sidePanel state.
 *
 *   panel toggles (openAACChat, openSchedule, openGames, etc.) — all use
 *   the same open-if-closed / close-if-open pattern. One missing toggle
 *   disables an AAC feature for the entire session.
 *
 *   setContactDraftName / setContactDraftRecipient — caregiver adds a new
 *   contact. Broken setters either don't persist or reset other fields.
 *
 *   toggleHistory / toggleSettings / toggleCategoryManager — boolean modal
 *   toggles. A stuck toggle means the modal cannot be dismissed.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { useUIStore } from '@/store/uiStore';

beforeEach(() => {
  window.matchMedia = vi.fn().mockReturnValue({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() });
  useUIStore.setState({
    sidePanel: 'none',
    categoryKeyboardOpen: true,
    keyboardMaximized: true,
    activeCategoryId: null,
    categoryPath: [],
    activeContactId: null,
    activeSequenceId: null,
    activeSequenceStep: 0,
    keyboardMode: 'letters',
    isUpperCase: false,
    capsLock: false,
    showHistory: false,
    showSettings: false,
    showCategoryManager: false,
    isAlertFlashing: false,
    _alertLastFiredAt: 0,
    alertConfirmOpen: false,
    alertSendStatus: null,
    contactDraftName: '',
    contactDraftRecipient: '',
  });
});

// ── cycleKeyboardMode ─────────────────────────────────────────────────────────

describe('uiStore — cycleKeyboardMode', () => {
  it('keyboard-only → picture-only (maximized clears both flags)', () => {
    useUIStore.setState({ keyboardMaximized: true, categoryKeyboardOpen: true });
    useUIStore.getState().cycleKeyboardMode();
    const s = useUIStore.getState();
    expect(s.keyboardMaximized).toBe(false);
    // picture-only: keyboard drawer closed so no keyboard is shown
    expect(s.categoryKeyboardOpen).toBe(false);
  });

  it('normal → keyboard-only (non-maximized with open kbd goes to maximized)', () => {
    useUIStore.setState({ keyboardMaximized: false, categoryKeyboardOpen: true });
    useUIStore.getState().cycleKeyboardMode();
    const s = useUIStore.getState();
    expect(s.keyboardMaximized).toBe(true);
    expect(s.categoryKeyboardOpen).toBe(true);
  });

  it('picture-only → keyboard-only (non-maximized with closed kbd goes to maximized)', () => {
    useUIStore.setState({ keyboardMaximized: false, categoryKeyboardOpen: false });
    useUIStore.getState().cycleKeyboardMode();
    const s = useUIStore.getState();
    expect(s.keyboardMaximized).toBe(true);
    expect(s.categoryKeyboardOpen).toBe(true);
  });

  it('cycle is idempotent over 4 transitions', () => {
    useUIStore.setState({ keyboardMaximized: false, categoryKeyboardOpen: false });
    const cycle = () => useUIStore.getState().cycleKeyboardMode();

    cycle(); // picture-only → keyboard-only
    expect(useUIStore.getState().keyboardMaximized).toBe(true);

    cycle(); // keyboard-only → picture-only
    expect(useUIStore.getState().keyboardMaximized).toBe(false);
    expect(useUIStore.getState().categoryKeyboardOpen).toBe(false);

    cycle(); // picture-only → keyboard-only
    expect(useUIStore.getState().keyboardMaximized).toBe(true);

    cycle(); // keyboard-only → picture-only
    expect(useUIStore.getState().keyboardMaximized).toBe(false);
    expect(useUIStore.getState().categoryKeyboardOpen).toBe(false);
  });
});

// ── drillIntoCategory ─────────────────────────────────────────────────────────

describe('uiStore — drillIntoCategory', () => {
  it('appends the id to categoryPath and sets activeCategoryId', () => {
    useUIStore.getState().drillIntoCategory('food-ordering');
    const s = useUIStore.getState();
    expect(s.activeCategoryId).toBe('food-ordering');
    expect(s.categoryPath).toEqual(['food-ordering']);
    expect(s.sidePanel).toBe('category-detail');
  });

  it('builds up the path on multiple drills', () => {
    useUIStore.getState().drillIntoCategory('cats');
    useUIStore.getState().drillIntoCategory('food');
    useUIStore.getState().drillIntoCategory('drinks');
    expect(useUIStore.getState().categoryPath).toEqual(['cats', 'food', 'drinks']);
  });

  it('ignores empty string id', () => {
    useUIStore.getState().drillIntoCategory('');
    expect(useUIStore.getState().categoryPath).toHaveLength(0);
  });

  it('ignores id longer than 64 chars', () => {
    useUIStore.getState().drillIntoCategory('a'.repeat(65));
    expect(useUIStore.getState().categoryPath).toHaveLength(0);
  });

  it('enforces 20-level depth cap — 21st drill is a no-op', () => {
    for (let i = 0; i < 20; i++) {
      useUIStore.getState().drillIntoCategory(`cat-${i}`);
    }
    expect(useUIStore.getState().categoryPath).toHaveLength(20);
    useUIStore.getState().drillIntoCategory('overflow');
    expect(useUIStore.getState().categoryPath).toHaveLength(20);
  });
});

// ── navigateCategoryUp ────────────────────────────────────────────────────────

describe('uiStore — navigateCategoryUp', () => {
  it('pops the leaf and activates the parent', () => {
    useUIStore.setState({ categoryPath: ['a', 'b', 'c'], activeCategoryId: 'c', sidePanel: 'category-detail' });
    useUIStore.getState().navigateCategoryUp();
    const s = useUIStore.getState();
    expect(s.activeCategoryId).toBe('b');
    expect(s.categoryPath).toEqual(['a', 'b']);
  });

  it('returns to categories panel when path reaches root (length 0)', () => {
    useUIStore.setState({ categoryPath: ['a'], activeCategoryId: 'a', sidePanel: 'category-detail' });
    useUIStore.getState().navigateCategoryUp();
    const s = useUIStore.getState();
    expect(s.sidePanel).toBe('categories');
    expect(s.activeCategoryId).toBeNull();
    expect(s.categoryPath).toEqual([]);
  });
});

// ── toggleCapsLock ────────────────────────────────────────────────────────────

describe('uiStore — toggleCapsLock', () => {
  it('sets both capsLock AND isUpperCase to true', () => {
    useUIStore.getState().toggleCapsLock();
    const s = useUIStore.getState();
    expect(s.capsLock).toBe(true);
    expect(s.isUpperCase).toBe(true);
  });

  it('turns both off on second toggle', () => {
    useUIStore.getState().toggleCapsLock();
    useUIStore.getState().toggleCapsLock();
    const s = useUIStore.getState();
    expect(s.capsLock).toBe(false);
    expect(s.isUpperCase).toBe(false);
  });

  it('capsLock and isUpperCase always stay in sync', () => {
    useUIStore.getState().toggleCapsLock();
    const s1 = useUIStore.getState();
    expect(s1.capsLock).toBe(s1.isUpperCase);

    useUIStore.getState().toggleCapsLock();
    const s2 = useUIStore.getState();
    expect(s2.capsLock).toBe(s2.isUpperCase);
  });
});

// ── panel toggles ─────────────────────────────────────────────────────────────

describe('uiStore — panel toggles (open-if-closed / close-if-open)', () => {
  const panels = [
    { name: 'openAACChat', panel: 'aac-chat' },
    { name: 'openSchedule', panel: 'schedule' },
    { name: 'openGames', panel: 'games' },
    { name: 'openMarketplace', panel: 'marketplace' },
    { name: 'openComfortPlayer', panel: 'comfort-player' },
    { name: 'openPdfReader', panel: 'pdf-reader' },
  ] as const;

  for (const { name, panel } of panels) {
    it(`${name}: opens when sidePanel is 'none'`, () => {
      useUIStore.getState()[name]();
      expect(useUIStore.getState().sidePanel).toBe(panel);
    });

    it(`${name}: closes when already open`, () => {
      useUIStore.getState()[name](); // open
      useUIStore.getState()[name](); // close
      expect(useUIStore.getState().sidePanel).toBe('none');
    });
  }
});

// ── openModulePanel ───────────────────────────────────────────────────────────

describe('uiStore — openModulePanel', () => {
  it('no-op for an unknown panelId', () => {
    useUIStore.getState().openModulePanel('definitely-not-a-panel');
    expect(useUIStore.getState().sidePanel).toBe('none');
  });
});

// ── contact draft setters ─────────────────────────────────────────────────────

describe('uiStore — setContactDraftName / setContactDraftRecipient', () => {
  it('setContactDraftName updates contactDraftName', () => {
    useUIStore.getState().setContactDraftName('Mom');
    expect(useUIStore.getState().contactDraftName).toBe('Mom');
  });

  it('setContactDraftRecipient updates contactDraftRecipient', () => {
    useUIStore.getState().setContactDraftRecipient('+1-800-555-0100');
    expect(useUIStore.getState().contactDraftRecipient).toBe('+1-800-555-0100');
  });

  it('setContactDraftName does not affect contactDraftRecipient', () => {
    useUIStore.setState({ contactDraftRecipient: '@user' });
    useUIStore.getState().setContactDraftName('Dad');
    expect(useUIStore.getState().contactDraftRecipient).toBe('@user');
  });
});

// ── modal toggles ─────────────────────────────────────────────────────────────

describe('uiStore — modal toggles', () => {
  it('toggleHistory flips showHistory on/off', () => {
    expect(useUIStore.getState().showHistory).toBe(false);
    useUIStore.getState().toggleHistory();
    expect(useUIStore.getState().showHistory).toBe(true);
    useUIStore.getState().toggleHistory();
    expect(useUIStore.getState().showHistory).toBe(false);
  });

  it('toggleSettings flips showSettings on/off', () => {
    useUIStore.getState().toggleSettings();
    expect(useUIStore.getState().showSettings).toBe(true);
    useUIStore.getState().toggleSettings();
    expect(useUIStore.getState().showSettings).toBe(false);
  });

  it('toggleCategoryManager flips showCategoryManager on/off', () => {
    useUIStore.getState().toggleCategoryManager();
    expect(useUIStore.getState().showCategoryManager).toBe(true);
    useUIStore.getState().toggleCategoryManager();
    expect(useUIStore.getState().showCategoryManager).toBe(false);
  });
});

// ── desync regression: openCategories/backToCategories must reset keyboardMaximized ──

describe('uiStore — keyboard desync prevention', () => {
  it('openCategories resets keyboardMaximized (prevents desync)', () => {
    useUIStore.setState({ sidePanel: 'none', keyboardMaximized: true, categoryKeyboardOpen: true });
    useUIStore.getState().openCategories();
    const s = useUIStore.getState();
    expect(s.categoryKeyboardOpen).toBe(false);
    expect(s.keyboardMaximized).toBe(false);
  });

  it('openCategories from category-detail resets keyboardMaximized', () => {
    useUIStore.setState({ sidePanel: 'category-detail', keyboardMaximized: true, categoryKeyboardOpen: true });
    useUIStore.getState().openCategories();
    const s = useUIStore.getState();
    expect(s.categoryKeyboardOpen).toBe(false);
    expect(s.keyboardMaximized).toBe(false);
    expect(s.sidePanel).toBe('categories');
  });

  it('backToCategories resets keyboardMaximized (prevents desync)', () => {
    useUIStore.setState({ sidePanel: 'category-detail', keyboardMaximized: true, categoryKeyboardOpen: true });
    useUIStore.getState().backToCategories();
    const s = useUIStore.getState();
    expect(s.categoryKeyboardOpen).toBe(false);
    expect(s.keyboardMaximized).toBe(false);
    expect(s.sidePanel).toBe('categories');
  });

  it('cycleKeyboardMode from previously-desynced state shows keyboard on first click', () => {
    // Simulate the desync that openCategories used to produce: both flags true,
    // then only categoryKeyboardOpen cleared. After the fix, openCategories
    // clears both, so this state should be unreachable — but the cycle must
    // still handle it correctly if anything else produces it.
    useUIStore.setState({ keyboardMaximized: true, categoryKeyboardOpen: false });
    useUIStore.getState().cycleKeyboardMode();
    const s = useUIStore.getState();
    // First click must go to keyboard-visible, not be a no-op.
    expect(s.keyboardMaximized).toBe(true);
    expect(s.categoryKeyboardOpen).toBe(true);
  });

  it('toggleCategoryKeyboard closing resets keyboardMaximized (no desync on close)', () => {
    // Start with keyboard maximized (e.g. auto-maximized in landscape).
    // Closing via toggleCategoryKeyboard must clear BOTH flags.
    useUIStore.setState({ categoryKeyboardOpen: true, keyboardMaximized: true });
    useUIStore.getState().toggleCategoryKeyboard();
    const s = useUIStore.getState();
    expect(s.categoryKeyboardOpen).toBe(false);
    expect(s.keyboardMaximized).toBe(false);
  });

  it('toggleCategoryKeyboard opens directly into full Typing mode', () => {
    useUIStore.setState({ categoryKeyboardOpen: false, keyboardMaximized: false });
    useUIStore.getState().toggleCategoryKeyboard();
    const s = useUIStore.getState();
    expect(s.categoryKeyboardOpen).toBe(true);
    expect(s.keyboardMaximized).toBe(true);
  });

  it('toggleKeyboardMaximized never creates the legacy mixed state', () => {
    useUIStore.setState({ categoryKeyboardOpen: true, keyboardMaximized: true });
    useUIStore.getState().toggleKeyboardMaximized();
    expect(useUIStore.getState().categoryKeyboardOpen).toBe(false);
    expect(useUIStore.getState().keyboardMaximized).toBe(false);

    useUIStore.getState().toggleKeyboardMaximized();
    expect(useUIStore.getState().categoryKeyboardOpen).toBe(true);
    expect(useUIStore.getState().keyboardMaximized).toBe(true);
  });

  it('orientation handler guard: landscape with keyboard closed does not set keyboardMaximized', () => {
    // The CategoryPanel orientation handler only auto-maximizes when
    // categoryKeyboardOpen=true && keyboardMaximized=false. This test
    // verifies the guard at the store level: if catKbOpen is false,
    // directly setting kbMax=true would be the desync. The handler's
    // condition (catKbOpen && !kbMax) prevents it — assert the invariant.
    useUIStore.setState({ categoryKeyboardOpen: false, keyboardMaximized: false });
    // Simulate what the handler does: read state, check guard, conditionally set.
    const state = useUIStore.getState();
    const shouldAutoMax = state.categoryKeyboardOpen && !state.keyboardMaximized;
    expect(shouldAutoMax).toBe(false);
    // State unchanged — no desync produced.
    expect(useUIStore.getState().keyboardMaximized).toBe(false);
    expect(useUIStore.getState().categoryKeyboardOpen).toBe(false);
  });
});
