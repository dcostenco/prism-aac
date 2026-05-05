import { describe, it, expect, beforeEach } from 'vitest';
import {
    emitTtsHealthEvent,
    subscribeTtsHealth,
    subscribeTtsHealthType,
    _listenerCount,
    _resetForTests,
    type TtsHealthEvent,
} from '@/services/ttsHealthBus';
import {
    shouldShowTtsDebug,
    formatTtsEvent,
} from '@/components/TtsDebugOverlay';

beforeEach(() => {
    _resetForTests();
    if (typeof localStorage !== 'undefined') localStorage.clear();
    window.history.replaceState({}, '', '/');
});

describe('ttsHealthBus — basic pub/sub', () => {
    it('starts with no listeners', () => {
        expect(_listenerCount()).toBe(0);
    });

    it('subscribe + emit delivers the event', () => {
        const received: TtsHealthEvent[] = [];
        subscribeTtsHealth((e) => received.push(e));
        emitTtsHealthEvent({
            type: 'tts-attempt', tier: 'inworld', text: 'hi', lang: 'en-US', timestamp: 0,
        });
        expect(received).toHaveLength(1);
        expect(received[0].type).toBe('tts-attempt');
    });

    it('disposer removes the listener', () => {
        const received: TtsHealthEvent[] = [];
        const off = subscribeTtsHealth((e) => received.push(e));
        off();
        emitTtsHealthEvent({
            type: 'tts-success', tier: 'inworld', latencyMs: 100, durationMs: 500, timestamp: 0,
        });
        expect(received).toHaveLength(0);
        expect(_listenerCount()).toBe(0);
    });

    it('multiple subscribers all receive events', () => {
        const received: string[] = [];
        subscribeTtsHealth((e) => received.push(`a:${e.type}`));
        subscribeTtsHealth((e) => received.push(`b:${e.type}`));
        emitTtsHealthEvent({
            type: 'tts-fallback', fromTier: 'inworld', toTier: 'azure', reason: '401', timestamp: 0,
        });
        expect(received).toEqual(['a:tts-fallback', 'b:tts-fallback']);
    });
});

describe('ttsHealthBus — military hardening', () => {
    it('listener that throws does not break the bus', () => {
        const received: string[] = [];
        subscribeTtsHealth(() => { throw new Error('boom'); });
        subscribeTtsHealth((e) => received.push(e.type));
        expect(() => emitTtsHealthEvent({
            type: 'tts-attempt', tier: 'inworld', text: 'x', lang: 'en', timestamp: 0,
        })).not.toThrow();
        expect(received).toEqual(['tts-attempt']);
    });

    it('listener unsubscribing during dispatch does not skip siblings', () => {
        const received: string[] = [];
        const off1 = subscribeTtsHealth(() => { off1(); });
        subscribeTtsHealth((e) => received.push(`b:${e.type}`));
        emitTtsHealthEvent({
            type: 'tts-attempt', tier: 'azure', text: '', lang: 'en', timestamp: 0,
        });
        expect(received).toEqual(['b:tts-attempt']);
    });

    it('emit with no listeners is a no-op', () => {
        expect(() => emitTtsHealthEvent({
            type: 'tts-give-up', lastTier: 'web-speech', triedTiers: ['inworld', 'azure'], reason: 'all', timestamp: 0,
        })).not.toThrow();
    });

    it('disposer called twice is idempotent', () => {
        const off = subscribeTtsHealth(() => {});
        expect(_listenerCount()).toBe(1);
        off();
        off();
        expect(_listenerCount()).toBe(0);
    });

    it('handles all 4 event types via the union discriminator', () => {
        const received: TtsHealthEvent[] = [];
        subscribeTtsHealth((e) => received.push(e));
        emitTtsHealthEvent({ type: 'tts-attempt', tier: 'inworld', text: 'a', lang: 'en', timestamp: 1 });
        emitTtsHealthEvent({ type: 'tts-success', tier: 'inworld', latencyMs: 50, durationMs: 200, timestamp: 2 });
        emitTtsHealthEvent({ type: 'tts-fallback', fromTier: 'inworld', toTier: 'azure', reason: 'x', timestamp: 3 });
        emitTtsHealthEvent({ type: 'tts-give-up', lastTier: 'native-ios', triedTiers: ['inworld', 'azure'], reason: 'y', timestamp: 4 });
        expect(received).toHaveLength(4);
    });
});

