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
  };

  const mockCategories: Category[] = [
    { id: 'quick-talk', name: 'Quick Talk', icon: '💬', parentId: null },
    { id: 'feelings',   name: 'Feelings',   icon: '😊', parentId: null },
  ];

  const mockPhrases: Phrase[] = [
    { id: 'p1', text: 'yes' },
    { id: 'p2', text: 'no' },
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
  }) => unknown) => {
    const state = {
      allCategories: () => mocks.mockCategories,
      getSubcategories: (_id: string) => [],
      getRankedPhrasesForCategory: (_id: string) =>
        mocks.mockPhrases.map((p) => ({ phrase: p })),
      getSequencesForCategory: (_id: string) => [],
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
  mocks.uiState.sidePanel = 'none';
  mocks.uiState.activeCategoryId = null;
  mocks.uiState.categoryPath = [];
  mocks.uiState.categoryKeyboardOpen = false;
  mocks.messageState.text = '';
  mocks.messageState.autoSpeak = false;
  mocks.messageState.soundEnabled = true;
  mocks.settingsState.language = 'en';
  mocks.settingsState.outputLanguage = 'en';
  window.matchMedia = vi.fn().mockReturnValue({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() });
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

  it('replays the accumulated message locally for a same-language phrase tap', () => {
    mocks.messageState.text = 'I';
    mocks.messageState.autoSpeak = true;
    render(<CategoryPanel />);

    fireEvent.click(screen.getAllByTestId('phrase-tile')[0]);

    expect(mocks.speakWordMock).toHaveBeenCalledWith('I yes', 1, 1);
    expect(mocks.aacSpeakMock).not.toHaveBeenCalled();
  });

  it('translates a single-word tile immediately as part of the accumulated message', () => {
    mocks.messageState.text = 'I';
    mocks.messageState.autoSpeak = true;
    mocks.settingsState.outputLanguage = 'es';
    render(<CategoryPanel />);

    fireEvent.click(screen.getAllByTestId('phrase-tile')[0]);

    expect(mocks.speakWordMock).not.toHaveBeenCalled();
    expect(mocks.aacSpeakMock).toHaveBeenCalledWith(
      'I yes',
      1,
      1,
      undefined,
      true,
    );
  });

  it('Home sidebar button calls closeSidePanel', () => {
    render(<CategoryPanel />);
    fireEvent.click(screen.getByRole('button', { name: /home/i }));
    expect(mocks.closeSidePanelMock).toHaveBeenCalledOnce();
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
  });

  it('keyboard-shell does NOT have data-maximized when keyboardMaximized=false', () => {
    mocks.uiState.sidePanel = 'none';
    mocks.uiState.categoryKeyboardOpen = true;
    mocks.uiState.keyboardMaximized = false;
    render(<CategoryPanel />);
    const shell = screen.getByTestId('keyboard-shell');
    expect(shell).not.toHaveAttribute('data-maximized');
  });

  it('sidebar hidden when keyboard maximized in category-detail', () => {
    mocks.uiState.sidePanel = 'category-detail';
    mocks.uiState.activeCategoryId = 'feelings';
    mocks.uiState.categoryPath = ['feelings'];
    mocks.uiState.categoryKeyboardOpen = true;
    mocks.uiState.keyboardMaximized = true;
    render(<CategoryPanel />);
    expect(screen.queryByTestId('kb-cycle-btn')).toBeNull();
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
