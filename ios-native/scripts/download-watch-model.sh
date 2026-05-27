#!/usr/bin/env bash
# Download SmolLM2-360M-AAC Q3_K_S for Watch offline mode.
# Run once after cloning. Model is gitignored (209 MB binary).
set -euo pipefail

DEST="$(dirname "$0")/../PrismAACWatch/smollm2-360m-aac-q3ks.gguf"
MODEL_URL="${WATCH_MODEL_URL:-}"  # set in CI or locally via .env

if [[ -f "$DEST" ]]; then
    echo "Model already present: $DEST"
    exit 0
fi

if [[ -z "$MODEL_URL" ]]; then
    # Fall back to local models directory (dev machine)
    LOCAL="$HOME/models/smollm2-360m-aac-q3ks.gguf"
    if [[ -f "$LOCAL" ]]; then
        echo "Copying from local models..."
        cp "$LOCAL" "$DEST"
        echo "Done: $(du -sh "$DEST" | cut -f1)"
        exit 0
    fi
    echo "ERROR: Set WATCH_MODEL_URL or ensure ~/models/smollm2-360m-aac-q3ks.gguf exists."
    exit 1
fi

echo "Downloading Watch model from \$WATCH_MODEL_URL..."
curl -L --progress-bar -o "$DEST" "$MODEL_URL"
echo "Done: $(du -sh "$DEST" | cut -f1)"
