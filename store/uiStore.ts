import { create } from 'zustand';
import { KeyboardMode, MODULE_PANEL_VIEWS, ModulePanelView, SidePanelView } from '@/types';

interface UIState {
  sidePanel: SidePanelView;
  categoryKeyboardOpen: boolean;   // keyboard drawer inside category panel
  activeCategoryId: string | null;
  /** Full breadcrumb path from root → current category (ids). Last entry is the active one. */
  categoryPath: string[];
  activeContactId: string | null;
  activeSequenceId: string | null;
  activeSequenceStep: number;
  keyboardMode: KeyboardMode;
  isUpperCase: boolean;
  capsLock: boolean;
  showHistory: boolean;
  showSettings: boolean;
  showCategoryManager: boolean;
  /** Whether the "Add a contact manually" form in CaregiverContactsSettings
   *  is expanded. Lives here (not local component state) because
   *  CaregiverContactsSettings was demonstrated to remount on every
   *  Settings open (May 2026 user diag), which kept resetting local
   *  state regardless of localStorage persistence attempts. Store state
   *  survives the remounts cleanly. */
  contactsManualFormOpen: boolean;
  toggleContactsManualForm: () => void;
  isAlertFlashing: boolean;
  /** Timestamp of last triggerAlert call — used for 5s cooldown. In state so tests can reset it. */
  _alertLastFiredAt: number;
  openCategories: () => void;
  openMath: () => void;
  openCaregiver: () => void;
  openAIChat: () => void;
  openAACChat: () => void;
  /** Open AAC Chat panel pre-selecting a contact by their phone or display name.
   *  Used by the Reply button on incoming schedule messages. Looks up the first
   *  contact whose phone or name contains `senderKey` (case-insensitive). */
  replyToSender: (senderKey: string) => void;
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
  /** Drill into a subcategory, pushing onto the breadcrumb path. */
  drillIntoCategory: (id: string) => void;
  /** Pop one level up in the breadcrumb; goes back to top-level list if path becomes empty. */
  navigateCategoryUp: () => void;
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
  toggleCategoryManager: () => void;
  triggerAlert: () => void;
  selectContact: (id: string) => void;
  backToContacts: () => void;
  toggleCategoryKeyboard: () => void;
}

let alertTimer: ReturnType<typeof setTimeout> | null = null;

