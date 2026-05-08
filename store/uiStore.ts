import { create } from 'zustand';
import { KeyboardMode, MODULE_PANEL_VIEWS, ModulePanelView, SidePanelView } from '@/types';

interface UIState {
  sidePanel: SidePanelView;
  activeCategoryId: string | null;
  activeContactId: string | null;
  activeSequenceId: string | null;
  activeSequenceStep: number;
  keyboardMode: KeyboardMode;
  isUpperCase: boolean;
  capsLock: boolean;
  showHistory: boolean;
  showSettings: boolean;
  isAlertFlashing: boolean;
  openCategories: () => void;
  openMath: () => void;
  openCaregiver: () => void;
  openAIChat: () => void;
  openAACChat: () => void;
  openSchedule: () => void;
  openGames: () => void;
  openMarketplace: () => void;
  openPdfReader: () => void;
  openOcrCapture: () => void;
  /**
   * Open a marketplace-installed module panel by its panelId. Used by
   * panelHandler.launch() so installed modules can mount their own UI.
   * Unknown panelIds silently no-op.
   */
  openModulePanel: (panelId: string) => void;
  closeSidePanel: () => void;
  selectCategory: (id: string) => void;
  backToCategories: () => void;
  startOrdering: (sequenceId: string) => void;
  nextStep: (maxSteps: number) => void;
  prevStep: () => void;
  finishOrdering: () => void;
  toggleKeyboardMode: () => void;
  toggleCase: () => void;
  toggleCapsLock: () => void;
  toggleHistory: () => void;
  toggleSettings: () => void;
  triggerAlert: () => void;
  selectContact: (id: string) => void;
  backToContacts: () => void;
}

let alertTimer: ReturnType<typeof setTimeout> | null = null;

export const useUIStore = create<UIState>()((set) => ({
  sidePanel: 'none',
  activeCategoryId: null,
  activeContactId: null,
  activeSequenceId: null,
  activeSequenceStep: 0,
  keyboardMode: 'letters',
  isUpperCase: false,
  capsLock: false,
  showHistory: false,
  showSettings: false,
  isAlertFlashing: false,

  openCategories: () => set((s) => {
    // Sane navigation from every starting state:
    //   • 'categories'      → 'none'        (close — second tap dismisses)
    //   • 'category-detail' → 'categories'  (go UP one level — earlier
    //                         revision closed the panel here, which read
    //                         as "tap does nothing" from inside a detail
    //                         view; May 2026 user report Image #8.)
    //   • 'ordering'        → 'categories'  (same — escape ordering flow)
    //   • anything else     → 'categories'  (open at top level)
    if (s.sidePanel === 'categories') return { sidePanel: 'none', activeCategoryId: null, activeSequenceId: null };
    if (s.sidePanel === 'category-detail' || s.sidePanel === 'ordering') {
      return { sidePanel: 'categories', activeCategoryId: null, activeSequenceId: null };
    }
    return { sidePanel: 'categories', activeCategoryId: null };
  }),
  openMath: () => set((s) => ({ sidePanel: s.sidePanel === 'math' ? 'none' : 'math' })),
  openCaregiver: () => set((s) => ({ sidePanel: s.sidePanel === 'caregiver' ? 'none' : 'caregiver' })),
  openAIChat: () => set((s) => ({ sidePanel: s.sidePanel === 'ai-chat' ? 'none' : 'ai-chat' as SidePanelView })),
  openAACChat: () => set((s) => ({ sidePanel: s.sidePanel === 'aac-chat' ? 'none' : 'aac-chat' as SidePanelView, activeContactId: null })),
  openSchedule: () => set((s) => ({ sidePanel: s.sidePanel === 'schedule' ? 'none' : 'schedule' as SidePanelView })),
  openGames: () => set((s) => ({ sidePanel: s.sidePanel === 'games' ? 'none' : 'games' as SidePanelView })),
  openMarketplace: () => set((s) => ({ sidePanel: s.sidePanel === 'marketplace' ? 'none' : 'marketplace' as SidePanelView })),
  openPdfReader: () => set((s) => ({ sidePanel: s.sidePanel === 'pdf-reader' ? 'none' : 'pdf-reader' as SidePanelView })),
  openOcrCapture: () => set((s) => ({ sidePanel: s.sidePanel === 'ocr-capture' ? 'none' : 'ocr-capture' as SidePanelView })),
  openModulePanel: (panelId: string) => set(() => {
    if (!(MODULE_PANEL_VIEWS as readonly string[]).includes(panelId)) return {};
    return { sidePanel: panelId as ModulePanelView };
  }),
  closeSidePanel: () => set({ sidePanel: 'none', activeCategoryId: null, activeSequenceId: null }),
  selectCategory: (id) => set({ sidePanel: 'category-detail', activeCategoryId: id }),
  backToCategories: () => set({ sidePanel: 'categories', activeCategoryId: null, activeSequenceId: null }),
  startOrdering: (sequenceId) => set({ sidePanel: 'ordering', activeSequenceId: sequenceId, activeSequenceStep: 0 }),
  nextStep: (maxSteps) => set((s) => ({ activeSequenceStep: Math.min(s.activeSequenceStep + 1, maxSteps - 1) })),
  prevStep: () => set((s) => ({ activeSequenceStep: Math.max(0, s.activeSequenceStep - 1) })),
  finishOrdering: () => set({ sidePanel: 'category-detail', activeSequenceId: null, activeSequenceStep: 0 }),
  toggleKeyboardMode: () =>
    set((s) => ({ keyboardMode: s.keyboardMode === 'letters' ? 'numbers' : s.keyboardMode === 'numbers' ? 'symbols' : 'letters' })),
  toggleCase: () => set((s) => ({ isUpperCase: !s.isUpperCase, capsLock: false })),
  toggleCapsLock: () => set((s) => {
    const next = !s.capsLock;
    return { capsLock: next, isUpperCase: next };
  }),
  toggleHistory: () => set((s) => ({ showHistory: !s.showHistory })),
  toggleSettings: () => set((s) => ({ showSettings: !s.showSettings })),
  triggerAlert: () => {
    if (alertTimer) clearTimeout(alertTimer);
    set({ isAlertFlashing: true });
    alertTimer = setTimeout(() => { set({ isAlertFlashing: false }); alertTimer = null; }, 2000);
  },
  selectContact: (id) => set({ activeContactId: id }),
  backToContacts: () => set({ activeContactId: null }),
}));
