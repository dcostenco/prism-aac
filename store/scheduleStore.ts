import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { randomId } from '@/lib/uuid';
import { SAFE_LIMITS } from '@/lib/safeStrings';
import { safeJSONStorage } from '@/lib/safeStorage';

// ── Background alarm via Web Push / Service Worker ───────────────────────────
// Stores the alarm time in localStorage so the SW can check it on fetch events.
// If the Push API is available, also schedules a showNotification via setTimeout
// (best-effort — only fires if the tab is still open; true background delivery
// requires a push subscription which is configured server-side).
async function scheduleBackgroundAlarm(timerEndMs: number, label: string): Promise<void> {
  if (typeof window === 'undefined') return;
  if (!('serviceWorker' in navigator) || !('Notification' in window)) return;

  try {
    const permission = await Notification.requestPermission();
    if (permission !== 'granted') return;

    const reg = await navigator.serviceWorker.ready;
    // Store the alarm time for the service worker to check on fetch events
    // (true background notification requires push subscription — store for SW to handle)
    localStorage.setItem('prism-schedule-alarm', JSON.stringify({
      timerEndMs,
      label: label.slice(0, 100),
      scheduledAt: Date.now(),
    }));

    // If Push API available, try to schedule via showNotification
    if ('showNotification' in reg) {
      const delayMs = Math.max(0, timerEndMs - Date.now());
      setTimeout(() => {
        if (Date.now() < timerEndMs + 5000) { // still relevant
          reg.showNotification('⏰ ' + label, {
            body: 'Your scheduled activity is starting now.',
            tag: 'schedule-timer',
            requireInteraction: true,
            silent: false,
          } as NotificationOptions).catch(() => {});
        }
      }, delayMs);
    }
  } catch { /* notifications not available */ }
}

/** Hard cap on incoming-message tasks before oldest-read eviction
 *  kicks in. 100 fits a chatty caregiver's day without bloating
 *  localStorage. */
export const MAX_MESSAGE_TASKS = 100;
/** Hard cap on total persisted tasks regardless of kind — defense
 *  against tampered localStorage. */
export const MAX_PERSISTED_TASKS = 200;

export interface ScheduleTask {
  id: string;
  text: string;
  textKey?: string;
  icon: string;
  done: boolean;
  order: number;
  /** Source classification — 'task' (normal schedule item) or 'message'
   *  (incoming caregiver/contact note rendered alongside tasks per the
   *  "messages live on the calendar" design). Defaults to 'task'. */
  kind?: 'task' | 'message';
  /** For kind='message' — sender display name used to format the row
   *  ("Mom: hi what's up") and to dedupe identical inbound payloads. */
  sender?: string;
  /** Provider-supplied message id, when available — used to suppress
   *  re-adding the same incoming message on poll refresh. */
  externalId?: string;
  /** ms since epoch — when the message arrived (for sort + display). */
  receivedAt?: number;
}

interface ScheduleState {
  tasks: ScheduleTask[];
  rewards: number;
  timerSeconds: number;
  // Absolute end timestamp — immune to background throttling, device sleep.
  // UI computes remaining = max(0, timerEndMs - Date.now()) on every frame.
  timerEndMs: number;
  addTask: (text: string, icon: string, textKey?: string) => void;
  /** Insert an incoming caregiver/contact message as a schedule entry —
   *  rendered the same way as morning routine items per the "messages on
   *  the calendar" design. Returns the new task id, or null if the
   *  message was deduped (same externalId already present). */
  addIncomingMessage: (sender: string, text: string, externalId?: string) => string | null;
  removeTask: (id: string) => void;
  toggleDone: (id: string) => void;
  /** Update a task's text/icon/textKey in place. Pass undefined to leave a field unchanged. */
  editTask: (id: string, patch: { text?: string; icon?: string; textKey?: string | null }) => void;
  resetDay: () => void;
  addReward: (count?: number) => void;
  setTimerSeconds: (s: number) => void;
  startTimer: (durationSeconds: number) => void;
  resetTimer: () => void;
  reorderTask: (id: string, newOrder: number) => void;
}

/** Count of incoming-message tasks the user has not yet checked off.
 *  Surfaced as a toolbar badge on the AAC chat button so the AAC user
 *  notices new messages from the home screen without opening Schedule. */
export function selectUnreadMessageCount(s: { tasks: ScheduleTask[] }): number {
  let n = 0;
  for (const t of s.tasks) if (t.kind === 'message' && !t.done) n++;
  return n;
}

const DEFAULT_TASKS: ScheduleTask[] = [
  { id: 'sched-1', text: 'Morning routine', textKey: 'sched_morning', icon: '🌅', done: false, order: 0 },
  { id: 'sched-2', text: 'Breakfast', textKey: 'sched_breakfast', icon: '🥣', done: false, order: 1 },
  { id: 'sched-3', text: 'School', textKey: 'sched_school', icon: '🏫', done: false, order: 2 },
  { id: 'sched-4', text: 'Lunch', textKey: 'sched_lunch', icon: '🍽️', done: false, order: 3 },
  { id: 'sched-5', text: 'Play time', textKey: 'sched_play', icon: '🎈', done: false, order: 4 },
  { id: 'sched-6', text: 'Dinner', textKey: 'sched_dinner', icon: '🍕', done: false, order: 5 },
  { id: 'sched-7', text: 'Bedtime', textKey: 'sched_bedtime', icon: '🌙', done: false, order: 6 },
];