export const useUIStore = create<UIState>()((set) => ({
  sidePanel: 'none',
  categoryKeyboardOpen: false,
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
  contactsManualFormOpen: false,
  toggleContactsManualForm: () => set((s) => ({ contactsManualFormOpen: !s.contactsManualFormOpen })),
  isAlertFlashing: false,
  _alertLastFiredAt: 0,

  openCategories: () => set((s) => {
    // Sane navigation from every starting state:
    //   • 'categories'      → 'none'        (close — second tap dismisses)
    //   • 'category-detail' → 'categories'  (go UP one level — earlier
    //                         revision closed the panel here, which read
    //                         as "tap does nothing" from inside a detail
    //                         view; May 2026 user report Image #8.)
    //   • 'ordering'        → 'categories'  (same — escape ordering flow)
    //   • anything else     → 'categories'  (open at top level)
    if (s.sidePanel === 'categories') return { sidePanel: 'none', activeCategoryId: null, categoryPath: [], activeSequenceId: null, categoryKeyboardOpen: false };
    if (s.sidePanel === 'category-detail' || s.sidePanel === 'ordering') {
      return { sidePanel: 'categories', activeCategoryId: null, categoryPath: [], activeSequenceId: null, categoryKeyboardOpen: false };
    }
    return { sidePanel: 'categories', activeCategoryId: null, categoryPath: [], categoryKeyboardOpen: false };
  }),
  openMath: () => set((s) => ({ sidePanel: s.sidePanel === 'math' ? 'none' : 'math' })),
  openCaregiver: () => set((s) => ({ sidePanel: s.sidePanel === 'caregiver' ? 'none' : 'caregiver' })),
  openAIChat: () => set((s) => ({ sidePanel: s.sidePanel === 'ai-chat' ? 'none' : 'ai-chat' as SidePanelView })),
  openAACChat: () => set((s) => ({ sidePanel: s.sidePanel === 'aac-chat' ? 'none' : 'aac-chat' as SidePanelView, activeContactId: null })),
  replyToSender: (senderKey) => {
    // Dynamically import contactsStore to avoid circular dep at module level.
    // Find the first contact whose phone or displayName matches senderKey.
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { useContactsStore } = require('@/store/contactsStore') as { useContactsStore: { getState: () => { contacts: Array<{ id: string; recipientId?: string; name?: string }> } } };
    const contacts = useContactsStore.getState().contacts;
    if (!Array.isArray(contacts)) return;  // guard against SSR/edge cold start
    const key = senderKey.slice(0, 200).toLowerCase().replace(/\s+/g, '');
    const match = contacts.find((c) => {
      const recipientId = (c.recipientId ?? '').toLowerCase().replace(/\s+/g, '');
      const name = (c.name ?? '').toLowerCase().replace(/\s+/g, '');
      // One-directional: contact fields must contain the key (not the reverse).
      // Bidirectional key.includes(name) would match any short contact name
      // (e.g. "Al") against unrelated senders that contain those letters.
      return recipientId === key || name === key
        || (key.length >= 4 && (recipientId.startsWith(key) || name.startsWith(key)));
    });
    set({ sidePanel: 'aac-chat', activeContactId: match?.id ?? null });
  },
  openSchedule: () => set((s) => ({ sidePanel: s.sidePanel === 'schedule' ? 'none' : 'schedule' as SidePanelView })),
  openGames: () => set((s) => ({ sidePanel: s.sidePanel === 'games' ? 'none' : 'games' as SidePanelView })),
  openMarketplace: () => set((s) => ({ sidePanel: s.sidePanel === 'marketplace' ? 'none' : 'marketplace' as SidePanelView })),
  openPdfReader: () => set((s) => ({ sidePanel: s.sidePanel === 'pdf-reader' ? 'none' : 'pdf-reader' as SidePanelView })),
  openOcrCapture: () => set((s) => ({ sidePanel: s.sidePanel === 'ocr-capture' ? 'none' : 'ocr-capture' as SidePanelView })),
  openModulePanel: (panelId: string) => set(() => {
    if (!(MODULE_PANEL_VIEWS as readonly string[]).includes(panelId)) return {};
    return { sidePanel: panelId as ModulePanelView };
  }),
  toggleCategoryKeyboard: () => set((s) => ({ categoryKeyboardOpen: !s.categoryKeyboardOpen })),
  closeSidePanel: () => set({ sidePanel: 'none', activeCategoryId: null, categoryPath: [], activeSequenceId: null, categoryKeyboardOpen: false }),
  selectCategory: (id) => set({ sidePanel: 'category-detail', activeCategoryId: id, categoryPath: [id] }),
  drillIntoCategory: (id) => set((s) => {
    if (typeof id !== 'string' || !id || id.length > 64) return s;
    if (s.categoryPath.length >= 20) return s;
    return {
      sidePanel: 'category-detail',
      activeCategoryId: id,
      categoryPath: [...s.categoryPath, id],
    };
  }),
  navigateCategoryUp: () => set((s) => {
    const newPath = s.categoryPath.slice(0, -1);
    if (newPath.length === 0) return { sidePanel: 'categories', activeCategoryId: null, categoryPath: [] };
    return { activeCategoryId: newPath[newPath.length - 1], categoryPath: newPath };
  }),
  backToCategories: () => set({ sidePanel: 'categories', activeCategoryId: null, categoryPath: [], activeSequenceId: null, categoryKeyboardOpen: false }),
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
  toggleCategoryManager: () => set((s) => ({ showCategoryManager: !s.showCategoryManager })),
  triggerAlert: () => {
    // 5-second cooldown prevents flooding emergency contacts on accidental rapid taps.
    // _alertLastFiredAt lives in store state so test beforeEach resets it cleanly.
    const now = Date.now();
    set((s) => {
      if (now - s._alertLastFiredAt < 5000) return {};
      if (alertTimer) clearTimeout(alertTimer);
      alertTimer = setTimeout(() => { set({ isAlertFlashing: false }); alertTimer = null; }, 2000);
      return { isAlertFlashing: true, _alertLastFiredAt: now };
    });
  },
  selectContact: (id) => set({ activeContactId: id }),
  backToContacts: () => set({ activeContactId: null }),
}));
