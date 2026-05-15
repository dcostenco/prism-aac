#!/bin/bash
# Automated App Store submission for Prism AAC
# Usage: ./scripts/submit-appstore.sh
set -e

PROJ="ios-native/PrismAAC.xcodeproj"
SCHEME="PrismAAC"
TEAM="Z4UYN9388M"
KEY_PATH="$HOME/private_keys/AuthKey_P4BW79M9KU.p8"
KEY_ID="P4BW79M9KU"
ISSUER_ID="7dca478c-0430-4412-be32-17c5bdbcebd5"

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
