let initialized = false;

export const DATADOG_RUM_PRIVACY_OPTIONS = {
  sessionReplaySampleRate: 0,
  trackUserInteractions: false,
  defaultPrivacyLevel: 'mask' as const,
};

export function initDatadog() {
  if (initialized) return;
  if (typeof window === 'undefined') return;

  const clientToken = process.env.NEXT_PUBLIC_DD_CLIENT_TOKEN;
  const applicationId = process.env.NEXT_PUBLIC_DD_APPLICATION_ID;
  const site = process.env.NEXT_PUBLIC_DD_SITE || 'datadoghq.com';
  const env = process.env.NODE_ENV === 'production' ? 'production' : 'development';

  if (!clientToken) return;

  import('@datadog/browser-logs').then(({ datadogLogs }) => {
    datadogLogs.init({
      clientToken,
      site,
      service: 'prism-aac',
      env,
      forwardErrorsToLogs: false, // HIPAA: prevent stack traces containing PHI from leaking to Datadog
      // Explicit ddLog/ddError calls own the operational signal. Console
      // messages can contain AAC text, so they must never be forwarded.
      forwardConsoleLogs: [],
      sessionSampleRate: 100,
      beforeSend: (log) => {
        // HIPAA: Scrub potential PHI patterns before forwarding to Datadog cloud
        if (log.message) {
          log.message = log.message
            .replace(/\b\d{3}-\d{2}-\d{4}\b/g, '[SSN]')
            .replace(/\b\d{10,11}\b/g, '[PHONE]')
            .replace(/\b[A-Z][a-z]+ [A-Z][a-z]+\b/g, '[NAME]');
        }
        return true;
      },
    });
  });

  if (applicationId) {
    import('@datadog/browser-rum').then(({ datadogRum }) => {
      datadogRum.init({
        applicationId,
        clientToken: clientToken!,
        site,
        service: 'prism-aac',
        env,
        version: process.env.NEXT_PUBLIC_BUILD_ID || '0.0.0',
        sessionSampleRate: 100,
        // AAC interaction text is potentially PHI. Keep performance/error
        // telemetry, but never record sessions or automatic click metadata.
        sessionReplaySampleRate: DATADOG_RUM_PRIVACY_OPTIONS.sessionReplaySampleRate,
        trackUserInteractions: DATADOG_RUM_PRIVACY_OPTIONS.trackUserInteractions,
        trackResources: true,
        trackLongTasks: true,
        defaultPrivacyLevel: DATADOG_RUM_PRIVACY_OPTIONS.defaultPrivacyLevel,
      });
    });
  }

  initialized = true;
}

export async function anonymousDatadogUserId(value: string): Promise<string | null> {
  if (typeof crypto === 'undefined' || !crypto.subtle) return null;

  const digest = await crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(value.trim().toLowerCase()),
  );

  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('')
    .slice(0, 24);
}

export function ddSetUser(user: {
  id: string;
  name?: string;
  email?: string;
  plan?: string;
}) {
  if (typeof window === 'undefined') return;
  import('@datadog/browser-rum').then(({ datadogRum }) => {
    datadogRum.setUser({
      id: user.id,
      name: user.name,
      email: user.email,
      plan: user.plan,
    });
  }).catch(() => {});
}

export function ddAction(name: string, context?: Record<string, unknown>) {
  if (typeof window === 'undefined') return;
  import('@datadog/browser-rum').then(({ datadogRum }) => {
    datadogRum.addAction(name, context);
  }).catch(() => {});
}

export function ddError(error: unknown, context?: Record<string, unknown>) {
  if (typeof window === 'undefined') return;
  import('@datadog/browser-rum').then(({ datadogRum }) => {
    datadogRum.addError(error instanceof Error ? error : new Error(String(error)), context);
  }).catch(() => {});
}

export function ddLog(
  message: string,
  context?: Record<string, unknown>,
  level: 'info' | 'warn' | 'error' = 'info',
) {
  if (typeof window === 'undefined') return;
  import('@datadog/browser-logs').then(({ datadogLogs }) => {
    const logger = datadogLogs.logger;
    if (level === 'error') logger.error(message, context);
    else if (level === 'warn') logger.warn(message, context);
    else logger.info(message, context);
  }).catch(() => {});
}
