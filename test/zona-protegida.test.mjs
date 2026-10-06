/*
 * Zona protegida (Carlos, 06-10-2026): Style Book, Agentes y Organigrama salen de la
 * navegación pública de la portada y quedan detrás del mismo acceso que /webmaster.
 * La verja es de servidor: sin sesión el HTML no sale del edge.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { DatabaseSync } from 'node:sqlite';
import { cookieDeSesion, asegurarDirectorio, returnToSeguro } from '../functions/_webmaster-gate.js';
import { ZONA_PROTEGIDA } from '../functions/_zona-protegida.js';
import { onRequest as libro } from '../functions/libro-de-estilo.js';
import { onRequest as flota } from '../functions/flota.js';
import { onRequest as organigrama } from '../functions/organigrama.js';

const read = (p) => readFile(new URL(p, import.meta.url), 'utf8');

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
  const env={AUTH_DB:new D1(),WEBMASTER_SIGNING_KEY:'zona-test-key'};
  await asegurarDirectorio(env);
  return env;
}
async function cookie(env,email){
  const user=await env.AUTH_DB.prepare('SELECT * FROM admiranext_users WHERE email=?').bind(email).first();
  return (await cookieDeSesion(env,user)).split(';')[0];
}
const PAGINAS = [['/libro-de-estilo', libro], ['/flota', flota], ['/organigrama', organigrama]];
const SECRETO = '<html>contenido interno de la página</html>';
function pide(handler, ruta, env, cookieValue){
  let servida = false;
  const next = async () => { servida = true; return new Response(SECRETO, {headers:{'content-type':'text/html','cache-control':'public, max-age=0, must-revalidate'}}); };
  const request = new Request('https://www.admiranext.com'+ruta, {headers: cookieValue ? {cookie:cookieValue} : {}});
  return handler({request, env, next}).then((res) => ({res, servida: () => servida}));
}

test('la navegación pública de la portada deja solo Platform, Robots, About us y Contact', async () => {
  const index = await read('../index.html');
  const nav = index.match(/<nav class="entry-nav"[\s\S]*?<\/nav>/)?.[0] || '';
  assert.ok(nav, 'la portada tiene su navegación de entrada');
  for (const ruta of ['/libro-de-estilo', '/flota', '/organigrama']) assert.ok(!nav.includes(`href="${ruta}"`), `${ruta} fuera de la navegación pública`);
  assert.doesNotMatch(nav, />\s*(Style book|Agentes|Organigrama)\s*</i);
  for (const marca of ['data-entry-best', 'data-entry-robots', 'data-entry-about', 'data-entry-contact-panel']) assert.ok(nav.includes(marca), `sigue ${marca}`);
});

test('sin sesión las tres páginas responden 401 con el login interno y no sueltan su HTML', async () => {
  const env = await setup();
  for (const [ruta, handler] of PAGINAS) {
    const {res, servida} = await pide(handler, ruta, env, null);
    assert.equal(res.status, 401, ruta);
    const body = await res.text();
    assert.match(body, /AdmiraNeXT · Acceso/, ruta);
    assert.match(body, /Zona protegida/, ruta);
    assert.doesNotMatch(body, /contenido interno/, ruta);
    assert.equal(servida(), false, `${ruta}: el HTML estático no se pide sin sesión`);
    assert.equal(res.headers.get('cache-control'), 'no-store');
    const challenge = await env.AUTH_DB.prepare('SELECT return_to FROM admiranext_login_challenges ORDER BY created_at DESC, rowid DESC LIMIT 1').first();
    assert.equal(challenge.return_to, ruta, `${ruta}: tras el login se vuelve a la página pedida`);
  }
});

test('una cookie falsa o sin clave de firma no abre la zona protegida', async () => {
  const env = await setup();
  for (const [ruta, handler] of PAGINAS) {
    const {res, servida} = await pide(handler, ruta, env, '__Host-an_session=falsa.firma');
    assert.equal(res.status, 401); assert.equal(servida(), false);
  }
  const sinClave = {...env, WEBMASTER_SIGNING_KEY: ''};
  const {res, servida} = await pide(flota, '/flota', sinClave, null);
  assert.equal(res.status, 503); assert.equal(servida(), false);
});

test('con sesión del directorio se sirve la página, sin caché compartida y fuera de buscadores', async () => {
  const env = await setup();
  const c = await cookie(env, 'csilva@admira.com');
  for (const [ruta, handler] of PAGINAS) {
    const {res, servida} = await pide(handler, ruta, env, c);
    assert.equal(res.status, 200, ruta);
    assert.equal(servida(), true);
    assert.equal(await res.text(), SECRETO);
    assert.equal(res.headers.get('cache-control'), 'private, no-store');
    assert.equal(res.headers.get('x-robots-tag'), 'noindex, nofollow');
  }
});

test('el login devuelve a cada página protegida y a nada arbitrario', () => {
  for (const {ruta} of ZONA_PROTEGIDA) assert.equal(returnToSeguro(ruta), ruta);
  assert.equal(returnToSeguro('/flota/../usuarios-x'), '/webmaster');
  assert.equal(returnToSeguro('https://evil.example/flota'), '/webmaster');
});

test('la zona protegida (/webmaster) enlaza las tres páginas y el sitemap ya no las anuncia', async () => {
  const webmaster = await read('../webmaster.html');
  const bloque = webmaster.match(/id="zona-protegida"[\s\S]*?<\/nav>/)?.[0] || '';
  for (const ruta of ['/libro-de-estilo', '/flota', '/organigrama']) assert.ok(bloque.includes(`href="${ruta}"`), ruta);
  const sitemap = await read('../sitemap.xml');
  assert.doesNotMatch(sitemap, /admiranext\.com\/(libro-de-estilo|flota|organigrama)</);
  for (const p of ['../flota.html', '../organigrama.html', '../libro-de-estilo.html']) assert.match(await read(p), /name="robots" content="noindex,nofollow"/, p);
});

// ── Sello solo con sesión (Carlos, 06-10-2026): la parte pública no enseña sello ni novedades ──
import { onRequestGet as apiSello } from '../functions/api/sello.js';
import vm from 'node:vm';

test('/api/sello dice sesion:false al anónimo (200, sin caché) y sesion:true al registrado', async () => {
  const env = await setup();
  const anon = await apiSello({request: new Request('https://www.admiranext.com/api/sello'), env});
  assert.equal(anon.status, 200);
  assert.deepEqual(await anon.json(), {ok: true, sesion: false});
  assert.equal(anon.headers.get('cache-control'), 'private, no-store');
  const falsa = await apiSello({request: new Request('https://www.admiranext.com/api/sello', {headers: {cookie: '__Host-an_session=x.y'}}), env});
  assert.equal((await falsa.json()).sesion, false);
  const c = await cookie(env, 'csilva@admira.com');
  const dentro = await apiSello({request: new Request('https://www.admiranext.com/api/sello', {headers: {cookie: c}}), env});
  assert.equal((await dentro.json()).sesion, true);
});

test('la portada y el armazón ya no cargan el sello directamente: pasan por sello-sesion.js', async () => {
  const index = await read('../index.html');
  assert.doesNotMatch(index, /<script[^>]+sello-novedades\.js/, 'la portada no inyecta el sello en su marcado');
  assert.match(index, /<script defer src="\/assets\/sello-sesion\.js\?v=/);
  const frame = await read('../assets/admira-frame.js');
  assert.doesNotMatch(frame, /script\.src = '\/assets\/sello-novedades\.js/);
  assert.match(frame, /script\.src = '\/assets\/sello-sesion\.js\?v=/);
  assert.match(frame, /texto\('span', '', 'ADmiraNeXT'\)/, 'el pie de los paneles no enseña versión de partida');
});

async function cargarSelloSesion(respuesta) {
  const src = await read('../assets/sello-sesion.js');
  const añadidos = [], llamadas = [];
  const classList = {on: {}, toggle(k, v) { this.on[k] = !!v; }};
  const document = {
    documentElement: {classList}, head: {appendChild(n) { añadidos.push(n); }},
    querySelector: () => null,
    createElement: () => ({setAttribute(k, v) { this[k] = v; }}),
  };
  const win = {document, location: {protocol: 'https:'}, fetch: async (url, opts) => { llamadas.push([url, opts]); return {ok: true, json: async () => respuesta}; }};
  win.self = win; win.top = win;
  let arranque = 0; win.AdmiraSelloArranque = () => { arranque++; };
  vm.runInNewContext(src, {window: win, document, location: win.location, Promise});
  await win.__admiraSesionSello; await new Promise((r) => setTimeout(r, 0));
  return {añadidos, llamadas, classList, arranque};
}

test('sello-sesion.js: anónimo → ni cargador ni versión; con sesión → carga el sello común', async () => {
  const anon = await cargarSelloSesion({ok: true, sesion: false});
  assert.equal(anon.llamadas[0][0], '/api/sello');
  assert.equal(anon.añadidos.length, 0, 'sin sesión no se inyecta sello-novedades.js');
  assert.equal(anon.arranque, 0, 'ni se escribe la versión en el arranque');
  assert.equal(anon.classList.on['admira-con-sesion'], false);
  const dentro = await cargarSelloSesion({ok: true, sesion: true});
  assert.equal(dentro.añadidos.length, 1);
  assert.match(dentro.añadidos[0].src, /^\/assets\/sello-novedades\.js\?v=/);
  assert.equal(dentro.arranque, 1);
  assert.equal(dentro.classList.on['admira-con-sesion'], true);
});
