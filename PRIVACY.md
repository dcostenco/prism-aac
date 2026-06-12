# Privacy Policy — Prism AAC

**Last updated:** 2026-05-12

## Summary

Prism AAC is designed for children with communication disabilities. Privacy and data safety are non-negotiable.

- **No ads, no tracking, no analytics** in the free tier
- **No data leaves the device** unless the user explicitly enables cloud features (AI chat, contact sync, messaging)
- **PHI (Protected Health Information)** is never logged and never transmitted without encryption. Local data (notes, vocabulary, settings) is stored in the browser's localStorage and relies on device-level encryption (FileVault on macOS, Data Protection on iOS). The caregiver PIN is hashed with SHA-256 and a per-device salt — the PIN itself is never stored
- **Children's data** is handled in compliance with COPPA (US), GDPR Article 8 (EU), and PIPEDA (Canada)

## What data we collect

### Free tier (no account required)
- **Nothing.** The app runs entirely in your browser or on your device. No server communication occurs. All settings, vocabulary, and usage data stay in local storage.

### Paid tier (Synalux account required)
When you create a Synalux account and enable cloud features:

| Data | Purpose | Storage | Retention |
|------|---------|---------|-----------|
| Email address | Account identity | Synalux servers (encrypted) | Until account deletion |
| Vocabulary preferences | Cloud sync across devices | Synalux servers (encrypted) | Until account deletion |
| AI chat messages | Cloud AI processing | Processed in memory, not stored | Not retained after response |
| Contact list | Messaging (AAC Chat) | Device Keychain + Synalux servers | Until removed by caregiver |
| OAuth tokens | Provider integration (Gmail, etc.) | Synalux servers (encrypted) | Until disconnected |

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
- Store AI conversation history on our servers
- Access the device camera/microphone without explicit permission
- Transmit any data without TLS 1.3 encryption

## Data deletion

To delete all your data:
1. **Free tier:** Clear browser data or delete the app
2. **Paid tier:** Email privacy@synalux.ai or use Settings > Account > Delete Account

We delete all server-side data within 30 days of a deletion request.

## Children's privacy (COPPA / GDPR)

- Prism AAC does not collect personal information from children under 13 without verifiable parental consent
- The caregiver (parent, teacher, BCBA) manages the account and all settings
- The AAC user (child) interacts only with the communication interface — they cannot access account settings, billing, or contact management without the caregiver PIN

## Contact

For privacy questions: privacy@synalux.ai

For the full Synalux platform privacy policy: [synalux.ai/privacy](https://synalux.ai/privacy)
