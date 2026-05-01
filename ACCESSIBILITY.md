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

## Auto-Train — Adaptive Learning Engine

### The Problem

Every child with motor impairment is different. A BCBA or SLP spends hours calibrating traditional eye trackers (Tobii, Grid 3) — adjusting sensitivity, dead zones, dwell timing, filtering. If the child has a bad day (fatigue, seizure, medication change), the calibration is wrong and must be redone.

### The Solution: Continuous Adaptive Learning

PrismAAC's camera input system **learns from every interaction** and continuously adapts to the child — no manual recalibration needed.

```
Session Start
  → Load child's movement profile from localStorage
    → Begin tracking with saved parameters
      → Every successful dwell click:
          - Record: which body part, movement amplitude, time to target,
            overshoot distance, dwell stability (jitter during dwell)
          - Update movement model:
              • Shrink dead zone if child is precise
              • Expand dead zone if child overshoots
              • Adjust smoothing per body part
              • Adjust sensitivity per direction (some children
                move better left-right than up-down)
      → Every 5 minutes:
          - Recalculate fatigue score (are movements getting smaller?)
          - If fatigue detected: increase sensitivity, reduce dwell time
          - If precision improving: decrease sensitivity, increase dwell time
      → Session End:
          - Save updated movement profile
          - Log session metrics for caregiver review
```

### Movement Profile (per child)

Stored in localStorage, keyed by child name/ID:

```typescript
interface MovementProfile {
  id: string;                    // child identifier
  name: string;                  // display name
  createdAt: number;             // first session timestamp
  totalSessions: number;         // lifetime session count
  totalDwellClicks: number;      // lifetime successful clicks

  // Per-body-part parameters (learned)
  bodyParts: Record<string, BodyPartProfile>;

  // Global parameters (auto-adjusted)
  baseSensitivity: number;       // learned optimal sensitivity
  baseDwellMs: number;           // learned optimal dwell time
  baseSmoothing: number;         // learned optimal smoothing
  fatigueThreshold: number;      // when to boost sensitivity

  // Directional bias (some children move better in certain directions)
  directionBias: {
    leftRight: number;           // 0-2, multiplier for X movement
    upDown: number;              // 0-2, multiplier for Y movement
  };

  // Time-of-day patterns (optional)
  morningProfile?: Partial<MovementProfile>;  // different settings AM vs PM
  afternoonProfile?: Partial<MovementProfile>;
}

interface BodyPartProfile {
  landmark: number;              // MediaPipe landmark ID
  name: string;                  // "right_elbow", "head", etc.
  enabled: boolean;              // is this body part used for input?
  movementVariance: number;      // how much this part moves (learned)
  accuracy: number;              // 0-1, how precise this part is (learned)
  optimalSensitivity: number;    // learned sensitivity for this part
  optimalSmoothing: number;      // learned smoothing for this part
  deadZone: number;              // minimum movement to register (learned)
  maxSpeed: number;              // fastest movement observed (learned)
  averageSpeed: number;          // typical movement speed (learned)
  fatigueRate: number;           // how fast this part tires (learned)
}
```

### Learning Algorithm

#### Phase 1: Discovery (first 3 sessions)

During the first 3 sessions, the system is in **discovery mode**:

1. Track all visible body landmarks
2. Calculate movement variance per landmark over 30-second windows
3. Rank landmarks by: `variance × consistency × range_of_motion`
4. Select top 1-2 landmarks as primary input
5. Present to caregiver: "We detected that [name] moves their [right elbow] most reliably. Using that as their primary input. Is this correct?"
6. Caregiver confirms or selects different body part

#### Phase 2: Calibration (sessions 4-10)

System actively tunes parameters:

```
For each successful dwell click:
  1. Measure time_to_target (how long from start to reaching the button)
  2. Measure overshoot (did cursor go past the target and come back?)
  3. Measure dwell_stability (how much cursor jiggles during dwell wait)

  Adjustments:
  - If overshoot > 20%: increase smoothing by 0.01
  - If overshoot < 5%: decrease smoothing by 0.005 (more responsive)
  - If time_to_target > 5s: increase sensitivity by 0.5
  - If time_to_target < 1s: decrease sensitivity by 0.3 (avoid accidents)
  - If dwell_stability < 3px: decrease dwell time by 50ms (child is precise)
  - If dwell_stability > 15px: increase dwell time by 100ms (need more time)
```

