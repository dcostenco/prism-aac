#!/usr/bin/env bash
# Fetch accuracy numbers from HuggingFace model READMEs and update
# constants/modelRegistry.ts in-place.
#
# Usage:
#   bash scripts/update-model-registry.sh
#
# Requires: curl, python3
# No HuggingFace token needed — model cards are public.

set -euo pipefail
REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
REGISTRY="$REPO_ROOT/constants/modelRegistry.ts"

declare -A HF_REPOS=(
  ["1b7"]="dcostenco/prism-coder-1.7b"
  ["8b"]="dcostenco/prism-coder-8b"
  ["14b"]="dcostenco/prism-coder-14b"
  ["32b"]="dcostenco/prism-coder-32b"
)

echo "Fetching model cards from HuggingFace..."
declare -A ACCURACY VERSION

for id in "${!HF_REPOS[@]}"; do
  repo="${HF_REPOS[$id]}"
  url="https://huggingface.co/${repo}/raw/main/README.md"
  card=$(curl -sL "$url")
  if [[ -z "$card" ]]; then
    echo "  ⚠ $id: could not fetch $url — skipping"
    continue
  fi

  # Extract "Mean: XX.X%" from the BFCL section
  acc=$(echo "$card" | grep -oP '(?<=\*\*Mean: )\d+\.\d+(?=%\*\*)' | head -1)
  # Extract version from "## BFCL Routing Benchmark — vNN"
  ver=$(echo "$card" | grep -oP '(?<=Benchmark — )v\d+' | head -1)

  if [[ -z "$acc" || -z "$ver" ]]; then
    echo "  ⚠ $id: could not parse accuracy/version from README — skipping"
    continue
  fi
  ACCURACY[$id]="$acc"
  VERSION[$id]="$ver"
  echo "  ✓ $id: $ver  accuracy=$acc%"
done

echo ""
echo "Updating $REGISTRY..."

python3 - "$REGISTRY" <<PYEOF
import re, sys

path = sys.argv[1]
text = open(path).read()

updates = {
$(for id in "${!ACCURACY[@]}"; do echo "  '$id': ('${VERSION[$id]}', ${ACCURACY[$id]}),"; done)
}

def replace_field(block, field, new_val):
    return re.sub(
        rf"({field}:\s+)'[^']*'",
        lambda m: f"{m.group(1)}'{new_val}'",
        block,
        count=1,
    )

def replace_num_field(block, field, new_val):
    return re.sub(
        rf"({field}:\s+)[\d.]+",
        lambda m: f"{m.group(1)}{new_val}",
        block,
        count=1,
    )

for model_id, (version, accuracy) in updates.items():
    # Match the model block by its key
    pattern = rf"('{model_id}': {{[^}}]+}})"
    def patch_block(m):
        blk = m.group(1)
        blk = replace_field(blk, 'version', version)
        blk = replace_num_field(blk, 'accuracy', accuracy)
        return blk
    text = re.sub(pattern, patch_block, text, flags=re.DOTALL)

open(path, 'w').write(text)
print("Registry updated.")
PYEOF

echo "Done. Review changes with: git diff constants/modelRegistry.ts"
