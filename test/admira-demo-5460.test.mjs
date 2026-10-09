import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { aEsquema, aJsonActual, comandoPermitido, validar, validarPaso } from '../subdemos/admira-demo.mjs';
import { APP, RECORRIDOS } from '../subdemos/recorridos-nativos.mjs';
import { onRequest } from '../functions/_demos.js';
import { asegurarDirectorio, cookieDeSesion, sesionCompleta } from '../functions/_webmaster-gate.js';
import { createToken } from '../functions/mcp/_tokens.js';

const sitios = ['biz', 'store', 'studio'];
const clasicos = Object.fromEntries(sitios.map((id) => [id, JSON.parse(readFileSync(new URL('../subdemos/' + id + '.subdemos.json', import.meta.url), 'utf8'))]));
const demos = Object.fromEntries(sitios.map((id) => [id, aEsquema(clasicos[id], RECORRIDOS[id])]));
demos.app = validar(APP);

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
  await env.AUTH_DB.prepare(
    "INSERT INTO admiranext_users(email,display_name,role,status,session_version,created_at,updated_at) VALUES('visor@admira.com','Visor','viewer','active',1,1,1)"
  ).run();
  return env;
}

async function sesion(env, email) {
  const user = await env.AUTH_DB.prepare('SELECT * FROM admiranext_users WHERE email=?').bind(email).first();
  const cookie = (await cookieDeSesion(env, user)).split(';')[0];
  const actual = await sesionCompleta(new Request('https://www.admiranext.com/api/demos', { headers: { cookie } }), env);
  return { cookie, csrf: actual.csrf };
}

