// FLT-100782 (Morfeo, 21-sep-2026) · una sola puerta: /presentations deja de ser un login.
//
// /presentations tenía su propio control de acceso, copia del de /presentaciones sin
// directorio, sin Google y sin contraseña genérica. Ahora sólo redirige, conservando cada
// enlace ya enviado, y los decks en inglés se sirven en /presentaciones/<cliente>/english
// detrás de la puerta común.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile, readdir} from 'node:fs/promises';
import {onRequest as legacy, legacyTarget} from '../functions/presentations/_middleware.js';
import {onRequest as english} from '../functions/presentaciones/[client]/english.js';
import {onRequest as puerta} from '../functions/presentaciones/_middleware.js';

test('cada enlace antiguo tiene su destino (con o sin .html, mayúsculas o barra final)', () => {
  const casos = {
    '/presentations':'/presentaciones/galeria', '/presentations/':'/presentaciones/galeria', '/presentations/index.html':'/presentaciones/galeria',
    '/presentations/LaCaixa':'/presentaciones/lacaixa/english', '/presentations/LaCaixa.html':'/presentaciones/lacaixa/english',
    '/presentations/caixa.html':'/presentaciones/caixa/english', '/presentations/lenovo.html':'/presentaciones/lenovo/english', '/presentations/lenovo/':'/presentaciones/lenovo/english',
    '/presentations/nvidia.html':'/presentaciones/nvidia/presentacion', '/presentations/nvidia':'/presentaciones/nvidia/presentacion',
    '/presentations/cliente-generado':'/presentaciones/cliente-generado/presentacion'
  };
  for (const [desde, hacia] of Object.entries(casos)) assert.equal(legacyTarget(desde)?.path, hacia, desde);
  assert.equal(legacyTarget('/presentations/lenovo/otra/cosa'), null);
  assert.equal(legacyTarget('/presentations/<script>'), null);
});

test('GET redirige 301 (caché corta) conservando la query; POST, 307; nunca sirve el HTML', async () => {
  const get = await legacy({request:new Request('https://www.admiranext.com/presentations/LaCaixa?utm=correo')});
  assert.equal(get.status, 301);
  assert.equal(get.headers.get('location'), '/presentaciones/lacaixa/english?utm=correo');
  assert.equal(get.headers.get('cache-control'), 'public, max-age=3600');
  const post = await legacy({request:new Request('https://www.admiranext.com/presentations/lenovo.html', {method:'POST', body:'password=x'})});
  assert.equal(post.status, 307);
  assert.equal(post.headers.get('location'), '/presentaciones/lenovo/english');
  // Un deck generado abre en inglés; si ya pedía idioma, se respeta.
  assert.equal((await legacy({request:new Request('https://www.admiranext.com/presentations/demo')})).headers.get('location'), '/presentaciones/demo/presentacion?lang=en');
  assert.equal((await legacy({request:new Request('https://www.admiranext.com/presentations/demo?lang=ca')})).headers.get('location'), '/presentaciones/demo/presentacion?lang=ca');
  assert.equal((await legacy({request:new Request('https://www.admiranext.com/presentations/a/b/c')})).status, 404);
});

const assets = llamadas => ({async fetch(url){ llamadas.push(String(url)); const file = new URL(url).pathname; return file.startsWith('/presentations/') ? new Response(`<html><body>${file}</body></html>`, {headers:{'content-type':'text/html'}}) : new Response('no', {status:404}); }});

test('la ruta /english sirve el HTML inglés de cada cliente y nada más', async () => {
  const llamadas = [];
  const r = await english({request:new Request('https://x/presentaciones/lacaixa/english'), env:{ASSETS:assets(llamadas)}, params:{client:'lacaixa'}});
  assert.equal(r.status, 200);
  assert.match(await r.text(), /\/presentations\/LaCaixa\.html/);
  assert.equal(r.headers.get('cache-control'), 'no-store');
  assert.equal((await english({request:new Request('https://x/presentaciones/nvidia/english'), env:{ASSETS:assets([])}, params:{client:'nvidia'}})).status, 404);
  assert.equal((await english({request:new Request('https://x/presentaciones/lenovo/english', {method:'POST'}), env:{ASSETS:assets([])}, params:{client:'lenovo'}})).status, 405);
});

