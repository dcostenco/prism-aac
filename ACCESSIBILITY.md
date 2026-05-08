# PrismAAC Accessibility — Camera-Based Input System

> **TL;DR** — every body movement a child can make becomes a way to communicate. Head pose, eyes, mouth, shoulders, elbows, wrists, fingers, hips — any combination, on any device with a camera. No $3,000–$15,000 eye tracker required.

## At a glance

- ✅ **15+ tracked body parts** (head, eyes, mouth, shoulders, elbows, wrists, fingers, hips) — choose any combination
- ✅ **Velocity-adaptive smoothing** — small + slow vs fast + large movements both read accurately
- ✅ **Dwell-click** with configurable time (200–5000 ms) and progress-ring feedback
- ✅ **Drift safety stack** — auto-disable + recalibration prompt if tracking diverges from intent
- ✅ Runs **fully on-device** — no video leaves the device

<details>
<summary><strong>📐 Full architecture, body-part landmark map, calibration + drift internals</strong></summary>

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

## Voice-as-Cursor — Sound-Driven Input (No Text Generation)

### The Innovation

Some children cannot move ANY body part reliably — but they CAN make sounds. A hum, a vowel, a pitch change. This mode uses the microphone NOT to generate text, but to **analyze sound properties and map them to cursor movement**.

```
Microphone (continuous)
  → Audio Analysis (Web Audio API — no text generation)
    → Extract: pitch, volume, duration, direction (stereo)
      → Map to cursor movement:
          - Pitch UP = cursor moves UP
          - Pitch DOWN = cursor moves DOWN
          - Volume LEFT ear > RIGHT ear = cursor LEFT (stereo)
          - Volume increase = cursor moves faster
          - Sustained sound = dwell (select)
          - Silence = cursor stops
```

### Sound → Direction Mapping

| Sound Property | Cursor Action | Detection Method |
|---|---|---|
| **Pitch rising** | Cursor moves UP | `AnalyserNode` frequency tracking |
| **Pitch falling** | Cursor moves DOWN | `AnalyserNode` frequency tracking |
| **Volume increase** | Cursor moves RIGHT | `AnalyserNode` amplitude |
| **Volume decrease** | Cursor moves LEFT | `AnalyserNode` amplitude |
| **Sustained "aaa"** | Dwell / Select | Duration > dwellMs |
| **Short burst "eh"** | Click | Amplitude spike detection |
| **Silence** | Cursor stops | Below noise threshold |
| **Pitch + Volume** | Diagonal movement | Combined vector |

### Background Noise Adaptation

The system continuously analyzes ambient sound to:

1. **Establish noise floor** — first 3 seconds of silence = baseline
2. **Filter background** — subtract noise floor from all measurements
3. **Adapt to environment** — hospital room noise differs from home
4. **Ignore non-intentional sounds** — coughs, other people talking, TV
5. **Learn the child's vocal signature** — over sessions, distinguish the child's voice from others using pitch/timbre fingerprint

### Why This Mode Exists

```
Child with:
  ✗ Cannot move eyes (cortical visual impairment)
  ✗ Cannot move head (cervical fusion)
  ✗ Cannot move hands (quadriplegia)
  ✗ Cannot move any limb
  ✓ CAN make sounds ("aaa", "eee", pitch changes)

→ Voice-as-cursor gives this child full AAC access
```

### Technical Implementation

```typescript
// Web Audio API — runs entirely in browser, no cloud
const audioCtx = new AudioContext();
const analyser = audioCtx.createAnalyser();
const microphone = await navigator.mediaDevices.getUserMedia({ audio: true });
const source = audioCtx.createMediaStreamSource(microphone);
source.connect(analyser);

// Extract pitch using autocorrelation
function detectPitch(buffer: Float32Array): number { /* ... */ }

// Extract volume (RMS amplitude)
function detectVolume(buffer: Float32Array): number { /* ... */ }

// Map to cursor: pitch = Y axis, volume = X axis
const cursorY = mapPitchToScreen(currentPitch, baselinePitch, screenHeight);
const cursorX = mapVolumeToScreen(currentVolume, baselineVolume, screenWidth);
```

