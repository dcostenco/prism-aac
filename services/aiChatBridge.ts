/**
 * Thin bridge so Keyboard's Speak button can route to AIChatPanel's
 * submit handler when sidePanel === 'ai-chat', without prop drilling
 * or adding function state to zustand.
 */
let _handler: (() => void) | null = null;

export function registerAISubmit(fn: () => void): void {
  _handler = fn;
}

export function clearAISubmit(): void {
  _handler = null;
}

export function triggerAISubmit(): boolean {
  if (_handler) { _handler(); return true; }
  return false;
}
