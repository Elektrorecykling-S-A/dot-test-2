import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { parseHTML } from 'linkedom';

const html = await readFile(new URL('../public/index.html', import.meta.url), 'utf8');
let serial = 0;
const tick = () => new Promise(resolve => setImmediate(resolve));
async function setup(fetchImpl) {
  const { window, document } = parseHTML(html);
  // LinkeDOM intentionally omits these browser form convenience APIs.
  Object.defineProperty(window.HTMLSelectElement.prototype, 'value', {
    configurable: true,
    get() { return [...this.querySelectorAll('option')].find(o => o.hasAttribute('selected'))?.value ?? this.querySelector('option')?.value ?? ''; },
    set(value) { for (const option of this.querySelectorAll('option')) option.toggleAttribute('selected', option.value === value); },
  });
  window.HTMLSelectElement.prototype.add = function(option) { this.append(option); };
  globalThis.window = window;
  globalThis.document = document;
  globalThis.HTMLInputElement = window.HTMLInputElement;
  globalThis.HTMLSelectElement = window.HTMLSelectElement;
  globalThis.Option = function(text, value) {
    const option = document.createElement('option'); option.textContent = text; option.value = value; return option;
  };
  globalThis.fetch = fetchImpl;
  await import(`../dist/client.js?test=${serial++}`);
  const get = id => document.getElementById(id);
  const click = selector => document.querySelector(selector).dispatchEvent(new window.Event('click', { bubbles: true }));
  const submit = () => get('request-form').dispatchEvent(new window.Event('submit', { bubbles: true, cancelable: true }));
  const change = (id, value) => { get(id).value = value; get(id).dispatchEvent(new window.Event('input', { bubbles: true })); };
  return { window, document, get, click, submit, change };
}
const result = (overrides = {}) => ({url:'https://bdl.stat.gov.pl/api/v1/years?format=json&lang=pl', status:200, statusText:'OK', durationMs:12, headers:{'content-type':'application/json'}, body:{results:[{zero:0, flag:false, missing:null}]}, ...overrides});
const response = value => new Response(JSON.stringify(value), {headers:{'content-type':'application/json'}});

function assertCard(card, value) {
  assert.ok(card.classList.contains('response-card'));
  const type = value === null ? 'null' : Array.isArray(value) ? 'array' : typeof value;
  assert.equal(card.dataset.type, type);
  assert.equal(card.firstElementChild.className, 'response-type');
  assert.match(card.firstElementChild.textContent, new RegExp(`\\(${type}\\)`));
  assert.equal(card.children.length, 2);
  const content = card.lastElementChild;
  assert.equal(content.className, 'response-value');
  if (value !== null && typeof value === 'object') {
    const entries = Object.entries(value);
    assert.equal(content.children.length, entries.length);
    if (!entries.length) assert.equal(content.textContent, Array.isArray(value) ? '[]' : '{}');
    entries.forEach(([key, child], index) => {
      const entry = content.children[index];
      assert.equal(entry.children.length, 2);
      if (Array.isArray(value)) {
        assert.equal(entry.className, 'response-array-row');
        assert.equal(entry.firstElementChild.className, 'response-index');
        assert.equal(entry.firstElementChild.textContent, key);
        assert.equal(entry.firstElementChild.getAttribute('aria-label'), `Indeks ${key}`);
      } else {
        assert.equal(entry.className, 'response-property');
        assert.ok(entry.firstElementChild.classList.contains('response-key-card'));
        assertCard(entry.firstElementChild, key);
      }
      assertCard(entry.lastElementChild, child);
    });
  } else {
    assert.equal(content.children.length, 0);
    assert.equal(content.textContent, typeof value === 'string' ? (value === '' ? '""' : value) : String(value));
  }
}

test('UI: initial preset, all endpoints, fields and source preview', async () => {
  let calls = 0;
  const ui = await setup(async () => { calls++; return response(result()); });
  assert.equal(ui.get('endpoint').querySelectorAll('option').length,36);
  assert.equal(ui.get('param-name').value,'Warszawa');
  assert.match(ui.get('url-preview').textContent,/name=Warszawa/);
  assert.equal(calls,0);
  ui.click('[data-preset="population"]');
  assert.equal(ui.get('param-var-id').value,'3643');
  assert.equal(ui.get('param-year').value,'2024');
  assert.equal(ui.get('param-unit-level').value,'2');
});

test('UI: local validation prevents network calls', async () => {
  let calls=0; const ui=await setup(async()=>{calls++;return response(result());});
  ui.change('param-page-size','101'); ui.submit(); await tick();
  assert.equal(calls,0); assert.equal(ui.get('form-error').hidden,false);
  assert.match(ui.get('form-error').textContent,/1–100/);
});

test('UI: one request at a time and complete safe JSON output', async () => {
  let finish; let calls=0;
  const ui=await setup(()=>{calls++;return new Promise(resolve=>{finish=resolve;});});
  ui.submit(); ui.submit(); assert.equal(calls,1); assert.equal(ui.get('submit').disabled,true);
  const body={results:[{zero:0,flag:false,missing:null,html:'<img src=x onerror=alert(1)>'}]};
  finish(response(result({body}))); await tick(); await tick();
  assertCard(ui.get('response-json').firstElementChild,body);
  assert.equal(ui.get('response-json').querySelector('img'),null);
  assert.equal(ui.get('submit').disabled,false);
  assert.equal(ui.get('result-content').hidden,false);
  assert.match(ui.get('status-text').textContent,/200/);
});

