# Gesture Recognition System — Design Document

> **TL;DR** — head-pose dwell click + per-user hand-pose gesture profiles. Runs on FaceLandmarker + MediaPipe Hands locally, no video leaves the device. Configurable per-child via the calibration UI.

## At a glance

- ✅ **Head-pose tracking** — dwell-click on any AAC tile or keyboard key
- ✅ **Hand-pose gestures** — per-child custom mappings (open palm = enter, fist = backspace, etc.)
- ✅ **Drift safety stack** — auto-disable + recalibration prompt
- ✅ **Esc escape hatch** — instantly disable tracking and return to qwerty without losing the message bar
- ✅ Camera-stream singleton — head + hand tracker share one stream

<details>
<summary><strong>📐 Full design doc — landmarks, smoothing, calibration, drift</strong></summary>

## Overview

PrismAAC's gesture recognition system detects head, eye, lip, and body gestures via the device camera and maps them to AAC actions. It is designed for nonverbal children and adults with motor disabilities (CP, spasticity, tremor, limited range of motion).

Two operating modes: **Basic** (works immediately, no training) and **Advanced** (custom training with DTW + 8B local model inference).

---

## Architecture

```
Camera Feed (15fps)
      │
      ▼
┌─────────────────────────────────────────────────────┐
│  MediaPipe FaceLandmarker (runs alongside existing   │
│  FaceDetector in headTracker.ts)                     │
│                                                      │
│  Outputs per frame:                                  │
│  • 478 face landmarks (3D normalized coords)         │
│  • 52 blendshapes (ARKit-compatible 0.0-1.0 floats)  │
│  • 4x4 facial transformation matrix (head pose)      │
└──────────┬──────────────────────────────────────────┘
           │
           │  onLandmarks callback
           ▼
┌─────────────────────────────────────────────────────┐
│  GestureDetector (gestureService.ts)                 │
│                                                      │
│  ┌──────────────────────────────────────────────┐    │
│  │  Signal Extractors (every frame)              │    │
│  │                                               │    │
│  │  Blink    → eyeBlinkLeft/Right blendshapes    │    │
│  │  Mouth    → jawOpen, mouthSmile*, mouthPucker │    │
│  │  Brow     → browInnerUp blendshape            │    │
│  │  HeadPose → pitch/yaw/roll from matrix        │    │
│  └──────────────────┬───────────────────────────┘    │
│                     │                                 │
│  ┌──────────────────▼───────────────────────────┐    │
│  │  Temporal Processing                          │    │
│  │                                               │    │
│  │  1. EMA smoothing (α=0.3) → removes jitter   │    │
│  │  2. Baseline subtraction → relative to user   │    │
│  │  3. Threshold comparison → above/below        │    │
│  │  4. Dwell validation → sustained 300ms+       │    │
│  │  5. Cooldown check → not within 1000ms        │    │
│  └──────────────────┬───────────────────────────┘    │
│                     │                                 │
│  ┌──────────────────▼───────────────────────────┐    │
│  │  Intent Resolution                            │    │
│  │                                               │    │
│  │  Basic:    threshold match → mapped action    │    │
│  │  Advanced: DTW template match → model verify  │    │
│  │                                               │    │
│  │  Output: GestureEvent { gesture, confidence } │    │
│  └──────────────────────────────────────────────┘    │
└──────────────────────────────────────────────────────┘
           │
           ▼
    AAC Action (button click, phrase speak, panel open)
```

---

## Basic Mode (No Training Required)

Basic mode uses the 52 MediaPipe blendshapes directly as gesture signals. It detects 7 built-in gestures out of the box:

### Detected Gestures

| Gesture | Blendshape(s) Used | Detection Method |
|---------|-------------------|------------------|
| **Intentional Blink** | `eyeBlinkLeft`, `eyeBlinkRight` | max(L,R) > 0.5 for 400ms+ (natural blinks are 100-300ms) |
| **Mouth Open** | `jawOpen` | value - baseline > 0.4, sustained 300ms+ |
| **Smile** | `mouthSmileLeft`, `mouthSmileRight` | max(L,R) - baseline > 0.35 (asymmetry-aware for CP) |
| **Pucker ("oo")** | `mouthPucker` | value - baseline > 0.4, sustained 300ms+ |
| **Head Nod** | transformation matrix → pitch | pitch oscillation range > 0.15 rad, >=2 zero-crossings in 1.5s |
| **Head Shake** | transformation matrix → yaw | yaw oscillation range > 0.2 rad, >=2 zero-crossings in 1.5s |
| **Eyebrow Raise** | `browInnerUp` | value - baseline > 0.35, sustained 300ms+ |

