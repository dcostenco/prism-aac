# PrismAAC Accessibility — Camera-Based Input System

## Mission

**Every body movement a child can make becomes a way to communicate.**

A child who cannot touch a screen, hold a switch, or use specialized hardware ($3,000–$15,000 eye trackers) should still be able to communicate using the camera built into any iPad, iPhone, laptop, or Android device — **for free**.

---

## Architecture

### Input Pipeline

```
Camera (getUserMedia)
  → Video Frame (15fps)
    → Body Landmark Detection (MediaPipe Pose — 33 points)
      → Movement Vector Extraction
        → Velocity-Adaptive Smoothing
          → Screen Cursor Position
            → Dwell Detection → Click
```

### Supported Body Parts (any combination)

| Body Part | Landmark IDs | Use Case |
|---|---|---|
| **Head position** | 0 (nose) | Most common — works for most children |
| **Eyes** | 1-6 (eye corners) | Children who can only move eyes |
| **Mouth** | 9-10 (mouth corners) | Open/close as click trigger |
| **Left shoulder** | 11 | Children with upper body control |
| **Right shoulder** | 12 | Children with upper body control |
| **Left elbow** | 13 | Children who can bend arm |
| **Right elbow** | 14 | Children who can bend arm |
| **Left wrist** | 15 | Children with hand control |
| **Right wrist** | 16 | Children with hand control |
| **Left index finger** | 19 | Fine motor pointing |
| **Right index finger** | 20 | Fine motor pointing |
| **Left hip** | 23 | Children in wheelchairs |
| **Right hip** | 24 | Children in wheelchairs |
| **Left knee** | 25 | Leg movement input |
| **Right knee** | 26 | Leg movement input |

### Auto-Detection Mode

On first use, the system observes which body parts the child moves most during a 10-second calibration:

1. Show an engaging animation (bouncing ball, moving character)
2. Track all 33 landmarks for 10 seconds
3. Calculate movement variance per landmark
4. Select the 1-2 landmarks with highest variance → primary input
5. Save as child's profile

### Movement → Direction Mapping

```
Landmark position change (Δx, Δy per frame)
  → Normalize to screen coordinates
    → Apply sensitivity scaling (configurable 1-10)
      → Apply velocity-adaptive smoothing:
          - Velocity < 5px:  smoothing = 0.03 (rock stable at rest)
          - Velocity 5-50px: smoothing = interpolated (proportional)
          - Velocity > 50px: smoothing = 0.20 (responsive to intent)
      → Screen-size factor:
          - Small (<768px):  × 0.5 (more smoothing, higher precision)
          - Medium (<1200px): × 0.7
          - Large (1200px+):  × 1.0 (faster, less smoothing)
        → Final cursor position
```

### Dwell Click

When the cursor rests on an interactive element for a configurable duration:

1. **Visual feedback**: Progress ring fills around cursor (SVG circle)
2. **Threshold reached**: Element receives a synthetic click
3. **Audio feedback**: Haptic/sound confirms the click
4. **Reset**: Dwell timer resets, cursor can move to next target

Default dwell time: 1200ms (configurable 500ms–3000ms in Settings)

### Gesture Recognition (Planned — Paid Tier)

| Gesture | Detection Method | Default Action |
|---|---|---|
| Head nod (up-down) | Y oscillation on landmark 0 | "Yes" / Confirm |
| Head shake (left-right) | X oscillation on landmark 0 | "No" / Cancel |
| Mouth open | Distance between landmarks 9-10 | Speak / Click |
| Blink (both eyes) | Eye aspect ratio drop | Click |
| Raise hand | Wrist Y < shoulder Y | "I want" / Attention |
| Wave | Wrist X oscillation | "Hello" / "Goodbye" |

Gestures are:
- **Teachable**: Caregiver records 3 samples → named → ready
- **Assignable**: Map any gesture to any button/feature
- **Per-child**: Saved in the child's profile

---

## Technical Requirements

### Browser APIs Used

