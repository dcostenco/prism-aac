'use client';
import { useEffect, useState, useRef } from 'react';
import { useScheduleStore } from '@/store/scheduleStore';
import { useSettingsStore } from '@/store/settingsStore';
import { useMessageStore } from '@/store/messageStore';
import { aacSpeak } from '@/services/aacSpeak';
import { useT } from '@/engine/useT';

/**
 * 500ms pre-speak window after banner appears. Long enough that the
 * banner finishes mounting + layout settles before TTS fires; short
 * enough that the user usually doesn't have time to tap a tile in
 * between. The overlap-with-tile-press bug ("schedule + I" mash) was
 * caused by no cleanup on this timer — when the user DID interact in
 * the window, the banner speech still played, overlapping with their
 * own composition speech. Fixed by reading the latest message-store
 * text inside the timer and bailing if the user has started composing.
 */
const BANNER_PRESPEAK_DELAY_MS = 500;

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
    // If the user already started composing before the banner mounted
    // (e.g. they tapped a Quick Cart tile during page hydration), skip
    // the banner speech entirely — the banner is informational; the
    // user's own composition takes priority.
    if (useMessageStore.getState().text.trim()) {
      spokenRef.current = true;
      return;
    }
    spokenRef.current = true;
    const { greeting } = getTimeGreeting(t);
    const speech = nextTask
      ? `${greeting}. ${t('next_is')} ${nextTask.icon} ${nextTask.textKey ? t(nextTask.textKey) : nextTask.text}`
      : greeting;
    const timerId = setTimeout(() => {
      // Last-ditch check: user may have tapped a tile DURING the 500ms
      // pre-speak window. Read the latest store value (the closure
      // captured an older snapshot) and bail if so. Without this the
      // banner's "Next is School" played simultaneously with the tile's
      // word, mashing into "schedule i" in the user's ear.
      if (useMessageStore.getState().text.trim()) return;
      aacSpeak(speech, speechRate, speechVolume);
    }, BANNER_PRESPEAK_DELAY_MS);
    return () => clearTimeout(timerId);
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
