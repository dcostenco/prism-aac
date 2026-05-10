'use client';
/**
 * searchKeyBridge — routes on-screen keyboard key presses to the
 * category search input when search is active.
 *
 * The Keyboard component always calls appendChar() on the message store.
 * When the category search bar is open, those presses should update the
 * search query instead. This module provides a lightweight pub/sub so
 * CategoryPanel can register its handler and Keyboard can check it
 * without either component needing to know about the other.
 */

type SearchKeyHandler = (char: string) => void;
let _handler: SearchKeyHandler | null = null;

/** CategoryPanel calls this when search opens (pass handler) or closes (pass null). */
export function registerSearchKeyHandler(fn: SearchKeyHandler | null): void {
  _handler = fn;
}

/**
 * Keyboard calls this before appendChar.
 * Returns true if the key was consumed by search mode (caller must NOT
 * call appendChar). Returns false if normal message-bar path should run.
 */
export function dispatchToSearch(char: string): boolean {
  if (!_handler) return false;
  _handler(char);
  return true;
}

/** True when search is currently intercepting keyboard input. */
export function isSearchKeyActive(): boolean {
  return _handler !== null;
}