function llamada(path, { method = 'GET', cookie, csrf, body, token } = {}) {
  const headers = { origin: 'https://www.admiranext.com' };
  if (cookie) headers.cookie = cookie;
  if (csrf) headers['x-admira-csrf'] = csrf;
  if (token) headers.authorization = 'Bearer ' + token;
  if (body !== undefined) headers['content-type'] = 'application/json';
  return new Request('https://www.admiranext.com' + path, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

const macro = {
  schema: 'admira.demo/2',
  kind: 'macro',
  id: 'biz-app-retail',
  title: { es: 'Biz con tres piezas y la app con dos', en: 'Biz with three parts and the app with two' },
  context: { marca: 'alsea', project: 'demo-alsea-retail', circuit: 'demo-alsea-dooh', lang: 'es' },
  transition: { card: 'Siguiente tramo', seconds: 2 },
  items: [
    { ref: 'biz/proyecto' }, { ref: 'biz/circuito' }, { ref: 'biz/gemelo' },
    { ref: 'app/establecimientos' }, { ref: 'app/inventario' },
  ],
  status: 'published',
  version: 1,
};

test('paso 1: el esquema admira.demo/2 rechaza JavaScript y comandos libres', () => {
  assert.equal(demos.biz.schema, 'admira.demo/2');
  assert.equal(comandoPermitido('/demo proyectos'), true);
  assert.equal(comandoPermitido('/demo biz/proyecto'), true);
  assert.equal(comandoPermitido('/demo alert(1)'), false);
  assert.throws(() => validarPaso({ op: 'cli', command: 'rm -rf /' }));
  assert.throws(() => validarPaso({ op: 'say', text: { es: '<script>alert(1)</script>', en: 'no' } }));
  assert.throws(() => validarPaso({ op: 'eval', text: { es: 'hola', en: 'hi' } }));
  const nativo = validarPaso({ op: 'native', id: 'tv' });
  assert.equal(nativo.id, 'tv');
  assert.equal(nativo.op, 'native');
});

test('paso 2: el conversor conserva ids, números y alias y regenera el JSON clásico', () => {
  for (const id of sitios) {
    const demo = demos[id];
    assert.deepEqual(aJsonActual(demo), clasicos[id]);
    assert.deepEqual(demo.subdemos.map((sub) => sub.id), clasicos[id].subdemos.map((sub) => sub.id));
    assert.deepEqual(demo.subdemos.map((sub) => sub.n), [1, 2, 3, 4, 5]);
    assert.deepEqual(demo.subdemos.map((sub) => sub.aliases), clasicos[id].subdemos.map((sub) => sub.aliases));
    assert.ok(demo.subdemos.every((sub) => sub.steps.length >= 2 && sub.steps.every((paso) => paso.op !== 'eval')));
  }
});

test('paso 3: admira.app queda en establecimientos, inventario, incidencias e ITIL', () => {
  const pagina = readFileSync(new URL('../demo/index.html', import.meta.url), 'utf8');
  assert.match(pagina, /id="catalogo-demos"/);
  assert.match(pagina, /href="\/api\/demos"/);
  assert.match(pagina, /establecimientos, inventario, incidencias e ITIL/);
  assert.deepEqual(demos.app.subdemos.map((sub) => sub.id), ['establecimientos', 'inventario', 'incidencias', 'itil']);
  assert.deepEqual(demos.app.subdemos.map((sub) => sub.n), [1, 2, 3, 4]);
  assert.ok(demos.app.subdemos.find((sub) => sub.id === 'establecimientos').steps.some((paso) => paso.selector === '#workspace'));
  assert.ok(demos.app.subdemos.find((sub) => sub.id === 'inventario').steps.some((paso) => paso.selector === '#device-state'));
  assert.ok(demos.app.subdemos.find((sub) => sub.id === 'incidencias').steps.some((paso) => paso.selector === '[data-filter="active"]'));
  assert.ok(demos.app.subdemos.find((sub) => sub.id === 'itil').steps.some((paso) => paso.selector === '#itil'));
});

test('paso 4: GET /api/demos devuelve biz, store, studio y app', async () => {
  const env = await entorno();
  const res = await onRequest({ request: llamada('/api/demos'), env });
  assert.equal(res.status, 200);
  assert.match(res.headers.get('cache-control'), /max-age=60/);
  const body = await res.json();
  assert.equal(body.schema, 'admira.demo/2');
  assert.deepEqual(body.demos.map((demo) => demo.id), ['biz', 'store', 'studio', 'app']);
  assert.equal(body.demos.find((demo) => demo.id === 'app').subdemos.length, 4);
  const una = await onRequest({ request: llamada('/api/demos/app'), env });
  assert.equal((await una.json()).subdemos.length, 4);
});

test('paso 5: un editor publica la macro biz×3 + app×2 y sin rol recibe 403', async () => {
  const env = await entorno();
  const editor = await sesion(env, 'csilva@admira.com');
  const visor = await sesion(env, 'visor@admira.com');
  assert.equal((await onRequest({ request: llamada('/api/demos', { method: 'POST', body: macro }), env })).status, 403);
  assert.equal((await onRequest({ request: llamada('/api/demos', { method: 'POST', cookie: visor.cookie, csrf: visor.csrf, body: macro }), env })).status, 403);
  const creado = await onRequest({ request: llamada('/api/demos', { method: 'POST', cookie: editor.cookie, csrf: editor.csrf, body: macro }), env });
  assert.equal(creado.status, 201);
  assert.equal((await creado.json()).status, 'draft');
  const publicado = await onRequest({ request: llamada('/api/demos/biz-app-retail/publish', { method: 'POST', cookie: editor.cookie, csrf: editor.csrf }), env });
  assert.equal(publicado.status, 200);
  const lista = await (await onRequest({ request: llamada('/api/demos'), env })).json();
  const pieza = lista.macros.find((item) => item.id === 'biz-app-retail');
  assert.equal(pieza.status, 'published');
  assert.deepEqual(pieza.items.map((item) => item.ref), macro.items.map((item) => item.ref));
  assert.ok(pieza.items.every((item) => item.subdemo && item.subdemo.id));
  assert.equal(pieza.version, 2);
  const biz = await (await onRequest({ request: llamada('/api/demos/biz'), env })).json();
  biz.title.en = 'admira.biz retail media';
  const bizBorrador = await onRequest({ request: llamada('/api/demos/biz', { method: 'PUT', cookie: editor.cookie, csrf: editor.csrf, body: biz }), env });
  assert.equal(bizBorrador.status, 200);
  assert.equal((await (await onRequest({ request: llamada('/api/demos/biz-app-retail'), env })).json()).version, 2);
  const bizPublicado = await onRequest({ request: llamada('/api/demos/biz/publish', { method: 'POST', cookie: editor.cookie, csrf: editor.csrf }), env });
  assert.equal(bizPublicado.status, 200);
  const macroNueva = await (await onRequest({ request: llamada('/api/demos/biz-app-retail'), env })).json();
  assert.equal(macroNueva.version, 3);
  assert.equal(macroNueva.items.find((item) => item.ref === 'biz/proyecto').subdemo.title.en, 'Register a project');
  const token = await createToken(env, { email: 'csilva@admira.com', label: 'editor', createdBy: 'test' });
  const otro = { ...macro, id: 'biz-app-copia', title: { es: 'Copia de la macro', en: 'Macro copy' } };
  const porToken = await onRequest({ request: llamada('/api/demos', { method: 'POST', token: token.token, body: otro }), env });
  assert.equal(porToken.status, 201);
  const viejo = await onRequest({ request: llamada('/api/demos/biz-app-retail', { method: 'PUT', cookie: editor.cookie, csrf: editor.csrf, body: { ...macro, version: 1 } }), env });
  assert.equal(viejo.status, 409);
  const borrado = await onRequest({ request: llamada('/api/demos/biz-app-retail', { method: 'DELETE', cookie: editor.cookie, csrf: editor.csrf }), env });
  assert.equal(borrado.status, 200);
  assert.equal((await (await onRequest({ request: llamada('/api/demos/biz-app-retail'), env })).json()).error, 'no encontrada');
  const restaurado = await onRequest({ request: llamada('/api/demos/biz-app-retail/restore', { method: 'POST', cookie: editor.cookie, csrf: editor.csrf }), env });
  assert.equal(restaurado.status, 200);
  assert.equal((await restaurado.json()).status, 'draft');
});
