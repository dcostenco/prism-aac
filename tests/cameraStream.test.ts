import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
    acquireCamera,
    leaseKey,
    buildConstraints,
    onAllLeasesReleased,
    _setGetUserMedia,
    _resetForTests,
    _snapshot,
} from '@/services/cameraStream';

/**
 * Build a fake MediaStream-like object that carries enough of the API for
 * cameraStream's release path to work without a real browser device.
 */
function fakeStream(): MediaStream {
    const tracks = [
        { stop: vi.fn(), kind: 'video' },
    ];
    return {
        getTracks: () => tracks as unknown as MediaStreamTrack[],
    } as unknown as MediaStream;
}

beforeEach(() => {
    _resetForTests();
});

afterEach(() => {
    _setGetUserMedia(null);
    _resetForTests();
});

describe('cameraStream — pure helpers', () => {
    it('leaseKey is deterministic for the same input', () => {
        expect(leaseKey({ deviceId: 'cam-a', width: 320, height: 240 }))
            .toBe(leaseKey({ deviceId: 'cam-a', width: 320, height: 240 }));
    });

    it('leaseKey distinguishes deviceId, width, height', () => {
        const k1 = leaseKey({ deviceId: 'a' });
        const k2 = leaseKey({ deviceId: 'b' });
        const k3 = leaseKey({ deviceId: 'a', width: 640 });
        expect(k1).not.toBe(k2);
        expect(k1).not.toBe(k3);
    });

    it('leaseKey uses sentinel for missing deviceId', () => {
        const noId = leaseKey({});
        const withId = leaseKey({ deviceId: 'a' });
        expect(noId).toContain('__default__');
        expect(noId).not.toBe(withId);
    });

    it('buildConstraints produces video={facingMode:user} for unspecified deviceId', () => {
        const c = buildConstraints({});
        expect((c.video as MediaTrackConstraints).facingMode).toBe('user');
        expect(c.audio).toBe(false);
    });

    it('buildConstraints uses deviceId.exact when provided', () => {
        const c = buildConstraints({ deviceId: 'cam-a' });
        const v = c.video as MediaTrackConstraints;
        const exact = (v.deviceId as { exact: string }).exact;
        expect(exact).toBe('cam-a');
    });

    it('buildConstraints honors width/height when specified', () => {
        const c = buildConstraints({ deviceId: 'cam-a', width: 640, height: 480 });
        const v = c.video as MediaTrackConstraints;
        expect((v.width as { ideal: number }).ideal).toBe(640);
        expect((v.height as { ideal: number }).ideal).toBe(480);
    });
});

describe('cameraStream — refcount lifecycle', () => {
    it('first acquire opens a stream', async () => {
        const stream = fakeStream();
        const gum = vi.fn().mockResolvedValue(stream);
        _setGetUserMedia(gum);

        const lease = await acquireCamera({ deviceId: 'a' });
        expect(lease).not.toBeNull();
        expect(gum).toHaveBeenCalledTimes(1);
        expect(_snapshot()).toEqual([{ key: leaseKey({ deviceId: 'a' }), refs: 1 }]);
        lease!.release();
    });

    it('second acquire with the same key reuses the stream', async () => {
        const gum = vi.fn().mockResolvedValue(fakeStream());
        _setGetUserMedia(gum);

        const a = await acquireCamera({ deviceId: 'cam' });
        const b = await acquireCamera({ deviceId: 'cam' });
        expect(gum).toHaveBeenCalledTimes(1);
        expect(a!.video).toBe(b!.video);
        expect(_snapshot()[0].refs).toBe(2);
        a!.release();
        b!.release();
    });

    it('different deviceIds get different streams', async () => {
        const gum = vi.fn().mockImplementation(() => Promise.resolve(fakeStream()));
        _setGetUserMedia(gum);

        const a = await acquireCamera({ deviceId: 'cam-a' });
        const b = await acquireCamera({ deviceId: 'cam-b' });
        expect(gum).toHaveBeenCalledTimes(2);
        expect(a!.video).not.toBe(b!.video);
        a!.release();
        b!.release();
    });

    it('release decrements refcount; final release stops tracks', async () => {
        const stream = fakeStream();
        const stopFn = (stream.getTracks()[0] as unknown as { stop: () => void }).stop;
        _setGetUserMedia(vi.fn().mockResolvedValue(stream));

        const a = await acquireCamera({ deviceId: 'x' });
        const b = await acquireCamera({ deviceId: 'x' });
        a!.release();
        // Still one ref outstanding
        expect(stopFn).not.toHaveBeenCalled();
        b!.release();
        expect(stopFn).toHaveBeenCalledTimes(1);
        expect(_snapshot()).toEqual([]);
    });

    it('idempotent release: calling .release() twice is a no-op', async () => {
        const stream = fakeStream();
        const stopFn = (stream.getTracks()[0] as unknown as { stop: () => void }).stop;
        _setGetUserMedia(vi.fn().mockResolvedValue(stream));

        const a = await acquireCamera({ deviceId: 'y' });
        a!.release();
        a!.release();
        a!.release();
        expect(stopFn).toHaveBeenCalledTimes(1);
        expect(_snapshot()).toEqual([]);
    });

    it('returns null on getUserMedia failure (permission denied)', async () => {
        _setGetUserMedia(vi.fn().mockRejectedValue(new Error('NotAllowedError')));
        const lease = await acquireCamera({ deviceId: 'z' });
        expect(lease).toBeNull();
        expect(_snapshot()).toEqual([]);
    });

    it('after-failure retry is allowed (no leftover state)', async () => {
        const gum = vi.fn()
            .mockRejectedValueOnce(new Error('temp'))
            .mockResolvedValueOnce(fakeStream());
        _setGetUserMedia(gum);

        const fail = await acquireCamera({ deviceId: 'q' });
        expect(fail).toBeNull();
        const ok = await acquireCamera({ deviceId: 'q' });
        expect(ok).not.toBeNull();
        expect(gum).toHaveBeenCalledTimes(2);
        ok!.release();
    });
});