### Safety Considerations

- **Vocal strain**: Children should not be required to produce sounds for extended periods. Auto-rest after 5 minutes of continuous vocal input. Alert caregiver.
- **Privacy**: Audio is analyzed locally using Web Audio API. No audio is recorded, stored, or transmitted. Only numeric values (pitch, volume) are processed.
- **Noise sensitivity**: Children with auditory processing disorders may be distressed by hearing their own voice amplified. PIP audio feedback should be optional.
- **Combined input**: Voice cursor can work alongside head tracking — head for coarse movement, voice for fine control or click trigger.

---

## Clinical Evidence (from Peer-Reviewed Research)

### Safety — Do No Harm

| Risk | Evidence | Mitigation in PrismAAC |
|---|---|---|
| **Seizure from screen** | WCAG: max 3 flashes/sec. Photosensitive epilepsy affects 1 in 4,000 (Epilepsy Action UK) | Static dwell indicator, no rapid color cycling, `prefers-reduced-motion` support |
| **Eye strain** | Digital eye strain after 20+ min sustained focus (American Optometric Association) | 20-20-20 rule reminder, session time tracking, fatigue detection |
| **Neck strain** | Trapezius fatigue from repetitive head movements (PMC/2874766). NeckCheck study (arXiv:2503.12762) measured predictable fatigue onset | Velocity-adaptive smoothing, auto-rest breaks, fatigue detection with caregiver alert |
| **Vocal strain** | Sustained phonation causes vocal fatigue | 5-min auto-rest for voice cursor mode |
| **AT abandonment** | 29.3% of AT devices completely abandoned (Phillips & Zhao 1993, PubMed/10171664). Top reasons: device mismatch, user not involved in selection | Auto-Train adapts to child, no manual calibration, progressive learning |

### Optimal Parameters (Evidence-Based)

| Parameter | Evidence | PrismAAC Default |
|---|---|---|
| **Dwell time (beginner)** | 800-1000ms starting point (Borgestig et al. 2016, PMC/4867850) | 1200ms |
| **Dwell time (experienced)** | 300ms achievable (Walker & Wegner 2021, ATIA CVI study) | Auto-reduces with accuracy |
| **Session length (age <5)** | 5-15 min tolerance (clinical consensus) | Auto-detected via fatigue |
| **Session length (school-age)** | 20-30 min with breaks (Borgestig longitudinal study) | Fatigue-triggered breaks |
| **Accuracy threshold** | MediaPipe pose: 94.33% gesture accuracy (LuxAI/IIUM ASD study) | Target: >85% dwell success |
| **Abandonment reduction** | User involvement in selection reduces abandonment (NIHR Evidence UK) | Auto-detect body part (child-driven, not therapist-chosen) |

### Body Part Selection by Diagnosis

| Diagnosis | Recommended Input | Evidence |
|---|---|---|
| **ALS / MND** | Eye gaze | Standard of care (ASHA Practice Portal) |
| **Rett syndrome** | Eye gaze | Only reliable voluntary movement in late stages |
| **Cerebral palsy (spastic quad)** | Head tracking or eye gaze | Depends on head control (Vanderbilt AAC Protocol) |
| **Cerebral palsy (athetoid)** | Eye gaze or voice cursor | Involuntary movements make head/hand unreliable |
| **Spinal muscular atrophy** | Eye gaze, voice cursor | Progressive weakness, adapt as condition changes |
| **Traumatic brain injury** | Head tracking → eye gaze | Start with head if control exists, fall back to eyes |
| **Locked-in syndrome** | Eye gaze or voice cursor | Only eyes/voice remain |
| **Autism (motor planning)** | Head tracking or hand | Motor capabilities often intact, difficulty with planning |

### Existing Products Comparison

