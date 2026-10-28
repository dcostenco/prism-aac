import { useCategoryStore } from '@/store/categoryStore';
import { useSettingsStore } from '@/store/settingsStore';

/** The user's own boards: custom categories and phrases, what they hid, and
 *  the board layout. The same JSON Settings › Export / Import has always copied. */
export function boardExportData() {
  const categories = useCategoryStore.getState();
  const settings = useSettingsStore.getState();
  return {
    version: 1,
    categories: categories.customCategories,
    phrases: categories.customPhrases.filter(p => !p.deletedAt),
    hiddenCategories: categories.hiddenCategoryIds,
    hiddenPhrases: categories.hiddenPhraseIds,
    settings: { gridSize: settings.gridSize, activeVocabSet: settings.activeVocabSet },
  };
}

/** Copies the export to the clipboard, so it can be pasted into another device or kept. */
export function copyBoardExport(): Promise<void> {
  return navigator.clipboard.writeText(JSON.stringify(boardExportData(), null, 2));
}
