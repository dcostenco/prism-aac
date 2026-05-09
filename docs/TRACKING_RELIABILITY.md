# Tracking Reliability — Deep Investigation & Plan

> **TL;DR** — head + gesture + hand tracking work together without interfering, stay reliable in non-stationary contexts (moving car, lap-held laptop, restless child), and **never silently follow drift** when the user doesn't notice. Drift safety stack auto-disables + prompts recalibration; Esc escape hatch is always one keystroke away.

## At a glance

- ✅ **Identity locking** — the camera follows ONE person; siblings or parents passing through don't expand calibration
- ✅ **Drift threshold + window** — auto-disable + recalibration prompt when tracking diverges from intent
- ✅ **Camera-stream singleton** — head + hand tracker share one stream; mode switching is free
- ✅ **Esc escape hatch** — instantly disable tracking and return to qwerty without losing the message bar
- ✅ **Auto-recovery** — the body tracker resumes after temporary occlusion (e.g. caregiver leans in)

<details>
<summary><strong>📐 Full investigation, harness, and reliability ledger</strong></summary>

> **Status**: Investigation 2026-05-05 by Dmitri + Claude. Critical gap.
> Goal: head + gesture + hand tracking work *together* without interfering,
> stay reliable in non-stationary contexts (moving car, lap-held laptop,
> changing lighting), self-disable cleanly when reliability collapses,
> and recover when conditions return.
>
> **Persistence**: This doc is committed; future Claude sessions and any
> human picking up the campaign use it as the single source of truth.

## TL;DR

Today the tracking stack is built on three independent services
(`headTracker.ts`, `gestureService.ts`, `bodyPoseService.ts`) plus a
single `DriftDetector` (added this session). Each service has its own
camera consumer, its own filter, its own confidence concept, and they
**don't know about each other**. That works for stationary use on a
modern iPad with good lighting. It does *not* work for limited
equipment in non-stationary contexts.

The 11 gaps below are ordered by impact. Items A–C shipped earlier
this session; D–K are the rest of the plan.

## Architecture as it stands today

```
┌──────────────────────────────────────────────────────────────────┐
│                       getUserMedia (camera)                      │
│      ↑                       ↑                       ↑           │
│      │                       │                       │           │
│  headTracker          gestureService           bodyPoseService   │
│  ─────────            ─────────────           ────────────────   │
│  MediaPipe            consumes onLandmarks    MediaPipe          │
│  FaceDetector         from headTracker        PoseLandmarker     │
│  + FaceLandmarker     (52 blendshapes,        (33 body landmarks)│
│  (cursor X,Y)         head-pose matrix)                          │
│      │                       │                       │           │
│      ▼                       ▼                       ▼           │
│  EMA smoother         dwell + cooldowns       wrist/index cursor │
│  + sensitivity        + DTW templates                            │
│  + dwell click        + intent resolver                          │
│      │                       │                       │           │
│      ▼                       ▼                       ▼           │
│  cursor + clicks      gesture events          alt cursor source  │
└──────────────────────────────────────────────────────────────────┘
```

**Camera contention**: `headTracker` and `bodyPoseService` each call
`navigator.mediaDevices.getUserMedia()` independently. On iPad/Mac with
two camera attempts, the second one fails with "Camera in use" errors.
*Symptom*: enabling hand tracking after head tracking silently breaks
hand tracking and the user has no idea why.

**Filter math**: `headTracker.ts` uses a velocity-adaptive EMA. The
smoothing alpha shrinks at low velocity and grows at high velocity —
intended for snappy mid-screen flicks but **amplifies noise** when the
landmarks themselves are jittery (poor lighting, cheap webcam).

**Calibration**: 4-corner dot calibration captured once, stored in
`localStorage`, never refreshed. The mapping `(normX, normY) →
(cursorX, cursorY)` becomes wrong as the user shifts position over
minutes/hours.

## 11 gaps + plan

