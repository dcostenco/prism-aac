/**
 * voiceCloneRecorder — focused tests on the pure-logic + lifecycle bits
 *
 * Most of the recorder is browser-side glue (getUserMedia, MediaRecorder)
 * which jsdom doesn't ship. We focus on:
 *   1. validateRecording — pure function, easy to pin
 *   2. unsupported-browser fail-fast paths
 *   3. lifecycle on a hand-rolled MediaRecorder mock so the state
 *      transitions + tick events behave the way the UI expects.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
    validateRecording,
    createVoiceCloneRecorder,
    MIN_CLONE_SECONDS,
    MAX_CLONE_SECONDS,
} from '@/services/voiceCloneRecorder';

describe('validateRecording', () => {
    it('rejects under-minimum recordings', () => {
        const reason = validateRecording({
            blob: new Blob(['x'.repeat(100_000)], { type: 'audio/webm' }),
            durationMs: 10_000, // 10s, < MIN_CLONE_SECONDS
            mimeType: 'audio/webm',
        });
        expect(reason).toContain(`${MIN_CLONE_SECONDS}s`);
    });

    it('rejects over-maximum recordings', () => {
        const reason = validateRecording({
            blob: new Blob(['x'.repeat(100_000)], { type: 'audio/webm' }),
            durationMs: (MAX_CLONE_SECONDS + 5) * 1000,
            mimeType: 'audio/webm',
        });
        expect(reason).toContain(`under ${MAX_CLONE_SECONDS}s`);
    });

    it('rejects suspiciously small blobs (silence / glitch)', () => {
        const reason = validateRecording({
            blob: new Blob([new Uint8Array(1024)], { type: 'audio/webm' }),
            durationMs: 60_000,
            mimeType: 'audio/webm',
        });
        expect(reason).toContain('too small');
    });

    it('returns null for an in-spec recording', () => {
        const reason = validateRecording({
            blob: new Blob([new Uint8Array(200_000)], { type: 'audio/webm' }),
            durationMs: 45_000,
            mimeType: 'audio/webm',
        });
        expect(reason).toBeNull();
    });
});

describe('createVoiceCloneRecorder — environment guards', () => {
    const origNavigator = globalThis.navigator;
    const origMediaRecorder = (globalThis as any).MediaRecorder;

    afterEach(() => {
        // Restore globals after each guard test
        (globalThis as any).navigator = origNavigator;
        (globalThis as any).MediaRecorder = origMediaRecorder;
    });

    it('throws when getUserMedia is unavailable', async () => {
        (globalThis as any).navigator = { mediaDevices: undefined };
        await expect(createVoiceCloneRecorder()).rejects.toThrow(/microphone/i);
    });

    it('throws when MediaRecorder is unavailable', async () => {
        (globalThis as any).navigator = {
            mediaDevices: {
                getUserMedia: vi.fn().mockResolvedValue({}),
            },
        };
        (globalThis as any).MediaRecorder = undefined;
        await expect(createVoiceCloneRecorder()).rejects.toThrow(/MediaRecorder/);
    });
});

describe('createVoiceCloneRecorder — lifecycle', () => {
    let stoppedHandlers: Array<() => void> = [];
    let dataHandlers: Array<(ev: { data: Blob }) => void> = [];

    beforeEach(() => {
        stoppedHandlers = [];
        dataHandlers = [];
        // Mock MediaStream w/ track stop()
        const fakeTrack = { stop: vi.fn() };
        const fakeStream = { getTracks: () => [fakeTrack] };

        (globalThis as any).navigator = {
            mediaDevices: {
                getUserMedia: vi.fn().mockResolvedValue(fakeStream),
            },
        };
        // Fake MediaRecorder — captures handlers, exposes state, simulates
        // start/stop without any actual encoding.
        class FakeMediaRecorder {
            state: 'inactive' | 'recording' = 'inactive';
            // eslint-disable-next-line @typescript-eslint/no-unused-vars
            constructor(_stream: any, _opts: any) { }
            set ondataavailable(fn: (ev: { data: Blob }) => void) { dataHandlers.push(fn); }
            set onstop(fn: () => void) { stoppedHandlers.push(fn); }
            set onerror(_fn: () => void) { /* not exercised here */ }
            start() { this.state = 'recording'; }
            stop() {
                this.state = 'inactive';
                // Simulate one chunk + onstop firing
                for (const fn of dataHandlers) {
                    fn({ data: new Blob([new Uint8Array(100_000)], { type: 'audio/webm' }) });
                }
                for (const fn of stoppedHandlers) fn();
            }
        }
        (FakeMediaRecorder as any).isTypeSupported = () => true;
        (globalThis as any).MediaRecorder = FakeMediaRecorder;
    });

    it('cycles state idle → recording → stopped via start + stop', async () => {
        const rec = await createVoiceCloneRecorder();
        const states: string[] = [];
        rec.onStateChange((s) => states.push(s));

        expect(rec.getState()).toBe('idle');
        await rec.start();
        expect(rec.getState()).toBe('recording');

        const result = await rec.stop();
        expect(rec.getState()).toBe('stopped');
        expect(result.mimeType).toBe('audio/webm;codecs=opus');
        expect(result.durationMs).toBeGreaterThanOrEqual(0);
        expect(result.blob.size).toBeGreaterThan(0);
        // State stream saw both transitions
        expect(states).toContain('recording');
        expect(states).toContain('stopped');
    });

    it('stop() rejects when called before start()', async () => {
        const rec = await createVoiceCloneRecorder();
        await expect(rec.stop()).rejects.toThrow(/not active/);
    });

    it('cancel() clears state to idle even mid-recording', async () => {
        const rec = await createVoiceCloneRecorder();
        await rec.start();
        expect(rec.getState()).toBe('recording');
        rec.cancel();
        expect(rec.getState()).toBe('idle');
    });

    it('onTick fires while recording', async () => {
        vi.useFakeTimers();
        try {
            const rec = await createVoiceCloneRecorder();
            const ticks: number[] = [];
            rec.onTick((ms) => ticks.push(ms));
            await rec.start();
            // Advance 350ms — should produce ~3 ticks (every 100ms)
            vi.advanceTimersByTime(350);
            expect(ticks.length).toBeGreaterThanOrEqual(2);
            // All ticks are non-decreasing
            for (let i = 1; i < ticks.length; i++) {
                expect(ticks[i]).toBeGreaterThanOrEqual(ticks[i - 1]);
            }
            rec.cancel();
        } finally {
            vi.useRealTimers();
        }
    });
});
