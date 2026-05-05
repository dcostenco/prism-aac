'use client';

/**
 * reliabilityProbe — background 1Hz check after drift auto-disable.
 *
 * Closes the gap left by `headTrackerStability.ts`'s `ReliabilityProbe`
 * primitive, which counts a stable-frame streak but doesn't HAVE a camera
 * to read frames from. This module:
 *
 *   1. Opens a minimal 320×240 getUserMedia stream (front camera).
 *   2. Runs MediaPipe FaceDetector at 1 Hz (NOT the full 15fps tracker —
 *      we only need a coarse "is the face stable / well-lit" verdict).
 *   3. Feeds confidence to a `ReliabilityProbe` streak counter.
 *   4. On `recoverFrames` consecutive stable frames, fires `onRecover()`
 *      and tears itself down.
 *
 * Designed to be *cheap*. 1 Hz at 320×240 is ~1% CPU on a 2020-era laptop.
 * Caller (HeadTrackingOverlay) starts the probe when drift fires and stops
 * it when the user manually retries OR the probe auto-recovers.
 *
 * Plan ref: docs/TRACKING_RELIABILITY.md gap A — auto-recover lifecycle.
 */

import { ReliabilityProbe } from './headTrackerStability';

export interface ReliabilityProbeHandle {
    stop: () => void;
}

export interface ReliabilityProbeOpts {
    /** Fired when the streak threshold is hit. Probe auto-stops after firing. */
    onRecover: () => void;
    /** Fires every probe frame with current streak / confidence — for UI dots. */
    onTick?: (info: { confidence: number; streak: number }) => void;
    /** Default 10 frames at 1 Hz = 10s sustained good visibility. */
    recoverFrames?: number;
    /** Floor below which a frame doesn't count toward the streak. Default 0.7. */
    stableConfidenceFloor?: number;
    /** Specific camera deviceId to probe with. Defaults to user-facing. */
    cameraDeviceId?: string;
    /** Probe rate. Default 1000ms. */
    intervalMs?: number;
}

/**
 * Start the background probe. Returns a handle whose `.stop()` releases the
 * camera and stops the loop. The probe ALSO stops itself on auto-recover.
 *
 * Usage from HeadTrackingOverlay:
 *
 *   if (driftToast) {
 *     const probe = startReliabilityProbe({
 *       onRecover: () => {
 *         setDriftToast(null);
 *         setSettings({ headTrackingEnabled: true });
 *       },
 *     });
 *     return () => probe.stop();
 *   }
 */
export function startReliabilityProbe(opts: ReliabilityProbeOpts): ReliabilityProbeHandle {
    const {
        onRecover,
        onTick,
        recoverFrames = 10,
        stableConfidenceFloor = 0.7,
        cameraDeviceId,
        intervalMs = 1000,
    } = opts;

    const probe = new ReliabilityProbe({ recoverFrames, stableConfidenceFloor });
    let stream: MediaStream | null = null;
    let video: HTMLVideoElement | null = null;
    let detector: { detectForVideo: (v: HTMLVideoElement, ts: number) => { detections: Array<{ categories?: { score: number }[] }> } } | null = null;
    let intervalId: number | null = null;
    let stopped = false;
    let recovered = false;

    const teardown = () => {
        if (stopped) return;
        stopped = true;
        if (intervalId !== null) {
            window.clearInterval(intervalId);
            intervalId = null;
        }
        if (stream) {
            stream.getTracks().forEach(t => t.stop());
            stream = null;
        }
        if (video?.parentNode) video.remove();
        video = null;
    };

    const init = async () => {
        if (typeof window === 'undefined' || !navigator.mediaDevices?.getUserMedia) return;
        try {
            // Tiny resolution — we just need "face / no face" + score.
            const constraints: MediaStreamConstraints = {
                video: cameraDeviceId
                    ? { deviceId: { exact: cameraDeviceId }, width: { ideal: 320 }, height: { ideal: 240 }, facingMode: 'user' }
                    : { width: { ideal: 320 }, height: { ideal: 240 }, facingMode: 'user' },
                audio: false,
            };
            stream = await navigator.mediaDevices.getUserMedia(constraints);
            if (stopped) { teardown(); return; }

            video = document.createElement('video');
            video.setAttribute('playsinline', '');
            video.muted = true;
            video.style.cssText = 'position:fixed;opacity:0;pointer-events:none;width:1px;height:1px;';
            document.body.appendChild(video);
            video.srcObject = stream;
            await video.play().catch(() => {});

            // Wait for the first frame so MediaPipe doesn't choke on a
            // zero-dimension video element.
            await new Promise<void>((resolve) => {
                if (!video) return resolve();
                if (video.readyState >= 2) return resolve();
                video.addEventListener('loadedmetadata', () => resolve(), { once: true });
                setTimeout(resolve, 3000);
            });
            // Stop-during-init: between the metadata-wait above and the
            // model-load below, a teardown() call from the consumer would
            // otherwise leak the stream + video element. Always teardown
            // on any "stopped" check after we've created resources.
            if (stopped) { teardown(); return; }

            // Lazy-import MediaPipe (same module the head tracker uses).
            const vision = await import('@mediapipe/tasks-vision');
            const { FaceDetector, FilesetResolver } = vision;
            const fileset = await FilesetResolver.forVisionTasks(
                'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm'
            );
            detector = await FaceDetector.createFromOptions(fileset, {
                baseOptions: {
                    modelAssetPath: 'https://storage.googleapis.com/mediapipe-models/face_detector/blaze_face_short_range/float16/latest/blaze_face_short_range.task',
                    delegate: 'GPU',
                },
                runningMode: 'VIDEO',
                minDetectionConfidence: 0.5,
            }) as typeof detector;
            if (stopped) { teardown(); return; }

            // Run the slow loop. We don't care about per-frame jitter —
            // 1 Hz is the whole point.
            intervalId = window.setInterval(() => {
                if (stopped || !detector || !video) return;
                let confidence = 0;
                try {
                    const result = detector.detectForVideo(video, Date.now());
                    const top = result?.detections?.[0];
                    confidence = top?.categories?.[0]?.score ?? 0;
                } catch { /* skip frame on transient error */ }
                const hit = probe.push(confidence);
                if (onTick) onTick({ confidence, streak: probe.currentStreak });
                if (hit && !recovered) {
                    recovered = true;
                    teardown();
                    onRecover();
                }
            }, intervalMs);
        } catch {
            // Camera permission denied / model load failed → silently bail.
            // Consumer's "Try again" button is still available.
            teardown();
        }
    };

    init();

    return { stop: teardown };
}
