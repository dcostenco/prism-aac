/** Loopback-only API fixtures for MonetizationSimulatorTests.
 * Run the unmodified web production build on port 6990 first. This proxy
 * serves it on 6947 and supplies a fake account/delivery acknowledgement.
 * It is never the production Apple signature verifier or payment backend.
 */
import http from 'node:http';
let responseSequence = 0;

const account = '11111111-1111-4111-8111-111111111111';
const initialState = () => ({ run: process.env.AAC_NATIVE_RUN_ID || 'manual-simulator-fixture',
  account, active: false, channel: 'apple', manages: 0, prepares: 0, reconciliations: 0, transactions: [],
  billingGets: 0, bundleFault: 'none', offlinePort: null });
let state = initialState();
const reconnectEnabled = process.env.AAC_NATIVE_RECONNECT_PORT === 'dynamic';
let reconnectPort;
const usedReconnectPorts = new Set();
let reconnectServer;
const offer = { usdMonthly: 4.99, appleProductId: 'ai.synalux.prismaac.cloud.monthly',
  monthlySpeechCharacters: 50000, monthlyAiRequests: 100, version: 'simulator-fixture-only', allowanceReset: 'utc_calendar_month' };
const billing = () => ({ userId: account, hasCloudAccess: state.active, betaExempt: false,
  transitionEndsAt: null, channels: state.active ? [state.channel] : [],
  manageChannel: state.active ? state.channel : null, purchaseBlocked: state.active, enabled: true, offer });

const handler = async (req, res) => {
  const url = new URL(req.url, 'http://localhost:6947');
  if (process.env.AAC_RELOAD_DIAGNOSTIC === '1') {
    res.once('finish', () => console.log(JSON.stringify({ method: req.method, path: url.pathname, status: res.statusCode,
      contentType: res.getHeader('Content-Type') || null })));
  }
  const send = (data, status = 200) => {
    res.writeHead(status, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
    res.end(JSON.stringify(data));
  };
  if (url.pathname === '/__simulator__/reset' && req.method === 'POST') {
    if (reconnectServer) {
      const server = reconnectServer;
      reconnectServer = undefined;
      server.closeAllConnections();
      await new Promise(resolve => server.close(resolve));
    }
    state = initialState();
    if (reconnectEnabled) {
      // A fresh origin prevents an earlier journey's service worker from
      // replacing the bundled fallback that this journey must exercise.
      do {
        const reservation = http.createServer();
        await new Promise(resolve => reservation.listen(0, '127.0.0.1', resolve));
        reconnectPort = reservation.address().port;
        await new Promise(resolve => reservation.close(resolve));
      } while (usedReconnectPorts.has(reconnectPort));
      usedReconnectPorts.add(reconnectPort);
      state.offlinePort = reconnectPort;
    }
    return send(state);
  }
  if (url.pathname === '/__simulator__/online' && req.method === 'POST') {
    if (!reconnectPort) return send({ error: 'Reconnect listener is not enabled' }, 403);
    if (!reconnectServer) {
      const server = http.createServer(handler);
      try {
        await new Promise((resolve, reject) => {
          server.once('error', reject);
          server.listen(reconnectPort, '127.0.0.1', resolve);
        });
        reconnectServer = server;
      } catch { return send({ error: 'Reconnect listener could not start' }, 503); }
    }
    return send({ online: true, port: reconnectPort });
  }
  if (url.pathname === '/__simulator__/state') return send(state);
  if (url.pathname === '/__simulator__/bundle-fault' && req.method === 'POST') {
    const phase = url.searchParams.get('phase');
    if (!['requested', 'blocked', 'restore_requested', 'restored'].includes(phase)) return send({ error: 'Invalid fixture fault phase' }, 400);
    state.bundleFault = phase;
    return send(state);
  }
  if (url.pathname === '/__simulator__/stripe' && req.method === 'POST') {
    state.active = true; state.channel = 'stripe';
    return send(state);
  }
  if (url.pathname.includes('/api/')) {
    console.log(JSON.stringify({ at: new Date().toISOString(), method: req.method, path: url.pathname }));
    if (url.pathname.endsWith('/api/auth/session')) return send({ user: { email: 'simulator@example.invalid', name: 'Simulator test account' } });
    if (url.pathname.endsWith('/roles/me')) return send({ id: account, plan: 'free', aac_plan: 'free' });
    if (url.pathname.endsWith('/prism-aac/access')) return send({ state: 'sign_in_required', remainingMs: 0 });
    if (url.pathname.endsWith('/prism-aac/billing')) {
      if (req.method === 'POST') {
        let raw = '';
        for await (const chunk of req) {
          raw += chunk;
          if (raw.length > 1024) return send({ error: 'Fixture request too large' }, 413);
        }
        try {
          if (JSON.parse(raw).action !== 'manage' || state.channel !== 'stripe' || !state.active) {
            return send({ error: 'No fixture Stripe plan to manage' }, 400);
          }
        } catch { return send({ error: 'Invalid fixture body' }, 400); }
        state.manages++;
        // Public provider root only: no real session, purchase or account URL.
        return send({ url: 'https://billing.stripe.com/' });
      }
      state.billingGets++;
      return send(billing());
    }
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
          if (payload.environment !== 'Xcode' || payload.appAccountToken?.toLowerCase() !== account) {
            return send({ error: 'Wrong local StoreKit environment or fixture account' }, 400);
          }
          state.transactions.push({ id: String(payload.transactionId), originalId: String(payload.originalTransactionId),
            accountToken: payload.appAccountToken, environment: payload.environment,
            purchaseDate: payload.purchaseDate, expiresDate: payload.expiresDate, productId: payload.productId,
            acknowledgedAt: Date.now() });
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
    if (process.env.AAC_RELOAD_DIAGNOSTIC === '1' && url.pathname === '/prism-aac') {
      const id = String(++responseSequence);
      upstream.headers['x-aac-fixture-response'] = id;
      const chunks = [];
      let size = 0;
      upstream.on('data', chunk => { size += chunk.length; if (size <= 262144) chunks.push(chunk); });
      upstream.on('end', () => {
        const encoding = upstream.headers['content-encoding'];
        const html = encoding ? null : Buffer.concat(chunks).toString();
        console.log(JSON.stringify({ responseID: id, phase: 'document-bytes',
          policyNonce: upstream.headers['content-security-policy']?.match(/'nonce-([^']+)'/)?.[1],
          htmlNonces: html === null ? null : [...new Set([...html.matchAll(/nonce="([^"]+)"/g)].map(match => match[1]))], encoding,
          complete: size <= 262144, bytes: size, uniqueLaunch: url.searchParams.has('_aac_launch'),
          launchMarker: url.searchParams.get('_aac_launch'), navigationPreload: req.headers['service-worker-navigation-preload'] ?? null }));
      });
    }
    res.writeHead(upstream.statusCode, upstream.headers);
    upstream.pipe(res);
  });
  proxy.on('error', () => send({ error: 'Start the candidate web server on port 6990' }, 502));
  req.pipe(proxy);
};
http.createServer(handler).listen(6947, '127.0.0.1', () => console.log('Simulator fixture on http://localhost:6947; web target 6990'));
