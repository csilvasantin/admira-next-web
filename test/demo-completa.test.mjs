// DEMO COMPLETA (merovingio · 06-10-2026): ayuda + formulario + plan en seco + API ampliada.
// Lo que se protege: los mínimos de Carlos (≥4 locales, 4 equipos, 3 contenidos), la convención
// de nombres, que la simulación sea lo de por defecto y que la cola clásica (procesar_cola.py,
// que solo lee ?estado=pendiente) NUNCA reciba una demo completa.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { construirPlan, legacyPayload, ITIL_RE, SCREEN_RE, MINIMOS } from '../demo/plan-completa.mjs';
import { onRequestPost, onRequestGet, onRequestPatch } from '../functions/api/demo.js';

const ROOT = new URL('../', import.meta.url);
const leer = (rel) => readFile(new URL(rel, ROOT), 'utf8');
const datos = JSON.parse(await leer('demo/data/365-barcelona.json'));
const sugeridos = datos.establecimientos.filter((e) => e.sugerido).map((e) => ({ ...e, fuente: datos.fuente, fuente_url: datos.fuente_url }));
const base365 = {
  modo: 'completa', cliente: '365', website: 'https://365obrador.com/', color: '#1D1D1B',
  ciudad: { nombre: 'Barcelona', pais: 'ES' }, n_establecimientos: 4, establecimientos: sugeridos,
  xpacio_tipo: 'cafeteria', xpacio_subtipo: 'Panadería', idiomas: ['en', 'es'], cierre: '21:00',
};

function kv() {
  const m = new Map();
  return { m, async get(k, o) { const v = m.get(k); if (v == null) return null; return o?.type === 'json' ? JSON.parse(v) : v; }, async put(k, v) { m.set(k, v); } };
}
const req = (method, url, body, headers = {}) => new Request(url, { method, headers: { 'content-type': 'application/json', ...headers }, body: body ? JSON.stringify(body) : undefined });

