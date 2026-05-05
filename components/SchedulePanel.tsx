'use client';
import { useState, useEffect, useRef, useCallback, ReactNode } from 'react';
import { useUIStore } from '@/store/uiStore';
import { useScheduleStore, ScheduleTask } from '@/store/scheduleStore';
import { useAuthStore } from '@/store/authStore';
import { tapFeedback, playTimerRing, startAudioWarmup, stopAudioWarmup } from '@/services/feedback';
import { useT } from '@/engine/useT';

/* ── Standard activity preset library ──
 * Curated icons + names for the +Add Task dropdown. Catches the most common
 * morning/evening routine items so a Learner can compose their schedule by
 * picking from a grid instead of typing — accessibility win for non-typers.
 * Custom textKey lets i18n localize the labels if a translation exists; the
 * literal text is the en-US fallback.
 */
const ACTIVITY_PRESETS: Array<{ icon: string; text: string; textKey?: string }> = [
  { icon: '🌅', text: 'Wake up', textKey: 'sched_preset_wake' },
  { icon: '🚿', text: 'Shower', textKey: 'sched_preset_shower' },
  { icon: '🪥', text: 'Brush teeth', textKey: 'sched_preset_brush' },
  { icon: '👕', text: 'Get dressed', textKey: 'sched_preset_dress' },
  { icon: '🥣', text: 'Breakfast', textKey: 'sched_breakfast' },
  { icon: '🎒', text: 'Pack bag', textKey: 'sched_preset_pack' },
  { icon: '🏫', text: 'School', textKey: 'sched_school' },
  { icon: '🍎', text: 'Snack', textKey: 'sched_preset_snack' },
  { icon: '🍽️', text: 'Lunch', textKey: 'sched_lunch' },
  { icon: '🎈', text: 'Play time', textKey: 'sched_play' },
  { icon: '📚', text: 'Read', textKey: 'sched_preset_read' },
  { icon: '🎨', text: 'Art', textKey: 'sched_preset_art' },
  { icon: '🧩', text: 'Puzzle', textKey: 'sched_preset_puzzle' },
  { icon: '🚶', text: 'Walk', textKey: 'sched_preset_walk' },
  { icon: '🍕', text: 'Dinner', textKey: 'sched_dinner' },
  { icon: '🛁', text: 'Bath', textKey: 'sched_preset_bath' },
  { icon: '📖', text: 'Bedtime story', textKey: 'sched_preset_story' },
  { icon: '🌙', text: 'Bedtime', textKey: 'sched_bedtime' },
  { icon: '💊', text: 'Medication', textKey: 'sched_preset_meds' },
  { icon: '🦷', text: 'Floss', textKey: 'sched_preset_floss' },
  { icon: '🧹', text: 'Tidy up', textKey: 'sched_preset_tidy' },
  { icon: '🧺', text: 'Laundry', textKey: 'sched_preset_laundry' },
  { icon: '🐶', text: 'Pet care', textKey: 'sched_preset_pet' },
  { icon: '⚽', text: 'Sports', textKey: 'sched_preset_sports' },
];

/* ── First-Then state machine ──────────────────────────────────────────────
 *
 *   idle ─┐                                    ▲
 *         │ timer-complete + ring              │
 *         ▼                                    │
 *   first-armed ── FIRST click ──► first-checked
 *                                          │
 *                                  timer auto-restarts;
 *                                  on next complete + ring
 *                                          │
 *                                          ▼
 *                                     then-armed ── THEN click ──► then-checked
 *                                                                       │
 *                                                                ▼ flip current
 *                                                                  task .done = true,
 *                                                                  back to `idle`.
 *
 * The FIRST tile is always the current "current task" (first incomplete row
 * in the schedule). The THEN tile is the next-after-current. Clicking the
 * THEN tile is what marks the current task done in the schedule list and
 * advances the pair.
 */
type FirstThenPhase = 'idle' | 'first-armed' | 'first-checked' | 'then-armed' | 'then-checked';

