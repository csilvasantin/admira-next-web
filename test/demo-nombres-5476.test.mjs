import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { onRequest } from '../functions/_demos.js';
import { comandoPermitido } from '../subdemos/admira-demo.mjs';
import { aSlug, choque, renombrarComando, reservado, resolverNombre, ORIGENES_DEMO } from '../subdemos/nombres-demo.mjs';
import { comandoDe, documentoMacro } from '../demos/editor/modelo.mjs';

const dir = dirname(fileURLToPath(import.meta.url));
const experto = readFileSync(join(dir, '../suite/experto.js'), 'utf8');

function llamada(path, headers) {
  return new Request('https://www.admiranext.com' + path, { headers });
}

test('el nombre sale del título y el anterior queda de alias', () => {
  assert.equal(aSlug('Gira Carlos'), 'gira-carlos');
  assert.equal(reservado('editor'), true);
  assert.equal(reservado('gira'), false);
  const renombre = renombrarComando({ id: 'gira', slug: 'gira', aliases: [], title: { es: 'Gira', en: 'Tour' } }, 'gira-carlos');
  assert.equal(renombre.ok, true);
  assert.equal(renombre.doc.slug, 'gira-carlos');
  assert.deepEqual(renombre.doc.aliases, ['gira']);
  assert.equal(renombrarComando({ id: 'gira', slug: 'gira' }, 'editor').ok, false);
  const doc = documentoMacro({
    id: 'gira-carlos', slug: 'gira-carlos', aliases: ['gira'],
    title: { es: 'Gira', en: 'Tour' },
    context: { marca: 'admira', project: 'gira', circuit: 'gira', lang: 'es' },
    transition: { card: 'Siguiente tramo', seconds: 3 },
    items: [{ ref: 'biz/proyecto' }],
    version: 1,
  });
  assert.equal(doc.slug, 'gira-carlos');
  assert.deepEqual(doc.aliases, ['gira']);
  assert.equal(comandoDe(doc), 'gira-carlos');
  assert.equal(choque([{ id: 'otra', kind: 'macro', status: 'published', slug: 'gira', aliases: [] }], { id: 'nueva', kind: 'macro', slug: 'gira', aliases: [] }), 'gira');
});

test('el resolver público distingue la macro, la pieza, el alias y el nombre reservado', async () => {
  const lista = await (await onRequest({ request: llamada('/api/demos/resolver'), env: {} })).json();
  assert.equal(lista.tipo, 'lista');
  assert.ok(lista.nombres.includes('gira-carlos'));
  assert.ok(lista.nombres.includes('gira'));
  const entera = await onRequest({ request: llamada('/api/demos/resolver?nombre=gira-carlos', { origin: 'https://www.admira.biz' }), env: {} });
  assert.equal(entera.headers.get('access-control-allow-origin'), 'https://www.admira.biz');
  const macro = await entera.json();
  assert.equal(macro.tipo, 'macro');
  assert.equal(macro.id, 'gira-carlos');
  assert.equal(macro.plan.items.length, 5);
  assert.deepEqual(macro.plan.items.map((item) => item.ref), ['biz/proyecto', 'biz/circuito', 'biz/gemelo', 'app/establecimientos', 'app/inventario']);
  const alias = await (await onRequest({ request: llamada('/api/demos/resolver?nombre=gira'), env: {} })).json();
  assert.equal(alias.tipo, 'macro');
  assert.equal(alias.id, 'gira-carlos');
  assert.equal(alias.via, 'alias');
  const punto = await (await onRequest({ request: llamada('/api/demos/resolver?nombre=gira-carlos.establecimientos'), env: {} })).json();
  const espacio = await (await onRequest({ request: llamada('/api/demos/resolver?nombre=' + encodeURIComponent('gira-carlos establecimientos')), env: {} })).json();
  assert.equal(punto.tipo, 'pieza');
  assert.equal(punto.index, 3);
  assert.equal(espacio.tipo, 'pieza');
  assert.equal(espacio.index, 3);
  assert.equal(espacio.plan.items[3].ref, 'app/establecimientos');
  const directa = await (await onRequest({ request: llamada('/api/demos/gira'), env: {} })).json();
  assert.equal(directa.id, 'gira-carlos');
  const reservadoNombre = await onRequest({ request: llamada('/api/demos/resolver?nombre=editor'), env: {} });
  assert.equal(reservadoNombre.status, 404);
  assert.equal((await reservadoNombre.json()).tipo, 'reservado');
  const ambiguo = await (await onRequest({ request: llamada('/api/demos/resolver?nombre=itil'), env: {} })).json();
  assert.equal(ambiguo.tipo, 'ambiguo');
  for (const origen of ['https://www.admiranext.com', 'https://www.admira.app', 'https://www.admira.store', 'https://www.admira.studio', 'https://www.yokup.com', 'https://www.xpaceos.com', 'https://www.pixeria.com', 'https://www.admira.tv', 'https://www.clearchannel.tv', 'https://www.admira.live']) {
    assert.ok(ORIGENES_DEMO.includes(origen), origen);
  }
  assert.equal(comandoPermitido('/demo gira-carlos'), true);
  assert.equal(comandoPermitido('/demo gira-carlos establecimientos'), true);
  assert.equal(comandoPermitido('/demo gira-carlos.establecimientos'), true);
  assert.equal(comandoPermitido('/demo editor'), true);
  assert.equal(comandoPermitido('/demo lista'), true);
});

