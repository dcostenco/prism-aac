/**
 * azureTTS — isAudioContextRunning + resetSharedAudioContextIfIdle
 *
 * isAudioContextRunning() wraps the sharedAudioCtx state — it must return
 * false in a fresh jsdom context where the context has never been created.
 *
 * resetSharedAudioContextIfIdle() tears down the shared context when no
 * sources are playing — must not throw in any state.
 */
import { describe, it, expect } from 'vitest';
import { isAudioContextRunning, resetSharedAudioContextIfIdle } from '@/services/azureTTS';

describe('isAudioContextRunning', () => {
  it('returns false before any TTS has been started', () => {
    // sharedAudioCtx is null at module load — isAudioContextRunning returns false
    expect(isAudioContextRunning()).toBe(false);
  });

  it('returns a boolean', () => {
    expect(typeof isAudioContextRunning()).toBe('boolean');
  });

  it('is idempotent — calling multiple times does not throw', () => {
    expect(() => {
      isAudioContextRunning();
      isAudioContextRunning();
      isAudioContextRunning();
    }).not.toThrow();
  });
});

describe('resetSharedAudioContextIfIdle', () => {
  it('does not throw when called with no active audio context', () => {
    expect(() => resetSharedAudioContextIfIdle()).not.toThrow();
  });

  it('is idempotent — calling twice does not throw', () => {
    expect(() => {
      resetSharedAudioContextIfIdle();
      resetSharedAudioContextIfIdle();
    }).not.toThrow();
  });

  it('returns undefined', () => {
    expect(resetSharedAudioContextIfIdle()).toBeUndefined();
  });

  it('isAudioContextRunning remains false after reset', () => {
    resetSharedAudioContextIfIdle();
    expect(isAudioContextRunning()).toBe(false);
  });
});
