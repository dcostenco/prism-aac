(*
  sim-smoke-test.applescript
  Prism AAC — iOS Simulator visual smoke test

  Tests performed:
    1. Verify a simulator is booted
    2. Launch the Prism AAC app
    3. Verify the process starts (not crashed)
    4. Take a screenshot at T+3s (launch state) and T+6s (loaded state)
    5. Verify screenshot files are non-trivial in size (≥ 80 KB)
    6. Verify the two screenshots differ (page loaded and changed the UI)
    7. Terminate the app cleanly

  Prerequisites:
    • A simulator must be booted: xcrun simctl boot "iPhone 17 Pro"
      (or any other booted sim — "booted" alias works for a single booted device)
    • The debug build must be installed:
      xcrun simctl install booted ~/Library/Developer/Xcode/DerivedData/PrismAAC-*/Build/Products/Debug-iphonesimulator/PrismAAC.app
    • Run with: osascript ios-native/scripts/sim-smoke-test.applescript

  Output:
    Screenshots saved to /tmp/prism-aac-smoke/ as 01-launch.png and 02-loaded.png
*)

property BUNDLE_ID : "ai.synalux.prism-aac"
property SIMULATOR_ID : "booted"
property SCREENSHOT_DIR : "/tmp/prism-aac-smoke/"
property MIN_SCREENSHOT_BYTES : 80000 -- 80 KB minimum; a blank render is ~5 KB

on run
    -- ── Setup ──────────────────────────────────────────────────────────────
    do shell script "mkdir -p " & quoted form of SCREENSHOT_DIR
    log "=== Prism AAC iOS Simulator Smoke Test ==="
    set failCount to 0

    -- ── 1. Booted device check ─────────────────────────────────────────────
    set bootedCount to 0 as integer
    try
        set bootedCount to (do shell script "xcrun simctl list devices booted | grep -c '(Booted)' || echo 0") as integer
    end try
    if bootedCount < 1 then
        log "❌ FAIL: No simulator is booted."
        log "   Fix: xcrun simctl boot 'iPhone 17 Pro'"
        error "Aborted — no booted simulator"
    end if
    log "✓ Simulator booted (" & bootedCount & " device(s))"

    -- ── 2. Terminate any running instance then launch fresh ────────────────
    do shell script "xcrun simctl terminate " & SIMULATOR_ID & " " & BUNDLE_ID & " 2>/dev/null; true"
    delay 0.5
    try
        do shell script "xcrun simctl launch " & SIMULATOR_ID & " " & BUNDLE_ID
    on error errMsg
        log "❌ FAIL: Could not launch app — " & errMsg
        log "   Fix: Install the debug build first:"
        log "   xcrun simctl install booted <path-to-PrismAAC.app>"
        error "Aborted — app launch failed"
    end try
    log "✓ App launched"

    -- ── 3. Screenshot 1 — launch state (before page loads) ────────────────
    delay 3
    set shot1 to SCREENSHOT_DIR & "01-launch.png"
    do shell script "xcrun simctl io " & SIMULATOR_ID & " screenshot " & quoted form of shot1
    set ok1 to checkScreenshot(shot1, "launch")
    if ok1 then
        log "✓ Screenshot 01-launch.png: OK"
    else
        set failCount to failCount + 1
        log "❌ FAIL: Screenshot 01-launch.png too small (blank/crashed?)"
    end if

    -- ── 4. Wait for WKWebView to finish loading ────────────────────────────
    delay 4

    -- ── 5. Screenshot 2 — loaded state ────────────────────────────────────
    set shot2 to SCREENSHOT_DIR & "02-loaded.png"
    do shell script "xcrun simctl io " & SIMULATOR_ID & " screenshot " & quoted form of shot2
    set ok2 to checkScreenshot(shot2, "loaded")
    if ok2 then
        log "✓ Screenshot 02-loaded.png: OK"
    else
        set failCount to failCount + 1
        log "❌ FAIL: Screenshot 02-loaded.png too small (blank/crashed?)"
    end if

    -- ── 6. Verify screenshots differ (page transitioned) ──────────────────
    set checksum1 to do shell script "md5 -q " & quoted form of shot1
    set checksum2 to do shell script "md5 -q " & quoted form of shot2
    if checksum1 is equal to checksum2 then
        set failCount to failCount + 1
        log "❌ FAIL: Screenshots 01 and 02 are identical — page may not have loaded"
    else
        log "✓ Page loaded (screenshots differ)"
    end if

    -- ── 7. Process still alive ────────────────────────────────────────────
    set procCheck to do shell script "xcrun simctl spawn " & SIMULATOR_ID & " launchctl list 2>/dev/null | grep -c " & quoted form of BUNDLE_ID & " || echo 0"
    if (procCheck as integer) < 1 then
        set failCount to failCount + 1
        log "❌ FAIL: App process not found — app may have crashed"
    else
        log "✓ App process alive"
    end if

    -- ── 8. Terminate cleanly ───────────────────────────────────────────────
    do shell script "xcrun simctl terminate " & SIMULATOR_ID & " " & BUNDLE_ID & " 2>/dev/null; true"
    log "✓ App terminated"

    -- ── Result ────────────────────────────────────────────────────────────
    log ""
    if failCount = 0 then
        log "=== SMOKE TEST PASSED (4/4 checks) ==="
    else
        log "=== SMOKE TEST FAILED (" & failCount & " failure(s)) ==="
    end if
    log "Screenshots: " & SCREENSHOT_DIR

    return failCount = 0
end run

-- Returns true if file exists and is ≥ MIN_SCREENSHOT_BYTES
on checkScreenshot(filePath, label)
    try
        set fileSize to (do shell script "wc -c < " & quoted form of filePath & " | tr -d ' '") as integer
        return fileSize ≥ MIN_SCREENSHOT_BYTES
    on error
        return false
    end try
end checkScreenshot