describe('subscribeTtsHealthType — narrowing', () => {
    it('filters to only the specified event type', () => {
        const tiers: string[] = [];
        subscribeTtsHealthType('tts-attempt', (e) => tiers.push(e.tier));
        emitTtsHealthEvent({ type: 'tts-attempt', tier: 'inworld', text: '', lang: 'en', timestamp: 0 });
        emitTtsHealthEvent({ type: 'tts-success', tier: 'azure', latencyMs: 0, durationMs: 0, timestamp: 0 });
        emitTtsHealthEvent({ type: 'tts-attempt', tier: 'azure', text: '', lang: 'en', timestamp: 0 });
        expect(tiers).toEqual(['inworld', 'azure']);
    });

    it('TS narrows to fallback variant for fromTier/toTier access', () => {
        subscribeTtsHealthType('tts-fallback', (e) => {
            // e.fromTier and e.toTier only exist on the fallback variant
            expect(typeof e.fromTier).toBe('string');
            expect(typeof e.toTier).toBe('string');
            expect(typeof e.reason).toBe('string');
        });
        emitTtsHealthEvent({
            type: 'tts-fallback', fromTier: 'inworld', toTier: 'azure', reason: '401', timestamp: 0,
        });
    });
});

describe('shouldShowTtsDebug — activation flags', () => {
    it('returns false by default', () => {
        expect(shouldShowTtsDebug()).toBe(false);
    });

    it('returns true when localStorage flag is "1"', () => {
        localStorage.setItem('prism-tts-debug', '1');
        expect(shouldShowTtsDebug()).toBe(true);
    });

    it('returns false for any other localStorage value', () => {
        localStorage.setItem('prism-tts-debug', 'true');
        expect(shouldShowTtsDebug()).toBe(false);
        localStorage.setItem('prism-tts-debug', 'on');
        expect(shouldShowTtsDebug()).toBe(false);
    });

    it('returns true when URL has ?debug=tts', () => {
        window.history.replaceState({}, '', '/?debug=tts');
        expect(shouldShowTtsDebug()).toBe(true);
    });

    it('returns false when URL has ?debug=other', () => {
        window.history.replaceState({}, '', '/?debug=tracking');
        expect(shouldShowTtsDebug()).toBe(false);
    });

    it('does not throw when localStorage.getItem throws', () => {
        const original = localStorage.getItem.bind(localStorage);
        localStorage.getItem = () => { throw new Error('SecurityError'); };
        try {
            expect(() => shouldShowTtsDebug()).not.toThrow();
        } finally {
            localStorage.getItem = original;
        }
    });
});

describe('formatTtsEvent — one-line render', () => {
    const ts = new Date('2026-05-05T17:30:00Z').getTime();

    it('formats attempt with tier + lang + truncated text', () => {
        const line = formatTtsEvent({
            type: 'tts-attempt', tier: 'inworld', text: 'hello', lang: 'en-US', timestamp: ts,
        });
        expect(line).toContain('ATTEMPT');
        expect(line).toContain('inworld');
        expect(line).toContain('en-US');
        expect(line).toContain('hello');
    });

    it('truncates long text to 40 chars', () => {
        const long = 'x'.repeat(100);
        const line = formatTtsEvent({
            type: 'tts-attempt', tier: 'azure', text: long, lang: 'en', timestamp: ts,
        });
        expect(line).toContain('…');
        expect(line).not.toContain(long);
    });

    it('formats success with latency + duration', () => {
        const line = formatTtsEvent({
            type: 'tts-success', tier: 'azure', latencyMs: 123, durationMs: 850, timestamp: ts,
        });
        expect(line).toContain('OK');
        expect(line).toContain('123ms');
        expect(line).toContain('850ms');
    });

    it('formats fallback with from → to + reason', () => {
        const line = formatTtsEvent({
            type: 'tts-fallback', fromTier: 'inworld', toTier: 'azure', reason: '401', timestamp: ts,
        });
        expect(line).toContain('inworld');
        expect(line).toContain('azure');
        expect(line).toContain('401');
    });

    it('formats give-up with tried tiers', () => {
        const line = formatTtsEvent({
            type: 'tts-give-up', lastTier: 'native-ios',
            triedTiers: ['inworld', 'azure', 'web-speech', 'native-ios'],
            reason: 'all tiers exhausted', timestamp: ts,
        });
        expect(line).toContain('GAVE UP');
        expect(line).toContain('inworld');
        expect(line).toContain('all tiers exhausted');
    });

    it('starts each line with a wall-clock time', () => {
        const line = formatTtsEvent({
            type: 'tts-attempt', tier: 'inworld', text: '', lang: 'en', timestamp: ts,
        });
        expect(line).toMatch(/\d{1,2}:\d{2}:\d{2}/);
    });
});
