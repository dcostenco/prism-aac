# Persistent speech cache

Shipped in 1.9.0 (web and iOS build 53, 2026-09-08). Cached playback is free:
it never checks the Cloud subscription and never counts against its allowance.

`services/azureTTS.ts` keeps the existing 30-clip memory cache and checks
`SpeechAudioCache` before making a synthesis request. `speechService.ts` also
checks saved audio while offline; a miss continues to the existing local speech
path. Cached playback does not check a paid entitlement or send a provider request.

The initial persistent budget is 20 MiB per browser origin, at most 512 clips,
1 MiB per clip, and 30 days of retention. Least recently used clips are evicted.
Storage operations time out after 250 ms and fail open. These limits live in
`SPEECH_CACHE_POLICY`. There is no background synthesis or shared public cache.

Only successfully decoded responses with provider, resolved voice, model/API
identity and format metadata are retained on disk. Inworld and directly selected
Azure audio use the same store. Responses marked as provider/language/gender
fallback are played but not retained as the requested voice. The request key
includes the endpoint, exact input, language, tone, rate, volume and selected
voice; its version must be bumped if synthesis semantics change. Provider model
revisions that are not published cannot be inferred while offline.

Keys and account scopes are SHA-256 digests. Audio remains personal content, not
encrypted or anonymized data. It stays in the browser's private origin storage.
Authenticated accounts have separate scopes; anonymous users share the guest
scope on that device. A signed-in account whose identity has not been restored
after an offline restart cannot retrieve its account-scoped clips; the local
speech path remains available. Do not describe this candidate as full signed-in
offline restart support.

Settings → Voice provides usage, clear and retention controls. Turning retention
off clears the disk cache and stops new disk writes; temporary memory reuse stays
available. Clear invalidates pending writes from this service instance. A separate
open tab can subsequently save new audio. Browser eviction and private browsing
can prevent persistence. Clearing a cache never deletes boards or vocabulary.

The portal public TTS route must expose `X-TTS-Backend`, `X-TTS-Voice`,
`X-TTS-Model` and fallback flags through CORS. The paired portal change adds those
headers while preserving `Cache-Control: no-store`. Deploy that compatible
metadata change before enabling the client candidate. Without the headers,
ordinary speech and memory reuse continue, but responses are not saved to disk.

Datadog `aac_speech_cache` actions report memory hits, disk hits, online misses
and offline misses; successful cache events include playback-start latency.
Their payload contains no utterance, account, voice name or cache key. Misses
are not billable synthesis counts. Eviction/provider cost dashboards and actual
savings measurement are subsequent work.

Automated coverage exercises persistence with real IndexedDB emulation, profile
separation, changed request settings, LRU/byte/count limits, expiry, unavailable
storage, stalled storage, clearing during synthesis, corrupt audio, and Stop
during a pending lookup. Browser tests use valid WAV fixtures with Inworld/Azure
metadata, actual browser decoding and audio-source starts, reload, offline reuse
without another request, and the settings controls. Fixtures do not prove live
provider output or physical audibility.

Known limits at 1.9.0: signed-in offline restart (account-scoped clips are not
retrievable until identity is restored), full offline PWA boot, cross-tab
retention semantics and saved-phrase pinning are still open; the settings copy is
localized in all 28 locales.
