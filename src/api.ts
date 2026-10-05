import { buildUrl, type ApiResult, type RequestInput } from './shared.js';
export class RequestError extends Error {
  constructor(message: string, public readonly status: number) { super(message); }
}
export type Transport = (url: string, init: RequestInit) => Promise<Response>;
export async function executeRequest(input: RequestInput, transport: Transport = fetch, signal?: AbortSignal): Promise<ApiResult> {
  const url = buildUrl(input);
  const started = performance.now();
  const timeout = AbortSignal.timeout(20_000);
  const combined = signal ? AbortSignal.any([signal, timeout]) : timeout;
  try {
    const response = await transport(url, { method: 'GET', redirect: 'error', headers: { Accept: 'application/json' }, signal: combined });
    if (Number(response.headers.get('content-length')) > 5 * 1024 * 1024) {
      await response.body?.cancel();
      throw new RequestError('Odpowiedź przekracza 5 MiB. Zawęź zapytanie.', 502);
    }
    const reader = response.body?.getReader();
    const chunks: Uint8Array[] = [];
    let size = 0;
    if (reader) {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        size += value.byteLength;
        if (size > 5 * 1024 * 1024) { await reader.cancel(); throw new RequestError('Odpowiedź przekracza 5 MiB. Zawęź zapytanie.', 502); }
        chunks.push(value);
      }
    }
    const bytes = new Uint8Array(size);
    let offset = 0;
    for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }
    const text = new TextDecoder().decode(bytes);
    let body: unknown = text;
    try { body = JSON.parse(text); } catch { /* Preserve non-JSON upstream errors for inspection. */ }
    const headers: Record<string, string> = {};
    for (const name of ['content-type','retry-after','etag','last-modified']) {
      const value = response.headers.get(name);
      if (value) headers[name] = value;
    }
    return { url, status: response.status, statusText: response.statusText, durationMs: Math.round(performance.now() - started), body, headers };
  } catch (error) {
    if (error instanceof RequestError) throw error;
    if (combined.aborted) throw new RequestError(timeout.aborted ? 'GUS nie odpowiedział w ciągu 20 sekund.' : 'Zapytanie anulowane.', 504);
    throw new RequestError('Nie udało się połączyć z GUS. Spróbuj ponownie później.', 502);
  }
}
