#!/usr/bin/env bash
# Playwright watchdog — runs a single playwright command with three kill switches:
#   1) MIN_FREE_GB  — abort if system free+speculative memory drops below this
#   2) MAX_STALL_S  — abort if playwright stdout stops moving for this long
#   3) MAX_TOTAL_S  — hard cap on total wall time
#
# On abort, sends SIGKILL to the playwright process tree AND any orphan
# Chromium / Chromium Helper / Webkit / Firefox the run spawned, so the
# system isn't left bleeding RAM after a runaway test (the bug class the
# strict discipline memo locks down).
#
# Usage:
#   scripts/playwright-watchdog.sh <playwright args...>
# Env overrides:
#   MIN_FREE_GB (default 4)   MAX_STALL_S (default 90)   MAX_TOTAL_S (default 600)
#   POLL_S      (default 2)
set -u

MIN_FREE_GB="${MIN_FREE_GB:-4}"
MAX_STALL_S="${MAX_STALL_S:-90}"
MAX_TOTAL_S="${MAX_TOTAL_S:-600}"
POLL_S="${POLL_S:-2}"

LOG="$(mktemp -t pw-watchdog.XXXXXX)"
echo "[watchdog] log=$LOG  min_free=${MIN_FREE_GB}GB  stall=${MAX_STALL_S}s  total=${MAX_TOTAL_S}s"

free_gb() {
  vm_stat | awk -v ps=4096 '
    /Pages free/        { gsub(/\./,"",$3); free=$3 }
    /Pages speculative/ { gsub(/\./,"",$3); spec=$3 }
    END { printf "%.2f", (free+spec)*ps/1024/1024/1024 }'
}

reap() {
  local reason="$1"
  echo "[watchdog] ABORT: $reason" >&2
  if [[ -n "${PW_PID:-}" ]]; then
    pkill -KILL -P "$PW_PID" 2>/dev/null || true
    kill -KILL "$PW_PID" 2>/dev/null || true
  fi
  # Sweep orphaned browser engines + node test workers
  pkill -KILL -f "Google Chrome for Testing" 2>/dev/null || true
  pkill -KILL -f "Chromium.app/Contents/MacOS"  2>/dev/null || true
  pkill -KILL -f "playwright/.*chromium"       2>/dev/null || true
  pkill -KILL -f "playwright/.*firefox"        2>/dev/null || true
  pkill -KILL -f "playwright/.*webkit"         2>/dev/null || true
  echo "[watchdog] reaped browser orphans"
  exit 99
}

# Launch playwright, tee output so we can both stream it and watch staleness
# via mtime of the log.
( npx playwright test "$@" 2>&1; echo "__PW_EXIT_$?__" ) | tee "$LOG" &
PW_PID=$!

START="$(date +%s)"
LAST_MTIME="$(stat -f %m "$LOG" 2>/dev/null || echo 0)"
LAST_CHANGE="$START"

while kill -0 "$PW_PID" 2>/dev/null; do
  NOW="$(date +%s)"
  ELAPSED=$((NOW - START))

  if (( ELAPSED > MAX_TOTAL_S )); then
    reap "exceeded MAX_TOTAL_S=${MAX_TOTAL_S}s"
  fi

  CUR_MTIME="$(stat -f %m "$LOG" 2>/dev/null || echo 0)"
  if [[ "$CUR_MTIME" != "$LAST_MTIME" ]]; then
    LAST_MTIME="$CUR_MTIME"
    LAST_CHANGE="$NOW"
  fi
  STALL=$((NOW - LAST_CHANGE))
  if (( STALL > MAX_STALL_S )); then
    reap "stdout idle for ${STALL}s (>${MAX_STALL_S}s) — likely freeze"
  fi

  FREE="$(free_gb)"
  # bash can't compare floats — strip decimal for cheap floor compare
  FREE_INT="${FREE%.*}"
  if (( FREE_INT < MIN_FREE_GB )); then
    reap "free RAM ${FREE}GB < ${MIN_FREE_GB}GB"
  fi

  printf "[watchdog] t=%ds free=%sGB stall=%ds\n" "$ELAPSED" "$FREE" "$STALL" >&2
  sleep "$POLL_S"
done

wait "$PW_PID" 2>/dev/null
EXIT_LINE="$(grep -E '^__PW_EXIT_[0-9]+__$' "$LOG" | tail -1)"
EXIT_CODE="${EXIT_LINE//[^0-9]/}"
echo "[watchdog] playwright exited code=${EXIT_CODE:-?}"
exit "${EXIT_CODE:-1}"
