import { endpoints } from './catalog.js';
import { buildUrl, type ApiResult, type Endpoint, type Parameter, type RequestInput } from './shared.js';

function element<T extends HTMLElement>(id: string): T {
  const found = document.getElementById(id);
  if (!found) throw new Error(`Brak elementu interfejsu: ${id}`);
  return found as T;
}

const form = element<HTMLFormElement>('request-form');
const endpointSelect = element<HTMLSelectElement>('endpoint');
const parameters = element<HTMLDivElement>('parameters');
const submitButton = element<HTMLButtonElement>('submit');
const cancelButton = element<HTMLButtonElement>('cancel');
const submitLabel = element<HTMLSpanElement>('submit-label');
const formError = element<HTMLParagraphElement>('form-error');
const urlPreview = element<HTMLElement>('url-preview');
const urlHint = element<HTMLParagraphElement>('url-hint');
const responsePanel = document.querySelector<HTMLElement>('.response-panel');
const status = element<HTMLParagraphElement>('request-status');
const statusText = element<HTMLSpanElement>('status-text');
const duration = element<HTMLSpanElement>('duration');
const emptyState = element<HTMLDivElement>('empty-state');
const loadingState = element<HTMLDivElement>('loading-state');
const resultContent = element<HTMLDivElement>('result-content');
const resultJson = element<HTMLPreElement>('response-json');
const resultNotice = element<HTMLParagraphElement>('result-notice');
const spinner = document.querySelector<HTMLElement>('.button-spinner');
const presets = document.querySelectorAll<HTMLButtonElement>('[data-preset]');

const labels: Record<string, string> = {
  name: 'Nazwa', 'unit-id': 'Identyfikator jednostki', 'var-id': 'Identyfikator zmiennej',
  'subject-id': 'Identyfikator tematu', 'attribute-id': 'Identyfikator atrybutu',
  'level-id': 'Poziom jednostki', id: 'Identyfikator', year: 'Rok', years: 'Lata',
  'unit-level': 'Poziom jednostki', 'parent-id': 'Jednostka nadrzędna',
  'unit-parent-id': 'Jednostka nadrzędna', kind: 'Rodzaj jednostki',
  'page-size': 'Wyniki na stronę', page: 'Numer strony', lang: 'Język danych',
  format: 'Format', sort: 'Sortowanie', 'var-name': 'Nazwa zmiennej',
  'unit-kind': 'Rodzaj jednostki', 'aggregate-id': 'Identyfikator agregatu',
  'measure-unit-id': 'Identyfikator jednostki miary', 'level': 'Poziom',
};

const help: Record<string, string> = {
  name: 'Nazwa lub fragment nazwy, np. Warszawa.',
  'unit-id': 'Identyfikator jednostki z metody /units.',
  'var-id': 'Identyfikator zmiennej z metody /variables, np. 3643.',
  'subject-id': 'Identyfikator tematu z metody /subjects.',
  'parent-id': 'Filtr jednostek podlegających wybranej jednostce.',
  'unit-parent-id': 'Filtr danych dla jednostek podlegających wybranej jednostce.',
  year: 'Rok danych, np. 2024. Dostępność zależy od zmiennej.',
  'unit-level': 'Poziom terytorialny, np. 2: województwa.',
  'page-size': 'Liczba pozycji zwracanych na jednej stronie.',
  page: 'Numer strony wyników zgodny z API BDL.',
  lang: 'Język nazw i opisów w odpowiedzi API.',
  sort: 'Porządek wyników zgodny z wybraną metodą.',
};

const groupLabels: Record<string, string> = {
  units: 'Jednostki terytorialne', variables: 'Zmienne', data: 'Dane statystyczne',
  subjects: 'Tematy', years: 'Lata', attributes: 'Atrybuty',
  aggregates: 'Agregaty', levels: 'Poziomy', 'unit-kinds': 'Rodzaje jednostek',
  'measure-units': 'Jednostki miary', version: 'Informacje o API',
};

const presetData: Record<string, RequestInput> = {
  warszawa: { endpoint: '/units/search', params: { name: 'Warszawa' } },
  population: { endpoint: '/data/by-variable/{var-id}', params: { 'var-id': '3643', year: '2024', 'unit-level': '2' } },
  years: { endpoint: '/years', params: {} },
};

