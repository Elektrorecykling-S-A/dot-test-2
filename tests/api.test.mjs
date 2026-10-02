import test from 'node:test';
import assert from 'node:assert/strict';
import { executeRequest, RequestError } from '../dist/api.js';

const valid = { endpoint: '/version', params: {} };
const LIMIT = 5 * 1024 * 1024;
const encoder = new TextEncoder();
const expectError = (status, message) => error => {
  assert.ok(error instanceof RequestError);
  assert.equal(error.status, status);
  assert.match(error.message, message);
  return true;
};

// Every request in this file uses a local transport stub. Never contact GUS in CI.
test('returns JSON, safe response headers and request diagnostics', async () => {
  let calls = 0;
  const result = await executeRequest(valid, async (url, options) => {
    calls += 1;
    assert.equal(url, 'https://bdl.stat.gov.pl/api/v1/version?format=json&lang=pl');
    assert.equal(options.method, 'GET');
    assert.equal(options.redirect, 'error');
    assert.deepEqual(options.headers, { Accept: 'application/json' });
    assert.ok(options.signal instanceof AbortSignal);
    return new Response(JSON.stringify({ version: '1.2', text: 'Łódź' }), {
      status: 200, statusText: 'OK',
      headers: { 'Content-Type': 'application/json', ETag: '"sample"', 'Last-Modified': 'Wed, 01 Oct 2025 00:00:00 GMT', 'Set-Cookie': 'secret=hidden', 'X-Internal-Secret': 'hidden' },
    });
  });
  assert.equal(calls, 1);
  assert.equal(result.status, 200);
  assert.equal(result.statusText, 'OK');
  assert.deepEqual(result.body, { version: '1.2', text: 'Łódź' });
  assert.deepEqual(result.headers, { 'content-type': 'application/json', etag: '"sample"', 'last-modified': 'Wed, 01 Oct 2025 00:00:00 GMT' });
  assert.ok(Number.isInteger(result.durationMs) && result.durationMs >= 0);
});

test('default transport can be replaced and performs only one fetch', async t => {
  const fetch = t.mock.method(globalThis, 'fetch', async () => new Response('true'));
  assert.equal((await executeRequest(valid)).body, true);
  assert.equal(fetch.mock.callCount(), 1);
});

test('invalid input is rejected before transport can run', async () => {
  let calls = 0;
  const transport = async () => { calls += 1; throw new Error('must not run'); };
  for (const request of [null, { endpoint: 'https://attacker.invalid', params: {} }, { endpoint: '/units/{id}', params: { id: '..' } }, { endpoint: '/version', params: { url: 'https://attacker.invalid' } }]) {
    await assert.rejects(executeRequest(request, transport), Error);
  }
  assert.equal(calls, 0);
});

test('upstream 429 retains its status, body and retry hint without retrying', async () => {
  let calls = 0;
  const result = await executeRequest(valid, async () => {
    calls += 1;
    return new Response('{"error":"limit"}', { status: 429, statusText: 'Too Many Requests', headers: { 'Retry-After': '60', 'Content-Type': 'application/json' } });
  });
  assert.equal(calls, 1);
  assert.equal(result.status, 429);
  assert.equal(result.statusText, 'Too Many Requests');
  assert.deepEqual(result.body, { error: 'limit' });
  assert.equal(result.headers['retry-after'], '60');
});

test('preserves non-JSON upstream errors and empty responses for inspection', async () => {
  const html = '<!doctype html><title>GUS unavailable</title>';
  const result = await executeRequest(valid, async () => new Response(html, { status: 503, headers: { 'Content-Type': 'text/html' } }));
  assert.equal(result.status, 503);
  assert.equal(result.body, html);
  const empty = await executeRequest(valid, async () => new Response(null, { status: 204 }));
  assert.equal(empty.status, 204);
  assert.equal(empty.body, '');
});

