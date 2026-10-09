import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { aEsquema, validar, validarPaso } from '../subdemos/admira-demo.mjs';
import { APP, RECORRIDOS } from '../subdemos/recorridos-nativos.mjs';
import { onRequest } from '../functions/_demos.js';
import { asegurarDirectorio, cookieDeSesion, sesionCompleta } from '../functions/_webmaster-gate.js';
import {
  OPS, TEXTO, agregarSubdemo, anotar, crearHistorial, deshacer, documentoMacro, duracionDe,
  filasMacro, moverItem, pasoVacio, resumenMacro,
} from '../demos/editor/modelo.mjs';

const leer = (ruta) => readFileSync(new URL(ruta, import.meta.url), 'utf8');
const biz = aEsquema(JSON.parse(leer('../subdemos/biz.subdemos.json')), RECORRIDOS.biz);
const app = validar(APP);
const refs = ['biz/proyecto', 'biz/circuito', 'biz/gemelo', 'app/establecimientos', 'app/inventario'];
const items = refs.map((ref) => ({ ref }));

class Statement {
  constructor(s) { this.s = s; this.v = []; }
  bind(...v) { this.v = v; return this; }
  first() { return this.s.get(...this.v) || null; }
  all() { return { results: this.s.all(...this.v) }; }
  run() { const r = this.s.run(...this.v); return Promise.resolve({ meta: { changes: r.changes } }); }
}
class D1 {
  constructor() { this.db = new DatabaseSync(':memory:'); }
  prepare(sql) { return new Statement(this.db.prepare(sql)); }
}

async function entorno() {
  const env = { AUTH_DB: new D1(), WEBMASTER_SIGNING_KEY: 'test-only-key' };
  await asegurarDirectorio(env);
  await env.AUTH_DB.prepare("UPDATE admiranext_users SET role='editor' WHERE email=?").bind('csilva@admira.com').run();
  return env;
}

async function sesion(env) {
  const user = await env.AUTH_DB.prepare('SELECT * FROM admiranext_users WHERE email=?').bind('csilva@admira.com').first();
  const cookie = (await cookieDeSesion(env, user)).split(';')[0];
  const actual = await sesionCompleta(new Request('https://www.admiranext.com/api/demos', { headers: { cookie } }), env);
  return { cookie, csrf: actual.csrf };
}

