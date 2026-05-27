#!/usr/bin/env bash
# Build PrismAACWatch for watchOS simulator.
# SYMROOT/BUILD_DIR must be unified so local SPM packages share the same
# GeneratedModuleMaps-* directory as the parent project.
set -euo pipefail

PROJECT="$(dirname "$0")/../PrismAAC.xcodeproj"
BUILD_DIR="$(dirname "$0")/../build"

exec xcodebuild \
    -project "$PROJECT" \
    -target PrismAACWatch \
    -destination 'platform=watchOS Simulator,name=Apple Watch Series 9 (45mm)' \
    -configuration Debug \
    CODE_SIGN_IDENTITY="" CODE_SIGNING_REQUIRED=NO \
    SYMROOT="$BUILD_DIR" BUILD_DIR="$BUILD_DIR" \
    "$@"