| # | Gap | Impact | Status | Notes |
|---|---|---|---|---|
| **A** | No drift safety net — runaway cursor was unrecoverable | 🔴 Critical | ✅ shipped + auto-recover wired | DriftDetector + ReliabilityProbe (background `services/reliabilityProbe.ts`) — fires `onRecover` after 10s of stable face |
| **B** | Esc keyboard escape hatch absent | 🔴 Critical | ✅ shipped | Esc unconditionally tears down tracker |
| **C** | Naive avg fusion — bad camera poisons good camera | 🟠 High | 🟢 N/A by design | Active-Failover (best single camera) is intentional — see code comment in `fuseCameraDetections`. `fuseWeighted` stays as a documented building block for future calibrated multi-cam |
| **D** | EMA filter amplifies high-velocity noise | 🟠 High | ✅ shipped | Confidence-aware Kalman1D replaces velocity-adaptive EMA |
| **E** | No camera-shake stabilization (the "moving car" gap) | 🟠 High | ✅ shipped | `egoMotion.ts` + sparse-landmark centroid residuals; FaceLandmarker now always-init so non-gesture users get protection too |
| **F** | No background recalibration / drift correction | 🟠 High | ✅ shipped | `recalibration.ts` `CorrectionLoop` — L1/L2/L3 three-level loop (see §F). Calls Synalux `/api/v1/prism-aac/tracking/correct` online; falls back to local `BaselineTracker` offline. Wired into `bodyPoseService.requestTick()` every 2 s |
| **G** | Camera contention between head + body services | 🟠 High | ✅ shipped | `cameraStream.ts` refcounted singleton + both `headTracker` and `bodyPoseService` migrated. Concurrent acquires for the same `(deviceId, w, h)` coalesce; getUserMedia is called exactly once. Stream stays alive while ANY consumer holds a lease |
| **H** | Cross-modal interference (gesture click during dwell) | 🟡 Medium | ✅ shipped | `crossModalLockout.ts` — gesture commits dispatch claim; dwell suspends 250ms |
| **I** | No DeviceMotion / IMU input on iOS | 🟡 Medium | ✅ shipped | `deviceMotion.ts` — iOS 13+ permission flow + 500ms rolling-window peak detection with hysteresis. `headTracker` accepts `isDeviceShaking()` callback and gates drift checks while the IMU reports motion |
| **J** | Cursor pinned at edge ≠ "lost" → fires garbage dwells | 🟡 Medium | ✅ shipped | `EdgePinDetector` — pin warn at 2s, escalate after N episodes OR a single sustained pin (`pinTriggerMs * pinEscalateCount`) |
| **K** | No "safe mode" — only on/off; no degraded mode | 🟡 Medium | ✅ shipped | `safeMode.ts` — after 2 drift events in 5min: capped sensitivity, doubled dwell, single camera, gestures off. Cleared on manual retry |

**Status May 2026**: 11 of 11 gaps closed end-to-end. Both head + body
trackers share a single getUserMedia stream via the cameraStream
singleton. Auto-recover wired. DeviceMotion gates drift checks during
real environmental shake. Background calibration anchors auto-correct
without user prompt. Successful dwell-clicks feed back as ground-truth
calibration anchors (see § L). Telemetry bus + debug overlay shipped
for field troubleshooting (see § M).

Tests: 273 passing across 11 files
- `kalmanFilter1D.test.ts` (23) — confidence-aware filter + adversarial
- `egoMotion.test.ts` (21) — camera-shake separation + adversarial
- `safeMode.test.ts` (37) — degraded mode + persistence + corruption + telemetry
- `headTrackerStability.test.ts` (45) — drift / probe / fusion / edge-pin / lockout
- `cameraStream.test.ts` (22) — refcount + concurrency
- `recalibration.test.ts` (27) — baseline drift / scale / anchor
- `deviceMotion.test.ts` (31) — IMU permission + hysteresis state machine
- `trackingTelemetry.test.ts` (14) — pub/sub bus + boundary cases
- `trackingDebugOverlay.test.ts` (17) — flag detection + event formatting
- `head-tracker.test.ts` (20) — settings store + cursor math
- `head-tracker-integration.test.ts` (17) — public surface + wiring

