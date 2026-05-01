# Precision Finger Tracking — Technical Documentation

## Overview

PrismAAC implements a military-grade precision touch system designed for children with motor impairments using AAC devices. The system eliminates cursor wiggle from finger tremor, car vibration, wheelchair movement, and the "fat finger" parallax problem.

**Enabled by default.** Can be disabled in Settings > Accessibility.

## How It Works

### Touch-and-Slide Keyboard

Unlike a standard keyboard where each tap immediately types a key, PrismAAC uses a **touch-and-slide** model:

1. **Touch down** — finger contacts the screen. The key under the finger is highlighted with a blue glow. A magnified preview bubble appears 80px above the finger showing the selected letter.
2. **Slide** — the child slides their finger to the correct key. The highlight and bubble follow smoothly. Small tremor movements are filtered out.
3. **Lift** — the child lifts their finger. After an 80ms debounce (to filter bounce-lifts from vibration), the highlighted key is typed.

This gives the child **full control** — they see exactly which key they're selecting before committing, and can correct mistakes before lifting.

## Stabilization Layers

The system uses 6 independent stabilization layers, each backed by clinical research:

### Layer 1: EMA Touch Smoothing

**Exponential Moving Average** filter on raw touch coordinates.

```
smoothed_x = smoothed_x + alpha * (raw_x - smoothed_x)
```

| Parameter | Value | Source |
|-----------|-------|--------|
| Alpha (stationary) | 0.35 | Trewin & Pain (1999) |
| Alpha (in vehicle) | 0.15-0.25 | Adaptive via DeviceMotion |
| Convergence | ~10 frames to 99% | Mathematical property of EMA |

**Effect:** A 3px finger tremor is reduced to ~1px perceived movement. The highlight stays rock-solid on one key even if the finger vibrates.

### Layer 2: Hysteresis Dead Zone

Once a key is highlighted, the smoothed touch point must exit the key's bounding rectangle by **10px** before the highlight switches to a new key.

| Parameter | Value | Source |
|-----------|-------|--------|
| Dead zone | 10px (~2.5mm) | Trewin & Pain (1999): typical tremor < 3mm |
| Direction | All sides (top/bottom/left/right) | Full perimeter protection |

**Effect:** At key boundaries, small back-and-forth movements don't cause the highlight to flicker between two keys. The child must make a clear, intentional movement to switch.

### Layer 3: Settle Time

After initial touch contact, **100ms** must elapse before the system starts tracking key changes.

| Parameter | Value | Source |
|-----------|-------|--------|
| Settle time | 100ms | iOS Touch Accommodations, Lancioni et al. (2014) |

**Effect:** When a tremoring finger first touches the screen, it often lands slightly off-target then settles. The 100ms window lets the finger find its resting position before tracking begins.

### Layer 4: Lift Delay

When the finger lifts from the screen, the key action is **delayed 80ms**.

| Parameter | Value | Source |
|-----------|-------|--------|
| Lift delay | 80ms | Clinical AAC practice |

**Effect:** In a moving car or wheelchair, bumps can cause the finger to briefly lift from the screen. Without the delay, this would type the key. With the delay, if the finger returns within 80ms, the lift is treated as a bounce and ignored.

**Smart cancellation (post-review fix):** The lift delay only cancels a pending keystroke if the re-touch lands on the **same key**. If a fast typist touches a different key within 80ms, the pending key commits normally — preventing valid keystrokes from being swallowed during rapid typing.

### Layer 5: Touch Y-Offset Correction

All touch coordinates are shifted **8px upward** from the raw contact point.

| Parameter | Value | Source |
|-----------|-------|--------|
| Y-offset | -8px | Holz & Baudisch (2011): "Understanding Touch" |

**Effect:** Users perceive their touch point as higher than the actual centroid of skin contact. For a child with small fingers, the 8px upward correction aligns the registered touch with where the child visually sees their finger pointing.

### Layer 6: Adaptive Motion Smoothing

The system monitors the device's accelerometer via `DeviceMotionEvent`. When it detects motion beyond normal gravity (car, wheelchair, bus), it automatically increases smoothing.

