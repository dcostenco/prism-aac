'use client';
import { useState, useEffect, useRef, useCallback, ReactNode } from 'react';
import { useUIStore } from '@/store/uiStore';
import { useScheduleStore, ScheduleTask } from '@/store/scheduleStore';
import { useAuthStore } from '@/store/authStore';
import { tapFeedback } from '@/services/feedback';
import { useT } from '@/engine/useT';

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

/* ── Visual Timer (circular countdown) ── */
function VisualTimer({ seconds, onComplete }: { seconds: number; onComplete: () => void }) {
  const { t } = useT();
  const [remaining, setRemaining] = useState(seconds);
  const [running, setRunning] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    setRemaining(seconds);
    setRunning(false);
    if (intervalRef.current) clearInterval(intervalRef.current);
  }, [seconds]);

  useEffect(() => {
    if (!running) return;
    intervalRef.current = setInterval(() => {
      setRemaining((r) => {
        if (r <= 1) {
          if (intervalRef.current) clearInterval(intervalRef.current);
          setRunning(false);
          onComplete();
          return 0;
        }
        return r - 1;
      });
    }, 1000);
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [running, onComplete]);

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
          onClick={() => { tapFeedback(); setRunning(!running); }}
        >
          {running ? t('stop') : t('start_timer')}
        </button>
        <button
          className="aac-btn min-w-[64px] min-h-[48px] px-4 py-2 rounded-xl surface-key text-primary font-bold border border-theme"
          onClick={() => { tapFeedback(); setRemaining(seconds); setRunning(false); }}
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
function FirstThenBoard({ tasks }: { tasks: ScheduleTask[] }) {
  const { t } = useT();
  const sorted = [...tasks].sort((a, b) => a.order - b.order);
  const currentTask = sorted.find((tsk) => !tsk.done);
  const nextTask = currentTask ? sorted.find((tsk) => !tsk.done && tsk.id !== currentTask.id) : undefined;

  const tileClass = 'flex-1 min-h-[80px] rounded-xl border-2 border-theme flex flex-col items-center justify-center p-3 gap-1';
  return (
    <div className="flex gap-3 px-4 py-3">
      <div className={`${tileClass} bg-[#E3F2FD] dark:bg-[#1A237E]`}>
        <span className="text-xs font-bold text-primary uppercase">{t('first')}</span>
        <span className="text-3xl">{currentTask?.icon ?? '✅'}</span>
        <span className="text-primary font-bold text-center text-sm">{currentTask?.text ?? t('all_done')}</span>
      </div>
      <div className={`${tileClass} bg-[#FFF3E0] dark:bg-[#E65100]`}>
        <span className="text-xs font-bold text-primary uppercase">{t('then')}</span>
        <span className="text-3xl">{nextTask?.icon ?? '🎉'}</span>
        <span className="text-primary font-bold text-center text-sm">{nextTask?.text ?? t('reward')}</span>
      </div>
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
    addTask, removeTask, toggleDone, resetDay, addReward, setTimerSeconds,
  } = useScheduleStore();

  const [addingTask, setAddingTask] = useState(false);
  const [newTaskText, setNewTaskText] = useState('');

  const isPaid = profile?.plan && profile.plan !== 'free';
  const maxTasks = isPaid ? Infinity : 5;

  const handleTimerComplete = useCallback(() => {
    addReward(1);
  }, [addReward]);

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
        <FirstThenBoard tasks={tasks} />

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

          {/* Add task input */}
          {addingTask && (
            <div className="flex gap-2 mb-3">
              <input
                type="text"
                value={newTaskText}
                onChange={(e) => setNewTaskText(e.target.value)}
                placeholder={t('add_task')}
                className="flex-1 px-3 py-2 rounded-xl border border-theme surface-key text-primary text-lg"
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
                className="aac-btn min-w-[48px] min-h-[48px] px-3 rounded-xl surface-key text-muted font-bold border border-theme"
                onClick={() => { tapFeedback(); setAddingTask(false); setNewTaskText(''); }}
              >
                ✕
              </button>
            </div>
          )}

          {/* Task rows */}
          <div className="flex flex-col gap-2">
            {sorted.map((task) => (
              <button
                key={task.id}
                className={`aac-btn min-h-[64px] w-full flex items-center gap-3 px-4 py-3 rounded-xl border border-theme select-none ${
                  task.done
                    ? 'bg-[#E8F5E9] dark:bg-[#1B5E20] opacity-70'
                    : 'surface-key'
                }`}
                onClick={() => {
                  tapFeedback();
                  if (!task.done) addReward(1);
                  toggleDone(task.id);
                }}
                aria-label={`${task.done ? t('task_done') : ''} ${task.text}`}
              >
                <span className="text-2xl shrink-0">{task.icon}</span>
                <span className={`flex-1 text-left text-primary font-bold text-lg ${task.done ? 'line-through' : ''}`}>
                  {task.text}
                </span>
                <span className="text-2xl shrink-0 motion-safe:transition-transform motion-safe:duration-300">
                  {task.done ? '✅' : '⬜'}
                </span>
                {isPaid && (
                  <button
                    className="aac-btn min-w-[40px] min-h-[40px] rounded-lg surface-key text-muted text-lg border border-theme ml-1"
                    onClick={(e) => { e.stopPropagation(); tapFeedback(); removeTask(task.id); }}
                    aria-label={t('remove')}
                  >
                    🗑
                  </button>
                )}
              </button>
            ))}
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
          <VisualTimer seconds={timerSeconds} onComplete={handleTimerComplete} />
        </div>
      </div>
    </PanelShell>
  );
}
