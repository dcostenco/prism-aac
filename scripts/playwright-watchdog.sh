#!/usr/bin/env bash
# Playwright watchdog — runs a single playwright command with three kill switches:
#   1) MIN_FREE_GB  — abort if system free+speculative memory drops below this
#   2) MAX_STALL_S  — abort if playwright stdout stops moving for this long
#   3) MAX_TOTAL_S  — hard cap on total wall time
#
# On abort, sends SIGKILL to this run's isolated process group. This reaps
# Playwright and its browser children without killing a separate agent's
# concurrent browser proof.
#
# Usage:
#   scripts/playwright-watchdog.sh <playwright args...>
#   scripts/playwright-watchdog.sh --exec <standalone Playwright command...>
# Env overrides:
#   MIN_FREE_GB (default 4)   MAX_STALL_S (default 90)   MAX_TOTAL_S (default 600)
#   POLL_S      (default 2)
set -u
set -m

MIN_FREE_GB="${MIN_FREE_GB:-4}"
MAX_STALL_S="${MAX_STALL_S:-90}"
MAX_TOTAL_S="${MAX_TOTAL_S:-600}"
POLL_S="${POLL_S:-2}"

if [[ "${1:-}" == "--exec" ]]; then
  shift
  if (( $# == 0 )); then
    echo "[watchdog] --exec requires a command" >&2
    exit 2
  fi
  RUN_CMD=("$@")
  RUN_LABEL="standalone Playwright diagnostic"
else
  RUN_CMD=(npx playwright test "$@")
  RUN_LABEL="Playwright test"
fi

LOG="$(mktemp -t pw-watchdog.XXXXXX)"
echo "[watchdog] mode=$RUN_LABEL  log=$LOG  min_free=${MIN_FREE_GB}GB  stall=${MAX_STALL_S}s  total=${MAX_TOTAL_S}s"

free_gb() {
  vm_stat | awk '
    NR == 1 {
      if (match($0, /page size of [0-9]+ bytes/)) {
        page_size = substr($0, RSTART, RLENGTH)
        gsub(/[^0-9]/, "", page_size)
      }
    }
    /Pages free/        { gsub(/\./,"",$3); free=$3 }
    /Pages speculative/ { gsub(/\./,"",$3); spec=$3 }
    END {
      if (!page_size) page_size=4096
      printf "%.2f", (free+spec)*page_size/1024/1024/1024
    }'
}

reap() {
  local reason="$1"
  echo "[watchdog] ABORT: $reason" >&2
  if [[ -n "${PW_PGID:-}" && "$PW_PGID" != "$SELF_PGID" ]]; then
    /bin/kill -KILL "-${PW_PGID}" 2>/dev/null || true
  fi
  echo "[watchdog] reaped this run's process group"
  exit 99
}

# Launch the selected Playwright command, tee output so we can both stream it
# and watch staleness
# via mtime of the log. Monitor mode gives this background pipeline its own
# process group; every browser child inherits that group.
SELF_PGID="$(ps -o pgid= -p "$$" | tr -d '[:space:]')"
( "${RUN_CMD[@]}" 2>&1; echo "__PW_EXIT_$?__" ) | tee "$LOG" &
PW_PID=$!
PW_PGID="$(ps -o pgid= -p "$PW_PID" | tr -d '[:space:]')"
if [[ -z "$PW_PGID" || "$PW_PGID" == "$SELF_PGID" ]]; then
  echo "[watchdog] unable to isolate the Playwright process group" >&2
  kill -KILL "$PW_PID" 2>/dev/null || true
  exit 2
fi

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
  if awk -v free="$FREE" -v minimum="$MIN_FREE_GB" 'BEGIN { exit !(free < minimum) }'; then
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
