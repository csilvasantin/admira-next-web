// Verbos bilingües del ⌘ Experto (Carlos, 06-10-2026 10:58): /marca = /brand, formas compactas
// (/marca84, /brand84, /marcaoff, /brandoff) y el idioma del verbo pasa a ser el de la web.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const dir = dirname(fileURLToPath(import.meta.url));
const src = readFileSync(join(dir, '../suite/experto.js'), 'utf8');
const frame = readFileSync(join(dir, '../assets/admira-frame.js'), 'utf8');
const integra = readFileSync(join(dir, '../assets/experto-admiranext.js'), 'utf8');

function withLang(initial, extra = {}) {
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
  Object.assign(sandbox, extra);
  sandbox.window = sandbox;
  sandbox.globalThis = sandbox;
  vm.runInNewContext(src, sandbox, { filename: 'experto.js' });
  return { api: sandbox.AdmiraExperto, documentElement, setLang: sandbox.AdmiraSetLanguage, sandbox, storage, location };
}


function consola(initial) {
  const llamadas = [];
  const AdmiraMarca = {
    activar: (id) => { llamadas.push(['activar', id]); return Promise.resolve({ ok: true, id }); },
    desactivar: () => { llamadas.push(['desactivar']); return { changed: true }; },
  };
  const h = withLang(initial, { AdmiraMarca });
  const log = { children: [], tagName: 'OL', querySelector: () => null, insertBefore(x) { this.children.unshift(x); }, appendChild(x) { this.children.push(x); }, removeChild() {}, get firstChild() { return this.children[0]; }, scrollTop: 0, scrollHeight: 0 };
  const run = async (t) => { await h.api.exec(t, log, { echo: false }); return h.documentElement.lang; };
  return { ...h, llamadas, log, run, texto: () => log.children.map((li) => li.textContent).join('\n') };
}

test('/brand84 aplica la 84 y pone inglés; /marca84 aplica la 84 y pone castellano', async () => {
  const c = consola('es');
  assert.equal(await c.run('/brand84'), 'en');
  assert.deepEqual(c.llamadas.at(-1), ['activar', '84']);
  assert.equal(await c.run('/marca84'), 'es');
  assert.deepEqual(c.llamadas.at(-1), ['activar', '84']);
  assert.equal(await c.run('/brand 85'), 'en');
  assert.deepEqual(c.llamadas.at(-1), ['activar', '85']);
  assert.equal(await c.run('/marca 86'), 'es');
  assert.deepEqual(c.llamadas.at(-1), ['activar', '86']);
});

test('/marcaoff, /brandoff, /marca off y /brand off vuelven a Admira (y fijan su idioma)', async () => {
  const c = consola('es');
  assert.equal(await c.run('/brandoff'), 'en');
  assert.deepEqual(c.llamadas.at(-1), ['desactivar']);
  assert.equal(await c.run('/marcaoff'), 'es');
  assert.equal(await c.run('/brand off'), 'en');
  assert.equal(await c.run('/marca off'), 'es');
  assert.equal(c.llamadas.filter((x) => x[0] === 'desactivar').length, 4);
});

test('pares ES/EN de la suite: el castellano pone castellano y el inglés inglés', async () => {
  const c = consola('es');
  for (const [es, en] of [['ayuda', 'help'], ['estado', 'status'], ['limpiar', 'clear'], ['ir', 'go']]) {
    assert.equal(await c.run('/' + en), 'en', en);
    assert.equal(await c.run('/' + es), 'es', es);
  }
  assert.deepEqual(JSON.parse(JSON.stringify(c.api.pares())), [['ayuda', 'help'], ['marca', 'brand'], ['ir', 'go'], ['estado', 'status'], ['limpiar', 'clear']]);
  for (const [es, en] of c.api.pares()) assert.ok(c.api.has(es) && c.api.has(en), es + '/' + en);
});

test('lo que se escribe igual en los dos idiomas y los atajos /NN no tocan el idioma', async () => {
  const c = consola('en');
  c.api.verb({ name: '84', alias: [], desc: ['atajo', 'shortcut'], run: () => {} });
  assert.equal(await c.run('/84'), 'en');
  assert.equal(await c.run('/version'), 'en');
  c.documentElement.lang = 'es';
  assert.equal(await c.run('/84'), 'es');
});

test('/marcablanca sigue siendo alias (no es «/marca blanca») y un verbo inventado sigue dando error', async () => {
  const c = consola('es');
  await c.run('/marcablanca 84');
  assert.deepEqual(c.llamadas.at(-1), ['activar', '84']);
  await c.run('/marcadorx');
  assert.match(c.texto(), /Verbo desconocido|Brand|Marca|marca/);
});

test('/help enseña cada verbo con su pareja', async () => {
  const c = consola('es');
  await c.run('/ayuda');
  const t = c.texto();
  for (const par of ['/help · /ayuda', '/marca · /brand', '/ir · /go', '/estado · /status', '/limpiar · /clear']) assert.ok(t.includes(par), par);
});

test('armazón (admira-frame.js): tabla de pares, alias automáticos, forma compacta y cambio de idioma', () => {
  assert.match(frame, /var PARES_ES_EN = \[/);
  for (const par of ["['ayuda', 'help']", "['limpiar', 'clear']", "['ir', 'go']", "['seccion', 'section']", "['marca', 'brand']", "['estado', 'status']", "['buscar', 'search']"]) assert.ok(frame.includes(par), par);
  assert.match(frame, /var COMPACTO = \/\^\(marca\|brand\)\(off\|\[a-z0-9\]\[a-z0-9_-\]\*\)\$\/;/);
  assert.match(frame, /function ponerIdioma\(l\)/);
  assert.match(frame, /var idioma = v\.piel \? null : idiomaDeVerbo/);
  assert.match(integra, /uso: v\.args \|\| '', piel: true,/);
});

test('terminal de la home: reenvía al Experto las formas compactas, no /marcador', () => {
  const m = integra.match(/var esMarca = (.+);\n/);
  assert.ok(m);
  const esMarca = (v) => vm.runInNewContext(m[1], { v });
  for (const ok of ['/marca 84', '/brand 84', '/marca84', '/brand84', '/marcaoff', '/brandoff', '/84', 'brand85']) assert.equal(!!esMarca(ok), true, ok);
  for (const no of ['/marcador', '/help', '/8', '/90']) assert.equal(!!esMarca(no), false, no);
});
