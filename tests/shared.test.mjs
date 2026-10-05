import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { endpoints } from '../dist/catalog.js';
import { BDL_BASE, buildUrl } from '../dist/shared.js';

const input = (endpoint, params = {}) => ({ endpoint, params });

// The checked-in upstream specification is the contract, not a hand-picked subset.
test('catalog contains every documented GET endpoint and parameter contract', async () => {
  const spec = JSON.parse(await readFile(new URL('../docs/bdl-openapi.json', import.meta.url), 'utf8'));
  const operations = Object.entries(spec.paths).filter(([, value]) => value.get);
  assert.equal(endpoints.length, 36);
  assert.equal(new Set(endpoints.map(endpoint => endpoint.path)).size, endpoints.length);
  assert.deepEqual(endpoints.map(endpoint => endpoint.path).sort(), operations.map(([path]) => path).sort());
  for (const [path, operation] of operations) {
    const endpoint = endpoints.find(value => value.path === path);
    assert.ok(endpoint.label.length > 4, path);
    const parameters = operation.get.parameters.filter(parameter => ['path', 'query'].includes(parameter.in) && !['format', 'lang'].includes(parameter.name));
    assert.equal(endpoint.parameters.length, parameters.length, path);
    for (const parameter of parameters) {
      const actual = endpoint.parameters.find(value => value.name === parameter.name);
      assert.ok(actual, `${path}: ${parameter.name}`);
      assert.equal(actual.location, parameter.in);
      assert.equal(actual.type, parameter.schema.type);
      assert.equal(actual.required, parameter.required ?? false);
      assert.equal(actual.default, parameter.schema.default === undefined ? undefined : String(parameter.schema.default));
      assert.equal(actual.itemType, parameter.schema.items?.type);
      assert.deepEqual(actual.values, (parameter.schema.enum ?? parameter.schema.items?.enum)?.map(String));
    }
  }
});

test('every catalog endpoint builds a URL with its required parameters', () => {
  for (const endpoint of endpoints) {
    const params = Object.fromEntries(endpoint.parameters.filter(parameter => parameter.required).map(parameter => [parameter.name, parameter.name === 'name' ? 'ludność' : parameter.values?.[0] ?? '1']));
    const url = new URL(buildUrl(input(endpoint.path, params)));
    assert.equal(url.origin, 'https://bdl.stat.gov.pl');
    assert.ok(url.pathname.startsWith('/api/v1/'));
    assert.ok(!url.pathname.includes('{'), endpoint.path);
    assert.equal(url.searchParams.get('format'), 'json');
    assert.equal(url.searchParams.get('lang'), 'pl');
  }
});

test('base URL, mandatory output format and pagination defaults are stable', () => {
  assert.equal(BDL_BASE, 'https://bdl.stat.gov.pl/api/v1');
  assert.equal(buildUrl(input('/version')), `${BDL_BASE}/version?format=json&lang=pl`);
  const url = new URL(buildUrl(input('/data/by-variable/{var-id}', { 'var-id': '64428' })));
  assert.equal(url.pathname, '/api/v1/data/by-variable/64428');
  assert.equal(url.searchParams.get('aggregate-id'), '1');
  assert.equal(url.searchParams.get('page'), '0');
  assert.equal(url.searchParams.get('page-size'), '10');
});

test('string path identifiers retain leading zeros and safe punctuation', () => {
  for (const id of ['011200000000', 'P1234', 'test-id_1']) {
    assert.equal(new URL(buildUrl(input('/units/{id}', { id }))).pathname, `/api/v1/units/${id}`);
  }
});

test('query strings are encoded once and cannot inject query fields or change the host', () => {
  const name = ' Łódź &lang=en#?url=https://attacker.invalid/ + test ';
  const url = new URL(buildUrl(input('/subjects/search', { name })));
  assert.equal(url.origin, 'https://bdl.stat.gov.pl');
  assert.equal(url.searchParams.get('name'), name.trim());
  assert.deepEqual(url.searchParams.getAll('lang'), ['pl']);
  assert.equal(url.searchParams.has('url'), false);
  assert.equal(url.hash, '');
});

test('array values use repeated query fields; sort enum commas remain one value', () => {
  const url = new URL(buildUrl(input('/units/search', { level: ' 0, 2 ,6 ', year: '2023, 2024', sort: 'Id,-Name' })));
  assert.deepEqual(url.searchParams.getAll('level'), ['0', '2', '6']);
  assert.deepEqual(url.searchParams.getAll('year'), ['2023', '2024']);
  assert.deepEqual(url.searchParams.getAll('sort'), ['Id,-Name']);
  const data = new URL(buildUrl(input('/data/by-unit/{unit-id}', { 'unit-id': '011200000000', 'var-id': '64428, 64429' })));
  assert.deepEqual(data.searchParams.getAll('var-id'), ['64428', '64429']);
});

test('explicit blank optional parameters are omitted; zero is retained', () => {
  const url = new URL(buildUrl(input('/units', { 'parent-id': ' ', page: '0', 'page-size': '' })));
  assert.equal(url.searchParams.has('parent-id'), false);
  assert.equal(url.searchParams.has('page-size'), false);
  assert.equal(url.searchParams.get('page'), '0');
});

