import { webcrypto } from 'node:crypto';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import {
  anonymousDatadogUserId,
  DATADOG_RUM_PRIVACY_OPTIONS,
  rumBeforeSend,
  SCRUBBABLE_PATHS,
  scrubPhi,
} from '@/lib/datadog';

beforeAll(() => {
  Object.defineProperty(globalThis, 'crypto', {
    configurable: true,
    value: webcrypto,
  });
});

describe('Datadog AAC privacy boundary', () => {
  it('keeps performance telemetry without replay or automatic click capture', () => {
    expect(DATADOG_RUM_PRIVACY_OPTIONS).toEqual({
      sessionReplaySampleRate: 0,
      trackUserInteractions: false,
      defaultPrivacyLevel: 'mask',
    });
  });

  it('uses a stable one-way pseudonym instead of an email prefix', async () => {
    const first = await anonymousDatadogUserId('Person@example.com');
    const second = await anonymousDatadogUserId(' person@example.com ');

    expect(first).toBe(second);
    expect(first).toMatch(/^[a-f0-9]{24}$/);
    expect(first).not.toContain('Person');
    expect(first).not.toContain('example');
  });
});

/**
 * These tests drive the REAL Datadog pipeline, not `rumBeforeSend` directly.
 *
 * `limitModification` hands `beforeSend` a deep clone and copies back only the
 * paths in `modifiableFieldPathsByEvent`. A test that calls `rumBeforeSend` on
 * a plain object therefore passes for fields whose redaction the SDK throws
 * away — which is exactly how the first version of this scrubber shipped a
 * green suite while `error.causes` still left the device in cleartext.
 *
 * `send()` below reproduces assembly.js: clone → beforeSend → copy back only
 * the whitelisted paths → return what Datadog would actually transmit.
 */
