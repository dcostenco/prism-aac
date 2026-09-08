# Privacy Policy — Prism AAC

**Last updated:** 2026-09-08

## Summary

Prism AAC is designed for children with communication disabilities. Privacy and data safety are non-negotiable.

- **No ads, no advertising profiles, no sale of data** — on any plan
- **Communication content stays on the device** unless you use a cloud feature: cloud speech (text you ask to be spoken is sent to the voice provider and not stored), cloud AI chat, contact sync, messaging
- **Product analytics:** the app reports anonymous usage and error telemetry (see below); it never contains what you typed or said
- **PHI (Protected Health Information)** is never logged and never transmitted without encryption. Local data (notes, vocabulary, settings) is stored in the browser's localStorage and relies on device-level encryption (FileVault on macOS, Data Protection on iOS). The caregiver PIN is hashed with SHA-256 and a per-device salt — the PIN itself is never stored
- **Children's data** is handled in compliance with COPPA (US), GDPR Article 8 (EU), and PIPEDA (Canada)

## What data we collect

### Without an account (Free)
Settings, vocabulary, boards, schedule, caregiver notes and the speech cache stay in local storage on the device. The app does talk to Synalux servers for these features when online:

| Feature | What is sent | Stored? |
|------|---------|-----------|
| Cloud speech (natural voice) | The text to speak, language, voice and rate | Not stored; the generated audio is cached only on your device |
| Cloud AI (chat, autocorrect, word prediction) | The text of the request | Processed in memory, not retained after the response |
| Safety word list, model downloads | Nothing personal — a plain download | — |
| Emergency alert (if configured) | The alert message and the caregiver contact you configured | Delivered through the emergency path described in docs/EMERGENCY-NATIVE-ARCHITECTURE.md |

Rate limits are applied per IP address; IP addresses are not linked to a person.

### Usage analytics (all plans)
The web app and the iOS app report usage, error and performance telemetry to Datadog (a processor in the US): sessions, screens and features used, errors, crash reports on iOS, performance timings, language, country, device and browser type, and the plan tier. Anonymous sessions carry no user identifier. A signed-in session is tagged with a truncated one-way SHA-256 hash of the account email (not the email itself) and the plan tier, so support can count affected users for a problem you report. The iOS app also sends app-event telemetry (feature usage and errors, no content) to Synalux, where it is stored in the Synalux database for troubleshooting. Telemetry never includes typed text, spoken phrases, board contents, notes or contacts. Datadog keeps its copy for its standard retention period; Synalux's copy is retained for troubleshooting and is not linked to communication content.

### With a Synalux account
When you sign in (Sign in with Apple on iOS; Google or email + password on the web) and use cloud features:

| Data | Purpose | Storage | Retention |
|------|---------|---------|-----------|
| Email address | Account identity | Synalux servers (encrypted) | Until account deletion |
| Vocabulary preferences | Cloud sync across devices | Synalux servers (encrypted) | Until account deletion |
| AI chat messages | Cloud AI processing | Processed in memory, not stored | Not retained after response |
| Contact list | Messaging (AAC Chat) | Device Keychain + Synalux servers | Until removed by caregiver |
| OAuth tokens | Provider integration (Gmail, etc.) | Synalux servers (encrypted) | Until disconnected |
| Apple sign-in identifier | Account identity on iOS | Synalux servers (encrypted); Apple token in the device Keychain | Until account deletion |

### Prism AAC Cloud subscription
If you subscribe to the optional Cloud plan:

| Data | Purpose | Storage | Retention |
|------|---------|---------|-----------|
| Apple: transaction and subscription identifiers, product, environment, status, expiry | Recognize and renew the purchase on your account | Synalux servers | Until account deletion |
| Web: Stripe customer and subscription identifiers | Same, for web purchases | Synalux servers and Stripe | Until account deletion |
| Monthly usage counters | Enforce the 50,000-character / 100-request allowance | Synalux servers: per request a random id, kind (speech or AI), unit count and month — never the text | Until account deletion |

Payment card details are handled by Apple or Stripe and never reach Synalux. Nothing about the subscription is shared with the voice or AI providers.

### Speech cache (on your device)
Generated speech is saved in the browser's private storage (IndexedDB) so it can replay without a network request: up to 20 MiB, 512 clips, 30 days, least-recently-used eviction. Signed-in accounts and the anonymous guest scope are stored separately. Settings → Voice shows usage and offers Clear and retention off. Clearing the cache never deletes boards or vocabulary.

### Apple Watch
- Emergency dispatch messages are sent via HTTPS with SPKI certificate pinning
- Auth tokens stored in device Keychain (not iCloud Keychain)
- No Watch data syncs to iCloud

### Local storage (browser / PWA)
- Caregiver notes, vocabulary, settings, and schedule data are stored in the browser's `localStorage`
- This data relies on the operating system's disk encryption (iOS Data Protection, macOS FileVault, Android full-disk encryption) — the app does not add a second encryption layer
- On shared or unencrypted devices, local data is accessible to anyone with physical access
- The caregiver PIN prevents UI access but does not encrypt the underlying storage
- To remove all local data: clear browser data or delete the PWA

## What we never do

- Sell or share personal data with third parties
- Use data for advertising or profiling
- Store AI conversation history or spoken text on our servers
- Access the device camera/microphone without explicit permission
- Transmit any data without TLS 1.3 encryption

## Data deletion

To delete all your data:
1. **Without an account:** clear browser data or delete the app (this also clears the speech cache)
2. **With an account:** email privacy@synalux.ai or use Settings > Synalux Account > Delete Account. An active Cloud subscription must be cancelled with Apple or through Manage subscription; deleting the account does not refund it.

We delete all server-side data within 30 days of a deletion request.

## Children's privacy (COPPA / GDPR)

- Prism AAC does not collect personal information from children under 13 without verifiable parental consent
- The caregiver (parent, teacher, BCBA) manages the account and all settings
- The AAC user (child) interacts only with the communication interface — they cannot access account settings, billing, or contact management without the caregiver PIN

## Contact

For privacy questions: privacy@synalux.ai

For the full Synalux platform privacy policy: [synalux.ai/privacy](https://synalux.ai/privacy)
