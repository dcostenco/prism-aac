# PrismAAC Self-Learning Safety Protocol

> **TL;DR** — the child's voice is sacred. The system learns to AMPLIFY their communication — never override, replace, or restrict it. Three rails: never reject the child's chosen output, never silently change their words, never down-rank a phrase the caregiver corrected toward.

## At a glance

- ✅ **Caregiver corrections become training signal** — without explicit labelling work
- ✅ **Hard guards** on emergency words (help / hurt / scared / 911 / bleeding / choking / fire / stuck / lost) — never down-rankable
- ✅ **Slow-roll learning** — needs ≥6 of last 10 events to flip dominant mood
- ✅ **Per-child profile**, never cross-pollinated between children
- ✅ AAC access is **never** restricted as a consequence — the child must always have their voice

<details>
<summary><strong>📐 Full safety contract — guards, sanity checks, escape hatches</strong></summary>

**Guiding principle: The child's voice is sacred. The system learns to AMPLIFY their communication — never to override, replace, or restrict it.**

This document explains every adaptive/learning system in PrismAAC, how it protects the child, and how it aligns with BCBA clinical best practices.

---

## 1. Word Prediction Learning

### How it works
- `learnWord()` records every word the child types or selects
- Builds frequency counts (`wordFreq`) and word-pair patterns (`bigrams`)
- Predictions improve as the child's vocabulary grows

### Do No Harm protections
| Protection | Implementation |
|-----------|---------------|
| Child's words are NEVER deleted by the system | Decay only reduces count, never drops below 1 |
| Typo cleanup waits 30 days | Hard-delete only for count=1 entries older than 30 days |
| Predictions NEVER auto-insert | Child must explicitly tap a prediction to use it |
| AI corrections require tap to accept | `messageStore.ts` — AI suggestions shown but not applied |
| Seed vocabulary preserved | Default phrases always merged under user counts |
| Language-specific | Seeds and predictions match the child's selected language |

### BCBA alignment
- **Manding (requesting)**: High-frequency mands rise to top predictions naturally
- **Vocabulary expansion**: New words appear in predictions after first use
- **Generalization**: Bigrams capture phrase patterns across contexts
- **Data-driven**: Frequency counts serve as discrete trial data for vocabulary goals

---

## 2. Adaptive Camera Calibration

### How it works
- Every frame, the calibration range expands toward the child's actual movement range
- Slowly decays toward center to handle posture changes, car movement, angle shifts
- No manual calibration needed — system adapts within 2-3 seconds

### Do No Harm protections
| Protection | Implementation |
|-----------|---------------|
| Cursor never jumps to wrong person | Identity locking via nose anchor (pose) or IoU (face) |
| Low-confidence detections rejected | Visibility threshold 0.5 — occluded landmarks ignored |
| Fallback chain ensures SOME tracking | requested → nose → wrist → index → elbow |
| Car/movement doesn't break tracking | Continuous decay re-centers the range |
| Camera frames never leave device | All processing is on-device via WASM |

### BCBA alignment
- **Least restrictive**: Uses whatever body part the child CAN move
- **Individualized**: Adapts to each child's motor capabilities automatically
- **No forced compliance**: Child doesn't need to "hold still" or "look here"

---

## 3. Touch Profile Learning (Hand Calibration)

### How it works
- Scans the child's hand geometry via camera (finger width, span, tremor)
- Builds a motor profile with Y-offset correction, settle time, lift delay
- Continuously refines based on observed touch patterns

### Do No Harm protections
| Protection | Implementation |
|-----------|---------------|
| Therapist modeling doesn't corrupt profile | Outlier rejection: touches >2 SD from baseline rejected |
| Profile drift detection | If >50% touches rejected over 100 samples → recalibration flag |
| Never overwrites without consent | Drift flag shown to caregiver, not auto-applied |
| Tremor accommodation | Zero-crossing frequency analysis adjusts sensitivity |

### BCBA alignment
- **Antecedent modification**: Touch targets adapted to child's motor profile
- **Accommodation, not restriction**: Bigger touch targets, not removed features
- **Caregiver notification**: Drift detection alerts BCBA to potential motor changes
- **Data collection**: Touch accuracy serves as fine motor data point