let controller: AbortController | null = null;
let generation = 0;
let latestResult: ApiResult | null = null;
let noticeTimer: number | null = null;

function selectedEndpoint(): Endpoint {
  const endpoint = endpoints.find((candidate) => candidate.path === endpointSelect.value);
  if (!endpoint) throw new Error('Wybierz poprawną metodę API.');
  return endpoint;
}

function inputValue(): RequestInput {
  const params: Record<string, string> = {};
  for (const parameter of selectedEndpoint().parameters) {
    const input = document.getElementById(`param-${parameter.name}`);
    if (input instanceof HTMLInputElement || input instanceof HTMLSelectElement) {
      const value = input.value.trim();
      if (value !== '') params[parameter.name] = value;
    }
  }
  return { endpoint: endpointSelect.value, params };
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Nie udało się wykonać zapytania. Spróbuj ponownie.';
}

function updatePreview(): void {
  try {
    urlPreview.textContent = buildUrl(inputValue());
    urlPreview.classList.remove('invalid');
    urlHint.hidden = true;
    urlHint.textContent = '';
  } catch (error) {
    urlPreview.textContent = `https://bdl.stat.gov.pl/api/v1${endpointSelect.value}`;
    urlPreview.classList.add('invalid');
    urlHint.textContent = errorMessage(error);
    urlHint.hidden = false;
  }
}

function setStatus(message: string, variant: 'idle' | 'loading' | 'success' | 'error' = 'idle'): void {
  status.className = `request-status ${variant}`;
  statusText.textContent = message;
}

function setLoading(loading: boolean): void {
  submitButton.disabled = loading;
  cancelButton.hidden = !loading;
  spinner?.toggleAttribute('hidden', !loading);
  submitLabel.textContent = loading ? 'Pobieranie…' : 'Wyślij zapytanie';
  responsePanel?.setAttribute('aria-busy', String(loading));
  loadingState.hidden = !loading;
}

function clearNotice(): void {
  if (noticeTimer !== null) window.clearTimeout(noticeTimer);
  noticeTimer = null;
  resultNotice.hidden = true;
  resultNotice.textContent = '';
}

function clearResponse(message = 'Gotowy do zapytania'): void {
  generation += 1;
  controller?.abort();
  controller = null;
  latestResult = null;
  setLoading(false);
  resultContent.hidden = true;
  resultJson.textContent = '';
  element<HTMLElement>('result-url').textContent = '';
  element<HTMLElement>('response-headers').textContent = '';
  emptyState.hidden = false;
  duration.hidden = true;
  formError.hidden = true;
  formError.textContent = '';
  clearNotice();
  setStatus(message);
}

function makeField(parameter: Parameter, preset: Record<string, string>): HTMLDivElement {
  const wrapper = document.createElement('div');
  wrapper.className = `field${parameter.name === 'name' || parameter.type === 'array' ? ' field-wide' : ''}`;
  const id = `param-${parameter.name}`;
  const label = document.createElement('label');
  label.htmlFor = id;
  label.append(document.createTextNode(labels[parameter.name] ?? parameter.name));
  if (parameter.required) {
    const marker = document.createElement('span');
    marker.className = 'required-marker';
    marker.textContent = ' *';
    marker.setAttribute('aria-hidden', 'true');
    label.append(marker);
  }
  if (labels[parameter.name]) {
    const key = document.createElement('span');
    key.className = 'parameter-key';
    key.textContent = parameter.name;
    label.append(key);
  }
  const input = parameter.type === 'enum' ? document.createElement('select') : document.createElement('input');
  input.id = id;
  input.name = parameter.name;
  input.required = parameter.required;
  input.setAttribute('aria-describedby', `${id}-help`);
  if (input instanceof HTMLSelectElement) {
    const blank = new Option(parameter.required ? 'Wybierz wartość' : 'Domyślnie (API)', '');
    input.add(blank);
    for (const value of parameter.values ?? []) {
      const visible = parameter.name === 'lang' ? ({ pl: 'Polski (pl)', en: 'Angielski (en)' }[value] ?? value) : value;
      input.add(new Option(visible, value));
    }
  } else {
    input.type = 'text';
    input.autocomplete = 'off';
    input.spellcheck = false;
    if (parameter.type === 'integer') input.inputMode = 'numeric';
    input.placeholder = parameter.type === 'array' ? 'np. 2023, 2024' : parameter.default ?? (parameter.required ? 'Wymagane' : 'Opcjonalnie');
  }
  input.value = preset[parameter.name] ?? parameter.default ?? '';
  const description = document.createElement('p');
  description.id = `${id}-help`;
  description.className = 'field-help';
  const extra = parameter.type === 'array' ? ' Wiele wartości oddziel przecinkami.' : '';
  description.textContent = (help[parameter.name] ?? (parameter.location === 'path' ? 'Parametr ścieżki adresu API.' : 'Opcjonalny filtr zapytania.')) + extra;
  wrapper.append(label, input, description);
  return wrapper;
}

