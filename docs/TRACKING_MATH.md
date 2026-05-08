# PrismAAC Tracking Math — Implementer's Reference

This document explains every mathematical operation that runs between
"camera frame arrives" and "cursor pixel position emitted" in the
PrismAAC body / head tracking pipeline. It is the source of truth
that the test suites enforce — `tests/poseCalibration.test.ts`,
`tests/oneEuroFilter.test.ts`, `tests/procrustes.test.ts`,
`tests/poseStabilization.test.ts`, `tests/mediapipeRuntime.test.ts`,
`tests/trackingHardening.test.ts` (100 tests as of v1.4.0).

Audience: anyone modifying `services/bodyPoseService.ts`,
`services/headTracker.ts`, or any of the stabilization helpers.
Read this before making changes — every formula here is wired into
production and verified by tests.

If you're a clinician trying to understand why the cursor behaves
the way it does, jump to [§9 Failure Modes](#9-failure-modes--what-the-user-feels) — it's written
for that audience.

---

## Table of Contents

1. [Why this is life-critical](#1-why-this-is-life-critical)
2. [Pipeline at a glance](#2-pipeline-at-a-glance)
3. [Stage 1 — Pose detection (MediaPipe)](#3-stage-1--pose-detection-mediapipe)
4. [Stage 2 — Mirror + calibration mapping](#4-stage-2--mirror--calibration-mapping)
5. [Stage 3 — Online calibration learner](#5-stage-3--online-calibration-learner-no-wizard-required)
6. [Stage 4 — Ego-motion suppression (Procrustes/RANSAC)](#6-stage-4--ego-motion-suppression-procrustesransac)
7. [Stage 5 — Confidence-aware One Euro smoother](#7-stage-5--confidence-aware-one-euro-smoother)
8. [Stage 6 — Baseline drift correction](#8-stage-6--baseline-drift-correction)
9. [Failure modes — what the user feels](#9-failure-modes--what-the-user-feels)
10. [Tunables + their default rationale](#10-tunables--their-default-rationale)
11. [References](#11-references)

---

## 1. Why this is life-critical

PrismAAC is the AAC ("augmentative and alternative communication") app
for nonverbal users — children with cerebral palsy, ALS patients, etc.
The cursor IS the user's voice. A misfire = wrong word spoken to a
caregiver. A stuck cursor = silence at a moment they need water,
medication, help.

The math in this document was chosen specifically for users who:
- can't complete a formal calibration wizard (motor disabilities)
- use the app in non-stationary contexts (lap-held laptop in a moving
  car, restless child in a wheelchair)
- have involuntary motion their head/body produces but their finger
  doesn't (spasticity, tremor)
- run on the iPad mini 6 — A15 Bionic, 4 GB RAM, no native API access
  (browser-only)

Every component documented here exists because something simpler
failed under one of the constraints above. The provenance for each
choice is in the references at the end.

---

## 2. Pipeline at a glance

```
┌──────────────────────┐
│  iPad Camera (15 fps) │
└──────────┬───────────┘
           ▼
┌───────────────────────────┐
│  MediaPipe Pose Landmarker │  Stage 1 — 33 (x, y, visibility) per frame
│  (lite, float16, .task)   │
└──────────┬────────────────┘
           ▼
┌──────────────────────────────────┐
│  chooseAggregateTarget           │  Stage 1.5 — pick most-visible body part
│  (any_wrist / any_index / nose)  │
└──────────┬───────────────────────┘
           ▼
┌──────────────────────────────────┐
│  Mirror (1 - normX)              │  Stage 2 — front-camera flip
│  Calibration rect → screen px    │           + mapPoseToScreen()
└──────────┬───────────────────────┘
           ▼
┌──────────────────────────────────┐
│  OnlineCalibrationLearner        │  Stage 3 — auto-tunes calibration
│  (5/95 percentile of last 300)   │           from real motion envelope
└──────────┬───────────────────────┘
           ▼
┌──────────────────────────────────┐
│  fitSimilarityRansac (Procrustes)│  Stage 4 — separates camera shake
│  → suppress on rigid-body motion │           from user motion
└──────────┬───────────────────────┘
           ▼
┌──────────────────────────────────┐
│  ConfidenceAwareOneEuro          │  Stage 5 — adaptive low-pass
│  cutoff = mc(visibility, noise)  │           jitter rejection w/o lag
│         + β · |dx̂|              │
└──────────┬───────────────────────┘
           ▼
┌──────────────────────────────────┐
│  BaselineTracker offset/scale    │  Stage 6 — slow drift correction
│  corrections every 5 s           │
└──────────┬───────────────────────┘
           ▼
       cursor (x, y) px
```

Every stage is a pure-ish operation tested in isolation. The
glue (per-frame loop) lives in `services/bodyPoseService.ts`
inside `startPoseTracker()`.

---

## 3. Stage 1 — Pose detection (MediaPipe)

**Code:** `services/mediapipeRuntime.ts`, `services/bodyPoseService.ts:initPoseLandmarker`.
**Tests:** `tests/mediapipeRuntime.test.ts`.

### Model
**MediaPipe Tasks Vision PoseLandmarker, lite variant, float16.**
Pinned to a specific version (`@mediapipe/tasks-vision@0.10.35`)
loaded from jsdelivr — never `@latest`. The pinned-version contract
is enforced by a test that compares the constant against
`package.json`.

### Why this model
The 2026 SOTA review (research delegated mid-session) compared
PoseLandmarker lite against MoveNet Lightning, BlazePose-tfjs,
YOLOv8-Pose-nano, and RTMPose-s/t for browser-runnable inference
on iPad mini 6 (A15, WebGL2 — WebGPU not yet exposed in Safari
17/18). PoseLandmarker won on the metrics that matter for AAC:
accuracy on partial / occluded poses (the BlazePose lineage was
trained for fitness/yoga where occlusion is extreme — exactly the
condition AAC users run in).

### What it produces
33 landmarks per detected pose. Each landmark is `{ x, y, visibility }`
in normalized [0..1] image coordinates. We use the per-landmark
`visibility` directly as the confidence input to Stage 5.

### FPS watchdog
**Code:** `services/mediapipeRuntime.ts:FpsWatchdog`.
EWMA of frame intervals (1 s half-life). When fps drops below
12 for 3 consecutive seconds, dispatches a `prism-pose-starved`
window event so the UI can warn the caregiver. Catches thermal
throttle on iPad mini 6 under sustained inference.

```ts
// Caller — in the per-frame loop:
fpsWatchdog.tick(performance.now());
if (fpsWatchdog.isStarved() && !alreadyDispatched) {
  window.dispatchEvent(new CustomEvent('prism-pose-starved', {
    detail: { fps: fpsWatchdog.fps() },
  }));
}
```

---

## 4. Stage 2 — Mirror + calibration mapping

**Code:** `services/bodyPoseService.ts:mapPoseToScreen` (pure helper, exported).
**Tests:** `tests/poseCalibration.test.ts:describe('mapPoseToScreen …')`.

### The mirror
Front-camera selfie convention: when you raise your right hand, you
see it on the right of the screen even though it's on the left of
the raw camera image. We undo that:

```ts
mirroredX = 1.0 - normX
```

`normY` is NOT mirrored (vertical isn't flipped by selfie cameras).

### The calibration rect
A `PoseCalibrationData` is a 4-tuple in pose-space:

```ts
{ leftX, rightX, topY, bottomY }
```

with the **load-bearing convention**:

```
leftX  >  rightX        (leftX is the LARGER mirroredX value)
topY   <  bottomY       (topY is the SMALLER normY)
```

This convention is counter-intuitive — read it carefully. `leftX`
stores the value of `mirroredX` when the user's head/hand is at
the **right edge of the screen** (which corresponds to the left
side of the raw camera image, hence the higher mirrored-X value).

`DEFAULT_CALIBRATION = { leftX: 0.75, rightX: 0.05, topY: 0.2, bottomY: 0.8 }`
matches this convention.

### The mapping formula

```ts
rawX = (mirroredX - rightX) / (leftX - rightX) * screenW
rawY = (normY      - topY)   / (bottomY - topY) * screenH
```

Then sensitivity (zoom around screen center):

```ts
rawX = centerX + (rawX - centerX) * sensitivityScale
rawY = centerY + (rawY - centerY) * sensitivityScale
```

Then clamp to screen bounds.

### MIN_RANGE guard
If `rangeX = leftX - rightX < 0.02` OR `rangeY < 0.02` OR either is
negative, we substitute `DEFAULT_CALIBRATION`. The 0.02 floor (down
from 0.30 in May 2026) accepts legitimate accessibility-user
calibrations as narrow as 5 % of the camera frame; only inverted /
zero-range / corrupt data is rejected.

### The bug this convention caught
Before May 2026, the wizard captured calibrations with
`leftX < rightX` (the inverse of this convention). That made
`rangeX < 0`, the MIN_RANGE guard fired every frame, the saved
calibration was silently replaced with `DEFAULT_CALIBRATION`, and
the wizard was effectively a placebo for ~12 months. The fix
(commit `cd9a491`) was to enforce the convention by construction
in `computeCalibrationFromCorners` via `Math.max` for `leftX` and
`Math.min` for `rightX`.

---

## 5. Stage 3 — Online calibration learner (no wizard required)

**Code:** `services/bodyPoseService.ts:OnlineCalibrationLearner`.
**Tests:** `tests/poseCalibration.test.ts:describe('OnlineCalibrationLearner …')`.

### Why it exists
Most AAC users can't complete a formal 4-corner pointing wizard.
The pipeline must produce a working cursor from the moment a body
landmark is detected, then refine the calibration as the user
actually moves through their natural motion envelope.

### The math
Sliding window of the last `MAX_SAMPLES` (default 300, ~10 s at
30 Hz) pose samples per axis. Every `UPDATE_EVERY` frames
(default 30 ≈ 1 s) compute the percentile bounds:

```
rightX  =  P5  of mirroredX in window     (5th percentile)
leftX   =  P95 of mirroredX in window     (95th percentile)
topY    =  P5  of normY     in window
bottomY =  P95 of normY     in window
```

These four values become a `PoseCalibrationData` with the correct
convention by construction.

### Why 5/95 percentile (and not min/max)
Min/max would expand the calibration with a single MediaPipe
outlier (a misdetection puts the "wrist" at the corner of the
frame for one frame). 5/95 percentile rejects outliers naturally
and tracks the user's typical motion envelope.

### Blending
The learner doesn't replace the live calibration each frame —
that would lurch the cursor. It **blends**:

```ts
const BLEND = isFirstCommit ? 0.5 : 0.05;
calibration.leftX = calibration.leftX * (1 - BLEND) + learned.leftX * BLEND;
```

Faster blend (0.5) on the first commit so the cursor starts working
within ~2 s. Slower blend (0.05) once stable so the calibration
respects what the wizard captured (if the wizard ran) and only
slowly adapts away from it.

### Persisted to localStorage
On every commit we call `savePoseCalibration(calibration)` so a
reload starts close to the learned state instead of from defaults.

---

## 6. Stage 4 — Ego-motion suppression (Procrustes/RANSAC)

**Code:** `services/egoMotion.ts`.
**Tests:** `tests/procrustes.test.ts`.

### What this stage solves
The "moving car" requirement: when the laptop bounces with the
road, ALL body landmarks shift by approximately the same
(dx, dy, scale, rotation). That's camera shake, not user intent.
We must NOT move the cursor on those frames.

### The legacy method (kept for back-compat)
`classifyMotion()` — binary gate on centroid + per-landmark
residual. Catches pure translation. **Misses vehicle ROLL**: top
landmarks shift opposite bottom landmarks under rotation; centroid
stays put; residuals exceed threshold; method classifies as
deliberate motion → cursor jets around with each bump.

### The current method — Umeyama 1991 + RANSAC

A **4-DOF similarity transform** is fit between the previous
frame's landmarks and the current frame's landmarks:

```
curr ≈ s · R(θ) · prev + t
```

where:
- `t = (tx, ty)` is the translation (camera shifted)
- `s` is the scale (camera moved closer / further)
- `R(θ)` is the 2D rotation matrix (camera rolled)

#### Closed-form 2D similarity (`fitSimilarityTransform`)

Given centroids `m = mean(prev)`, `n = mean(curr)`:

```
prev_c = prev - m
curr_c = curr - n
numA   = Σ (prev_c.x · curr_c.x + prev_c.y · curr_c.y)
numB   = Σ (prev_c.x · curr_c.y - prev_c.y · curr_c.x)
denom  = Σ (prev_c.x² + prev_c.y²)

s · cos θ = numA / denom
s · sin θ = numB / denom
s         = √((s·cosθ)² + (s·sinθ)²)
θ         = atan2(s·sinθ, s·cosθ)
t         = n - s · R(θ) · m
```

This is Umeyama 1991 specialized to 2D similarity. Mathematically
identical to the SVD-based form used in OpenCV's
`estimateAffinePartial2D` but cheaper (no SVD).

#### RANSAC outlier rejection (`fitSimilarityRansac`)

Picks 2 random correspondences, fits a candidate transform,
counts how many of the remaining points are "inliers" (residual
< 0.01 normalized units after applying the transform). Repeats
12 times, keeps the candidate with the most inliers, refits on
the inlier consensus set for the final transform.

This rejects the user's moving wrist as an outlier — the rigid
body majority (shoulders, hips, ears) defines the camera motion;
the wrist's deliberate motion has too high a residual to count.

### The landmark subset we pass to RANSAC

```ts
const SAFE_LANDMARK_INDICES = [
  7, 8,    // ears
  11, 12,  // shoulders
  23, 24,  // hips
];
```

These are pose-stability anchors — they move minimally with normal
pointing motion, so RANSAC locks onto them as the rigid majority.
We deliberately exclude wrists / index fingers because **those are
the outliers we want to keep moving**.

### How it's wired
Currently the recovered transform is consumed only via its
**magnitude**:

```ts
const transformMagnitude =
    Math.hypot(cameraTransform.tx, cameraTransform.ty)
  + Math.abs(Math.log(cameraTransform.scale))
  + Math.abs(cameraTransform.theta);

const suppressForEgoMotion =
  cameraTransformInliers >= 3 && transformMagnitude > 0.005;
```

When suppressed, the cursor holds at its previous filtered value
(the Stage 5 smoother runs predict-only).

### Future Step 2.5 — continuous subtraction
The full transform (rotation + scale + translation) is computed
each frame but only used for the binary gate. The next iteration
(documented in the research review) is to **subtract the
transform from the cursor source landmark continuously** instead
of binary-gating whole frames. This degrades gracefully under
sustained shake instead of producing a "stuck cursor" failure
mode. Not yet wired (intentional scope).

---

## 7. Stage 5 — Confidence-aware One Euro smoother

**Code:** `services/oneEuroFilter.ts`.
**Tests:** `tests/oneEuroFilter.test.ts`.

### Why we use One Euro and not Kalman
This is the May 2026 SOTA-research finding. Casiez, Roussel & Vogel
(CHI 2012) wrote the One Euro Filter specifically because Kalman
behaved badly on real-time UI input streams from noisy cameras.
**MediaPipe itself uses One Euro** in its
`landmarks_smoothing_calculator`, and **Chromium uses it for
stylus / touch prediction** on every Android device. PrismAAC's
prior Kalman1D was the outlier in the world.

The Casiez paper directly compares the two: One Euro tracks the
**jitter-vs-lag trade-off** more favorably than Kalman with the
same input, using two intuitive parameters (`mincutoff`, `beta`)
instead of a Q/R covariance pair that needs hand-tuning per scene.

### The math

```
α(cutoff, freq)  =  1 / (1 + (1 / (2π · cutoff)) / (1 / freq))
                 =  1 / (1 + 1 / (2π · cutoff · te))   where te = 1/freq

dx̂(t)            =  lowpass(dx(t), α(d_cutoff, freq))
                    where dx(t) = (x(t) - x(t-1)) · freq

cutoff(t)        =  mincutoff + β · |dx̂(t)|

x̂(t)             =  lowpass(x(t), α(cutoff(t), freq))
```

The key idea: **the cutoff is speed-dependent**. When the input
moves slowly (low |dx̂|), the cutoff is low → heavy smoothing →
jitter rejected. When the input moves fast (high |dx̂|), the
cutoff rises → less smoothing → low lag during deliberate motion.

### Confidence-aware modulation (`ConfidenceAwareOneEuro`)
The original 1€ doesn't take a per-measurement confidence input.
For AAC users on cheap webcams, MediaPipe's per-landmark
visibility drops to 0.05–0.30 when the body part is partly out of
frame — those frames should be smoothed harder so the cursor
doesn't jump with the noise.

```
mincutoff_effective = lerp(
  mincutoff_low,    // applied at confidence = confLo  (default 0.3)
  mincutoff_high,   // applied at confidence = confHi  (default 1.0)
  clamp((confidence - confLo) / (confHi - confLo))
)
```

Defaults: `mincutoff_high = 1.0 Hz` (Casiez's recommended starting
value, responsive); `mincutoff_low = 0.3 Hz` (heavy smoothing for
partly-occluded poses). `beta = 0.007` keeps lag low during
deliberate fast moves. Strategy from HpEIS (Hu et al., ICME 2024)
for hand-pose UI cursors.

### Noise-floor modulation (Step 1.5)
`ConfidenceAwareOneEuro.setNoiseFloor(noise)` applies a SCALAR on
top of the confidence-derived mincutoff:

```
noise ≤ 0.005 (quiet, stationary)  →  scale = 1.0  (no extra smoothing)
noise ≥ 0.05  (heavy car jitter)   →  scale ≈ 0.3  (cap at mincutoff_low)
linear interpolation between
```

The noise level comes from `BaselineTracker.getNoiseFloor()` —
RMS of running variance — so it auto-adjusts as the environment
changes. User in a quiet room → responsive cursor. User in a
moving car → heavier smoothing automatically without touching
settings.

### Variable framerate
`OneEuroFilter.filter(value, timestampMs?)` accepts an optional
timestamp. When provided, it computes true `dt` between samples
instead of using the configured `freq`. Important on Safari which
throttles tab framerates aggressively.

### NaN defenses
- NaN measurement → returns previous value (defensive).
- NaN confidence → treated as 0 in clamp (heaviest smoothing).
- Negative / NaN noise floor → falls through to no-noise scale.
- `snapTo(NaN)` → no-op (preserves last good value).

---

## 8. Stage 6 — Baseline drift correction

**Code:** `services/recalibration.ts`.
**Tests:** `tests/poseStabilization.test.ts:describe('BaselineTracker …')`,
`tests/trackingHardening.test.ts`.

### What this stage solves
Calibration drift over time: the user shifts in their seat, the
camera auto-focus pulses, the lens warms up. After 30 minutes of
use, the cursor's "center" no longer matches the user's "center"
even though the calibration math is perfect.

### The math
Two exp-weighted moving statistics over (mirroredX, normY) per
frame:

```
α_mean(dt)    = 1 - 0.5^(dt / meanHalfLifeMs)        // default 60 s
α_var(dt)     = 1 - 0.5^(dt / varianceHalfLifeMs)    // default 30 s

mean'_x       = mean_x + α_mean · (sample.x - mean_x)
var'_x        = max(0, var_x + α_var · ((sample.x - mean_x)·(sample.x - mean'_x) - var_x))
                                                     // Welford-EWMA, clamped ≥ 0
```

The clamp on variance was added in the May 2026 military-grade
review — Welford-style updates can briefly drive variance negative
on a step change in mean.

### Baseline lock + drift detection
After a `minWarmupMs` window (default 30 s), the tracker locks the
current `(mean_x, mean_y)` as the **baseline**. From that point
on:

```
dx = current_mean_x - baseline_x
dy = current_mean_y - baseline_y

if |dx| > offsetThreshold OR |dy| > offsetThreshold:
  suggest OffsetCorrection { deltaNormX: dx, deltaNormY: dy }
```

The body-pose tracker queries this every 5 seconds and applies
the suggested offset to all four calibration corners
(`leftX += dx`, etc.).

### Live noise floor (Step 1.5)
```
getNoiseFloor() = √(varX² + varY²)
```
Returns 0 during warmup (< 30 samples). Typical scale documented
in code:

| Noise floor | Environment |
|---|---|
| 0.001 – 0.005 | stationary user, good lighting |
| 0.005 – 0.015 | light hand jitter / talking |
| 0.020 – 0.080 | moving car / lap-held laptop |
| 0.050+ | severe spasticity / camera shake |

This feeds Stage 5's noise-floor modulation directly.

### Scale correction
If the variance ratio current/baseline drops below a threshold
(`shrinkThreshold`, default 0.7) on both axes, the user's range
shrunk — they're not reaching as far as during calibration.
Surface a `ScaleCorrection { scaleX, scaleY }` so the calibration
rect can shrink correspondingly. (Currently observed via the diag
panel; auto-application is a Step 7 follow-up.)

---

## 9. Failure modes — what the user feels

### "Cursor doesn't follow my head"
- **MediaPipe failed to detect** → diag panel shows
  `tracker: lost`. Move into camera frame; check lighting;
  check that camera permission is granted.
- **Calibration was reset to defaults** → diag panel shows
  `cal: L=0.75 R=0.05 T=0.2 B=0.8` and `convention: OK`.
  Run wizard, OR just keep moving — the OnlineCalibrationLearner
  will adapt within ~2 s.
- **Cursor is at a fixed offset from the target** → expected
  before calibration. Wizard step 2 captures the corners; until
  all 4 are captured, the cursor uses defaults.

### "Cursor lurches under car jitter"
- **Stage 4 (Procrustes/RANSAC) is suppressing** → diag shows
  `⛔ ego-motion suppressed`. This is the intended behavior
  during a road bump; cursor holds at its prior position.
- **Stage 5 (One Euro)** auto-tunes via the noise floor; if the
  diag shows `noise: heavy`, smoothing has been turned up.

### "Cursor lags during fast deliberate motion"
- **One Euro `beta` too low**. Default 0.007 is conservative.
  Tune via `bodyPoseService.ts:startPoseTracker` opts (not yet
  user-exposed).

### "Cursor barely moves even though my head moves"
- **Calibration range collapsed** to `MIN_RANGE`. Open the diag
  panel; if `min-range: TOO NARROW`, do bigger head turns OR run
  the wizard with exaggerated motion. The OnlineCalibrationLearner
  will widen the range as you move further.

### "Cursor freezes intermittently"
- **FpsWatchdog tripped** → console logs
  `[PoseTracker] FPS STARVED — model running at N fps for >3s`.
  iPad mini 6 thermal throttle. Close other tabs; let device cool;
  consider switching to head-only tracking (lighter than body pose).

---

## 10. Tunables + their default rationale

| Knob | Default | Where set | Rationale |
|---|---|---|---|
| `KALMAN_PROCESS_NOISE` (deprecated) | 4 px²/frame | (removed) | Replaced by One Euro |
| `mincutoff_high` | 1.0 Hz | `bodyPoseService.ts:startPoseTracker` | Casiez 2012 recommended |
| `mincutoff_low` | 0.3 Hz | same | Heavy smoothing for low-vis |
| `beta` | 0.007 | same | Casiez 2012 recommended |
| `MAX_SAMPLES` (learner) | 300 | `OnlineCalibrationLearner` | ~10 s @ 30 Hz |
| `MIN_SAMPLES` (learner) | 60 | same | ~2 s warmup before first commit |
| `LO_PERCENTILE / HI_PERCENTILE` | 0.05 / 0.95 | same | Outlier-robust envelope |
| `BLEND` (first commit) | 0.5 | `bodyPoseService.ts` | Fast convergence |
| `BLEND` (subsequent) | 0.05 | same | Respect wizard contribution |
| `RANSAC iterations` | 12 | `fitSimilarityRansac` | Sufficient for 6 anchors |
| `RANSAC inlierThreshold` | 0.01 normalized | same | ~6 px on 640-px frame |
| `RANSAC minInliers` | 3 | same | At least half of the safe anchors |
| `transformMagnitude threshold` | 0.005 | `bodyPoseService.ts` | Empirically: below this, no perceptible motion |
| `MIN_RANGE` (cal guard) | 0.02 | `mapPoseToScreen`, `bodyPoseService.ts` | Allows narrow accessibility cals |
| `meanHalfLifeMs` (BaselineTracker) | 60 000 | `recalibration.ts` | 1 min adaptation |
| `varianceHalfLifeMs` | 30 000 | same | Faster adapt for noise-floor signal |
| `offsetThreshold` | 0.05 | same | 5 % of pose space — ignore micro-drift |
| `minWarmupMs` | 30 000 | same | Don't suggest corrections before settled |
| `FPS starvation threshold` | 12 fps | `mediapipeRuntime.ts` | Below interactive threshold |
| `FPS starvation consecutive` | 3 000 ms | same | Don't flap on single slow frame |

Every default in this table has a corresponding test in
`tests/poseCalibration.test.ts` or `tests/oneEuroFilter.test.ts`
that pins behavior at the default — change the default, expect
to update tests.

---

## 11. References

### Algorithms
- **Casiez, G., Roussel, N. & Vogel, D. (2012).** "1€ Filter:
  A Simple Speed-Based Low-Pass Filter for Noisy Input in
  Interactive Systems". CHI 2012.
  https://gery.casiez.net/1euro/ ·
  PDF: https://gery.casiez.net/publications/CHI2012-casiez.pdf
- **Umeyama, S. (1991).** "Least-squares estimation of
  transformation parameters between two point patterns".
  IEEE TPAMI 13(4), 376–380.
- **Fischler, M. A. & Bolles, R. C. (1981).** "Random Sample
  Consensus: A Paradigm for Model Fitting with Applications to
  Image Analysis and Automated Cartography". Comm. ACM 24(6).

### Models
- **MediaPipe Tasks Vision PoseLandmarker (lite, float16).**
  Pinned at `@mediapipe/tasks-vision@0.10.35`.
  Underlying network: BlazePose (Bazarevsky et al., 2020,
  arXiv:2006.10204).
- **MoveNet (Lightning).** Backup target for the model-runtime
  Step 3.5 (FPS-watchdog-triggered fallback). Not yet wired.
  https://blog.tensorflow.org/2021/05/next-generation-pose-detection-with-movenet-and-tensorflowjs.html
- **HpEIS — Hand-Pose Embedded Interactive Systems.**
  Hu et al., ICME 2024. arXiv:2410.07347. Inspiration for the
  confidence-modulated cutoff in our One Euro wrapper.

### Internal docs
- [`docs/TRACKING_RELIABILITY.md`](TRACKING_RELIABILITY.md) — the
  spec author's original gap analysis (items A–J).
- [`docs/GESTURE_RECOGNITION.md`](GESTURE_RECOGNITION.md) —
  gesture (blink / nod / morse) layer above this pipeline.
- [`docs/SELF-LEARNING-SAFETY.md`](SELF-LEARNING-SAFETY.md) —
  guardrails on the Online learner so it doesn't adapt into a
  state the user can't recover from.

### Implementation files
- `services/bodyPoseService.ts` — the per-frame loop that wires
  every stage together
- `services/oneEuroFilter.ts` — Stage 5
- `services/egoMotion.ts` — Stage 4
- `services/recalibration.ts` — Stage 6
- `services/kalmanFilter1D.ts` — legacy, still used by headTracker
- `services/mediapipeRuntime.ts` — Stage 1 + FPS watchdog
- `services/headTracker.ts` — head-only tracker (uses Kalman, not
  yet ported to One Euro — Phase 4 follow-up)

---

*Last updated: May 2026 — military-grade review pass.*
*Test posture: 100/100 across 6 pose suites.*
