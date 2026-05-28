# Prism AAC — App Store Preview Video

**Duration**: 30 seconds | **Resolution**: 1290x2796 | **Format**: H.264 High, 30fps

## Scene Breakdown

| # | Time | Screen | Title Overlay | Subtitle Overlay |
|---|------|--------|---------------|------------------|
| 1 | 0:00-0:03 | Home screen | Every Person Deserves a Voice | Prism AAC — Free Forever |
| 2 | 0:03-0:06 | Categories (Help) | Tap to Speak | Quick phrases for Help, Food, Places & more |
| 3 | 0:06-0:09 | Keyboard typing | Type & Speak | AI predictions in 12 languages |
| 4 | 0:09-0:12 | AI Chat | AI Assistant | Help composing messages & conversations |
| 5 | 0:12-0:15 | Bedside Mode | Bedside Mode | Hospital-ready pain scale & nurse call |
| 6 | 0:15-0:18 | Schedule | Daily Schedule | Visual routines for every day |
| 7 | 0:18-0:21 | Games | Learning Games | Math, spelling & reading built in |
| 8 | 0:21-0:24 | School subjects | School Subjects | Adaptive learning for every student |
| 9 | 0:24-0:27 | Settings/Languages | 12 Languages | English, Spanish, French, Russian & 8 more |
| 10 | 0:27-0:30 | Marketplace | Marketplace | Community phrase packs — free |

## Languages Supported (shown in scene 9)

English, Spanish, French, Portuguese, Romanian, Ukrainian, Russian, German, Japanese, Korean, Chinese (Simplified), Arabic

## TTS Voice

Production app uses Inworld TTS-2 (natural voice) as Tier 1, with OS Web Speech API premium voices as Tier 2 fallback, and WASM espeak-ng as last resort.

## Files

- `prism_aac_app_preview.mp4` — final 30s video for App Store
- `frame_00.png` through `frame_09.png` — individual frames with text overlays
- Source screenshots at `../iphone_*.png` and `../ipad_*.png`

## Regeneration

```bash
cd ~/prism-aac
node record_full.cjs          # Record raw screen capture
python3 /tmp/video_script.py  # Add text overlays + concat
```
