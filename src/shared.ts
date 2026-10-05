import { endpoints } from './catalog.js';

export interface Parameter {
  name: string;
  location: 'path' | 'query';
  type: 'string' | 'integer' | 'enum' | 'array';
  required: boolean;
  values?: string[];
  itemType?: string;
  default?: string;
}
export interface Endpoint { path: string; label: string; parameters: Parameter[] }
export interface RequestInput { endpoint: string; params: Record<string, string> }
export interface ApiResult {
  url: string; status: number; statusText: string; durationMs: number;
  body: unknown; headers: Record<string, string>;
}
export const BDL_BASE = 'https://bdl.stat.gov.pl/api/v1';

export function buildUrl(input: RequestInput): string {
  if (!input || typeof input !== 'object' || typeof input.endpoint !== 'string' ||
      !input.params || typeof input.params !== 'object' || Array.isArray(input.params)) {
    throw new Error('Nieprawidłowy format zapytania.');
  }
  const endpoint = endpoints.find(item => item.path === input.endpoint);
  if (!endpoint) throw new Error('Wybierz obsługiwaną metodę BDL.');
  for (const [name, value] of Object.entries(input.params)) {
    if (!endpoint.parameters.some(p => p.name === name)) throw new Error(`Nieznany parametr: ${name}.`);
    if (typeof value !== 'string' || value.length > 500) throw new Error(`Nieprawidłowa wartość: ${name}.`);
  }
  let path = endpoint.path;
  const query = new URLSearchParams({ format: 'json', lang: 'pl' });
  for (const parameter of endpoint.parameters) {
    const raw = (input.params[parameter.name] ?? parameter.default ?? '').trim();
    if (!raw) {
      if (parameter.required) throw new Error(`Uzupełnij parametr ${parameter.name}.`);
      continue;
    }
    const values = parameter.type === 'array' ? raw.split(',').map(v => v.trim()) : [raw];
    if (values.length > 20 || values.some(v => !v)) throw new Error(`${parameter.name}: podaj 1–20 wartości bez pustych pozycji.`);
    for (const value of values) {
      const type = parameter.type === 'array' ? parameter.itemType : parameter.type;
      if (type === 'integer' && (!/^\d+$/.test(value) || !Number.isSafeInteger(Number(value)) || Number(value) > 2147483647)) {
        throw new Error(`${parameter.name}: wymagana nieujemna liczba całkowita (int32).`);
      }
      if (parameter.values && !parameter.values.includes(value)) throw new Error(`${parameter.name}: niedozwolona wartość.`);
      if (parameter.name === 'page-size' && (Number(value) < 1 || Number(value) > 100)) throw new Error('page-size: dopuszczalny zakres to 1–100.');
      if (['level', 'unit-level'].includes(parameter.name) && (!/^\d$/.test(value) || Number(value) > 6)) throw new Error(`${parameter.name}: dopuszczalny zakres to 0–6.`);
      if (parameter.name === 'year' && (Number(value) < 1900 || Number(value) > 2100)) throw new Error('year: dopuszczalny zakres to 1900–2100.');
      if (parameter.location === 'path') {
        if (!/^[A-Za-z0-9_-]+$/.test(value)) throw new Error(`${parameter.name}: niedozwolony identyfikator.`);
        path = path.replace(`{${parameter.name}}`, encodeURIComponent(value));
      } else query.append(parameter.name, value);
    }
  }
  return `${BDL_BASE}${path}?${query}`;
}