describe('cameraStream — military hardening: concurrency + adversarial', () => {
    it('two concurrent acquireCamera calls with same key only call getUserMedia once', async () => {
        // Coalescing in-flight opens prevents the "second consumer also
        // tries to open the camera" failure mode.
        let resolveStream: (s: MediaStream) => void = () => {};
        const pending = new Promise<MediaStream>((r) => { resolveStream = r; });
        const gum = vi.fn().mockReturnValue(pending);
        _setGetUserMedia(gum);

        const p1 = acquireCamera({ deviceId: 'k' });
        const p2 = acquireCamera({ deviceId: 'k' });
        // Resolve the underlying stream after both calls are in flight
        resolveStream(fakeStream());
        const [a, b] = await Promise.all([p1, p2]);

        expect(gum).toHaveBeenCalledTimes(1);
        expect(a!.video).toBe(b!.video);
        expect(_snapshot()[0].refs).toBe(2);
        a!.release();
        b!.release();
    });

    it('concurrent callers all get null when underlying open fails', async () => {
        let rejectStream: (e: Error) => void = () => {};
        const pending = new Promise<MediaStream>((_, rej) => { rejectStream = rej; });
        const gum = vi.fn().mockReturnValue(pending);
        _setGetUserMedia(gum);

        const p1 = acquireCamera({ deviceId: 'fail' });
        const p2 = acquireCamera({ deviceId: 'fail' });
        rejectStream(new Error('denied'));
        const [a, b] = await Promise.all([p1, p2]);
        expect(a).toBeNull();
        expect(b).toBeNull();
    });

    it('ten concurrent acquires + ten releases = clean teardown', async () => {
        _setGetUserMedia(vi.fn().mockResolvedValue(fakeStream()));
        const leases = await Promise.all(
            Array.from({ length: 10 }, () => acquireCamera({ deviceId: 'big' }))
        );
        expect(_snapshot()[0].refs).toBe(10);
        for (const l of leases) l!.release();
        expect(_snapshot()).toEqual([]);
    });

    it('release after _resetForTests is a no-op (does not throw)', async () => {
        _setGetUserMedia(vi.fn().mockResolvedValue(fakeStream()));
        const lease = await acquireCamera({ deviceId: 'reset' });
        _resetForTests();
        expect(() => lease!.release()).not.toThrow();
        expect(_snapshot()).toEqual([]);
    });

    it('acquire with mismatched width re-opens (different key)', async () => {
        const gum = vi.fn().mockImplementation(() => Promise.resolve(fakeStream()));
        _setGetUserMedia(gum);

        const a = await acquireCamera({ deviceId: 'cam', width: 320 });
        const b = await acquireCamera({ deviceId: 'cam', width: 640 });
        expect(gum).toHaveBeenCalledTimes(2);
        expect(_snapshot().length).toBe(2);
        a!.release();
        b!.release();
    });

    it('returns null when neither navigator.mediaDevices nor injection is available', async () => {
        // Save and clobber: neither fallback is present
        const realMD = navigator.mediaDevices;
        delete (navigator as unknown as { mediaDevices?: unknown }).mediaDevices;
        _setGetUserMedia(null);
        try {
            const lease = await acquireCamera({ deviceId: 'no-md' });
            expect(lease).toBeNull();
        } finally {
            // Restore
            (navigator as unknown as { mediaDevices: MediaDevices }).mediaDevices = realMD;
        }
    });

    it('refcount zero edge case: extra release does not go negative', async () => {
        _setGetUserMedia(vi.fn().mockResolvedValue(fakeStream()));
        const a = await acquireCamera({ deviceId: 'edge' });
        a!.release();
        // The lease's release is idempotent at the lease level. The
        // entry has been deleted from the map. Even if a stale lease
        // somehow tried again, it's a no-op.
        a!.release();
        a!.release();
        expect(_snapshot()).toEqual([]);
    });

    it('mid-flight rejection cleans up `opening` map', async () => {
        // After a failed open, the next acquire for the same key should
        // not be coalesced with the dead promise — it should attempt
        // a fresh getUserMedia call.
        const gum = vi.fn()
            .mockRejectedValueOnce(new Error('first-fail'))
            .mockResolvedValueOnce(fakeStream());
        _setGetUserMedia(gum);

        const fail = await acquireCamera({ deviceId: 'recover' });
        expect(fail).toBeNull();

        const ok = await acquireCamera({ deviceId: 'recover' });
        expect(ok).not.toBeNull();
        expect(gum).toHaveBeenCalledTimes(2);
        ok!.release();
    });

    it('snapshot reflects current state and is a copy', () => {
        const snap = _snapshot();
        snap.push({ key: 'fake', refs: 99 });
        expect(_snapshot()).toEqual([]);
    });
});