---

## 4. Emergency System Learning

### How it works
- Deduplication: same phrase within 5 minutes is flagged as duplicate
- Severity classification: phrases auto-classified (critical/urgent/medical)
- Offline queue: alerts queued when offline, auto-sent on reconnection

### Do No Harm protections
| Protection | Implementation |
|-----------|---------------|
| Critical alerts CANNOT be cancelled | "I can't breathe", "someone hurt me" — no cancel button |
| Emergency features NEVER gated by payment | All tiers, always |
| No false negative: stale alerts still send | >30 min critical → SMS-only with [DELAYED] prefix |
| Anti-SWAT: dedup prevents button-mashing 911 floods | 5-minute window |
| Cancel requires two-corner hold for 3 seconds | Bully can't figure out in 5-10s window |

### BCBA alignment
- **Safety protocol**: Matches clinical crisis intervention plans
- **Self-advocacy**: Child can independently request help
- **Dignity-preserving**: Alert goes to contacts, not broadcast

---

## 5. Prediction Decay (Vocabulary Maintenance)

### How it works
- Every 24h, word frequencies decay by 5% (count × 0.95)
- Words used <7 days ago are protected from decay
- Words with count=1 older than 30 days are hard-deleted (typo cleanup)

### Do No Harm protections
| Protection | Implementation |
|-----------|---------------|
| Count=2 words preserved (fixed in security audit) | Was dropping after 7 days, now keeps count=1 after decay |
| Seed vocabulary never decays | lastUsed=0 means no decay ever applies |
| LRU eviction keeps top words | Only removes oldest entries when >5000 |
| Clinical vocabulary protected | Paid tier clinical words have count=1, lastUsed=0 |

### BCBA alignment
- **Maintenance**: Frequently used words stay prominent
- **Generalization probe**: Rarely used words naturally fade (mirrors real generalization)
- **No artificial ceiling**: No limit on vocabulary size during growth phase

---

## 6. Schedule Greeting

### How it works
- Time-aware greeting on app launch (Good morning/afternoon/evening)
- Shows next undone task from the child's visual schedule
- Auto-speaks if autoSpeak is enabled

### Do No Harm protections
| Protection | Implementation |
|-----------|---------------|
| Dismissible | Single tap closes the banner |
| Session-scoped | Only shows once per browser session |
| No blocking | Banner doesn't cover keyboard or communication tools |
| Translatable | Greeting uses i18n system for child's language |

### BCBA alignment
- **Visual schedule**: Recommended ABA practice for predictability and transitions
- **Antecedent strategy**: Knowing "what's next" reduces anxiety
- **Functional communication**: Child can communicate about schedule items
- **First-then**: Supports first-then contingency boards

---

## Overall BCBA Clinical Alignment

| ABA Principle | PrismAAC Implementation |
|--------------|------------------------|
| **Least restrictive procedures** | Camera tracking uses whatever body part works; no forced compliance |
| **Functional Communication Training (FCT)** | Manding predictions rise naturally; emergency self-advocacy |
| **Data-driven decision making** | Word frequency = discrete trial data; touch accuracy = motor data |
| **Generalization** | Bigrams capture cross-context patterns; multi-language support |
| **Maintenance** | Decay system mirrors natural maintenance schedules |
| **Antecedent modifications** | Touch profile adaptation; visual schedule; greeting context |
| **Dignity-preserving** | Child's words never overridden; emergency alerts are private |
| **AAC access never restricted** | Emergency features on all tiers; keyboard always visible |
| **Caregiver training component** | Drift detection alerts; schedule management; note system |

---

## What the System NEVER Does

1. **Never speaks FOR the child** — AI suggestions require explicit tap
2. **Never restricts AAC access** — No feature gates communication behind payment
3. **Never shares data without consent** — Camera frames stay on-device
4. **Never overrides the child's choice** — Predictions are suggestions, not autocomplete
5. **Never punishes** — No negative consequences for any input pattern
6. **Never removes learned words** — Decay reduces, never deletes intentional vocabulary
7. **Never exposes the child to harm** — Emergency system, identity locking, CSP

</details>