describe('RUM PHI scrubbing survives Datadog\'s copy-back', () => {
  const ERROR_PATHS = {
    'error.message': 'string',
    'error.stack': 'string',
    'error.handling_stack': 'string',
    'error.resource.url': 'string',
    'error.fingerprint': 'string',
    context: 'object',
    'view.url': 'string',
    'view.referrer': 'string',
    'view.name': 'string',
  } as const;
  const RESOURCE_PATHS = { 'resource.url': 'string', context: 'object' } as const;

  /** Returns the event as Datadog would transmit it, or null if discarded. */
  async function send(
    event: Record<string, unknown>,
    paths: Record<string, string> = ERROR_PATHS,
  ): Promise<Record<string, unknown> | null> {
    const { limitModification } = await import(
      '@datadog/browser-rum-core/cjs/domain/limitModification.js'
    );
    let kept = true;
    limitModification(event, paths, (clone: Record<string, unknown>) => {
      kept = rumBeforeSend(clone);
      return kept;
    });
    return kept ? event : null;
  }

  it('redacts PHI in the fields Datadog copies back', async () => {
    const sent = await send({
      type: 'error',
      error: {
        message: 'speak failed for Maria Gonzalez',
        stack: 'Error: told Nurse Rivera at 555-123-4567\n  at speak()',
        handling_stack: 'Error\n  at ddError // caption was Grandma Betty',
        resource: { url: 'https://api.example.com/x?q=Maria%20Gonzalez&e=mom@example.com' },
      },
      context: { caption: 'Grandma Betty', dob: 'DOB 03/14/1998' },
    });

    const error = sent!.error as Record<string, string | Record<string, string>>;
    expect(error.message).toBe('speak failed for [NAME]');
    expect(error.stack).toBe('Error: told [NAME] at [PHONE]\n  at speak()');
    expect(error.handling_stack).not.toContain('Grandma Betty');
    expect((error.resource as Record<string, string>).url).toContain('[EMAIL]');
    expect(sent!.context).toEqual({ caption: '[NAME]', dob: 'DOB [DOB]' });
  });

  it('redacts the AAC word a pictogram lookup puts in a resource URL', async () => {
    // services/pictogramService.ts puts the word the user is composing into the
    // picture-symbol request path, and trackResources:true reports it.
    // Error-only scrubbing let this one straight through.
    //
    // `seizure` is the load-bearing part of this test: it is ordinary lowercase
    // vocabulary, so NO pattern in scrubPhi can recognise it. Only dropping the
    // path by host protects it. (An earlier version of this test used a
    // capitalised name, which the [NAME] rule caught — so it passed with the
    // host redaction deleted.)
    const sent = await send(
      {
        type: 'resource',
        resource: { url: 'https://api.arasaac.org/v1/pictograms/en/search/seizure' },
      },
      RESOURCE_PATHS,
    );

    expect((sent!.resource as Record<string, string>).url).toBe(
      'https://api.arasaac.org/[REDACTED]',
    );
  });

  it('leaves unrelated resource URLs intact', async () => {
    const sent = await send(
      { type: 'resource', resource: { url: 'https://synalux.ai/prism-aac/_next/static/app.js' } },
      RESOURCE_PATHS,
    );

    expect((sent!.resource as Record<string, string>).url).toBe(
      'https://synalux.ai/prism-aac/_next/static/app.js',
    );
  });

  it('discards an event whose structured PHI sits in a cause Datadog will not copy back', async () => {
    // error.causes is NOT in the whitelist, so redacting it is thrown away.
    // Dropping the event is the only protection left.
    expect(
      await send({
        type: 'error',
        error: { message: 'upload failed', causes: [{ message: 'called 555-123-4567' }] },
      }),
    ).toBeNull();

    expect(
      await send({
        type: 'error',
        error: { message: 'sync failed', causes: [{ stack: 'at x // ssn 123-45-6789' }] },
      }),
    ).toBeNull();
  });

  it('does NOT discard ordinary diagnostics that merely look capitalised', async () => {
    // Regression: the drop lever used the full scrubber, so the name heuristic
    // destroyed real error reports. A capitalised pair is nowhere near
    // confident enough to justify throwing away an error.
    for (const message of [
      'The Internet connection appears to be offline.',
      'Voice Clone upload failed',
      'Head Tracker lost the face',
      'Music Composer panel crashed',
      'in PhraseTile (created by Board Grid)',
      'Failed to load module next@16.3.3-canary.42',
    ]) {
      expect(
        await send({ type: 'error', error: { message: 'outer', causes: [{ message }] } }),
        message,
      ).not.toBeNull();
    }
  });

  it('scrubs the Long Animation Frame and LCP fields Datadog also copies back', async () => {
    // trackLongTasks is on, and LoAF attributes work to the resource that
    // caused it — so a pictogram lookup URL reaches Datadog here too.
    const longTask = await send(
      {
        type: 'long_task',
        long_task: {
          scripts: [
            {
              invoker: 'https://api.arasaac.org/v1/pictograms/en/search/seizure',
              source_url: 'https://synalux.ai/x.js?caller=Grandma%20Betty',
            },
          ],
        },
      },
      { 'long_task.scripts[].invoker': 'string', 'long_task.scripts[].source_url': 'string' },
    );
    const script = (longTask!.long_task as { scripts: Record<string, string>[] }).scripts[0];
    expect(script.invoker).toBe('https://api.arasaac.org/[REDACTED]');
    expect(script.source_url).not.toContain('Grandma');

    const view = await send(
      {
        type: 'view',
        view: {
          performance: {
            lcp: { resource_url: 'https://api.arasaac.org/v1/pictograms/en/search/seizure' },
          },
        },
      },
      { 'view.performance.lcp.resource_url': 'string' },
    );
    const lcp = (view!.view as { performance: { lcp: { resource_url: string } } }).performance.lcp;
    expect(lcp.resource_url).toBe('https://api.arasaac.org/[REDACTED]');
  });

  it('scrubs graphql variables and resource headers', async () => {
    const sent = await send(
      {
        type: 'resource',
        resource: {
          graphql: { variables: '{"to":"Grandma Betty"}' },
          response: { headers: { 'x-caption': 'Grandma Betty' } },
        },
      },
      {
        'resource.graphql.variables': 'string',
        'resource.request.headers': 'object',
        'resource.response.headers': 'object',
      },
    );
    const resource = sent!.resource as {
      graphql: { variables: string };
      response: { headers: Record<string, string> };
    };
    expect(resource.graphql.variables).toBe('{"to":"[NAME]"}');
    expect(resource.response.headers['x-caption']).toBe('[NAME]');
  });

  it('is actually wired into datadogRum.init, not just exported', async () => {
    // An unreferenced scrubber still compiles and still leaks. Assert the
    // config RUM is initialised with carries it.
    const init = vi.fn();
    vi.resetModules();
    vi.doMock('@datadog/browser-rum', () => ({ datadogRum: { init, setUser: vi.fn() } }));
    vi.doMock('@datadog/browser-logs', () => ({
      datadogLogs: { init: vi.fn(), logger: { info: vi.fn() } },
    }));
    process.env.NEXT_PUBLIC_DD_CLIENT_TOKEN = 'test-token';
    process.env.NEXT_PUBLIC_DD_APPLICATION_ID = 'test-app';

    const { initDatadog } = await import('@/lib/datadog');
    initDatadog();
    await vi.waitFor(() => expect(init).toHaveBeenCalled());

    const config = init.mock.calls[0][0] as { beforeSend?: (event: unknown) => boolean };
    expect(config.beforeSend).toBeTypeOf('function');

    const event = { error: { message: 'spoke to Maria Gonzalez' } };
    config.beforeSend!(event);
    expect(event.error.message).toBe('spoke to [NAME]');

    vi.doUnmock('@datadog/browser-rum');
    vi.doUnmock('@datadog/browser-logs');
    vi.resetModules();
  });
});

