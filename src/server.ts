import { createServer, type ServerResponse } from 'node:http';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import { executeRequest, RequestError, type Transport } from './api.js';
import { buildUrl, type RequestInput } from './shared.js';

const assets: Record<string, [string, string]> = {
  '/': ['../public/index.html', 'text/html; charset=utf-8'],
  '/style.css': ['../public/style.css', 'text/css; charset=utf-8'],
  '/client.js': ['./client.js', 'text/javascript; charset=utf-8'],
  '/shared.js': ['./shared.js', 'text/javascript; charset=utf-8'],
  '/catalog.js': ['./catalog.js', 'text/javascript; charset=utf-8'],
};
function json(response: ServerResponse, status: number, body: unknown): void {
  response.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
  response.end(JSON.stringify(body));
}
export function makeServer(transport?: Transport) {
  let busy = false;
  let nextRequestAt = 0;
  const server = createServer(async (request, response) => {
    response.setHeader('X-Content-Type-Options', 'nosniff');
    response.setHeader('Referrer-Policy', 'no-referrer');
    response.setHeader('Content-Security-Policy', "default-src 'self'; script-src 'self'; style-src 'self'; connect-src 'self'; img-src 'self'; base-uri 'none'; frame-ancestors 'none'; form-action 'self'");
    const path = request.url?.split('?')[0] ?? '/';
    if (request.method === 'GET' && path === '/healthz') return json(response, 200, { status: 'ok' });
    if (request.method === 'GET' && assets[path]) {
      try {
        const [file, type] = assets[path];
        const content = await readFile(new URL(file, import.meta.url));
        response.writeHead(200, { 'Content-Type': type }); response.end(content);
      } catch { json(response, 500, { error: 'Brak zasobów aplikacji. Uruchom npm run build.' }); }
      return;
    }
    if (path !== '/api/request') return json(response, 404, { error: 'Nie znaleziono zasobu.' });
    if (request.method !== 'POST') { response.setHeader('Allow','POST'); return json(response, 405, { error: 'Wymagana metoda POST.' }); }
    // Cross-site forms and third-party origins cannot use this local proxy.
    if (request.headers['content-type']?.split(';')[0]?.trim().toLowerCase() !== 'application/json') return json(response, 415, { error: 'Wymagany Content-Type application/json.' });
    if (request.headers['sec-fetch-site'] === 'cross-site') return json(response, 403, { error: 'Obce źródło zapytania.' });
    if (request.headers.origin) {
      try {
        const origin = new URL(request.headers.origin);
        if (!['http:', 'https:'].includes(origin.protocol) || origin.origin !== request.headers.origin || origin.host !== request.headers.host) {
          return json(response, 403, { error: 'Obce źródło zapytania.' });
        }
      }
      catch { return json(response, 403, { error: 'Obce źródło zapytania.' }); }
    }
    let input: RequestInput;
    try {
      const chunks: Buffer[] = []; let size = 0;
      for await (const chunk of request) {
        size += Buffer.byteLength(chunk);
        if (size > 16_384) { json(response, 413, { error: 'Zapytanie przekracza 16 KiB.' }); return; }
        chunks.push(Buffer.from(chunk));
      }
      input = JSON.parse(Buffer.concat(chunks).toString('utf8')) as RequestInput;
      buildUrl(input);
    } catch (error) { return json(response, 400, { error: error instanceof SyntaxError ? 'Niepoprawny JSON.' : error instanceof Error ? error.message : 'Niepoprawne zapytanie.' }); }
    if (busy || Date.now() < nextRequestAt) { response.setHeader('Retry-After', '1'); return json(response, 429, { error: 'Poczekaj chwilę przed kolejnym zapytaniem.' }); }
    busy = true;
    const controller = new AbortController();
    const abort = () => { if (!response.writableEnded) controller.abort(); };
    response.once('close', abort);
    try { json(response, 200, await executeRequest(input, transport, controller.signal)); }
    catch (error) { if (!response.destroyed) json(response, error instanceof RequestError ? error.status : 500, { error: error instanceof Error ? error.message : 'Błąd aplikacji.' }); }
    finally { busy = false; nextRequestAt = Date.now() + 250; response.removeListener('close', abort); }
  });
  server.requestTimeout = 30_000;
  server.headersTimeout = 10_000;
  return server;
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const port = Number(process.env.PORT ?? 8080);
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('PORT musi być liczbą od 1 do 65535.');
  const host = process.env.HOST ?? '127.0.0.1';
  makeServer().listen(port, host, () => console.log(`Tester GUS BDL: http://${host}:${port}`));
}