describe('cameraStream — onAllLeasesReleased (iOS audio-session reset hook)', () => {
    it('fires after the last lease drops, not on intermediate releases', async () => {
        const gum = vi.fn().mockResolvedValue(fakeStream());
        _setGetUserMedia(gum);
        const fired: number[] = [];
        const unsub = onAllLeasesReleased(() => { fired.push(Date.now()); });

        // Two consumers on different keys.
        const a = await acquireCamera({ deviceId: 'cam-a' });
        const b = await acquireCamera({ deviceId: 'cam-b' });
        expect(a && b).toBeTruthy();
        expect(fired.length).toBe(0);

        // First release — listener must NOT fire (cam-b still held).
        a!.release();
        expect(fired.length).toBe(0);

        // Last release — listener fires exactly once.
        b!.release();
        expect(fired.length).toBe(1);

        unsub();
    });

    it('fires once per drop-to-zero cycle, even across reacquire', async () => {
        const gum = vi.fn().mockResolvedValue(fakeStream());
        _setGetUserMedia(gum);
        let count = 0;
        onAllLeasesReleased(() => { count++; });

        const l1 = await acquireCamera({ deviceId: 'cam-a' });
        l1!.release();
        expect(count).toBe(1);

        const l2 = await acquireCamera({ deviceId: 'cam-a' });
        l2!.release();
        expect(count).toBe(2);
    });

    it('fires when refcount on same key drops, not on each refs--', async () => {
        const gum = vi.fn().mockResolvedValue(fakeStream());
        _setGetUserMedia(gum);
        let count = 0;
        onAllLeasesReleased(() => { count++; });

        // Two leases on the SAME key (refcount=2).
        const l1 = await acquireCamera({ deviceId: 'cam-a' });
        const l2 = await acquireCamera({ deviceId: 'cam-a' });
        expect(_snapshot()).toEqual([{ key: leaseKey({ deviceId: 'cam-a' }), refs: 2 }]);

        l1!.release();
        expect(count).toBe(0); // refcount went 2→1, no listener fire
        l2!.release();
        expect(count).toBe(1); // refcount went 1→0 AND leases.size→0
    });

    it('listener errors do not block lease release', async () => {
        const gum = vi.fn().mockResolvedValue(fakeStream());
        _setGetUserMedia(gum);
        onAllLeasesReleased(() => { throw new Error('listener boom'); });
        const l = await acquireCamera({ deviceId: 'cam-a' });
        expect(() => l!.release()).not.toThrow();
        expect(_snapshot()).toEqual([]);
    });

    it('unsub() removes the listener', async () => {
        const gum = vi.fn().mockResolvedValue(fakeStream());
        _setGetUserMedia(gum);
        let count = 0;
        const unsub = onAllLeasesReleased(() => { count++; });
        unsub();

        const l = await acquireCamera({ deviceId: 'cam-a' });
        l!.release();
        expect(count).toBe(0);
    });
});
