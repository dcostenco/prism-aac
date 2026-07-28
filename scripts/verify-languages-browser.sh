#!/usr/bin/env bash
#
# End-to-end language verification in a REAL browser, via `prism browser`.
#
# Why this exists
# ---------------
# The unit suite passed with 5,188 green tests while three questions it
# structurally cannot answer were still open:
#
#   - do the new languages actually appear in the picker?
#   - does selecting one switch the UI, or silently fall back to English?
#   - does the app fire failing network requests once it is in that language?
#
# Every one of those was answered wrong by assumption at some point. The
# pictogram bug (eight locales getting no pictures, five of them long shipped)
# was invisible to jsdom and surfaced the first time this ran for real.
#
# Two traps this encodes so nobody hits them again:
#   1. prism-aac serves under basePath /prism-aac. Hitting / returns 404 and
#      looks like the app is broken.
#   2. Ports 3000/3001 are usually taken by a DIFFERENT local app
#      (prism/dist/server.js). Pointing a browser there tests the wrong
#      product entirely — which happened, and produced a confident wrong
#      result.
#
# Usage:
#   scripts/verify-languages-browser.sh              # starts its own dev server
#   BASE_URL=http://localhost:3210 scripts/verify-languages-browser.sh
#
# Exits non-zero when a required language is missing or the UI does not switch.
set -uo pipefail

REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
REQUIRED_LANGS="${REQUIRED_LANGS:-am sw bn}"
# Ge'ez / Bengali ranges — used to prove the UI really re-rendered.
# A case statement, not an associative array: macOS ships bash 3.2, where
# `declare -A` is unsupported and silently turns the subscript into an
# unbound variable under `set -u`.
script_range_for() {
  case "$1" in
    am) printf 'ሀ-፿' ;;
    bn) printf 'ঀ-৿' ;;
    *)  printf '' ;;
  esac
}

started_server=""
cleanup() {
  if [[ -n "$started_server" ]]; then
    kill "$started_server" 2>/dev/null || true
    echo "  stopped dev server (pid $started_server)"
  fi
}
trap cleanup EXIT

if [[ -z "${BASE_URL:-}" ]]; then
  port=""
  for p in 3210 3211 3212 3213; do
    lsof -ti:"$p" >/dev/null 2>&1 || { port="$p"; break; }
  done
  [[ -n "$port" ]] || { echo "no free port in 3210-3213"; exit 2; }
  echo "starting dev server on :$port (3000/3001 are usually another app)"
  ( cd "$REPO" && nohup npx next dev -p "$port" > /tmp/aac-verify-dev.log 2>&1 & echo $! > /tmp/aac-verify.pid )
  started_server="$(cat /tmp/aac-verify.pid)"
  for _ in $(seq 1 60); do
    sleep 2
    curl -s -o /dev/null -m 10 "http://localhost:$port/prism-aac" && break
  done
  BASE_URL="http://localhost:$port"
fi

APP_URL="$BASE_URL/prism-aac"   # basePath — NOT the bare origin
echo "verifying $APP_URL"
echo

out=$(printf 'open %s\n%s\n%s\n%s\n' \
  "$APP_URL" \
  'eval new Promise(r=>setTimeout(()=>r("ready"),7000))' \
  'eval (()=>{const b=[...document.querySelectorAll("[aria-label]")].find(e=>/^input language$/i.test(e.getAttribute("aria-label")));if(!b)return "NO_BUTTON";b.click();return "clicked";})()' \
  'eval new Promise(r=>setTimeout(()=>r([...document.querySelectorAll("[data-testid^=language-option-]")].map(e=>e.dataset.testid.replace("language-option-","")).join(" ")),2500))' \
  | timeout 300 prism browser --headless --local-only pipe 2>&1)

codes=$(echo "$out" | tail -1 | sed 's/.*"result": "//;s/"}.*//')
if [[ "$out" == *NO_BUTTON* || -z "$codes" ]]; then
  echo "FAIL: could not open the language picker"; echo "$out" | tail -4; exit 1
fi
echo "picker options: $codes"
echo

fail=0
for lang in $REQUIRED_LANGS; do
  if [[ " $codes " == *" $lang "* ]]; then
    echo "  $lang: present in picker"
  else
    echo "  $lang: MISSING from picker"; fail=1; continue
  fi

  range="$(script_range_for "$lang")"
  [[ -z "$range" ]] && { echo "      (latin script — presence check only)"; continue; }

  sel=$(printf 'open %s\n%s\n%s\n%s\n%s\n' \
    "$APP_URL" \
    'eval new Promise(r=>setTimeout(()=>r("ready"),7000))' \
    'eval (()=>{const b=[...document.querySelectorAll("[aria-label]")].find(e=>/^input language$/i.test(e.getAttribute("aria-label")));b&&b.click();return "ok";})()' \
    "eval new Promise(r=>setTimeout(()=>{const o=document.querySelector('[data-testid=language-option-$lang]');if(o)o.click();r('selected');},2000))" \
    "eval new Promise(r=>setTimeout(()=>r((document.body.innerText.match(/[$range]/g)||[]).length),5000))" \
    | timeout 300 prism browser --headless --local-only pipe 2>&1 | tail -1 | sed 's/.*"result": "//;s/"}.*//')

  if [[ "$sel" =~ ^[0-9]+$ ]] && (( sel > 50 )); then
    echo "      selected -> $sel native-script characters rendered"
  else
    echo "      FAIL: selected but UI did not switch (got '$sel')"; fail=1
  fi
done

echo
if (( fail )); then echo "RESULT: FAILED"; exit 1; fi
echo "RESULT: all required languages selectable and rendering"
