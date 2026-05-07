import { describe, it, expect, beforeEach } from 'vitest';
import { useScheduleStore } from '@/store/scheduleStore';

beforeEach(() => {
  useScheduleStore.setState({
    tasks: [
      { id: 'sched-1', text: 'Morning routine', icon: '🌅', done: false, order: 0 },
      { id: 'sched-2', text: 'Breakfast', icon: '🥣', done: false, order: 1 },
      { id: 'sched-3', text: 'School', icon: '🏫', done: false, order: 2 },
      { id: 'sched-4', text: 'Lunch', icon: '🍽️', done: false, order: 3 },
      { id: 'sched-5', text: 'Play time', icon: '🎈', done: false, order: 4 },
      { id: 'sched-6', text: 'Dinner', icon: '🍕', done: false, order: 5 },
      { id: 'sched-7', text: 'Bedtime', icon: '🌙', done: false, order: 6 },
    ],
    rewards: 0,
    timerSeconds: 300,
  });
});

describe('ScheduleStore — Default data', () => {
  it('has 7 default tasks', () => {
    const { tasks } = useScheduleStore.getState();
    expect(tasks).toHaveLength(7);
  });

  it('default tasks are all not done', () => {
    const { tasks } = useScheduleStore.getState();
    expect(tasks.every((t) => t.done === false)).toBe(true);
  });

  it('default rewards is 0', () => {
    expect(useScheduleStore.getState().rewards).toBe(0);
  });

  it('default timer is 300 seconds', () => {
    expect(useScheduleStore.getState().timerSeconds).toBe(300);
  });
});

describe('ScheduleStore — addTask', () => {
  it('adds a task to the end of the list', () => {
    useScheduleStore.getState().addTask('Snack', '🍎');
    const { tasks } = useScheduleStore.getState();
    expect(tasks).toHaveLength(8);
    const added = tasks[tasks.length - 1];
    expect(added.text).toBe('Snack');
    expect(added.icon).toBe('🍎');
    expect(added.done).toBe(false);
    expect(added.order).toBe(7);
  });

  it('preserves existing task order when adding', () => {
    const originalIds = useScheduleStore.getState().tasks.map((t) => t.id);
    useScheduleStore.getState().addTask('New task', '📝');
    const newIds = useScheduleStore.getState().tasks.map((t) => t.id);
    expect(newIds.slice(0, 7)).toEqual(originalIds);
  });
});

describe('ScheduleStore — toggleDone', () => {
  it('marks a task as done', () => {
    useScheduleStore.getState().toggleDone('sched-1');
    const task = useScheduleStore.getState().tasks.find((t) => t.id === 'sched-1');
    expect(task!.done).toBe(true);
  });

  it('toggles back to not done', () => {
    useScheduleStore.getState().toggleDone('sched-1');
    useScheduleStore.getState().toggleDone('sched-1');
    const task = useScheduleStore.getState().tasks.find((t) => t.id === 'sched-1');
    expect(task!.done).toBe(false);
  });

  it('does not affect other tasks', () => {
    useScheduleStore.getState().toggleDone('sched-1');
    const others = useScheduleStore.getState().tasks.filter((t) => t.id !== 'sched-1');
    expect(others.every((t) => t.done === false)).toBe(true);
  });
});

describe('ScheduleStore — rewards', () => {
  it('addReward increments by 1 by default', () => {
    useScheduleStore.getState().addReward();
    expect(useScheduleStore.getState().rewards).toBe(1);
  });

  it('addReward increments by specified count', () => {
    useScheduleStore.getState().addReward(3);
    expect(useScheduleStore.getState().rewards).toBe(3);
  });

  it('rewards accumulate across multiple calls', () => {
    useScheduleStore.getState().addReward(2);
    useScheduleStore.getState().addReward(3);
    expect(useScheduleStore.getState().rewards).toBe(5);
  });
});

