/*
 * /roadmap/encargos (19-10-2026): tabla de encargos abiertos por persona bajo RoadMap.
 * Misma verja de servidor que /roadmap; las cifras solo salen con sesión.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { DatabaseSync } from 'node:sqlite';
import { cookieDeSesion, asegurarDirectorio, returnToSeguro } from '../functions/_webmaster-gate.js';
import { onRequestGet as encargos } from '../functions/roadmap/encargos.js';
import { SEMILLA, CLAVE_KV, normalizar, totales, parteVigente, htmlParte, marcarActivos, esConsejero, leerActivos, TRABAJANDO_API } from '../functions/_encargos-matinal.js';
import { parsear } from '../scripts/encargos-matinal.mjs';

const read = (p) => readFile(new URL(p, import.meta.url), 'utf8');
class Statement { constructor(s){this.s=s;this.v=[];} bind(...v){this.v=v;return this;} first(){return this.s.get(...this.v)||null;} all(){return {results:this.s.all(...this.v)};} run(){return {success:true,meta:this.s.run(...this.v)};} }
class D1 { constructor(){this.db=new DatabaseSync(':memory:');} prepare(q){return new Statement(this.db.prepare(q));} async batch(st){return Promise.all(st.map((x)=>x.run()));} }
async function setup(extra = {}) {
  const env = { AUTH_DB: new D1(), WEBMASTER_SIGNING_KEY: 'enc-test-key', TRABAJANDO_FETCH: async () => new Response('', { status: 503 }), ...extra };
  await asegurarDirectorio(env);
  const html = await read('../roadmap/encargos.html');
  env.ASSETS = { fetched: 0, fetch: async (u) => { env.ASSETS.fetched++; return new URL(u).pathname === '/roadmap/encargos' ? new Response(html) : new Response('', { status: 404 }); } };
  return env;
}
async function cookie(env, email) {
  const u = await env.AUTH_DB.prepare('SELECT * FROM admiranext_users WHERE email=?').bind(email).first();
  return (await cookieDeSesion(env, u)).split(';')[0];
}
const pide = (env, c) => encargos({ request: new Request('https://www.admiranext.com/roadmap/encargos', { headers: c ? { cookie: c } : {} }), env });

test('sin sesión responde 401 con el login, sin cifras y sin pedir la plantilla', async () => {
  const env = await setup();
  const res = await pide(env, null);
  assert.equal(res.status, 401);
  const body = await res.text();
  assert.match(body, /AdmiraNeXT · Acceso/);
  assert.doesNotMatch(body, /Smith|Trinity|Encargos abiertos|Misiones abiertas/);
  assert.equal(env.ASSETS.fetched, 0);
  const ch = await env.AUTH_DB.prepare('SELECT return_to FROM admiranext_login_challenges ORDER BY created_at DESC, rowid DESC LIMIT 1').first();
  assert.equal(ch.return_to, '/roadmap/encargos', 'tras el login vuelve a la tabla');
});

test('cookie falsa no entra y sin clave de firma da 503', async () => {
  const env = await setup();
  assert.equal((await pide(env, '__Host-an_session=falsa.firma')).status, 401);
  assert.equal((await pide({ ...env, WEBMASTER_SIGNING_KEY: '' }, null)).status, 503);
});

test('con sesión pinta «Misiones» en dos tablas (Consejeros | Agentes) con su Total fijo en tfoot, cache privada y noindex', async () => {
  const env = await setup();
  const res = await pide(env, await cookie(env, 'csilva@admira.com'));
  assert.equal(res.status, 200);
  assert.equal(res.headers.get('cache-control'), 'private, no-store');
  assert.equal(res.headers.get('x-robots-tag'), 'noindex, nofollow');
  const body = await res.text();
  assert.doesNotMatch(body, /<!--ENC_/);
  assert.match(body, /<title>Misiones · RoadMap · ADmiraNeXT<\/title>/);
  assert.match(body, /<h1>Misiones abiertas por persona<\/h1>/);
  assert.match(body, /aria-current="page">Misiones<\/a>/);
  assert.doesNotMatch(body.replace(/\/roadmap\/encargos|roadmap-encargos\.js[^"]*/g, ''), />[^<]*Encargos[^<]*</, 'ningún texto visible dice «Encargos»');
  assert.match(body, /19-oct-2026 a las 08:01/);
  const tablas = [...body.matchAll(/<table class="enc" id="(enc-[a-z]+)"[\s\S]*?<\/table>/g)];
  assert.deepEqual(tablas.map((t) => t[1]), ['enc-consejeros', 'enc-agentes'], 'izquierda Consejeros, derecha Agentes');
  const [consejo, agentes] = tablas.map((t) => t[0]);
  assert.match(agentes, /<tr data-persona="smith"><td>Smith<\/td><td>18<\/td><td>0<\/td><td>7<\/td><td>11<\/td><\/tr>/);
  assert.doesNotMatch(consejo, /Smith|Trinity|Resto de agentes/);
  assert.doesNotMatch(agentes, /Wozniak|Jobs|Musk|Huang/);
  assert.match(consejo.match(/<tfoot>([\s\S]*?)<\/tfoot>/)[1], /<td>Total<\/td><td>7<\/td><td>3<\/td><td>3<\/td><td>1<\/td>/);
  assert.match(agentes.match(/<tfoot>([\s\S]*?)<\/tfoot>/)[1], /<td>Total<\/td><td>54<\/td><td>0<\/td><td>32<\/td><td>22<\/td>/);
  for (const t of [consejo, agentes]) assert.doesNotMatch(t.match(/<tbody>([\s\S]*?)<\/tbody>/)[1], /Total/, 'el Total no está en tbody: ordenar no lo mueve');
  for (const col of ['Persona', 'Abiertas', 'Hoy', 'Ayer', 'Anteriores']) assert.equal(body.split(`<button type="button">${col}</button>`).length - 1, 2);
  assert.match(body, /<a href="\/roadmap" aria-current="page" data-yk-interno>RoadMap<\/a>/, 'cuelga de RoadMap en la cabecera');
  assert.match(body, /Sin lectura de actividad de admira\.live/, 'si la flota no responde no late nadie y se dice');
  assert.doesNotMatch(body, /class="activo"/);
});

