#!/bin/bash
# Automated App Store submission for Prism AAC
# Usage: ./scripts/submit-appstore.sh
set -e

PROJ="ios-native/PrismAAC.xcodeproj"
SCHEME="PrismAAC"

# Load from env — set these in ~/.zshenv or export before running:
#   export ASC_TEAM_ID="..."
#   export ASC_KEY_ID="..."
#   export ASC_ISSUER_ID="..."
#   export ASC_KEY_PATH="$HOME/private_keys/AuthKey_${ASC_KEY_ID}.p8"
TEAM="${ASC_TEAM_ID:?ASC_TEAM_ID not set}"
KEY_ID="${ASC_KEY_ID:?ASC_KEY_ID not set}"
ISSUER_ID="${ASC_ISSUER_ID:?ASC_ISSUER_ID not set}"
KEY_PATH="${ASC_KEY_PATH:-$HOME/private_keys/AuthKey_${KEY_ID}.p8}"

# Read version from Info.plist
VERSION=$(plutil -extract CFBundleShortVersionString raw ios-native/PrismAAC/Info.plist)
BUILD=$(plutil -extract CFBundleVersion raw ios-native/PrismAAC/Info.plist)
ARCHIVE="$HOME/Desktop/PrismAAC-${VERSION}-b${BUILD}.xcarchive"

echo "=== Prism AAC v${VERSION} (build ${BUILD}) ==="
echo ""

echo "[1/2] Archiving..."
xcodebuild archive \
  -project "$PROJ" -scheme "$SCHEME" \
  -archivePath "$ARCHIVE" \
  -destination "generic/platform=iOS" \
  -allowProvisioningUpdates \
  -authenticationKeyPath "$KEY_PATH" \
  -authenticationKeyID "$KEY_ID" \
  -authenticationKeyIssuerID "$ISSUER_ID" \
  DEVELOPMENT_TEAM="$TEAM" \
  CODE_SIGN_STYLE=Automatic \
  -quiet

echo "[2/2] Uploading to App Store Connect..."
cat > /tmp/ExportOptions.plist << PLIST
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>method</key><string>app-store-connect</string>
    <key>teamID</key><string>${TEAM}</string>
    <key>signingStyle</key><string>automatic</string>
    <key>uploadSymbols</key><true/>
    <key>destination</key><string>upload</string>
</dict>
</plist>
PLIST

xcodebuild -exportArchive \
  -archivePath "$ARCHIVE" \
  -exportOptionsPlist /tmp/ExportOptions.plist \
  -exportPath "$HOME/Desktop/PrismAAC-upload" \
  -allowProvisioningUpdates \
  -authenticationKeyPath "$KEY_PATH" \
  -authenticationKeyID "$KEY_ID" \
  -authenticationKeyIssuerID "$ISSUER_ID"

echo ""
echo "✅ v${VERSION} (build ${BUILD}) uploaded to App Store Connect"
echo "Next: go to appstoreconnect.apple.com → submit for review"