describe('SCRUBBABLE_PATHS covers what the installed SDK copies back', () => {
  // The list in lib/datadog.ts is a hand-copy of the SDK's
  // `modifiableFieldPathsByEvent`. A hand-copy drifts: the first version of it
  // silently missed long_task.scripts[].invoker/source_url,
  // view.performance.lcp.resource_url, resource.graphql.variables and the
  // resource header objects — every one of them a path the SDK WOULD have
  // copied back, so every one a field beforeSend could have protected and did
  // not. Read the installed SDK and fail on any path we do not handle.
  it('handles every modifiable path the SDK declares', async () => {
    const { readFileSync } = await import('node:fs');
    const source = readFileSync(
      require.resolve('@datadog/browser-rum-core/cjs/domain/assembly.js'),
      'utf8',
    );

    const declared = new Set<string>();
    for (const [, path] of source.matchAll(/'([a-z_][a-zA-Z0-9_.[\]]*)':\s*'(?:string|object)'/g)) {
      declared.add(path);
    }
    // Bare identifiers in the same maps: context / service / version.
    for (const [, path] of source.matchAll(/^\s{4}(context|service|version):\s*'/gm)) {
      declared.add(path);
    }

    expect(declared.size).toBeGreaterThan(10); // the scrape itself must not silently find nothing

    const handled = new Set<string>(SCRUBBABLE_PATHS.map(([path]) => path));
    handled.add('context'); // scrubbed wholesale by scrubDeep, not by path

    expect([...declared].filter((path) => !handled.has(path)).sort()).toEqual([]);
  });

  it('has no entry that no test exercises', async () => {
    // Guards against dead entries: every declared path must actually reach a
    // string through scrubStringAt. Build a synthetic event per path, scrub it,
    // and require the PHI to be gone.
    for (const [path, kind] of SCRUBBABLE_PATHS) {
      const probe = kind === 'url' ? 'https://x.test/Grandma%20Betty' : 'Grandma Betty';
      const event: Record<string, unknown> = {};
      let node = event;
      const segments = path.split(/\.|(?=\[\])/).filter(Boolean);
      segments.forEach((segment, i) => {
        const last = i === segments.length - 1;
        if (segment === '[]') {
          const arr: unknown[] = [last ? probe : {}];
          // replace the parent key's value with the array
          const parentKey = segments[i - 1];
          (node as Record<string, unknown>)[parentKey] = arr;
          node = arr[0] as Record<string, unknown>;
          return;
        }
        if (last) node[segment] = kind === 'object' ? { k: probe } : probe;
        else if (segments[i + 1] !== '[]') node = node[segment] = {} as Record<string, unknown>;
        else node[segment] = {};
      });

      rumBeforeSend(event);
      expect(JSON.stringify(event), `${path} was not scrubbed`).not.toContain('Grandma Betty');
      expect(JSON.stringify(event), `${path} was not scrubbed`).not.toContain('Grandma%20Betty');
    }
  });
});

describe('scrubPhi', () => {
  it('catches the PHI shapes an AAC user actually produces', () => {
    expect(scrubPhi('call mom@example.com')).toBe('call [EMAIL]');
    expect(scrubPhi('ring 555-123-4567')).toBe('ring [PHONE]');
    expect(scrubPhi('ring (555) 123-4567')).toBe('ring [PHONE]');
    expect(scrubPhi('ring 5551234567')).toBe('ring [PHONE]');
    expect(scrubPhi('born 03/14/1998')).toBe('born [DOB]');
    expect(scrubPhi('born 14/03/1998')).toBe('born [DOB]'); // day-first
    expect(scrubPhi('DOB: 1998-03-14')).toBe('DOB: [DOB]'); // ISO
    expect(scrubPhi('ssn 123-45-6789')).toBe('ssn [SSN]');
    expect(scrubPhi('tell Maria Gonzalez')).toBe('tell [NAME]');
    expect(scrubPhi('ask Nurse Rivera')).toBe('ask [NAME]');
  });

  it('leaves the real production error vocabulary readable', () => {
    // Every distinct error message prism-aac emitted to RUM in the 30 days to
    // 2026-09-14. These are why the telemetry exists — scrubbing must not
    // reduce them to [NAME].
    for (const message of [
      '[PoseTracker] Camera acquire failed (permission denied or no device).',
      'INFO: Created TensorFlow Lite XNNPACK delegate for CPU.',
      'wasm streaming compile failed: TypeError: Load failed',
      'falling back to ArrayBuffer instantiation',
      'The HTMLInputElement.value setter can only be used on instances of HTMLInputElement',
      '[service-worker] registration failed TypeError: Script load failed',
      "undefined is not an object (evaluating '[...document.querySelectorAll('button')]')",
    ]) {
      expect(scrubPhi(message)).toBe(message);
    }
  });

  it('redacts a name even when one half collides with error vocabulary', () => {
    // Regression: the technical stop-list originally spared a pair if EITHER
    // word was technical. `Cross` and `Frame` are ordinary surnames, so
    // `Maria Cross` and `David Cross` — plain person names — shipped in
    // cleartext. Both words must be technical for a pair to survive.
    for (const name of [
      'Maria Cross',
      'David Cross',
      'Betty Frame',
      'Camera Rivera',
      'Betty Network',
      'Web Betty',
      'Token Rivera',
    ]) {
      expect(scrubPhi(name), name).toBe('[NAME]');
    }
  });

  it('does not mangle package@version or run-on decimals', () => {
    // The email rule read `next@16.3.3-canary` as an address and the phone rule
    // read `123.456 789.0123` as a number, in an app whose live error
    // vocabulary is full of both.
    for (const message of [
      'Failed to load module next@16.3.3-canary.42',
      'tesseract.js@7.0.0-rc.1 failed to init',
      '@huggingface/transformers@3.1.0-alpha loaded',
      'perf 123.456 789.0123 ms',
      'ETag: W/"abc-123.456 789.0123"',
      'build 2026-09-14 ok',
    ]) {
      expect(scrubPhi(message), message).toBe(message);
    }
  });

  it('does not redact standard error vocabulary as a person', () => {
    for (const message of [
      'Network Error',
      'Script Error',
      'Load Failed',
      'Access Denied',
      'Not Found',
      'Request Timeout',
      'Content Security Policy violation',
      'Speech Synthesis unavailable',
      'Service Worker registration failed',
    ]) {
      expect(scrubPhi(message)).toBe(message);
    }
  });
});

