/**
 * SettingsModal — render gating, PIN gate, section visibility, and
 * settings interaction tests.
 *
 * Covers: render guard (showSettings=false/true), caregiver PIN gate,
 * backdrop/close-button toggleSettings, grid-size selection, theme
 * aria-pressed state, category visibility toggles, account section
 * loading/signed-in/signed-out states, high-contrast toggle, AI
 * autocorrect toggle, custom category add form, notifications toggle.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import SettingsModal from '@/components/SettingsModal';

// ── vi.hoisted: create mocks before vi.mock() factories run ───────────────────

const mocks = vi.hoisted(() => {
  // Mutable state objects shared across tests
  const uiState = {
    showSettings: false as boolean,
    toggleSettings: vi.fn(),
    toggleCategoryManager: vi.fn(),
  };
  const settingsState = {
    gridSize: 9 as number,
    theme: 'light' as string,
    speechRate: 0.8 as number,
    speechVolume: 1.0 as number,
    language: 'en' as string,
    activeVocabSet: 'all' as string,
    highContrast: false as boolean,
    notificationsEnabled: false as boolean,
    aiAutocorrectEnabled: true as boolean,
    mathHoldTimeMs: 0 as number,
    mathTwoHitMagnify: false as boolean,
    showHandCalibration: false as boolean,
    caregiverPinHash: undefined as string | undefined,
    setTheme: vi.fn(),
    update: vi.fn(),
  };
  const categoryState = {
    customCategories: [] as Array<{ id: string; name: string; icon: string }>,
    customPhrases: [] as Array<{ id: string; text: string; categoryId: string; deletedAt?: number }>,
    hiddenCategoryIds: [] as string[],
    hiddenPhraseIds: [] as string[],
    addCustomCategory: vi.fn(),
    removeCustomCategory: vi.fn(),
    addCustomPhrase: vi.fn(),
    removeCustomPhrase: vi.fn(),
    allCategories: (_?: boolean) => [
      { id: 'feelings', name: 'Feelings', icon: '😊', parentId: null },
    ],
    hideCategoryId: vi.fn(),
    unhideCategoryId: vi.fn(),
    hideDefaultPhrase: vi.fn(),
    unhideDefaultPhrase: vi.fn(),
  };
  const authState = {
    profile: null as null | { email: string; name: string; plan: 'free' | 'standard' | 'advanced' | 'enterprise'; isPlatformAdmin: boolean },
    loaded: true as boolean,
    loading: false as boolean,
    refresh: vi.fn(),
  };

  const useUIStore = Object.assign(
    (sel?: (s: typeof uiState) => unknown) => sel ? sel(uiState) : uiState,
    { getState: () => uiState },
  );
  const useSettingsStore = Object.assign(
    (sel?: (s: typeof settingsState) => unknown) => sel ? sel(settingsState) : settingsState,
    { getState: () => settingsState },
  );
  const useCategoryStore = Object.assign(
    (sel?: (s: typeof categoryState) => unknown) => sel ? sel(categoryState) : categoryState,
    { getState: () => categoryState },
  );
  const useAuthStore = Object.assign(
    (sel?: (s: typeof authState) => unknown) => sel ? sel(authState) : authState,
    { getState: () => authState },
  );

  return { uiState, settingsState, categoryState, authState, useUIStore, useSettingsStore, useCategoryStore, useAuthStore };
});

// ── module mocks ──────────────────────────────────────────────────────────────

vi.mock('@/store/uiStore',       () => ({ useUIStore:       mocks.useUIStore       }));
vi.mock('@/store/settingsStore', () => ({ useSettingsStore: mocks.useSettingsStore }));
vi.mock('@/store/categoryStore', () => ({ useCategoryStore: mocks.useCategoryStore }));
vi.mock('@/store/authStore',     () => ({ useAuthStore:     mocks.useAuthStore     }));

vi.mock('@/services/aiService', () => ({
  synaluxSignInUrl:  () => 'https://synalux.ai/sign-in',
  synaluxSignOutUrl: () => 'https://synalux.ai/sign-out',
}));

vi.mock('@/engine/i18n', () => ({
  LANG_META: [
    { code: 'en', name: 'English', nativeName: 'English', rtl: false, ttsCode: 'en-US', flag: '🇺🇸' },
    { code: 'es', name: 'Spanish', nativeName: 'Español', rtl: false, ttsCode: 'es-ES', flag: '🇪🇸' },
  ],
}));

vi.mock('@/engine/useT', () => ({
  useT: () => ({ t: (k: string) => k, ttsCode: 'en-US', rtl: false, ready: true }),
}));

vi.mock('@/constants/vocabularySets', () => ({
  VOCAB_SETS: [
    { id: 'all',     nameKey: 'vs_all',  descKey: 'vs_all_desc',  icon: '📋', tier: 'free',     categoryIds: [] },
    { id: 'my-core', nameKey: 'vs_core', descKey: 'vs_core_desc', icon: '⭐', tier: 'standard', categoryIds: [] },
  ],
}));

vi.mock('@/constants/phrases', () => ({
  DEFAULT_PHRASES: [
    { id: 'ph1', text: 'yes', categoryId: 'feelings' },
    { id: 'ph2', text: 'no',  categoryId: 'feelings' },
  ],
}));

vi.mock('@/constants/phraseTranslations', () => ({
  getPhraseText: (_id: string, _lang: string, text: string) => text,
}));

vi.mock('@/services/feedback', () => ({ tapFeedback: vi.fn() }));

vi.mock('@/services/handProfileService', () => ({
  getActiveProfile:            () => ({ id: 'default', name: 'Default' }),
  loadProfiles:                () => [{ id: 'default', name: 'Default' }],
  deleteProfile:               vi.fn(),
  setActiveProfile:            vi.fn(),
  enableContinuousLearning:    vi.fn(),
  disableContinuousLearning:   vi.fn(),
  isContinuousLearningActive:  () => false,
}));

// Stub all child components so they don't bring in heavy deps
vi.mock('@/components/HeadTrackingSettings',      () => ({ default: () => <div data-testid="head-tracking-settings" /> }));
vi.mock('@/components/LocalAISettings',           () => ({ default: () => <div data-testid="local-ai-settings" /> }));
vi.mock('@/components/HandCalibration',           () => ({ default: ({ onClose }: { onClose: () => void }) => <button onClick={onClose}>CloseCalibration</button> }));
vi.mock('@/components/InputModesSettings',        () => ({ default: () => <div data-testid="input-modes-settings" /> }));
vi.mock('@/components/ToolbarCustomization',      () => ({ default: () => <div data-testid="toolbar-customization" /> }));
vi.mock('@/components/VoicePicker',               () => ({ default: () => <div data-testid="voice-picker" /> }));
vi.mock('@/components/CaregiverContactsSettings', () => ({ default: () => <div data-testid="caregiver-contacts" /> }));
vi.mock('@/components/PinPad', () => ({
  default: ({ onVerify, onSetPin }: { onVerify: (v: boolean) => void; onSetPin: (h: string) => void }) => (
    <div data-testid="pin-pad">
      <button onClick={() => onVerify(true)}>VerifyPIN</button>
      <button onClick={() => onSetPin('hash123')}>SetPIN</button>
    </div>
  ),
}));

// ── shared reset ──────────────────────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks();
  mocks.uiState.showSettings = false;
  mocks.settingsState.gridSize = 9;
  mocks.settingsState.theme = 'light';
  mocks.settingsState.caregiverPinHash = undefined;
  mocks.settingsState.highContrast = false;
  mocks.settingsState.aiAutocorrectEnabled = true;
  mocks.settingsState.notificationsEnabled = false;
  mocks.settingsState.activeVocabSet = 'all';
  mocks.settingsState.showHandCalibration = false;
  mocks.categoryState.customCategories = [];
  mocks.categoryState.hiddenCategoryIds = [];
  mocks.authState.profile = null;
  mocks.authState.loaded = true;
  mocks.authState.loading = false;
});

// ── render gating ─────────────────────────────────────────────────────────────

describe('SettingsModal — render gating', () => {
  it('renders nothing when showSettings=false', () => {
    const { container } = render(<SettingsModal />);
    expect(container.firstChild).toBeNull();
  });

  it('renders dialog when showSettings=true', () => {
    mocks.uiState.showSettings = true;
    render(<SettingsModal />);
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });
});

// ── caregiver PIN gate ────────────────────────────────────────────────────────

describe('SettingsModal — PIN gate', () => {
  beforeEach(() => { mocks.uiState.showSettings = true; });

  it('shows PinPad (not main settings) when caregiverPinHash is set', () => {
    mocks.settingsState.caregiverPinHash = 'hash-abc';
    render(<SettingsModal />);
    // PIN gate renders PinPad, not the regular settings dialog
    expect(screen.getByTestId('pin-pad')).toBeInTheDocument();
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('shows main settings (no PIN gate) when caregiverPinHash is undefined', () => {
    mocks.settingsState.caregiverPinHash = undefined;
    render(<SettingsModal />);
    expect(screen.queryByTestId('pin-pad')).toBeNull();
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  it('PIN gate shows "Enter your PIN" message', () => {
    mocks.settingsState.caregiverPinHash = 'hash-abc';
    render(<SettingsModal />);
    expect(screen.getByText(/enter your pin/i)).toBeInTheDocument();
  });
});

// ── close / backdrop ──────────────────────────────────────────────────────────

describe('SettingsModal — close actions', () => {
  beforeEach(() => { mocks.uiState.showSettings = true; });

  it('close button (✕) calls toggleSettings', () => {
    render(<SettingsModal />);
    fireEvent.click(screen.getByRole('button', { name: /close_settings/i }));
    expect(mocks.uiState.toggleSettings).toHaveBeenCalledOnce();
  });

  it('backdrop click does NOT close settings (prevents accidental dwell-click dismissal)', () => {
    render(<SettingsModal />);
    fireEvent.click(screen.getByRole('dialog'));
    expect(mocks.uiState.toggleSettings).not.toHaveBeenCalled();
  });
});

// ── grid size section ─────────────────────────────────────────────────────────

describe('SettingsModal — grid size section', () => {
  beforeEach(() => { mocks.uiState.showSettings = true; });

  it('renders grid size buttons 4, 6, 9, 12, 16, 20', () => {
    render(<SettingsModal />);
    for (const size of [4, 6, 9, 12, 16, 20]) {
      expect(screen.getByRole('button', { name: String(size) })).toBeInTheDocument();
    }
  });

  it('clicking a grid size button calls update with the selected size', () => {
    render(<SettingsModal />);
    fireEvent.click(screen.getByRole('button', { name: '12' }));
    expect(mocks.settingsState.update).toHaveBeenCalledWith(expect.objectContaining({ gridSize: 12 }));
  });
});

// ── theme section ─────────────────────────────────────────────────────────────

describe('SettingsModal — theme section', () => {
  beforeEach(() => { mocks.uiState.showSettings = true; });

  it('Light button has aria-pressed=true when theme=light', () => {
    mocks.settingsState.theme = 'light';
    render(<SettingsModal />);
    const lightBtn = screen.getByRole('button', { name: /light/i });
    expect(lightBtn).toHaveAttribute('aria-pressed', 'true');
  });

  it('Dark button has aria-pressed=false when theme=light', () => {
    mocks.settingsState.theme = 'light';
    render(<SettingsModal />);
    const darkBtn = screen.getByRole('button', { name: /dark/i });
    expect(darkBtn).toHaveAttribute('aria-pressed', 'false');
  });

  it('clicking Dark button calls setTheme("dark")', () => {
    render(<SettingsModal />);
    fireEvent.click(screen.getByRole('button', { name: /dark/i }));
    expect(mocks.settingsState.setTheme).toHaveBeenCalledWith('dark');
  });

  it('clicking Light button calls setTheme("light")', () => {
    mocks.settingsState.theme = 'dark';
    render(<SettingsModal />);
    fireEvent.click(screen.getByRole('button', { name: /light/i }));
    expect(mocks.settingsState.setTheme).toHaveBeenCalledWith('light');
  });
});

// ── category visibility ───────────────────────────────────────────────────────

describe('SettingsModal — category visibility toggles', () => {
  beforeEach(() => { mocks.uiState.showSettings = true; });

  it('renders category name in visibility list', () => {
    render(<SettingsModal />);
    expect(screen.getByText(/feelings/i)).toBeInTheDocument();
  });

  it('clicking visible category toggle calls hideCategoryId', () => {
    render(<SettingsModal />);
    fireEvent.click(screen.getByRole('button', { name: /feelings visibility/i }));
    expect(mocks.categoryState.hideCategoryId).toHaveBeenCalledWith('feelings');
  });

  it('clicking hidden category toggle calls unhideCategoryId', () => {
    mocks.categoryState.hiddenCategoryIds = ['feelings'];
    render(<SettingsModal />);
    fireEvent.click(screen.getByRole('button', { name: /feelings visibility/i }));
    expect(mocks.categoryState.unhideCategoryId).toHaveBeenCalledWith('feelings');
  });
});

// ── high contrast + AI autocorrect toggles ────────────────────────────────────

describe('SettingsModal — accessibility toggles', () => {
  beforeEach(() => { mocks.uiState.showSettings = true; });

  function openAccessibility() {
    // Section title is "accessibility & Input Modes" (collapsed by default)
    fireEvent.click(screen.getByRole('button', { name: /accessibility/i }));
  }

  it('High contrast toggle has aria-pressed=false when disabled', () => {
    mocks.settingsState.highContrast = false;
    render(<SettingsModal />);
    openAccessibility();
    const btn = screen.getByRole('button', { name: /high_contrast/i });
    expect(btn).toHaveAttribute('aria-pressed', 'false');
  });

  it('High contrast toggle has aria-pressed=true when enabled', () => {
    mocks.settingsState.highContrast = true;
    render(<SettingsModal />);
    openAccessibility();
    expect(screen.getByRole('button', { name: /high_contrast/i })).toHaveAttribute('aria-pressed', 'true');
  });

  it('clicking high contrast toggle calls update with toggled value', () => {
    mocks.settingsState.highContrast = false;
    render(<SettingsModal />);
    openAccessibility();
    fireEvent.click(screen.getByRole('button', { name: /high_contrast/i }));
    expect(mocks.settingsState.update).toHaveBeenCalledWith(expect.objectContaining({ highContrast: true }));
  });

  it('AI Autocorrect toggle calls update with toggled value', () => {
    mocks.settingsState.aiAutocorrectEnabled = true;
    render(<SettingsModal />);
    openAccessibility();
    fireEvent.click(screen.getByRole('button', { name: /ai autocorrect/i }));
    expect(mocks.settingsState.update).toHaveBeenCalledWith(expect.objectContaining({ aiAutocorrectEnabled: false }));
  });
});

// ── account section ───────────────────────────────────────────────────────────

describe('SettingsModal — account section', () => {
  beforeEach(() => { mocks.uiState.showSettings = true; });

  it('shows "checking_sign_in" while profile is loading', () => {
    mocks.authState.loaded = false;
    mocks.authState.loading = true;
    render(<SettingsModal />);
    // Need to open the Account section (it's collapsed by default)
    const accountSection = screen.getByRole('button', { name: /synalux_account/i });
    fireEvent.click(accountSection);
    expect(screen.getByText('checking_sign_in')).toBeInTheDocument();
  });

  it('shows sign-in link when not signed in', () => {
    mocks.authState.loaded = true;
    mocks.authState.profile = null;
    render(<SettingsModal />);
    const accountSection = screen.getByRole('button', { name: /synalux_account/i });
    fireEvent.click(accountSection);
    expect(screen.getByTestId('synalux-signin')).toBeInTheDocument();
  });

  it('shows email when signed in', () => {
    mocks.authState.profile = {
      email: 'test@example.com', name: 'Test User',
      plan: 'free', isPlatformAdmin: false,
    };
    render(<SettingsModal />);
    const accountSection = screen.getByRole('button', { name: /synalux_account/i });
    fireEvent.click(accountSection);
    expect(screen.getByText('test@example.com')).toBeInTheDocument();
  });

  it('shows plan label when signed in', () => {
    mocks.authState.profile = {
      email: 'test@example.com', name: 'Test User',
      plan: 'standard', isPlatformAdmin: false,
    };
    render(<SettingsModal />);
    const accountSection = screen.getByRole('button', { name: /synalux_account/i });
    fireEvent.click(accountSection);
    expect(screen.getByText('plan_standard')).toBeInTheDocument();
  });
});

// ── custom categories form ────────────────────────────────────────────────────

describe('SettingsModal — custom category add form', () => {
  beforeEach(() => { mocks.uiState.showSettings = true; });

  it('renders category name input and add button', () => {
    render(<SettingsModal />);
    // Open Custom Categories section
    fireEvent.click(screen.getByRole('button', { name: /custom categories/i }));
    expect(screen.getByPlaceholderText('category_name')).toBeInTheDocument();
  });

  it('typing name and clicking Add calls addCustomCategory', () => {
    render(<SettingsModal />);
    fireEvent.click(screen.getByRole('button', { name: /custom categories/i }));
    fireEvent.change(screen.getByPlaceholderText('category_name'), { target: { value: 'Sports' } });
    // Click the Add button (last one in the form)
    const addBtns = screen.getAllByRole('button', { name: 'add' });
    fireEvent.click(addBtns[0]);
    expect(mocks.categoryState.addCustomCategory).toHaveBeenCalledWith('Sports', expect.any(String));
  });

  it('empty name does NOT call addCustomCategory', () => {
    render(<SettingsModal />);
    fireEvent.click(screen.getByRole('button', { name: /custom categories/i }));
    const addBtns = screen.getAllByRole('button', { name: 'add' });
    fireEvent.click(addBtns[0]);
    expect(mocks.categoryState.addCustomCategory).not.toHaveBeenCalled();
  });

  it('shows custom categories with remove button', () => {
    mocks.categoryState.customCategories = [{ id: 'sports', name: 'Sports', icon: '⚽' }];
    render(<SettingsModal />);
    fireEvent.click(screen.getByRole('button', { name: /custom categories/i }));
    expect(screen.getByText('⚽ Sports')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'remove' })).toBeInTheDocument();
  });

  it('clicking Remove calls removeCustomCategory', () => {
    mocks.categoryState.customCategories = [{ id: 'sports', name: 'Sports', icon: '⚽' }];
    render(<SettingsModal />);
    fireEvent.click(screen.getByRole('button', { name: /custom categories/i }));
    fireEvent.click(screen.getByRole('button', { name: 'remove' }));
    expect(mocks.categoryState.removeCustomCategory).toHaveBeenCalledWith('sports');
  });
});

// ── caregiver PIN section ─────────────────────────────────────────────────────

describe('SettingsModal — caregiver PIN section', () => {
  beforeEach(() => { mocks.uiState.showSettings = true; });

  it('shows "No PIN set" when caregiverPinHash is undefined', () => {
    mocks.settingsState.caregiverPinHash = undefined;
    render(<SettingsModal />);
    fireEvent.click(screen.getByRole('button', { name: /caregiver pin/i }));
    expect(screen.getByText(/no pin set/i)).toBeInTheDocument();
  });

  it('shows "PIN is set" when caregiverPinHash is configured', () => {
    mocks.settingsState.caregiverPinHash = 'hash-abc';
    // Bypass PIN gate: set caregiverPinHash AFTER initial render guard
    // Actually the PIN gate intercepts before the main dialog renders.
    // So we need to test by directly checking the pre-gate render, not the settings dialog.
    // Re-render after "verifying" PIN: in the PinPad mock, clicking VerifyPIN calls onVerify(true).
    render(<SettingsModal />);
    // Click VerifyPIN to pass the gate
    fireEvent.click(screen.getByRole('button', { name: 'VerifyPIN' }));
    // Now we should be past the gate and in the main settings
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /caregiver pin/i }));
    expect(screen.getByText(/pin is set/i)).toBeInTheDocument();
  });
});

// ── notifications toggle ──────────────────────────────────────────────────────

describe('SettingsModal — notifications toggle', () => {
  beforeEach(() => { mocks.uiState.showSettings = true; });

  it('notifications toggle calls update with toggled value', () => {
    mocks.settingsState.notificationsEnabled = false;
    render(<SettingsModal />);
    // Open Contacts section
    fireEvent.click(screen.getByRole('button', { name: /contacts/i }));
    fireEvent.click(screen.getByRole('button', { name: /alarm on new message/i }));
    expect(mocks.settingsState.update).toHaveBeenCalledWith(expect.objectContaining({ notificationsEnabled: true }));
  });
});

// ── vocab set section ─────────────────────────────────────────────────────────

describe('SettingsModal — vocab set section', () => {
  beforeEach(() => { mocks.uiState.showSettings = true; });

  it('selected vocab set button has aria-pressed=true', () => {
    mocks.settingsState.activeVocabSet = 'all';
    render(<SettingsModal />);
    fireEvent.click(screen.getByRole('button', { name: /vocab_set/i }));
    const btn = screen.getByRole('button', { name: /vs_all/i });
    expect(btn).toHaveAttribute('aria-pressed', 'true');
  });

  it('clicking vocab set calls update with that id', () => {
    render(<SettingsModal />);
    fireEvent.click(screen.getByRole('button', { name: /vocab_set/i }));
    fireEvent.click(screen.getByRole('button', { name: /vs_core/i }));
    expect(mocks.settingsState.update).toHaveBeenCalledWith(expect.objectContaining({ activeVocabSet: 'my-core' }));
  });
});