| Motion State | Accel Deviation | Alpha | Smoothing Level |
|-------------|----------------|-------|-----------------|
| Stationary | 0-2 g-units | 0.35 | Normal |
| Light motion (walking) | 2-5 g-units | 0.25-0.29 | Moderate |
| Car/wheelchair | 5-10 g-units | 0.15-0.25 | Heavy |
| Heavy vibration | >10 g-units | 0.15 | Maximum |

**Effect:** In a moving vehicle, the system automatically applies heavier smoothing so the highlight stays locked on the intended key despite whole-body vibration transmitted through the device.

## Comparison with Other AAC Keyboards

| Feature | PrismAAC | TouchChat | Proloquo2Go | TD Snap |
|---------|----------|-----------|-------------|---------|
| Touch-and-slide | Yes | No | No | No |
| Key magnification bubble | Yes (80px offset) | No | No | No |
| EMA tremor smoothing | Yes (alpha 0.35) | No | Basic | No |
| Hysteresis dead zone | Yes (10px) | No | No | No |
| Settle time | Yes (100ms) | No | No | iOS system |
| Lift delay (anti-bounce) | Yes (80ms) | No | No | No |
| Y-offset correction | Yes (-8px) | No | No | No |
| Motion-adaptive smoothing | Yes (accelerometer) | No | No | No |
| Works in moving car | Yes (auto-adapts) | Degraded | Degraded | Degraded |
| Enabled by default | Yes | N/A | N/A | N/A |
| Configurable per-user | Yes (Settings) | Limited | Limited | Limited |
| Free tier | Yes | No ($300) | No ($250) | No ($300) |

## Comparison with iOS System Accessibility

| Feature | PrismAAC Precision Touch | iOS Touch Accommodations |
|---------|-------------------------|--------------------------|
| Hold Duration | Settle time (100ms, app-level) | System-wide (affects all apps) |
| Tap Assistance | Lift-to-select with preview | Use Initial/Final Touch Location |
| Movement tolerance | Hysteresis (10px) + EMA smoothing | Static radius only |
| Motion compensation | Adaptive accelerometer-based | None |
| Visual feedback | Magnification bubble + highlight | None (system-level only) |
| Per-app tuning | Yes (each parameter adjustable) | One global setting |

**Key advantage:** PrismAAC's stabilization is app-specific and auto-adaptive. iOS Touch Accommodations apply system-wide (making the whole OS sluggish) and don't adapt to motion.

## Hand Profile Learning (IMPLEMENTED)

### Architecture

Uses the front-facing camera + **MediaPipe Hand Landmarks** (21 keypoints, WASM/WebGL, fully on-device) to:

1. **Scan the child's hand** — capture hand size, finger lengths (5), finger widths (5), palm width
2. **Detect handedness** — left vs right hand (thumb position relative to pinky)
3. **Learn approach angles** — how the child typically approaches the screen
4. **Auto-calibrate offsets** — replace static -8px Y-offset with per-hand learned values
5. **Profile tremor** — measure tremor frequency (Hz) and amplitude (px) via zero-crossing analysis
6. **Auto-tune parameters** — EMA alpha and dead zone auto-computed from tremor profile
7. **Continuous learning** — every 50 touches, the system refines offsets from actual usage

### Hand Profile Data Structure

```typescript
interface HandProfile {
  id: string;                 // "profile-1714560000000"
  name: string;               // "My Hand"
  handedness: 'left' | 'right' | 'unknown';
  fingerLengthsPx: number[];  // 5 fingers [thumb, index, middle, ring, pinky]
  fingerWidthsPx: number[];   // 5 fingers
  palmWidthPx: number;        // index MCP to pinky MCP
  yOffset: number;            // learned Y correction (clamped -20 to -4)
  xOffset: number;            // learned X correction (clamped -15 to 15)
  tremorFreqHz: number;       // dominant tremor frequency
  tremorAmplPx: number;       // RMS tremor amplitude
  emaAlpha: number;           // auto-tuned smoothing (0.15-0.35)
  deadZonePx: number;         // auto-tuned hysteresis (10-20)
  approachAngle: number;      // degrees from perpendicular
  touchSamples: number;       // total calibration touches
  created: string;
  lastCalibrated: string;
}
```

### Calibration Session Flow

