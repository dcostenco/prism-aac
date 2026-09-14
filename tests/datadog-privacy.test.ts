import { webcrypto } from 'node:crypto';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import {
  anonymousDatadogUserId,
  DATADOG_RUM_PRIVACY_OPTIONS,
  rumBeforeSend,
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

  it('discards an event whose PHI sits in a field Datadog will not copy back', async () => {
    // error.causes and error.component_stack are NOT in the whitelist, so
    // redacting them is thrown away. Dropping is the only protection left.
    expect(
      await send({
        type: 'error',
        error: { message: 'upload failed', causes: [{ message: 'caption: Grandma Betty' }] },
      }),
    ).toBeNull();

    expect(
      await send({
        type: 'error',
        error: { message: 'render failed', component_stack: 'in Bar // said Grandma Betty' },
      }),
    ).toBeNull();
  });

  it('keeps cause chains and component stacks that carry no detected PHI', async () => {
    const sent = await send({
      type: 'error',
      error: {
        message: 'upload failed',
        causes: [{ message: 'network timeout' }],
        component_stack: 'in MessageBar',
      },
    });

    expect(sent).not.toBeNull();
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

describe('scrubPhi', () => {
  it('catches the PHI shapes an AAC user actually produces', () => {
    expect(scrubPhi('call mom@example.com')).toBe('call [EMAIL]');
    expect(scrubPhi('ring 555-123-4567')).toBe('ring [PHONE]');
    expect(scrubPhi('ring (555) 123-4567')).toBe('ring [PHONE]');
    expect(scrubPhi('ring 5551234567')).toBe('ring [PHONE]');
    expect(scrubPhi('born 03/14/1998')).toBe('born [DOB]');
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

