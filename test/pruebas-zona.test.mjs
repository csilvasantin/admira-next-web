/*
 * /pruebas (Carlos, 10-10-2026): la portada Bits and Atoms (#5547) sale de la portada
 * pública y vive en la zona de pruebas, detrás del mismo login que /flota o /neo58.
 * Toda novedad va primero a /pruebas salvo que Carlos diga otra cosa (normativa 31).
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { cookieDeSesion, asegurarDirectorio, returnToSeguro } from '../functions/_webmaster-gate.js';
import { onRequest as pruebas, paginaDePruebas } from '../functions/pruebas/_middleware.js';

class Statement {
  constructor(stmt){ this.stmt=stmt; this.values=[]; }
  bind(...values){ this.values=values; return this; }
  first(){ return this.stmt.get(...this.values) || null; }
  all(){ return {results:this.stmt.all(...this.values)}; }
  run(){ const meta=this.stmt.run(...this.values); return {success:true,meta}; }
}
class D1 {
  constructor(){ this.db=new DatabaseSync(':memory:'); }
  prepare(sql){ return new Statement(this.db.prepare(sql)); }
  async batch(statements){ return Promise.all(statements.map((s)=>s.run())); }
}
async function setup(){
  const env={AUTH_DB:new D1(),WEBMASTER_SIGNING_KEY:'pruebas-test-key'};
  await asegurarDirectorio(env);
  return env;
}
async function cookie(env,email='csilva@admira.com'){
  const user=await env.AUTH_DB.prepare('SELECT * FROM admiranext_users WHERE email=?').bind(email).first();
  return (await cookieDeSesion(env,user)).split(';')[0];
}
const ESTATICO = '<html>portada Bits and Atoms</html>';
const pide = (env, ruta, init = {}) => pruebas({
  request: new Request('https://www.admiranext.com' + ruta, init), env,
  next: async () => new Response(ESTATICO, { status: 200, headers: { 'content-type': 'text/html', 'cache-control': 'public, max-age=3600' } }),
});

test('sin sesión: /pruebas y todo lo de dentro responde 401 y no sale el estático', async () => {
  const env = await setup();
  for (const ruta of ['/pruebas', '/pruebas/', '/pruebas/index.html', '/pruebas/bits-and-atoms/', '/pruebas/assets/app.js', '/pruebas/assets/app.css']) {
    const res = await pide(env, ruta);
    assert.equal(res.status, 401, ruta);
    assert.doesNotMatch(await res.text(), /Bits and Atoms/, ruta);
  }
  const html = await (await pide(env, '/pruebas/')).text();
  assert.match(html, /Zona de pruebas/);
});

test('con sesión: sale la página, privada y sin indexar', async () => {
  const env = await setup();
  const c = await cookie(env);
  const res = await pide(env, '/pruebas/', { headers: { cookie: c } });
  assert.equal(res.status, 200);
  assert.equal(await res.text(), ESTATICO);
  assert.equal(res.headers.get('cache-control'), 'private, no-store');
  assert.match(res.headers.get('x-robots-tag'), /noindex/);
  const raiz = await pide(env, '/pruebas', { headers: { cookie: c } });
  assert.equal(raiz.status, 302);
  assert.equal(raiz.headers.get('location'), 'https://www.admiranext.com/pruebas/');
});

test('la vuelta tras el login se queda dentro de /pruebas', () => {
  assert.equal(paginaDePruebas('/pruebas'), '/pruebas/');
  assert.equal(paginaDePruebas('/pruebas/bits-and-atoms/'), '/pruebas/bits-and-atoms/');
  assert.equal(paginaDePruebas('/pruebas/assets/app.js'), null);
  assert.equal(returnToSeguro('/pruebas/'), '/pruebas/');
  assert.equal(returnToSeguro('/pruebas/bits-and-atoms/'), '/pruebas/bits-and-atoms/');
  assert.equal(returnToSeguro('/pruebas//evil.com/'), '/webmaster');
  assert.equal(returnToSeguro('/pruebas/../webmaster'), '/webmaster');
});

test('la portada pública no lleva la novedad; la de pruebas sí', () => {
  const publica = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  const enPruebas = readFileSync(new URL('../pruebas/index.html', import.meta.url), 'utf8');
  assert.doesNotMatch(publica, /id="portada"/);
  assert.doesNotMatch(publica, /bits-and-atoms/);
  assert.match(enPruebas, /id="portada"/);
  assert.match(enPruebas, /href="\/pruebas\/bits-and-atoms\/\?marca=lumbre"/);
  assert.match(enPruebas, /\/pruebas\/assets\/app\.js/);
  assert.match(enPruebas, /noindex/);
});
