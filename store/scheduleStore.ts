import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

export interface ScheduleTask {
  id: string;
  text: string;
  textKey?: string;
  icon: string;
  done: boolean;
  order: number;
}

interface ScheduleState {
  tasks: ScheduleTask[];
  rewards: number;
  timerSeconds: number;
  // Absolute end timestamp — immune to background throttling, device sleep.
  // UI computes remaining = max(0, timerEndMs - Date.now()) on every frame.
  timerEndMs: number;
  addTask: (text: string, icon: string, textKey?: string) => void;
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
    (set) => ({
      tasks: DEFAULT_TASKS,
      rewards: 0,
      timerSeconds: 300,
      timerEndMs: 0,

      addTask: (text, icon, textKey) =>
        set((s) => ({
          tasks: [
            ...s.tasks,
            {
              id: `sched-${crypto.randomUUID()}`,
              text,
              icon,
              ...(textKey ? { textKey } : {}),
              done: false,
              order: s.tasks.length,
            },
          ],
        })),

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
            if (patch.text !== undefined) next.text = patch.text;
            if (patch.icon !== undefined) next.icon = patch.icon;
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
        set((s) => ({ rewards: s.rewards + count })),

      setTimerSeconds: (seconds) => set({ timerSeconds: seconds }),

      startTimer: (durationSeconds) =>
        set({ timerEndMs: Date.now() + durationSeconds * 1000 }),

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
      storage: createJSONStorage(() =>
        typeof window !== 'undefined' ? localStorage : {
          getItem: () => null,
          setItem: () => {},
          removeItem: () => {},
        }
      ),
    }
  )
);
