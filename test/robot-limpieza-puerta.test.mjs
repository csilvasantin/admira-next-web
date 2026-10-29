/*
 * /robot/limpieza usa el mismo login que /pruebas (encargo #7273).
 * Sin sesión no sale el HTML ni los assets.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { cookieDeSesion, asegurarDirectorio, returnToSeguro } from '../functions/_webmaster-gate.js';
import { onRequest as limpieza, paginaDeLimpieza } from '../functions/robot/limpieza/_middleware.js';

class Statement {
  constructor(stmt) { this.stmt = stmt; this.values = []; }
  bind(...values) { this.values = values; return this; }
  first() { return this.stmt.get(...this.values) || null; }
  all() { return { results: this.stmt.all(...this.values) }; }
  run() { this.stmt.run(...this.values); return { success: true }; }
}
class D1 {
  constructor() { this.db = new DatabaseSync(':memory:'); }
  prepare(sql) { return new Statement(this.db.prepare(sql)); }
  async batch(statements) { return Promise.all(statements.map((s) => s.run())); }
}
async function setup() {
  const env = { AUTH_DB: new D1(), WEBMASTER_SIGNING_KEY: 'limpieza-test-key' };
  await asegurarDirectorio(env);
  return env;
}
async function cookie(env, email = 'csilva@admira.com') {
  const user = await env.AUTH_DB.prepare('SELECT * FROM admiranext_users WHERE email=?').bind(email).first();
  return (await cookieDeSesion(env, user)).split(';')[0];
}
const ESTATICO = '<html>Ir a Cocina y No hay señal de cámara</html>';
const pide = (env, ruta, init = {}) => limpieza({
  request: new Request('https://www.admiranext.com' + ruta, init),
  env,
  next: async () => new Response(ESTATICO, { status: 200, headers: { 'content-type': 'text/html', 'cache-control': 'public, max-age=3600' } }),
});

test('sin sesión: la página y los assets responden 401 y no sale el estático', async () => {
  const env = await setup();
  for (const ruta of ['/robot/limpieza', '/robot/limpieza/', '/robot/limpieza/index.html', '/robot/limpieza/limpieza.js', '/robot/limpieza/limpieza.css']) {
    const res = await pide(env, ruta);
    assert.equal(res.status, 401, ruta);
    assert.doesNotMatch(await res.text(), /Ir a Cocina/, ruta);
  }
  const html = await (await pide(env, '/robot/limpieza/')).text();
  assert.match(html, /Limpieza del robot/);
  const asset = await (await pide(env, '/robot/limpieza/limpieza.js')).text();
  assert.match(asset, /Sin sesión/);
});

test('con sesión: sale la página, privada y sin indexar', async () => {
  const env = await setup();
  const c = await cookie(env);
  const res = await pide(env, '/robot/limpieza/', { headers: { cookie: c } });
  assert.equal(res.status, 200);
  assert.equal(await res.text(), ESTATICO);
  assert.equal(res.headers.get('cache-control'), 'private, no-store');
  assert.match(res.headers.get('x-robots-tag'), /noindex/);
  const raiz = await pide(env, '/robot/limpieza', { headers: { cookie: c } });
  assert.equal(raiz.status, 302);
  assert.equal(raiz.headers.get('location'), 'https://www.admiranext.com/robot/limpieza/');
});

test('la vuelta tras el login se queda en la pantalla y un post no entra', async () => {
  assert.equal(paginaDeLimpieza('/robot/limpieza'), '/robot/limpieza/');
  assert.equal(paginaDeLimpieza('/robot/limpieza/limpieza.js'), null);
  assert.equal(returnToSeguro('/robot/limpieza'), '/robot/limpieza/');
  assert.equal(returnToSeguro('/robot/limpieza/'), '/robot/limpieza/');
  assert.equal(returnToSeguro('/robot/limpieza/index.html'), '/robot/limpieza/');
  assert.equal(returnToSeguro('/robot/limpieza/../pruebas/'), '/webmaster');
  assert.equal(returnToSeguro('/robot/limpieza/limpieza.js'), '/webmaster');
  const env = await setup();
  const post = await pide(env, '/robot/limpieza/', { method: 'POST' });
  assert.equal(post.status, 405);
});

test('el sitemap público no anuncia la pantalla', () => {
  const mapa = readFileSync(new URL('../sitemap.xml', import.meta.url), 'utf8');
  assert.doesNotMatch(mapa, /robot\/limpieza/);
});