test('JSON decoding supports scalars, malformed JSON and UTF-8 across chunk boundaries', async () => {
  for (const [body, expected] of [['null', null], ['0', 0], ['false', false], ['"tekst"', 'tekst'], ['[1,2]', [1, 2]], ['{"incomplete":', '{"incomplete":']]) {
    assert.deepEqual((await executeRequest(valid, async () => new Response(body))).body, expected);
  }
  const bytes = encoder.encode('{"name":"Łódź 👋"}');
  const stream = new ReadableStream({ start(controller) {
    for (const byte of bytes) controller.enqueue(Uint8Array.of(byte));
    controller.close();
  } });
  assert.deepEqual((await executeRequest(valid, async () => new Response(stream))).body, { name: 'Łódź 👋' });
});

test('content-length above 5 MiB cancels upstream before reading', async () => {
  let cancelled = false;
  const stream = new ReadableStream({ cancel() { cancelled = true; } });
  await assert.rejects(executeRequest(valid, async () => new Response(stream, { headers: { 'Content-Length': String(LIMIT + 1) } })), expectError(502, /5 MiB/));
  assert.equal(cancelled, true);
});

test('streaming size limit applies without a header or with a dishonest small header', async () => {
  for (const headers of [{}, { 'Content-Length': '1' }, { 'Content-Length': 'invalid' }]) {
    let cancelled = false;
    let index = 0;
    const stream = new ReadableStream({
      pull(controller) { controller.enqueue(new Uint8Array(index++ === 0 ? LIMIT : 1)); },
      cancel() { cancelled = true; },
    });
    await assert.rejects(executeRequest(valid, async () => new Response(stream, { headers })), expectError(502, /5 MiB/));
    assert.equal(cancelled, true);
  }
});

test('a response exactly 5 MiB is accepted', async () => {
  const payload = 'x'.repeat(LIMIT);
  const result = await executeRequest(valid, async () => new Response(payload, { headers: { 'Content-Length': String(LIMIT) } }));
  assert.equal(result.body.length, LIMIT);
});

test('transport and body-read failures become safe 502 errors', async () => {
  await assert.rejects(executeRequest(valid, async () => { throw new Error('secret upstream address'); }), expectError(502, /Nie udało się połączyć/));
  const stream = new ReadableStream({ start(controller) { controller.error(new Error('internal secret')); } });
  await assert.rejects(executeRequest(valid, async () => new Response(stream)), error => {
    expectError(502, /Nie udało się połączyć/)(error);
    assert.ok(!error.message.includes('secret'));
    return true;
  });
});

test('caller abort is propagated and reported as cancellation', async () => {
  const controller = new AbortController();
  let requestSignal;
  const promise = executeRequest(valid, async (_url, options) => {
    requestSignal = options.signal;
    return new Promise((_resolve, reject) => options.signal.addEventListener('abort', () => reject(options.signal.reason), { once: true }));
  }, controller.signal);
  controller.abort();
  await assert.rejects(promise, expectError(504, /anulowane/));
  assert.equal(requestSignal.aborted, true);
});

test('already-aborted callers retain cancellation semantics', async () => {
  const controller = new AbortController();
  controller.abort();
  await assert.rejects(executeRequest(valid, async (_url, options) => {
    options.signal.throwIfAborted();
    throw new Error('unreachable');
  }, controller.signal), expectError(504, /anulowane/));
});

test('20-second timeout is deterministic with a controlled signal', async t => {
  const timeout = new AbortController();
  const timeoutMock = t.mock.method(AbortSignal, 'timeout', milliseconds => {
    assert.equal(milliseconds, 20_000);
    return timeout.signal;
  });
  const promise = executeRequest(valid, async (_url, options) => new Promise((_resolve, reject) => {
    options.signal.addEventListener('abort', () => reject(options.signal.reason), { once: true });
  }));
  timeout.abort(new DOMException('timed out', 'TimeoutError'));
  await assert.rejects(promise, expectError(504, /20 sekund/));
  assert.equal(timeoutMock.mock.callCount(), 1);
});

test('abort during response streaming reports cancellation', async () => {
  const controller = new AbortController();
  const promise = executeRequest(valid, async (_url, options) => new Response(new ReadableStream({
    start(stream) { options.signal.addEventListener('abort', () => stream.error(options.signal.reason), { once: true }); },
  })), controller.signal);
  controller.abort();
  await assert.rejects(promise, expectError(504, /anulowane/));
});
