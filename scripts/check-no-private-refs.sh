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

# The synalux-hrr dependency is VENDORED at vendor/synalux-hrr (compiled
# wasm-pack output; source of truth is the private platform repo). The
# file:../ path into the private repo that this guard once had to except is
# gone, so the guard runs with no manifest exceptions. PRIVACY.md needs no
# exception either: its published contact is a role address.
EXCEPTIONS=(':!scripts/check-no-private-refs.sh')

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
