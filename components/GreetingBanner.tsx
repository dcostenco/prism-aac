'use client';
import { useEffect, useState, useRef } from 'react';
import { useScheduleStore } from '@/store/scheduleStore';
import { useSettingsStore } from '@/store/settingsStore';
import { useMessageStore } from '@/store/messageStore';
import { aacSpeak } from '@/services/aacSpeak';
import { useT } from '@/engine/useT';

function getTimeGreeting(t: (key: string) => string): { greeting: string; icon: string } {
  const hour = new Date().getHours();
  if (hour < 12) return { greeting: t('good_morning'), icon: '🌅' };
  if (hour < 17) return { greeting: t('good_afternoon'), icon: '☀️' };
  if (hour < 21) return { greeting: t('good_evening'), icon: '🌇' };
  return { greeting: t('good_night'), icon: '🌙' };
}

export default function GreetingBanner() {
  const [visible, setVisible] = useState(false);
  const spokenRef = useRef(false);
  const { t } = useT();
  const tasks = useScheduleStore(s => s.tasks);
  const { speechRate, speechVolume } = useSettingsStore();
  const autoSpeak = useMessageStore(s => s.autoSpeak);

  const nextTask = tasks
    .filter(task => !task.done)
    .sort((a, b) => a.order - b.order)[0];

  useEffect(() => {
    let mounted = true;
    const dismissed = sessionStorage.getItem('prism-greeting-dismissed');
    if (!dismissed) queueMicrotask(() => { if (mounted) setVisible(true); });
    return () => { mounted = false; };
  }, []);

  useEffect(() => {
    if (!visible || spokenRef.current || !autoSpeak) return;
    spokenRef.current = true;
    const { greeting } = getTimeGreeting(t);
    const speech = nextTask
      ? `${greeting}. ${t('next_is')} ${nextTask.icon} ${nextTask.textKey ? t(nextTask.textKey) : nextTask.text}`
      : greeting;
    setTimeout(() => aacSpeak(speech, speechRate, speechVolume), 500);
  }, [visible, autoSpeak, nextTask, speechRate, speechVolume, t]);

  if (!visible) return null;

  const { greeting, icon } = getTimeGreeting(t);
  const dismiss = () => {
    setVisible(false);
    sessionStorage.setItem('prism-greeting-dismissed', '1');
  };

  return (
    <div className="shrink-0 px-3 py-2 surface-bar border-b border-theme flex items-center gap-3" onClick={dismiss}>
      <span className="text-3xl">{icon}</span>
      <div className="flex-1 min-w-0">
        <p className="text-primary font-bold text-lg truncate">{greeting}</p>
        {nextTask && (
          <p className="text-muted text-sm truncate">
            {t('next_is')} {nextTask.icon} {nextTask.textKey ? t(nextTask.textKey) : nextTask.text}
          </p>
        )}
      </div>
      <button className="text-muted text-xl px-2" aria-label={t('close_panel')}>✕</button>
    </div>
  );
}
