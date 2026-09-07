/** Loopback-only API fixtures for MonetizationSimulatorTests.
 * Run the unmodified web production build on port 6990 first. This proxy
 * serves it on 6947 and supplies a fake account/delivery acknowledgement.
 * It is never the production Apple signature verifier or payment backend.
 */
import http from 'node:http';

const account = '11111111-1111-4111-8111-111111111111';
let state = { active: false, prepares: 0, reconciliations: 0 };
const offer = { usdMonthly: 4.99, appleProductId: 'ai.synalux.prismaac.cloud.monthly',
  monthlySpeechCharacters: 50000, monthlyAiRequests: 100, version: 'simulator-fixture-only', allowanceReset: 'utc_calendar_month' };
const billing = () => ({ userId: account, hasCloudAccess: state.active, betaExempt: false,
  transitionEndsAt: null, channels: state.active ? ['apple'] : [],
  manageChannel: state.active ? 'apple' : null, purchaseBlocked: state.active, enabled: true, offer });

http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost:6947');
  const send = (data, status = 200) => {
    res.writeHead(status, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
    res.end(JSON.stringify(data));
  };
  if (url.pathname === '/__simulator__/reset' && req.method === 'POST') {
    state = { active: false, prepares: 0, reconciliations: 0 };
    return send(state);
  }
  if (url.pathname === '/__simulator__/state') return send(state);
  if (url.pathname.includes('/api/')) {
    console.log(JSON.stringify({ at: new Date().toISOString(), method: req.method, path: url.pathname }));
    if (url.pathname.endsWith('/api/auth/session')) return send({ user: { email: 'simulator@example.invalid', name: 'Simulator test account' } });
    if (url.pathname.endsWith('/roles/me')) return send({ id: account, plan: 'free', aac_plan: 'free' });
    if (url.pathname.endsWith('/prism-aac/access')) return send({ state: 'sign_in_required', remainingMs: 0 });
    if (url.pathname.endsWith('/prism-aac/billing')) return send(billing());
    if (url.pathname.endsWith('/prism-aac/billing/apple')) {
      let raw = '';
      for await (const chunk of req) {
        raw += chunk;
        if (raw.length > 65536) return send({ error: 'Fixture request too large' }, 413);
      }
      try {
        const body = JSON.parse(raw);
        if (body.action === 'prepare' && body.expectedUserId === account && body.expectedOfferVersion === offer.version) {
          state.prepares++;
          return send({ accountToken: account });
        }
        if (body.action === 'reconcile') {
          // Decode ONLY for a local test acknowledgement. No real entitlement
          // or production database is ever written by this fixture.
          const payload = JSON.parse(Buffer.from(body.jws.split('.')[1], 'base64url').toString());
          if (payload.productId !== offer.appleProductId) return send({ error: 'Wrong fixture product' }, 400);
          state.active = true; state.reconciliations++;
          return send({ status: 'reconciled', transactionId: String(payload.transactionId) });
        }
      } catch { return send({ error: 'Invalid fixture body' }, 400); }
      return send({ error: 'Unsupported fixture action' }, 400);
    }
    // No API request from the local web UI is forwarded to production.
    return send({ error: 'Cloud service unavailable in simulator fixture' }, 503);
  }
  const proxy = http.request({ hostname: '127.0.0.1', port: 6990, path: req.url,
    method: req.method, headers: req.headers }, upstream => {
    res.writeHead(upstream.statusCode, upstream.headers);
    upstream.pipe(res);
  });
  proxy.on('error', () => send({ error: 'Start the candidate web server on port 6990' }, 502));
  req.pipe(proxy);
}).listen(6947, '127.0.0.1', () => console.log('Simulator fixture on http://localhost:6947; web target 6990'));
