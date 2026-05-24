/**
 * CategoryManagerModal — category visibility, add/remove, close tests
 *
 * Covers: render gating, dialog role, close button, backdrop click,
 * category list with visibility toggles, hide/unhide calls, add subfolder
 * inline form, add top-level form, remove custom category button.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import CategoryManagerModal from '@/components/CategoryManagerModal';
import type { Category } from '@/types';

// ── shared test state ─────────────────────────────────────────────────────────

type Cat = Pick<Category, 'id' | 'name' | 'icon' | 'parentId'> & { isCustom?: boolean };

const toggleCategoryManagerMock = vi.fn();
const hideCategoryIdMock        = vi.fn();
const unhideCategoryIdMock      = vi.fn();
const addCustomCategoryMock     = vi.fn();
const removeCustomCategoryMock  = vi.fn();

const uiState = {
  showCategoryManager: false as boolean,
  toggleCategoryManager: toggleCategoryManagerMock,
};

const mockTopCategories: Cat[] = [
  { id: 'cat1', name: 'Feelings',   icon: '😊', parentId: null },
  { id: 'cat2', name: 'My Custom',  icon: '⭐', parentId: null, isCustom: true },
];
const mockSubs: Cat[] = [
  { id: 'sub1', name: 'Happy', icon: '😄', parentId: 'cat1' },
];

const categoryStoreState = {
  customCategories: [] as Cat[],
  hiddenCategoryIds: [] as string[],
  hideCategoryId:        hideCategoryIdMock,
  unhideCategoryId:      unhideCategoryIdMock,
  addCustomCategory:     addCustomCategoryMock,
  removeCustomCategory:  removeCustomCategoryMock,
  allCategories: (_?: boolean) => mockTopCategories,
  getSubcategories: (id: string) => (id === 'cat1' ? mockSubs : []),
};

// ── mocks ──────────────────────────────────────────────────────────────────────

vi.mock('@/store/uiStore', () => ({
  useUIStore: (sel?: (s: typeof uiState) => unknown) =>
    sel ? sel(uiState) : uiState,
}));

vi.mock('@/store/categoryStore', () => ({
  useCategoryStore: Object.assign(
    (sel?: (s: typeof categoryStoreState) => unknown) =>
      sel ? sel(categoryStoreState) : categoryStoreState,
    {
      getState: () => ({ ...categoryStoreState }),
      setState: vi.fn(),
    },
  ),
}));

vi.mock('@/services/feedback', () => ({ tapFeedback: vi.fn() }));

beforeEach(() => {
  vi.clearAllMocks();
  uiState.showCategoryManager = false;
  categoryStoreState.hiddenCategoryIds = [];
  categoryStoreState.customCategories  = [];
});

// ── render gating ─────────────────────────────────────────────────────────────

describe('CategoryManagerModal — render gating', () => {
  it('renders nothing when showCategoryManager=false', () => {
    const { container } = render(<CategoryManagerModal />);
    expect(container.firstChild).toBeNull();
  });

  it('renders dialog when showCategoryManager=true', () => {
    uiState.showCategoryManager = true;
    render(<CategoryManagerModal />);
    expect(screen.getByRole('dialog', { name: /category manager/i })).toBeInTheDocument();
  });
});

// ── close actions ─────────────────────────────────────────────────────────────

describe('CategoryManagerModal — close', () => {
  beforeEach(() => { uiState.showCategoryManager = true; });

  it('close (✕) button calls toggleCategoryManager', () => {
    render(<CategoryManagerModal />);
    fireEvent.click(screen.getByRole('button', { name: /^close$/i }));
    expect(toggleCategoryManagerMock).toHaveBeenCalledOnce();
  });

  it('clicking backdrop calls toggleCategoryManager', () => {
    render(<CategoryManagerModal />);
    fireEvent.click(screen.getByRole('dialog', { name: /category manager/i }));
    expect(toggleCategoryManagerMock).toHaveBeenCalled();
  });
});

// ── category list ─────────────────────────────────────────────────────────────

describe('CategoryManagerModal — category list', () => {
  beforeEach(() => { uiState.showCategoryManager = true; });

  it('renders top-level category names', () => {
    render(<CategoryManagerModal />);
    expect(screen.getByText('Feelings')).toBeInTheDocument();
    expect(screen.getByText('My Custom')).toBeInTheDocument();
  });

  it('renders subcategory names', () => {
    render(<CategoryManagerModal />);
    expect(screen.getByText('Happy')).toBeInTheDocument();
  });

  it('visibility toggle shows aria-pressed=true for visible category', () => {
    render(<CategoryManagerModal />);
    const toggle = screen.getByRole('button', { name: /hide feelings/i });
    expect(toggle).toHaveAttribute('aria-pressed', 'true');
  });

  it('visibility toggle shows aria-pressed=false for hidden category', () => {
    categoryStoreState.hiddenCategoryIds = ['cat1'];
    render(<CategoryManagerModal />);
    const toggle = screen.getByRole('button', { name: /show feelings/i });
    expect(toggle).toHaveAttribute('aria-pressed', 'false');
  });
});

// ── toggle visibility ─────────────────────────────────────────────────────────

describe('CategoryManagerModal — toggle visibility', () => {
  beforeEach(() => { uiState.showCategoryManager = true; });

  it('clicking visible toggle calls hideCategoryId', () => {
    render(<CategoryManagerModal />);
    fireEvent.click(screen.getByRole('button', { name: /hide feelings/i }));
    expect(hideCategoryIdMock).toHaveBeenCalledWith('cat1');
  });

  it('clicking hidden toggle calls unhideCategoryId', () => {
    categoryStoreState.hiddenCategoryIds = ['cat1'];
    render(<CategoryManagerModal />);
    fireEvent.click(screen.getByRole('button', { name: /show feelings/i }));
    expect(unhideCategoryIdMock).toHaveBeenCalledWith('cat1');
  });
});

// ── custom category remove ────────────────────────────────────────────────────

describe('CategoryManagerModal — remove custom category', () => {
  beforeEach(() => { uiState.showCategoryManager = true; });

  it('shows Remove button for custom categories only', () => {
    render(<CategoryManagerModal />);
    const removeButtons = screen.getAllByText('Remove');
    expect(removeButtons.length).toBe(1); // only My Custom is isCustom
  });

  it('clicking Remove calls removeCustomCategory with the category id', () => {
    render(<CategoryManagerModal />);
    fireEvent.click(screen.getByText('Remove'));
    expect(removeCustomCategoryMock).toHaveBeenCalledWith('cat2');
  });
});

// ── add top-level category ─────────────────────────────────────────────────────

describe('CategoryManagerModal — add top-level category', () => {
  beforeEach(() => { uiState.showCategoryManager = true; });

  it('clicking + Add top-level category shows name input', () => {
    render(<CategoryManagerModal />);
    fireEvent.click(screen.getByRole('button', { name: /add top-level category/i }));
    expect(screen.getByPlaceholderText(/new category name/i)).toBeInTheDocument();
  });

  it('cancelling add top-level hides the form', () => {
    render(<CategoryManagerModal />);
    fireEvent.click(screen.getByRole('button', { name: /add top-level category/i }));
    // The last ✕ in the DOM is the form cancel button
    const cancelBtns = screen.getAllByText('✕');
    fireEvent.click(cancelBtns[cancelBtns.length - 1]);
    expect(screen.queryByPlaceholderText(/new category name/i)).toBeNull();
  });

  it('typing a name and clicking Add calls addCustomCategory', () => {
    render(<CategoryManagerModal />);
    fireEvent.click(screen.getByRole('button', { name: /add top-level category/i }));
    fireEvent.change(screen.getByPlaceholderText(/new category name/i), { target: { value: 'Work' } });
    fireEvent.click(screen.getByRole('button', { name: /^add$/i }));
    expect(addCustomCategoryMock).toHaveBeenCalledWith('Work', expect.any(String));
  });
});