test('latido: quien está en verde en admira.live/api/flota/trabajando late; amarillo/gris no', async () => {
  const tarjetas = [
    { agente: 'Neo', estado: 'verde', consejero: false },
    { agente: 'Jobs', estado: 'verde', consejero: true },
    { agente: 'Musk', estado: 'amarillo', consejero: true },
    { agente: 'Merovingio', estado: 'verde', consejero: false },
    { agente: 'Smith', estado: 'gris', consejero: false },
  ];
  let pedida = null;
  const env = await setup({ TRABAJANDO_FETCH: async (u) => { pedida = u; return Response.json({ ok: true, tarjetas }); } });
  const body = await (await pide(env, await cookie(env, 'csilva@admira.com'))).text();
  assert.equal(pedida, TRABAJANDO_API);
  assert.match(body, /<tr data-persona="neo" class="activo" title="Trabajando ahora en una misión"><td>Neo<\/td>/);
  assert.match(body, /<tr data-persona="jobs" class="activo"[^>]*><td>Jobs<\/td>/);
  assert.match(body, /<tr data-persona="musk"><td>Musk<\/td>/);
  assert.match(body, /<tr data-persona="smith"><td>Smith<\/td>/);
  assert.match(body, /<tr data-persona="resto de agentes" class="activo"[^>]*><td>Resto de agentes<\/td>/, 'Merovingio no tiene fila: late el Resto');
  assert.match(body, /3 personas laten ahora: trabajan en una misión/);
  const red = await leerActivos({ TRABAJANDO_FETCH: async () => { throw new Error('sin red'); } });
  assert.deepEqual(red, { ok: false, activos: [] });
});

test('consejeros por nombre y alias; Oráculo con tilde casa con la flota', () => {
  for (const n of ['Wozniak', 'Jobs', 'Lucas', 'Disney', 'Musk', 'Huang', 'Elon', 'Jensen']) assert.ok(esConsejero(n), n);
  for (const n of ['Neo', 'Smith', 'Oráculo', 'Resto de agentes']) assert.ok(!esConsejero(n), n);
  const f = marcarActivos([{ persona: 'Oráculo' }, { persona: 'Musk' }], [{ clave: 'oraculo' }, { clave: 'musk', consejero: true }]);
  assert.deepEqual(f.map((x) => x.activo), [true, true]);
  const p = htmlParte({ ...normalizar(SEMILLA), origen: 'semilla' });
  assert.match(p.total, /<td>Total<\/td><td>61<\/td>/, 'el total global sigue cuadrando');
});