function conExperto(hostname, lang) {
  const assigned = [];
  const location = {
    hostname, host: hostname, href: 'https://' + hostname + '/', pathname: '/', search: '', hash: '', origin: 'https://' + hostname,
    assign(url) { assigned.push(String(url)); },
  };
  const document = {
    documentElement: { lang, dataset: {}, setAttribute() {}, getAttribute() { return null; }, classList: { contains: () => false, add() {}, toggle() {} } },
    currentScript: { dataset: {}, src: 'https://www.admiranext.com/suite/experto.js' },
    readyState: 'complete', head: { appendChild() {} }, body: { appendChild() {} },
    querySelector: () => null, querySelectorAll: () => [], getElementById: () => null,
    createElement: () => ({ setAttribute() {}, appendChild() {}, addEventListener() {} }),
    addEventListener() {}, removeEventListener() {}, dispatchEvent() {},
  };
  const storage = { getItem: () => null, setItem() {}, removeItem() {} };
  const sandbox = {
    document, location, localStorage: storage, sessionStorage: storage, URL, URLSearchParams,
    fetch: async () => ({ ok: false, json: async () => ({}) }),
    setTimeout: (fn, ms) => setTimeout(fn, ms), clearTimeout,
    MutationObserver: class { observe() {} disconnect() {} },
    CustomEvent: class { constructor(type, init) { this.type = type; this.detail = init && init.detail; } },
    Event: class { constructor(type) { this.type = type; } },
    addEventListener() {}, dispatchEvent() {},
  };
  sandbox.window = sandbox;
  sandbox.globalThis = sandbox;
  vm.runInNewContext(experto, sandbox, { filename: 'experto.js' });
  return { api: sandbox.AdmiraExperto, assigned, location };
}

test('/demo nombre, nombre pieza y nombre.pieza desde biz y app', () => {
  for (const host of ['www.admiranext.com', 'www.admira.biz', 'www.admira.app', 'www.admira.store', 'www.admira.studio']) {
    const { api } = conExperto(host, 'es');
    assert.equal(api.parseDemo('/demo store').id, 'store');
    assert.equal(api.parseDemo('/demo editor').funcion, 'editor');
    assert.deepEqual(JSON.parse(JSON.stringify(api.parseDemo('/demo gira-carlos'))), { catalogo: 'gira-carlos', id: 'gira-carlos' });
    assert.equal(api.parseDemo('/demo gira-carlos establecimientos').pieza, 'establecimientos');
    assert.equal(api.parseDemo('/demo gira-carlos.establecimientos').pieza, 'establecimientos');
    const antes = api.parseDemo('/demo gira');
    assert.ok(antes == null || antes.desconocida === 'gira');
    api.anotarNombres(['gira', 'gira-carlos', 'establecimientos']);
    assert.equal(api.parseDemo('/demo gira').catalogo, 'gira');
    assert.equal(api.parseDemo('/demo establecimientos').catalogo, 'establecimientos');
    assert.equal(api.parseDemo('/demo editor').funcion, 'editor');
    const en = conExperto(host, 'en').api;
    assert.match(en.parseDemo('/demo editor').url, /lang=en/);
    assert.match(en.parseDemo('/demo gira-carlos') && 'ok', /ok/);
  }
});
