/**
 * aiChatBridge — Keyboard → AIChatPanel submit routing
 *
 * Covers: triggerAISubmit with no handler, register + trigger, clearAISubmit,
 * re-register replaces previous handler, handler called exactly once per trigger.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  registerAISubmit,
  clearAISubmit,
  triggerAISubmit,
} from '@/services/aiChatBridge';

beforeEach(() => {
  clearAISubmit();
  vi.clearAllMocks();
});

describe('aiChatBridge — triggerAISubmit', () => {
  it('returns false when no handler is registered', () => {
    expect(triggerAISubmit()).toBe(false);
  });

  it('returns true when a handler is registered', () => {
    registerAISubmit(() => {});
    expect(triggerAISubmit()).toBe(true);
  });

  it('calls the registered handler on trigger', () => {
    const handler = vi.fn();
    registerAISubmit(handler);
    triggerAISubmit();
    expect(handler).toHaveBeenCalledOnce();
  });

  it('calls handler on each trigger', () => {
    const handler = vi.fn();
    registerAISubmit(handler);
    triggerAISubmit();
    triggerAISubmit();
    expect(handler).toHaveBeenCalledTimes(2);
  });
});

describe('aiChatBridge — clearAISubmit', () => {
  it('returns false after handler is cleared', () => {
    registerAISubmit(() => {});
    clearAISubmit();
    expect(triggerAISubmit()).toBe(false);
  });

  it('does not call handler after clear', () => {
    const handler = vi.fn();
    registerAISubmit(handler);
    clearAISubmit();
    triggerAISubmit();
    expect(handler).not.toHaveBeenCalled();
  });
});

describe('aiChatBridge — registerAISubmit', () => {
  it('re-registration replaces previous handler', () => {
    const h1 = vi.fn();
    const h2 = vi.fn();
    registerAISubmit(h1);
    registerAISubmit(h2);
    triggerAISubmit();
    expect(h1).not.toHaveBeenCalled();
    expect(h2).toHaveBeenCalledOnce();
  });
});
