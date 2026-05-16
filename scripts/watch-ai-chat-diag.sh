#!/usr/bin/env bash
# Diagnostic harness for the watchOS AI Chat dictation flow.
#
# Drives the watch sim via AppleScript clicks, captures NSLog
# diagnostics from the running PrismAACWatch app, and snapshots screens
# at each step.
#
# Why this exists: user reports the AI Chat mic doesn't work on a REAL
# Apple Watch either (previous build) — so this isn't sim-only. We need
# to capture exactly which step in the dictation flow fails.
#
# Prereqs:
#   • Watch sim booted (UDID below)
#   • Simulator app foregrounded (window visible, accessibility granted)
#   • PrismAACWatch installed AND launched (script does NOT re-install)
set -u
SIM_UDID="${SIM_UDID:-E28A277D-52BC-4BD2-9A2E-9287B382B6CB}"
OUT_DIR="${OUT_DIR:-/tmp/watch-ai-chat-diag-$(date +%s)}"
mkdir -p "$OUT_DIR"
echo "[diag] output dir: $OUT_DIR"

# --- Sanity check: sim booted -----------------------------------------------
if ! xcrun simctl list devices booted 2>&1 | grep -q "$SIM_UDID"; then
  echo "[diag] ERROR: sim $SIM_UDID not booted. Boot it first: xcrun simctl boot $SIM_UDID"
  exit 2
fi

# --- Start log stream in background -----------------------------------------
LOG_FILE="$OUT_DIR/watch-stream.log"
: > "$LOG_FILE"
echo "[diag] streaming logs to $LOG_FILE …"
xcrun simctl spawn "$SIM_UDID" log stream \
  --predicate 'eventMessage CONTAINS "WatchAIChat-DIAG" OR eventMessage CONTAINS "WatchDictation-DIAG" OR senderImagePath CONTAINS "localspeechrecognition" OR senderImagePath CONTAINS "PrismAACWatch"' \
  --style compact \
  > "$LOG_FILE" 2>&1 &
STREAM_PID=$!
trap 'kill $STREAM_PID 2>/dev/null || true' EXIT INT TERM
sleep 1

# --- Screenshot helper ------------------------------------------------------
shot() {
  local name="$1"
  xcrun simctl io "$SIM_UDID" screenshot "$OUT_DIR/$name.png" 2>/dev/null
  echo "[diag] $name → $OUT_DIR/$name.png"
}

# --- Click helper: python3 Quartz CGEventPost (screen-absolute) -------------
# AppleScript `click at` only hits group-level elements on watch sim — the
# event doesn't propagate down to SwiftUI buttons. CGEventPost emits real
# mouse-down/up pairs which the sim's touch shim converts into watch taps.
click_screen() {
  local x="$1" y="$2"
  osascript -e 'tell application "Simulator" to activate' >/dev/null 2>&1
  sleep 0.2
  python3 - "$x" "$y" <<'PY'
import sys, time
try:
    import Quartz
except ImportError:
    print("[click] ERROR: pyobjc/Quartz unavailable", flush=True)
    sys.exit(3)
x, y = int(sys.argv[1]), int(sys.argv[2])
pos = (x, y)
# Move mouse to position first — some sim builds drop clicks if the cursor
# wasn't recently moved to the target.
mv = Quartz.CGEventCreateMouseEvent(None, Quartz.kCGEventMouseMoved, pos, Quartz.kCGMouseButtonLeft)
Quartz.CGEventPost(Quartz.kCGHIDEventTap, mv)
time.sleep(0.05)
down = Quartz.CGEventCreateMouseEvent(None, Quartz.kCGEventLeftMouseDown, pos, Quartz.kCGMouseButtonLeft)
up   = Quartz.CGEventCreateMouseEvent(None, Quartz.kCGEventLeftMouseUp,   pos, Quartz.kCGMouseButtonLeft)
Quartz.CGEventPost(Quartz.kCGHIDEventTap, down)
time.sleep(0.08)
Quartz.CGEventPost(Quartz.kCGHIDEventTap, up)
print(f"[click] CGEventPost at ({x},{y})", flush=True)
PY
}