test('el localizador guardado trae ≥4 locales 365 en Barcelona con coordenadas y fuente', () => {
  assert.ok(datos.total >= 20, 'más de 4 locales reales');
  assert.equal(sugeridos.length, 4);
  for (const e of sugeridos) {
    assert.ok(e.lat > 41.3 && e.lat < 41.47 && e.lng > 2.05 && e.lng < 2.25, `${e.nombre} cae en Barcelona`);
    assert.match(e.direccion, /\d/);
  }
  assert.match(datos.fuente_url, /^https:\/\/365obrador\.com\//);
});

test('plan 365 Barcelona: 4 locales, 16 equipos ITIL, 16 playlists, 48 huecos, 12 piezas', () => {
  const p = construirPlan(base365);
  assert.equal(p.valido, true, p.errores.join(' '));
  assert.deepEqual(p.totales, { establecimientos: 4, gemelos: 4, equipos: 16, playlists: 16, huecos_contenido: 48, piezas_unicas: 12 });
  assert.equal(p.simulacion, true, 'la simulación es lo de por defecto');
  assert.equal(p.circuito, 'demo_365_bcn');
  assert.equal(p.xpacio.autostart, 'cafeteria');
  assert.equal(p.pasos.length, 7);
  assert.deepEqual(p.pasos.map((x) => x.componente), ['admira.app', 'admira.biz', 'admira.store', 'admira.app', 'admira.tv', 'pixeria', 'admira.app']);
  const codigos = p.establecimientos.flatMap((e) => e.equipos.map((q) => q.itil_code));
  assert.equal(new Set(codigos).size, 16, 'códigos ITIL únicos');
  codigos.forEach((c) => assert.match(c, ITIL_RE));
  const e1 = p.establecimientos[0];
  assert.equal(e1.id, '365-demo-bcn-tetuan');
  assert.deepEqual(e1.equipos.map((q) => q.playlist), ['365.bcn-tetuan.hilomusical', '365.bcn-tetuan.locuciones', '365.bcn-tetuan.vertical', '365.bcn-tetuan.horizontal']);
  assert.deepEqual(e1.equipos.map((q) => q.orientacion), [null, null, 'vertical', 'horizontal']);
  e1.equipos.forEach((q) => { assert.match(q.pantalla_id, SCREEN_RE); assert.equal(q.contenidos.length, 3); });
  assert.deepEqual(e1.equipos[2].contenidos.map((c) => c.ratio), ['9:16', '9:16', '9:16']);
  assert.deepEqual(e1.equipos[3].contenidos.map((c) => c.ratio), ['16:9', '16:9', '16:9']);
});

test('los mínimos no se pueden saltar', () => {
  assert.equal(construirPlan({ ...base365, establecimientos: sugeridos.slice(0, 3) }).valido, false, '3 locales no bastan');
  const p = construirPlan({ ...base365, dispositivos: [], contenidos_por_playlist: 1, n_establecimientos: 2 });
  assert.equal(p.establecimientos[0].equipos.length, MINIMOS.dispositivos, 'los 4 equipos mínimos van siempre');
  assert.equal(p.contenido.por_playlist, 3, 'nunca menos de 3 contenidos');
  const extra = construirPlan({ ...base365, dispositivos: ['escaparate', 'aforo'] });
  assert.equal(extra.totales.equipos, 24);
  assert.equal(extra.totales.playlists, 20, 'el sensor de aforo no lleva playlist');
  assert.equal(construirPlan({ ...base365, franquicia: false }).valido, false);
});

test('payload clásico intacto para procesar_cola.py', () => {
  const l = legacyPayload(base365);
  assert.deepEqual(Object.keys(l).sort(), ['cierre', 'ciudades', 'cliente', 'color', 'idiomas', 'notas', 'website', 'xpacio_otro', 'xpacio_tipo']);
  assert.deepEqual(l.ciudades, ['barcelona']);
  assert.equal(l.xpacio_tipo, 'cafeteria');
});

test('API: la demo completa se guarda como simulación y la cola clásica no la ve', async () => {
  const env = { PRESENTATION_IDEAS: kv(), DEMO_QUEUE_KEY: 'k-test' };
  const r = await onRequestPost({ request: req('POST', 'https://x/api/demo', base365), env, waitUntil() {} });
  assert.equal(r.status, 201);
  const d = await r.json();
  assert.equal(d.estado, 'simulacion');
  assert.equal(d.plan.totales.equipos, 16);
  const real = await onRequestPost({ request: req('POST', 'https://x/api/demo', { ...base365, simulacion: false }), env, waitUntil() {} });
  assert.equal((await real.json()).estado, 'pendiente_completa');
  const clasica = await onRequestPost({ request: req('POST', 'https://x/api/demo', { cliente: 'Lenovo', website: 'https://www.lenovo.com/', xpacio_tipo: 'demostore' }), env, waitUntil() {} });
  assert.equal((await clasica.json()).estado, 'pendiente');
  const auth = { Authorization: 'Bearer k-test' };
  const pend = await (await onRequestGet({ request: req('GET', 'https://x/api/demo?estado=pendiente', null, auth), env })).json();
  assert.deepEqual(pend.solicitudes.map((s) => s.cliente), ['Lenovo'], 'procesar_cola.py solo ve la clásica');
  const v2 = await (await onRequestGet({ request: req('GET', 'https://x/api/demo?estado=pendiente_completa', null, auth), env })).json();
  assert.equal(v2.solicitudes.length, 1);
  assert.equal(v2.solicitudes[0].establecimientos.length, 4);
  assert.equal((await onRequestGet({ request: req('GET', 'https://x/api/demo?estado=simulacion'), env })).status, 401);
  const patch = await onRequestPatch({ request: req('PATCH', 'https://x/api/demo', { id: d.id, estado: 'cancelada' }, auth), env });
  assert.equal(patch.status, 200);
});

test('API: una demo completa inválida se rechaza con todos los motivos', async () => {
  const env = { PRESENTATION_IDEAS: kv() };
  const r = await onRequestPost({ request: req('POST', 'https://x/api/demo', { ...base365, establecimientos: [] }), env, waitUntil() {} });
  assert.equal(r.status, 400);
  const d = await r.json();
  assert.ok(d.errores.some((e) => /al menos 4/.test(e)));
});

test('la página trae ayuda, formulario con simulación por defecto y la demo rápida intacta', async () => {
  const h = await leer('demo/index.html');
  for (const id of ['ayuda', 'formulario', 'rapida', 'completaForm', 'demoForm', 'btnLenovo', 'btnReset', 'btn365']) assert.match(h, new RegExp(`id="${id}"`), id);
  assert.match(h, /id="c_simulacion" checked/, 'simulación activada por defecto');
  for (const v of ['hilomusical', 'locuciones', 'vertical', 'horizontal']) assert.match(h, new RegExp(`value="${v}" checked disabled`), `${v} es mínimo`);
  for (const c of ['admira.app', 'admira.biz', 'admira.store', 'admira.tv', 'pixeria']) assert.match(h, new RegExp(`<svg class="flujo"[\\s\\S]*${c.replace('.', '\\.')}[\\s\\S]*</svg>`), `diagrama con ${c}`);
  assert.match(h, /365\.bcn-tetuan\.hilomusical/);
  assert.match(h, /src="\/demo\/completa\.js/);
  assert.match(h, /src="\/demo\/demo\.js/, 'el formulario clásico sigue con su script');
});