/* ── Shared panel shell (same pattern as CategoryPanel) ── */
function PanelShell({ children }: { children: ReactNode }) {
  const { t } = useT();
  return (
    <section
      aria-label={t('schedule')}
      className="flex-[3] min-h-0 flex flex-col surface-bar border-y border-theme"
    >
      {children}
    </section>
  );
}

/* ── Visual Timer (circular countdown) ──
 *
 * `autoStartKey` is a counter the parent bumps when it wants the timer to
 * auto-restart (e.g. after the user clicks the FIRST tile, the parent bumps
 * the key and the timer kicks off again with the same duration). Using a
 * counter rather than a boolean avoids missed restarts when the parent
 * bumps twice in quick succession.
 */
function VisualTimer({
  seconds, onComplete, autoStartKey = 0,
}: { seconds: number; onComplete: () => void; autoStartKey?: number }) {
  const { t } = useT();
  const [remaining, setRemaining] = useState(seconds);
  const [running, setRunning] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const onCompleteRef = useRef(onComplete);
  useEffect(() => {
    onCompleteRef.current = onComplete;
  }, [onComplete]);

  useEffect(() => {
    let mounted = true;
    queueMicrotask(() => {
      if (mounted) {
        setRemaining(seconds);
        setRunning(false);
      }
    });
    if (intervalRef.current) clearInterval(intervalRef.current);
    return () => { mounted = false; };
  }, [seconds]);

  // Parent-driven auto-restart. Only fire on key changes > 0 so the initial
  // mount (key=0) doesn't auto-start a timer the user hasn't asked for.
  useEffect(() => {
    if (autoStartKey <= 0) return;
    setRemaining(seconds);
    setRunning(true);
  }, [autoStartKey, seconds]);

  useEffect(() => {
    if (!running) return;
    intervalRef.current = setInterval(() => {
      setRemaining((r) => {
        if (r <= 1) {
          if (intervalRef.current) clearInterval(intervalRef.current);
          setRunning(false);
          onCompleteRef.current();
          return 0;
        }
        return r - 1;
      });
    }, 1000);
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [running]);

  const pct = seconds > 0 ? remaining / seconds : 0;
  const radius = 36;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference * (1 - pct);
  const mins = Math.floor(remaining / 60);
  const secs = remaining % 60;

  return (
    <div className="flex flex-col items-center gap-2">
      <p className="text-primary font-bold text-lg">{t('visual_timer')}</p>
      <svg width="100" height="100" viewBox="0 0 100 100" className="motion-safe:transition-all">
        <circle cx="50" cy="50" r={radius} fill="none" stroke="currentColor" strokeWidth="6" className="text-dim opacity-20" />
        <circle
          cx="50" cy="50" r={radius}
          fill="none"
          stroke="currentColor"
          strokeWidth="6"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          transform="rotate(-90 50 50)"
          className="text-[#4CAF50] motion-safe:transition-[stroke-dashoffset] motion-safe:duration-1000"
        />
        <text x="50" y="55" textAnchor="middle" className="fill-primary text-lg font-bold" fontSize="18">
          {mins}:{secs.toString().padStart(2, '0')}
        </text>
      </svg>
      <div className="flex gap-2">
        <button
          className="aac-btn min-w-[64px] min-h-[48px] px-4 py-2 rounded-xl surface-key text-primary font-bold border border-theme"
          onClick={() => {
            tapFeedback();
            // Warm the AudioContext on a real user gesture so it stays
            // running through the timer's wait period — required because
            // iOS Safari/Chrome auto-suspend AudioContext after ~30s of
            // silence, which silently swallows the timer chime. We stop
            // the warmup when the timer finishes (in onComplete) or when
            // the user pauses.
            if (!running) startAudioWarmup();
            else stopAudioWarmup();
            setRunning(!running);
          }}
        >
          {running ? t('stop') : t('start_timer')}
        </button>
        <button
          className="aac-btn min-w-[64px] min-h-[48px] px-4 py-2 rounded-xl surface-key text-primary font-bold border border-theme"
          onClick={() => { tapFeedback(); setRemaining(seconds); setRunning(false); stopAudioWarmup(); }}
        >
          {t('reset')}
        </button>
      </div>
    </div>
  );
}

/* ── Token Reward Bar ── */
function TokenBar({ rewards, target }: { rewards: number; target: number }) {
  const { t } = useT();
  const pct = Math.min(1, rewards / target) * 100;
  return (
    <div className="flex items-center gap-3 px-4 py-2">
      <span className="text-primary font-bold">{t('reward')}:</span>
      <div className="flex-1 h-6 rounded-full bg-[var(--color-dim)] overflow-hidden relative">
        <div
          className="h-full bg-[#FFD700] rounded-full motion-safe:transition-all motion-safe:duration-500 flex items-center justify-end pr-2"
          style={{ width: `${pct}%` }}
        >
          {rewards > 0 && <span className="text-xs font-bold text-black">{'⭐'.repeat(Math.min(rewards, 10))}</span>}
        </div>
      </div>
      <span className="text-primary font-bold text-lg">{rewards}/{target}</span>
    </div>
  );
}

/* ── First-Then Board ── */
function FirstThenBoard({
  tasks, phase, onFirstClick, onThenClick,
}: {
  tasks: ScheduleTask[];
  phase: FirstThenPhase;
  onFirstClick: () => void;
  onThenClick: () => void;
}) {
  const { t } = useT();
  const sorted = [...tasks].sort((a, b) => a.order - b.order);
  const currentTask = sorted.find((tsk) => !tsk.done);
  const nextTask = currentTask ? sorted.find((tsk) => !tsk.done && tsk.id !== currentTask.id) : undefined;

  const firstChecked = phase === 'first-checked' || phase === 'then-armed' || phase === 'then-checked';
  const thenChecked = phase === 'then-checked';
  const firstArmed = phase === 'first-armed';
  const thenArmed = phase === 'then-armed';

  // Visual: armed → ring + scale; checked → green; idle → flat.
  // motion-safe gates the pulse so users with reduced-motion don't get the
  // throbbing animation (which can be triggering for some AAC users).
  const tileBase = 'aac-btn flex-1 min-h-[80px] rounded-xl border-2 flex flex-col items-center justify-center p-3 gap-1 motion-safe:transition-all';
  const tileFirst = firstChecked
    ? 'bg-[#E8F5E9] dark:bg-[#1B5E20] border-[#4CAF50]'
    : firstArmed
      ? 'bg-[#E3F2FD] dark:bg-[#1A237E] border-[#1976D2] ring-4 ring-[#1976D2]/40 motion-safe:animate-pulse scale-[1.03]'
      : 'bg-[#E3F2FD] dark:bg-[#1A237E] border-theme';
  const tileThen = thenChecked
    ? 'bg-[#E8F5E9] dark:bg-[#1B5E20] border-[#4CAF50]'
    : thenArmed
      ? 'bg-[#FFF3E0] dark:bg-[#E65100] border-[#F57C00] ring-4 ring-[#F57C00]/40 motion-safe:animate-pulse scale-[1.03]'
      : 'bg-[#FFF3E0] dark:bg-[#E65100] border-theme';

  return (
    <div className="flex gap-3 px-4 py-3">
      <button
        type="button"
        className={`${tileBase} ${tileFirst}`}
        onClick={() => { tapFeedback(); onFirstClick(); }}
        disabled={!firstArmed && !firstChecked}
        aria-label={`${t('first')}: ${currentTask ? (currentTask.textKey ? t(currentTask.textKey) : currentTask.text) : t('all_done')}${firstArmed ? ` — ${t('tap_to_confirm') ?? 'tap to confirm'}` : ''}`}
        aria-pressed={firstChecked}
      >
        <span className="text-xs font-bold text-primary uppercase">{t('first')}</span>
        <span className="text-3xl">{firstChecked ? '✅' : (currentTask?.icon ?? '✅')}</span>
        <span className="text-primary font-bold text-center text-sm">{currentTask ? (currentTask.textKey ? t(currentTask.textKey) : currentTask.text) : t('all_done')}</span>
      </button>
      <button
        type="button"
        className={`${tileBase} ${tileThen}`}
        onClick={() => { tapFeedback(); onThenClick(); }}
        disabled={!thenArmed && !thenChecked}
        aria-label={`${t('then')}: ${nextTask ? (nextTask.textKey ? t(nextTask.textKey) : nextTask.text) : t('reward')}${thenArmed ? ` — ${t('tap_to_confirm') ?? 'tap to confirm'}` : ''}`}
        aria-pressed={thenChecked}
      >
        <span className="text-xs font-bold text-primary uppercase">{t('then')}</span>
        <span className="text-3xl">{thenChecked ? '✅' : (nextTask?.icon ?? '🎉')}</span>
        <span className="text-primary font-bold text-center text-sm">{nextTask ? (nextTask.textKey ? t(nextTask.textKey) : nextTask.text) : t('reward')}</span>
      </button>
    </div>
  );
}

/* ── Main SchedulePanel ── */
export default function SchedulePanel() {
  const { t } = useT();
  const { sidePanel, closeSidePanel } = useUIStore();
  const profile = useAuthStore((s) => s.profile);
  const {
    tasks, rewards, timerSeconds,
    addTask, removeTask, toggleDone, editTask, resetDay, addReward, setTimerSeconds, reorderTask,
  } = useScheduleStore();

  const [addingTask, setAddingTask] = useState(false);
  const [newTaskText, setNewTaskText] = useState('');
  // Editing a single task's label inline (click pencil → text input)
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
  const [editingText, setEditingText] = useState('');
  // Drag state — null when idle, holds the dragged task id
  const [draggedTaskId, setDraggedTaskId] = useState<string | null>(null);
  const [dragOverTaskId, setDragOverTaskId] = useState<string | null>(null);

  // First-Then state machine — see comment near the FirstThenPhase type.
  const [phase, setPhase] = useState<FirstThenPhase>('idle');
  const [autoStartKey, setAutoStartKey] = useState(0);

  const isPaid = profile?.plan && profile.plan !== 'free';
  const maxTasks = isPaid ? Infinity : 5;

  const sortedTasks = [...tasks].sort((a, b) => a.order - b.order);
  const currentTaskId = sortedTasks.find((tsk) => !tsk.done)?.id;

  // Whenever the active task advances (id changes) we drop back to idle so a
  // stale "first-checked" doesn't carry over into the next pair.
  useEffect(() => {
    setPhase('idle');
  }, [currentTaskId]);

  const handleTimerComplete = useCallback(() => {
    addReward(1);
    // Cadence: timer expiring is what arms the next tile in the first-then
    // sequence. Idle → first-armed; first-checked → then-armed.
    // Repeating alarm (started by the useEffect below) kicks in via the
    // phase change, not the single-fire ring here, so missed taps don't
    // strand the user wondering whether the timer actually expired.
    setPhase((p) => {
      if (p === 'idle') return 'first-armed';
      if (p === 'first-checked') return 'then-armed';
      return p;
    });
  }, [addReward]);

  // Alarm loop — when the phase enters first-armed or then-armed, ring the
  // chime + flash the corresponding tile every 2 seconds. The single ring
  // we used to fire on timer-complete was a documented complaint: a child
  // distracted for 5 seconds missed the cue entirely. This loops up to
  // ALARM_MAX_TICKS times (60s) before giving up so we never strand a
  // running tab beeping forever.
  const ALARM_INTERVAL_MS = 2000;
  const ALARM_MAX_TICKS = 30; // ~60s ceiling
  useEffect(() => {
    const isAlarmPhase = phase === 'first-armed' || phase === 'then-armed';
    if (!isAlarmPhase) return;
    let ticks = 0;
    // Fire immediately, then every ALARM_INTERVAL_MS until the phase
    // changes (user clicked the tile) or we hit the ceiling.
    playTimerRing();
    ticks++;
    const id = setInterval(() => {
      if (ticks >= ALARM_MAX_TICKS) {
        clearInterval(id);
        return;
      }
      playTimerRing();
      ticks++;
    }, ALARM_INTERVAL_MS);
    return () => clearInterval(id);
  }, [phase]);

  const handleFirstClick = useCallback(() => {
    if (phase !== 'first-armed') return;
    setPhase('first-checked');
    // Auto-restart timer for the THEN phase. Same duration the user picked.
    setAutoStartKey((k) => k + 1);
  }, [phase]);

  const handleThenClick = useCallback(() => {
    if (phase !== 'then-armed') return;
    setPhase('then-checked');
    // Briefly show the green check on THEN, then mark the current task done
    // and let the existing currentTaskId useEffect reset us back to idle so
    // the next first-then pair (B, C) renders.
    if (currentTaskId) {
      // Slight delay so the user sees the THEN ✅ animation before the pair
      // re-renders with the next task. 600ms matches the schedule-row check
      // animation and feels intentional rather than abrupt.
      setTimeout(() => {
        toggleDone(currentTaskId);
        // Cycle complete — release the warm oscillator so we don't leak the
        // tiny background CPU hit. The next Start click will warm it again.
        stopAudioWarmup();
      }, 600);
    }
  }, [phase, currentTaskId, toggleDone]);

  // Belt + suspenders: kill the warmup on unmount so navigating away from
  // the panel doesn't leave the AudioContext warm forever.
  useEffect(() => {
    return () => { stopAudioWarmup(); };
  }, []);

  if (sidePanel !== 'schedule') return null;

  const sorted = [...tasks].sort((a, b) => a.order - b.order);
  const doneCount = tasks.filter((tsk) => tsk.done).length;

  const closeBtn = 'aac-btn w-12 h-12 rounded-xl surface-key text-muted text-2xl flex items-center justify-center border border-theme';
  const headerRow = 'flex items-center justify-between px-4 py-3 border-b border-theme shrink-0';
  const headerTitle = 'text-primary font-bold text-2xl md:text-3xl';

  return (
    <PanelShell>
      {/* Header */}
      <div className={headerRow}>
        <span className={headerTitle}>📅 {t('schedule')}</span>
        <div className="flex gap-2">
          <button
            className="aac-btn min-h-[48px] px-3 rounded-xl surface-key text-primary font-bold border border-theme text-sm"
            onClick={() => { tapFeedback(); resetDay(); }}
          >
            {t('reset_day')}
          </button>
          <button onClick={() => { tapFeedback(); closeSidePanel(); }} aria-label={t('close_panel')} className={closeBtn}>
            ✕
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto min-h-0">
        {/* First-Then Board */}
        <FirstThenBoard
          tasks={tasks}
          phase={phase}
          onFirstClick={handleFirstClick}
          onThenClick={handleThenClick}
        />

        {/* Token Reward */}
        <TokenBar rewards={rewards} target={tasks.length || 1} />

        {/* Task list */}
        <div className="px-4 pb-2">
          <div className="flex items-center justify-between mb-2">
            <span className="text-primary font-bold text-lg">{t('tasks')} ({doneCount}/{tasks.length})</span>
            {tasks.length < maxTasks && (
              <button
                className="aac-btn min-w-[64px] min-h-[48px] px-3 py-2 rounded-xl surface-key text-primary font-bold border border-theme text-sm"
                onClick={() => { tapFeedback(); setAddingTask(true); }}
              >
                + {t('add_task')}
              </button>
            )}
            {tasks.length >= maxTasks && !isPaid && (
              <span className="text-muted text-xs">{t('upgrade_for_more')}</span>
            )}
          </div>

          {/* Add task — preset grid + custom input */}
          {addingTask && (
            <div className="mb-3 p-3 rounded-xl border border-theme surface-key">
              <div className="text-primary font-bold text-sm mb-2">{t('pick_activity') ?? 'Pick an activity'}</div>
              <div className="grid grid-cols-4 sm:grid-cols-6 gap-2 mb-3">
                {ACTIVITY_PRESETS.map((preset) => (
                  <button
                    key={preset.text}
                    type="button"
                    className="aac-btn min-h-[64px] flex flex-col items-center justify-center p-2 rounded-xl border border-theme surface-bar text-primary"
                    onClick={() => {
                      tapFeedback();
                      addTask(
                        preset.textKey ? t(preset.textKey) : preset.text,
                        preset.icon,
                        preset.textKey,
                      );
                      setAddingTask(false);
                      setNewTaskText('');
                    }}
                    aria-label={preset.textKey ? t(preset.textKey) : preset.text}
                  >
                    <span className="text-2xl">{preset.icon}</span>
                    <span className="text-xs font-bold mt-1 text-center leading-tight">
                      {preset.textKey ? t(preset.textKey) : preset.text}
                    </span>
                  </button>
                ))}
              </div>
              <div className="text-primary font-bold text-sm mb-2">{t('or_custom') ?? 'Or type your own:'}</div>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={newTaskText}
                  onChange={(e) => setNewTaskText(e.target.value)}
                  placeholder={t('add_task')}
                  className="flex-1 px-3 py-2 rounded-xl border border-theme surface-bar text-primary text-lg"
                  autoFocus
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && newTaskText.trim()) {
                      addTask(newTaskText.trim(), '📌');
                      setNewTaskText('');
                      setAddingTask(false);
                    }
                  }}
                />
                <button
                  className="aac-btn min-w-[64px] min-h-[48px] px-4 rounded-xl bg-[#4CAF50] text-white font-bold border-transparent"
                  onClick={() => {
                    tapFeedback();
                    if (newTaskText.trim()) {
                      addTask(newTaskText.trim(), '📌');
                      setNewTaskText('');
                      setAddingTask(false);
                    }
                  }}
                >
                  {t('add')}
                </button>
                <button
                  className="aac-btn min-w-[48px] min-h-[48px] px-3 rounded-xl surface-bar text-muted font-bold border border-theme"
                  onClick={() => { tapFeedback(); setAddingTask(false); setNewTaskText(''); }}
                  aria-label={t('cancel') ?? 'Cancel'}
                >
                  ✕
                </button>
              </div>
            </div>
          )}

          {/* Task rows — draggable, editable, with done toggle */}
          <div className="flex flex-col gap-2">
            {sorted.map((task) => {
              const isEditing = editingTaskId === task.id;
              const isDragOver = dragOverTaskId === task.id && draggedTaskId !== task.id;
              const label = task.textKey ? t(task.textKey) : task.text;
              const rowClass = `aac-btn min-h-[64px] w-full flex items-center gap-3 px-4 py-3 rounded-xl border select-none motion-safe:transition-all ${
                task.done
                  ? 'bg-[#E8F5E9] dark:bg-[#1B5E20] opacity-70 border-theme'
                  : 'surface-key border-theme'
              } ${isDragOver ? 'border-[#1976D2] border-2 bg-[#E3F2FD] dark:bg-[#1A237E]' : ''} ${
                draggedTaskId === task.id ? 'opacity-40' : ''
              }`;

              return (
                <div
                  key={task.id}
                  draggable={!isEditing && !task.done}
                  onDragStart={(e) => {
                    setDraggedTaskId(task.id);
                    // Some browsers need data set or the drag is rejected
                    e.dataTransfer.effectAllowed = 'move';
                    try { e.dataTransfer.setData('text/plain', task.id); } catch { /* */ }
                  }}
                  onDragOver={(e) => {
                    if (!draggedTaskId || draggedTaskId === task.id) return;
                    e.preventDefault();
                    e.dataTransfer.dropEffect = 'move';
                    setDragOverTaskId(task.id);
                  }}
                  onDragLeave={() => {
                    setDragOverTaskId((id) => (id === task.id ? null : id));
                  }}
                  onDrop={(e) => {
                    e.preventDefault();
                    if (draggedTaskId && draggedTaskId !== task.id) {
                      reorderTask(draggedTaskId, task.order);
                      tapFeedback();
                    }
                    setDraggedTaskId(null);
                    setDragOverTaskId(null);
                  }}
                  onDragEnd={() => {
                    setDraggedTaskId(null);
                    setDragOverTaskId(null);
                  }}
                  className={rowClass}
                >
                  {/* Drag handle — visible affordance for the drag target */}
                  {!task.done && (
                    <span
                      className="text-muted text-lg shrink-0 cursor-grab select-none"
                      aria-hidden="true"
                      title={t('drag_to_reorder') ?? 'Drag to reorder'}
                    >
                      ⋮⋮
                    </span>
                  )}
                  <span className="text-2xl shrink-0">{task.icon}</span>

                  {isEditing ? (
                    <input
                      type="text"
                      value={editingText}
                      onChange={(e) => setEditingText(e.target.value)}
                      onBlur={() => {
                        const trimmed = editingText.trim();
                        if (trimmed && trimmed !== label) {
                          // Custom edit drops the i18n binding (textKey: null)
                          editTask(task.id, { text: trimmed, textKey: null });
                        }
                        setEditingTaskId(null);
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') (e.currentTarget as HTMLInputElement).blur();
                        if (e.key === 'Escape') { setEditingTaskId(null); }
                      }}
                      className="flex-1 px-2 py-1 rounded-lg border border-theme surface-bar text-primary text-lg"
                      autoFocus
                      onClick={(e) => e.stopPropagation()}
                      aria-label={t('edit_task') ?? 'Edit task'}
                    />
                  ) : (
                    <button
                      type="button"
                      onClick={() => {
                        tapFeedback();
                        if (!task.done) addReward(1);
                        toggleDone(task.id);
                      }}
                      className={`flex-1 text-left text-primary font-bold text-lg bg-transparent border-0 p-0 ${task.done ? 'line-through' : ''}`}
                      aria-label={`${task.done ? t('task_done') : ''} ${label}`}
                    >
                      {label}
                    </button>
                  )}

                  {!isEditing && (
                    <button
                      type="button"
                      className="aac-btn min-w-[40px] min-h-[40px] rounded-lg surface-bar text-muted text-base border border-theme ml-1"
                      onClick={(e) => {
                        e.stopPropagation();
                        tapFeedback();
                        setEditingText(label);
                        setEditingTaskId(task.id);
                      }}
                      aria-label={t('edit') ?? 'Edit'}
                      title={t('edit') ?? 'Edit'}
                    >
                      ✏️
                    </button>
                  )}

                  <span className="text-2xl shrink-0 motion-safe:transition-transform motion-safe:duration-300">
                    {task.done ? '✅' : '⬜'}
                  </span>
                  {isPaid && (
                    <button
                      type="button"
                      className="aac-btn min-w-[40px] min-h-[40px] rounded-lg surface-bar text-muted text-lg border border-theme ml-1"
                      onClick={(e) => { e.stopPropagation(); tapFeedback(); removeTask(task.id); }}
                      aria-label={t('remove')}
                    >
                      🗑
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Visual Timer */}
        <div className="px-4 py-4 border-t border-theme">
          <div className="flex items-center gap-3 mb-3">
            <label className="text-primary font-bold text-sm" htmlFor="timer-duration">{t('timer_duration')}:</label>
            <select
              id="timer-duration"
              className="px-3 py-2 rounded-xl border border-theme surface-key text-primary min-h-[48px]"
              value={timerSeconds}
              onChange={(e) => { tapFeedback(); setTimerSeconds(Number(e.target.value)); }}
            >
              <option value={60}>1 min</option>
              <option value={120}>2 min</option>
              <option value={300}>5 min</option>
              <option value={600}>10 min</option>
              <option value={900}>15 min</option>
            </select>
          </div>
          <VisualTimer
            seconds={timerSeconds}
            onComplete={handleTimerComplete}
            autoStartKey={autoStartKey}
          />
        </div>
      </div>
    </PanelShell>
  );
}