test('el latido es CSS, respeta prefers-reduced-motion y se refresca en el cliente', async () => {
  const html = await read('../roadmap/encargos.html');
  assert.match(html, /\.enc-dos\{display:grid;grid-template-columns:repeat\(2,minmax\(0,1fr\)\)/);
  assert.match(html, /@media \(max-width:767px\)\{\.enc-dos\{grid-template-columns:minmax\(0,1fr\)\}/, 'en móvil una debajo de otra');
  assert.match(html, /@keyframes enc-latido/);
  assert.match(html, /@media \(prefers-reduced-motion:reduce\)\{[^}]*animation:none/);
  const js = await read('../assets/roadmap-encargos.js');
  assert.match(js, /https:\/\/www\.admira\.live\/api\/flota\/trabajando/);
  assert.match(js, /classList\.toggle\('activo'/);
});

test('un parte válido en KV manda sobre la semilla; uno roto se ignora', async () => {
  const parte = { ...SEMILLA, fecha: '2026-10-20T08:01:00+02:00', filas: [{ persona: 'Neo', abiertos: 2, hoy: 1, ayer: 1, anteriores: 0 }] };
  const kv = (v) => ({ get: async (k) => (k === CLAVE_KV ? v : null) });
  const p = await parteVigente({ PRESENTATION_IDEAS: kv(JSON.stringify(parte)) });
  assert.equal(p.origen, 'kv'); assert.equal(p.filas.length, 1);
  assert.equal((await parteVigente({ PRESENTATION_IDEAS: kv('{roto') })).origen, 'semilla');
  assert.equal((await parteVigente({ PRESENTATION_IDEAS: kv(JSON.stringify({ ...parte, filas: [{ persona: 'X', abiertos: -1, hoy: 0, ayer: 0, anteriores: 0 }] })) })).origen, 'semilla');
  assert.equal(normalizar({ fecha: 'no', filas: [] }), null);
});

test('la semilla cuadra con la tabla matinal del 19-10-2026', () => {
  assert.deepEqual(totales(SEMILLA.filas), { persona: 'Total', abiertos: 61, hoy: 3, ayer: 35, anteriores: 23 });
});

test('el script matinal convierte el HTML y rechaza un Total que no cuadra', () => {
  const html = '<p>Datos del 19-oct-2026 a las 08:01</p><table><tbody><tr><td>Neo</td><td>5</td><td>0</td><td>1</td><td>4</td></tr></tbody><tfoot><tr><td>Total</td><td>5</td><td>0</td><td>1</td><td>4</td></tr></tfoot></table><p>De Y no hay cifras.</p>';
  const p = parsear(html);
  assert.equal(p.fecha, '2026-10-19T08:01:00+02:00');
  assert.deepEqual(p.filas, [{ persona: 'Neo', abiertos: 5, hoy: 0, ayer: 1, anteriores: 4 }]);
  assert.throws(() => parsear(html.replace('<td>Total</td><td>5', '<td>Total</td><td>6')), /no cuadra/);
});

test('Misiones (antes Encargos) cuelga de RoadMap: subnavegación en /roadmap, ☰ y vuelta tras login', async () => {
  assert.equal(returnToSeguro('/roadmap/encargos'), '/roadmap/encargos');
  const rm = await read('../roadmap.html');
  assert.match(rm, /<nav class="rm-sub"[^>]*><a href="\/roadmap" aria-current="page">Plan<\/a><a href="\/roadmap\/encargos">Misiones<\/a><\/nav>/);
  const js = await read('../assets/admira-frame.js');
  assert.match(js, /var SUBPAGINAS = \{'\/roadmap': \[\['\/roadmap\/encargos', 'Misiones'\]\]\}/);
  const sort = await read('../assets/roadmap-encargos.js');
  assert.match(sort, /tabla\.tBodies\[0\]/, 'solo se reordena tbody');
  assert.match(sort, /'ascending' : 'descending'/);
});