### How Thresholds Work

All thresholds are **relative to the user's personal baseline**:

1. User enables gesture recognition in Settings
2. A 3-second baseline capture runs automatically (hold still, look at camera)
3. System records the user's neutral-face blendshape values
4. Detection thresholds become: `(current_value - baseline_value) > threshold`

This means a child with CP who has a partial resting smile (e.g., mouthSmileRight = 0.3 at rest) will not false-trigger the smile gesture — the threshold measures *change from their normal*, not absolute value.

### Asymmetry Awareness

For children with hemiplegia or facial asymmetry:
- Blink detection uses `max(left, right)`, not `average(left, right)`
- Smile detection uses `max(left, right)`, not `average(left, right)`
- This means a child who can only smile on one side still triggers the gesture

### Fatigue Adaptation

Motor-disabled users fatigue over time, reducing their gesture amplitude:
- After 15 minutes: thresholds relax by 10% (multiplied by 0.9)
- After 30 minutes: thresholds relax by 20% (multiplied by 0.8)
- Session timer resets on explicit reset or app reload

### Jitter Filtering

Tremor and involuntary micro-movements are filtered by:
1. **EMA smoothing** (exponential moving average, α=0.3) on all blendshape values
2. **Dwell time** requirement (gesture must be sustained 300ms+, not a single-frame spike)
3. **Cooldown** between same gesture (minimum 1000ms, configurable up to 3000ms)
4. **Multi-frame consensus** for head gestures (requires 2+ full oscillation cycles)

---

## Advanced Mode (Trained, 8B Model)

Advanced mode builds on Basic mode and adds:

### Custom Gesture Recording (DTW)

1. Caregiver opens Settings → Gestures → Advanced → "Record Custom Gesture"
2. Picks an action to assign (e.g., "Say Yes", "Open Categories")
3. Camera shows live preview
4. Caregiver demonstrates the gesture 5 times (system records blendshape sequences)
5. System stores sequences as DTW (Dynamic Time Warping) templates
6. On use, live input is compared against stored templates using DTW distance

**DTW** handles speed variation — the same gesture performed faster or slower still matches. Template storage is ~100-200KB for 10 gestures with 5 examples each.

### Multi-Modal Fusion

Advanced mode combines multiple signal types with weighted confidence:

```
Signal Weights (per-user, auto-tuned):
  head:  0.30  (nod, shake, tilt)
  blink: 0.25  (intentional blink, wink)
  mouth: 0.25  (open, smile, pucker, viseme shapes)
  brow:  0.20  (raise, furrow)
```

**Fusion rules:**
- Available signals only (if body tracking lost, renormalize remaining weights)
- Multi-modal agreement bonus: +20% confidence when 2+ signals agree
- Conflicting signal penalty: -40% confidence when signals disagree
- Single-modality minimum: 0.85 confidence required (vs 0.6 for multi-modal)

### 8B Local Model Integration

The 8B model (prism-coder or equivalent, running locally via Ollama) provides:

1. **Viseme classification**: Given a sequence of lip blendshape frames, classify which phoneme/word the user is trying to mouth
2. **Complex gesture classification**: Multi-frame sequences that threshold detection cannot handle (e.g., "nod then smile" as a compound gesture)
3. **Gesture disambiguation**: When DTW returns close matches for multiple templates, the model breaks the tie
4. **Natural language feedback**: Generates human-readable descriptions of detected gestures for caregiver logs

The model runs on-device via Ollama. If Ollama is not available, Advanced mode falls back to DTW-only matching (no model inference).

### Auto-Learning

The system improves per-user over time:

1. After each gesture recognition, user can confirm (correct) or reject (wrong)
2. **Correct**: The recorded sequence is added as a new positive example (keeps best 10 per template)
3. **Wrong**: The acceptance threshold tightens by 8% (reduces false positives)
4. **Weight adaptation**: Modalities that produce correct results get +5% weight; incorrect get -5%
5. All learned data persists in localStorage under `prism-aac-settings`

---

## Lip/Mouth Detection Deep Dive

### Available Lip Blendshapes (from MediaPipe FaceLandmarker)

