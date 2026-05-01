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
  addTask: (text: string, icon: string) => void;
  removeTask: (id: string) => void;
  toggleDone: (id: string) => void;
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

let idCounter = 100;

export const useScheduleStore = create<ScheduleState>()(
  persist(
    (set) => ({
      tasks: DEFAULT_TASKS,
      rewards: 0,
      timerSeconds: 300,
      timerEndMs: 0,

      addTask: (text, icon) =>
        set((s) => ({
          tasks: [
            ...s.tasks,
            {
              id: `sched-${Date.now()}-${++idCounter}`,
              text,
              icon,
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
        set((s) => ({
          tasks: s.tasks.map((t) =>
            t.id === id ? { ...t, order: newOrder } : t
          ),
        })),
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
