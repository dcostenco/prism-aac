'use client';
import { useEffect, useState } from 'react';
import { useScheduleStore } from '@/store/scheduleStore';
import { useT } from '@/engine/useT';
import { useMessageStore } from '@/store/messageStore';
import { useSettingsStore } from '@/store/settingsStore';
import { aacSpeak } from '@/services/aacSpeak';

function getTimeGreeting(t: (key: string) => string): { greeting: string; icon: string } {
  const hour = new Date().getHours();
  if (hour < 12) return { greeting: t('good_morning'), icon: '🌅' };
  if (hour < 17) return { greeting: t('good_afternoon'), icon: '☀️' };
  if (hour < 21) return { greeting: t('good_evening'), icon: '🌇' };
  return { greeting: t('good_night'), icon: '🌙' };
}

export default function GreetingBanner() {
  const [visible, setVisible] = useState(false);
  const { t } = useT();
  const tasks = useScheduleStore(s => s.tasks);

  const nextTask = tasks
    .filter(task => !task.done)
    .sort((a, b) => a.order - b.order)[0];

  useEffect(() => {
    let dismissed = false;
    try { dismissed = !!sessionStorage.getItem('prism-greeting-dismissed'); } catch { /* private context */ }
    if (!dismissed) {
      setVisible(true);
      const { soundEnabled } = useMessageStore.getState();
      const { speechRate, speechVolume } = useSettingsStore.getState();
      if (soundEnabled) {
        const { greeting: g } = getTimeGreeting(t);
        aacSpeak(g, speechRate, speechVolume);
      }
    }
  }, []);

  if (!visible) return null;

  const { greeting, icon } = getTimeGreeting(t);
  const dismiss = () => {
    setVisible(false);
    try { sessionStorage.setItem('prism-greeting-dismissed', '1'); } catch { /* private context */ }
  };

  return (
    <div className="shrink-0 px-3 py-2 surface-bar border-b border-theme flex items-center gap-3">
      <span className="text-3xl">{icon}</span>
      <div className="flex-1 min-w-0">
        <p className="text-primary font-bold text-lg truncate">{greeting}</p>
        {nextTask && (
          <p className="text-muted text-sm truncate">
            {t('next_is')} {nextTask.icon} {nextTask.textKey ? t(nextTask.textKey) : nextTask.text}
          </p>
        )}
      </div>
      <button onClick={dismiss} className="text-muted text-xl px-2 min-w-[44px] min-h-[44px] flex items-center justify-center" aria-label="Dismiss greeting">✕</button>
    </div>
  );
}
