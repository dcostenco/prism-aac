# Publishing to the Chrome Web Store

End-to-end checklist for going from `git pull` to "Available in the Chrome Web Store". The build/zip steps are automated; the upload + review steps are interactive.

---

## One-time setup

1. **Pay the $5 Chrome Web Store developer fee** (one-time, per Google account):
   `https://chrome.google.com/webstore/devconsole/register`

2. **Host the privacy policy publicly.** The Web Store listing requires a publicly-reachable URL. Either:
   - Push `PRIVACY.md` to GitHub (already done — link to the rendered Markdown), OR
   - Publish to GitHub Pages at e.g. `https://dcostenco.github.io/prism-aac/privacy.html`

   The current canonical URL is:
   `https://github.com/dcostenco/prism-aac/blob/main/chrome-extension/PRIVACY.md`

---

## Per-release flow

### 1. Build the package

```sh
cd chrome-extension
npm install            # first time only
npm run package
```

This produces:
- `dist/` — unpacked extension (also for `chrome://extensions` → Load unpacked)
- `prism-aac-ext-vX.Y.Z.zip` — the file you upload to the Web Store

### 2. Open the developer dashboard

`https://chrome.google.com/webstore/devconsole`

### 3. First time only: create the item

Click **+ New item** → upload `prism-aac-ext-vX.Y.Z.zip` → wait for the dashboard to inflate it.

### 4. Fill the listing

Open `chrome-extension/STORE-LISTING.md` — it has the exact copy for every required field:
- Name, short description, detailed description
- Category (Accessibility), language
- Single purpose statement
- Permission justifications
- Privacy practices form answers

Paste each field into the matching dashboard input.

### 5. Generate assets — `npm run assets`

Builds:

- `store-screenshots/screenshot-{1,2,3}.png` — 1280×800 PNG, ready to drop into the Web Store dashboard. Composite renders of the overlay over a demo compose page (English speak, Romanian translate-mode, options page).
- `store-promo/small-promo-tile.png` — 440×280 promo tile.
- `store-promo/marquee-promo-tile.png` — 1400×560 marquee tile.
- `store-video/promo.webm` + `promo.mp4` (if `ffmpeg` is installed) — ~40 s demo loop covering title → speak → translate → options → outro.

All output goes under `chrome-extension/store-{screenshots,promo,video}/` (gitignored — per-release artifacts).

Drop the 3 screenshots into the dashboard's **Screenshots** slot. Drop the small + marquee promo tiles into their slots (both optional but make the listing look polished).

### 5a. Upload the promo video to YouTube (optional)

1. Open YouTube Studio → **+ Create** → **Upload video** → pick `store-video/promo.mp4` (or `.webm`).
2. Title: `PrismAAC Reading Assistant — speak as you type, in any text field`.
3. Description: copy from `STORE-LISTING.md` detailed description.
4. Visibility: **Unlisted** is fine (the Web Store listing makes the link discoverable; you don't need it on YouTube search).
5. Copy the YouTube URL (`https://youtu.be/<id>`) and paste into the dashboard's **Global promo video → YouTube URL** field.

### 6. Privacy practices form

Use the answers under "Privacy practices form" in `STORE-LISTING.md`. The privacy URL is the GitHub-rendered `PRIVACY.md`.

### 7. Submit for review

Click **Submit for review**. First-time submissions take 1-3 business days; subsequent updates are usually under 24 hours.

---

## Subsequent updates

1. Bump `manifest.json` `"version"` (semver, e.g. `0.1.0` → `0.1.1`).
2. `npm run package`.
3. Dashboard → click your item → **Package** tab → **Upload new package** → upload the new zip.
4. Update the listing if any user-facing copy changed.
5. **Submit for review** again.

---

## Things to know

- **Sourcemaps and minification:** `--package` mode strips sourcemaps and minifies (~3× smaller upload). Dev builds keep both.
- **`.gitignore`** excludes `dist/` and the generated `.zip` so they don't bloat the repo. Each release's zip is a transient artifact you upload then can delete.
- **Permissions changes** require re-review (sometimes a slower one). Adding hosts is the most common trigger.
- **MV3 `host_permissions: ["<all_urls>"]`** is reviewed carefully because it can be misused. Our justification (in `STORE-LISTING.md`) explains: the content script only reads the focused field, only on user trigger, and never exfiltrates data. The translate path is opt-in and goes only to `translate.googleapis.com`.

## Troubleshooting

| Symptom | Likely cause |
|---|---|
| Dashboard rejects the zip | Manifest path wrong — verify `manifest.json` is at the ZIP root (it is, per our `build.mjs`) |
| Reviewer asks for clarification | Re-read the permission justifications in `STORE-LISTING.md`; respond inside the dashboard's chat |
| "Single purpose" complaint | Tighten the single-purpose sentence to one task; ours focuses on speaking text from inputs (everything else is in service of that) |
| Privacy policy URL not loading | Make sure the GitHub link is to the rendered Markdown, not the raw `.md` file (or use a GitHub Pages page) |