# --- Find Simulator window geometry -----------------------------------------
geom=$(osascript <<'OS'
tell application "Simulator" to activate
delay 0.3
tell application "System Events" to tell process "Simulator"
  set p to position of window 1
  set s to size of window 1
  return (item 1 of p as string) & " " & (item 2 of p as string) & " " & (item 1 of s as string) & " " & (item 2 of s as string)
end tell
OS
)
WIN_X=$(echo "$geom" | awk '{print $1}')
WIN_Y=$(echo "$geom" | awk '{print $2}')
WIN_W=$(echo "$geom" | awk '{print $3}')
WIN_H=$(echo "$geom" | awk '{print $4}')
echo "[diag] simulator window: pos=($WIN_X,$WIN_Y) size=${WIN_W}x${WIN_H}"

# --- Calibration (Series 11 46mm sim) ---------------------------------------
# Empirically calibrated against a screenshot from this exact sim:
#   • Window 276x378 at (WIN_X, WIN_Y)
#   • Watch screen content within window: 208x248 logical pt
#       - horizontal bezel: 34pt each side
#       - TOP bezel + speaker grille: ~68pt
#       - bottom bezel: ~62pt
#   • From the screenshot, AI button (the brain icon, 2nd of 4 in top bar)
#     centers at IMAGE pixel (156, 122). Image is 2x watch-screen scale,
#     so AI is at watch-screen pt (78, 61).
WATCH_LEFT_BEZEL=34
WATCH_TOP_BEZEL=68

# AI button — empirically at watch-screen (66, 61). The lang pill on the left
# is wider than the 3 icon buttons (it uses maxWidth: .infinity), so the 4
# buttons are NOT evenly spaced. Inbox is at ~107, Send ~164.
AI_X=$(( WIN_X + WATCH_LEFT_BEZEL + 66 ))
AI_Y=$(( WIN_Y + WATCH_TOP_BEZEL + 61 ))
echo "[diag] AI Chat button target: ($AI_X, $AI_Y)"

# Dictation mic: in WatchDictationView sheet, the TextFieldLink is the big
# blue mic card. Watch screen y ≈ 90pt (sheet shows below navTitle).
DICTATE_X=$(( WIN_X + WATCH_LEFT_BEZEL + 104 ))   # center of 208pt watch
DICTATE_Y=$(( WIN_Y + WATCH_TOP_BEZEL + 100 ))
echo "[diag] Dictate mic target: ($DICTATE_X, $DICTATE_Y)"

shot "01-home"
sleep 0.4

# --- Click AI Chat top-bar button -------------------------------------------
echo "[diag] STEP 1: clicking AI Chat top-bar button…"
click_screen "$AI_X" "$AI_Y"
sleep 2
shot "02-after-ai-tap"

# --- Click the mic (TextFieldLink) inside AI Chat sheet ---------------------
echo "[diag] STEP 2: clicking mic (TextFieldLink) at ($DICTATE_X, $DICTATE_Y)…"
click_screen "$DICTATE_X" "$DICTATE_Y"
sleep 3
shot "03-after-mic-tap"

sleep 2
shot "04-final"

echo ""
echo "============================================================"
echo "[diag] === DIAG log lines (WatchAIChat-DIAG / Dictation) ==="
echo "============================================================"
grep -E "WatchAIChat-DIAG|WatchDictation-DIAG" "$LOG_FILE" || echo "(no diag lines captured)"
echo ""
echo "============================================================"
echo "[diag] === Speech / dictation related ==="
echo "============================================================"
grep -iE "speech|dictat|recogniz|audio.*session|localspeechrecognition" "$LOG_FILE" | grep -v "WatchAIChat-DIAG" | tail -20 || echo "(none)"
echo ""
echo "============================================================"
echo "[diag] === Crashes / errors ==="
echo "============================================================"
grep -iE "crash|fatal|assert|EXC_|signal 9|abort" "$LOG_FILE" | head -10 || echo "(none)"

echo ""
echo "[diag] full log: $LOG_FILE"
echo "[diag] screenshots: $OUT_DIR/0*.png"