| API | Purpose | Fallback |
|---|---|---|
| `getUserMedia` | Camera access | Prompt user to enable |
| `FaceDetector` | Face detection (Chrome 87+, Safari 17+) | Canvas skin-color detection |
| MediaPipe Pose | Full body landmarks (planned) | Face-only tracking |
| `requestAnimationFrame` | Frame processing loop | `setInterval` |
| `document.elementFromPoint` | Hit testing for dwell | Manual coordinate check |

### Performance Targets

| Metric | Target | Rationale |
|---|---|---|
| Frame rate | 15fps | Smooth enough for cursor, low CPU |
| Latency (frame → cursor) | <30ms | Must feel responsive |
| CPU usage | <15% | Cannot overheat child's iPad |
| Memory | <50MB | Camera + canvas + landmarks |
| Battery impact | <10% per hour | Must last a school day |

### Privacy

- **Camera never leaves the device.** All processing runs in the browser.
- **No frames are transmitted.** No cloud API, no analytics, no logging.
- **No face data stored.** Only calibration offsets are saved (not images).
- **Camera indicator visible.** PIP preview shows the child what the camera sees.
- **Parent/caregiver controls.** Head tracking can only be enabled in Settings.

---

## Settings (configurable per child)

| Setting | Range | Default | Description |
|---|---|---|---|
| Enabled | on/off | off | Master toggle |
| Primary body part | auto/head/eye/hand/arm | auto | Which landmark controls cursor |
| Dwell time | 500–3000ms | 1200ms | How long to hover before click |
| Sensitivity | 1–10 | 5 | How much head movement = screen movement |
| Smoothing | 0.01–0.3 | 0.15 | Higher = more stable, slower response |
| Cursor size | 20–60px | 36px | Visual size of cursor dot |
| Cursor color | any | green (#4CAF50) | Color of cursor dot |
| Cursor opacity | 0.3–1.0 | 0.9 | Transparency |
| Show PIP preview | on/off | on | Camera preview in corner |
| Click sound | on/off | on | Audio feedback on dwell click |

---

## Clinical References

- **Light & Drager (2007)**: Consistent motor plans improve AAC performance — dwell targets should not move during selection.
- **Koester & Simpson (2012)**: Motor-impaired users need ≥25mm targets — dwell targets should be at least 64px.
- **Higginbotham et al. (2007)**: Access methods should be matched to the individual's motor capabilities — auto-detection mode addresses this.
- **ASHA Practice Portal**: Communication access should never be restricted by cost or equipment availability — free tier commitment.

---

## Comparison with Competitors

| Feature | Prism AAC | TD Snap (Tobii) | Proloquo2Go | Grid 3 |
|---|---|---|---|---|
| **Hardware required** | Any camera | Tobii eye tracker ($3-15k) | iPad (iOS 17+) | Tobii/Windows |
| **Price** | **FREE** | $5,000–15,000 | $249.99 + iPad | $1,500+ |
| **Body parts tracked** | Head, eyes, hands, arms, any | Eyes only | Head only | Eyes only |
| **Works offline** | Yes | Yes | Yes | Yes |
| **Custom gestures** | Planned (paid) | Limited | No | Limited |
| **Platforms** | Web (any device) | Windows/iOS | iOS only | Windows only |
| **Setup time** | 10 seconds | 30+ minutes | 5 minutes | 30+ minutes |

---

## Implementation Status

| Feature | Status | Tier |
|---|---|---|
| Face/head tracking with FaceDetector | ✅ Shipped | Free |
| Dwell click with progress ring | ✅ Shipped | Free |
| Velocity-adaptive smoothing | ✅ Shipped | Free |
| Screen-size adaptive | ✅ Shipped | Free |
| Camera PIP preview | ✅ Shipped | Free |
| Calibration (4-corner) | ✅ Shipped | Free |
| Settings (dwell, sensitivity) | ✅ Shipped | Free |
| 📷 Toolbar button | ✅ Shipped | Free |
| 20 unit tests | ✅ Shipped | — |
| Body pose (33 landmarks) | 🔜 Planned | Free |
| Hand/finger tracking | 🔜 Planned | Free |
| Auto-detect best body part | 🔜 Planned | Free |
| Custom gestures (teach/assign) | 🔜 Planned | Standard+ |
| Blink-to-click | 🔜 Planned | Free |
| Per-child profiles | 🔜 Planned | Standard+ |
