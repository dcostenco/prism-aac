/**
 * Swahili, Amharic and Bengali hide the tiles no native speaker has reviewed (constants/translationReviewStatus.ts),
 * which left 40 folders (Animals, Food, People, Places, Colors, Time ...) opening onto an empty grid. A folder whose
 * every built-in tile is hidden now stays in its place (tap positions never move), dimmed with a lock, and opens to
 * the note that explains the gate with a button to Settings, where a caregiver can turn "show unreviewed words" on.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';

vi.mock('@/services/aacSpeak', () => ({ aacSpeak: vi.fn() }));
vi.mock('@/services/speechService', () => ({ speakWord: vi.fn(), stopSpeech: vi.fn() }));
vi.mock('@/services/azureTTS', () => ({ warmupAzureAudio: vi.fn() }));
vi.mock('@/lib/datadog', () => ({ ddAction: vi.fn() }));

const { useSettingsStore } = await import('@/store/settingsStore');
const { useCategoryStore } = await import('@/store/categoryStore');
const { useUIStore } = await import('@/store/uiStore');
const { default: CategoryPanel } = await import('@/components/CategoryPanel');
const sw = (await import('@/i18n/sw.json')).default as Record<string, string>;
const { loadLanguage } = await import('@/engine/i18n');
// the app loads a language's interface strings before it renders in that language
await loadLanguage('sw');

const { TEMPLATE_ORDERING_SEQUENCES } = await import('@/constants/orderingSequences');

const locked = (id: string) => useCategoryStore.getState().isCategoryLocked(id);

beforeEach(() => {
  // jsdom has no media queries; the panel asks for orientation and pointer type
  window.matchMedia = ((query: string) => ({
    matches: false, media: query, onchange: null, addListener: () => {}, removeListener: () => {},
    addEventListener: () => {}, removeEventListener: () => {}, dispatchEvent: () => false,
  })) as unknown as typeof window.matchMedia;
  // the app seeds the template ordering flows on start
  useCategoryStore.setState({ orderingSequences: [...TEMPLATE_ORDERING_SEQUENCES], seeded: true });
  useSettingsStore.setState({ language: 'sw', showUnreviewedVocabulary: false });
});
afterEach(() => {
  useSettingsStore.setState({ language: 'en', showUnreviewedVocabulary: false });
  useUIStore.setState({ sidePanel: 'none', activeCategoryId: null, showSettings: false });
});

describe('which folders the review gate locks', () => {
  it.each(['animals', 'colors', 'people-social', 'animals-farm'])('Swahili "%s" is locked: every tile in it is hidden', (id) => {
    expect(locked(id)).toBe(true);
  });

  it.each(['core-verbs', 'feelings', 'help-needs'])('Swahili "%s" is not: its tiles are reviewed', (id) => {
    expect(locked(id)).toBe(false);
  });

  it('a folder with an ordering flow is not locked (the flow is still usable)', () => {
    expect(useCategoryStore.getState().getSequencesForCategory('food-ordering').length).toBeGreaterThan(0);
    expect(locked('food-ordering')).toBe(false);
  });

  it('nothing is locked once a caregiver turns on "show unreviewed words"', () => {
    useSettingsStore.setState({ showUnreviewedVocabulary: true });
    expect(locked('animals')).toBe(false);
  });

  it('a reviewed language never locks a folder', () => {
    useSettingsStore.setState({ language: 'ro' });
    expect(locked('animals')).toBe(false);
  });
});

describe('a locked folder in the app', () => {
  it('stays in the folder strip, dimmed with a lock', () => {
    useUIStore.setState({ sidePanel: 'categories', activeCategoryId: null, categoryKeyboardOpen: false, keyboardMaximized: false });
    render(<CategoryPanel />);
    // the first strip page holds the reviewed core folders; page on to the fringe folders
    let strip = screen.getAllByTestId('category-tile');
    const seen = [...strip];
    for (let page = 0; page < 10 && !strip.some((b) => b.getAttribute('data-locked') === 'true'); page += 1) {
      const next = screen.queryByTestId('category-page-next');
      if (!next || next.hasAttribute('disabled')) break;
      fireEvent.click(next);
      strip = screen.getAllByTestId('category-tile');
      seen.push(...strip);
    }
    const lockedTiles = strip.filter((b) => b.getAttribute('data-locked') === 'true');
    expect(lockedTiles.length, 'a folder whose tiles are all hidden is still offered, dimmed').toBeGreaterThan(0);
    expect(lockedTiles[0]).toHaveClass('opacity-50');
    expect(lockedTiles[0].textContent).toContain('🔒');
    expect(seen.some((b) => !b.hasAttribute('data-locked')), 'reviewed folders are not dimmed').toBe(true);
  });

  it('opens to the note and a Settings button instead of an empty grid', () => {
    useUIStore.setState({ sidePanel: 'category-detail', activeCategoryId: 'animals', showSettings: false, categoryKeyboardOpen: false, keyboardMaximized: false });
    render(<CategoryPanel />);
    const note = screen.getByTestId('unreviewed-folder-note');
    expect(note).toHaveTextContent(sw.show_unreviewed_words_desc);
    fireEvent.click(screen.getByTestId('unreviewed-folder-settings'));
    expect(useUIStore.getState().showSettings).toBe(true);
  });

  it('opens to its tiles when the caregiver has turned them on', () => {
    useSettingsStore.setState({ showUnreviewedVocabulary: true });
    useUIStore.setState({ sidePanel: 'category-detail', activeCategoryId: 'animals', categoryKeyboardOpen: false, keyboardMaximized: false });
    render(<CategoryPanel />);
    expect(screen.queryByTestId('unreviewed-folder-note')).toBeNull();
    // the folder's own sub-folders (Pets, Farm Animals ...) and tiles are on the grid again
    expect(screen.getByTestId('picture-board').querySelectorAll('button').length).toBeGreaterThan(0);
  });
});
