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

  it('wraps an array context so it can be copied back, instead of dropping the event', async () => {
    // limitModification copies `context` back only when the value it finds on
    // the CLONE is a plain object; an array is not. Scrubbing an array in place
    // is therefore a no-op — but REPLACING it with an object is copied back, so
    // the event survives and the PHI still goes. An earlier version discarded
    // the whole report on the false premise that nothing could be written back.
    const sent = await send({
      type: 'error',
      error: { message: 'x' },
      context: ['call Grandma Betty at 555-123-4567'],
    });

    expect(sent).not.toBeNull();
    expect(JSON.stringify(sent!.context)).not.toMatch(/Grandma|555-123-4567/);
    expect(sent!.context).toEqual({ items: ['call [NAME] at [PHONE]'] });
  });

  it('replaces context below the depth limit instead of shipping it unread', async () => {
    const deep = { message: 'call Grandma Betty at 555-123-4567' };
    let context: Record<string, unknown> = deep;
    for (let i = 0; i < 40; i++) context = { nested: context };

    const sent = await send({ type: 'error', error: { message: 'x' }, context });

    expect(JSON.stringify(sent!.context)).not.toContain('Grandma');
    expect(JSON.stringify(sent!.context)).not.toContain('555-123-4567');
    expect(JSON.stringify(sent!.context)).toContain('[REDACTED]');
  });

  it('does not discard an error whose cause merely contains an epoch timestamp', async () => {
    // The bare 10–11 digit rule must not be a drop criterion: a cache-buster
    // or a chunk line number would delete the whole error report.
    for (const message of ['cache bust ?v=1757800000', 'at chunk.js:1757800000:12']) {
      expect(
        await send({ type: 'error', error: { message: 'outer', causes: [{ message }] } }),
        message,
      ).not.toBeNull();
    }
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

  it('scrubs the whole Logs event, not just message', async () => {
    // The Logs SDK has no copy-back whitelist — beforeSend gets the live
    // object and everything it leaves alone ships. ddLog(message, context)
    // merges context keys into the TOP LEVEL of the event.
    const logsInit = vi.fn();
    vi.resetModules();
    vi.doMock('@datadog/browser-rum', () => ({ datadogRum: { init: vi.fn(), setUser: vi.fn() } }));
    vi.doMock('@datadog/browser-logs', () => ({
      datadogLogs: { init: logsInit, logger: { info: vi.fn() } },
    }));
    process.env.NEXT_PUBLIC_DD_CLIENT_TOKEN = 'test-token';

    const { initDatadog } = await import('@/lib/datadog');
    initDatadog();
    await vi.waitFor(() => expect(logsInit).toHaveBeenCalled());

    const config = logsInit.mock.calls[0][0] as { beforeSend?: (log: unknown) => boolean };
    const log = {
      message: 'spoke to Maria Gonzalez',
      caption: 'Grandma Betty',
      phone: '555-123-4567',
      error: { message: 'told Nurse Rivera', stack: 'Error: Grandma Betty\n  at x' },
    };
    expect(config.beforeSend!(log)).toBe(true);
    expect(JSON.stringify(log)).not.toMatch(/Maria|Grandma|Rivera|555-123-4567/);
    expect(log.error.stack).toContain('at x');

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
    // Quoted paths ('error.message', 'long_task.scripts[].invoker', …) AND bare
    // identifiers (context, service, version). The bare form must be discovered,
    // not enumerated: an earlier version of this guard matched the literal names
    // `context|service|version`, so it could only ever "find" paths already in
    // the list — adding `build_id` to ROOT_MODIFIABLE_FIELD_PATHS left it green,
    // which is precisely the drift it exists to catch.
    for (const [, quoted, bare] of source.matchAll(
      /(?:'([a-z_][a-zA-Z0-9_.[\]]*)'|\b([a-z_][a-zA-Z0-9_]*)):\s*'(?:string|object)'/g,
    )) {
      declared.add(quoted ?? bare);
    }

    expect(declared.size).toBeGreaterThan(10); // the scrape itself must not silently find nothing
    expect(declared).toContain('error.message'); // …and must reach the quoted form
    expect(declared).toContain('service'); // …and the bare form

    const handled = new Set<string>(SCRUBBABLE_PATHS.map(([path]) => path));
    // context is handled by scrubDeep rather than by path: objects are scrubbed
    // to SCRUB_DEPTH_LIMIT and replaced below it; an array context is dropped,
    // because the SDK never copies an array back. Both are tested above.
    handled.add('context');

    expect([...declared].filter((path) => !handled.has(path)).sort()).toEqual([]);
  });

  it('declares no path the SDK does not', async () => {
    // The converse direction. Without it, a fabricated entry sits in
    // SCRUBBABLE_PATHS forever: the exercise test below synthesises its event
    // from the path under test, so any well-formed path passes by construction.
    const { readFileSync } = await import('node:fs');
    const source = readFileSync(
      require.resolve('@datadog/browser-rum-core/cjs/domain/assembly.js'),
      'utf8',
    );

    // Key position only. Matching a quoted path anywhere in the file accepted
    // 'object' and 'string' — the type literals — as declared paths.
    const declaredAsKey = (path: string) => {
      // Full regex-metacharacter escape, backslash included. Escaping only the
      // three characters these paths happen to use was flagged by CodeQL
      // (js/incomplete-sanitization) — and would silently mis-match the first
      // path that ever carried anything else.
      const escaped = path.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      return new RegExp(`(?:'${escaped}'|\\b${escaped}):\\s*'(?:string|object)'`).test(source);
    };
    const unknown = SCRUBBABLE_PATHS.map(([path]) => path).filter((path) => !declaredAsKey(path));

    expect(declaredAsKey('object')).toBe(false); // the check must reject a type literal
    expect(unknown).toEqual([]);
  });

  it('walks every declared path down to the string', async () => {
    // This is a WALKER test, not a dead-entry test — it synthesises the event
    // from the path under test, so it cannot tell a fabricated path from a real
    // one (the test above does that). What it does catch is scrubStringAt
    // failing to reach a shape: drop single-segment handling and `service` /
    // `version` go unscrubbed with nothing else in this file noticing.
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
    expect(scrubPhi('my dob is 14.03.1998')).toBe('my dob is [DOB]'); // dot-separated
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

  it('redacts the whole run when an error word precedes a name', () => {
    // A pair-scan redacted `Error Maria` and shipped `Gonzalez`.
    expect(scrubPhi('Error Maria Gonzalez')).toBe('[NAME]');
    expect(scrubPhi('Uncaught Maria Gonzalez')).toBe('[NAME]');
    expect(scrubPhi('Session Maria Gonzalez Betty Frame')).toBe('[NAME]');
    expect(scrubPhi('Error: told Nurse Rivera')).toBe('Error: told [NAME]');
  });

  it('stops the birth-word date gap at sentence punctuation', () => {
    expect(scrubPhi('She was born. Build 2026-09-14 shipped')).toBe(
      'She was born. Build 2026-09-14 shipped',
    );
    expect(scrubPhi('birthday! Release 2026-09-14 ok')).toBe('birthday! Release 2026-09-14 ok');
    expect(scrubPhi('Date of birth: 14/03/1998')).toBe('Date of birth: [DOB]');
    expect(scrubPhi('DOB 14 03 1998')).toBe('DOB [DOB]');
    expect(scrubPhi('born on 2026-09-14T10:00:00Z')).toBe('born on [DOB]T10:00:00Z');
  });

  it('still redacts a date of birth that follows sentence punctuation', () => {
    // Banning .!?; from the gap to stop it crossing a sentence also lost the
    // shape OCR of a medical form produces. Both must hold at once.
    expect(scrubPhi('DOB. 14/03/1998')).toBe('DOB. [DOB]');
    expect(scrubPhi('born. 14/03/1998')).toBe('born. [DOB]');
    expect(scrubPhi('birthday! 14/03/1998')).toBe('birthday! [DOB]');
    expect(scrubPhi('dob; 14.03.1998')).toBe('dob; [DOB]');
    expect(scrubPhi('Patient; DOB; 14.03.1998')).toBe('Patient; DOB; [DOB]');
  });

  it('does not read three loose numbers after a birth word as a date', () => {
    expect(scrubPhi('born 1 2 3456')).toBe('born 1 2 3456');
    expect(scrubPhi('birth certificate 12345')).toBe('birth certificate 12345');
  });

  it('redacts a name joined by any space a PDF or paste can produce', () => {
    // Narrowing the separator to [ \t] to keep stack frames apart dropped every
    // other Unicode space with it. pdfjs text extraction and clipboard paste
    // routinely emit U+00A0 between words.
    for (const cp of [0x20, 0xa0, 0x202f, 0x2009, 0x3000, 0x09, 0x0b, 0x0c, 0x2028, 0x2029]) {
      const text = `call Grandma${String.fromCodePoint(cp)}Betty now`;
      expect(scrubPhi(text), `U+${cp.toString(16).toUpperCase().padStart(4, '0')}`).toBe(
        'call [NAME] now',
      );
    }
  });

  it('still does not join two stack frames into a name', () => {
    expect(scrubPhi('at Foo\nBar baz')).toBe('at Foo\nBar baz');
    expect(scrubPhi('at Foo\rBar baz')).toBe('at Foo\rBar baz');
  });

  it('redacts names outside ASCII', () => {
    // This app ships in 40 locales. An `[A-Z][a-z]` rule leaks every accented
    // or Cyrillic name while claiming to protect names.
    for (const name of ['María González', 'José Álvarez', 'Søren Jensen', 'Мария Иванова']) {
      expect(scrubPhi(name), name).toBe('[NAME]');
    }
  });

  it('uses no regex syntax that iOS 16.0 cannot parse', async () => {
    // lib/datadog.ts is statically imported by always-mounted components, and
    // the iOS deployment target is 16.0. Lookbehind is Safari 16.4+, so a
    // lookbehind here is a SyntaxError at module evaluation — the AAC app would
    // not start at all on 16.0–16.3. Nothing down-levels regex literals.
    //
    // This asserts on source text deliberately: Node parses lookbehind fine, so
    // no runtime assertion in this environment can observe the incompatibility.
    // The syntax IS the defect.
    //
    // Walk from the repo root with a denylist, rather than naming source
    // directories. Naming them is how this guard has been wrong twice: first it
    // read only lib/datadog.ts while services/mathProse.ts carried two, then it
    // named six directories and missed engine/ and constants/ — 63 files that
    // are imported ~100 times from the walked code and bundle to the client.
    // A denylist covers directories that do not exist yet.
    const { readdirSync, readFileSync, statSync } = await import('node:fs');
    const { join, resolve } = await import('node:path');

    const NOT_BUNDLED = new Set([
      'node_modules', '.next', '.git', '.vercel', '.turbo', 'out', 'dist', 'coverage',
      'tests', 'e2e', 'test-results', 'screenshots', 'public', 'docs', 'scripts',
      'ios-native', 'ios', 'supabase',
    ]);

    const root = process.cwd();
    const files: string[] = [];
    const seen = new Set<string>();
    const walk = (dir: string) => {
      const real = statSync(dir).ino + ':' + statSync(dir).dev;
      if (seen.has(real)) return; // a symlink cycle must not hang the suite
      seen.add(real);
      for (const entry of readdirSync(dir)) {
        if (NOT_BUNDLED.has(entry) || entry.startsWith('.')) continue;
        const full = join(dir, entry);
        if (statSync(full).isDirectory()) walk(full);
        else if (/\.(tsx?|mjs|cjs|js)$/.test(entry) && !/\.(test|spec|d)\./.test(entry)) {
          files.push(full);
        }
      }
    };
    walk(root);

    // The walk must reach the code, and must reach the two directories that
    // previous versions of this guard missed.
    expect(files.length).toBeGreaterThan(200);
    for (const required of [
      'lib/datadog.ts', 'services/mathProse.ts', 'middleware.ts',
    ]) {
      expect(files.some((f) => f === resolve(root, required)), required).toBe(true);
    }
    for (const dir of ['engine/', 'constants/']) {
      expect(files.some((f) => f.startsWith(resolve(root, dir))), dir).toBe(true);
    }

    const offenders = files.filter((f) => /\(\?<[=!]/.test(readFileSync(f, 'utf8')));
    expect(offenders.map((f) => f.slice(root.length + 1))).toEqual([]);
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

