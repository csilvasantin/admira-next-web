/*
 * Enlace firmado del visor (Carlos, 10-oct-2026). Sin enlace, 401.
 * Con enlace, un dispositivo. El resto de /pruebas no se abre.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { cookieDeSesion, asegurarDirectorio, sesionCompleta } from '../functions/_webmaster-gate.js';
import { onRequest as pruebas } from '../functions/pruebas/_middleware.js';
import { onRequestPost, onRequestDelete } from '../functions/pruebas/api/visor-enlace.js';
import { accesoVisor, borrarEnlace, crearEnlace, esRutaVisor, firmarToken, leerToken } from '../functions/pruebas/_visor-enlace.js';

const VISOR = 'VISOR-HTML';
const FRONTIER = 'FRONTIER-JS';
const leer = (p) => readFileSync(new URL('../' + p, import.meta.url), 'utf8');

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
function memoria() {
  const m = new Map();
  return {
    async get(k) { return m.has(k) ? m.get(k) : null; },
    async put(k, v) { m.set(k, String(v)); },
    async delete(k) { m.delete(k); },
    claves() { return [...m.keys()]; },
  };
}
async function entorno() {
  const env = {
    AUTH_DB: new D1(),
    WEBMASTER_SIGNING_KEY: 'pruebas-test-key',
    VISOR_LINK_KEY: 'visor-test-key',
    VISOR_LINKS: memoria(),
    ASSETS: { async fetch() { return new Response(FRONTIER, { headers: { 'content-type': 'text/javascript' } }); } },
  };
  await asegurarDirectorio(env);
  return env;
}
const ahora = () => Math.floor(Date.now() / 1000);
function pide(env, ruta, init = {}) {
  return pruebas({
    request: new Request('https://www.admiranext.com' + ruta, init),
    env,
    next: async () => new Response(VISOR, { status: 200, headers: { 'content-type': 'text/html', 'cache-control': 'public, max-age=3600' } }),
  });
}
function valorCookie(res) {
  const raw = res.headers.get('set-cookie') || '';
  assert.match(raw, /HttpOnly/);
  assert.match(raw, /Secure/);
  assert.match(raw, /SameSite=Lax/);
  assert.match(raw, /Path=\/pruebas\/visor\//);
  return raw.split(';')[0];
}

test('la ruta del visor no abre el resto y la clave no está en el código', () => {
  assert.equal(esRutaVisor('/pruebas/visor/'), true);
  assert.equal(esRutaVisor('/pruebas/visor/demo.json'), true);
  assert.equal(esRutaVisor('/pruebas/visor-enlace/'), false);
  assert.equal(esRutaVisor('/pruebas/frontier/'), false);
  const gate = leer('functions/pruebas/_middleware.js');
  const enlace = leer('functions/pruebas/_visor-enlace.js');
  assert.match(gate, /esRutaVisor/);
  assert.match(enlace, /env\.VISOR_LINK_KEY/);
  assert.doesNotMatch(enlace, /VISOR_LINK_KEY\s*=\s*['"]/);
  assert.match(leer('pruebas/visor/index.html'), /\/pruebas\/visor\/frontier\.js/);
  assert.match(leer('pruebas/visor/visor.js'), /navigator\.install\(url, \{ name: 'Admira Visor' \}\)/);
  assert.match(leer('pruebas/visor/visor.js'), /var url = location\.href/);
});

test('sin enlace, /pruebas/visor sigue en 401 y no sale el visor', async () => {
  const env = await entorno();
  for (const ruta of ['/pruebas/visor/', '/pruebas/visor/visor.js', '/pruebas/visor/demo.json', '/pruebas/frontier/', '/pruebas/bits-and-atoms/']) {
    const res = await pide(env, ruta);
    assert.equal(res.status, 401, ruta);
    assert.equal((await res.text()).includes(VISOR), false, ruta);
  }
});

test('el enlace abre el visor, ata un dispositivo y el segundo queda fuera', async () => {
  const env = await entorno();
  const hecho = await crearEnlace(env, { origin: 'https://www.admiranext.com', dias: 7, now: ahora() });
  assert.equal(hecho.ok, true);
  assert.match(hecho.deepLink, /^fb-viewapp:\/\/web_app_deep_link\?/);
  assert.match(hecho.deepLink, /appName=Admira%20Visor/);
  assert.match(hecho.deepLink, /appUrl=https%3A%2F%2F/);
  assert.equal(hecho.deepLink.startsWith('https:'), false);
  assert.equal(hecho.qrSvg.startsWith('<svg xmlns="http://www.w3.org/2000/svg"'), true);
  assert.equal(hecho.qrSvg.includes('<script'), false);
  assert.equal(hecho.exp - hecho.iat, 7 * 86400);

  const primero = await pide(env, '/pruebas/visor/?t=' + hecho.url.split('t=')[1], { headers: { 'user-agent': 'RayBan-Test' } });
  assert.equal(primero.status, 200);
  assert.equal(await primero.text(), VISOR);
  assert.equal(primero.headers.get('cache-control'), 'private, no-store');
  assert.match(primero.headers.get('x-robots-tag'), /noindex/);
  assert.equal(primero.headers.get('referrer-policy'), 'no-referrer');
  const cookie = valorCookie(primero);
  const filaAntes = JSON.parse(await env.VISOR_LINKS.get('visor:' + hecho.id));
  assert.equal(filaAntes.device, null);

  const css = await pide(env, '/pruebas/visor/visor.css', { headers: { cookie } });
  assert.equal(css.status, 200);
  const fila = JSON.parse(await env.VISOR_LINKS.get('visor:' + hecho.id));
  assert.equal(typeof fila.device, 'string');

  const otro = await pide(env, '/pruebas/visor/?t=' + hecho.url.split('t=')[1], { headers: { 'user-agent': 'Otro-Movil' } });
  assert.equal(otro.status, 401);
  assert.match(await otro.text(), /Sin enlace/);

  const api = await pide(env, '/pruebas/visor/demo.json', { headers: { cookie } });
  assert.equal(api.status, 200);
  const frontera = await pide(env, '/pruebas/visor/frontier.js', { headers: { cookie } });
  assert.equal(frontera.status, 200);
  assert.equal(await frontera.text(), FRONTIER);
  const fuera = await pide(env, '/pruebas/frontier/assets/frontier.js', { headers: { cookie } });
  assert.equal(fuera.status, 401);
  assert.equal((await fuera.text()).includes(FRONTIER), false);
  const ajena = await pide(env, '/pruebas/bits-and-atoms/?t=' + hecho.url.split('t=')[1]);
  assert.equal(ajena.status, 401);
  assert.equal((await ajena.text()).includes(VISOR), false);

  const usos = env.VISOR_LINKS.claves().filter((k) => k.startsWith('visor-uso:'));
  assert.ok(usos.length >= 1);
  const registro = JSON.parse(await env.VISOR_LINKS.get(usos[0]));
  assert.equal(registro.id, hecho.id);
  assert.ok(registro.ts);
  assert.ok(registro.ua === 'RayBan-Test' || registro.ua === 'Otro-Movil' || typeof registro.ua === 'string');
});

test('un token de más de 7 días no vale, y borrar la clave revoca', async () => {
  const env = await entorno();
  const now = 1_800_000_000;
  assert.equal((await crearEnlace(env, { origin: 'https://www.admiranext.com', dias: 8, now })).ok, false);
  assert.equal((await crearEnlace(env, { origin: 'http://www.admiranext.com', dias: 7, now })).status, 400);
  const largo = await firmarToken(env.VISOR_LINK_KEY, { id: 'abcdefghij123456', iat: now, exp: now + 8 * 86400 });
  assert.equal(await leerToken(env.VISOR_LINK_KEY, largo, now + 10), null);
  const hecho = await crearEnlace(env, { origin: 'https://www.admiranext.com', dias: 1, now });
  const token = hecho.url.split('t=')[1];
  const pasa = await accesoVisor(new Request(hecho.url, { headers: { 'user-agent': 'Gafas' } }), env, now + 5);
  assert.equal(pasa.ok, true);
  await borrarEnlace(env, hecho.id);
  const despues = await accesoVisor(new Request('https://www.admiranext.com/pruebas/visor/?t=' + token), env, now + 6);
  assert.equal(despues.ok, false);
  assert.equal(despues.cerrar, true);
});

test('el alta del enlace exige la sesión de Google y el visor con sesión sigue abierto', async () => {
  const env = await entorno();
  const suelto = await pruebas({
    request: new Request('https://www.admiranext.com/pruebas/api/visor-enlace', { method: 'POST', body: '{}', headers: { origin: 'https://www.admiranext.com', 'content-type': 'application/json' } }),
    env,
    next: async () => { throw new Error('sin sesión no se crea el enlace'); },
  });
  assert.equal(suelto.status, 401);

  const user = await env.AUTH_DB.prepare('SELECT * FROM admiranext_users WHERE email=?').bind('csilva@admira.com').first();
  const cookie = (await cookieDeSesion(env, user)).split(';')[0];
  const sesion = await sesionCompleta(new Request('https://www.admiranext.com/pruebas/visor-enlace/', { headers: { cookie } }), env);
  const post = (csrf) => new Request('https://www.admiranext.com/pruebas/api/visor-enlace', {
    method: 'POST',
    headers: { cookie, origin: 'https://www.admiranext.com', 'content-type': 'application/json', 'X-Admira-CSRF': csrf || '' },
    body: JSON.stringify({ dias: 7 }),
  });
  const sinCsrf = await onRequestPost({ request: post(''), env });
  assert.equal(sinCsrf.status, 403);
  const creado = await onRequestPost({ request: post(sesion.csrf), env });
  assert.equal(creado.status, 200);
  const cuerpo = await creado.json();
  assert.match(cuerpo.deepLink, /^fb-viewapp:\/\//);
  const visto = await pide(env, '/pruebas/visor/', { headers: { cookie } });
  assert.equal(visto.status, 200);
  assert.equal(await visto.text(), VISOR);

  const baja = await onRequestDelete({
    request: new Request('https://www.admiranext.com/pruebas/api/visor-enlace', {
      method: 'DELETE',
      headers: { cookie, origin: 'https://www.admiranext.com', 'content-type': 'application/json', 'X-Admira-CSRF': sesion.csrf },
      body: JSON.stringify({ id: cuerpo.id }),
    }),
    env,
  });
  assert.equal(baja.status, 200);
  assert.equal(await env.VISOR_LINKS.get('visor:' + cuerpo.id), null);
});
