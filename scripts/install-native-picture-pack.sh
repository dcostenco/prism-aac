#!/bin/sh
set -eu

export PATH="/opt/homebrew/bin:/usr/local/bin:$PATH"
native_picture_node="${AAC_PICTURE_NODE:-}"
if [ -z "$native_picture_node" ]; then native_picture_node="$(command -v node || true)"; fi
if [ -z "$native_picture_node" ] || [ ! -x "$native_picture_node" ]; then
  echo "error: Set AAC_PICTURE_NODE to an executable Node.js path in the target build settings."
  exit 1
fi
if [ -z "${AAC_PICTURE_PACK_DIR:-}" ]; then
  echo "error: Set AAC_PICTURE_PACK_DIR to the immutable approved picture-pack directory."
  exit 1
fi
native_picture_output="$TARGET_BUILD_DIR/$UNLOCALIZED_RESOURCES_FOLDER_PATH"
case "$native_picture_output" in /tmp/*) native_picture_output="/private$native_picture_output" ;; esac
"$native_picture_node" "$SRCROOT/../scripts/prepare-native-picture-pack.mjs" --output-dir "$native_picture_output"
