// Encargo #5462: verbos del CLI y macro biz×3 + app×2.
import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { onRequest } from '../functions/_demos.js';
import { comandoPermitido, urlDePieza, validar } from '../subdemos/admira-demo.mjs';

const dir = dirname(fileURLToPath(import.meta.url));
const macro = validar(JSON.parse(readFileSync(join(dir, '../subdemos/v2/alsea-biz-app.json'), 'utf8')));
const experto = readFileSync(join(dir, '../suite/experto.js'), 'utf8');
const motor = readFileSync(join(dir, '../suite/demo-control.js'), 'utf8');

function llamada(path) {
  return new Request('https://www.admiranext.com' + path);
}

test('la macro alsea-biz-app sale en el catálogo público y el repo no se borra', async () => {
  const lista = await (await onRequest({ request: llamada('/api/demos'), env: {} })).json();
  assert.deepEqual(lista.demos.map((demo) => demo.id), ['biz', 'store', 'studio', 'app']);
  const pieza = lista.macros.find((item) => item.id === 'alsea-biz-app');
  assert.equal(pieza.status, 'published');
  assert.equal(pieza.transition.seconds, 3);
  assert.deepEqual(pieza.items.map((item) => item.ref), ['biz/proyecto', 'biz/circuito', 'biz/gemelo', 'app/establecimientos', 'app/inventario']);
  assert.ok(pieza.items.every((item) => item.subdemo && item.subdemo.steps.length));
  const una = await (await onRequest({ request: llamada('/api/demos/alsea-biz-app'), env: {} })).json();
  assert.equal(una.kind, 'macro');
  assert.equal(una.items[0].subdemo.id, 'proyecto');
  assert.equal(una.items[3].subdemo.id, 'establecimientos');
  const borrado = await onRequest({ request: new Request('https://www.admiranext.com/api/demos/alsea-biz-app', { method: 'DELETE' }), env: {} });
  assert.equal(borrado.status, 403);
});

test('la dirección del salto solo lleva plan y contexto', () => {
  const href = urlDePieza({ ...macro, items: macro.items.map((item) => ({ ref: item.ref, subdemo: { url: 'https://user:secret@www.admiranext.com/xpace/manage?token=no' } })) }, 0, 'run-1', 'en');
  const url = new URL(href);
  assert.equal(url.origin + url.pathname, 'https://www.admira.biz/');
  assert.deepEqual([...url.searchParams.keys()].sort(), ['ax_demo', 'ax_i', 'ax_run', 'ax_v', 'circuit', 'lang', 'marca', 'project']);
  assert.equal(url.searchParams.get('ax_demo'), 'macro:alsea-biz-app');
  assert.equal(url.searchParams.get('ax_i'), '0');
  assert.equal(url.searchParams.get('ax_v'), '1');
  assert.equal(url.searchParams.get('lang'), 'en');
  assert.equal(url.username, '');
  assert.doesNotMatch(href, /token|secret|csrf|password/i);
  const app = new URL(urlDePieza(macro, 3, 'run-1', 'es'));
  assert.equal(app.origin + app.pathname, 'https://www.admira.app/retailer');
  assert.equal(comandoPermitido('/demo alsea-biz-app'), true);
  assert.equal(comandoPermitido('/demos editar'), true);
  assert.equal(comandoPermitido('/demos edit'), true);
  assert.equal(comandoPermitido('/demo lista'), true);
  assert.equal(comandoPermitido('rm -rf /'), false);
  assert.equal(comandoPermitido('/demo alert(1)'), false);
});

function conExperto(hostname, lang, fetchImpl) {
  const lines = [];
  const assigned = [];
  const location = { hostname, host: hostname, href: 'https://' + hostname + '/', pathname: '/', search: '', hash: '', origin: 'https://' + hostname, assign(url) { assigned.push(String(url)); } };
  const document = {
    documentElement: { lang, dataset: {}, setAttribute() {}, getAttribute() { return null; }, classList: { contains: () => false, add() {}, toggle() {} } },
    currentScript: { dataset: {}, src: 'https://www.admiranext.com/suite/experto.js' },
    readyState: 'complete', head: { appendChild() {} }, body: { appendChild() {} },
    querySelector: () => null, querySelectorAll: () => [], getElementById: () => null, createElement: () => ({ setAttribute() {}, appendChild() {}, addEventListener() {} }),
    addEventListener() {}, removeEventListener() {}, dispatchEvent() {},
  };
  const storage = { getItem: () => null, setItem() {}, removeItem() {} };
  const sandbox = {
    document, location, localStorage: storage, sessionStorage: storage, URL, URLSearchParams,
    fetch: fetchImpl, setTimeout: (fn, ms) => setTimeout(fn, ms), clearTimeout,
    MutationObserver: class { observe() {} disconnect() {} },
    CustomEvent: class { constructor(type, init) { this.type = type; this.detail = init && init.detail; } },
    Event: class { constructor(type) { this.type = type; } },
    addEventListener() {}, dispatchEvent() {},
  };
  sandbox.window = sandbox; sandbox.globalThis = sandbox;
  vm.runInNewContext(experto, sandbox, { filename: 'experto.js' });
  return { api: sandbox.AdmiraExperto, assigned, lines, log: { appendChild: (li) => lines.push(li.textContent), children: [], removeChild() {}, scrollTop: 0, scrollHeight: 0 } };
}

