# Prism TTS benchmark

This benchmark measures transport latency and reliability for raw-audio HTTP
TTS endpoints. It does not claim that a voice is natural or clinically
acceptable; listening tests are a separate required gate.

## Endpoint contract

The endpoint must accept:

```json
{ "text": "I need help", "locale": "en-US" }
```

and return streamed raw audio with an `audio/*` or
`application/octet-stream` content type. Field names can be changed with
`--text-field` and `--locale-field`. Provider credentials are read from an
environment variable named by `--bearer-env`; the token is never written to
the output artifact.

## Run

```bash
npm run benchmark:tts -- \
  --provider chatterbox-local \
  --endpoint http://127.0.0.1:8000/synthesize \
  --runs 5 \
  --concurrency 1
```

Filter a smoke run:

```bash
npm run benchmark:tts -- \
  --provider candidate \
  --endpoint http://127.0.0.1:8000/synthesize \
  --locales en,es \
  --cases aac-word,aac-help \
  --runs 3
```

Run the required concurrency test only against infrastructure sized for it:

```bash
npm run benchmark:tts -- \
  --provider candidate \
  --endpoint https://candidate.example/synthesize \
  --runs 3 \
  --concurrency 50 \
  --bearer-env TTS_BENCH_TOKEN
```

Outputs default to a unique file under `/tmp`. Existing files are not replaced
unless `--overwrite` is explicit.

## Required decision evidence

For every candidate and current Inworld baseline, retain:

- warm and cold time to first audio byte (TTFA), total latency, error rate, and
  audio byte count;
- 50-concurrent soak results from representative infrastructure;
- native-speaker mean-opinion-score (MOS) sheets for each production locale;
- device results for AAC word taps and explicit sentences;
- provider-native phone results for Twilio primary and Vonage backup.

Do not infer voice quality from transport metrics. The two Traditional Chinese
corpus variants are explicitly marked `native-review-required`; other
translations are code-derived and still need native-speaker listening review.
