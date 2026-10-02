import test from 'node:test';
import assert from 'node:assert/strict';
import { request as httpRequest } from 'node:http';
import { once } from 'node:events';
import { readFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { makeServer } from '../dist/server.js';

const valid = { endpoint: '/version', params: {} };
const jsonBody = JSON.stringify(valid);
const response = () => new Response('{"version":"test"}', { headers: { 'Content-Type': 'application/json' } });

async function start(t, transport = async () => response()) {
  const calls = [];
  const server = makeServer(async (...args) => { calls.push(args); return transport(...args); });
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  t.after(() => new Promise((resolve, reject) => {
    server.close(error => error ? reject(error) : resolve());
    server.closeAllConnections();
  }));
  return { server, calls, port: server.address().port };
}

function send(app, { path = '/api/request', method = 'POST', headers = { 'Content-Type': 'application/json' }, body = method === 'POST' ? jsonBody : undefined } = {}) {
  return new Promise((resolve, reject) => {
    const req = httpRequest({ hostname: '127.0.0.1', port: app.port, path, method, headers, agent: false }, res => {
      const chunks = [];
      res.on('data', chunk => chunks.push(chunk));
      res.on('end', () => {
        const text = Buffer.concat(chunks).toString('utf8');
        let data;
        try { data = JSON.parse(text); } catch { /* Static assets and HEAD responses are not JSON. */ }
        resolve({ status: res.statusCode, headers: res.headers, text, data });
      });
      res.on('error', reject);
    });
    req.on('error', reject);
    req.end(body);
  });
}

function assertSecurityHeaders(result) {
  assert.equal(result.headers['x-content-type-options'], 'nosniff');
  assert.equal(result.headers['referrer-policy'], 'no-referrer');
  assert.match(result.headers['content-security-policy'], /default-src 'self'/);
  assert.match(result.headers['content-security-policy'], /frame-ancestors 'none'/);
  assert.match(result.headers['content-security-policy'], /connect-src 'self'/);
  assert.equal(result.headers['access-control-allow-origin'], undefined);
}

test('health route is local, cache-disabled and has security headers', async t => {
  const app = await start(t);
  for (const path of ['/healthz', '/healthz?probe=1']) {
    const result = await send(app, { path, method: 'GET', headers: {}, body: undefined });
    assert.equal(result.status, 200);
    assert.deepEqual(result.data, { status: 'ok' });
    assert.equal(result.headers['cache-control'], 'no-store');
    assert.match(result.headers['content-type'], /^application\/json/);
    assertSecurityHeaders(result);
  }
  assert.equal(app.calls.length, 0);
  assert.equal(app.server.requestTimeout, 30_000);
  assert.equal(app.server.headersTimeout, 10_000);
});

test('serves only the five allowed static assets with their expected content types', async t => {
  const app = await start(t);
  const assets = [
    ['/', '../public/index.html', 'text/html'],
    ['/style.css', '../public/style.css', 'text/css'],
    ['/client.js', '../dist/client.js', 'text/javascript'],
    ['/shared.js', '../dist/shared.js', 'text/javascript'],
    ['/catalog.js', '../dist/catalog.js', 'text/javascript'],
  ];
  for (const [path, file, type] of assets) {
    const result = await send(app, { path: `${path}?v=123`, method: 'GET', headers: {}, body: undefined });
    assert.equal(result.status, 200, path);
    assert.equal(result.headers['content-type'], `${type}; charset=utf-8`, path);
    assert.equal(result.text, await readFile(new URL(file, import.meta.url), 'utf8'), path);
    assert.ok(result.text.length > 0, path);
    assertSecurityHeaders(result);
  }
  assert.equal(app.calls.length, 0);
});

test('unknown paths, traversal and source/config files are not served', async t => {
  const app = await start(t);
  for (const path of ['/missing', '/api/request/extra', '/index.html', '/server.js', '/api.js', '/package.json', '/.git/config', '/../package.json', '/%2e%2e/package.json', '/public/index.html', '/docs/bdl-openapi.json']) {
    const result = await send(app, { path, method: 'GET', headers: {}, body: undefined });
    assert.equal(result.status, 404, path);
    assert.match(result.data.error, /Nie znaleziono/);
    assertSecurityHeaders(result);
  }
  assert.equal(app.calls.length, 0);
});

test('API rejects non-POST methods without fetching or allowing CORS preflight', async t => {
  const app = await start(t);
  for (const method of ['GET', 'HEAD', 'PUT', 'PATCH', 'DELETE', 'OPTIONS']) {
    const result = await send(app, { method, headers: {}, body: undefined });
    assert.equal(result.status, 405, method);
    assert.equal(result.headers.allow, 'POST');
    assertSecurityHeaders(result);
  }
  assert.equal(app.calls.length, 0);
});

test('API requires an exact JSON media type', async t => {
  const app = await start(t);
  for (const contentType of [undefined, 'text/plain', 'application/x-www-form-urlencoded', 'multipart/form-data', 'application/json-evil', 'application/jsonp', 'text/application/json']) {
    const headers = contentType ? { 'Content-Type': contentType } : {};
    const result = await send(app, { headers });
    assert.equal(result.status, 415, String(contentType));
    assert.match(result.data.error, /application\/json/);
  }
  assert.equal(app.calls.length, 0);
});

test('JSON media type supports charset parameters and case-insensitive matching', async t => {
  let now = 1000;
  t.mock.method(Date, 'now', () => now);
  const app = await start(t);
  for (const contentType of ['application/json', 'application/json; charset=utf-8', 'Application/JSON; Charset=UTF-8']) {
    const result = await send(app, { headers: { 'Content-Type': contentType } });
    assert.equal(result.status, 200, contentType);
    now += 1000;
  }
  assert.equal(app.calls.length, 3);
});

test('cross-site, foreign, null and malformed origins are rejected before fetching', async t => {
  const app = await start(t);
  const sameHost = `127.0.0.1:${app.port}`;
  const origins = ['https://attacker.invalid', 'null', 'not an origin', `http://user@${sameHost}`, `http://${sameHost}/path`, `http://${sameHost}/`, `ftp://${sameHost}`, `http://${sameHost}#fragment`, `http://${sameHost}?query=1`, 'http://127.0.0.1:1'];
  for (const origin of origins) {
    const result = await send(app, { headers: { 'Content-Type': 'application/json', Origin: origin } });
    assert.equal(result.status, 403, origin);
    assertSecurityHeaders(result);
  }
  const crossSite = await send(app, { headers: { 'Content-Type': 'application/json', Origin: `http://${sameHost}`, 'Sec-Fetch-Site': 'cross-site' } });
  assert.equal(crossSite.status, 403);
  assert.equal(app.calls.length, 0);
});

test('same-host origins work for direct HTTP and TLS-terminating reverse proxies', async t => {
  let now = 1000;
  t.mock.method(Date, 'now', () => now);
  const app = await start(t);
  for (const scheme of ['http', 'https']) {
    const result = await send(app, { headers: { 'Content-Type': 'application/json', Origin: `${scheme}://127.0.0.1:${app.port}`, 'Sec-Fetch-Site': 'same-origin' } });
    assert.equal(result.status, 200);
    now += 1000;
  }
  assert.equal(app.calls.length, 2);
});

test('malformed JSON and invalid endpoint parameters never call the upstream', async t => {
  const app = await start(t);
  for (const body of ['', '{', '{"endpoint":', 'null', '[]', '{}', JSON.stringify({ endpoint: 'https://attacker.invalid', params: {} }), JSON.stringify({ endpoint: '/version', params: { url: 'https://attacker.invalid' } }), JSON.stringify({ endpoint: '/units/{id}', params: { id: '../version' } }), JSON.stringify({ endpoint: '/units', params: { page: -1 } }), JSON.stringify({ endpoint: '/subjects/search', params: { name: 'a'.repeat(501) } })]) {
    const result = await send(app, { body });
    assert.equal(result.status, 400, body.slice(0, 100));
    assert.equal(typeof result.data.error, 'string');
    assertSecurityHeaders(result);
  }
  assert.equal(app.calls.length, 0);
  // Invalid requests must not spend the rate-limit budget.
  assert.equal((await send(app)).status, 200);
  assert.equal(app.calls.length, 1);
});

test('request size accepts exactly 16 KiB of valid JSON', async t => {
  const app = await start(t);
  const body = jsonBody + ' '.repeat(16_384 - Buffer.byteLength(jsonBody));
  assert.equal(Buffer.byteLength(body), 16_384);
  const result = await send(app, { body });
  assert.equal(result.status, 200);
  assert.equal(app.calls.length, 1);
});

test('request size rejects more than 16 KiB, including chunked and multibyte bodies', async t => {
  const app = await start(t);
  const oversized = jsonBody + ' '.repeat(16_385 - Buffer.byteLength(jsonBody));
  for (const options of [
    { body: oversized },
    { body: oversized, headers: { 'Content-Type': 'application/json', 'Transfer-Encoding': 'chunked' } },
    { body: JSON.stringify({ ...valid, padding: 'ą'.repeat(9000) }) },
  ]) {
    const result = await send(app, options);
    assert.equal(result.status, 413);
    assert.match(result.data.error, /16 KiB/);
  }
  assert.equal(app.calls.length, 0);
});

test('valid request returns a complete envelope and preserves upstream 429', async t => {
  const app = await start(t, async () => new Response('{"error":"rate limited"}', { status: 429, statusText: 'Too Many Requests', headers: { 'Retry-After': '90', 'Content-Type': 'application/json' } }));
  const result = await send(app);
  assert.equal(result.status, 200);
  assert.equal(result.data.status, 429);
  assert.equal(result.data.statusText, 'Too Many Requests');
  assert.deepEqual(result.data.body, { error: 'rate limited' });
  assert.equal(result.data.headers['retry-after'], '90');
  assert.equal(result.data.url, 'https://bdl.stat.gov.pl/api/v1/version?format=json&lang=pl');
  assert.ok(Number.isInteger(result.data.durationMs));
  assert.equal(result.headers['cache-control'], 'no-store');
  assertSecurityHeaders(result);
  assert.equal(app.calls.length, 1);
});

test('upstream connection failures return a safe 502', async t => {
  const app = await start(t, async () => { throw new Error('password=secret'); });
  const result = await send(app);
  assert.equal(result.status, 502);
  assert.match(result.data.error, /Nie udało się połączyć/);
  assert.equal(result.text.includes('secret'), false);
  assert.equal(app.calls.length, 1);
});

test('rate limit enforces the 250 ms cooldown without sleeping', async t => {
  let now = 1_000_000;
  t.mock.method(Date, 'now', () => now);
  const app = await start(t);
  assert.equal((await send(app)).status, 200);
  now += 249;
  const limited = await send(app);
  assert.equal(limited.status, 429);
  assert.equal(limited.headers['retry-after'], '1');
  assert.equal(app.calls.length, 1);
  now += 1;
  assert.equal((await send(app)).status, 200);
  assert.equal(app.calls.length, 2);
});

test('only one upstream request runs at a time; health remains responsive', async t => {
  let signalStarted;
  const started = new Promise(resolve => { signalStarted = resolve; });
  let release;
  const deferred = new Promise(resolve => { release = resolve; });
  const app = await start(t, async () => { signalStarted(); return deferred; });
  const first = send(app);
  await started;
  try {
    const second = await send(app);
    assert.equal(second.status, 429);
    assert.equal(second.headers['retry-after'], '1');
    assert.equal(app.calls.length, 1);
    assert.equal((await send(app, { path: '/healthz', method: 'GET', headers: {}, body: undefined })).status, 200);
  } finally { release(response()); }
  assert.equal((await first).status, 200);
});

test('a transport failure releases the busy flag after its cooldown', async t => {
  let now = 1000;
  let count = 0;
  t.mock.method(Date, 'now', () => now);
  const app = await start(t, async () => { if (count++ === 0) throw new Error('offline'); return response(); });
  assert.equal((await send(app)).status, 502);
  now += 250;
  assert.equal((await send(app)).status, 200);
  assert.equal(app.calls.length, 2);
});

test('disconnecting a client aborts its upstream request and releases the server', { timeout: 5000 }, async t => {
  let now = 1000;
  t.mock.method(Date, 'now', () => now);
  let signalStarted;
  const started = new Promise(resolve => { signalStarted = resolve; });
  let signalAborted;
  const aborted = new Promise(resolve => { signalAborted = resolve; });
  let first = true;
  const app = await start(t, async (_url, options) => {
    if (!first) return response();
    first = false;
    signalStarted();
    return new Promise((_resolve, reject) => options.signal.addEventListener('abort', () => {
      signalAborted(); reject(options.signal.reason);
    }, { once: true }));
  });
  const req = httpRequest({ hostname: '127.0.0.1', port: app.port, path: '/api/request', method: 'POST', agent: false, headers: { 'Content-Type': 'application/json' } });
  req.on('error', () => {}); // A deliberate client disconnect produces ECONNRESET.
  req.end(jsonBody);
  await started;
  req.destroy();
  await aborted;
  // A local health response provides an event-loop turn for the rejected transport's finally block.
  await send(app, { path: '/healthz', method: 'GET', headers: {}, body: undefined });
  now += 1000;
  assert.equal((await send(app)).status, 200);
  assert.equal(app.calls.length, 2);
});

test('CLI rejects invalid ports without opening a listener', () => {
  for (const port of ['0', '65536', '-1', '1.5', 'not-a-port']) {
    const result = spawnSync(process.execPath, ['dist/server.js'], { cwd: new URL('..', import.meta.url), env: { ...process.env, PORT: port, HOST: '127.0.0.1' }, encoding: 'utf8', timeout: 5000 });
    assert.equal(result.status, 1, port);
    assert.match(result.stderr, /PORT musi być liczbą/);
  }
});
