'use client';

/**
 * cameraStream — refcounted getUserMedia mediator.
 *
 * Solves gap G from docs/TRACKING_RELIABILITY.md: today both `headTracker`
 * and `bodyPoseService` independently call `navigator.mediaDevices.
 * getUserMedia()`. On a device with one front camera, the second call
 * fails silently with "Camera in use" — and the user has no diagnostic.
 *
 * This module is the single point of camera ownership. Both services
 * (and any future consumer like a hand-tracker) call `acquireCamera()`
 * with the same `deviceId` and receive a *shared* `<video>` element that
 * is kept alive as long as ANY consumer holds a lease. When the last
 * consumer releases, the stream is fully torn down.
 *
 * API:
 *   const lease = await acquireCamera({ deviceId, width, height });
 *   if (!lease) { /* permission denied or no camera *\/ }
 *   useTheVideo(lease.video);
 *   // ...later...
 *   lease.release();   // refcount decrements; stream stops at 0
 *
 * Design notes:
 *   - Per-deviceId refcount. Different deviceId → different stream.
 *   - The shared video element is muted, hidden, and 1×1 px. Consumers
 *     who want a PIP preview should clone `srcObject` into their own
 *     visible video element (the same pattern HeadTrackingOverlay
 *     already uses).
 *   - Idempotent release: calling .release() twice is a no-op.
 *   - Mockable IO: `_setGetUserMedia` allows tests to substitute the
 *     getUserMedia implementation without touching navigator.
 *
 * Migration plan: keep this module as the new shared path; existing
 * services migrate one at a time. bodyPoseService migrates first
 * (smallest surface), then headTracker (multi-cam — needs more care).
 */

export interface AcquireCameraOpts {
    /** Device ID. Pass a specific camera; omit for default front. */
    deviceId?: string;
    /** Ideal width / height — passed through to getUserMedia. */
    width?: number;
    height?: number;
}

export interface CameraLease {
    /** Shared video element. DO NOT mutate `srcObject`. */
    video: HTMLVideoElement;
    /** Decrement the refcount. Idempotent. */
    release: () => void;
}

/* ── Internal state ────────────────────────────────────────────────── */

interface LeaseEntry {
    stream: MediaStream;
    video: HTMLVideoElement;
    refs: number;
    /** Stable key — used both as map key and for telemetry. */
    key: string;
}

const leases = new Map<string, LeaseEntry>();
/** Pending opens — multiple concurrent acquireCamera calls coalesce. */
const opening = new Map<string, Promise<LeaseEntry | null>>();

/** Inject a custom getUserMedia for tests. Set to null to restore default. */
type GetUserMedia = (c: MediaStreamConstraints) => Promise<MediaStream>;
let _getUserMedia: GetUserMedia | null = null;

/** TEST ONLY — substitute getUserMedia. Returns the previous override (if any). */
export function _setGetUserMedia(fn: GetUserMedia | null): GetUserMedia | null {
    const prev = _getUserMedia;
    _getUserMedia = fn;
    return prev;
}

/** TEST ONLY — drop all leases. Forces full re-open on next acquire. */
export function _resetForTests(): void {
    for (const entry of leases.values()) {
        try { entry.stream.getTracks().forEach(t => t.stop()); } catch { /* */ }
        try { if (entry.video.parentNode) entry.video.remove(); } catch { /* */ }
    }
    leases.clear();
    opening.clear();
}

/** Diagnostic snapshot for debugging — not part of the public contract. */
export function _snapshot(): { key: string; refs: number }[] {
    return Array.from(leases.values()).map(e => ({ key: e.key, refs: e.refs }));
}

/* ── Pure helpers (testable without IO) ────────────────────────────── */

/** Stable key for a (deviceId, width, height) tuple. */
export function leaseKey(opts: AcquireCameraOpts): string {
    const id = opts.deviceId ?? '__default__';
    const w = opts.width ?? 0;
    const h = opts.height ?? 0;
    return `${id}|${w}x${h}`;
}

/** Build the constraints object for getUserMedia. */
export function buildConstraints(opts: AcquireCameraOpts): MediaStreamConstraints {
    return {
        video: opts.deviceId
            ? {
                deviceId: { exact: opts.deviceId },
                width: { ideal: opts.width ?? 320 },
                height: { ideal: opts.height ?? 240 },
                facingMode: 'user',
            }
            : {
                width: { ideal: opts.width ?? 320 },
                height: { ideal: opts.height ?? 240 },
                facingMode: 'user',
            },
        audio: false,
    };
}

/* ── Public API ────────────────────────────────────────────────────── */

/**
 * Acquire a refcounted camera lease. Multiple concurrent callers with
 * the same key share the same stream + video element. Returns null on
 * permission denial / no-camera-available — caller surfaces a UX prompt.
 */
export async function acquireCamera(opts: AcquireCameraOpts = {}): Promise<CameraLease | null> {
    if (typeof navigator === 'undefined' || (!navigator.mediaDevices?.getUserMedia && !_getUserMedia)) {
        return null;
    }
    const key = leaseKey(opts);

    // Fast path: existing lease — bump refcount and return.
    const existing = leases.get(key);
    if (existing) {
        existing.refs++;
        return makeLease(key, existing);
    }

    // Coalesce: if an open is already in flight for this key, await it.
    const inflight = opening.get(key);
    if (inflight) {
        const entry = await inflight;
        if (!entry) return null;
        entry.refs++;
        return makeLease(key, entry);
    }

    // First opener for this key.
    const promise = openNew(key, opts);
    opening.set(key, promise);
    try {
        const entry = await promise;
        if (!entry) return null;
        return makeLease(key, entry);
    } finally {
        opening.delete(key);
    }
}

async function openNew(key: string, opts: AcquireCameraOpts): Promise<LeaseEntry | null> {
    let stream: MediaStream;
    try {
        const fn: GetUserMedia = _getUserMedia ?? ((c) => navigator.mediaDevices.getUserMedia(c));
        stream = await fn(buildConstraints(opts));
    } catch {
        return null;
    }

    const video = document.createElement('video');
    video.setAttribute('playsinline', '');
    video.setAttribute('autoplay', '');
    video.muted = true;
    video.style.cssText = 'position:fixed;opacity:0;pointer-events:none;width:1px;height:1px;';
    document.body.appendChild(video);
    video.srcObject = stream;
    try { await video.play(); } catch { /* most browsers tolerate failed autoplay on muted */ }

    const entry: LeaseEntry = { stream, video, refs: 1, key };
    leases.set(key, entry);
    return entry;
}

function makeLease(key: string, entry: LeaseEntry): CameraLease {
    let released = false;
    return {
        video: entry.video,
        release: () => {
            if (released) return;
            released = true;
            decrementRef(key);
        },
    };
}

function decrementRef(key: string): void {
    const entry = leases.get(key);
    if (!entry) return;
    entry.refs--;
    if (entry.refs <= 0) {
        try { entry.stream.getTracks().forEach(t => t.stop()); } catch { /* */ }
        try { if (entry.video.parentNode) entry.video.remove(); } catch { /* */ }
        leases.delete(key);
    }
}