function renderParameters(preset: Record<string, string> = {}): void {
  const endpoint = selectedEndpoint();
  parameters.replaceChildren();
  for (const parameter of endpoint.parameters) parameters.append(makeField(parameter, preset));
  if (endpoint.parameters.length === 0) {
    const note = document.createElement('p');
    note.className = 'no-parameters';
    note.textContent = 'Ta metoda nie wymaga dodatkowych parametrów.';
    parameters.append(note);
  }
  element<HTMLElement>('endpoint-description').textContent = endpoint.path;
  clearResponse();
  updatePreview();
}

function markPreset(key: string | null): void {
  for (const button of presets) button.setAttribute('aria-pressed', String(button.dataset.preset === key));
}

function applyPreset(key: string): void {
  const preset = presetData[key];
  if (!preset || !endpoints.some((endpoint) => endpoint.path === preset.endpoint)) return;
  endpointSelect.value = preset.endpoint;
  renderParameters(preset.params);
  markPreset(key);
}

function isApiResult(value: unknown): value is ApiResult {
  if (typeof value !== 'object' || value === null) return false;
  const result = value as Record<string, unknown>;
  return typeof result.url === 'string' && typeof result.status === 'number'
    && typeof result.statusText === 'string' && typeof result.durationMs === 'number'
    && 'body' in result && typeof result.headers === 'object' && result.headers !== null;
}

function displayResult(result: ApiResult): void {
  latestResult = result;
  emptyState.hidden = true;
  resultContent.hidden = false;
  resultJson.textContent = JSON.stringify(result.body, null, 2) ?? 'null';
  resultJson.scrollTop = 0;
  resultJson.scrollLeft = 0;
  element<HTMLElement>('result-url').textContent = result.url;
  element<HTMLElement>('response-headers').textContent = Object.entries(result.headers).map(([key, value]) => `${key}: ${value}`).join('\n') || 'Brak nagłówków.';
  const good = result.status >= 200 && result.status < 300;
  setStatus(`${result.status} ${result.statusText || (good ? 'OK' : 'Odpowiedź API')}`, good ? 'success' : 'error');
  duration.textContent = `${Math.round(result.durationMs).toLocaleString('pl-PL')} ms`;
  duration.hidden = false;
  element<HTMLElement>('response-summary').textContent = good ? 'Treść odpowiedzi' : 'Treść odpowiedzi błędu API';
  if (result.status === 429) {
    const retryAfter = Object.entries(result.headers).find(([key]) => key.toLowerCase() === 'retry-after')?.[1];
    resultNotice.textContent = retryAfter
      ? `GUS ograniczył liczbę zapytań. Retry-After: ${retryAfter}. Poczekaj przed ponownym wysłaniem zapytania.`
      : 'GUS ograniczył liczbę zapytań. Poczekaj chwilę przed ponownym wysłaniem zapytania.';
    resultNotice.hidden = false;
  }
}