describe('ScheduleStore — resetDay', () => {
  it('resets all tasks to not done', () => {
    useScheduleStore.getState().toggleDone('sched-1');
    useScheduleStore.getState().toggleDone('sched-3');
    useScheduleStore.getState().toggleDone('sched-5');
    useScheduleStore.getState().resetDay();
    const { tasks } = useScheduleStore.getState();
    expect(tasks.every((t) => t.done === false)).toBe(true);
  });

  it('keeps all tasks after reset', () => {
    useScheduleStore.getState().toggleDone('sched-1');
    useScheduleStore.getState().resetDay();
    expect(useScheduleStore.getState().tasks).toHaveLength(7);
  });

  it('resets rewards to 0', () => {
    useScheduleStore.getState().addReward(5);
    useScheduleStore.getState().resetDay();
    expect(useScheduleStore.getState().rewards).toBe(0);
  });

  it('preserves task text and icons after reset', () => {
    useScheduleStore.getState().toggleDone('sched-1');
    useScheduleStore.getState().resetDay();
    const first = useScheduleStore.getState().tasks[0];
    expect(first.text).toBe('Morning routine');
    expect(first.icon).toBe('🌅');
  });
});

describe('ScheduleStore — removeTask', () => {
  it('removes a specific task', () => {
    useScheduleStore.getState().removeTask('sched-3');
    const { tasks } = useScheduleStore.getState();
    expect(tasks).toHaveLength(6);
    expect(tasks.find((t) => t.id === 'sched-3')).toBeUndefined();
  });

  it('does not affect other tasks when removing', () => {
    useScheduleStore.getState().removeTask('sched-3');
    const { tasks } = useScheduleStore.getState();
    expect(tasks.find((t) => t.id === 'sched-1')).toBeDefined();
    expect(tasks.find((t) => t.id === 'sched-7')).toBeDefined();
  });

  it('removing nonexistent task is a no-op', () => {
    useScheduleStore.getState().removeTask('nonexistent');
    expect(useScheduleStore.getState().tasks).toHaveLength(7);
  });
});

describe('ScheduleStore — Task order', () => {
  it('tasks maintain their original order', () => {
    const { tasks } = useScheduleStore.getState();
    const orders = tasks.map((t) => t.order);
    expect(orders).toEqual([0, 1, 2, 3, 4, 5, 6]);
  });

  it('reorderTask updates a task order', () => {
    useScheduleStore.getState().reorderTask('sched-1', 5);
    const task = useScheduleStore.getState().tasks.find((t) => t.id === 'sched-1');
    expect(task!.order).toBe(5);
  });
});

describe('ScheduleStore — addIncomingMessage', () => {
  it('appends incoming message formatted as "Sender: text" with 💬 icon', () => {
    const id = useScheduleStore.getState().addIncomingMessage('Mom', 'hi whats up');
    expect(id).not.toBeNull();
    const task = useScheduleStore.getState().tasks.find((t) => t.id === id);
    expect(task).toBeDefined();
    expect(task!.text).toBe('Mom: hi whats up');
    expect(task!.icon).toBe('💬');
    expect(task!.kind).toBe('message');
    expect(task!.sender).toBe('Mom');
    expect(task!.done).toBe(false);
    expect(typeof task!.receivedAt).toBe('number');
  });

  it('places message after existing tasks (preserves morning-routine ordering)', () => {
    useScheduleStore.getState().addIncomingMessage('Dad', 'on my way');
    const sorted = [...useScheduleStore.getState().tasks].sort((a, b) => a.order - b.order);
    expect(sorted[sorted.length - 1].sender).toBe('Dad');
  });

  it('dedupes by externalId so polling re-delivery does not duplicate', () => {
    const first = useScheduleStore.getState().addIncomingMessage('Mom', 'hello', 'tg-msg-42');
    const second = useScheduleStore.getState().addIncomingMessage('Mom', 'hello', 'tg-msg-42');
    expect(first).not.toBeNull();
    expect(second).toBeNull();
    const matching = useScheduleStore.getState().tasks.filter((t) => t.externalId === 'tg-msg-42');
    expect(matching).toHaveLength(1);
  });

  it('rejects empty sender or empty text without polluting the schedule', () => {
    const before = useScheduleStore.getState().tasks.length;
    expect(useScheduleStore.getState().addIncomingMessage('', 'hi')).toBeNull();
    expect(useScheduleStore.getState().addIncomingMessage('Mom', '   ')).toBeNull();
    expect(useScheduleStore.getState().tasks.length).toBe(before);
  });
});
