import { create } from 'zustand';
import { KeyboardMode, SidePanelView } from '@/types';

interface UIState {
  sidePanel: SidePanelView;
  activeCategoryId: string | null;
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
  openSchedule: () => void;
  openGames: () => void;
  openMarketplace: () => void;
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
}

let alertTimer: ReturnType<typeof setTimeout> | null = null;

export const useUIStore = create<UIState>()((set) => ({
  sidePanel: 'none',
  activeCategoryId: null,
  activeSequenceId: null,
  activeSequenceStep: 0,
  keyboardMode: 'letters',
  isUpperCase: false,
  capsLock: false,
  showHistory: false,
  showSettings: false,
  isAlertFlashing: false,

  openCategories: () => set((s) => ({ sidePanel: s.sidePanel === 'categories' || s.sidePanel === 'category-detail' ? 'none' : 'categories', activeCategoryId: null })),
  openMath: () => set((s) => ({ sidePanel: s.sidePanel === 'math' ? 'none' : 'math' })),
  openCaregiver: () => set((s) => ({ sidePanel: s.sidePanel === 'caregiver' ? 'none' : 'caregiver' })),
  openAIChat: () => set((s) => ({ sidePanel: s.sidePanel === 'ai-chat' ? 'none' : 'ai-chat' as SidePanelView })),
  openSchedule: () => set((s) => ({ sidePanel: s.sidePanel === 'schedule' ? 'none' : 'schedule' as SidePanelView })),
  openGames: () => set((s) => ({ sidePanel: s.sidePanel === 'games' ? 'none' : 'games' as SidePanelView })),
  openMarketplace: () => set((s) => ({ sidePanel: s.sidePanel === 'marketplace' ? 'none' : 'marketplace' as SidePanelView })),
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
}));