#### Phase 3: Continuous (sessions 11+)

System maintains learned parameters and adapts to real-time conditions:

```
Every 5 minutes during active use:
  1. Calculate rolling_accuracy = successful_clicks / (successful + abandoned)
  2. Calculate rolling_speed = average(time_to_target) over last 10 clicks
  3. Calculate fatigue_score = speed_increase_rate + accuracy_decrease_rate

  If fatigue_score > threshold:
    → Increase sensitivity by 10%
    → Decrease dwell time by 15%
    → Log: "Fatigue detected at [time]. Auto-adjusted parameters."
    → Optionally notify caregiver: "Child may be getting tired"

  If rolling_accuracy > 0.9 for 10+ minutes:
    → Gradually reduce sensitivity (challenge the child to improve)
    → This follows ABA shaping principles (Skinner 1953)

  If rolling_accuracy < 0.5 for 5+ minutes:
    → Increase sensitivity significantly
    → Increase target sizes if possible (enlarge buttons)
    → Log: "Accuracy dropped. Check child's positioning/comfort."
```

### Fatigue Detection

Motor-impaired children fatigue quickly. The system detects fatigue through:

| Signal | Detection Method | Response |
|---|---|---|
| **Decreasing movement amplitude** | Rolling average of landmark displacement shrinks | Increase sensitivity |
| **Increasing time to target** | Last 10 clicks take longer than session average | Reduce dwell time |
| **Increasing overshoot** | Cursor passes targets more often | Increase smoothing |
| **Decreasing accuracy** | More abandoned dwell attempts | Enlarge targets |
| **Increasing jitter** | Dwell stability worsens | Increase dead zone |
| **Head droop** | Head landmark Y increases over time | Alert caregiver |

### Intent Prediction (AI-Powered — Planned)

After learning the child's patterns over 50+ sessions:

```
Current cursor trajectory + velocity + recent click history
  → Predict which button the child is targeting
    → Pre-highlight the predicted target (visual cue)
    → Reduce dwell time for predicted target (faster selection)
    → If confidence > 90%: "snap" cursor to target (magnetic effect)
```

This is like predictive text but for cursor movement. The AI learns that:
- After clicking "I", the child usually clicks "want" next
- After clicking "bathroom", the child usually clicks "please"
- At 3pm, the child usually opens "Snack" category

### Session Metrics (for Caregiver/BCBA)

Each session logs (stored locally, never transmitted):

```typescript
interface SessionMetrics {
  date: string;
  duration: number;              // seconds
  totalClicks: number;
  successfulClicks: number;
  abandonedDwells: number;       // started dwell but moved away
  averageTimeToTarget: number;   // ms
  averageOvershoot: number;      // pixels
  averageDwellStability: number; // pixels of jitter
  fatigueEvents: number;         // times fatigue was detected
  bodyPartsUsed: string[];       // which landmarks were active
  parameterChanges: Array<{      // auto-adjustment log
    time: number;
    parameter: string;
    oldValue: number;
    newValue: number;
    reason: string;
  }>;
}
```

Caregivers can review these metrics in Settings to:
- Track the child's progress over weeks/months
- Identify optimal session length before fatigue
- Document motor skill development (required for IEP/BCBA reports)
- Compare morning vs afternoon performance

### Why This Matters

**Traditional approach (Tobii):**
- Buy $15,000 eye tracker
- SLP spends 2 hours calibrating
- Child has bad day → recalibrate
- Child improves → recalibrate
- Different seating position → recalibrate
- Hardware breaks → buy another $15,000

**PrismAAC approach:**
- Open app on any device with camera
- System auto-detects child's best body movement
- System auto-calibrates in 3 sessions
- System continuously adapts to fatigue, improvement, positioning
- System learns optimal parameters over time
- Free. No hardware. No recalibration. No SLP time wasted.

**The insight:** An AI that watches a child move for a week knows more about that child's motor capabilities than a therapist who calibrates a device for 2 hours. Not because the AI is smarter — but because it observes continuously, learns incrementally, and adapts in real-time.

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
