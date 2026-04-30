export function isSpeechSupported(): boolean {
  return typeof window !== 'undefined' && 'speechSynthesis' in window;
}

let resumeInterval: ReturnType<typeof setInterval> | null = null;

function clearResumeWorkaround() {
  if (resumeInterval) { clearInterval(resumeInterval); resumeInterval = null; }
}

export function speak(text: string, rate = 0.5, volume = 1.0, lang = 'en-US'): void {
  if (!isSpeechSupported() || !text.trim()) return;
  window.speechSynthesis.cancel();
  clearResumeWorkaround();
  const u = new SpeechSynthesisUtterance(text);
  u.rate = 0.1 + rate * 1.8;
  u.volume = volume;
  u.lang = lang;
  u.onend = clearResumeWorkaround;
  u.onerror = clearResumeWorkaround;
  resumeInterval = setInterval(() => window.speechSynthesis.resume(), 10_000);
  window.speechSynthesis.speak(u);
}

export function speakWord(word: string, rate = 0.5, volume = 1.0, lang = 'en-US'): void {
  if (!isSpeechSupported() || !word.trim()) return;
  window.speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(word);
  u.rate = 0.1 + rate * 1.8;
  u.volume = volume;
  u.lang = lang;
  window.speechSynthesis.speak(u);
}

export function stopSpeech(): void {
  if (isSpeechSupported()) window.speechSynthesis.cancel();
  clearResumeWorkaround();
}