form.addEventListener('submit', async (event: SubmitEvent) => {
  event.preventDefault();
  if (controller) return;
  formError.hidden = true;
  clearNotice();
  let input: RequestInput;
  try {
    input = inputValue();
    buildUrl(input);
  } catch (error) {
    formError.textContent = errorMessage(error);
    formError.hidden = false;
    return;
  }
  clearResponse();
  const requestGeneration = generation;
  const requestController = new AbortController();
  controller = requestController;
  setLoading(true);
  emptyState.hidden = true;
  setStatus('Oczekiwanie na odpowiedź GUS…', 'loading');
  try {
    const response = await fetch('/api/request', {
      method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(input), signal: requestController.signal,
    });
    const text = await response.text();
    let result: unknown;
    try { result = JSON.parse(text) as unknown; }
    catch { throw new Error('Serwer aplikacji zwrócił nieprawidłową odpowiedź. Spróbuj ponownie.'); }
    if (requestGeneration !== generation) return;
    if (!response.ok) {
      const message = typeof result === 'object' && result !== null && 'error' in result && typeof result.error === 'string'
        ? result.error : `Serwer aplikacji zwrócił błąd HTTP ${response.status}.`;
      throw new Error(message);
    }
    if (!isApiResult(result)) throw new Error('Nieprawidłowy format odpowiedzi serwera aplikacji.');
    displayResult(result);
  } catch (error) {
    if (requestGeneration !== generation) return;
    emptyState.hidden = false;
    if (error instanceof DOMException && error.name === 'AbortError') {
      setStatus('Zapytanie anulowane');
    } else {
      const message = error instanceof TypeError ? 'Nie można połączyć się z serwerem aplikacji. Sprawdź połączenie i spróbuj ponownie.' : errorMessage(error);
      formError.textContent = message;
      formError.hidden = false;
      setStatus('Nie udało się pobrać danych', 'error');
    }
  } finally {
    if (requestGeneration === generation) {
      controller = null;
      setLoading(false);
    }
  }
});

cancelButton.addEventListener('click', () => clearResponse('Zapytanie anulowane'));
endpointSelect.addEventListener('change', () => { renderParameters(); markPreset(null); });
element<HTMLButtonElement>('reset').addEventListener('click', () => { renderParameters(); markPreset(null); });
parameters.addEventListener('input', () => { clearResponse(); markPreset(null); updatePreview(); });
parameters.addEventListener('change', () => { clearResponse(); markPreset(null); updatePreview(); });
for (const button of presets) button.addEventListener('click', () => applyPreset(button.dataset.preset ?? ''));

function notice(message: string): void {
  clearNotice();
  resultNotice.textContent = message;
  resultNotice.hidden = false;
  noticeTimer = window.setTimeout(clearNotice, 5000);
}

element<HTMLButtonElement>('copy').addEventListener('click', async () => {
  if (!latestResult) return;
  const resultGeneration = generation;
  try {
    await navigator.clipboard.writeText(JSON.stringify(latestResult.body, null, 2));
    if (resultGeneration === generation) notice('Skopiowano odpowiedź JSON.');
  } catch {
    if (resultGeneration === generation) notice('Kopiowanie jest niedostępne. Zaznacz treść odpowiedzi lub pobierz plik JSON.');
  }
});

element<HTMLButtonElement>('download').addEventListener('click', () => {
  if (!latestResult) return;
  const blob = new Blob([JSON.stringify(latestResult.body, null, 2)], { type: 'application/json;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `gus-bdl-${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
  document.body.append(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
});

const groups = new Map<string, HTMLOptGroupElement>();
for (const endpoint of endpoints) {
  const segment = endpoint.path.split('/').filter(Boolean)[0] ?? 'inne';
  let group = groups.get(segment);
  if (!group) {
    group = document.createElement('optgroup');
    group.label = groupLabels[segment] ?? segment;
    groups.set(segment, group);
    endpointSelect.append(group);
  }
  group.append(new Option(`${endpoint.label} · ${endpoint.path}`, endpoint.path));
}
element<HTMLElement>('endpoint-count').textContent = `${endpoints.length} metod GET`;
if (endpoints.some((endpoint) => endpoint.path === presetData.warszawa?.endpoint)) applyPreset('warszawa');
else if (endpoints.length > 0) renderParameters();
else {
  submitButton.disabled = true;
  formError.textContent = 'Katalog metod API jest niedostępny.';
  formError.hidden = false;
}
