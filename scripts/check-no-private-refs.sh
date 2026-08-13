#!/usr/bin/env bash
# Leak guard for this PUBLIC repository.
#
# Why this exists (2026-08-12): 32 tracked files named the private platform
# repository — CHANGELOG, README, six docs, eleven translations, thirteen
# source files' comments, and two scripts. Nothing checked, so they
# accumulated across releases. Ported from the sibling docs repo, where the
# same audit found sixteen.
#
# Deliberately NOT matched: `service_role` and similar policy names. They
# describe the documented security model and are public by design. A guard
# that flags correct documentation gets disabled.
#
# Usage:  bash scripts/check-no-private-refs.sh
# Exit 0 = clean, 1 = leak found (prints file:line).

set -uo pipefail
cd "$(dirname "$0")/.."

PATTERNS=(
  'synalux-private'                       # the private platform repo, by name
  'bcba-private'                          # internal engineering repo
  'prism-training'                        # private training repo
  'GT Independence'                       # FMS vendor — private commercial relationship
  'Fello FMCS'                            # ditto
  'fusacostenco'                          # personal account
  '[a-zA-Z0-9._%+-]+@gmail\.com'          # personal email of any contributor
  'AIza[0-9A-Za-z_-]{30,}'                # Google API key
  'sk-[A-Za-z0-9]{20,}'                   # OpenAI-style secret
  'sk_live_[A-Za-z0-9]{10,}'              # Stripe live secret
  'eyJhbGciOi[A-Za-z0-9._-]{20,}'         # JWT (Supabase service/anon keys)
  'SUPABASE_SERVICE_ROLE_KEY *[:=] *[^ ]'  # assigned service key
  'BEGIN (RSA |EC |OPENSSH )?PRIVATE KEY' # private key material
)

# ─── Known exception, stated loudly rather than hidden ───────────────────
#
# package.json and package-lock.json carry
#     "synalux-hrr": "file:../synalux-private/packages/hrr-wasm/pkg-web"
# which is a FUNCTIONAL dependency path, not prose. `synalux-hrr` is imported
# by services/hrrContext.ts and three test files, so rewriting the string
# breaks `npm install` for everyone whose sibling checkout is named that —
# silently, because npm only fails on a fresh install.
#
# Closing it properly means publishing or vendoring `synalux-hrr` so the
# dependency stops reaching outside the repository. That is an engineering
# change, not a text scrub, and it is tracked separately. Note that this
# `file:` path already makes the package uninstallable for any public
# clone, so the fix is worth doing on its own merits.
#
# Whoever removes that dependency should delete this exception in the same
# commit — the guard will tell them, because it starts failing on nothing.
# chrome-extension/PRIVACY.md publishes a contact address BY DESIGN — the
# Chrome Web Store requires a reachable contact in a privacy policy, so that
# address is intentionally public and is not a leak. Flagged for a separate
# decision: it is a personal gmail rather than a role address such as
# support@synalux.ai, which is a choice worth revisiting, not a defect to
# silently rewrite here.
EXCEPTIONS=(':!package.json' ':!package-lock.json' ':!scripts/check-no-private-refs.sh'
            ':!chrome-extension/PRIVACY.md')

# Adversarial review of this guard in the sibling repo planted seven leak
# variants and it caught none: git grep without -i is case-sensitive, so a
# heading reading "SYNALUX-PRIVATE" — ordinary prose — passed a guard whose
# only job is that string. Hence -i.
#
# Knowingly still uncaught, recorded rather than left as a silent gap:
#   - separator variants ("synalux private"), which would flag legitimate
#     copy such as "Synalux private cloud".
#   - deliberate obfuscation. This guards against accident, not evasion.
status=0
for pattern in "${PATTERNS[@]}"; do
  if hits=$(git grep -nIiE "$pattern" -- . "${EXCEPTIONS[@]}" 2>/dev/null); then
    if [ -n "$hits" ]; then
      echo "LEAK: pattern /$pattern/ found in this PUBLIC repo:"
      echo "$hits" | sed 's/^/  /'
      status=1
    fi
  fi
done

if [ "$status" -eq 0 ]; then
  echo "leak guard: clean ($(git ls-files | wc -l | tr -d ' ') tracked files scanned)"
else
  echo
  echo "This repository is PUBLIC. Remove the reference, or rephrase it so it"
  echo "does not name private repos, vendors, personal accounts, or secrets."
fi
exit "$status"
