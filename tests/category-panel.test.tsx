/**
 * CategoryPanel — home board, search, phrase click, render gating tests
 *
 * Covers: null render when panel is closed, home board (aria-label), search
 * open/close, phrase click calls appendText + learnWord + recordPhraseUse,
 * category detail render, back-button navigation.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import CategoryPanel from '@/components/CategoryPanel';

// ── vi.hoisted ────────────────────────────────────────────────────────────────

const mocks = vi.hoisted(() => {
  const appendTextMock          = vi.fn();
  const closeSidePanelMock      = vi.fn();
  const selectCategoryMock      = vi.fn();
  const drillIntoCategoryMock   = vi.fn();
  const navigateCategoryUpMock  = vi.fn();
  const backToCategoriesMock    = vi.fn();
  const startOrderingMock       = vi.fn();
  const nextStepMock            = vi.fn();
  const prevStepMock            = vi.fn();
  const finishOrderingMock      = vi.fn();
  const toggleCategoryKeyboardMock = vi.fn();
  const cycleKeyboardModeMock   = vi.fn();
  const learnWordMock           = vi.fn();
  const setAiCompletionMock     = vi.fn();
  const recordUseMock           = vi.fn();
  const aacSpeakMock            = vi.fn();
  const speakWordMock           = vi.fn();

  type Phrase = { id: string; text: string };
  type Category = {
    id: string; name: string; nameKey?: string; icon: string;
    parentId?: string | null;
    phrases?: Phrase[];
  };

  const uiState = {
    sidePanel: 'none' as string,
    activeCategoryId: null as string | null,
    categoryPath: [] as string[],
    activeSequenceId: null as string | null,
    activeSequenceStep: 0,
    categoryKeyboardOpen: false,
    keyboardMaximized: false,
    closeSidePanel: closeSidePanelMock,
    selectCategory: selectCategoryMock,
    drillIntoCategory: drillIntoCategoryMock,
    navigateCategoryUp: navigateCategoryUpMock,
    backToCategories: backToCategoriesMock,
    startOrdering: startOrderingMock,
    nextStep: nextStepMock,
    prevStep: prevStepMock,
    finishOrdering: finishOrderingMock,
    toggleCategoryKeyboard: toggleCategoryKeyboardMock,
    cycleKeyboardMode: cycleKeyboardModeMock,
  };

  const messageState = {
    text: '',
    autoSpeak: false,
    soundEnabled: true,
    appendText: appendTextMock,
  };

  const settingsState = {
    gridSize: 9 as number,
    language: 'en' as string,
    speechRate: 1,
    speechVolume: 1,
    outputLanguage: 'en' as string,
    speakSelectionFeedback: false,
  };

  const mockCategories: Category[] = [
    { id: 'quick-talk', name: 'Quick Talk', icon: '💬', parentId: null },
    { id: 'feelings',   name: 'Feelings',   icon: '😊', parentId: null },
  ];

  const mockPhrases: Phrase[] = [
    { id: 'p1', text: 'yes' },
    { id: 'p2', text: 'no' },
    { id: 'p3', text: 'maybe' },
  ];

  const useUIStore = Object.assign(
    (sel?: (s: typeof uiState) => unknown) => sel ? sel(uiState) : uiState,
    {
      getState: () => uiState,
      // The landscape auto-maximize path calls setState. Without it on the
      // mock the call threw, so that branch was never exercised at all.
      setState: (patch: Record<string, unknown>) => Object.assign(uiState, patch),
    },
  );

  const useMessageStore = Object.assign(
    (sel?: (s: typeof messageState) => unknown) => sel ? sel(messageState) : messageState,
    { getState: () => messageState },
  );

  const useSettingsStore = Object.assign(
    (sel?: (s: typeof settingsState) => unknown) => sel ? sel(settingsState) : settingsState,
    { getState: () => settingsState },
  );

  return {
    appendTextMock, closeSidePanelMock, selectCategoryMock, drillIntoCategoryMock,
    navigateCategoryUpMock, backToCategoriesMock, startOrderingMock, nextStepMock,
    prevStepMock, finishOrderingMock, toggleCategoryKeyboardMock, cycleKeyboardModeMock,
    learnWordMock, setAiCompletionMock, recordUseMock,
    aacSpeakMock, speakWordMock,
    uiState, messageState, settingsState,
    mockCategories, mockPhrases,
    useUIStore, useMessageStore, useSettingsStore,
  };
});

// ── mocks ──────────────────────────────────────────────────────────────────────

vi.mock('@/store/uiStore',      () => ({ useUIStore:      mocks.useUIStore      }));
vi.mock('@/store/messageStore', () => ({ useMessageStore: mocks.useMessageStore }));
vi.mock('@/store/settingsStore', () => ({ useSettingsStore: mocks.useSettingsStore }));

vi.mock('@/store/categoryStore', () => ({
  useCategoryStore: (sel?: (s: {
    allCategories: () => typeof mocks.mockCategories;
    getSubcategories: (id: string) => never[];
    getRankedPhrasesForCategory: (id: string) => { phrase: { id: string; text: string } }[];
    getSequencesForCategory: (id: string) => never[];
    isCategoryLocked: (id: string) => boolean;
  }) => unknown) => {
    const state = {
      allCategories: () => mocks.mockCategories,
      getSubcategories: (_id: string) => [],
      getRankedPhrasesForCategory: (_id: string) =>
        mocks.mockPhrases.map((p) => ({ phrase: p })),
      getSequencesForCategory: (_id: string) => [],
      // the review-gate lock has its own test (tests/unreviewed-folder-lock.test.tsx)
      isCategoryLocked: (_id: string) => false,
    };
    return sel ? sel(state) : state;
  },
}));

vi.mock('@/store/phraseUsageStore', () => ({
  usePhraseUsageStore: (sel?: (s: { recordUse: () => void }) => unknown) => {
    const state = { recordUse: mocks.recordUseMock };
    return sel ? sel(state) : state;
  },
}));

vi.mock('@/store/predictionStore', () => ({
  usePredictionStore: (sel?: (s: { learnWord: () => void; setAiCompletion: () => void }) => unknown) => {
    const state = { learnWord: mocks.learnWordMock, setAiCompletion: mocks.setAiCompletionMock };
    return sel ? sel(state) : state;
  },
}));

vi.mock('@/services/feedback',   () => ({ tapFeedback: vi.fn() }));
vi.mock('@/services/aacSpeak',   () => ({ aacSpeak: mocks.aacSpeakMock }));
vi.mock('@/services/speechService', () => ({ speakWord: mocks.speakWordMock }));
vi.mock('@/services/azureTTS',   () => ({ warmupAzureAudio: vi.fn() }));

vi.mock('@/services/translateService', () => ({
  translateTextSync:      (_t: string) => _t,
  looksLikeTargetLang:    () => true,
}));

vi.mock('@/services/searchKeyBridge', () => ({
  registerSearchKeyHandler: vi.fn(),
}));

vi.mock('@/engine/useT', () => ({
  useT: () => ({
    t: (k: string) => k,
    ttsCode: 'en-US',
    rtl: false,
    ready: true,
  }),
}));

vi.mock('@/components/PhraseTile', () => ({
  default: ({ phrase, onClick }: { phrase: string; onClick: () => void }) => (
    <button onClick={onClick} data-testid="phrase-tile">{phrase}</button>
  ),
}));

vi.mock('@/constants/phraseTranslations', () => ({
  getPhraseText: (_id: string, _lang: string, text: string) => text,
}));

beforeEach(() => {
  vi.clearAllMocks();
  mocks.mockCategories.splice(2);
  mocks.uiState.sidePanel = 'none';
  mocks.uiState.activeCategoryId = null;
  mocks.uiState.categoryPath = [];
  mocks.uiState.categoryKeyboardOpen = false;
  mocks.uiState.keyboardMaximized = false;
  mocks.messageState.text = '';
  mocks.messageState.autoSpeak = false;
  mocks.messageState.soundEnabled = true;
  mocks.settingsState.language = 'en';
  mocks.settingsState.gridSize = 9;
  mocks.settingsState.outputLanguage = 'en';
  mocks.settingsState.speakSelectionFeedback = false;
  window.matchMedia = vi.fn().mockReturnValue({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() });
});

describe('CategoryPanel — category-strip swipe', () => {
  beforeEach(() => {
    mocks.mockCategories.push(...Array.from({ length: 18 }, (_, index) => ({
      id: `category-${index}`, name: `Category ${index}`, icon: '📂', parentId: null,
    })));
  });

  const swipeStrip = (strip: HTMLElement, dx: number, dy = 0) => {
    const start = { clientX: 200, clientY: 100 };
    const end = { clientX: 200 + dx, clientY: 100 + dy };
    fireEvent.touchStart(strip, { touches: [start] });
    fireEvent.touchMove(strip, { touches: [end] });
    fireEvent.touchEnd(strip, { touches: [], changedTouches: [end] });
  };

  it.each(['grid', 'strip'])('pages %s with Mac wheel input, not vertical scroll or zoom, once per burst', surface => {
    mocks.settingsState.gridSize = 4;
    const { container } = render(<CategoryPanel />);
    const element = surface === 'strip' ? screen.getByTestId('category-strip') : container.querySelector('.aac-picture-grid')!;
    const status = screen.getByTestId(surface === 'strip' ? 'category-page-indicator' : 'vocabulary-page-indicator');
    fireEvent.wheel(element, { deltaX: 100, deltaY: 200 });
    fireEvent.wheel(element, { deltaX: 100, ctrlKey: true });
    expect(status.textContent).toMatch(/^1\s*\//);
    for (let i = 0; i < 12; i++) fireEvent.wheel(element, { deltaX: 10 });
    expect(status.textContent).toMatch(/^2\s*\//);
    expect(mocks.appendTextMock).not.toHaveBeenCalled();
    expect(mocks.selectCategoryMock).not.toHaveBeenCalled();
    expect(mocks.speakWordMock).not.toHaveBeenCalled();
  });

  const pointer = (element: Element, type: string, x: number, y = 100, pointerType = 'mouse') => {
    const event = new MouseEvent(type, { bubbles: true, cancelable: true, clientX: x, clientY: y, button: 0 });
    Object.defineProperties(event, { pointerId: { value: 1 }, pointerType: { value: pointerType } });
    fireEvent(element, event);
  };

  it('reverses from the visible category page after resizing reduces page count', () => {
    const width = Object.getOwnPropertyDescriptor(window, 'innerWidth')!;
    try {
      Object.defineProperty(window, 'innerWidth', { configurable: true, value: 390 });
      render(<CategoryPanel />);
      const next = screen.getByTestId('category-page-next');
      while (!next.hasAttribute('disabled')) fireEvent.click(next);
      Object.defineProperty(window, 'innerWidth', { configurable: true, value: 1280 });
      fireEvent(window, new Event('resize'));
      expect(screen.getByTestId('category-page-indicator')).toHaveTextContent('3/3');
      fireEvent.wheel(screen.getByTestId('category-strip'), { deltaX: -100 });
      expect(screen.getByTestId('category-page-indicator')).toHaveTextContent('2/3');
    } finally { Object.defineProperty(window, 'innerWidth', width); }
  });

  it.each(['grid', 'strip'])('mouse-drag pages %s safely and preserves subsequent mouse, keyboard and touch activation', surface => {
    mocks.settingsState.gridSize = 4;
    mocks.settingsState.speakSelectionFeedback = true;
    const { container } = render(<CategoryPanel />);
    const element = surface === 'strip' ? screen.getByTestId('category-strip') : container.querySelector('.aac-picture-grid')!;
    const status = screen.getByTestId(surface === 'strip' ? 'category-page-indicator' : 'vocabulary-page-indicator');
    pointer(element, 'pointerdown', 200);
    pointer(element, 'pointermove', 100);
    pointer(element, 'pointerup', 100);
    expect(status.textContent).toMatch(/^2\s*\//);
    const tile = element.querySelector('button')!;
    const activate = surface === 'strip' ? mocks.selectCategoryMock : mocks.appendTextMock;
    fireEvent.click(tile, { detail: 1 });
    expect(activate).not.toHaveBeenCalled();
    expect(mocks.speakWordMock).not.toHaveBeenCalled();
    fireEvent.click(tile, { detail: 0 });
    expect(activate).toHaveBeenCalledTimes(1);
    pointer(tile, 'pointerdown', 200);
    pointer(tile, 'pointerup', 200);
    fireEvent.click(tile, { detail: 1 });
    expect(activate).toHaveBeenCalledTimes(2);
    pointer(element, 'pointerdown', 200);
    pointer(element, 'pointermove', 100);
    pointer(element, 'pointercancel', 100);
    // A deliberate touch after an interrupted mouse drag must still work.
    pointer(tile, 'pointerdown', 200, 100, 'touch');
    fireEvent.touchStart(tile, { touches: [{ clientX: 200, clientY: 100 }] });
    fireEvent.touchEnd(tile, { touches: [], changedTouches: [{ clientX: 200, clientY: 100 }] });
    fireEvent.click(tile, { detail: 1 });
    expect(activate).toHaveBeenCalledTimes(3);
  });

  it.each(['grid', 'strip'])('wheel paging %s clamps bounds and accepts a new reverse burst and line deltas', surface => {
    mocks.settingsState.gridSize = 4;
    const { container } = render(<CategoryPanel />);
    const element = surface === 'strip' ? screen.getByTestId('category-strip') : container.querySelector('.aac-picture-grid')!;
    const status = screen.getByTestId(surface === 'strip' ? 'category-page-indicator' : 'vocabulary-page-indicator');
    const time = vi.spyOn(performance, 'now');
    try {
      let now = 1000;
      const wheel = (dx: number, mode = 0) => {
        time.mockReturnValue(now += 300);
        fireEvent.wheel(element, { deltaX: dx, deltaMode: mode });
      };
      wheel(-100);
      expect(status.textContent).toMatch(/^1\s*\//);
      wheel(3, 1);
      expect(status.textContent).toMatch(/^2\s*\//);
      wheel(-100);
      expect(status.textContent).toMatch(/^1\s*\//);
      for (let i = 0; i < 30; i++) wheel(100);
      expect(surface === 'strip' ? screen.getByTestId('category-page-next') : screen.getByRole('button', { name: 'Next page', exact: true })).toBeDisabled();
    } finally { time.mockRestore(); }
  });

  it('browses categories without selecting one, retains arrow bounds and permits intentional activation', () => {
    render(<CategoryPanel />);
    const strip = screen.getByTestId('category-strip');
    const status = screen.getByTestId('category-page-indicator');
    swipeStrip(strip, -100);
    expect(status).toHaveTextContent('2/3');
    const tile = screen.getAllByTestId('category-tile')[0];
    fireEvent.click(tile, { detail: 1 });
    expect(mocks.selectCategoryMock).not.toHaveBeenCalled();
    expect(mocks.appendTextMock).not.toHaveBeenCalled();
    expect(mocks.speakWordMock).not.toHaveBeenCalled();
    fireEvent.click(tile, { detail: 0 }); // keyboard/switch activation
    expect(mocks.selectCategoryMock).toHaveBeenCalledTimes(1);
    const touch = { clientX: 100, clientY: 100 };
    fireEvent.touchStart(tile, { touches: [touch] });
    fireEvent.touchEnd(tile, { touches: [], changedTouches: [touch] });
    fireEvent.click(tile, { detail: 1 });
    expect(mocks.selectCategoryMock).toHaveBeenCalledTimes(2);
    swipeStrip(strip, -100);
    swipeStrip(strip, -100);
    expect(status).toHaveTextContent('3/3');
    expect(screen.getByTestId('category-page-next')).toBeDisabled();
    swipeStrip(strip, 100);
    fireEvent.click(screen.getByTestId('category-page-prev'));
    swipeStrip(strip, 100);
    expect(status).toHaveTextContent('1/3');
    expect(screen.getByTestId('category-page-prev')).toBeDisabled();
    expect(screen.getByTestId('vocabulary-page-indicator')).toHaveTextContent('1 /');
  });

  it.each(['vertical', 'short', 'cancel', 'multitouch'])('does not browse categories on %s gestures', kind => {
    render(<CategoryPanel />);
    const strip = screen.getByTestId('category-strip');
    const start = { clientX: 200, clientY: 100 };
    const end = { clientX: kind === 'short' ? 180 : 100, clientY: kind === 'vertical' ? 250 : 100 };
    fireEvent.touchStart(strip, { touches: [start] });
    if (kind === 'cancel') fireEvent.touchCancel(strip);
    if (kind === 'multitouch') fireEvent.touchMove(strip, { touches: [start, end] });
    fireEvent.touchEnd(strip, { touches: [], changedTouches: [end] });
    expect(screen.getByTestId('category-page-indicator')).toHaveTextContent('1/3');
  });
});

// ── render gating ─────────────────────────────────────────────────────────────

describe('CategoryPanel — render gating', () => {
  it('renders null when sidePanel is ai-chat', () => {
    mocks.uiState.sidePanel = 'ai-chat';
    const { container } = render(<CategoryPanel />);
    expect(container.firstChild).toBeNull();
  });

  it('renders null when sidePanel is settings', () => {
    mocks.uiState.sidePanel = 'settings';
    const { container } = render(<CategoryPanel />);
    expect(container.firstChild).toBeNull();
  });

  it('renders home board when sidePanel=none', () => {
    mocks.uiState.sidePanel = 'none';
    render(<CategoryPanel />);
    expect(screen.getByRole('region', { name: /home vocabulary board/i })).toBeInTheDocument();
  });

  it('renders home board when sidePanel=categories', () => {
    mocks.uiState.sidePanel = 'categories';
    render(<CategoryPanel />);
    expect(screen.getByRole('region', { name: /home vocabulary board/i })).toBeInTheDocument();
  });
});

// ── home board ────────────────────────────────────────────────────────────────

describe('CategoryPanel — home board', () => {
  beforeEach(() => { mocks.uiState.sidePanel = 'none'; });

  it('renders phrase tiles from home grid', () => {
    render(<CategoryPanel />);
    // PhraseTile mock renders buttons with phrase text
    const tiles = screen.getAllByTestId('phrase-tile');
    expect(tiles.length).toBeGreaterThan(0);
  });

  it.each([4, 6, 9, 12, 16, 20])('renders exactly %i blocks for the selected grid size', (gridSize) => {
    mocks.settingsState.gridSize = gridSize;
    const { container } = render(<CategoryPanel />);

    expect(container.querySelectorAll('.aac-picture-grid > *')).toHaveLength(gridSize);
  });

  it.each([[4, 2, 2], [6, 3, 2], [9, 3, 3], [12, 4, 3], [16, 4, 4], [20, 5, 4]])(
    'grid %i owns %i columns and %i filling rows instead of touch CSS overrides', (size, columns, rows) => {
      mocks.settingsState.gridSize = size;
      const { container } = render(<CategoryPanel />);
      const grid = container.querySelector<HTMLElement>('.aac-picture-grid')!;
      expect(grid.style.gridTemplateColumns).toBe(`repeat(${columns}, minmax(0, 1fr))`);
      expect(grid.style.gridTemplateRows).toBe(`repeat(${rows}, minmax(0, 1fr))`);
      expect(grid.style.touchAction).toBe('pan-y pinch-zoom');
    },
  );

  it('retains all home vocabulary through bounded pages, including the final partial page', () => {
    mocks.settingsState.gridSize = 4;
    render(<CategoryPanel />);
    const pages = Number(screen.getByTestId('vocabulary-page-indicator').textContent!.split('/')[1]);
    expect(pages).toBeGreaterThan(1);
    const observed = screen.getAllByTestId('phrase-tile').map(tile => tile.textContent);
    for (let page = 1; page < pages; page++) {
      fireEvent.click(screen.getByRole('button', { name: 'Next page' }));
      observed.push(...screen.getAllByTestId('phrase-tile').map(tile => tile.textContent));
    }
    // All eight home categories use the mocked ranked phrases; not merely
    // counting pages, prove their ordered vocabulary survives page slicing.
    expect(observed).toEqual(Array.from({ length: 8 }, () => mocks.mockPhrases.map(phrase => phrase.text)).flat());
    expect(screen.getByTestId('vocabulary-page-indicator')).toHaveTextContent(`${pages} / ${pages}`);
    expect(screen.getByRole('button', { name: 'Next page' })).toBeDisabled();
    expect(screen.getAllByTestId('phrase-tile').length).toBeLessThanOrEqual(4);
    for (let page = 1; page < pages; page++) fireEvent.click(screen.getByRole('button', { name: 'Previous page' }));
    expect(screen.getByRole('button', { name: 'Previous page' })).toBeDisabled();
  });

  it('swipes without speaking or selecting a tile, then permits the next deliberate tap and keyboard activation', () => {
    mocks.settingsState.gridSize = 4;
    mocks.messageState.soundEnabled = true;
    mocks.settingsState.speakSelectionFeedback = true;
    const { container } = render(<CategoryPanel />);
    const grid = container.querySelector('.aac-picture-grid')!;
    const start = { clientX: 200, clientY: 100 };
    const end = { clientX: 100, clientY: 110 };
    fireEvent.touchStart(grid, { touches: [start] });
    fireEvent.touchMove(grid, { touches: [end] });
    fireEvent.touchEnd(grid, { touches: [], changedTouches: [end] });
    expect(screen.getByTestId('vocabulary-page-indicator')).toHaveTextContent('2 /');
    const tile = screen.getAllByTestId('phrase-tile')[0];
    fireEvent.click(tile, { detail: 1 }); // compatibility click from the swipe
    expect(mocks.appendTextMock).not.toHaveBeenCalled();
    expect(mocks.speakWordMock).not.toHaveBeenCalled();
    fireEvent.click(tile, { detail: 0 }); // switch/dwell/keyboard activation
    expect(mocks.appendTextMock).toHaveBeenCalledTimes(1);
    fireEvent.touchStart(tile, { touches: [start] });
    fireEvent.touchEnd(tile, { touches: [], changedTouches: [start] });
    fireEvent.click(tile, { detail: 1 });
    expect(mocks.appendTextMock).toHaveBeenCalledTimes(2);
  });

  it.each(['vertical', 'short', 'cancel', 'multitouch'])('does not page on %s gestures', kind => {
    mocks.settingsState.gridSize = 4;
    const { container } = render(<CategoryPanel />);
    const grid = container.querySelector('.aac-picture-grid')!;
    const start = { clientX: 200, clientY: 100 };
    const end = { clientX: kind === 'short' ? 180 : 100, clientY: kind === 'vertical' ? 250 : 100 };
    fireEvent.touchStart(grid, { touches: [start] });
    if (kind === 'cancel') fireEvent.touchCancel(grid);
    if (kind === 'multitouch') fireEvent.touchMove(grid, { touches: [start, end] });
    fireEvent.touchEnd(grid, { touches: [], changedTouches: [end] });
    expect(screen.getByTestId('vocabulary-page-indicator')).toHaveTextContent('1 /');
  });

  it('renders category tab strip with category names', () => {
    render(<CategoryPanel />);
    // fringeCats or topLevelCats appear as buttons in tab strip
    expect(screen.getAllByRole('button').length).toBeGreaterThan(0);
  });

  it('clicking a phrase tile calls appendText', () => {
    render(<CategoryPanel />);
    const tiles = screen.getAllByTestId('phrase-tile');
    fireEvent.click(tiles[0]);
    expect(mocks.appendTextMock).toHaveBeenCalled();
  });

  it('clicking a phrase tile calls learnWord', () => {
    render(<CategoryPanel />);
    fireEvent.click(screen.getAllByTestId('phrase-tile')[0]);
    expect(mocks.learnWordMock).toHaveBeenCalled();
  });

  it('clicking a phrase tile calls recordPhraseUse', () => {
    render(<CategoryPanel />);
    fireEvent.click(screen.getAllByTestId('phrase-tile')[0]);
    expect(mocks.recordUseMock).toHaveBeenCalled();
  });

  // A vocabulary tap used to speak the ACCUMULATED message ("I yes"). That is
  // message speech — the public utterance to a partner — produced without the
  // user choosing to produce it, and a partial message can invert the meaning
  // of the finished one. A selection may confirm the ITEM selected, and only
  // when the user has asked for auditory feedback. Message speech is on Speak.
  it('says nothing on a phrase tap by default', () => {
    mocks.messageState.text = 'I';
    mocks.messageState.autoSpeak = true;
    render(<CategoryPanel />);

    fireEvent.click(screen.getAllByTestId('phrase-tile')[0]);

    expect(mocks.speakWordMock).not.toHaveBeenCalled();
    expect(mocks.aacSpeakMock).not.toHaveBeenCalled();
  });

  it('speaks only the tile just tapped when auditory feedback is enabled', () => {
    mocks.messageState.text = 'I';
    mocks.messageState.autoSpeak = true;
    mocks.settingsState.speakSelectionFeedback = true;
    render(<CategoryPanel />);

    fireEvent.click(screen.getAllByTestId('phrase-tile')[0]);

    // "yes" — the selection. NOT "I yes", the running message.
    expect(mocks.speakWordMock).toHaveBeenCalledWith('yes', 1, 1);
    expect(mocks.aacSpeakMock).not.toHaveBeenCalled();
  });

  it('speaks only the tile just tapped in translation mode', () => {
    mocks.messageState.text = 'I';
    mocks.messageState.autoSpeak = true;
    mocks.settingsState.speakSelectionFeedback = true;
    mocks.settingsState.outputLanguage = 'es';
    render(<CategoryPanel />);

    fireEvent.click(screen.getAllByTestId('phrase-tile')[0]);

    expect(mocks.speakWordMock).not.toHaveBeenCalled();
    expect(mocks.aacSpeakMock).toHaveBeenCalledWith('yes', 1, 1, undefined, true);
  });

  it('does not duplicate Home navigation while already on the Home board', () => {
    render(<CategoryPanel />);
    expect(screen.queryByRole('button', { name: /home/i })).not.toBeInTheDocument();
    expect(mocks.closeSidePanelMock).not.toHaveBeenCalled();
  });
});

// ── category detail ───────────────────────────────────────────────────────────

describe('CategoryPanel — category detail', () => {
  beforeEach(() => {
    mocks.uiState.sidePanel = 'category-detail';
    mocks.uiState.activeCategoryId = 'quick-talk';
  });

  it('renders the active category section', () => {
    render(<CategoryPanel />);
    // The detail view renders a <section> with aria-label = category name
    const section = document.querySelector('section[aria-label="quick-talk"]')
      ?? document.querySelector('section');
    expect(section).toBeInTheDocument();
  });

  it('clicking a phrase tile in detail view calls appendText', () => {
    render(<CategoryPanel />);
    const tiles = screen.getAllByTestId('phrase-tile');
    fireEvent.click(tiles[0]);
    expect(mocks.appendTextMock).toHaveBeenCalled();
  });

  it('shows one Home button in category detail and returns to Home', () => {
    render(<CategoryPanel />);
    const homeButton = screen.getByRole('button', { name: /home/i });
    fireEvent.click(homeButton);
    expect(mocks.closeSidePanelMock).toHaveBeenCalledOnce();
  });
});

// ── search ────────────────────────────────────────────────────────────────────

describe('CategoryPanel — search', () => {
  beforeEach(() => { mocks.uiState.sidePanel = 'none'; });

  it('clicking Search sidebar button opens search input', () => {
    render(<CategoryPanel />);
    fireEvent.click(screen.getByRole('button', { name: /search/i }));
    expect(screen.getByRole('textbox', { name: /search all vocabulary/i })).toBeInTheDocument();
  });

  it('typing in search box shows matching results', async () => {
    render(<CategoryPanel />);
    fireEvent.click(screen.getByRole('button', { name: /search/i }));
    const input = screen.getByRole('textbox', { name: /search all vocabulary/i });
    fireEvent.change(input, { target: { value: 'yes' } });
    await waitFor(() => {
      // Multiple categories may each return a 'yes' phrase → use getAllByText
      expect(screen.getAllByText('yes').length).toBeGreaterThan(0);
    });
  });

  it('clicking ✕ closes search', () => {
    render(<CategoryPanel />);
    fireEvent.click(screen.getByRole('button', { name: /search/i }));
    expect(screen.getByRole('textbox', { name: /search all vocabulary/i })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '✕' }));
    expect(screen.queryByRole('textbox', { name: /search all vocabulary/i })).toBeNull();
  });
});

// ── data-maximized attribute on keyboard-shell (guards landscape CSS fix) ──────

describe('CategoryPanel — keyboard-shell data-maximized attribute', () => {
  it('keyboard-shell has data-maximized when keyboardMaximized=true', () => {
    mocks.uiState.sidePanel = 'none';
    mocks.uiState.categoryKeyboardOpen = true;
    mocks.uiState.keyboardMaximized = true;
    render(<CategoryPanel />);
    const shell = screen.getByTestId('keyboard-shell');
    expect(shell).toHaveAttribute('data-maximized');
    expect(shell).toHaveClass('aac-typing-keyboard-shell');
  });

  it('legacy mixed flags fail safe to Picture mode instead of rendering a partial board and keyboard', () => {
    mocks.uiState.sidePanel = 'none';
    mocks.uiState.categoryKeyboardOpen = true;
    mocks.uiState.keyboardMaximized = false;
    render(<CategoryPanel />);
    expect(screen.queryByTestId('keyboard-shell')).toBeNull();
    expect(screen.getAllByTestId('phrase-tile').length).toBeGreaterThan(0);
  });

  it('Typing mode hides picture cards but keeps a clear return control', () => {
    mocks.uiState.sidePanel = 'category-detail';
    mocks.uiState.activeCategoryId = 'feelings';
    mocks.uiState.categoryPath = ['feelings'];
    mocks.uiState.categoryKeyboardOpen = true;
    mocks.uiState.keyboardMaximized = true;
    render(<CategoryPanel />);
    expect(screen.queryByTestId('phrase-tile')).toBeNull();
    expect(screen.getByTestId('keyboard-shell')).toBeInTheDocument();
    expect(screen.getByTestId('kb-cycle-btn')).toBeInTheDocument();
  });

  it('sidebar visible when keyboard NOT maximized in category-detail', () => {
    mocks.uiState.sidePanel = 'category-detail';
    mocks.uiState.activeCategoryId = 'feelings';
    mocks.uiState.categoryPath = ['feelings'];
    mocks.uiState.categoryKeyboardOpen = false;
    mocks.uiState.keyboardMaximized = false;
    render(<CategoryPanel />);
    expect(screen.getByTestId('kb-cycle-btn')).toBeInTheDocument();
  });
});

// ── landscape auto-maximize must not clobber the saved preference ────────────

describe('CategoryPanel — landscape keyboard maximize', () => {
  const enterLandscape = () => {
    window.matchMedia = vi.fn().mockReturnValue({
      matches: true, addEventListener: vi.fn(), removeEventListener: vi.fn(),
    });
    Object.defineProperty(window, 'innerHeight', { value: 390, configurable: true });
  };

  it('does not write prism-kb-max when landscape auto-maximizes', () => {
    localStorage.setItem('prism-kb-max', 'false');
    mocks.uiState.sidePanel = 'none';
    mocks.uiState.categoryKeyboardOpen = true;
    enterLandscape();

    render(<CategoryPanel />);

    // The user's own preference must survive a rotation. Persisting 'true'
    // here left the phrase grid hidden after rotating back to portrait.
    expect(localStorage.getItem('prism-kb-max')).toBe('false');
  });
});
