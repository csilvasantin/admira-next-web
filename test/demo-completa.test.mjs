// DEMO COMPLETA (merovingio · 06-10-2026): ayuda + formulario + plan en seco + API ampliada.
// v2 (decisiones de Carlos, 06-10-2026): 1 altavoz con 2 playlists (hilo continuo + locuciones
// bajo demanda desde el TPV) + pantalla vertical + horizontal = 3 equipos y 4 playlists por local;
// marca blanca SIEMPRE con la marca real del cliente (/marca <id>, 5 plataformas); contenido común
// de marca y desconexiones temporales preparadas (vacías, próximamente).
// Lo que se protege: los mínimos de Carlos (≥4 locales, 3 equipos, 4 playlists, 3 contenidos), la convención
// de nombres, que la simulación sea lo de por defecto y que la cola clásica (procesar_cola.py,
// que solo lee ?estado=pendiente) NUNCA reciba una demo completa.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { construirPlan, legacyPayload, ITIL_RE, SCREEN_RE, MINIMOS, SCHEMA } from '../demo/plan-completa.mjs';
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

test('plan 365 Barcelona: 4 locales, 12 equipos ITIL, 16 playlists, 48 huecos, 12 piezas', () => {
  const p = construirPlan(base365);
  assert.equal(p.valido, true, p.errores.join(' '));
  assert.equal(p.schema, 'admiranext.demo-completa/2');
  assert.deepEqual(p.totales, {
    establecimientos: 4, gemelos: 4, equipos: 12, altavoces: 4, pantallas: 8,
    playlists: 16, playlists_continuas: 12, playlists_bajo_demanda: 4,
    huecos_contenido: 48, piezas_unicas: 12, plataformas_marca: 5, desconexiones: 0,
  });
  assert.equal(p.simulacion, true, 'la simulación es lo de por defecto');
  assert.equal(p.circuito, 'demo_365_bcn');
  assert.equal(p.xpacio.autostart, 'cafeteria');
  assert.equal(p.pasos.length, 7);
  assert.deepEqual(p.pasos.map((x) => x.componente), ['admira.app', 'admira.biz', 'admira.store', 'admira.app', 'admira.tv', 'admira.studio', 'admira.app']);
  const codigos = p.establecimientos.flatMap((e) => e.equipos.map((q) => q.itil_code));
  assert.equal(new Set(codigos).size, 12, 'códigos ITIL únicos');
  codigos.forEach((c) => assert.match(c, ITIL_RE));
  const e1 = p.establecimientos[0];
  assert.equal(e1.id, '365-demo-bcn-tetuan');
  assert.deepEqual(e1.equipos.map((q) => q.dispositivo), ['altavoz', 'vertical', 'horizontal']);
  assert.deepEqual(e1.equipos.map((q) => q.itil_code), ['365BCN01-ALTV-01', '365BCN01-PANV-01', '365BCN01-PANH-01']);
  assert.deepEqual(e1.equipos.flatMap((q) => q.playlists.map((x) => x.playlist)), ['365.bcn-tetuan.hilomusical', '365.bcn-tetuan.locuciones', '365.bcn-tetuan.vertical', '365.bcn-tetuan.horizontal']);
  assert.deepEqual(e1.equipos.map((q) => q.orientacion), [null, 'vertical', 'horizontal']);
  e1.equipos.forEach((q) => { assert.match(q.pantalla_id, SCREEN_RE); q.playlists.forEach((x) => assert.equal(x.contenidos.length, 3)); });
  assert.deepEqual(e1.equipos[1].playlists[0].contenidos.map((c) => c.ratio), ['9:16', '9:16', '9:16']);
  assert.deepEqual(e1.equipos[2].playlists[0].contenidos.map((c) => c.ratio), ['16:9', '16:9', '16:9']);
});

