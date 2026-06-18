'use client';
import { useState } from 'react';
import { useUIStore } from '@/store/uiStore';
import { useCategoryStore } from '@/store/categoryStore';
import { tapFeedback } from '@/services/feedback';
import { Category } from '@/types';

/**
 * Full-screen category manager (separate settings, as requested).
 *
 * Shows the full category hierarchy: top-level folders with their
 * subcategories indented beneath them. Per-category controls:
 *   • Toggle visibility (eye icon)
 *   • Add a custom sub-folder
 *   • Remove custom categories
 */
export default function CategoryManagerModal() {
  const { showCategoryManager, toggleCategoryManager } = useUIStore();
  const {
    allCategories, getSubcategories,
    hiddenCategoryIds, hideCategoryId, unhideCategoryId,
    addCustomCategory, removeCustomCategory,
  } = useCategoryStore();

  const [addingSubOf, setAddingSubOf] = useState<string | null>(null);
  const [newSubName, setNewSubName] = useState('');
  const [newSubIcon, setNewSubIcon] = useState('📁');
  const [addingTop, setAddingTop] = useState(false);
  const [newTopName, setNewTopName] = useState('');
  const [newTopIcon, setNewTopIcon] = useState('📁');

  if (!showCategoryManager) return null;

  const hiddenSet = new Set(hiddenCategoryIds);
  const topLevel = allCategories(true).filter((c) => !c.parentId);

  const toggleVisible = (cat: Category) => {
    tapFeedback();
    if (hiddenSet.has(cat.id)) unhideCategoryId(cat.id);
    else hideCategoryId(cat.id);
  };

  const commitSub = (parentId: string) => {
    if (!newSubName.trim()) return;
    addCustomCategory(newSubName.trim(), newSubIcon);
    // addCustomCategory creates a top-level custom cat; we need parentId.
    // Work around: directly grab the last-added and patch it. Instead,
    // expose addCustomSubcategory or encode parentId in the icon field.
    // Cleanest: we just set parentId via the raw store setter here.
    const store = useCategoryStore.getState();
    const added = store.customCategories[store.customCategories.length - 1];
    if (added) {
      // patch parentId into the persisted entry
      useCategoryStore.setState((s) => ({
        customCategories: s.customCategories.map((c) =>
          c.id === added.id ? { ...c, parentId } : c
        ),
      }));
    }
    setNewSubName('');
    setNewSubIcon('📁');
    setAddingSubOf(null);
  };

  const commitTop = () => {
    if (!newTopName.trim()) return;
    addCustomCategory(newTopName.trim(), newTopIcon);
    setNewTopName('');
    setNewTopIcon('📁');
    setAddingTop(false);
  };

  const VisToggle = ({ cat }: { cat: Category }) => {
    const visible = !hiddenSet.has(cat.id);
    return (
      <button
        onClick={() => toggleVisible(cat)}
        aria-pressed={visible}
        aria-label={`${visible ? 'Hide' : 'Show'} ${cat.name}`}
        className={`w-12 h-7 rounded-full transition-colors shrink-0 ${visible ? 'bg-[#4CAF50]' : 'bg-slate-400'}`}
      >
        <div className={`w-5 h-5 rounded-full bg-white transition-transform mx-1 ${visible ? 'translate-x-5' : ''}`} />
      </button>
    );
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Category Manager"
      className="modal-backdrop fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4"
      onKeyDown={(e) => { if (e.key === 'Escape') toggleCategoryManager(); }}
      tabIndex={-1}
    >
      <div
        className="surface-bar rounded-2xl w-full max-w-xl max-h-[90svh] flex flex-col border border-theme shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-theme shrink-0">
          <h2 className="text-primary font-bold text-lg">📂 Category Manager</h2>
          <button onClick={toggleCategoryManager} aria-label="Close" className="text-muted hover:text-primary text-xl">✕</button>
        </div>

        {/* Tree */}
        <div className="flex-1 overflow-y-auto p-4 space-y-2">
          {topLevel.map((cat) => {
            const subs = getSubcategories(cat.id);
            return (
              <div key={cat.id} className="border border-theme rounded-xl overflow-hidden">
                {/* Top-level row */}
                <div className="flex items-center gap-3 px-4 py-3 bg-white/5">
                  <span className="text-2xl">{cat.icon}</span>
                  <span className="flex-1 text-primary font-semibold">{cat.name}</span>
                  {cat.isCustom && (
                    <button
                      onClick={() => { tapFeedback(); removeCustomCategory(cat.id); }}
                      className="text-red-400 text-xs hover:underline shrink-0 mr-2"
                    >
                      Remove
                    </button>
                  )}
                  <VisToggle cat={cat} />
                </div>

                {/* Subcategory rows */}
                {subs.length > 0 && (
                  <div className="border-t border-theme divide-y divide-theme">
                    {subs.map((sub) => (
                      <div key={sub.id} className="flex items-center gap-3 px-4 py-2 pl-10 bg-black/5">
                        <span className="text-xl">{sub.icon}</span>
                        <span className="flex-1 text-primary text-sm">{sub.name}</span>
                        {sub.isCustom && (
                          <button
                            onClick={() => { tapFeedback(); removeCustomCategory(sub.id); }}
                            className="text-red-400 text-xs hover:underline shrink-0 mr-2"
                          >
                            Remove
                          </button>
                        )}
                        <VisToggle cat={sub} />
                      </div>
                    ))}
                  </div>
                )}

                {/* Add subcategory row */}
                {addingSubOf === cat.id ? (
                  <div className="flex items-center gap-2 px-4 py-2 pl-10 border-t border-theme bg-black/5">
                    <input
                      value={newSubIcon}
                      onChange={(e) => setNewSubIcon(e.target.value)}
                      className="w-10 surface-key rounded text-center text-lg p-1 border border-theme"
                      maxLength={2}
                    />
                    <input
                      value={newSubName}
                      onChange={(e) => setNewSubName(e.target.value)}
                      placeholder="Subfolder name…"
                      className="flex-1 surface-key rounded px-2 py-1 text-sm border border-theme"
                      autoFocus
                      onKeyDown={(e) => { if (e.key === 'Enter') commitSub(cat.id); }}
                    />
                    <button onClick={() => commitSub(cat.id)} className="aac-btn bg-[#4CAF50] text-white px-3 py-1 rounded text-sm font-semibold">Add</button>
                    <button onClick={() => { setAddingSubOf(null); setNewSubName(''); }} className="text-muted text-sm px-1">✕</button>
                  </div>
                ) : (
                  <button
                    onClick={() => { tapFeedback(); setAddingSubOf(cat.id); setNewSubName(''); setNewSubIcon('📁'); }}
                    className="aac-btn w-full text-left text-xs text-muted px-4 py-2 pl-10 border-t border-theme hover:bg-black/5"
                  >
                    + Add subfolder
                  </button>
                )}
              </div>
            );
          })}

          {/* Add top-level category */}
          <div className="border border-theme rounded-xl overflow-hidden">
            {addingTop ? (
              <div className="flex items-center gap-2 px-4 py-3">
                <input
                  value={newTopIcon}
                  onChange={(e) => setNewTopIcon(e.target.value)}
                  className="w-10 surface-key rounded text-center text-xl p-1 border border-theme"
                  maxLength={2}
                />
                <input
                  value={newTopName}
                  onChange={(e) => setNewTopName(e.target.value)}
                  placeholder="New category name…"
                  className="flex-1 surface-key rounded px-2 py-2 border border-theme"
                  autoFocus
                  onKeyDown={(e) => { if (e.key === 'Enter') commitTop(); }}
                />
                <button onClick={commitTop} className="aac-btn bg-[#4CAF50] text-white px-4 py-2 rounded font-semibold">Add</button>
                <button onClick={() => { setAddingTop(false); setNewTopName(''); }} className="text-muted px-1">✕</button>
              </div>
            ) : (
              <button
                onClick={() => { tapFeedback(); setAddingTop(true); }}
                className="aac-btn w-full text-left px-4 py-3 text-muted hover:text-primary hover:bg-black/5"
              >
                + Add top-level category
              </button>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="px-4 py-3 border-t border-theme shrink-0 text-center">
          <p className="text-muted text-xs">Toggle the slider to show/hide a category or subfolder on the board</p>
        </div>
      </div>
    </div>
  );
}