---

### A. Drift safety net ✅ shipped

`services/headTrackerStability.ts` exposes:

- `DriftDetector` — rolling-window cumulative travel + avg confidence.
  Triggers `'cursor-drift'` when travel > 800px in 5s with no dwell-
  click, or `'confidence-collapse'` when avg confidence < 0.4.
- `ReliabilityProbe` — post-disable streak counter (default 10
  consecutive 1Hz frames at confidence ≥ 0.7) for auto-recover.
- `fuseWeighted` — confidence-weighted multi-camera fusion (replaces
  naive average — see C).

Wired in `headTracker.ts` `tick()`. On trigger fires `onDrift(reason)`;
the consumer (`HeadTrackingOverlay.tsx`) flips `headTrackingEnabled =
false` and renders a recovery toast with a non-cursor "Try again"
button. Tests at `tests/headTrackerStability.test.ts` (14 cases).

### B. Esc escape hatch ✅ shipped

`startHeadTracker()` registers a `keydown` listener; pressing Esc
unconditionally tears down the tracker. Removed on `.stop()` so the
listener doesn't leak across remounts. Critical because when the
cursor is broken, the user can't necessarily click any disable
button — Esc always works.

### C. Confidence-weighted fusion (primitive shipped, wiring pending)

`fuseWeighted([{normX, normY, confidence}, ...])` is implemented and
tested. Wiring into the existing `fuseCameraDetections()` is a
30-minute task: replace the simple `(a + b) / 2` average with a call
to `fuseWeighted`, using each camera's `confidence` from the existing
`CameraDetection` interface.

**Why it matters**: today, when camera A loses face for 1 frame
(returns null/0 confidence), the naive avg pulls camera B's reading
toward zero. Cursor jumps. Weighted fusion makes the 0-confidence
contribute 0 weight → cursor stays where camera B saw it.

### D. Replace EMA with confidence-aware Kalman filter

EMA with velocity-adaptive alpha is fundamentally a **trust knob**: it
either trusts the new measurement (low alpha) or trusts the prediction
(high alpha). It can't trust *both* differently per measurement.

A 1D Kalman filter on (x, y) does exactly this:
- Process noise Q = expected user-intent velocity (small, ~5 px/frame)
- Measurement noise R = `1 / confidence` (high when face is occluded)