test('/demo lista, /demo alsea-biz-app y /demos editar en las webs de la suite', async () => {
  for (const host of ['www.admiranext.com', 'www.admira.biz', 'www.admira.app']) {
    const plano = {
      ...macro,
      items: [{ ref: 'biz/proyecto', subdemo: { url: 'https://www.admiranext.com/xpace/manage?token=no', steps: [] } }],
    };
    const { api, assigned, lines, log } = conExperto(host, 'es', async (url) => {
      const texto = String(url);
      if (texto.endsWith('/api/demos')) return { ok: true, json: async () => ({ demos: [{ id: 'biz', title: { es: 'admira.biz', en: 'admira.biz' } }], macros: [{ id: 'alsea-biz-app', title: { es: 'Alsea · biz y app', en: 'Alsea · biz and app' } }] }) };
      if (texto.includes('/api/demos/alsea-biz-app')) return { ok: true, json: async () => plano };
      return { ok: false, json: async () => ({}) };
    });
    const lista = api.parseDemo('/demo lista');
    assert.equal(lista.lista, true);
    assert.equal(lista.catalogo, undefined);
    assert.equal(api.parseDemo('/demo editor').funcion, 'editor');
    assert.deepEqual(JSON.parse(JSON.stringify(api.parseDemo('/demo alsea-biz-app'))), { catalogo: 'alsea-biz-app', id: 'alsea-biz-app' });
    api.exec('/demo lista', log);
    api.exec('/demos editar', log);
    api.exec('/demo alsea-biz-app', log);
    await new Promise((resolve) => setTimeout(resolve, 800));
    const texto = lines.join('\n');
    assert.match(texto, /\/demo biz · admira\.biz/);
    assert.match(texto, /\/demo alsea-biz-app · Alsea/);
    assert.match(texto, /\/demos\/editor\//);
    const url = assigned.map((href) => new URL(href)).find((item) => item.searchParams.get('ax_demo') === 'macro:alsea-biz-app');
    assert.ok(url, host + ' ' + assigned.join(' | '));
    assert.equal(url.origin, 'https://www.admira.biz');
    assert.equal(url.searchParams.get('ax_demo'), 'macro:alsea-biz-app');
    assert.equal(url.searchParams.get('lang'), 'es');
    assert.equal(url.username, '');
    assert.doesNotMatch(url.href, /token|secret/);
  }
  const ingles = conExperto('www.admiranext.com', 'en', async () => ({ ok: true, json: async () => macro }));
  ingles.api.exec('/demos edit', ingles.log);
  await new Promise((resolve) => setTimeout(resolve, 800));
  assert.match(ingles.assigned[0], /\/demos\/editor\//);
  assert.equal(new URL(ingles.assigned[0]).searchParams.get('lang'), 'en');
});

test('si admira.app pide sesión, la macro avisa y resume bien, mal y pendiente', async () => {
  const plan = {
    ...macro,
    items: [
      { ref: 'app/establecimientos', subdemo: { id: 'establecimientos', steps: [{ op: 'point', selector: '#workspace', text: { es: 'Portal', en: 'Portal' } }, { op: 'check', selector: '#workspace', text: { es: 'Sigue', en: 'Next' } }] } },
    ],
  };
  const body = { id: '', hidden: false, textContent: 'Iniciar sesión para continuar', innerText: 'Iniciar sesión para continuar', children: [], appendChild(child) { this.children.push(child); child.parentNode = this; }, removeChild() {} };
  const workspace = { id: 'workspace', hidden: true, isConnected: true, textContent: '', classList: { add() {}, remove() {} }, getBoundingClientRect: () => ({ width: 0, height: 0 }) };
  const nodes = [body];
  const document = {
    documentElement: { lang: 'es' },
    head: { appendChild() {} },
    body,
    readyState: 'complete',
    createElement() {
      const el = { children: [], style: {}, attrs: {}, dataset: {}, textContent: '', hidden: false, isConnected: true, classList: { add() {}, remove() {} }, setAttribute(k, v) { this.attrs[k] = String(v); if (k === 'id') this.id = String(v); }, getAttribute(k) { return this.attrs[k]; }, appendChild(child) { this.children.push(child); }, remove() { this.isConnected = false; } };
      nodes.push(el);
      return el;
    },
    getElementById(id) { return nodes.find((nodo) => nodo.id === id && nodo.isConnected !== false) || null; },
    querySelector(sel) { return sel === '#workspace' ? workspace : null; },
    querySelectorAll() { return []; },
    addEventListener() {},
  };
  const location = new URL('https://www.admira.app/retailer?ax_demo=macro:alsea-biz-app&ax_run=run-1&ax_i=0&ax_v=1&lang=es&marca=alsea&project=starbucks&circuit=alsea_starbucks');
  location.assign = () => {};
  const storage = new Map();
  const G = {
    document, location, URL, URLSearchParams, history: { replaceState() {} },
    sessionStorage: { getItem: (k) => storage.get(k) ?? null, setItem: (k, v) => storage.set(k, String(v)), removeItem: (k) => storage.delete(k) },
    fetch: async () => ({ ok: true, json: async () => plan }),
    setTimeout: (fn) => { fn(); return 0; }, clearTimeout() {},
    addEventListener() {},
  };
  G.self = G; G.top = G; G.window = G; G.globalThis = G;
  vm.runInNewContext(motor, G, { filename: 'demo-control.js' });
  await new Promise((resolve) => setTimeout(resolve, 30));
  const estado = G.AdmiraDemoMacro.state();
  assert.equal(estado.activo, false);
  assert.match(estado.aviso, /iniciar sesión/);
  assert.equal(estado.puntos.length, 2);
  assert.ok(estado.puntos.every((punto) => punto.estado === 'pendiente'));
  const panel = nodes.find((nodo) => nodo.id === 'admira-native-demo');
  assert.ok(panel);
  assert.match(panel.children.map((child) => child.textContent).join('\n'), /pendiente/);
  assert.match(panel.children.map((child) => child.textContent).join('\n'), /bien/);
});

test('el reproductor aplica la marca del contexto y el editor la viste', async () => {
  assert.equal(macro.context.marca, 'starbucks');
  assert.match(readFileSync(join(dir, '../demos/editor/editor.css'), 'utf8'), /:root\[data-mb-marca\] :is\(\.biblioteca/);
  assert.match(experto, /demo-control\.js\?v=20261010-en-vivo-5532/);
  const plan = {
    ...macro,
    context: { ...macro.context, marca: 'jti' },
    items: [{ ref: 'app/establecimientos', subdemo: { id: 'establecimientos', steps: [{ op: 'check', text: { es: 'Portal', en: 'Portal' } }] } }],
  };
  const llamadas = [];
  const asignadas = [];
  const body = { id: '', hidden: false, textContent: 'Portal de la tienda', innerText: 'Portal de la tienda', children: [], appendChild(child) { this.children.push(child); child.parentNode = this; }, removeChild() {} };
  const nodes = [body];
  const document = {
    documentElement: { lang: 'es' },
    head: { appendChild() {} },
    body,
    readyState: 'complete',
    createElement() {
      const el = { children: [], style: {}, attrs: {}, dataset: {}, textContent: '', hidden: false, isConnected: true, classList: { add() {}, remove() {} }, setAttribute(k, v) { this.attrs[k] = String(v); if (k === 'id') this.id = String(v); }, getAttribute(k) { return this.attrs[k]; }, appendChild(child) { this.children.push(child); }, remove() { this.isConnected = false; } };
      nodes.push(el);
      return el;
    },
    getElementById(id) { return nodes.find((nodo) => nodo.id === id && nodo.isConnected !== false) || null; },
    querySelector() { return null; },
    querySelectorAll() { return []; },
    addEventListener() {},
  };
  const location = new URL('https://www.admiranext.com/demos/editor/?ax_demo=macro:alsea-biz-app&ax_run=run-1&ax_i=0&ax_v=1&lang=es');
  location.assign = (href) => { asignadas.push(String(href)); };
  const G = {
    document, location, URL, URLSearchParams, history: { replaceState() {} },
    sessionStorage: { getItem: () => null, setItem() {}, removeItem() {} },
    fetch: async () => ({ ok: true, json: async () => plan }),
    setTimeout: (fn) => { fn(); return 0; }, clearTimeout() {},
    addEventListener() {},
    AdmiraMarca: { activar: async (id) => { llamadas.push(id); return { ok: true, id, nombre: 'JTI' }; } },
  };
  G.self = G; G.top = G; G.window = G; G.globalThis = G;
  vm.runInNewContext(motor, G, { filename: 'demo-control.js' });
  await new Promise((resolve) => setTimeout(resolve, 30));
  assert.deepEqual(llamadas, ['jti']);
  const estado = G.AdmiraDemoMacro.state();
  assert.match(estado.aviso, /JTI/);
  assert.equal(asignadas.length, 1);
  const salto = new URL(asignadas[0]);
  assert.equal(salto.searchParams.get('marca'), 'jti');
  assert.equal(salto.origin, 'https://www.admira.app');
});
