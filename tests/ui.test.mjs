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
  assert.deepEqual(JSON.parse(ui.get('response-json').textContent),body);
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
  assert.deepEqual(JSON.parse(ui.get('response-json').textContent),{new:true});
  assert.equal(ui.get('submit').disabled,false);
});

test('UI: upstream429 remains inspectable with retry guidance', async () => {
  const ui=await setup(async()=>response(result({status:429,statusText:'Too Many Requests',headers:{'retry-after':'60'},body:{error:'Limit'}})));
  ui.submit();await tick();await tick();
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