| Phase | Duration | What Happens |
|-------|----------|-------------|
| 1. Init | ~3s | Camera starts, MediaPipe loads via CDN (WASM) |
| 2. Hand Scan | ~2s | 30 frames captured, hand geometry averaged across frames |
| 3. Touch Calibration | ~30s | 20 target circles appear, child taps each one. System measures intended vs actual touch position |
| 4. Tremor Measurement | 3s | Child holds finger still on screen. System records micro-movements and computes tremor frequency/amplitude |
| 5. Auto-Tune | instant | EMA alpha and dead zone computed from tremor profile |
| 6. Save | instant | Profile saved to localStorage, continuous learning enabled |

### MediaPipe Hand Landmarks (21 Keypoints)

```
Landmark Map:
 0 = Wrist
 1-4 = Thumb (CMC → MCP → IP → TIP)
 5-8 = Index (MCP → PIP → DIP → TIP)
 9-12 = Middle (MCP → PIP → DIP → TIP)
 13-16 = Ring (MCP → PIP → DIP → TIP)
 17-20 = Pinky (MCP → PIP → DIP → TIP)
```

Used to compute:
- **Finger lengths**: MCP → TIP distance per finger
- **Palm width**: Index MCP (5) → Pinky MCP (17)
- **Approach angle**: Angle of index finger (5 → 8) relative to vertical
- **Handedness**: Thumb TIP (4) left/right of Pinky TIP (20)
- **Y-offset**: `sin(angle) × fingerLength × 0.12` (clamped to [-20, -4])
- **X-offset**: `sin(angle) × fingerLength × 0.05` (mirrored for handedness)

### Auto-Tune Algorithm

| Tremor Level | Amplitude | EMA Alpha | Dead Zone |
|-------------|-----------|-----------|-----------|
| None/Mild | 0-2 px | 0.35 | 10 px |
| Moderate | 2-5 px | 0.25-0.32 | 13-18 px |
| Severe | 5+ px | 0.15 | 20 px |

### Continuous Learning (Auto-Train)

After calibration, the system continuously improves:

1. Every touch records: raw touch position + center of the key that was typed
2. Every 50 touches, the system computes the average offset error
3. New offsets are blended with existing: **80% existing + 20% new** (prevents over-correction)
4. Both X and Y offsets are clamped to safe ranges
5. Can be enabled/disabled via Settings toggle

### Therapist Modeling Protection (Outlier Rejection)

During AAC therapy, therapists and parents routinely model language by tapping the child's device (aided language stimulation). An adult's finger geometry, approach angle, and touch offsets differ drastically from a motor-impaired child's. Without protection, a 15-minute modeling session would corrupt the child's calibrated profile.

**Solution:** Every continuous-learning touch is checked against the child's established baseline. If the offset deviation exceeds 3x the child's tremor amplitude or 2x their dead zone, the touch is classified as an outlier (adult finger) and rejected:

```
deviation = sqrt((dx - profile.xOffset)² + (dy - profile.yOffset)²)
baseline  = max(5px, tremorAmplPx × 3, deadZonePx × 2)
if deviation > baseline → REJECT (adult modeling, skip learning)
```

This means:
- A child with 2px tremor and 10px dead zone has a baseline of 20px
- An adult tapping with a 30px offset deviation is automatically rejected
- The child's precision profile remains intact after any therapy session
- No manual "pause" required (though a pause toggle is also available in Settings)

### Camera Proximity Accommodation

When the finger approaches the screen, the camera's view becomes occluded (< 30cm). The system handles this by:

1. **Transition zone detection** — when camera loses hand landmarks, seamlessly transitions to touch-based tracking
2. **Predictive landing** — last camera frame before occlusion predicts where finger will contact
3. **Hybrid mode** — camera tracks approach for early key prediction, touch takes over at contact

### Prism-Coder Integration

The hand scan pipeline runs 100% on-device:
- **MediaPipe** → hand landmark detection (WASM/WebGL, browser)
- **Prism-Coder (7B, local via Ollama)** → can analyze tremor patterns, suggest optimal parameters, learn per-user profiles
- **Zero network calls** — works offline, no data ever leaves the device

## Technical Implementation

### Files

