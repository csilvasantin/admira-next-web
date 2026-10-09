/*
 * /neo58 (Carlos, 09-10-2026): la prueba en vivo de Neo en Unreal 5.8 queda detrás de la
 * zona desmilitarizada. Sin sesión del directorio no sale la página, ni el reproductor, ni
 * la señalización, ni se acepta una frase; con sesión, se reenvía al Mac con la clave.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { cookieDeSesion, asegurarDirectorio, returnToSeguro } from '../functions/_webmaster-gate.js';
import { onRequest as neo58, ORIGEN_NEO58 } from '../functions/neo58/[[path]].js';

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
  const env={AUTH_DB:new D1(),WEBMASTER_SIGNING_KEY:'neo58-test-key',NEO58_ORIGIN_KEY:'clave-de-prueba-0123456789abcdef0123456789', ...extra};
  await asegurarDirectorio(env);
  return env;
}
async function cookie(env,email='csilva@admira.com'){
  const user=await env.AUTH_DB.prepare('SELECT * FROM admiranext_users WHERE email=?').bind(email).first();
  return (await cookieDeSesion(env,user)).split(';')[0];
}
// Sustituye fetch por un Mac de mentira que apunta lo que le llega.
async function conOrigen(fn){
  const real = globalThis.fetch; const llamadas = [];
  globalThis.fetch = async (url, init = {}) => { llamadas.push({url:String(url), method:init.method, headers:new Headers(init.headers), body:init.body ? await new Response(init.body).text() : ''}); return new Response('<html>Neo en vivo</html>', {status:200, headers:{'content-type':'text/html','cache-control':'public, max-age=3600'}}); };
  try { return await fn(llamadas); } finally { globalThis.fetch = real; }
}
const pide = (env, ruta, init = {}) => neo58({ request: new Request('https://www.admiranext.com' + ruta, init), env });

test('sin sesión: la página responde 401 con el login interno y nada sale hacia el Mac', async () => {
  const env = await setup();
  await conOrigen(async (llamadas) => {
    const res = await pide(env, '/neo58/');
    assert.equal(res.status, 401);
    const html = await res.text();
    assert.match(html, /Zona protegida/);
    assert.doesNotMatch(html, /Neo en vivo/);
    assert.equal(llamadas.length, 0);
  });
});

test('sin sesión: ni el reproductor, ni la señalización, ni una frase', async () => {
  const env = await setup();
  await conOrigen(async (llamadas) => {
    assert.equal((await pide(env, '/neo58/uiless.html')).status, 401);
    assert.equal((await pide(env, '/neo58/', {headers:{Upgrade:'websocket'}})).status, 401);
    assert.equal((await pide(env, '/neo58/decir', {method:'POST', headers:{Origin:'https://www.admiranext.com','content-type':'application/json'}, body:'{"text":"hola"}'})).status, 401);
    assert.equal(llamadas.length, 0);
  });
});

test('/neo58 sin barra redirige a /neo58/ para que las rutas relativas del reproductor cuadren', async () => {
  const env = await setup();
  const res = await pide(env, '/neo58');
  assert.equal(res.status, 302);
  assert.equal(res.headers.get('location'), 'https://www.admiranext.com/neo58/');
});

test('con sesión: se reenvía al Mac con la clave, sin la cookie, y la respuesta no se cachea', async () => {
  const env = await setup();
  const c = await cookie(env);
  await conOrigen(async (llamadas) => {
    const res = await pide(env, '/neo58/uiless.html?AutoConnect=true', {headers:{cookie:c}});
    assert.equal(res.status, 200);
    assert.equal(await res.text(), '<html>Neo en vivo</html>');
    assert.equal(res.headers.get('cache-control'), 'private, no-store');
    assert.match(res.headers.get('x-robots-tag'), /noindex/);
    assert.equal(llamadas.length, 1);
    assert.equal(llamadas[0].url, ORIGEN_NEO58 + '/uiless.html?AutoConnect=true');
    assert.equal(llamadas[0].headers.get('x-neo58-clave'), env.NEO58_ORIGIN_KEY);
    assert.equal(llamadas[0].headers.get('x-neo58-usuario'), 'csilva@admira.com');
    assert.equal(llamadas[0].headers.get('cookie'), null, 'la sesión de admiranext.com no viaja al Mac');
  });
});

test('con sesión: la frase solo se acepta desde la propia página y solo en /decir', async () => {
  const env = await setup();
  const c = await cookie(env);
  await conOrigen(async (llamadas) => {
    const cuerpo = '{"text":"[voz=good] hola"}';
    const ajena = await pide(env, '/neo58/decir', {method:'POST', headers:{cookie:c, Origin:'https://otra-web.example','content-type':'application/json'}, body:cuerpo});
    assert.equal(ajena.status, 403);
    const fuera = await pide(env, '/neo58/uiless.html', {method:'POST', headers:{cookie:c, Origin:'https://www.admiranext.com'}, body:cuerpo});
    assert.equal(fuera.status, 405);
    assert.equal((await pide(env, '/neo58/decir', {method:'DELETE', headers:{cookie:c}})).status, 405);
    assert.equal(llamadas.length, 0);
    const buena = await pide(env, '/neo58/decir', {method:'POST', headers:{cookie:c, Origin:'https://www.admiranext.com','content-type':'application/json'}, body:cuerpo});
    assert.equal(buena.status, 200);
    assert.equal(llamadas.length, 1);
    assert.equal(llamadas[0].url, ORIGEN_NEO58 + '/decir');
    assert.equal(llamadas[0].method, 'POST');
    assert.equal(llamadas[0].body, cuerpo);
  });
});

test('sin la clave configurada no se reenvía nada, aunque haya sesión', async () => {
  const env = await setup({NEO58_ORIGIN_KEY:''});
  const c = await cookie(env);
  await conOrigen(async (llamadas) => {
    assert.equal((await pide(env, '/neo58/', {headers:{cookie:c}})).status, 503);
    assert.equal(llamadas.length, 0);
  });
});

test('un usuario suspendido se queda fuera y, tras el login, se vuelve a /neo58/', async () => {
  const env = await setup();
  const c = await cookie(env);
  await env.AUTH_DB.prepare("UPDATE admiranext_users SET status='suspended' WHERE email=?").bind('csilva@admira.com').run();
  await conOrigen(async (llamadas) => {
    assert.equal((await pide(env, '/neo58/', {headers:{cookie:c}})).status, 401);
    assert.equal(llamadas.length, 0);
  });
  assert.equal(returnToSeguro('/neo58/'), '/neo58/');
  assert.notEqual(returnToSeguro('/neo58/../webmaster'), '/neo58/../webmaster');
});
