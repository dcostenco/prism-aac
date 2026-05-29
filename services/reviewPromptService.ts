/**
 * reviewPromptService — triggers App Store review prompts via the native bridge.
 *
 * The native side (ContentView.swift maybeRequestAppStoreReview) already has
 * frequency limiting (count gate + 60-day cooldown), so calling requestReview()
 * from JS is safe to do at any strategic moment. The native side will no-op
 * if conditions aren't met.
 *
 * Web-side trigger points:
 *   1. After completing 3 math exercises (Check/Solve with non-error result)
 *   2. After using the app for 7+ consecutive days (first-use date in localStorage)
 */

const FIRST_USE_KEY = 'prism_first_use_date';
const MATH_COMPLETE_KEY = 'prism_math_complete_count';

/** Whether the native bridge requestReview method is available. */
function hasNativeBridge(): boolean {
  return typeof window !== 'undefined' && !!(window as any).prismNativeBridge?.requestReview;
}

/** Send a review request to the native bridge. No-ops on web (non-iOS). */
function sendRequestReview(): void {
  if (!hasNativeBridge()) return;
  try {
    (window as any).prismNativeBridge.requestReview();
  } catch {
    // Bridge unavailable — silently ignore.
  }
}

/**
 * Record the first-use date if not already set.
 * Call this once at app startup.
 */
export function recordFirstUse(): void {
  if (typeof window === 'undefined') return;
  if (!localStorage.getItem(FIRST_USE_KEY)) {
    localStorage.setItem(FIRST_USE_KEY, new Date().toISOString());
  }
}

/**
 * Check if the user has been using the app for 7+ consecutive days
 * and trigger a review prompt if so.
 * Call this at app startup (after recordFirstUse).
 */
export function checkDaysUsedReview(): void {
  if (!hasNativeBridge()) return;
  const firstUse = localStorage.getItem(FIRST_USE_KEY);
  if (!firstUse) return;

  const firstDate = new Date(firstUse);
  if (isNaN(firstDate.getTime())) return;

  const now = new Date();
  const diffMs = now.getTime() - firstDate.getTime();
  const diffDays = diffMs / (1000 * 60 * 60 * 24);

  if (diffDays >= 7) {
    sendRequestReview();
  }
}

/**
 * Record a completed math exercise (successful Check or Solve).
 * Triggers a review prompt after every 3rd completion.
 */
export function recordMathExerciseComplete(): void {
  if (typeof window === 'undefined') return;
  const prev = parseInt(localStorage.getItem(MATH_COMPLETE_KEY) || '0', 10);
  const next = (isNaN(prev) ? 0 : prev) + 1;
  localStorage.setItem(MATH_COMPLETE_KEY, String(next));

  if (next >= 3 && next % 3 === 0) {
    sendRequestReview();
  }
}