| Blendshape | What It Detects | AAC Use Case |
|------------|----------------|--------------|
| `jawOpen` | Mouth opens vertically | "Ah" sound, calling attention |
| `mouthSmileLeft` | Left corner pulls up | Smile gesture (happiness, agreement) |
| `mouthSmileRight` | Right corner pulls up | Smile gesture (use max for asymmetry) |
| `mouthPucker` | Lips push forward | "Oo" sound, kiss gesture |
| `mouthFunnel` | Lips form O shape | "Oh" sound |
| `mouthFrownLeft` | Left corner pulls down | Frown gesture (displeasure) |
| `mouthFrownRight` | Right corner pulls down | Frown gesture |
| `mouthClose` | Lips press together | Deliberate mouth close |
| `mouthRollLower` | Lower lip rolls inward | Complex lip movement |
| `mouthRollUpper` | Upper lip rolls inward | Complex lip movement |
| `mouthShrugLower` | Lower lip shrugs | Confusion expression |
| `mouthShrugUpper` | Upper lip shrugs | Confusion expression |
| `mouthDimpleLeft` | Left dimple | Subtle smile variant |
| `mouthDimpleRight` | Right dimple | Subtle smile variant |
| `mouthStretchLeft` | Left stretch | Wide opening |
| `mouthStretchRight` | Right stretch | Wide opening |
| `mouthUpperUpLeft` | Upper lip lifts left | Snarl/disgust expression |
| `mouthUpperUpRight` | Upper lip lifts right | Snarl/disgust expression |
| `mouthLowerDownLeft` | Lower lip drops left | Complex mouth shape |
| `mouthLowerDownRight` | Lower lip drops right | Complex mouth shape |
| `mouthPressLeft` | Left press | Lip pressing |
| `mouthPressRight` | Right press | Lip pressing |
| `mouthLeft` | Mouth shifts left | Lateral movement |
| `mouthRight` | Mouth shifts right | Lateral movement |

### Viseme Detection (Vowel Shapes)

By combining blendshapes, we can detect approximate vowel shapes:

| Viseme | Blendshape Pattern | Example Words |
|--------|-------------------|---------------|
| "Ah" (open) | `jawOpen > 0.5` | "mama", "papa" |
| "Ee" (spread) | `mouthSmile* > 0.4` + `jawOpen < 0.2` | "eat", "me" |
| "Oo" (round) | `mouthPucker > 0.5` | "you", "moon" |
| "Oh" (funnel) | `mouthFunnel > 0.4` | "go", "no" |
| Closed | `mouthClose > 0.5` + `jawOpen < 0.1` | "mmm", rest |

In Advanced mode, the 8B model can classify more complex viseme sequences (e.g., "ba" = closed→open, "ma" = closed→nasal→open).

### Reliability Concerns for Motor-Disabled Users

| Concern | Mitigation |
|---------|------------|
| Facial asymmetry (hemiplegia) | Use `max(left, right)` not average |
| Drooling affects lip landmarks | Baseline includes drool position; threshold is relative |
| Spastic facial movements | 300ms+ dwell requirement filters involuntary twitches |
| Limited range of motion | Per-user calibrated thresholds (some users can only achieve 0.3 smile) |
| Fatigue reduces amplitude | Auto-relax thresholds 10-20% after 15-30 minutes |
| Involuntary jaw clenching | Track `mouthClose` to suppress mouth_open false triggers |

---

## Settings UI

The gesture settings appear in Settings → Input Modes, as a dedicated section below Head Tracking (same pattern).

### Basic Mode UI

```
┌──────────────────────────────────────────────┐
│ Gesture Recognition                           │
│                                               │
│ [Enable Gestures]                    [ON/OFF] │
│                                               │
│ Mode: [Basic ✓] [Advanced]                    │
│                                               │
│ [🎯 Calibrate Neutral Face]                   │
│ Hold still 3 seconds to set baseline          │
│                                               │
│ Assign gestures to actions:                   │
│ ┌──────────────────┬─────────────────┐        │
│ │ Intentional Blink│ [Speak message ▾]│        │
│ │ Mouth Open       │ [Say "Yes"     ▾]│        │
│ │ Smile            │ [not assigned  ▾]│        │
│ │ Pucker / "Oo"    │ [Say "No"      ▾]│        │
│ │ Head Nod         │ [Say "Yes"     ▾]│        │
│ │ Head Shake       │ [Say "No"      ▾]│        │
│ │ Eyebrow Raise    │ [Open AI Chat  ▾]│        │
│ └──────────────────┴─────────────────┘        │
│                                               │
│ Confidence: ████████░░ 60%                    │
│ Cooldown:   ██████░░░░ 1000ms                 │
│ Dwell time: ████░░░░░░ 300ms                  │
│                                               │
│ [Reset gestures to defaults]                  │
└──────────────────────────────────────────────┘
```

