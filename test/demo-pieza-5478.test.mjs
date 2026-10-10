// Encargo #5478: una pieza se queda en su tramo y el plan viaja con el salto.
import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { aEsquema, resolverMacro, validar } from '../subdemos/admira-demo.mjs';
import { RECORRIDOS } from '../subdemos/recorridos-nativos.mjs';

const dir = dirname(fileURLToPath(import.meta.url));
const motor = readFileSync(join(dir, '../suite/demo-control.js'), 'utf8');
const experto = readFileSync(join(dir, '../suite/experto.js'), 'utf8');
const biz = aEsquema(JSON.parse(readFileSync(join(dir, '../subdemos/biz.subdemos.json'), 'utf8')), RECORRIDOS.biz);
const store = aEsquema(JSON.parse(readFileSync(join(dir, '../subdemos/store.subdemos.json'), 'utf8')), RECORRIDOS.store);
const studio = aEsquema(JSON.parse(readFileSync(join(dir, '../subdemos/studio.subdemos.json'), 'utf8')), RECORRIDOS.studio);
const app = validar(JSON.parse(readFileSync(join(dir, '../subdemos/v2/app.json'), 'utf8')));
const gira = resolverMacro(validar(JSON.parse(readFileSync(join(dir, '../subdemos/v2/gira-carlos.json'), 'utf8'))), [biz, store, studio, app]);

function muro(search) {
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
  const location = new URL('https://www.admira.app/retailer' + search);
  const assigned = [];
  location.assign = (href) => { assigned.push(String(href)); };
  const G = {
    document, location, URL, URLSearchParams, history: { replaceState() {} },
    sessionStorage: { getItem: () => null, setItem() {}, removeItem() {} },
    fetch: async () => ({ ok: true, json: async () => gira }),
    setTimeout: (fn) => { fn(); return 0; }, clearTimeout() {},
    addEventListener() {},
    atob, btoa, escape, unescape, encodeURIComponent, decodeURIComponent,
  };
  G.self = G; G.top = G; G.window = G; G.globalThis = G;
  return { G, nodes, assigned };
}

test('ax_fin ejecuta solo establecimientos y sin él sigue con inventario', async () => {
  const cortada = muro('?ax_demo=macro:gira-carlos&ax_run=run-1&ax_i=3&ax_fin=4&ax_v=1&lang=es');
  vm.runInNewContext(motor, cortada.G, { filename: 'demo-control.js' });
  await new Promise((resolve) => setTimeout(resolve, 40));
  const sola = cortada.G.AdmiraDemoMacro.state();
  assert.equal(sola.activo, false);
  assert.equal(sola.puntos.length, 4);
  assert.ok(sola.puntos.every((punto) => punto.ref === 'app/establecimientos' && punto.estado === 'pendiente'));
  assert.equal(cortada.assigned.length, 0);
  const panel = cortada.nodes.find((nodo) => nodo.id === 'admira-native-demo' && nodo.isConnected !== false);
  const texto = panel.children.map((child) => child.textContent).join('\n');
  assert.match(texto, /Resumen/);
  assert.match(texto, /4 pendiente/);
  assert.match(sola.aviso, /iniciar sesión/);
  assert.ok(sola.puntos.every((punto) => !/iniciar sesión/.test(punto.detalle || '')));
  const resumen = panel.children.find((nodo) => nodo.id === 'admira-demo-resumen');
  assert.equal(resumen.children.length, 4);
  assert.ok(resumen.children.every((li) => !/^\d+\./.test(li.textContent) && !/iniciar sesión/.test(li.textContent)));
  assert.equal(panel.children.filter((nodo) => /iniciar sesión/.test(nodo.textContent || '')).length, 1);

  const entera = muro('?ax_demo=macro:gira-carlos&ax_run=run-1&ax_i=3&ax_v=1&lang=es');
  vm.runInNewContext(motor, entera.G, { filename: 'demo-control.js' });
  await new Promise((resolve) => setTimeout(resolve, 40));
  const cola = entera.G.AdmiraDemoMacro.state();
  assert.equal(cola.activo, false);
  assert.equal(cola.puntos.filter((punto) => punto.ref === 'app/establecimientos').length, 4);
  assert.equal(cola.puntos.filter((punto) => punto.ref === 'app/inventario').length, 3);
});