test('el altavoz es UNO con dos playlists: hilo musical continuo y locuciones bajo demanda desde el TPV', () => {
  const p = construirPlan(base365);
  for (const e of p.establecimientos) {
    const audio = e.equipos.filter((q) => q.categoria === 'audio');
    assert.equal(audio.length, 1, `${e.id}: un solo altavoz`);
    const [hilo, locu] = audio[0].playlists;
    assert.equal(audio[0].playlists.length, 2);
    assert.equal(hilo.canal, 'hilomusical');
    assert.equal(hilo.reproduccion, 'continua');
    assert.equal(hilo.bucle, true);
    assert.equal(hilo.disparo, null);
    assert.equal(locu.canal, 'locuciones');
    assert.equal(locu.reproduccion, 'bajo_demanda');
    assert.equal(locu.bucle, false, 'las locuciones no hacen bucle');
    assert.equal(locu.disparo.origen, 'tpv');
    assert.deepEqual(locu.disparo.eventos, ['cierre', 'emergencia', 'puntual']);
    assert.deepEqual(locu.contenidos.map((c) => c.evento_tpv), ['cierre', 'emergencia', 'puntual']);
    assert.match(locu.contenidos[0].titulo, /cierre 21:00/i);
  }
  // Las pantallas emiten en bucle.
  p.establecimientos[0].equipos.filter((q) => q.categoria === 'pantalla').forEach((q) => assert.equal(q.playlists[0].reproduccion, 'continua'));
});

test('marca blanca: siempre la marca REAL del cliente con /marca <id> en las 5 plataformas', () => {
  const p = construirPlan(base365);
  const m = p.marca_blanca;
  assert.equal(m.id, '365');
  assert.equal(m.nombre, '365');
  assert.equal(m.tipo, 'real');
  assert.equal(m.comando, '/marca 365');
  assert.deepEqual(m.plataformas.map((x) => x.id), ['studio', 'store', 'tv', 'app', 'biz']);
  m.plataformas.forEach((x) => assert.match(x.url, /\?marca=365$/));
  assert.match(m.referencia, /admiranext\.com\/marcablanca\/$/);
  assert.equal(m.pasos.length, 3);
  assert.match(m.pasos[2].accion, /\/marca 365/);
  assert.deepEqual(p.cliente.marca, { modo: 'marca-blanca-cliente', id: '365' });
  assert.ok(p.establecimientos.every((e) => e.gemelo.includes('marca=365&')), 'los gemelos van con la marca del cliente');
  assert.ok(p.pasos[0].escrituras.includes('marca:365'));
  // La elección antigua «marca blanca genérica» ya no existe: se ignora y se avisa.
  const v1 = construirPlan({ ...base365, marca: { modo: 'blanca', id: 'admiranext' } });
  assert.equal(v1.marca_blanca.id, '365');
  assert.ok(v1.avisos.some((a) => /siempre la del cliente/.test(a)));
});

test('contenido común de marca y desconexiones temporales preparadas pero vacías (próximamente)', () => {
  const p = construirPlan(base365);
  assert.equal(p.contenido.compartidos, true);
  assert.equal(p.contenido.modelo, 'marca');
  assert.equal(p.contenido.desconexiones.activo, false);
  assert.equal(p.contenido.desconexiones.estado, 'proximamente');
  for (const k of ['canal', 'desde', 'hasta', 'contenidos']) assert.ok(p.contenido.desconexiones.esquema[k], `esquema con ${k}`);
  p.establecimientos.forEach((e) => assert.deepEqual(e.desconexiones, []));
  // Mismas piezas en todos los locales.
  const hilo = p.establecimientos.map((e) => e.equipos[0].playlists[0].contenidos.map((c) => c.titulo).join('|'));
  assert.equal(new Set(hilo).size, 1);
  // Pedir contenido por local o desconexiones hoy: se ignora, con aviso, sin romper.
  const q = construirPlan({ ...base365, contenidos_compartidos: false, desconexiones: [{ canal: 'vertical', desde: '2026-11-01', hasta: '2026-11-08' }] });
  assert.equal(q.valido, true);
  assert.equal(q.totales.piezas_unicas, 12);
  assert.equal(q.totales.desconexiones, 0);
  assert.equal(q.avisos.length, 2);
  assert.equal(p.estado_extra.desconexiones.estado, 'PROXIMAMENTE');
  assert.equal(p.estado_extra.disparo_tpv.estado, 'FALTA');
});

