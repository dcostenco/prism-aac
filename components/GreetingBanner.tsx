'use client';
import { useEffect, useState, useRef } from 'react';
import { useScheduleStore } from '@/store/scheduleStore';
import { useSettingsStore } from '@/store/settingsStore';
import { useMessageStore } from '@/store/messageStore';
import { aacSpeak } from '@/services/aacSpeak';
import { stopSpeech } from '@/services/speechService';
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
// Banner utterances are short ("Good afternoon, next is School" ≈ 3s).
// 5s is a comfortable upper bound during which a text-change event
// could plausibly belong to "user interrupting banner". After this,
// any subsequent text change is unrelated to banner — don't yank
// stopSpeech() on USER speech (which would chop user-initiated TTS).
const BANNER_SPEECH_WINDOW_MS = 5000;

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
  // Timestamp until which any text-change should be treated as
  // "interrupting banner speech" → call stopSpeech(). Outside this
  // window we leave speech alone so we don't kill subsequent USER-
  // initiated TTS (e.g. acceptSuggestion's aacSpeak fired after the
  // banner has long finished). Set to Date.now() + WINDOW when banner
  // aacSpeak fires; cleared when stopSpeech is invoked or after the
  // window naturally elapses.
  const bannerSpeechUntilRef = useRef(0);
  const { t } = useT();
  const tasks = useScheduleStore(s => s.tasks);
  const { speechRate, speechVolume } = useSettingsStore();
  const autoSpeak = useMessageStore(s => s.autoSpeak);
  // Subscribed text — drives the cancel-in-flight effect below. We need
  // a reactive subscription (not just getState() reads) so mid-speech
  // composition triggers stopSpeech().
  const messageText = useMessageStore(s => s.text);

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
      if (useMessageStore.getState().text.trim()) return;
      aacSpeak(speech, speechRate, speechVolume);
      // Mark "banner speech in flight" for the cancellation window
      // below. Cleared after BANNER_SPEECH_WINDOW_MS — banner
      // utterances are at most ~3s; after the window, assume natural
      // completion so we don't interfere with subsequent USER speech.
      bannerSpeechUntilRef.current = Date.now() + BANNER_SPEECH_WINDOW_MS;
    }, BANNER_PRESPEAK_DELAY_MS);
    return () => clearTimeout(timerId);
  }, [visible, autoSpeak, nextTask, speechRate, speechVolume, t]);

  // Cancel in-flight banner speech if the user starts composing AFTER
  // the announcement has already begun playing — but ONLY within the
  // banner's own active window. Previously this called stopSpeech() on
  // ANY text change, which also yanked legitimate user speech (e.g.
  // acceptSuggestion's aacSpeak fired during a setText, the text-change
  // effect ran on the same render and stopSpeech killed the user's TTS
  // mid-utterance — user heard "I want" instead of the full "I want to").
  // The window check restricts cancellation to the brief period when
  // banner speech could plausibly still be playing.
  useEffect(() => {
    if (
      spokenRef.current
      && messageText.trim()
      && Date.now() < bannerSpeechUntilRef.current
    ) {
      stopSpeech();
      bannerSpeechUntilRef.current = 0;
    }
  }, [messageText]);

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
