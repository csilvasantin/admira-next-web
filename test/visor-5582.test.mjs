/*
 * El staff recupera un enlace ya creado (#5582). La sesión de Google y el
 * CSRF siguen delante. El visor no se abre al consultar el id.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { cookieDeSesion, asegurarDirectorio, sesionCompleta } from '../functions/_webmaster-gate.js';
import { onRequest as pruebas } from '../functions/pruebas/_middleware.js';
import { onRequestGet } from '../functions/pruebas/api/visor-enlace.js';
import { accesoVisor, crearEnlace, firmarToken, leerToken, presentarEnlace } from '../functions/pruebas/_visor-enlace.js';

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
  };
}
async function entorno() {
  const env = {
    AUTH_DB: new D1(),
    WEBMASTER_SIGNING_KEY: 'pruebas-test-key',
    VISOR_LINK_KEY: 'visor-test-key',
    VISOR_LINKS: memoria(),
  };
  await asegurarDirectorio(env);
  return env;
}
const ahora = () => Math.floor(Date.now() / 1000);

test('la página de staff pide el id y ofrece la descarga del QR', () => {
  const html = leer('pruebas/visor-enlace/index.html');
  assert.match(html, /id="ver"/);
  assert.match(html, /id="bajar"/);
  assert.match(html, /location\.search/);
  assert.match(html, /get\('id'\)/);
  assert.match(html, /\/pruebas\/api\/visor-enlace\?id=/);
  assert.doesNotMatch(html, /\?t=/);
});

test('sin sesión de Google el alta no enseña el enlace', async () => {
  const env = await entorno();
  const suelto = await pruebas({
    request: new Request('https://www.admiranext.com/pruebas/api/visor-enlace?id=abcdefghij123456'),
    env,
    next: async () => { throw new Error('sin sesión no se muestra el enlace'); },
  });
  assert.equal(suelto.status, 401);
  assert.match(await suelto.text(), /Sin sesión/);
});

test('con sesión y CSRF el staff ve el mismo enlace, sin atar el dispositivo', async () => {
  const env = await entorno();
  const now = ahora();
  const hecho = await crearEnlace(env, { origin: 'https://www.admiranext.com', dias: 7, now });
  const user = await env.AUTH_DB.prepare('SELECT * FROM admiranext_users WHERE email=?').bind('csilva@admira.com').first();
  const cookie = (await cookieDeSesion(env, user)).split(';')[0];
  const sesion = await sesionCompleta(new Request('https://www.admiranext.com/pruebas/visor-enlace/', { headers: { cookie } }), env);
  const pide = (csrf, id) => new Request('https://www.admiranext.com/pruebas/api/visor-enlace?id=' + encodeURIComponent(id || ''), {
    headers: { cookie, origin: 'https://www.admiranext.com', 'X-Admira-CSRF': csrf || '' },
  });

  assert.equal((await onRequestGet({ request: pide(''), env })).status, 403);
  assert.equal((await onRequestGet({ request: pide(sesion.csrf, 'corto'), env })).status, 400);
  assert.equal((await presentarEnlace(env, hecho.id, 'http://www.admiranext.com')).status, 400);

  const res = await onRequestGet({ request: pide(sesion.csrf, hecho.id), env });
  assert.equal(res.status, 200);
  assert.equal(res.headers.get('cache-control'), 'private, no-store');
  const cuerpo = await res.json();
  assert.equal(cuerpo.ok, true);
  assert.equal(cuerpo.id, hecho.id);
  assert.equal(cuerpo.exp, hecho.exp);
  assert.equal(cuerpo.deepLink, hecho.deepLink);
  assert.equal(cuerpo.qrSvg.startsWith('<svg xmlns="http://www.w3.org/2000/svg"'), true);
  assert.equal(cuerpo.qrSvg.includes('<script'), false);
  const token = new URL(cuerpo.url).searchParams.get('t');
  const leido = await leerToken(env.VISOR_LINK_KEY, token, now + 5);
  assert.equal(leido && leido.id, hecho.id);
  const firmado = await firmarToken(env.VISOR_LINK_KEY, { id: hecho.id, iat: hecho.iat, exp: hecho.exp });
  assert.equal(token, firmado);
  const acceso = await accesoVisor(new Request(cuerpo.url, { headers: { 'user-agent': 'RayBan-Staff' } }), env, now + 5);
  assert.equal(acceso.ok, true);
  const fila = JSON.parse(await env.VISOR_LINKS.get('visor:' + hecho.id));
  assert.equal(fila.device, null);
  assert.equal(fila.boundAt, null);

  fila.exp = now - 10;
  await env.VISOR_LINKS.put('visor:' + hecho.id, JSON.stringify(fila));
  assert.equal((await onRequestGet({ request: pide(sesion.csrf, hecho.id), env })).status, 404);
});