test('los mínimos no se pueden saltar', () => {
  assert.equal(construirPlan({ ...base365, establecimientos: sugeridos.slice(0, 3) }).valido, false, '3 locales no bastan');
  const p = construirPlan({ ...base365, dispositivos: [], contenidos_por_playlist: 1, n_establecimientos: 2 });
  assert.equal(p.establecimientos[0].equipos.length, MINIMOS.dispositivos, 'los 3 equipos mínimos van siempre');
  assert.equal(p.establecimientos[0].equipos.flatMap((q) => q.playlists).length, MINIMOS.playlists, '4 playlists mínimas por local');
  assert.equal(p.contenido.por_playlist, 3, 'nunca menos de 3 contenidos');
  const extra = construirPlan({ ...base365, dispositivos: ['escaparate', 'aforo'] });
  assert.equal(extra.totales.equipos, 20);
  assert.equal(extra.totales.playlists, 20, 'el sensor de aforo no lleva playlist');
  // Los ids de la v1 (dos altavoces) se pliegan en el altavoz único.
  assert.equal(construirPlan({ ...base365, dispositivos: ['hilomusical', 'locuciones', 'vertical', 'horizontal'] }).totales.equipos, 12);
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
  assert.equal(d.plan.totales.equipos, 12);
  assert.equal(d.plan.totales.playlists, 16);
  assert.equal(d.solicitud.totales.playlists_bajo_demanda, 4);
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
  assert.equal(v2.solicitudes[0].marca_comando, '/marca 365');
  assert.deepEqual(v2.solicitudes[0].dispositivos, ['altavoz', 'vertical', 'horizontal']);
  v2.solicitudes[0].establecimientos.forEach((e) => assert.deepEqual(e.desconexiones, []));
  const info = await (await onRequestGet({ request: req('GET', 'https://x/api/demo'), env })).json();
  assert.equal(info.completa.schema, SCHEMA);
  assert.deepEqual(info.completa.minimos, { establecimientos: 4, dispositivos: 3, playlists_por_local: 4, contenidos_por_playlist: 3 });
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
  for (const id of ['ayuda', 'formulario', 'rapida', 'completaForm', 'demoForm', 'btnLenovo', 'btnReset', 'btn365', 'decisiones', 'c_marca_cmd', 'c_desconexiones']) assert.match(h, new RegExp(`id="${id}"`), id);
  assert.match(h, /id="c_simulacion" checked/, 'simulación activada por defecto');
  for (const v of ['altavoz', 'vertical', 'horizontal']) assert.match(h, new RegExp(`value="${v}" checked disabled`), `${v} es mínimo`);
  assert.doesNotMatch(h, /value="locuciones"/, 'ya no hay un segundo altavoz');
  for (const c of ['admira.app', 'admira.biz', 'admira.store', 'admira.tv', 'admira.studio']) assert.match(h, new RegExp(`<svg class="flujo"[\\s\\S]*${c.replaceAll('.', '\\.')}[\\s\\S]*</svg>`), `diagrama con ${c}`);
  assert.match(h, /365\.bcn-tetuan\.hilomusical/);
  assert.match(h, /src="\/demo\/completa\.js/);
  assert.match(h, /src="\/demo\/demo\.js/, 'el formulario clásico sigue con su script');
});

test('ayuda y formulario v2: marca blanca única, TPV, recuentos 12/16 y desconexiones próximamente', async () => {
  const h = await leer('demo/index.html');
  assert.doesNotMatch(h, /name="marca_modo"/, 'sin la elección marca del cliente / marca blanca');
  assert.doesNotMatch(h, /Marca del cliente<\/label>/);
  assert.match(h, /\/marca 365/);
  assert.match(h, /href="\/marcablanca\/"/, 'enlaza la marca blanca existente');
  for (const p of ['admira.studio', 'admira.store', 'admira.tv', 'admira.app', 'admira.biz']) assert.ok(h.includes(p), p);
  assert.doesNotMatch(h, /pixeria\.com|Pixeria/);
  assert.match(h, /TPV/);
  assert.match(h, /bajo demanda/);
  assert.match(h, /<b>12<\/b> equipos en el inventario ITIL/);
  assert.match(h, /<b>16<\/b> playlists en admira\.tv \(12 continuas \+ 4 de locuciones bajo demanda TPV\)/);
  assert.match(h, /ITIL · 3 equipos\/local/);
  assert.match(h, /4 playlists\/local/);
  assert.match(h, /id="c_desconexiones" disabled/, 'desconexiones apagadas');
  assert.match(h, /PRÓXIMAMENTE/);
  assert.match(h, /id="c_compartidos" checked disabled/, 'contenido común de marca fijo');
  assert.doesNotMatch(h, /4 equipos (IoT )?por establecimiento/);
  const js = await leer('demo/completa.js');
  assert.doesNotMatch(js, /marca_modo|c_marca_id/);
  assert.match(js, /desconexiones: \[\]/);
});
