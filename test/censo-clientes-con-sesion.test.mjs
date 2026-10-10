/*
 * Carlos, 10-10-2026: el censo de clientes y los listados de marcas salen de la parte pública.
 * Sin sesión: /api/clientes y /clientes responden 401; /marcablanca/api/marcas y
 * /marcablanca/clientes/index.json solo traen Admira y las marcas de ejemplo; JTI y Altadis nunca juntos.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { cookieDeSesion, asegurarDirectorio, returnToSeguro } from '../functions/_webmaster-gate.js';
import { onRequestGet as apiClientes } from '../functions/api/clientes.js';
import { onRequestGet as listarMarcasApi } from '../functions/marcablanca/api/marcas/index.js';
import { onRequestGet as indiceJson } from '../functions/marcablanca/clientes/index.json.js';
import { onRequest as paginaClientes } from '../functions/clientes/_middleware.js';
import { MARCAS_PUBLICAS, indicePublico } from '../functions/_marcas-publicas.js';

class St{constructor(s){this.s=s;this.v=[]}bind(...v){this.v=v;return this}first(){return this.s.get(...this.v)||null}all(){return{results:this.s.all(...this.v)}}run(){return{success:true,meta:this.s.run(...this.v)}}}
class D1{constructor(){this.db=new DatabaseSync(':memory:')}prepare(q){return new St(this.db.prepare(q))}async batch(a){return Promise.all(a.map(s=>s.run()))}}
const ORIGEN = 'https://www.admiranext.com';
const INDICE = readFileSync(new URL('../marcablanca/clientes/index.json', import.meta.url), 'utf8');
const assets = { fetch: async (u) => { const p = new URL(u).pathname; try { return new Response(readFileSync(new URL('..' + p, import.meta.url)), { headers: { 'content-type': 'application/json' } }); } catch { return new Response('no', { status: 404 }); } } };
const REALES = /BBVA|Lenovo|JTI|Altadis|Starbucks|CaixaBank|365 Obrador|digitalsignage/i;

async function setup(){ const env={AUTH_DB:new D1(),WEBMASTER_SIGNING_KEY:'censo-test',ASSETS:assets}; await asegurarDirectorio(env); return env; }
async function cookie(env){ const u=await env.AUTH_DB.prepare('SELECT * FROM admiranext_users WHERE email=?').bind('csilva@admira.com').first(); return (await cookieDeSesion(env,u)).split(';')[0]; }
const req = (ruta, c) => new Request(ORIGEN + ruta, c ? { headers: { cookie: c } } : {});

test('/api/clientes: 401 sin sesión, censo con sesión', async () => {
  const env = await setup();
  const sin = await apiClientes({ request: req('/api/clientes'), env });
  assert.equal(sin.status, 401);
  assert.doesNotMatch(await sin.text(), REALES);
  const con = await apiClientes({ request: req('/api/clientes', await cookie(env)), env });
  assert.equal(con.status, 200);
  assert.ok((await con.json()).some((c) => c.id === 'admira'));
  assert.equal(con.headers.get('cache-control'), 'private, no-store');
});

test('/clientes: 401 con login sin sesión; con sesión sale la página', async () => {
  const env = await setup();
  const next = async () => new Response('<html>censo</html>', { headers: { 'content-type': 'text/html' } });
  const sin = await paginaClientes({ request: req('/clientes/'), env, next });
  assert.equal(sin.status, 401);
  assert.doesNotMatch(await sin.text(), /censo<\/html>/);
  const con = await paginaClientes({ request: req('/clientes/', await cookie(env)), env, next });
  assert.equal(con.status, 200);
  assert.equal(returnToSeguro('/clientes/'), '/clientes/');
});

test('/marcablanca/api/marcas sin sesión: solo Admira y ejemplos; con sesión, el catálogo entero', async () => {
  const env = await setup();
  const sin = await (await listarMarcasApi({ request: req('/marcablanca/api/marcas?completo=1'), env })).json();
  assert.ok(sin.clientes.length > 0);
  assert.ok(sin.clientes.every((c) => MARCAS_PUBLICAS.has(c.id)), JSON.stringify(sin.clientes.map((c) => c.id)));
  assert.doesNotMatch(JSON.stringify(sin), REALES);
  assert.equal(sin.publico, true);
  const con = await (await listarMarcasApi({ request: req('/marcablanca/api/marcas', await cookie(env)), env })).json();
  assert.ok(con.clientes.some((c) => c.id === 'jti'));
});

test('/marcablanca/clientes/index.json sin sesión: reducido, sin dominios de clientes', async () => {
  const env = await setup();
  const next = async () => new Response(INDICE, { headers: { 'content-type': 'application/json' } });
  const sin = await (await indiceJson({ request: req('/marcablanca/clientes/index.json'), env, next })).json();
  assert.ok(sin.clientes.every((c) => MARCAS_PUBLICAS.has(c.id)));
  assert.ok(Object.values(sin.dominios).every((id) => MARCAS_PUBLICAS.has(id)));
  assert.doesNotMatch(JSON.stringify(sin), REALES);
  const con = await (await indiceJson({ request: req('/marcablanca/clientes/index.json', await cookie(env)), env, next })).text();
  assert.match(con, /Altadis/);
});

test('JTI y Altadis nunca juntos en lo público, y la lista pública es cerrada', () => {
  assert.equal(MARCAS_PUBLICAS.has('jti') || MARCAS_PUBLICAS.has('altadis'), false);
  const r = indicePublico({ porDefecto: 'jti', clientes: [{ id: 'jti' }, { id: 'altadis' }, { id: 'admira' }, { id: 'nueva', ejemplo: true }] });
  assert.deepEqual(r.clientes.map((c) => c.id), ['admira']);
  assert.equal(r.porDefecto, 'admira');
});