test('UI: cancel invalidates an old response even when transport ignores abort', async () => {
  let finish; let signal;
  const ui=await setup((url,init)=>{signal=init.signal;return new Promise(resolve=>{finish=resolve;});});
  ui.submit(); ui.click('#cancel');
  assert.equal(signal.aborted,true); assert.equal(ui.get('submit').disabled,false);
  finish(response(result())); await tick();await tick();
  assert.equal(ui.get('result-content').hidden,true);
  assert.equal(ui.get('response-json').textContent,'');
  assert.match(ui.get('status-text').textContent,/anulowane/);
});

test('UI: newer preset request wins over stale previous response', async () => {
  const requests=[];
  const ui=await setup((url,init)=>new Promise(resolve=>requests.push({init,resolve})));
  ui.submit(); ui.click('[data-preset="years"]'); ui.submit();
  assert.equal(requests[0].init.signal.aborted,true);
  requests[1].resolve(response(result({body:{new:true}})));await tick();await tick();
  requests[0].resolve(response(result({body:{old:true}})));await tick();await tick();
  assertCard(ui.get('response-json').firstElementChild,{new:true});
  assert.equal(ui.get('submit').disabled,false);
});

test('UI: upstream429 remains inspectable with retry guidance', async () => {
  const ui=await setup(async()=>response(result({status:429,statusText:'Too Many Requests',headers:{'retry-after':'60'},body:{error:'Limit'}})));
  ui.submit();await tick();await tick();
  assertCard(ui.get('response-json').firstElementChild, {error:'Limit'});
  assert.match(ui.get('status-text').textContent,/429/);
  assert.match(ui.get('request-status').className,/error/);
  assert.match(ui.get('result-notice').textContent,/60/);
  assert.equal(ui.get('result-content').hidden,false);
});

test('UI: local/network errors restore controls and reset clears output', async () => {
  const ui=await setup(async()=>new Response(JSON.stringify({error:'GUS nie odpowiedział.'}),{status:504}));
  ui.submit();await tick();await tick();
  assert.match(ui.get('form-error').textContent,/GUS nie odpowiedział/);
  assert.equal(ui.get('submit').disabled,false);
  ui.click('#reset'); assert.equal(ui.get('form-error').hidden,true);
  assert.equal(ui.get('param-name').value,'');
});

test('UI: editing input aborts active request and updates source URL', async () => {
  let signal; const ui=await setup((url,init)=>{signal=init.signal; return new Promise(()=>{});});
  ui.submit();ui.change('param-name','Kraków');
  assert.equal(signal.aborted,true);
  assert.match(ui.get('url-preview').textContent,/name=Krak%C3%B3w/);
  assert.equal(ui.get('submit').disabled,false);
});


test('UI: every value has a typed card with names, indexes and empty values preserved', async () => {
  const body = JSON.parse('{"": "", "nested": [{"zero":0,"false":false,"null":null,"emptyArray":[],"emptyObject":{},"text":"first\\nsecond"}],"<script>alert(1)</script>":"<img src=x onerror=alert(1)>"}');
  const ui = await setup(async () => response(result({body})));
  ui.submit(); await tick(); await tick();
  assertCard(ui.get('response-json').firstElementChild, body);
  assert.equal(ui.get('response-json').querySelector('script, img'), null);
});

test('UI: top-level scalars, arrays and empty containers remain visible', async () => {
  for (const body of [null, false, 0, '', 'plain upstream text', [], {}, [1, 'two', null]]) {
    const ui = await setup(async () => response(result({body})));
    ui.submit(); await tick(); await tick();
    assertCard(ui.get('response-json').firstElementChild, body);
    assert.equal(ui.get('result-content').hidden, false);
  }
});

test('UI: copy and download retain the full JSON body rather than card labels', async () => {
  const body = {results: [{zero: 0, flag: false, missing: null, empty: '', array: [], object: {}}]};
  const expected = JSON.stringify(body, null, 2);
  const ui = await setup(async () => response(result({body})));
  ui.submit(); await tick(); await tick();
  const originalClipboard = Object.getOwnPropertyDescriptor(navigator, 'clipboard');
  const originalCreate = URL.createObjectURL;
  const originalRevoke = URL.revokeObjectURL;
  let copied, downloaded;
  try {
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: async text => { copied = text; } } });
    URL.createObjectURL = blob => { downloaded = blob; return 'blob:test'; };
    URL.revokeObjectURL = () => {};
    ui.click('#copy'); await tick();
    ui.click('#download');
    assert.equal(copied, expected);
    assert.equal(await downloaded.text(), expected);
    assert.equal(downloaded.type, 'application/json;charset=utf-8');
    ui.click('#reset');
    assert.equal(ui.get('response-json').children.length, 0);
    copied = null; downloaded = null;
    ui.click('#copy'); ui.click('#download'); await tick();
    assert.equal(copied, null); assert.equal(downloaded, null);
  } finally {
    if (originalClipboard) Object.defineProperty(navigator, 'clipboard', originalClipboard);
    else delete navigator.clipboard;
    URL.createObjectURL = originalCreate; URL.revokeObjectURL = originalRevoke;
  }
});


test('UI: object keys are full typed cards and array indexes sit outside each value card', async () => {
  const body = {'': {'a\nb': [false, {'<b>key</b>': null}, []]}, items: Array.from({length: 12}, (_, i) => i)};
  const ui = await setup(async () => response(result({body})));
  ui.submit(); await tick(); await tick();
  assertCard(ui.get('response-json').firstElementChild, body);
  assert.equal(ui.get('response-json').querySelector('b'), null);
  const row = [...ui.get('response-json').querySelectorAll('.response-array-row')].find(row => row.firstElementChild.textContent === '11');
  assert.ok(row);
  assert.equal(row.lastElementChild.querySelector('.response-index'), null);
});