| File | Purpose |
|------|---------|
| `components/Keyboard.tsx` | Touch-and-slide with 6 stabilization layers + hand profile integration |
| `services/handProfileService.ts` | MediaPipe hand detection, tremor analysis, auto-tune, continuous learning |
| `components/HandCalibration.tsx` | Full calibration UI (scan → touch → tremor → save) |
| `store/settingsStore.ts` | `precisionTouchEnabled` setting (default: true) |
| `components/SettingsModal.tsx` | Toggle + hand profile section + calibration launch |
| `app/globals.css` | `.precision-bubble`, `.precision-highlight`, `.precision-touch-active` |
| `tests/military-stability.test.ts` | 162 tests including 72 precision touch + hand profile tests |

### CSS Classes

| Class | Purpose |
|-------|---------|
| `.precision-touch-active` | Container: `touch-action: none` prevents scroll |
| `.precision-bubble` | Fixed floating bubble: 56px min, 14px border-radius, accent-focus border |
| `.precision-highlight` | Active key: accent-focus background, scale(1.08), 16px glow |

### Data Attributes

| Attribute | Used By | Purpose |
|-----------|---------|---------|
| `data-key` | Letter/punctuation keys | Character to type |
| `data-action` | Special keys | Action to dispatch (space/backspace/shift/speak/mode) |
| `data-display` | All keys | Character shown in magnification bubble |

## Additional Input Modalities (IMPLEMENTED)

### Switch Scanning (WebHID / Gamepad / Keyboard)

For children with severe CP who can ONLY use physical Bluetooth switches (AbleNet, Enabling Devices). Many IEPs legally require switch scanning support.

**File:** `services/switchScanService.ts`

| Feature | Details |
|---------|---------|
| Auto-scan | Timer advances highlight every 1-5 seconds (configurable) |
| Manual scan | Switch press advances to next element |
| Group scan | Phase 1: scan rows, Phase 2: scan items within selected row |
| Input sources | Keyboard (Space/Enter/Tab), WebHID (generic switches), Gamepad API |
| Visual feedback | Orange pulsing outline (`switch-scan-active` class) |
| Element discovery | Auto-refreshes on DOM changes (panel switches, category navigation) |
| Fallback | If WebHID unavailable, keyboard-only mode still works |

### WASM TTS Fallback (Tier 4 Speech)

Emergency TTS engine that works even if the browser's Web Speech API crashes. Uses espeak-ng via WebAssembly (~1.5MB) with a beep-pattern fallback.

**File:** `services/wasmTTS.ts`

| Tier | Engine | Quality | Offline | Fallback For |
|------|--------|---------|---------|-------------|
| 1 | Azure Neural TTS | Best | No | — |
| 2 | Web Speech Premium | High | Yes | Azure fails |
| 3 | Web Speech Any | Basic | Yes | No premium voice |
| 4 | **WASM espeak-ng** | Low | **Yes** | Web Speech API crashed |
| 4b | **Beep patterns** | Minimal | **Yes** | WASM loading fails |

Beep pattern encoding: vowels = 440Hz (120ms), consonants = 660Hz (80ms), word gaps = 200ms silence, attention beep = 880Hz. A trained caregiver can distinguish communication attempts by audible shape.

### Remote Modeling (WebRTC Data Channels)

Enables caregivers/therapists to remotely model language on the child's device — aided language stimulation without being physically present.

**File:** `services/remoteModelingService.ts`

| Feature | Details |
|---------|---------|
| Connection | WebRTC data channel (sub-100ms latency) |
| Signaling | BroadcastChannel (same-network) with localStorage polling fallback |
| Room codes | 6-digit numeric codes |
| Commands | highlight, tap, speak, navigate, clear_highlight, ping |
| Visual | Green pulsing outline (`remote-model-highlight` class) |
| Privacy | Data channel only — no video/audio streams |
| Bandwidth | ~1KB/s (JSON commands only) |
| Keepalive | Ping every 5 seconds |

## Research References

1. Trewin, S., & Pain, H. (1999). "Keyboard and Mouse Errors due to Motor Disabilities." International Journal of Human-Computer Studies, 50(2), 109-144.
2. Holz, C., & Baudisch, P. (2011). "Understanding Touch." Proceedings of CHI '11, ACM.
3. Hourcade, J. P. (2008). "Interaction Design and Children." Foundations and Trends in HCI, 1(4).
4. Lancioni, G. E., et al. (2014). "Technology-aided programs for assisting communication and leisure engagement." Research in Developmental Disabilities.
5. Apple Human Interface Guidelines — Accessibility: Touch Accommodations.
