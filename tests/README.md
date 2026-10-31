# Local backend tests

Ordinary `npm test` runs the model-management request contracts with fixtures.
It does not start local model inference, pull weights, or delete installed models.

To request the live Ollama checks:

```sh
PRISM_LIVE_LOCAL_TESTS=1 npx vitest run tests/local-ai-settings.test.ts tests/cascade-live.test.ts
```

The live checks read `prism local status` and use its saved Ollama coder and
reviewer assignments. They run only when Prism explicitly selects Ollama;
an oMLX or Auto selection skips these Ollama-specific checks. Missing or
invalid configuration fails visibly. Set `PRISM_CLI` if the Prism executable
is not on PATH. `OLLAMA_URL` can select another loopback endpoint.

The configured models must already be installed. Generation requests use
`keep_alive: 0` to avoid retaining the test model after the request.

`RUN_LOCAL_CORRECT=1 npx vitest run tests/text-correct.integration.test.ts`
uses the same saved-backend check for offline text correction.