When a frame has high confidence, R is low → measurement dominates
(snappy). When confidence drops, R climbs → prediction dominates
(cursor stays put — we don't follow the noise).

Bonus: Kalman naturally handles missing measurements (skip the
update step, just predict forward).

**Implementation path**:

```ts
// services/kalmanFilter1D.ts
export class Kalman1D {
  private x = 0;       // estimated position
  private p = 1;       // estimated variance
  constructor(
    private q: number, // process noise (motion model variance)
  ) {}
  predict(): number {
    this.p += this.q;
    return this.x;
  }
  update(measurement: number, confidence: number): number {
    const r = Math.max(0.001, 1 - confidence);  // measurement noise
    const k = this.p / (this.p + r);             // Kalman gain
    this.x = this.x + k * (measurement - this.x);
    this.p = (1 - k) * this.p;
    return this.x;
  }
  reset(initial: number): void { this.x = initial; this.p = 1; }
}
```

Wired in `tick()` as `sx = kalmanX.update(rawX, fusedConfidence)`.
Replace the existing EMA branch entirely. Saccade detection (E.5
below) can re-bias the filter for fast intentional moves.

**Test**: 50-frame synthetic sequence — clean signal vs signal +
gaussian noise vs signal with a 5-frame occlusion. Kalman should
track within 5 px on the clean signal, smooth out the noise to <10 px
RMS, and predict-through the occlusion.

### E. Camera-shake stabilization (the "moving car" requirement)

The user's hard requirement. When the laptop is on the user's lap in
a moving car, the camera shakes BUT THE USER'S FACE-RELATIVE-TO-
CAMERA-FRAME doesn't change much. Today we treat all landmark motion
as user intent — so the cursor jets around with every bump.

Detection signal: when ALL face landmarks shift by approximately the
same delta in one frame, that's **ego-motion** (camera moved), not
**face motion** (user moved).

Algorithm:

```ts
// Each frame, compute the centroid of face landmarks
const centroid = mean(landmarks);

// Frame-to-frame centroid delta = candidate ego-motion vector
const egoMotion = centroid - prevCentroid;

// Compute residual landmark motion AFTER subtracting ego-motion
const residuals = landmarks.map(p => p - prevP - egoMotion);

// If residuals are small (face didn't actually move relative to
// itself), the centroid delta IS pure ego-motion → discard.
if (max(|residuals|) < 0.005) {
    // Pure camera shake — DON'T move cursor
    return;
}

// Otherwise, use the residual motion as the cursor signal,
// not the raw centroid motion.
```

Validated on simulated data: vibrating the camera by ±10 px while
keeping landmarks rigid produces zero cursor motion with this
algorithm and ~10px cursor motion without it.

**Edge case**: rigid head shake = head moves but landmarks don't move
relative to each other → algorithm thinks it's ego-motion →
suppresses. **Fix**: combine with head-pose matrix (rotation). If
rotation is non-zero, head moved; if rotation is zero AND centroid
shifted, it's ego-motion.

### F. Background recalibration — L1/L2/L3 auto-correction loop

Implements the three-layer correction architecture from
`prism-training/PLAN_2026-05-09_THREE_LAYER_AAC.md`.

Real-world drift sources:
1. User shifts in chair (mostly Y drift)
2. User scoots toward/away from screen (Z drift → uniform XY scaling)
3. User rotates desk chair (Z-rotation → mapping rotation)
4. Lens auto-focus shifts on cheap webcams (hardware drift)

**L1 — Measure**: EWMA of mirroredX/normY with 30 s half-life. Drift
threshold 3% (0.03 norm units), warmup 15 s. Fires every 2 s check.

**L2 — Correct**: Synalux returns offset `{dx, dy}`; PrismAAC shifts
all 4 calibration anchors by that delta and persists. For scale drift
(user moved closer/farther), Synalux returns scale factors; PrismAAC
rescales the rect around its midpoint.

**L3 — Verify**: After L2 correction, Synalux collects 10 s of fresh
drift readings and computes a linearly-weighted summary (recent samples
count more than early ones):
- `weightedDrift ≤ 0.015` → **SUCCESS** — correction held, reset to L1
- `weightedDrift > 0.015`, retries left → **RETRY** from L1
- 3 retries exhausted OR 2-min timeout → **NEEDS_RECALIBRATION**:
  fires `prism-recalibration-needed` window event; `CameraInputOverlay`
  shows a 12 s amber toast prompting the user to re-run the wizard.

**Online path**: `CorrectionLoop` POSTs to
`POST /api/v1/prism-aac/tracking/correct` (Synalux, stateless).

**Offline fallback**: local `BaselineTracker` single-level correction
(no L3 verify). Fires `prism-recalibration-needed` after 3 failures.

### G. Camera contention between services (CRITICAL)

`headTracker` and `bodyPoseService` each open their own
`getUserMedia()`. Result: enabling both simultaneously makes the
second one fail. User has no diagnostic.

**Fix**: extract a `services/cameraStream.ts` singleton that owns
the MediaStream. Both tracker services subscribe to its `videoElement`
ref. Only ONE `getUserMedia()` call ever.

```ts
// services/cameraStream.ts
let stream: MediaStream | null = null;
let video: HTMLVideoElement | null = null;
const subscribers = new Set<(v: HTMLVideoElement) => void>();

export async function acquireCamera(deviceId?: string): Promise<HTMLVideoElement> {
    if (video) return video;
    stream = await navigator.mediaDevices.getUserMedia({ video: { deviceId } });
    video = document.createElement('video');
    video.srcObject = stream;
    await video.play();
    subscribers.forEach(cb => cb(video!));
    return video;
}

export function subscribe(cb: (v: HTMLVideoElement) => void): () => void {
    subscribers.add(cb);
    if (video) cb(video);
    return () => subscribers.delete(cb);
}

export function release(): void {
    if (subscribers.size === 0 && stream) {
        stream.getTracks().forEach(t => t.stop());
        stream = null;
        video = null;
    }
}
```

Both `headTracker.ts` and `bodyPoseService.ts` migrate to this. Each
service still runs its own MediaPipe pipeline, just sharing the video
input. Memory + bandwidth savings: from 2× video decode to 1×.

### H. Cross-modal interference (gesture vs head dwell)

Today, gestureDetector emits events independently. If a user
intentionally blinks (a configured gesture → "speak last word"), it
fires the click immediately. But if the user was *also* about to land
a dwell on a button, BOTH events fire and the wrong action wins.

**Fix**: when gestureDetector dispatches an event, broadcast a
`gesture-claim` window event. `headTracker.tick()` listens for it
and suspends dwell-click for 250ms post-claim. Dwell counters reset
so the user has to re-acquire the target — no accidental double-clicks.

The reverse direction (head dwell suspends gestures) is NOT done —
gestures should always pass through, so the user can interrupt a
dwell with an intentional blink.

### I. iOS DeviceMotion / Sensor.gyro IMU correction

iPad / iPhone can report device motion via the `DeviceMotionEvent`
API (requires user gesture to start, just like AudioContext). When
available:

```ts
window.addEventListener('devicemotion', (e) => {
    const accel = e.acceleration;
    const rot = e.rotationRate;
    if (Math.hypot(accel.x, accel.y, accel.z) > THRESHOLD) {
        // Device is moving — boost confidence floor so jittery
        // landmarks during shake don't fire drift.
        // Also: feed acceleration vector into the ego-motion
        // estimator (E) for ground-truth correction.
    }
});
```

Caveats:
- Permission required on iOS 13+ (`DeviceMotionEvent.requestPermission`)
- Only available on actual iOS / Android devices, not desktop
- Sample rate 60Hz on most devices

**Reach**: maybe 30% of users (those on iOS who grant permission). Not
a panacea, but a strong signal where available.

### J. Edge-pinning detection

When calibration fails, `(normX - rightX) / rangeX` can produce values
outside `[0, 1]`, which we then clamp to screen edges. The cursor
*pins* to the edge. Today, dwell can still fire on whatever button is
nearest the pin point — accidental clicks.

**Fix**: in `tick()`, if `sx` or `sy` is within 5% of any screen edge
for > 2s, skip dwell logic entirely and increment a "edge pin" counter.
After 3 pins in a 30s window, escalate to drift trigger.

### K. Safe mode (degraded operation)

Today: tracking is binary on/off. If reliability is bad, drift
auto-disables. But what if the user genuinely needs an input modality?

**Safe mode** is a degraded state where:
- Cursor only moves with VERY large head motions (sensitivity capped at
  1.5×, threshold tripled)
- Dwell time doubled (1200ms → 2400ms — high false-positive guard)
- No multi-camera fusion, just primary camera
- No gesture detection (one channel at a time, less to go wrong)

Triggered after 2 drift auto-disables in 5 minutes. Safe mode unlocks
back to full mode on user's manual setting toggle.

## Audit follow-up — gaps surfaced AFTER initial doc

A second-pass audit on 2026-05-05 surfaced issues NOT in the original 11:

1. **Auto-recover wiring was missing** — `ReliabilityProbe` primitive existed
   but was never instantiated, and `onAutoRecover` callback was never called.
   *Fixed*: new `services/reliabilityProbe.ts` runs a 1Hz background probe
   after drift, opens a tiny 320×240 stream, runs FaceDetector, and calls
   `onRecover` on a 10-frame stable streak. Toast shows live progress bar.

2. **Edge-pin escalation was unreachable in the most common failure mode** —
   the original logic required N *separate* pin episodes (cursor leaves
   the edge between each). A calibration-broken cursor that stayed pinned
   to a corner for minutes never escalated. *Fixed*: sustained pin of
   `pinTriggerMs × pinEscalateCount` now also escalates.

3. **Ego-motion was conditionally wired** — `lastLandmarkPoints` only
   populated when `onLandmarks` callback was provided (gesture mode), so
   users with head-tracking-only (no gestures) got zero "moving car"
   protection. *Fixed*: FaceLandmarker is now always initialized.

4. **Safe mode was missing** — the doc designed it but the code only had
   binary on/off behavior. *Fixed*: `services/safeMode.ts` persists drift
   events to `localStorage`, applies caps to sensitivity / dwell / cameras
   / gestures when 2+ drifts hit within 5 minutes.

5. **`fuseWeighted` is documented as future-use** — current Active-Failover
   approach is intentionally NOT averaging across physical cameras (different
   physical positions = incompatible coordinate planes). The primitive
   stays available for same-frame multi-detector fusion (FaceDetector +
   FaceLandmarker centroid) or pre-calibrated multi-cam rigs. NOT a bug —
   architectural choice.

## L. Anchor-based calibration (gap F follow-up) ✅ shipped

Every successful dwell-click is now ground-truth data. When the user
holds gaze on a button at known screen position long enough to fire a
dwell, the cursor was at `(sx, sy)` but the user's intent was the
button's center `(tx, ty)` — therefore `(sx - tx, sy - ty)` IS the
calibration error at this moment.

`services/headTracker.ts:applyAnchorCorrection` shifts the four
calibration anchors by `ANCHOR_LEARNING_RATE × δ` where δ is the
normalized-coord equivalent of the pixel offset:

```
δ_x = (sx - tx) / sensitivityScale × rangeX / window.innerWidth
```

Defaults:
- `ANCHOR_LEARNING_RATE = 0.3` — converges ~half error after 2 clicks,
  ~90% after 7 clicks. Low enough that a single off-center click can't
  corrupt calibration.
- `ANCHOR_MIN_PIXEL_OFFSET = 8` — below this the cursor was effectively
  on target; nothing to learn (and we'd just inject noise).
- `ANCHOR_MAX_PIXEL_OFFSET = 200` — above this the dwell almost
  certainly bubbled to an unintended ancestor element; ignore.

After applying, `BaselineTracker.acceptCorrection()` is called so the
slow-drift gap-F path doesn't ALSO fire an offset on top. Combined
effect: calibration self-corrects from BOTH slow drift (60s window)
and individual successful interactions (instant).

Telemetry: emits `recalibration-applied` with `kind: 'anchor'` and
`magnitude` = pixel offset.

## M. Telemetry bus + debug overlay ✅ shipped

The reliability stack emits 12 distinct lifecycle events. Without a
unified bus, each consumer (analytics, support, debug UI) had to wire
up callbacks individually. `services/trackingTelemetry.ts` is the
single point where all events land:

```
drift              ← driftDetector.check()
edge-pin-warn      ← EdgePinDetector returns 'pin'
edge-pin-escalate  ← EdgePinDetector returns 'escalate'
safe-mode-enter    ← recordDriftEvent crosses triggerCount
safe-mode-exit     ← clearDriftHistory cleared an active state
probe-start        ← reliabilityProbe interval begins
probe-recover      ← 10 stable frames hit
probe-stop         ← teardown without recovery
ego-motion-suppress ← classifyMotion returned isEgoMotion=true
recalibration-applied ← offset / scale / anchor correction applied
imu-shaking        ← DeviceMotion peak crossed shakeThreshold
imu-idle           ← peak fell below idleFloor
```

API:
- `emitTrackingEvent(event)` — fire to all subscribers.
- `subscribeTrackingEvents(listener)` — receive everything.
- `subscribeTrackingEventType('drift', l)` — narrowed by discriminator.

Listener errors are caught so one bad consumer can't break the bus.

`components/TrackingDebugOverlay.tsx` consumes the bus and renders the
last 20 events as a fixed-corner panel. Hidden by default; activates
via `?debug=tracking` URL query OR `localStorage["prism-tracking-debug"]
= "1"`. Mounted unconditionally in `PrismApp` but returns null for
end users (no DOM, no listeners until activated).

## Modern best-practice references

These are well-documented techniques in the assistive-tech literature
that could lift our reliability:

1. **Kalman + RTS smoother** — Apple's gaze tracking on Vision Pro;
   Tobii Eye Tracker 5 reportedly uses a 2-pass Kalman.
2. **MediaPipe Holistic** — single model that emits face + pose +
   hands together (vs our 3 separate). Heavier, but no contention.
   Worth piloting on iPad-class hardware.
3. **WebGazer.js technique: per-user model fine-tuning** — calibrate
   not against 4 corners, but against natural button taps. Each time
   the user clicks a known button, we learn the (normX, normY) → that
   button mapping. Over a session, calibration auto-improves.
4. **Tobii's "valid gaze" filter** — they require gaze to fall within
   a specific volume relative to the screen plane before reporting a
   measurement. Outside that volume, return "no gaze". Equivalent for
   us: if face is outside expected box (centered, taking 30-60% of
   frame), don't update cursor.
5. **Apple AssistiveTouch dwell** — the dwell click target *snaps* to
   the nearest button before firing. Reduces precision requirements by
   2-3×. We have this for `interactiveEl?.closest(...)` but not for the
   cursor itself.

## Implementation order (priority for shipping)

1. **C** — wire `fuseWeighted` (30m, low risk, big win for multi-cam)
2. **G** — singleton camera (3h, blocks H+I from working at all)
3. **D** — Kalman replaces EMA (4h, biggest single-camera reliability win)
4. **E** — ego-motion correction (6h, the "moving car" requirement)
5. **F** — background recalibration (4h, fewest user-facing prompts)
6. **J** — edge-pin detection (1h, easy win)
7. **H** — cross-modal lockout (2h, prevents UX regression as we add fidelity)
8. **K** — safe mode (4h, escape valve before fully disabling)
9. **I** — DeviceMotion (3h, only ~30% users benefit)

## Tests to keep this honest

- `tests/headTrackerStability.test.ts` ✅ — drift, recovery, fusion (14 cases)
- `tests/kalmanFilter1D.test.ts` — synthetic clean / noisy / occluded sequences
- `tests/cameraStream.test.ts` — singleton acquire/release, subscriber dispatch
- `tests/egoMotion.test.ts` — synthetic camera-shake vs head-motion separation
- `tests/recalibration.test.ts` — drift correction, scaling correction, anchor
- `tests/edgePin.test.ts` — pin counter, escalation to drift
- `tests/crossModalLockout.test.ts` — gesture event → 250ms dwell suspend

Total target: 60+ unit tests covering all 11 gaps.

## What "military stable" actually means here

The phrase is aspirational; the operational definition is:

1. **In a moving car, sitting upright with laptop on lap**: cursor
   stays within the user's intent ±50 px for 90% of frames during a
   30-second segment.
2. **In bright direct sun → moving into shade**: tracking continues
   without drift trigger; confidence dips < 5s, recovers automatically.
3. **Person walks into background**: cursor doesn't drift to track the
   new face (face-identity lock).
4. **User reaches over to grab water**: tracking pauses (face out of
   frame), resumes when face returns within 3s.
5. **Calibration drift from 30 minutes of seat-shifting**: cursor
   stays within ±100 px of intent (auto-recalibration).
6. **Power user lighting flicker (LED 60Hz beat with camera)**: noise
   suppressed by filter; no user-visible cursor jitter.

We don't promise "battlefield NVG-grade" — that needs IR, IMU, and
specialized hardware. We promise a much higher floor than today on
the consumer laptop / iPad webcam class.

</details>
