/*
 * Detalle de proyecto en la zona protegida (Carlos, 20-10-2026): /proyectos/<clave>/ y sus ficheros
 * solo salen con sesión del directorio; el censo público /proyectos/ sigue abierto.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { cookieDeSesion, asegurarDirectorio, returnToSeguro } from '../functions/_webmaster-gate.js';
import { onRequest as detalle } from '../functions/proyectos/[[ruta]].js';

class St{constructor(s){this.s=s;this.v=[]}bind(...v){this.v=v;return this}first(){return this.s.get(...this.v)||null}all(){return{results:this.s.all(...this.v)}}run(){return{success:true,meta:this.s.run(...this.v)}}}
class D1{constructor(){this.db=new DatabaseSync(':memory:')}prepare(q){return new St(this.db.prepare(q))}async batch(a){return Promise.all(a.map(s=>s.run()))}}
const ORIGEN = 'https://www.admiranext.com';
async function setup(){ const env={AUTH_DB:new D1(),WEBMASTER_SIGNING_KEY:'proyectos-test'}; await asegurarDirectorio(env); return env; }
async function cookie(env){ const u=await env.AUTH_DB.prepare('SELECT * FROM admiranext_users WHERE email=?').bind('csilva@admira.com').first(); return (await cookieDeSesion(env,u)).split(';')[0]; }
const req = (ruta, c) => new Request(ORIGEN + ruta, c ? { headers: { cookie: c } } : {});
const next = async () => new Response('<html>detalle GDG51-PAN-07</html>', { headers: { 'content-type': 'text/html' } });

test('sin sesión, el detalle y sus ficheros responden 401 con el login y sin el contenido', async () => {
  const env = await setup();
  for (const [ruta, params] of [['/proyectos/laboratorio/', ['laboratorio']], ['/proyectos/laboratorio/handon.md', ['laboratorio', 'handon.md']],
    ['/proyectos/cafebreria/manifest.json', ['cafebreria', 'manifest.json']], ['/proyectos/cafebreria', ['cafebreria']]]) {
    const r = await detalle({ request: req(ruta), env, next, params: { ruta: params } });
    assert.equal(r.status, 401, ruta);
    assert.doesNotMatch(await r.text(), /GDG51-PAN-07/, ruta);
  }
});

test('con sesión sale el detalle, privado y sin indexar; el censo /proyectos/ sigue público', async () => {
  const env = await setup();
  const con = await detalle({ request: req('/proyectos/laboratorio/', await cookie(env)), env, next, params: { ruta: ['laboratorio'] } });
  assert.equal(con.status, 200);
  assert.match(await con.text(), /GDG51-PAN-07/);
  assert.equal(con.headers.get('cache-control'), 'private, no-store');
  assert.equal(con.headers.get('x-robots-tag'), 'noindex, nofollow');
  for (const params of [{}, { ruta: [] }, { ruta: '' }]) {
    const censo = await detalle({ request: req('/proyectos/'), env, next, params });
    assert.equal(censo.status, 200);
  }
  assert.equal(returnToSeguro('/proyectos/laboratorio/'), '/proyectos/laboratorio/');
  assert.equal(returnToSeguro('/proyectos/../usuarios/'), '/webmaster');
});

test('los handON del laboratorio y de Cafebrería viven aquí, sin el shell de clearchannel', () => {
  for (const clave of ['laboratorio', 'cafebreria']) {
    const html = readFileSync(new URL(`../proyectos/${clave}/index.html`, import.meta.url), 'utf8');
    assert.match(html, new RegExp(`href="/proyectos/${clave}/handon\\.md"`));
    assert.doesNotMatch(html, /galaxy-shell|brand\.js|ADMIRA_SHELL/);
    assert.match(html, /noindex, nofollow/);
    assert.ok(readFileSync(new URL(`../proyectos/${clave}/handon.md`, import.meta.url), 'utf8').length > 500);
  }
  JSON.parse(readFileSync(new URL('../proyectos/cafebreria/manifest.json', import.meta.url), 'utf8'));
});

test('/documentacion: 401 sin sesión y sin el material; con sesión sale privado', async () => {
  const { onRequest: documentacion } = await import('../functions/documentacion/_middleware.js');
  const env = await setup();
  const nextDoc = async () => new Response('<html>informe estratégico</html>', { headers: { 'content-type': 'text/html' } });
  for (const ruta of ['/documentacion/', '/documentacion/informe-estrategico.txt', '/documentacion/agentic-retail-media-dooh.pdf']) {
    const sin = await documentacion({ request: req(ruta), env, next: nextDoc });
    assert.equal(sin.status, 401, ruta);
    assert.doesNotMatch(await sin.text(), /informe estratégico/, ruta);
  }
  const con = await documentacion({ request: req('/documentacion/', await cookie(env)), env, next: nextDoc });
  assert.equal(con.status, 200);
  assert.equal(con.headers.get('cache-control'), 'private, no-store');
  assert.equal(returnToSeguro('/documentacion/'), '/documentacion/');
  const html = readFileSync(new URL('../documentacion/index.html', import.meta.url), 'utf8');
  assert.match(html, /noindex, nofollow/);
  assert.doesNotMatch(html, /galaxy-shell|brand\.js|data-shell-slots hidden/);
});