// Removed module-level mutable counter — use crypto.randomUUID for safe IDs

export const useScheduleStore = create<ScheduleState>()(
  persist(
    (set, get) => ({
      tasks: DEFAULT_TASKS,
      rewards: 0,
      timerSeconds: 300,
      timerEndMs: 0,

      addTask: (text, icon, textKey) => {
        // Cap at the same bound the hydration validator uses. Without
        // this, a caregiver typing a 5000-char "task" (paste accident)
        // would create a row that gets dropped on the next reload —
        // a silent data-loss class. Match the persisted-text bound so
        // anything addTask accepts also survives rehydrate.
        const cappedText = text.slice(0, SAFE_LIMITS.name + 2 + SAFE_LIMITS.messageText + 100);
        const cappedIcon = icon.slice(0, 16);
        set((s) => ({
          tasks: [
            ...s.tasks,
            {
              id: randomId('sched-'),
              text: cappedText,
              icon: cappedIcon,
              ...(textKey ? { textKey } : {}),
              done: false,
              order: s.tasks.length,
            },
          ],
        }));
      },

      addIncomingMessage: (sender, text, externalId) => {
        const trimmedText = text.trim().slice(0, SAFE_LIMITS.messageText);
        const trimmedSender = sender.trim().slice(0, SAFE_LIMITS.name);
        if (!trimmedText || !trimmedSender) return null;
        const id = randomId('sched-');
        // Eviction policy: hard cap on message-kind tasks (see
        // MAX_MESSAGE_TASKS at top of file). Drop oldest READ messages
        // first; never auto-drop unread ones. Falls back to dropping
        // oldest of any kind=message if all slots are unread.
        // All decisions (dedup + eviction) live INSIDE the set callback
        // so they read the freshest committed state and apply to the
        // same snapshot the new task gets added to. Avoids a TOCTOU
        // window between get() and set() that would otherwise let two
        // synchronously-back-to-back deliveries with the same
        // externalId both pass the dedup check.
        let inserted = false;
        set((s) => {
          if (externalId && s.tasks.some((t) => t.externalId === externalId)) {
            return s; // dup — leave state unchanged
          }
          inserted = true;
          const currentMessages = s.tasks.filter((t) => t.kind === 'message');
          const dropIds = new Set<string>();
          if (currentMessages.length >= MAX_MESSAGE_TASKS) {
            const readFirst = [...currentMessages].sort(
              (a, b) => Number(b.done) - Number(a.done) || (a.receivedAt ?? 0) - (b.receivedAt ?? 0),
            );
            for (const t of readFirst) {
              dropIds.add(t.id);
              if (currentMessages.length - dropIds.size < MAX_MESSAGE_TASKS) break;
            }
          }
          const survivors = dropIds.size > 0 ? s.tasks.filter((t) => !dropIds.has(t.id)) : s.tasks;
          return {
            tasks: [
              ...survivors,
              {
                id,
                text: `${trimmedSender}: ${trimmedText}`,
                icon: '💬',
                done: false,
                order: survivors.length,
                kind: 'message',
                sender: trimmedSender,
                ...(externalId ? { externalId } : {}),
                receivedAt: Date.now(),
              },
            ],
          };
        });
        return inserted ? id : null;
      },

      removeTask: (id) =>
        set((s) => ({ tasks: s.tasks.filter((t) => t.id !== id) })),

      toggleDone: (id) =>
        set((s) => ({
          tasks: s.tasks.map((t) =>
            t.id === id ? { ...t, done: !t.done } : t
          ),
        })),

      // Edit text/icon/textKey in place. Passing textKey: null clears it
      // (drops the i18n binding when the user types a custom label).
      editTask: (id, patch) =>
        set((s) => ({
          tasks: s.tasks.map((t) => {
            if (t.id !== id) return t;
            const next = { ...t };
            if (patch.text !== undefined) next.text = patch.text.slice(0, 500);
            if (patch.icon !== undefined) next.icon = patch.icon.slice(0, 16);
            if (patch.textKey === null) {
              delete next.textKey;
            } else if (patch.textKey !== undefined) {
              next.textKey = patch.textKey;
            }
            return next;
          }),
        })),

      resetDay: () =>
        set((s) => ({
          tasks: s.tasks.map((t) => ({ ...t, done: false })),
          rewards: 0,
        })),

      addReward: (count = 1) =>
        set((s) => ({
          rewards: Math.min(s.rewards + Math.max(0, Math.floor(Number(count) || 1)), 999),
        })),

      setTimerSeconds: (seconds) => set({
        timerSeconds: Math.min(Math.max(1, Math.floor(Number(seconds) || 1)), 3600),
      }),

      startTimer: (durationSeconds) => {
        const safe = Math.min(Math.max(1, Math.floor(Number(durationSeconds) || 1)), 3600);
        const endMs = Date.now() + safe * 1000;
        set({ timerEndMs: endMs });
        // Best-effort background alarm via service worker notification
        scheduleBackgroundAlarm(endMs, 'Timer').catch(() => {});
      },

      resetTimer: () => set({ timerEndMs: 0 }),

      reorderTask: (id, newOrder) =>
        set((s) => {
          const task = s.tasks.find((t) => t.id === id);
          if (!task) return s;
          const oldOrder = task.order;
          return {
            tasks: s.tasks.map((t) => {
              if (t.id === id) return { ...t, order: newOrder };
              if (oldOrder < newOrder && t.order > oldOrder && t.order <= newOrder) return { ...t, order: t.order - 1 };
              if (oldOrder > newOrder && t.order >= newOrder && t.order < oldOrder) return { ...t, order: t.order + 1 };
              return t;
            }),
          };
        }),
    }),
    {
      name: 'prism-schedule',
      // Quota-safe wrapper — on QuotaExceededError, drop the OLDEST
      // READ message-kind tasks (the disposable history, never the
      // user's actual schedule routine items). Lets the AAC user keep
      // ticking off "Brush teeth" even after a chatty caregiver fills
      // the inbox cap.
      storage: createJSONStorage(() => safeJSONStorage({
        name: 'prism-schedule',
        onQuotaExceeded: () => {
          useScheduleStore.setState((s) => {
            // Sort message tasks by (read first, oldest first) and drop
            // the front half so the persist re-write fits.
            const messageIds = s.tasks
              .filter((t) => t.kind === 'message')
              .sort((a, b) => Number(b.done) - Number(a.done) || (a.receivedAt ?? 0) - (b.receivedAt ?? 0))
              .slice(0, Math.floor(MAX_MESSAGE_TASKS / 2))
              .map((t) => t.id);
            const dropIds = new Set(messageIds);
            return { tasks: s.tasks.filter((t) => !dropIds.has(t.id)) };
          });
        },
      })),
      // Hydration validator — drops malformed task entries that could
      // sneak in via tampered localStorage (browser extension / shared-
      // device sibling-tab). Caps task count, sender length, text length
      // so a hostile payload can't blow up the schedule render.
      merge: (persistedState, currentState) => {
        const incoming = (persistedState ?? {}) as Partial<ScheduleState>;
        // Persisted-state bounds — slightly larger than the runtime
        // caps because the persisted text already includes the
        // "Sender: " prefix (sender 80 + ': ' + body 2000 = 2082).
        const MAX_TASKS = MAX_PERSISTED_TASKS;
        const MAX_TEXT = SAFE_LIMITS.name + 2 + SAFE_LIMITS.messageText + 100;
        const MAX_SENDER = SAFE_LIMITS.name;
        const cleaned = (Array.isArray(incoming.tasks) ? incoming.tasks : [])
          .filter((t): t is ScheduleTask => {
            if (!t || typeof t !== 'object') return false;
            const x = t as unknown as Record<string, unknown>;
            if (typeof x.id !== 'string' || !x.id) return false;
            if (typeof x.text !== 'string' || x.text.length > MAX_TEXT) return false;
            if (typeof x.icon !== 'string' || x.icon.length > 16) return false;
            if (typeof x.done !== 'boolean') return false;
            if (typeof x.order !== 'number' || !Number.isFinite(x.order)) return false;
            if (x.kind !== undefined && x.kind !== 'task' && x.kind !== 'message') return false;
            if (x.sender !== undefined && (typeof x.sender !== 'string' || x.sender.length > MAX_SENDER)) return false;
            if (x.externalId !== undefined && (typeof x.externalId !== 'string' || x.externalId.length > 128)) return false;
            if (x.receivedAt !== undefined && (typeof x.receivedAt !== 'number' || !Number.isFinite(x.receivedAt))) return false;
            return true;
          })
          .slice(0, MAX_TASKS);
        const rewards = typeof incoming.rewards === 'number' && Number.isFinite(incoming.rewards) && incoming.rewards >= 0
          ? Math.min(incoming.rewards, 999) : 0;
        const timerSeconds = typeof incoming.timerSeconds === 'number' && Number.isFinite(incoming.timerSeconds) && incoming.timerSeconds > 0
          ? Math.min(incoming.timerSeconds, 60 * 60) : 300;
        const timerEndMs = typeof incoming.timerEndMs === 'number' && Number.isFinite(incoming.timerEndMs)
          ? incoming.timerEndMs : 0;
        return {
          ...currentState,
          // Fall back to default tasks if hydration produced nothing —
          // resetting on tamper preserves the user's daily-routine UI.
          tasks: cleaned.length > 0 ? cleaned : DEFAULT_TASKS,
          rewards,
          timerSeconds,
          timerEndMs,
        };
      },
    }
  )
);
