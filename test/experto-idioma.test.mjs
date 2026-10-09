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
    URLSearchParams,
  };
  sandbox.window = sandbox;
  sandbox.globalThis = sandbox;
  vm.runInNewContext(src, sandbox, { filename: 'experto.js' });
  return { api: sandbox.AdmiraExperto, documentElement, setLang: sandbox.AdmiraSetLanguage, sandbox, storage, location };
}

test('parseLangCommand: toggle, fijar, typo y pegados', () => {
  const { api, documentElement } = withLang('es');
  assert.equal(api.parseLangCommand('/foo'), null);
  assert.deepEqual(snap(api.parseLangCommand('/idioma')), { ok: true, lang: 'en', verb: 'idioma', toggled: true });
  assert.deepEqual(snap(api.parseLangCommand('/language')), { ok: true, lang: 'en', verb: 'language', toggled: true });
  assert.deepEqual(snap(api.parseLangCommand('/languague')), { ok: true, lang: 'en', verb: 'languague', toggled: true });
  assert.deepEqual(snap(api.parseLangCommand('/idioma ESP')), { ok: true, lang: 'es', verb: 'idioma', toggled: false });
  assert.deepEqual(snap(api.parseLangCommand('/language ENG')), { ok: true, lang: 'en', verb: 'language', toggled: false });
  assert.deepEqual(snap(api.parseLangCommand('idiomaESP')), { ok: true, lang: 'es', verb: 'idioma', toggled: false });
  assert.deepEqual(snap(api.parseLangCommand('/idiomaENG')), { ok: true, lang: 'en', verb: 'idioma', toggled: false });
  assert.deepEqual(snap(api.parseLangCommand('languageENG')), { ok: true, lang: 'en', verb: 'language', toggled: false });
  assert.deepEqual(snap(api.parseLangCommand('languagueESP')), { ok: true, lang: 'es', verb: 'languague', toggled: false });
  assert.deepEqual(snap(api.parseLangCommand('idioma ENG')), { ok: true, lang: 'en', verb: 'idioma', toggled: false });
  assert.equal(snap(api.parseLangCommand('/idioma foo')).ok, false);
  documentElement.lang = 'en';
  assert.deepEqual(snap(api.parseLangCommand('/idioma')), { ok: true, lang: 'es', verb: 'idioma', toggled: true });
});

test('AdmiraSetLanguage actualiza html.lang', () => {
  const { documentElement, setLang } = withLang('es');
  assert.equal(setLang('en'), 'en');
  assert.equal(documentElement.lang, 'en');
  assert.equal(setLang('es'), 'es');
  assert.equal(documentElement.lang, 'es');
});

test('applyLang guarda admiranext_expert_lang y navega con PixeriaIdioma.url', () => {
  const { setLang, sandbox, storage, location } = withLang('en');
  const fuimos = [];
  location.assign = (u) => fuimos.push(u);
  sandbox.PixeriaIdioma = { url: (l) => (l === 'es' ? '/stock.html?cliente=altadis&lang=es' : '') };
  setLang('es');
  assert.equal(storage.getItem('admiranext_expert_lang'), 'es');
  assert.deepEqual(fuimos, ['/stock.html?cliente=altadis&lang=es']);
  setLang('en');
  assert.equal(storage.getItem('admiranext_expert_lang'), 'en');
  assert.deepEqual(fuimos, ['/stock.html?cliente=altadis&lang=es'], 'si la pata dice que ya estás, no se navega');
});

test('con una demo en la URL, applyLang no salta a /en/ y deja el idioma pedido', () => {
  const { setLang, sandbox, storage, location, documentElement } = withLang('es');
  location.search = '?ax_demo=studio&ax_run=abc';
  location.href = 'https://www.admira.studio/?ax_demo=studio&ax_run=abc';
  const fuimos = [];
  location.assign = (u) => fuimos.push(u);
  sandbox.PixeriaIdioma = { url: (l) => (l === 'en' ? '/en/?ax_demo=studio' : '/') };
  assert.equal(setLang('en'), 'en');
  assert.equal(documentElement.lang, 'en');
  assert.equal(storage.getItem('admiranext_expert_lang'), 'en');
  assert.deepEqual(fuimos, []);
});

test('list/has/exec: el CLI del armazón de admiranext.com delega en los verbos de la piel', () => {
  const { api } = withLang('es');
  const nombres = api.list().map((v) => v.name);
  for (const n of ['marca', 'idioma', 'estado', 'version']) assert.ok(nombres.includes(n), n);
  assert.ok(api.has('/language') && api.has('idioma') && !api.has('nada'));
  const items = [];
  const log = { children: items, appendChild(li) { items.push(li); }, removeChild() { items.shift(); }, get firstChild() { return items[0]; }, scrollTop: 0, scrollHeight: 0 };
  api.exec('/version', log, { echo: false });
  assert.ok(items.length > 0);
  assert.ok(!items.some((li) => String(li.textContent).startsWith('› ')), 'sin eco cuando echo:false');
  items.length = 0;
  api.exec('/version', log);
  assert.equal(items[0].textContent, '› /version');
});