### Advanced Mode UI (additional)

```
┌──────────────────────────────────────────────┐
│ Advanced Training                             │
│ Custom gestures use DTW matching + 8B model   │
│                                               │
│ 0 custom gesture(s) trained.                  │
│                                               │
│ [+ Record Custom Gesture]                     │
│                                               │
│ Fusion weights (auto-tuned):                  │
│   Head: 30%  Blink: 25%  Mouth: 25%  Brow: 20%│
└──────────────────────────────────────────────┘
```

---

## Performance

### FaceLandmarker Model

| Property | Value |
|----------|-------|
| Model | `face_landmarker` (float16) |
| Size | ~4.2MB (downloaded once, cached by Service Worker) |
| WASM runtime | Shared with existing FaceDetector |
| GPU delegate | Yes (WebGL) |
| Outputs | 478 landmarks + 52 blendshapes + transformation matrix |

### FPS Targets

| Configuration | iPad Pro (M1+) | iPad Air/mini | Older iPads |
|---------------|---------------|---------------|-------------|
| FaceLandmarker only | 25-30fps | 18-25fps | 12-18fps |
| FaceLandmarker + blendshapes | 20-25fps | 15-20fps | 10-15fps |
| + existing FaceDetector (cursor) | 15-20fps | 10-15fps | 8-12fps |

**Strategy**: FaceLandmarker runs alongside FaceDetector on the same camera feed, at 15fps target. Gesture processing adds <5ms per frame.

### Memory

| Component | Size |
|-----------|------|
| FaceLandmarker model loaded | ~15-20MB |
| Gesture templates (10 gestures, 10 examples each) | ~100-200KB |
| Blendshape history buffer (2 seconds) | ~50KB |
| Total additional for gesture system | ~15-20MB on top of existing head tracking |

### Battery

- Continuous camera + FaceLandmarker inference: ~20-30% battery drain per hour
- Mitigation: Reduce to 10fps when idle (no gesture detected for 5+ seconds)

---

## Data Storage

All gesture data persists in the existing `prism-aac-settings` localStorage key (zustand persist, version 12+):

```typescript
gestureConfig: {
  enabled: boolean;              // master toggle
  mode: 'basic' | 'advanced';   // operating mode
  mappings: GestureMapping[];    // gesture → action assignments
  confidenceThreshold: number;   // 0.3 - 0.95
  cooldownMs: number;            // 500 - 3000
  dwellMs: number;               // 200 - 1000
  baseline: GestureBaseline;     // captured neutral face
  templates: GestureTemplate[];  // advanced mode DTW templates
  fusionWeights: { head, blink, mouth, brow };
}
```

---

## Files

| File | Purpose |
|------|---------|
| `services/gestureService.ts` | Core detection engine (Basic + Advanced modes, DTW, fusion) |
| `services/headTracker.ts` | Camera feed + FaceLandmarker initialization + onLandmarks callback |
| `store/settingsStore.ts` | Gesture config persistence (version 12 migration) |
| `components/InputModesSettings.tsx` | Settings UI (GestureRecognitionSettings component) |
| `i18n/en.json` | i18n keys for gesture UI labels |
| `docs/GESTURE_RECOGNITION.md` | This document |

---

## Future Work

- **Gesture recorder UI**: Full recording flow in Advanced mode (camera preview, "perform 3 times", save)
- **8B model integration**: Wire Ollama inference for viseme classification and complex sequence analysis
- **Compound gestures**: Detect multi-step gestures (e.g., "nod then smile" as a single action)
- **Body gesture fusion**: Integrate arm/hand landmarks from existing bodyPoseService.ts
- **Real-world testing**: Validate with actual AAC users (children with CP, ASD, motor impairments)
- **Eye gaze direction**: Use eyeLookIn/Out/Up/Down blendshapes for gaze-based selection

</details>