test('si el catálogo no responde, el reproductor usa el plan de la dirección', async () => {
  const pieza = {
    kind: 'macro',
    id: 'gira-carlos',
    version: 1,
    items: [{ ref: 'app/establecimientos', subdemo: { id: 'establecimientos', steps: [{ op: 'point', text: { es: 'Portal', en: 'Portal' } }, { op: 'check', text: { es: 'Sigue', en: 'Next' } }] } }],
  };
  const viaje = btoa(unescape(encodeURIComponent(JSON.stringify(pieza)))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
  const { G, nodes } = muro('?ax_demo=macro:gira-carlos&ax_run=run-1&ax_i=0&ax_fin=1&ax_v=1&lang=en&ax_plan=' + viaje);
  G.fetch = async () => ({ ok: false, json: async () => ({}) });
  G.document.documentElement.lang = 'en';
  vm.runInNewContext(motor, G, { filename: 'demo-control.js' });
  await new Promise((resolve) => setTimeout(resolve, 40));
  const estado = G.AdmiraDemoMacro.state();
  assert.equal(estado.activo, false);
  assert.equal(estado.puntos.length, 2);
  assert.doesNotMatch(estado.aviso, /cannot read|No puedo leer/);
  const texto = nodes.find((nodo) => nodo.id === 'admira-native-demo' && nodo.isConnected !== false).children.map((child) => child.textContent).join('\n');
  assert.match(texto, /Summary/);
  assert.match(texto, /pending/);
});

function conExperto(fetchImpl) {
  const lines = [];
  const assigned = [];
  const location = { hostname: 'smith-demo-nombres-5476-main.admiranext.pages.dev', host: 'smith-demo-nombres-5476-main.admiranext.pages.dev', href: 'https://smith-demo-nombres-5476-main.admiranext.pages.dev/', pathname: '/', search: '', hash: '', origin: 'https://smith-demo-nombres-5476-main.admiranext.pages.dev', assign(url) { assigned.push(String(url)); } };
  const document = {
    documentElement: { lang: 'es', dataset: {}, setAttribute() {}, getAttribute() { return null; }, classList: { contains: () => false, add() {}, toggle() {} } },
    currentScript: { dataset: {}, src: 'https://smith-demo-nombres-5476-main.admiranext.pages.dev/suite/experto.js' },
    readyState: 'complete', head: { appendChild() {} }, body: { appendChild() {} },
    querySelector: () => null, querySelectorAll: () => [], getElementById: () => null, createElement: () => ({ setAttribute() {}, appendChild() {}, addEventListener() {} }),
    addEventListener() {}, removeEventListener() {}, dispatchEvent() {},
  };
  const storage = { getItem: () => null, setItem() {}, removeItem() {} };
  const sandbox = {
    document, location, localStorage: storage, sessionStorage: storage, URL, URLSearchParams,
    fetch: fetchImpl, setTimeout: (fn) => { fn(); return 0; }, clearTimeout,
    MutationObserver: class { observe() {} disconnect() {} },
    CustomEvent: class { constructor(type, init) { this.type = type; this.detail = init && init.detail; } },
    Event: class { constructor(type) { this.type = type; } },
    addEventListener() {}, dispatchEvent() {},
    btoa, atob, escape, unescape, encodeURIComponent, decodeURIComponent,
  };
  sandbox.window = sandbox; sandbox.globalThis = sandbox;
  vm.runInNewContext(experto, sandbox, { filename: 'experto.js' });
  return { api: sandbox.AdmiraExperto, assigned, log: { appendChild: (li) => lines.push(li.textContent), children: [], removeChild() {}, scrollTop: 0, scrollHeight: 0 } };
}

test('/demo gira-carlos establecimientos recorta el plan y lo lleva sin secretos', async () => {
  const envenenado = {
    ...gira,
    items: gira.items.map((item, index) => index === 3 ? { ...item, subdemo: { ...item.subdemo, url: 'https://user:secret@www.admira.app/retailer?token=no' } } : item),
  };
  const { api, assigned, log } = conExperto(async (url) => {
    const texto = String(url);
    assert.match(texto, /\/api\/demos\/resolver\?nombre=gira-carlos\.establecimientos/);
    return { ok: true, json: async () => ({ tipo: 'pieza', index: 3, plan: envenenado }) };
  });
  api.exec('/demo gira-carlos establecimientos', log);
  await new Promise((resolve) => setTimeout(resolve, 20));
  const url = new URL(assigned[0]);
  assert.equal(url.origin + url.pathname, 'https://www.admira.app/retailer');
  assert.equal(url.searchParams.get('ax_demo'), 'macro:gira-carlos');
  assert.equal(url.searchParams.get('ax_i'), '3');
  assert.equal(url.searchParams.get('ax_fin'), '4');
  assert.doesNotMatch(url.href, /token|secret|password|csrf/i);
  let b64 = url.searchParams.get('ax_plan').replace(/-/g, '+').replace(/_/g, '/');
  while (b64.length % 4) b64 += '=';
  const json = decodeURIComponent(escape(atob(b64)));
  const plan = JSON.parse(json);
  assert.equal(plan.items.length, 5);
  assert.equal(plan.items[3].subdemo.steps.length, 4);
  assert.equal(plan.items[3].subdemo.url, undefined);

  const entera = conExperto(async () => ({ ok: true, json: async () => ({ tipo: 'macro', plan: gira }) }));
  entera.api.exec('/demo gira-carlos', entera.log);
  await new Promise((resolve) => setTimeout(resolve, 20));
  assert.equal(new URL(entera.assigned[0]).searchParams.get('ax_fin'), null);
});
