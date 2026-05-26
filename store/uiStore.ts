import { create } from 'zustand';
import { KeyboardMode, MODULE_PANEL_VIEWS, ModulePanelView, SidePanelView } from '@/types';

interface UIState {
  sidePanel: SidePanelView;
  categoryKeyboardOpen: boolean;   // keyboard drawer inside category panel
  keyboardMaximized: boolean;      // keyboard takes max space, categories shrink
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
  isAlertFlashing: boolean;
  /** Timestamp of last triggerAlert call — used for 5s cooldown. In state so tests can reset it. */
  _alertLastFiredAt: number;
  /** True when the alert-to-caregiver confirmation modal is showing.
   *  triggerAlert sets this; confirmAlertSend / dismissAlertConfirm clear it. */
  alertConfirmOpen: boolean;
  /** Status of the in-flight or just-completed alert send. UI surfaces this
   *  as a toast/banner that auto-clears after 2s. */
  alertSendStatus: null | 'sending' | 'sent' | 'failed_no_caregiver' | 'failed_send';
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
  openComfortPlayer: () => void;
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
  /** Confirm and dispatch the alert. Called from AlertConfirmModal's Send button.
   *  Imports the sender lazily so the store doesn't depend on the contacts store
   *  at module load (breaks circular import otherwise). */
  confirmAlertSend: () => Promise<void>;
  dismissAlertConfirm: () => void;
  selectContact: (id: string) => void;
  backToContacts: () => void;
  toggleCategoryKeyboard: () => void;
  toggleKeyboardMaximized: () => void;
  /** Toggle: keyboard-only (maximized) ↔ picture-only (keyboard hidden). */
  cycleKeyboardMode: () => void;
  contactDraftName: string;
  contactDraftRecipient: string;
  setContactDraftName: (v: string) => void;
  setContactDraftRecipient: (v: string) => void;
}

let alertTimer: ReturnType<typeof setTimeout> | null = null;
// C3 fix: track the alertSendStatus clear timer so double-taps can't leave two
// concurrent timers, each clearing the status independently.
let alertStatusTimer: ReturnType<typeof setTimeout> | null = null;

export const useUIStore = create<UIState>()((set) => ({
  sidePanel: 'none',
  categoryKeyboardOpen: typeof window !== 'undefined' ? localStorage.getItem('prism-cat-kb-open') !== 'false' : true,
  // Migration: old 3-state cycle stored prism-kb-max=true; new 2-state cycle never
  // enters maximized from the sidebar button. Wipe the stale flag so returning
  // users don't boot into a maximized state that the new UI can't cycle out of cleanly.
  keyboardMaximized: (() => {
    if (typeof window === 'undefined') return false;
    if (localStorage.getItem('prism-kb-max') === 'true') {
      try { localStorage.setItem('prism-kb-max', 'false'); } catch {}
    }
    return false;
  })(),
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
  isAlertFlashing: false,
  _alertLastFiredAt: 0,
  alertConfirmOpen: false,
  alertSendStatus: null,
  contactDraftName: '',
  contactDraftRecipient: '',
  setContactDraftName: (v) => set({ contactDraftName: v }),
  setContactDraftRecipient: (v) => set({ contactDraftRecipient: v }),

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
  openComfortPlayer: () => set((s) => ({ sidePanel: s.sidePanel === 'comfort-player' ? 'none' : 'comfort-player' as SidePanelView })),
  openPdfReader: () => set((s) => ({ sidePanel: s.sidePanel === 'pdf-reader' ? 'none' : 'pdf-reader' as SidePanelView })),
  openOcrCapture: () => set((s) => ({ sidePanel: s.sidePanel === 'ocr-capture' ? 'none' : 'ocr-capture' as SidePanelView })),
  openModulePanel: (panelId: string) => set(() => {
    if (!(MODULE_PANEL_VIEWS as readonly string[]).includes(panelId)) return {};
    return { sidePanel: panelId as ModulePanelView };
  }),
  toggleCategoryKeyboard: () => set((s) => {
    const next = !s.categoryKeyboardOpen;
    try { localStorage.setItem('prism-cat-kb-open', String(next)); } catch {}
    return { categoryKeyboardOpen: next };
  }),
  toggleKeyboardMaximized: () => set((s) => {
    const next = !s.keyboardMaximized;
    try {
      localStorage.setItem('prism-kb-max', String(next));
      localStorage.setItem('prism-cat-kb-open', 'true');
    } catch {}
    return { keyboardMaximized: next, categoryKeyboardOpen: true };
  }),
  cycleKeyboardMode: () => set((s) => {
    // Two clean states: keyboard shown (normal size) ↔ keyboard hidden.
    // The maximized state is preserved for direct toggleKeyboardMaximized calls
    // but cycleKeyboardMode never enters it — keeps the sidebar button simple.
    if (s.categoryKeyboardOpen) {
      try {
        localStorage.setItem('prism-kb-max', 'false');
        localStorage.setItem('prism-cat-kb-open', 'false');
      } catch {}
      return { keyboardMaximized: false, categoryKeyboardOpen: false };
    }
    try {
      localStorage.setItem('prism-kb-max', 'false');
      localStorage.setItem('prism-cat-kb-open', 'true');
    } catch {}
    return { keyboardMaximized: false, categoryKeyboardOpen: true };
  }),
  closeSidePanel: () => {
    try { localStorage.setItem('prism-cat-kb-open', 'true'); } catch {}
    set({ sidePanel: 'none', activeCategoryId: null, categoryPath: [], activeSequenceId: null, categoryKeyboardOpen: true });
  },
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
      // Open the confirmation modal — the actual flash + SMS dispatch
      // happens inside confirmAlertSend so a stray tap is recoverable.
      return { alertConfirmOpen: true, _alertLastFiredAt: now };
    });
  },
  confirmAlertSend: async () => {
    set({ alertConfirmOpen: false, alertSendStatus: 'sending', isAlertFlashing: true });
    if (alertTimer) clearTimeout(alertTimer);
    alertTimer = setTimeout(() => { set({ isAlertFlashing: false }); alertTimer = null; }, 2000);
    // Lazy import — keeps uiStore free of a hard dependency on the contacts
    // store + sendToContact (which would create a circular chain).
    const { sendAlertToCaregiver } = await import('@/services/sendAlertToCaregiver');
    const res = await sendAlertToCaregiver();
    set({
      alertSendStatus: res.ok ? 'sent' : (res.error === 'no_caregiver' ? 'failed_no_caregiver' : 'failed_send'),
    });
    // Auto-clear status after 2.5s so the toast doesn't linger.
    if (alertStatusTimer) clearTimeout(alertStatusTimer);
    alertStatusTimer = setTimeout(() => { set({ alertSendStatus: null }); alertStatusTimer = null; }, 2500);
  },
  dismissAlertConfirm: () => set({ alertConfirmOpen: false }),
  selectContact: (id) => set({ activeContactId: id }),
  backToContacts: () => set({ activeContactId: null }),
}));