function llamada(path, { method = 'GET', cookie, csrf, body } = {}) {
  const headers = { origin: 'https://www.admiranext.com' };
  if (cookie) headers.cookie = cookie;
  if (csrf) headers['x-admira-csrf'] = csrf;
  if (body !== undefined) headers['content-type'] = 'application/json';
  return new Request('https://www.admiranext.com' + path, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

test('la biblioteca monta biz×3 + app×2, salta de sitio, reordena, deshace y mide', () => {
  const filas = filasMacro(items, { card: 'Siguiente tramo', seconds: 2 }, 'es');
  assert.deepEqual(filas.filter((fila) => fila.kind === 'salto').map((fila) => fila.card), ['Siguiente tramo']);
  assert.equal(filas[3].kind, 'salto');
  assert.equal(filas[4].ref, 'app/establecimientos');
  const movidos = moverItem(items, 0, 2);
  assert.deepEqual(movidos.map((item) => item.ref), ['biz/circuito', 'biz/proyecto', 'biz/gemelo', 'app/establecimientos', 'app/inventario']);
  const alFinal = moverItem(items, 0, items.length);
  assert.equal(alFinal.at(-1).ref, 'biz/proyecto');
  const historial = crearHistorial({ items });
  anotar(historial, { items: movidos });
  assert.equal(deshacer(historial), true);
  assert.deepEqual(historial.actual.items.map((item) => item.ref), refs);
  const datos = resumenMacro(items, [biz, app], 'draft', 'es');
  assert.equal(datos.elementos, 5);
  assert.equal(datos.sitios, 2);
  assert.equal(datos.estado, 'borrador');
  assert.ok(datos.duracion > 0);
  assert.ok(duracionDe(biz, biz.subdemos[0]) > 0);
  assert.match(datos.comando, /\/demo biz\/proyecto/);
  assert.equal(resumenMacro(items, [biz, app], 'published', 'en').estado, 'published');
  for (const op of OPS) validarPaso(pasoVacio(op));
  for (const clave of ['guardar', 'publicar', 'ejecutar', 'soltar', 'anadir', 'probar', 'desde', 'elegir', 'macros']) {
    assert.notEqual(TEXTO.es[clave], TEXTO.en[clave], clave);
  }
  assert.equal(TEXTO.es.guardar, 'Guardar borrador');
  assert.equal(TEXTO.en.guardar, 'Save draft');
  assert.equal(TEXTO.es.soltar, 'Soltar aquí');
  assert.equal(TEXTO.es.anadir, '+ Añadir paso');
  assert.equal(TEXTO.en.anadir, '+ Add step');
  assert.equal(TEXTO.en.probar, 'Try step');
  assert.equal(TEXTO.en.desde, 'From here');
});

test('la página lleva el marco cuadrático, los dos idiomas y sustituye a /subdemos/', () => {
  const html = leer('../demos/editor/index.html');
  const js = leer('../demos/editor/editor.js');
  assert.match(html, /data-yk-frame="cabecera"/);
  assert.match(html, /data-yk-head/);
  assert.match(html, /data-yk-main/);
  assert.match(html, /role="switch"/);
  assert.doesNotMatch(html, /class="yk-framed"/);
  assert.doesNotMatch(html, /data-yk-title=/);
  assert.match(html, /data-yk-rail-left="OPCIONES"/);
  assert.match(html, /data-yk-rail-right="AVANZADO"/);
  assert.match(html, /data-yk-cli="on"/);
  assert.match(html, /admira-frame\.js\?v=20261009-demo-5446/);
  assert.match(html, /admira-frame\.css\?v=20261009-demo-5446/);
  for (const id of ['titulo', 'guardar', 'publicar', 'ejecutar', 'deshacer', 'buscar', 'arbol', 'h-biblioteca', 'h-macros', 'lista-macros', 'mas-demo', 'mas-sub', 'mas-macro', 'duplicar', 'borrar', 'fila', 'soltar', 'resumen', 'lista-pasos', 'anadir-paso', 'paso-form', 'probar', 'desde', 'borrar-paso', 'voz', 'dialogo', 'idioma-barra']) {
    assert.match(html, new RegExp('id="' + id + '"'), id);
  }
  assert.match(html, /Guardar borrador/);
  assert.match(html, /Soltar aquí/);
  assert.match(js, /window\.setLanguage/);
  assert.match(leer('../demos/editor/modelo.mjs'), /Save draft/);
  assert.match(leer('../demos/editor/modelo.mjs'), /Guardar borrador/);
  assert.match(leer('../_redirects'), /\/subdemos\/ \/demos\/editor\/ 302/);
  assert.match(leer('../subdemos/index.html'), /url=\/demos\/editor\//);
  assert.match(leer('../demo/index.html'), /\/demos\/editor\//);
  assert.match(leer('../demo/index.html'), /\/demo editor/);
  assert.match(leer('../suite/experto.js'), /editor:'\/demos\/editor\/'/);
  assert.doesNotMatch(html, /name="admiranext-version"/);
});

test('un editor guarda, publica y borra la macro y crea una subdemo; sin sesión recibe 403', async () => {
  const env = await entorno();
  const editor = await sesion(env);
  const macro = documentoMacro({
    id: 'biz-app-retail',
    title: { es: 'Biz con tres y app con dos', en: 'Biz with three and app with two' },
    context: { marca: 'admira', project: 'biz-app-retail', circuit: 'biz-app-retail', lang: 'es' },
    transition: { card: 'Siguiente tramo', seconds: 2 },
    items,
    version: 1,
  });
  assert.equal((await onRequest({ request: llamada('/api/demos', { method: 'POST', body: macro }), env })).status, 403);
  const creado = await onRequest({ request: llamada('/api/demos', { method: 'POST', cookie: editor.cookie, csrf: editor.csrf, body: macro }), env });
  assert.equal(creado.status, 201);
  const draft = await creado.json();
  assert.equal(draft.status, 'draft');
  const reorden = documentoMacro({ ...draft, items: moverItem(draft.items, 4, 0) });
  const puesto = await onRequest({ request: llamada('/api/demos/biz-app-retail', { method: 'PUT', cookie: editor.cookie, csrf: editor.csrf, body: reorden }), env });
  assert.equal(puesto.status, 200);
  assert.equal((await puesto.json()).items[0].ref, 'app/inventario');
  const publicado = await onRequest({ request: llamada('/api/demos/biz-app-retail/publish', { method: 'POST', cookie: editor.cookie, csrf: editor.csrf }), env });
  assert.equal(publicado.status, 200);
  assert.equal((await publicado.json()).status, 'published');
  const vista = await (await onRequest({ request: llamada('/api/demos/biz-app-retail'), env })).json();
  assert.deepEqual(vista.items.map((item) => item.ref), ['app/inventario', 'biz/proyecto', 'biz/circuito', 'biz/gemelo', 'app/establecimientos']);
  assert.ok(vista.items.every((item) => item.subdemo && item.subdemo.id));
  const nueva = agregarSubdemo(biz, { id: 'mostrador', es: 'Mostrador nuevo', en: 'New counter', url: 'https://www.admiranext.com/demo/' });
  nueva.subdemos.find((sub) => sub.id === 'mostrador').steps[0].text = { es: 'Enseña el mostrador', en: 'Show the counter' };
  const bizBorrador = await onRequest({ request: llamada('/api/demos/biz', { method: 'PUT', cookie: editor.cookie, csrf: editor.csrf, body: { ...nueva, status: 'draft' } }), env });
  assert.equal(bizBorrador.status, 200);
  const bizPublicado = await onRequest({ request: llamada('/api/demos/biz/publish', { method: 'POST', cookie: editor.cookie, csrf: editor.csrf }), env });
  assert.equal(bizPublicado.status, 200);
  const bizVivo = await (await onRequest({ request: llamada('/api/demos/biz'), env })).json();
  const creada = bizVivo.subdemos.find((sub) => sub.id === 'mostrador');
  assert.equal(creada.title.en, 'New counter');
  assert.equal(creada.steps[0].text.es, 'Enseña el mostrador');
  const borrado = await onRequest({ request: llamada('/api/demos/biz-app-retail', { method: 'DELETE', cookie: editor.cookie, csrf: editor.csrf }), env });
  assert.equal(borrado.status, 200);
  assert.equal((await (await onRequest({ request: llamada('/api/demos/biz-app-retail'), env })).json()).error, 'no encontrada');
  const repo = await onRequest({ request: llamada('/api/demos/store', { method: 'DELETE', cookie: editor.cookie, csrf: editor.csrf }), env });
  assert.equal(repo.status, 409);
});