test('buildUrl does not mutate the submitted request', () => {
  const request = Object.freeze({ endpoint: '/units/search', params: Object.freeze({ name: ' Łódź ', year: '2023, 2024' }) });
  const before = JSON.stringify(request);
  buildUrl(request);
  assert.equal(JSON.stringify(request), before);
});

test('rejects malformed input shapes and non-string parameter values', () => {
  for (const malformed of [undefined, null, false, 42, '', [], {}, { endpoint: '/version' }, { endpoint: 1, params: {} }, { endpoint: '/version', params: null }, { endpoint: '/version', params: [] }, { endpoint: '/version', params: 'x' }]) {
    assert.throws(() => buildUrl(malformed), Error, JSON.stringify(malformed));
  }
  for (const value of [null, 1, false, [], {}, ['1']]) {
    assert.throws(() => buildUrl(input('/units', { page: value })), /Nieprawidłowa wartość/);
  }
});

test('rejects unknown endpoints, query fields, output overrides and prototype keys', () => {
  for (const endpoint of ['https://attacker.invalid/', '//attacker.invalid/', '/api/v1/units', '/units/1', '/version?format=xml', '/version/../units', '/VERSION']) {
    assert.throws(() => buildUrl(input(endpoint)), /obsługiwaną metodę/);
  }
  for (const name of ['format', 'lang', 'url', 'headers', 'constructor', '__proto__']) {
    const params = JSON.parse(`{${JSON.stringify(name)}:"test"}`);
    assert.throws(() => buildUrl(input('/version', params)), /Nieznany parametr/);
  }
});

test('requires path and query parameters even if supplied as whitespace', () => {
  for (const endpoint of ['/units/{id}', '/data/by-variable/{var-id}', '/subjects/search', '/units/localities']) {
    assert.throws(() => buildUrl(input(endpoint)), /Uzupełnij parametr/);
  }
  assert.throws(() => buildUrl(input('/units/{id}', { id: ' \n\t ' })), /Uzupełnij parametr id/);
  assert.throws(() => buildUrl(input('/data/by-unit/{unit-id}', { 'unit-id': '000000000000', 'var-id': ' ' })), /Uzupełnij parametr var-id/);
});

test('rejects path traversal, encoded separators and unsafe path identifiers', () => {
  for (const id of ['../version', '..', '.', 'x/y', 'x\\y', '%2f', '%2e%2e', 'x?foo=y', 'x#fragment', '//attacker.invalid', 'x y', 'ą', 'x\u0000y', 'x\ny']) {
    assert.throws(() => buildUrl(input('/units/{id}', { id })), /niedozwolony identyfikator/, JSON.stringify(id));
  }
});

test('integer validation enforces nonnegative int32 without coercion', () => {
  for (const value of ['-1', '1.0', '1.2', '+1', '1e2', '0x10', 'Infinity', 'NaN', '2147483648', '9007199254740992', '١', '1 2']) {
    assert.throws(() => buildUrl(input('/variables/{id}', { id: value })), /int32/, value);
  }
  for (const value of ['0', '1', '2147483647']) {
    assert.equal(new URL(buildUrl(input('/variables/{id}', { id: value }))).pathname, `/api/v1/variables/${value}`);
  }
});

test('checks page size, geographic levels, year boundaries and enums', () => {
  for (const value of ['0', '101']) assert.throws(() => buildUrl(input('/units', { 'page-size': value })), /1–100/);
  for (const value of ['1', '100']) assert.equal(new URL(buildUrl(input('/units', { 'page-size': value }))).searchParams.get('page-size'), value);
  for (const value of ['7', '10', '00']) assert.throws(() => buildUrl(input('/variables', { level: value })), /0–6/);
  for (const value of ['0', '6']) assert.equal(new URL(buildUrl(input('/variables', { level: value }))).searchParams.get('level'), value);
  for (const value of ['1899', '2101']) assert.throws(() => buildUrl(input('/variables', { year: value })), /1900–2100/);
  for (const value of ['1900', '2100']) assert.equal(new URL(buildUrl(input('/variables', { year: value }))).searchParams.get('year'), value);
  assert.throws(() => buildUrl(input('/units', { sort: 'name' })), /niedozwolona wartość/);
  assert.throws(() => buildUrl(input('/units', { level: '7' })), /niedozwolona wartość/);
});

test('array limit is 20 and empty items are rejected', () => {
  const request = values => input('/data/by-unit/{unit-id}', { 'unit-id': '000000000000', 'var-id': values });
  assert.equal(new URL(buildUrl(request(Array.from({ length: 20 }, (_, i) => String(i)).join(',')))).searchParams.getAll('var-id').length, 20);
  for (const values of [',', ',1', '1,', '1,,2', '1, ,2', Array(21).fill('1').join(',')]) {
    assert.throws(() => buildUrl(request(values)), /1–20/);
  }
  assert.throws(() => buildUrl(request('1,invalid')), /int32/);
});

test('string parameter length is limited to 500 characters before trimming', () => {
  assert.equal(new URL(buildUrl(input('/subjects/search', { name: 'a'.repeat(500) }))).searchParams.get('name').length, 500);
  assert.throws(() => buildUrl(input('/subjects/search', { name: 'a'.repeat(501) })), /Nieprawidłowa wartość/);
  assert.throws(() => buildUrl(input('/subjects/search', { name: ' '.repeat(501) })), /Nieprawidłowa wartość/);
});