| Device | Price | Input Type | Accuracy | Setup | Limitations |
|---|---|---|---|---|---|
| **Tobii I-Series** | $15,000+ | Eye gaze | Sub-degree | 30+ min | Insurance-funded, Windows, needs calibration |
| **Tobii PCEye** | $2,500-3,000 | Eye gaze | Sub-degree | 15 min | Windows only, monitor-mounted |
| **HeadMouse Nano** | $995 | IR head | High | 10 min | Requires reflective dot on forehead |
| **TrackerPro 2** | $1,550 | IR head | High | 10 min | Wireless, slight latency |
| **Camera Mouse** | Free | Webcam head | Medium | 5 min | Lower precision, lighting dependent |
| **eViacam** | Free | Webcam head | Medium | 5 min | Open source, basic |
| **PrismAAC** | **Free** | **Camera (any body part) + voice** | **Adaptive** | **10 sec auto-detect** | **No hardware, learns over time** |

### Regulatory & Privacy

| Requirement | Standard | PrismAAC Compliance |
|---|---|---|
| **HIPAA (camera in healthcare)** | Encryption, RBAC, audit trails for PHI | Camera processed locally, no frames stored/transmitted |
| **FDA classification** | AAC = Class I/II communication device | No diagnostic claims, communication aid only |
| **Consent (minors)** | Parental/guardian consent required | Camera permission prompt + Settings toggle |
| **FERPA (schools)** | Student data privacy | No student data leaves the device |
| **State wiretap laws** | Consent for recording | No audio/video recording — only numeric analysis |

### Clinical Introduction Protocol (Best Practice)

Based on ASHA Practice Portal and Vanderbilt AAC Diagnostics:

```
Week 1: Assessment
  1. SLP evaluates gross/fine motor across all body sites
  2. Trial PrismAAC with auto-detect (10s calibration)
  3. Document which body part auto-detect selects
  4. Compare with SLP's clinical judgment
  5. Start with 5-min motivating activities (games, preferred content)

Week 2-3: Tolerance Building
  1. Increase session length by 5 min per day
  2. Monitor fatigue cues (accuracy drop, gaze aversion, head droop)
  3. Let Auto-Train learn the child's movement profile
  4. Review session metrics with caregiver

Week 4+: Functional Communication
  1. Transition from games to communication activities
  2. Auto-Train has calibrated parameters by now
  3. SLP reviews movement profile and adjusts if needed
  4. Begin IEP documentation using session metrics
  5. Train classroom staff on the system
```

---

## Morse Code Input — One Sound, Full Communication

### The Problem

Some children have **no reliable body movement at all** — no eye control, no head movement, no hand control. But they CAN produce **one sound**. A grunt, a hum, a click, a breath. Traditional AAC has no solution for these children.

### The Solution

Map **one sound** to Morse code:

```
Short sound (< 300ms)  =  ·  (dot)
Long sound (> 300ms)   =  −  (dash)
Short silence (< 600ms) =  next dot/dash (same letter)
Medium silence (600-1500ms) =  letter complete
Long silence (> 1500ms) =  word complete (space)
```

### How It Works

```
Child makes sounds:     "eh"  "ehhh"  [pause]  "eh"  [long pause]
System hears:            ·      −      [sep]     ·     [space]
Morse decodes:           A (·−)                  E (·)
Output:                  "A E"
Prediction kicks in:     "A E" → suggests "ARE" "AT" "AND"
```

### Full Morse Alphabet

| Letter | Code | Letter | Code | Number | Code |
|:---:|:---:|:---:|:---:|:---:|:---:|
| A | ·− | N | −· | 1 | ·−−−− |
| B | −··· | O | −−− | 2 | ··−−− |
| C | −·−· | P | ·−−· | 3 | ···−− |
| D | −·· | Q | −−·− | 4 | ····− |
| E | · | R | ·−· | 5 | ····· |
| F | ··−· | S | ··· | 6 | −···· |
| G | −−· | T | − | 7 | −−··· |
| H | ···· | U | ··− | 8 | −−−·· |
| I | ·· | V | ···− | 9 | −−−−· |
| J | ·−−− | W | ·−− | 0 | −−−−− |
| K | −·− | X | −··− | | |
| L | ·−·· | Y | −·−− | | |
| M | −− | Z | −−·· | | |

### Special Commands

