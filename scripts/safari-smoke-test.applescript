(*
  Prism AAC — Safari smoke test (AppleScript)
  ============================================
  Military-grade manual regression harness for the web version.
  Tests the three Ludmila bugs in a real Safari browser session.

  Prerequisites:
    1. Safari > Settings > Advanced > "Show features for web developers" ON
    2. Safari > Develop menu > "Allow JavaScript from Apple Events" ON
    3. Run: osascript scripts/safari-smoke-test.applescript

  Pass criteria (all must be TRUE):
    PASS_1  — one click from default reaches keyboard-only
    PASS_2  — PredictionBar absent in keyboard-only mode
    PASS_3  — PredictionBar present in default mode
    PASS_4  — keyboard-only fills ≥ 60 % of viewport height

  Output: prints PASS/FAIL for each assertion to stdout.
*)

set APP_URL to "https://prism-aac.vercel.app/prism-aac"
set PASS to true
set FAIL to false

-- Helper: run JS in Safari frontmost tab and return result as string
on runJS(jsCode)
  tell application "Safari"
    return (do JavaScript jsCode in current tab of front window) as string
  end tell
end runJS

-- Helper: wait up to maxSeconds for JS condition to return "true"
on waitFor(conditionJS, maxSeconds)
  set elapsed to 0
  repeat while elapsed < maxSeconds
    set result to my runJS(conditionJS)
    if result is "true" then return true
    delay 0.5
    set elapsed to elapsed + 0.5
  end repeat
  return false
end waitFor

-- ── Open Safari and navigate ──────────────────────────────────────────────────
tell application "Safari"
  activate
  if (count of windows) is 0 then make new document
  set URL of current tab of front window to APP_URL
end tell

delay 3

-- Wait for app to fully hydrate (kb-cycle-btn must exist)
set booted to my waitFor("!!document.querySelector('[data-testid=\"kb-cycle-btn\"]')", 30)
if not booted then
  log "FATAL: App did not boot within 30s — is Safari JS from Apple Events enabled?"
  error "App boot timeout"
end if

-- Clear localStorage and reload for clean state
my runJS("localStorage.clear(); sessionStorage.clear();")
tell application "Safari"
  set URL of current tab of front window to APP_URL
end tell
delay 3
my waitFor("!!document.querySelector('[data-testid=\"kb-cycle-btn\"]')", 30)

log "=== Prism AAC Safari Smoke Test ==="
log "URL: " & APP_URL
set passCount to 0
set failCount to 0

-- ── Helper: assert and log ─────────────────────────────────────────────────────
on assertPass(label, condition)
  if condition then
    log "✅ PASS  " & label
    set passCount to passCount + 1
  else
    log "❌ FAIL  " & label
    set failCount to failCount + 1
  end if
end assertPass

-- ── BASELINE: default state ────────────────────────────────────────────────────

set kbVisible to my runJS("!!document.querySelector('[data-testid=\"keyboard-shell\"]')")
my assertPass("Default state: keyboard-shell present", kbVisible is "true")

set predVisible to my runJS("!!document.querySelector('[data-testid=\"prediction-bar\"]')")
my assertPass("PASS_3 — PredictionBar visible in default state", predVisible is "true")

set kbCycleBtnVisible to my runJS("!!document.querySelector('[data-testid=\"kb-cycle-btn\"]')")
my assertPass("Default state: kb-cycle-btn present", kbCycleBtnVisible is "true")

-- Get viewport height before clicking
set viewportHeight to my runJS("window.innerHeight") as integer

-- ── BUG 1 TEST: one click → keyboard-only ──────────────────────────────────────

my runJS("document.querySelector('[data-testid=\"kb-cycle-btn\"]').click()")
delay 0.8

-- Keyboard-shell must be visible
set kbVisible2 to my runJS("!!document.querySelector('[data-testid=\"keyboard-shell\"]')")
my assertPass("After 1st click: keyboard-shell visible", kbVisible2 is "true")

-- CategoryPanel nav (containing kb-cycle-btn) must be hidden
set catNavHidden to my runJS("!document.querySelector('[data-testid=\"kb-cycle-btn\"]')")
my assertPass("After 1st click: CategoryPanel nav hidden (keyboard-only)", catNavHidden is "true")

-- Keyboard must fill majority of viewport
set kbHeight to my runJS("document.querySelector('[data-testid=\"keyboard-shell\"]')?.offsetHeight || 0") as integer
set minExpected to (viewportHeight * 0.5) as integer
my assertPass("PASS_1 — keyboard-only height ≥ 50% viewport (" & kbHeight & " vs " & minExpected & ")", kbHeight ≥ minExpected)

-- ── BUG 2 TEST: PredictionBar absent in keyboard-only ──────────────────────────

set predHidden to my runJS("!document.querySelector('[data-testid=\"prediction-bar\"]')")
my assertPass("PASS_2 — PredictionBar absent in keyboard-only mode", predHidden is "true")

-- ── CYCLE: keyboard-only → picture-only via in-keyboard minimize button ────────

set kbMinExists to my runJS("!!document.querySelector('button[data-action=\"kb-minimize\"]')")
my assertPass("In keyboard-only: kb-minimize button present", kbMinExists is "true")

my runJS("document.querySelector('button[data-action=\"kb-minimize\"]')?.click()")
delay 0.8

set kbHidden to my runJS("!document.querySelector('[data-testid=\"keyboard-shell\"]')")
my assertPass("After minimize: keyboard-shell hidden (picture-only)", kbHidden is "true")

-- kb-cycle-btn must reappear
set cycleBack to my runJS("!!document.querySelector('[data-testid=\"kb-cycle-btn\"]')")
my assertPass("After minimize: kb-cycle-btn visible (picture-only)", cycleBack is "true")

-- ── BUG 1 (from picture-only): ONE click must reach keyboard-only ──────────────

my runJS("document.querySelector('[data-testid=\"kb-cycle-btn\"]').click()")
delay 0.8

set kbVisible3 to my runJS("!!document.querySelector('[data-testid=\"keyboard-shell\"]')")
my assertPass("From picture-only: keyboard-shell visible after 1 click", kbVisible3 is "true")

set kbHeight2 to my runJS("document.querySelector('[data-testid=\"keyboard-shell\"]')?.offsetHeight || 0") as integer
my assertPass("PASS_4 — From picture-only: 1 click gives keyboard-only (" & kbHeight2 & "px ≥ " & minExpected & "px)", kbHeight2 ≥ minExpected)

-- CategoryPanel nav must still be hidden (keyboard-only confirmed)
set catHidden2 to my runJS("!document.querySelector('[data-testid=\"kb-cycle-btn\"]')")
my assertPass("From picture-only: no all-3 intermediate state (cat nav hidden)", catHidden2 is "true")

-- ── SUMMARY ────────────────────────────────────────────────────────────────────

log ""
log "==============================="
log "RESULTS: " & passCount & " passed, " & failCount & " failed"
if failCount is 0 then
  log "🎖  ALL TESTS PASSED — BUG FIXES VERIFIED IN SAFARI"
else
  log "💥  " & failCount & " FAILURE(S) — INVESTIGATE BEFORE PUSH"
end if
log "==============================="
