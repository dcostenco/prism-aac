/**
 * scheduleStore — addIncomingMessage and timer actions not covered by
 * schedule-store.test.ts or schedule-store-hardening.test.ts
 *
 * The existing suites cover addTask, toggleDone, addReward, resetDay,
 * removeTask, reorderTask, editTask, markMessagesRead, setTimerSeconds,
 * and selectUnreadMessageCount. These tests cover:
 *
 *   addIncomingMessage — creates a message-kind task from a sender +
 *   text pair. Broken dedup (externalId check) causes duplicate message
 *   tiles; broken eviction drops unread messages silently; broken null
 *   return on empty input causes the UI to reference a non-existent id.
 *
 *   startTimer — sets timerEndMs to now + duration. Broken startTimer
 *   either never starts the countdown or starts it with the wrong
 *   endpoint, causing the timer UI to show the wrong remaining time.
 *
 *   resetTimer — sets timerEndMs back to 0. A broken reset leaves the
 *   timer in a permanent "running" state even after the user stops it.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { useScheduleStore, MAX_MESSAGE_TASKS } from '@/store/scheduleStore';

vi.mock('@/services/backgroundAlarmService', () => ({
  scheduleBackgroundAlarm: vi.fn().mockResolvedValue(undefined),
}));

beforeEach(() => {
  const { tasks: defaultTasks } = useScheduleStore.getState();
  useScheduleStore.setState({
    tasks: [],
    rewards: 0,
    timerSeconds: 300,
    timerEndMs: 0,
  });
  vi.clearAllMocks();
});

// ── addIncomingMessage — basic ─────────────────────────────────────────────────

describe('scheduleStore — addIncomingMessage basic', () => {
  it('returns a non-null id on success', () => {
    const id = useScheduleStore.getState().addIncomingMessage('Mom', 'Hello!');
    expect(id).not.toBeNull();
    expect(typeof id).toBe('string');
  });

  it('creates a task with kind="message"', () => {
    useScheduleStore.getState().addIncomingMessage('Mom', 'Hello!');
    const tasks = useScheduleStore.getState().tasks;
    expect(tasks).toHaveLength(1);
    expect(tasks[0].kind).toBe('message');
  });

  it('combines sender and text in the task text field', () => {
    useScheduleStore.getState().addIncomingMessage('Mom', 'Pick you up at 3');
    const task = useScheduleStore.getState().tasks[0];
    expect(task.text).toContain('Mom');
    expect(task.text).toContain('Pick you up at 3');
  });

  it('stores sender on the task', () => {
    useScheduleStore.getState().addIncomingMessage('Dad', 'Running late');
    expect(useScheduleStore.getState().tasks[0].sender).toBe('Dad');
  });

  it('task starts as unread (done=false)', () => {
    useScheduleStore.getState().addIncomingMessage('Mom', 'Hello');
    expect(useScheduleStore.getState().tasks[0].done).toBe(false);
  });

  it('sets receivedAt to a positive timestamp', () => {
    const before = Date.now();
    useScheduleStore.getState().addIncomingMessage('Mom', 'Hello');
    const ts = useScheduleStore.getState().tasks[0].receivedAt!;
    expect(ts).toBeGreaterThanOrEqual(before);
  });
});

// ── addIncomingMessage — null guards ──────────────────────────────────────────

describe('scheduleStore — addIncomingMessage null guards', () => {
  it('returns null for empty text', () => {
    const id = useScheduleStore.getState().addIncomingMessage('Mom', '');
    expect(id).toBeNull();
    expect(useScheduleStore.getState().tasks).toHaveLength(0);
  });

  it('returns null for whitespace-only text', () => {
    const id = useScheduleStore.getState().addIncomingMessage('Mom', '   ');
    expect(id).toBeNull();
  });

  it('returns null for empty sender', () => {
    const id = useScheduleStore.getState().addIncomingMessage('', 'Hello');
    expect(id).toBeNull();
    expect(useScheduleStore.getState().tasks).toHaveLength(0);
  });
});

// ── addIncomingMessage — externalId dedup ─────────────────────────────────────

describe('scheduleStore — addIncomingMessage dedup', () => {
  it('returns null for a duplicate externalId', () => {
    useScheduleStore.getState().addIncomingMessage('Mom', 'First', 'ext-001');
    const id2 = useScheduleStore.getState().addIncomingMessage('Mom', 'Second', 'ext-001');
    expect(id2).toBeNull();
    expect(useScheduleStore.getState().tasks).toHaveLength(1);
  });

  it('allows the same text from different externalIds', () => {
    useScheduleStore.getState().addIncomingMessage('Mom', 'Hello', 'ext-001');
    const id2 = useScheduleStore.getState().addIncomingMessage('Mom', 'Hello', 'ext-002');
    expect(id2).not.toBeNull();
    expect(useScheduleStore.getState().tasks).toHaveLength(2);
  });

  it('no dedup when externalId is omitted', () => {
    useScheduleStore.getState().addIncomingMessage('Mom', 'Same text');
    useScheduleStore.getState().addIncomingMessage('Mom', 'Same text');
    expect(useScheduleStore.getState().tasks).toHaveLength(2);
  });
});

// ── addIncomingMessage — eviction ─────────────────────────────────────────────

describe('scheduleStore — addIncomingMessage eviction', () => {
  it('stays at MAX_MESSAGE_TASKS after many messages', () => {
    for (let i = 0; i < MAX_MESSAGE_TASKS + 5; i++) {
      useScheduleStore.getState().addIncomingMessage('Sender', `Message ${i}`);
    }
    const msgs = useScheduleStore.getState().tasks.filter(t => t.kind === 'message');
    expect(msgs.length).toBeLessThanOrEqual(MAX_MESSAGE_TASKS);
  });

  it('evicts read messages before unread ones at cap', () => {
    // Fill to cap with read (done=true) messages
    for (let i = 0; i < MAX_MESSAGE_TASKS; i++) {
      useScheduleStore.getState().addIncomingMessage('Sender', `Read ${i}`);
    }
    // Mark all as read
    useScheduleStore.getState().markMessagesRead();

    // Add one new unread message — it should be accepted (evicting a read one)
    const newId = useScheduleStore.getState().addIncomingMessage('Mom', 'New unread');
    expect(newId).not.toBeNull();
    const msgs = useScheduleStore.getState().tasks.filter(t => t.kind === 'message');
    expect(msgs.length).toBeLessThanOrEqual(MAX_MESSAGE_TASKS);
    // The new message must still be present
    expect(msgs.some(t => t.id === newId)).toBe(true);
  });
});

// ── startTimer / resetTimer ───────────────────────────────────────────────────

describe('scheduleStore — startTimer / resetTimer', () => {
  it('startTimer sets timerEndMs to approximately now + durationSeconds * 1000', () => {
    const before = Date.now();
    useScheduleStore.getState().startTimer(60);
    const endMs = useScheduleStore.getState().timerEndMs;
    expect(endMs).toBeGreaterThanOrEqual(before + 59_000);
    expect(endMs).toBeLessThanOrEqual(before + 61_000);
  });

  it('startTimer clamps below 1 second to 1 second', () => {
    const before = Date.now();
    useScheduleStore.getState().startTimer(0);
    const endMs = useScheduleStore.getState().timerEndMs;
    expect(endMs).toBeGreaterThanOrEqual(before + 999);
  });

  it('startTimer clamps above 3600 to 3600 seconds', () => {
    const before = Date.now();
    useScheduleStore.getState().startTimer(9999);
    const endMs = useScheduleStore.getState().timerEndMs;
    expect(endMs).toBeLessThanOrEqual(before + 3601_000);
    expect(endMs).toBeGreaterThanOrEqual(before + 3599_000);
  });

  it('resetTimer sets timerEndMs to 0', () => {
    useScheduleStore.getState().startTimer(300);
    expect(useScheduleStore.getState().timerEndMs).toBeGreaterThan(0);
    useScheduleStore.getState().resetTimer();
    expect(useScheduleStore.getState().timerEndMs).toBe(0);
  });

  it('resetTimer is idempotent — calling twice does not throw', () => {
    expect(() => {
      useScheduleStore.getState().resetTimer();
      useScheduleStore.getState().resetTimer();
    }).not.toThrow();
    expect(useScheduleStore.getState().timerEndMs).toBe(0);
  });
});