| Code | Action |
|---|---|
| ····· (5 dots) | SPEAK — read message aloud |
| −−−−− (5 dashes) | DELETE — remove last word |
| ·−·−·− (·−·−·−) | CLEAR — clear all text |
| ··−−·· | HELP — trigger emergency alert |

### Adaptive Timing

The system learns each child's natural timing:

```
Session 1: Use default thresholds (300ms dot/dash boundary)
Session 2+: Measure child's actual durations:
  - Average short sound: 180ms → dot threshold adjusts to 250ms
  - Average long sound: 500ms → dash threshold adjusts to 350ms
  - Natural pause between dots: 400ms → separator adjusts to 500ms
```

### Prediction Integration

Morse is slow (~5 words/min for experts). PrismAAC's prediction engine dramatically speeds this up:

```
Child types: ···  (S)
Prediction shows: "Stop" "School" "Snack" "Sorry" "Sit"
Child selects prediction with one more sound burst → full word entered

Child types: ·−  (A)
After context "I want": Prediction shows "Apple" "Another" "A break"
```

Combined: Morse for first 1-2 letters + prediction = 15-20 words/min.

### Sound Types Supported

The system recognizes ANY consistent sound as input:

| Sound Type | Detection | Use Case |
|---|---|---|
| **Voice ("aaa", "eee")** | Amplitude above threshold | Most common |
| **Tongue click** | Sharp transient spike | Children with breath control only |
| **Breath (puff)** | Low-frequency amplitude | Children with no voice |
| **Humming** | Sustained pitch detection | Children with vocal control |
| **Any consistent sound** | Learned from 10 training samples | Auto-adapts to the child |

### Why This Matters

```
Child capabilities:
  ✗ Cannot move eyes
  ✗ Cannot move head
  ✗ Cannot move any body part
  ✗ Cannot produce speech
  ✓ CAN make ONE sound (any sound, any body part)

Morse + Prediction = full communication access

No other AAC product offers this.
```

### Technical Implementation

```typescript
// Web Audio API — real-time sound analysis
const audioCtx = new AudioContext();
const analyser = audioCtx.createAnalyser();

// Detect sound vs silence
function isSounding(buffer: Float32Array, noiseFloor: number): boolean {
  const rms = Math.sqrt(buffer.reduce((s, v) => s + v * v, 0) / buffer.length);
  return rms > noiseFloor * 1.5;
}

// Classify dot vs dash
function classifySymbol(durationMs: number, dotThreshold: number): '.' | '-' {
  return durationMs < dotThreshold ? '.' : '-';
}

// Decode Morse to character
const MORSE_TABLE: Record<string, string> = {
  '.-': 'A', '-...': 'B', '-.-.': 'C', /* ... full table ... */
};
function decodeMorse(symbols: string): string | null {
  return MORSE_TABLE[symbols] ?? null;
}
```

### Safety

- **No vocal strain**: System works with ANY sound, not just voice. Breath puffs, tongue clicks — whatever doesn't tire the child.
- **Auto-rest**: If continuous sound input > 5 minutes, suggest break.
- **Volume independent**: Works with whispers. Sound classification uses relative amplitude, not absolute volume.
- **Privacy**: Audio analyzed locally. No recording. Only timing data (dot/dash durations) stored.

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
| Voice-as-cursor (pitch/volume) | 🔜 Planned | Free |
| Background noise adaptation | 🔜 Planned | Free |
| Body pose (33 landmarks) | 🔜 Planned | Free |
| Hand/finger/arm/elbow tracking | 🔜 Planned | Free |
| Auto-detect best body part | 🔜 Planned | Free |
| Auto-Train adaptive learning | 🔜 Planned | Free |
| Fatigue detection + auto-adjust | 🔜 Planned | Free |
| Intent prediction (AI cursor) | 🔜 Planned | Standard+ |
| Custom gestures (teach/assign) | 🔜 Planned | Standard+ |
| Blink-to-click | 🔜 Planned | Free |
| Per-child movement profiles | 🔜 Planned | Free |
| Session metrics for BCBA/IEP | 🔜 Planned | Free |

</details>
