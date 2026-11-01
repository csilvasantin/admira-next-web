/*
 * /portaventura (Neo, 01-11-2026): PortAventura NeXT en la zona protegida, solo para los emails con permiso.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { cookieDeSesion, asegurarDirectorio } from '../functions/_webmaster-gate.js';
import { onRequest as pa } from '../functions/portaventura/[[path]].js';

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
async function setup(extra = {}){
  const env={AUTH_DB:new D1(),WEBMASTER_SIGNING_KEY:'pa-test-key', ...extra};
  await asegurarDirectorio(env);
  const now=Date.now();
  await env.AUTH_DB.prepare("INSERT INTO admiranext_users(email,display_name,role,status,session_version,created_at,updated_at) VALUES(?,?,'admin','active',1,?,?)").bind('otro@admira.com','otro',now,now).run();
  return env;
}
async function cookie(env,email){
  const user=await env.AUTH_DB.prepare('SELECT * FROM admiranext_users WHERE email=?').bind(email).first();
  return (await cookieDeSesion(env,user)).split(';')[0];
}
const pagina = () => new Response('<html>PortAventura NeXT</html>', {status:200, headers:{'content-type':'text/html'}});
const pide = (env, ruta, headers = {}) => pa({ request: new Request('https://www.admiranext.com' + ruta, {headers}), env, next: async () => pagina() });

test('sin sesión: 401 con el login y sin la página', async () => {
  const env = await setup();
  for (const ruta of ['/portaventura/', '/portaventura/index.html', '/portaventura/?marca=netflix']) {
    const res = await pide(env, ruta);
    assert.equal(res.status, 401);
    assert.doesNotMatch(await res.text(), /PortAventura NeXT<\/html>/);
  }
});

test('las dos cuentas de Neo entran; la página sale privada y sin buscadores', async () => {
  const env = await setup();
  for (const email of ['csilva@admira.com', 'csilvasantin@gmail.com']) {
    const res = await pide(env, '/portaventura/', {Cookie: await cookie(env, email)});
    assert.equal(res.status, 200, email);
    assert.match(await res.text(), /PortAventura NeXT/);
    assert.equal(res.headers.get('cache-control'), 'private, no-store');
    assert.equal(res.headers.get('x-robots-tag'), 'noindex, nofollow');
  }
});

test('otra cuenta del directorio, aunque sea admin: 403', async () => {
  const env = await setup();
  const res = await pide(env, '/portaventura/', {Cookie: await cookie(env, 'otro@admira.com')});
  assert.equal(res.status, 403);
  assert.doesNotMatch(await res.text(), /<html>/);
});

test('PORTAVENTURA_EMAILS amplía la lista sin tocar código', async () => {
  const env = await setup({PORTAVENTURA_EMAILS: ' Otro@admira.com '});
  const res = await pide(env, '/portaventura/', {Cookie: await cookie(env, 'otro@admira.com')});
  assert.equal(res.status, 200);
});
