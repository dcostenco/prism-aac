# Generated pictures in native builds

The watch reads the same approved PNG library used by the web app. The library is included in the signed watch app so a fresh installation can show pictures without a phone or a picture-service connection. Picture source files are maintained separately from this repository.

Set `AAC_PICTURE_PACK_DIR` to the absolute, immutable directory containing the current `pictures-0000.aacpack` chunks. Its version must match `constants/generated/picturePack.json`. Set `AAC_PICTURE_NODE` to the absolute path of a working Node.js executable. In the Xcode GUI, add both as target user-defined build settings; command-line builds can pass them to `xcodebuild`. These settings are local paths and must not be committed into shared schemes.

The watch build phase validates the complete library on every build, then writes `AACPictures.aacpack`, the approved manifest and ID maps, and attribution into the app bundle before signing. Missing, corrupt or mismatched inputs fail the build. It never downloads or regenerates pictures, and never writes unpacked library PNGs into the repository. iPhone builds also build and embed this watch app.

The build phase and Watch test scheme are declared in `project.yml`. Run `npm run test:native-project` on macOS with XcodeGen to check a disposable regenerated project, including the iOS app-bound domains and Watch translation resources. This gate does not build or sign the app; the native build and offline tests remain required.

To validate the bundled bytes and image decoding locally, compile `scripts/check-native-picture-pack.swift` together with `PrismAACWatch/Sources/Resources/AACPictureLibrary.swift` using the macOS SDK, then run the resulting checker with the built watch `.app` directory and `constants/generated/phraseSymbolFiles.json`. The checker compares each original image hash and verifies the decoded cache bounds. The library uses serial, display-sized decoding and a bounded cache; the original PNG bytes remain unchanged.

`OfflinePicturePackSimulatorTests` exercises the iPhone/iPad wrapper after an online installation: it closes app-resource requests, cold-relaunches, checks the original picture bytes, and taps a word into the composer. Run its fixture with `scripts/native-offline-picture-fixture.mjs` against a local production build. The fixture uses loopback ports 6948 and 6949; no live account or purchase is used.

`OfflineWatchTests` requires a fresh watch app container. Boot the unpaired watch simulator and wait for `simctl bootstatus -b` before running the test. It selects local phrases including “I” and color “Orange,” verifies their recents survive relaunch, and checks Russian labels with the same picture identity. Recent selections retain canonical phrase IDs and categories; old label-only history is read as a fallback, with ambiguous meanings kept as text. Standard toolbar controls use system icons; phrase and category artwork uses the generated library. Words without an approved matching picture remain readable text.

The browser and iPhone/iPad wrapper need one complete online installation before their full web interface is available offline. The existing basic native fallback remains available before that installation. Simulator checks establish local behavior; physical-device audio and production delivery require separate acceptance.
