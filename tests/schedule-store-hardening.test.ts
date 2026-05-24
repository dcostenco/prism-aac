/**
 * scheduleStore — hardening: message inbox, edit, rewards, timer, reorder.
 *
 * The missing paths from schedule-store.test.ts that carry real risk:
 *
 *   - addIncomingMessage eviction: when the inbox hits MAX_MESSAGE_TASKS (100),
 *     the oldest READ message must be dropped so new ones still arrive.  A
 *     broken eviction silently stops delivering caregiver messages — the child's
 *     ONLY channel for receiving information from their support team.
 *
 *   - selectUnreadMessageCount / markMessagesRead: drive the toolbar badge that
 *     tells the AAC user new messages are waiting. A stuck count or a mark that
 *     leaks into task items would show a phantom badge the child can't dismiss.
 *
 *   - editTask: caregivers rename schedule items in place.  Broken edit silently
 *     truncates or clears the user's custom schedule.
 *
 *   - reorderTask shift logic: surrounding tasks must shift when one moves past
 *     them. Only the target-order update was previously tested, not the cascading
 *     shifts.
 *
 *   - addReward / setTimerSeconds clamping: NaN / 0 / out-of-range inputs reach
 *     these actions from UI sliders; unclamped values produce frozen timers or
 *     absurd reward totals.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import {
  useScheduleStore,
  selectUnreadMessageCount,
  MAX_MESSAGE_TASKS,
  type ScheduleTask,
} from '@/store/scheduleStore';

const CLEAN_STATE = {
  tasks: [
    { id: 't1', text: 'Morning', icon: '🌅', done: false, order: 0 },
    { id: 't2', text: 'School',  icon: '🏫', done: false, order: 1 },
    { id: 't3', text: 'Lunch',   icon: '🍽️', done: false, order: 2 },
    { id: 't4', text: 'Dinner',  icon: '🍕', done: false, order: 3 },
    { id: 't5', text: 'Bed',     icon: '🌙', done: false, order: 4 },
  ],
  rewards: 0,
  timerSeconds: 300,
  timerEndMs: 0,
};

beforeEach(() => {
  useScheduleStore.setState(CLEAN_STATE);
});

// ── selectUnreadMessageCount ──────────────────────────────────────────────────

describe('selectUnreadMessageCount', () => {
  it('returns 0 when there are no messages', () => {
    const state = useScheduleStore.getState();
    expect(selectUnreadMessageCount(state)).toBe(0);
  });

  it('counts only unread message-kind tasks', () => {
    useScheduleStore.getState().addIncomingMessage('Mom', 'hello');
    useScheduleStore.getState().addIncomingMessage('Dad', 'call me');
    const state = useScheduleStore.getState();
    expect(selectUnreadMessageCount(state)).toBe(2);
  });

  it('does not count task-kind (schedule) items', () => {
    // All 5 tasks in CLEAN_STATE have no kind (defaults to task)
    const state = useScheduleStore.getState();
    expect(selectUnreadMessageCount(state)).toBe(0);
  });

  it('does not count done messages', () => {
    useScheduleStore.getState().addIncomingMessage('Mom', 'hello');
    useScheduleStore.getState().markMessagesRead();
    const state = useScheduleStore.getState();
    expect(selectUnreadMessageCount(state)).toBe(0);
  });

  it('counts only unread portion when mixed', () => {
    useScheduleStore.getState().addIncomingMessage('Mom', 'hello');
    useScheduleStore.getState().addIncomingMessage('Dad', 'hi');
    // Mark Mom's message done by marking all, then manually un-mark Dad's...
    // Simpler: add 2 messages, mark read, then add 1 more unread
    useScheduleStore.getState().markMessagesRead();
    useScheduleStore.getState().addIncomingMessage('Nurse', 'snack time');
    const state = useScheduleStore.getState();
    expect(selectUnreadMessageCount(state)).toBe(1);
  });
});

// ── markMessagesRead ──────────────────────────────────────────────────────────

describe('scheduleStore — markMessagesRead', () => {
  it('marks all unread message tasks as done', () => {
    useScheduleStore.getState().addIncomingMessage('Mom', 'hi');
    useScheduleStore.getState().addIncomingMessage('Dad', 'call me');
    useScheduleStore.getState().markMessagesRead();
    const msgs = useScheduleStore.getState().tasks.filter(t => t.kind === 'message');
    expect(msgs.every(t => t.done)).toBe(true);
  });

  it('does not affect regular task-kind items', () => {
    useScheduleStore.getState().addIncomingMessage('Mom', 'hi');
    useScheduleStore.getState().markMessagesRead();
    const regular = useScheduleStore.getState().tasks.filter(t => t.kind !== 'message');
    expect(regular.every(t => !t.done)).toBe(true);
  });

  it('is idempotent — second call leaves state unchanged', () => {
    useScheduleStore.getState().addIncomingMessage('Mom', 'hi');
    useScheduleStore.getState().markMessagesRead();
    const after1 = useScheduleStore.getState().tasks.map(t => t.done);
    useScheduleStore.getState().markMessagesRead();
    const after2 = useScheduleStore.getState().tasks.map(t => t.done);
    expect(after1).toEqual(after2);
  });
});

// ── editTask ──────────────────────────────────────────────────────────────────

describe('scheduleStore — editTask', () => {
  it('updates text when patch.text is provided', () => {
    useScheduleStore.getState().editTask('t1', { text: 'Breakfast' });
    const t = useScheduleStore.getState().tasks.find(t => t.id === 't1')!;
    expect(t.text).toBe('Breakfast');
  });

  it('updates icon when patch.icon is provided', () => {
    useScheduleStore.getState().editTask('t1', { icon: '🍳' });
    const t = useScheduleStore.getState().tasks.find(t => t.id === 't1')!;
    expect(t.icon).toBe('🍳');
  });

  it('clears textKey when patch.textKey is null', () => {
    useScheduleStore.setState({
      tasks: [{ id: 'kx', text: 'Morning', icon: '🌅', done: false, order: 0, textKey: 'sched_morning' }],
    });
    useScheduleStore.getState().editTask('kx', { textKey: null });
    const t = useScheduleStore.getState().tasks.find(t => t.id === 'kx')!;
    expect(t.textKey).toBeUndefined();
  });

  it('sets textKey when patch.textKey is a string', () => {
    useScheduleStore.getState().editTask('t1', { textKey: 'sched_custom' });
    const t = useScheduleStore.getState().tasks.find(t => t.id === 't1')!;
    expect(t.textKey).toBe('sched_custom');
  });

  it('leaves textKey unchanged when patch.textKey is undefined', () => {
    useScheduleStore.setState({
      tasks: [{ id: 'kx', text: 'Morning', icon: '🌅', done: false, order: 0, textKey: 'sched_morning' }],
    });
    useScheduleStore.getState().editTask('kx', { text: 'New name' });
    const t = useScheduleStore.getState().tasks.find(t => t.id === 'kx')!;
    expect(t.textKey).toBe('sched_morning'); // preserved
  });

  it('clamps text to 500 chars', () => {
    const huge = 'x'.repeat(1000);
    useScheduleStore.getState().editTask('t1', { text: huge });
    const t = useScheduleStore.getState().tasks.find(t => t.id === 't1')!;
    expect(t.text.length).toBeLessThanOrEqual(500);
  });

  it('clamps icon to 16 chars', () => {
    const longIcon = '🎉'.repeat(20); // 20 emoji
    useScheduleStore.getState().editTask('t1', { icon: longIcon });
    const t = useScheduleStore.getState().tasks.find(t => t.id === 't1')!;
    expect(t.icon.length).toBeLessThanOrEqual(16);
  });

  it('does not modify other tasks', () => {
    useScheduleStore.getState().editTask('t1', { text: 'Changed' });
    const t2 = useScheduleStore.getState().tasks.find(t => t.id === 't2')!;
    expect(t2.text).toBe('School');
  });
});

// ── addReward edge cases ──────────────────────────────────────────────────────

describe('scheduleStore — addReward edge cases', () => {
  it('NaN count defaults to 1', () => {
    useScheduleStore.getState().addReward(NaN);
    expect(useScheduleStore.getState().rewards).toBe(1);
  });

  it('0 count is treated as 1 (|| 1 fallback)', () => {
    useScheduleStore.getState().addReward(0);
    // Math.floor(Number(0)) = 0 → 0 || 1 = 1
    expect(useScheduleStore.getState().rewards).toBe(1);
  });

  it('caps total rewards at 999', () => {
    useScheduleStore.setState({ ...CLEAN_STATE, rewards: 998 });
    useScheduleStore.getState().addReward(10);
    expect(useScheduleStore.getState().rewards).toBe(999);
  });

  it('negative count is treated as 0 — no subtraction', () => {
    useScheduleStore.getState().addReward(2);
    useScheduleStore.getState().addReward(-5);
    // Math.max(0, Math.floor(-5)) = Math.max(0, -5) = 0 → 0 || 1 = 1?
    // Actually: Math.floor(Number(-5)) = -5, Math.max(0, -5) = 0
    // Then 0 || 1 = 1... wait: the code is Math.max(0, Math.floor(Number(count) || 1))
    // Number(-5) = -5, -5 || 1 = -5 (truthy), Math.floor(-5) = -5, Math.max(0, -5) = 0
    // So negative adds 0, total stays at 2
    expect(useScheduleStore.getState().rewards).toBe(2);
  });
});

// ── setTimerSeconds edge cases ────────────────────────────────────────────────

describe('scheduleStore — setTimerSeconds edge cases', () => {
  it('clamps to 1 for NaN input', () => {
    useScheduleStore.getState().setTimerSeconds(NaN);
    expect(useScheduleStore.getState().timerSeconds).toBe(1);
  });

  it('clamps to 1 for 0 input (|| 1 fallback)', () => {
    useScheduleStore.getState().setTimerSeconds(0);
    expect(useScheduleStore.getState().timerSeconds).toBe(1);
  });

  it('clamps to 3600 for inputs above 3600', () => {
    useScheduleStore.getState().setTimerSeconds(9999);
    expect(useScheduleStore.getState().timerSeconds).toBe(3600);
  });

  it('floors fractional seconds', () => {
    useScheduleStore.getState().setTimerSeconds(90.9);
    expect(useScheduleStore.getState().timerSeconds).toBe(90);
  });

  it('accepts exactly 300 (default)', () => {
    useScheduleStore.getState().setTimerSeconds(300);
    expect(useScheduleStore.getState().timerSeconds).toBe(300);
  });
});

// ── reorderTask — shift logic ─────────────────────────────────────────────────

describe('scheduleStore — reorderTask shift logic', () => {
  // Clean state has tasks t1..t5 with orders 0..4
  // Moving DOWN: t1 (order 0) → order 3: tasks with order 1,2,3 shift to 0,1,2
  it('shifts intermediate tasks DOWN when moving a task forward', () => {
    useScheduleStore.getState().reorderTask('t1', 3);
    const state = useScheduleStore.getState();
    const byId = Object.fromEntries(state.tasks.map(t => [t.id, t.order]));
    expect(byId['t1']).toBe(3); // moved task
    expect(byId['t2']).toBe(0); // shifted down (was 1 → 1-1=0)
    expect(byId['t3']).toBe(1); // shifted down (was 2 → 2-1=1)
    expect(byId['t4']).toBe(2); // shifted down (was 3 → 3-1=2)
    expect(byId['t5']).toBe(4); // outside range — unchanged
  });

  // Moving UP: t4 (order 3) → order 1: tasks with order 1,2 shift to 2,3
  it('shifts intermediate tasks UP when moving a task backward', () => {
    useScheduleStore.getState().reorderTask('t4', 1);
    const state = useScheduleStore.getState();
    const byId = Object.fromEntries(state.tasks.map(t => [t.id, t.order]));
    expect(byId['t4']).toBe(1); // moved task
    expect(byId['t2']).toBe(2); // shifted up (was 1 → 1+1=2)
    expect(byId['t3']).toBe(3); // shifted up (was 2 → 2+1=3)
    expect(byId['t1']).toBe(0); // outside range — unchanged
    expect(byId['t5']).toBe(4); // outside range — unchanged
  });

  it('no-op when task id does not exist', () => {
    const before = useScheduleStore.getState().tasks.map(t => t.order);
    useScheduleStore.getState().reorderTask('nonexistent', 2);
    const after = useScheduleStore.getState().tasks.map(t => t.order);
    expect(after).toEqual(before);
  });

  it('same-order reorder leaves all tasks unchanged', () => {
    const before = useScheduleStore.getState().tasks.map(t => ({ id: t.id, order: t.order }));
    useScheduleStore.getState().reorderTask('t1', 0); // same position
    const after = useScheduleStore.getState().tasks.map(t => ({ id: t.id, order: t.order }));
    expect(after).toEqual(before);
  });
});

// ── addIncomingMessage — eviction at cap ──────────────────────────────────────

describe('scheduleStore — addIncomingMessage eviction at MAX_MESSAGE_TASKS', () => {
  it('evicts the oldest read message when inbox is at MAX_MESSAGE_TASKS cap', () => {
    // Build exactly MAX_MESSAGE_TASKS message tasks.
    // First half are read (done=true), second half are unread.
    // receivedAt increases so msg-0 is the oldest read message.
    const messages: ScheduleTask[] = Array.from({ length: MAX_MESSAGE_TASKS }, (_, i) => ({
      id: `msg-${i}`,
      text: `Sender: msg ${i}`,
      icon: '💬' as const,
      done: i < MAX_MESSAGE_TASKS / 2,   // first half read, second half unread
      order: i,
      kind: 'message' as const,
      sender: 'Sender',
      receivedAt: 1000 * (i + 1),        // msg-0 is oldest (receivedAt=1000)
    }));
    useScheduleStore.setState({ tasks: messages, rewards: 0, timerSeconds: 300, timerEndMs: 0 });

    const newId = useScheduleStore.getState().addIncomingMessage('Bob', 'new one');
    expect(newId).not.toBeNull();

    const msgTasks = useScheduleStore.getState().tasks.filter(t => t.kind === 'message');
    // Still at cap — one dropped, one added
    expect(msgTasks).toHaveLength(MAX_MESSAGE_TASKS);
    // Oldest read message (msg-0) was dropped
    expect(msgTasks.find(t => t.id === 'msg-0')).toBeUndefined();
    // Most-recent read message still present
    expect(msgTasks.find(t => t.id === `msg-${MAX_MESSAGE_TASKS / 2 - 1}`)).toBeDefined();
    // New message present
    const newMsg = msgTasks.find(t => t.text === 'Bob: new one');
    expect(newMsg).toBeDefined();
  });

  it('allows adding when inbox is below MAX_MESSAGE_TASKS', () => {
    for (let i = 0; i < MAX_MESSAGE_TASKS - 1; i++) {
      useScheduleStore.getState().addIncomingMessage(`S${i}`, `msg ${i}`);
    }
    // One slot below cap — should succeed without eviction
    const id = useScheduleStore.getState().addIncomingMessage('Last', 'final');
    expect(id).not.toBeNull();
    const msgCount = useScheduleStore.getState().tasks.filter(t => t.kind === 'message').length;
    expect(msgCount).toBe(MAX_MESSAGE_TASKS);
  });
});
