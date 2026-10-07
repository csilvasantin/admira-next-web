// /demo · las cinco soluciones de la suite.
// Parse de /idioma · /language (Carlos, 5-oct-2026): toggle, ESP/ENG, typos y pegados.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const dir = dirname(fileURLToPath(import.meta.url));
const src = readFileSync(join(dir, '../suite/experto.js'), 'utf8');
const snap = (v) => (v == null ? v : JSON.parse(JSON.stringify(v)));

function withLang(initial) {
  const documentElement = { lang: initial, dataset: {}, setAttribute() {}, getAttribute() { return null; }, classList: { contains: () => false, add() {}, toggle() {} } };
  const document = {
    documentElement,
    currentScript: { dataset: {} },
    readyState: 'complete',
    querySelector: () => null,
    querySelectorAll: () => [],
    createElement: (tag) => ({
      tagName: String(tag).toUpperCase(),
      classList: { add() {}, contains: () => false, toggle() {} },
      setAttribute() {}, getAttribute: () => null, appendChild() {}, style: {},
      addEventListener() {}, querySelector: () => null, querySelectorAll: () => [],
      textContent: '', children: [], insertBefore() {}, removeAttribute() {},
    }),
    addEventListener() {},
    head: { appendChild() {} },
    body: { appendChild() {} },
    dispatchEvent() {},
  };
  const location = { hostname: 'www.admiranext.com', host: 'www.admiranext.com', href: 'https://www.admiranext.com/', pathname: '/', search: '', hash: '', origin: 'https://www.admiranext.com', assign() {} };
  const storage = { _m: {}, getItem(k) { return k in this._m ? this._m[k] : null; }, setItem(k, v) { this._m[k] = String(v); }, removeItem(k) { delete this._m[k]; } };
  const root = {
    document, location,
    localStorage: storage, sessionStorage: storage,
    dispatchEvent() {}, addEventListener() {},
    MutationObserver: class { observe() {} disconnect() {} },
    CustomEvent: class CustomEvent { constructor(t, i) { this.type = t; this.detail = i && i.detail; } },
    Event: class Event { constructor(t) { this.type = t; } },
    URL, fetch: async () => ({ ok: false, json: async () => ({}) }),
    setTimeout, clearTimeout,
  };
  const sandbox = {
    ...root, window: null, globalThis: null, document, location,
    localStorage: storage, sessionStorage: storage, URL,
    fetch: root.fetch, setTimeout, clearTimeout,
    MutationObserver: root.MutationObserver, CustomEvent: root.CustomEvent, Event: root.Event,
  };
  sandbox.window = sandbox;
  sandbox.globalThis = sandbox;
  vm.runInNewContext(src, sandbox, { filename: 'experto.js' });
  return { api: sandbox.AdmiraExperto, documentElement, setLang: sandbox.AdmiraSetLanguage, sandbox, storage, location };
}


// /demo de las cinco soluciones (Carlos, 7-oct-2026, demo Alsea · Starbucks).
test('parseDemo: lista, soluciones, alias, números y siguiente', () => {
  const { api } = withLang('es');
  assert.deepEqual(snap(api.parseDemo('/demo')), { lista: true });
  assert.deepEqual(snap(api.parseDemo('/demo lista')), { lista: true });
  assert.equal(api.parseDemo('/demo store').id, 'store');
  assert.equal(api.parseDemo('/demo admira.studio').id, 'studio');
  assert.equal(api.parseDemo('/demo yokup').id, 'app');
  assert.equal(api.parseDemo('/demo 5').id, 'biz');
  assert.equal(api.parseDemo('/demo TV').id, 'tv');
  // admiranext.com no es ninguna de las cinco: siguiente = la primera.
  assert.equal(api.parseDemo('/demo siguiente').id, 'studio');
  // Lo que no es de la suite sigue siendo de la pata (/demo tpv, /demo off).
  assert.equal(api.parseDemo('/demo tpv'), null);
  assert.equal(api.parseDemo('/demo off'), null);
  assert.equal(api.parseDemo('/demos'), null);
  assert.match(api.parseDemo('/demo store').url, /admira-xp\/.*loc=alsea-sbux-021.*demo=tpv/);
});

test('demos: cinco soluciones en orden y URL en inglés', () => {
  const { api, documentElement } = withLang('en');
  const list = api.demos();
  assert.deepEqual(snap(list.map((d) => d.id)), ['studio', 'store', 'tv', 'app', 'biz']);
  assert.match(list[0].url, /\/en\/anonimizador/);
  assert.match(list[1].url, /lang=en/);
  documentElement.lang = 'es';
  assert.match(api.demos()[1].url, /lang=es/);
});

test('/demo como verbo: lista y navegación', async () => {
  const { api, location } = withLang('es');
  const lines = [];
  const log = { appendChild: (li) => lines.push(li.textContent), children: [], scrollTop: 0, scrollHeight: 0 };
  let went = '';
  location.assign = (u) => { went = u; };
  api.exec('/demo', log);
  assert.ok(lines.some((l) => /1 \/demo studio/.test(l)) && lines.some((l) => /5 \/demo biz/.test(l)));
  api.exec('/demo 2', log);
  await new Promise((r) => setTimeout(r, 700));
  assert.match(went, /admira\.store\/admira-xp\//);
});