// ── Integración con la puerta común ─────────────────────────────────────────
function kv(){ const m = new Map(); return {async get(k, o){ const v = m.get(k); return v == null ? null : o?.type === 'json' ? JSON.parse(v) : v; }, async put(k, v){ m.set(k, v); }, async delete(k){ m.delete(k); }, async list(){ return {keys:[]}; }}; }
const cookies = r => r.headers.getSetCookie().map(v => v.split(';', 1)[0]).join('; ');

async function sala(env, {method = 'GET', cookie = '', body, llamadas = []} = {}){
  const url = 'https://www.admiranext.com/presentaciones/lenovo/english';
  const headers = {accept:'text/html', 'CF-Connecting-IP':'203.0.113.30', ...(cookie ? {cookie} : {}), ...(body ? {'content-type':'application/x-www-form-urlencoded'} : {})};
  const eventos = [];
  const request = new Request(url, {method, headers, body});
  const response = await puerta({request, env, data:{}, waitUntil(p){ eventos.push(p); }, next:() => english({request, env, params:{client:'lenovo'}})});
  return {response, eventos};
}
const entorno = () => { const llamadas = []; return {llamadas, env:{PRES_SIGNING_KEY:'legacy-key', PRES_ADMIN:'maestra', PRES_GENERIC:'generica-1234', PRES_LENOVO:'lenovo-5678', PRESENTATION_IDEAS:kv(), ACCESS_EVENTS:undefined, ASSETS:assets(llamadas)}}; };
const entrar = async (env, password) => {
  const {response} = await sala(env, {method:'POST', body:new URLSearchParams({name:'Ana Prueba', email:'ana@example.com', password})});
  assert.equal(response.status, 303, `login con ${password}`);
  return cookies(response);
};

test('sin sesión, el deck inglés pide acceso y NO se lee el HTML', async () => {
  const {env, llamadas} = entorno();
  const {response} = await sala(env);
  assert.equal(response.status, 401);
  assert.deepEqual(llamadas, []);
});

test('con la contraseña del cliente se entra al deck inglés por la puerta común', async () => {
  const {env} = entorno();
  const {response} = await sala(env, {cookie:await entrar(env, 'lenovo-5678')});
  assert.equal(response.status, 200);
  assert.match(await response.text(), /\/presentations\/lenovo\.html[\s\S]*presentation-telemetry\.js/);
});

test('la contraseña genérica, que en la puerta inglesa no valía, ahora también entra', async () => {
  const {env} = entorno();
  assert.equal((await sala(env, {cookie:await entrar(env, 'generica-1234')})).response.status, 200);
});

test('la cookie de OTRO cliente no abre el deck inglés de Lenovo', async () => {
  const {env} = entorno();
  const otra = await puerta({request:new Request('https://www.admiranext.com/presentaciones/caixa/presentacion', {method:'POST', headers:{'content-type':'application/x-www-form-urlencoded', 'CF-Connecting-IP':'203.0.113.31'}, body:new URLSearchParams({name:'Ana Prueba', email:'ana@example.com', password:'generica-1234'})}), env, data:{}, waitUntil(){}, next:async () => new Response('ok')});
  assert.equal(otra.status, 303);
  assert.equal((await sala(env, {cookie:cookies(otra)})).response.status, 401);
});

test('ningún HTML enlaza ya a /presentations: los selectores de idioma van directos', async () => {
  const ficheros = [];
  for (const dir of ['presentaciones', 'presentations']) {
    for (const f of await readdir(new URL(`../${dir}/`, import.meta.url), {recursive:true})) if (f.endsWith('.html')) ficheros.push(`${dir}/${f}`);
  }
  for (const f of ficheros) assert.doesNotMatch(await readFile(new URL(`../${f}`, import.meta.url), 'utf8'), /["'(]\/presentations\//, f);
  const lenovo = await readFile(new URL('../presentaciones/lenovo.html', import.meta.url), 'utf8');
  assert.match(lenovo, /hreflang="en" href="\/presentaciones\/lenovo\/english"/);
  assert.match(lenovo, /'\/presentaciones\/lenovo\/english'/);
});
