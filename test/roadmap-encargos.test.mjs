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
import { SEMILLA, CLAVE_KV, normalizar, totales, parteVigente, htmlParte, dividir } from '../functions/_encargos-matinal.js';
import { personaClave, claveFila, agruparMisiones, clavesEnCurso, consultaMisiones, cuentaAbiertos, misionesSinCurso, fechaMadrid, inicioMision, MISIONES_API } from '../assets/misiones-vivas.js';
import { claveTrabajando, normalizarTarjetas, ETIQUETA, TRABAJANDO_API, chipDe, contarEnCurso, duenoPorMision, tarjetaPara, estadoVisible, inicioTarea, formatoReloj, formatoDesde, formatoIdle, estaOcupado, ultimaActividadMs, latidoDeclaradoTrabajando, conPresencia, resumenTitulo, tooltipChip, textoPildora, tooltipPildora, numeroDeTrabajo, fechaEmpezo } from '../assets/trabajando-vivo.js';
import { onRequestGet as presenciaRuta } from '../functions/roadmap/presencia.js';
import { reducirPresencia } from '../functions/_presencia-flota.js';
import { parsear } from '../scripts/encargos-matinal.mjs';

const read = (p) => readFile(new URL(p, import.meta.url), 'utf8');
class Statement { constructor(s){this.s=s;this.v=[];} bind(...v){this.v=v;return this;} first(){return this.s.get(...this.v)||null;} all(){return {results:this.s.all(...this.v)};} run(){return {success:true,meta:this.s.run(...this.v)};} }
class D1 { constructor(){this.db=new DatabaseSync(':memory:');} prepare(q){return new Statement(this.db.prepare(q));} async batch(st){return Promise.all(st.map((x)=>x.run()));} }
async function setup(extra = {}) {
  const env = { AUTH_DB: new D1(), WEBMASTER_SIGNING_KEY: 'enc-test-key', ...extra };
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
  assert.doesNotMatch(body, /Smith|Trinity|Encargos abiertos/);
  assert.equal(env.ASSETS.fetched, 0);
  const ch = await env.AUTH_DB.prepare('SELECT return_to FROM admiranext_login_challenges ORDER BY created_at DESC, rowid DESC LIMIT 1').first();
  assert.equal(ch.return_to, '/roadmap/encargos', 'tras el login vuelve a la tabla');
});

test('cookie falsa no entra y sin clave de firma da 503', async () => {
  const env = await setup();
  assert.equal((await pide(env, '__Host-an_session=falsa.firma')).status, 401);
  assert.equal((await pide({ ...env, WEBMASTER_SIGNING_KEY: '' }, null)).status, 503);
});

test('con sesión pinta la semilla con el Total fijo en tfoot, cache privada y noindex', async () => {
  const env = await setup();
  const res = await pide(env, await cookie(env, 'csilva@admira.com'));
  assert.equal(res.status, 200);
  assert.equal(res.headers.get('cache-control'), 'private, no-store');
  assert.equal(res.headers.get('x-robots-tag'), 'noindex, nofollow');
  const body = await res.text();
  assert.doesNotMatch(body, /<!--ENC_/);
  assert.match(body, /19-oct-2026 a las 08:01/);
  assert.match(body, /grid-template-columns:minmax\(0,1fr\)/);
  assert.ok(body.indexOf('id="enc-consejeros"') < body.indexOf('id="enc-agentes"'), 'consejeros arriba y deepagents debajo');
  assert.equal(body.match(/Datos del <b>19-oct-2026 a las 08:01<\/b>/g).length, 1, 'la fecha solo va en la cabecera de consejeros');
  assert.match(body.slice(body.indexOf('id="enc-consejeros"'), body.indexOf('id="enc-agentes"')), /Datos del <b>19-oct-2026 a las 08:01<\/b>/);
  assert.doesNotMatch(body.slice(body.indexOf('id="enc-agentes"')), /Datos del/);
  assert.doesNotMatch(body, /<h1>Encargos abiertos por persona<\/h1>/);
  assert.match(body, /<title>Misiones · RoadMap/);
  assert.match(body, />Misiones<\/a>/);
  const agentes = body.match(/id="enc-agentes"[\s\S]*?<tbody>([\s\S]*?)<\/tbody>/)[1];
  const consejeros = body.match(/id="enc-consejeros"[\s\S]*?<tbody>([\s\S]*?)<\/tbody>/)[1];
  assert.match(agentes, /data-persona="Smith"[^>]*>[\s\S]*?<td>Smith<\/td><td>18<\/td><td>0<\/td><td>7<\/td><td>11<\/td>/);
  assert.deepEqual([...agentes.matchAll(/data-persona="([^"]+)"/g)].map((m) => m[1]), ['Neo', 'Morfeo', 'Trinity', 'Oráculo', 'Smith', 'Cypher', 'Niobe', 'Switch', 'Link', 'Perséfone', 'Seraph', 'Arquitecto', 'Merovingio']);
  assert.deepEqual([...consejeros.matchAll(/data-persona="([^"]+)"/g)].map((m) => m[1]), ['Wozniak', 'Jobs', 'Lucas', 'Disney', 'Musk', 'Huang']);
  assert.match(consejeros, /data-persona="Huang"[^>]*>[\s\S]*?<td>Jensen<\/td><td>0<\/td>/);
  assert.doesNotMatch(agentes, /data-persona="Musk"/);
  assert.doesNotMatch(consejeros, /data-persona="Neo"/);
  const tfoots = [...body.matchAll(/<tfoot>([\s\S]*?)<\/tfoot>/g)].map((m) => m[1]);
  assert.equal(tfoots.length, 2);
  assert.match(tfoots[0], /<td>Total<\/td><td>7<\/td><td>3<\/td><td>3<\/td><td>1<\/td>/, 'el total de consejeros queda en la tabla de arriba');
  assert.match(tfoots[1], /<td>Total<\/td><td>54<\/td><td>0<\/td><td>32<\/td><td>22<\/td>/);
  assert.doesNotMatch(agentes, /<td>Total<\/td>/, 'el Total no está en tbody: ordenar no lo mueve');
  assert.doesNotMatch(consejeros, /<td>Total<\/td>/);
  assert.match(body, /<table class="enc" id="enc-agentes"[\s\S]*?<button type="button">Deepagent<\/button>/);
  assert.match(body, /<table class="enc" id="enc-consejeros"[\s\S]*?<button type="button">Consejeros<\/button>/);
  assert.doesNotMatch(body, /<button type="button">Persona<\/button>/);
  assert.doesNotMatch(body, /id="enc-h-agentes"|id="enc-h-consejeros"/);
  for (const col of ['Abiertos', 'Hoy', 'Ayer', 'Anteriores']) assert.match(body, new RegExp(`<button type="button">${col}</button>`));
  assert.match(body, /<a href="\/roadmap" aria-current="page" data-yk-interno>RoadMap<\/a>/, 'cuelga de RoadMap en la cabecera');
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
  const { agentes, consejeros } = dividir(SEMILLA.filas);
  const suma = (lado) => totales(lado);
  const a = suma(agentes), c = suma(consejeros);
  assert.equal(a.abiertos + c.abiertos, 61);
  assert.equal(a.hoy + c.hoy, 3);
  assert.equal(a.ayer + c.ayer, 35);
  assert.equal(a.anteriores + c.anteriores, 23);
});

test('la fila en curso cambia de color y el detalle trae número, título, estado y desde', () => {
  const parte = normalizar({
    fecha: '2026-10-22T09:00:00+02:00',
    filas: [
      { persona: 'Trinity', abiertos: 1, hoy: 1, ayer: 0, anteriores: 0, encargos: [
        { numero: 7055, titulo: 'Dos tablas en encargos', estado: 'in_progress', desde: '2026-10-22T15:52:00Z' },
      ] },
      { persona: 'Huang', abiertos: 1, hoy: 0, ayer: 0, anteriores: 1, encargos: [
        { numero: 7001, titulo: 'Revisión del parte', estado: 'ack', desde: '2026-10-22T08:00:00+02:00' },
      ] },
      { persona: 'Jobs', abiertos: 0, hoy: 0, ayer: 0, anteriores: 0, trabajando: true },
      { persona: 'Jensen', abiertos: 0, hoy: 0, ayer: 0, anteriores: 0 },
    ],
  });
  assert.ok(parte);
  assert.equal(parte.filas[3].persona, 'Jensen', 'normalizar no renombra: el canon se aplica al pintar');
  const html = htmlParte(parte);
  assert.match(html.agentes, /<tr class="enc-activo" data-persona="Trinity"/);
  assert.match(html.agentes, /en curso/);
  assert.match(html.consejeros, /<tr data-persona="Huang"/);
  assert.doesNotMatch(html.consejeros, /enc-activo" data-persona="Huang"/);
  assert.match(html.consejeros, /<tr class="enc-activo" data-persona="Jobs"/);
  assert.match(html.consejeros, />Jensen</);
  assert.match(html.detalle, /7055/);
  assert.match(html.detalle, /Dos tablas en encargos/);
  assert.match(html.detalle, /in_progress/);
  assert.match(html.detalle, /22-oct-2026 a las 17:52/);
  const lados = dividir(parte.filas);
  assert.equal(lados.consejeros.filter((f) => f.persona === 'Huang').length, 1, 'Jensen y Huang son la misma fila');
  assert.equal(normalizar({ fecha: '2026-10-22T09:00:00Z', filas: [{ persona: 'Neo', abiertos: 0, hoy: 0, ayer: 0, anteriores: 0, encargos: [{ numero: 1, titulo: 'x', estado: 'nope', desde: '2026-10-22T09:00:00Z' }] }] }), null);
  assert.equal(normalizar({ fecha: '2026-10-22T09:00:00Z', filas: [{ persona: 'Neo', abiertos: 0, hoy: 0, ayer: 0, anteriores: 0, trabajando: 'si' }] }), null);
});

test('el script matinal convierte el HTML y rechaza un Total que no cuadra', () => {
  const html = '<p>Datos del 19-oct-2026 a las 08:01</p><table><tbody><tr><td>Neo</td><td>5</td><td>0</td><td>1</td><td>4</td></tr></tbody><tfoot><tr><td>Total</td><td>5</td><td>0</td><td>1</td><td>4</td></tr></tfoot></table><p>De Y no hay cifras.</p>';
  const p = parsear(html);
  assert.equal(p.fecha, '2026-10-19T08:01:00+02:00');
  assert.deepEqual(p.filas, [{ persona: 'Neo', abiertos: 5, hoy: 0, ayer: 1, anteriores: 4 }]);
  assert.throws(() => parsear(html.replace('<td>Total</td><td>5', '<td>Total</td><td>6')), /no cuadra/);
});

test('Encargos cuelga de RoadMap: subnavegación en /roadmap, ☰ y vuelta tras login', async () => {
  assert.equal(returnToSeguro('/roadmap/encargos'), '/roadmap/encargos');
  const rm = await read('../roadmap.html');
  assert.match(rm, /<nav class="rm-sub"[^>]*><a href="\/roadmap" aria-current="page">Plan<\/a><a href="\/roadmap\/encargos">Misiones<\/a><\/nav>/);
  const js = await read('../assets/admira-frame.js');
  assert.match(js, /var SUBPAGINAS = \{'\/roadmap': \[\['\/roadmap\/encargos', 'Misiones'\]\]\}/);
  const sort = await read('../assets/roadmap-encargos.js');
  assert.match(sort, /tabla\.tBodies\[0\]/, 'solo se reordena tbody');
  assert.match(sort, /'ascending' : 'descending'/);
  assert.match(sort, /data-persona/);
  assert.match(sort, /enc-detalle/);
  assert.match(sort, /in_progress/);
  assert.match(sort, /leerEstado\('in_progress'\)/);
  assert.match(sort, /api\.yokup\.com\/fleet\/missions/);
  assert.match(sort, /setInterval\(function \(\) \{ if \(!document\.hidden\) leer\(\); \}, 30000\)/);
  assert.match(sort, /leerTrabajando\(\)/);
  assert.match(sort, /admira\.live\/api\/flota\/trabajando/);
  assert.match(sort, /enc-curso/);
  assert.match(sort, /en curso/);
  assert.match(sort, /table\.enc \.enc-reloj/);
  assert.match(sort, /admiranext-encargos-reloj/);
  assert.match(sort, /setInterval\(function \(\) \{[\s\S]*?enc-reloj[\s\S]*?\}, 1000\)/);
  assert.match(sort, /resumenTitulo\(tituloChip\)/);
  assert.match(sort, /tooltipChip\(/);
  assert.match(sort, /textoEnCurso/);
  const cada = sort.match(/leerTrabajando\(\); \}, (\d+)\)/);
  assert.ok(cada && Number(cada[1]) >= 10000 && Number(cada[1]) <= 30000, 'Trabajando ahora se relee entre 10 y 30 s');
  const html = await read('../roadmap/encargos.html');
  assert.match(html, /id="enc-agentes"[\s\S]*<button type="button">Deepagent<\/button>[\s\S]*class="enc-estado"[\s\S]*class="enc-leyenda"[\s\S]*id="enc-vivo"[\s\S]*id="enc-trab"[\s\S]*<button type="button">Abiertos<\/button>/);
  assert.doesNotMatch(html.split('<div class="enc-par">')[0], /class="enc-estado"/, 'la leyenda no ocupa una línea encima de las tablas');
  assert.doesNotMatch(html.split('id="enc-agentes"')[0], /class="enc-estado"/, 'la leyenda vive en la cabecera de deepagents');
  assert.match(html, /id="enc-n-verde"/);
  assert.match(html, /id="enc-consejeros"[\s\S]*id="enc-agentes"/);
  assert.match(html.slice(0, html.indexOf('id="enc-agentes"')), /id="enc-consejeros"[\s\S]*class="enc-parte">Datos del <b><!--ENC_FECHA--><\/b>/);
  assert.doesNotMatch(html.slice(html.indexOf('id="enc-agentes"')), /class="enc-parte"|Datos del/);
  assert.doesNotMatch(html, /<h1>Encargos abiertos por persona<\/h1>/);
  assert.doesNotMatch(html, /Deepagents a la izquierda/);
  assert.match(html, /href="\/roadmap\/encargos"/);
  assert.doesNotMatch(html, /<h2 id="enc-h-agentes">|<h2 id="enc-h-consejeros">/);
  assert.match(html, /trabajando/);
  assert.match(html, /desde HH:MM/);
  assert.doesNotMatch(html, /hace poco/);
  assert.match(html, /&gt;1 h/);
  assert.match(html, />idle</);
  assert.match(html, /\.enc-idle\{/);
  assert.doesNotMatch(html, /en espera/);
  assert.match(html, /#3ddc84/);
  assert.match(html, /box-shadow:0 0 6px #3ddc84/);
  assert.match(html, /rgba\(61,220,132,\.1\)/);
  assert.match(html, /linear-gradient\(90deg,rgba\(255,208,103,\.13\),transparent 55%\)/);
  assert.match(html, /#ffe29a/);
  assert.match(html, /#ff5d5d/);
  assert.match(html, /rgba\(255,93,93,\.1\)/);
  assert.match(html, /opacity:\.6/);
  assert.match(html, /grayscale\(1\)/);
  assert.match(html, /type="module" src="\/assets\/roadmap-encargos\.js/);
});

test('Misiones en vivo: in_progress resalta a la persona y el clic lista número, título, estado y desde', () => {
  assert.equal(personaClave('JobsGrokBot'), 'jobs');
  assert.equal(personaClave('OraculoMacMini'), 'oraculo');
  assert.equal(personaClave('Oráculo'), 'oraculo');
  assert.equal(claveFila('Huang'), 'jensen');
  assert.equal(personaClave('JensenGrokBot'), 'jensen');
  assert.equal(personaClave('HuangGrokBot'), 'jensen');
  assert.equal(personaClave('MuskGrokBot'), 'musk');
  assert.equal(personaClave('Musk'), 'musk');
  assert.equal(personaClave('Elon'), 'musk');
  assert.equal(personaClave('Elon Musk'), 'musk');
  assert.equal(personaClave('MuskMerovingio'), '', 'un nombre pegado no cae en dos filas');
  assert.equal(personaClave('WozniakGrokBot'), 'wozniak');
  assert.equal(personaClave('TrinityMBP14'), 'trinity');
  assert.equal(personaClave('SubNeoMBP16'), '', 'un subagente no hereda la fila de Neo');
  assert.equal(personaClave('LinkedIn'), '', 'no hay prefijo suelto sobre Link');
  assert.equal(MISIONES_API, 'https://api.yokup.com/fleet/missions');
  assert.equal(consultaMisiones('in_progress', 0), 'https://api.yokup.com/fleet/missions?status=in_progress&limit=200&offset=0');
  const por = agruparMisiones([
    { id: 'FLT-1', persona: 'JobsGrokBot', status: 'in_progress', subject: 'Latido de consejeros', display_ref: 'Hoy #70', created_at: 1792685515000 },
    { id: 'FLT-2', persona: 'JobsGrokBot', status: 'open', subject: 'Otra abierta', display_ref: 'Hoy #71', created_at: 1792680000000 },
    { id: 'FLT-3', persona: 'NeoMBP16', status: 'open', subject: 'Sin empezar', display_ref: 'Hoy #4', created_at: 1792600000000 },
    { id: 'FLT-1', persona: 'JobsGrokBot', status: 'in_progress', subject: 'duplicada', display_ref: 'Hoy #70', created_at: 1792685515000 },
  ]);
  assert.deepEqual(clavesEnCurso(por), ['jobs']);
  assert.equal(por.jobs.length, 2);
  assert.equal(por.jobs[0].estado, 'in_progress');
  assert.equal(por.jobs[0].numero, 'Hoy #70');
  assert.equal(por.jobs[0].titulo, 'Latido de consejeros');
  assert.equal(por.jobs[0].desde, fechaMadrid(1792685515000));
  assert.match(por.jobs[0].desde, /2026 a las /);
  assert.equal(por.neo[0].enCurso, false);
});

test('Trabajando ahora: verde, amarillo, rojo y gris, y Huang es Jensen', () => {
  assert.equal(TRABAJANDO_API, 'https://www.admira.live/api/flota/trabajando');
  assert.equal(claveTrabajando('Huang'), 'jensen');
  assert.equal(claveTrabajando('Jensen'), 'jensen');
  assert.equal(claveTrabajando('MuskGrokBot'), 'musk');
  assert.equal(claveTrabajando('Elon'), 'musk');
  assert.equal(claveTrabajando('Oráculo'), claveTrabajando('oraculo'));
  assert.equal(claveTrabajando('WhiteRabbit'), 'whiterabbit');
  assert.equal(claveTrabajando('Neo'), 'neo');
  assert.equal(claveTrabajando('MuskMerovingio'), 'muskmerovingio');
  const ahora = Date.parse('2026-10-23T05:00:00.000Z');
  const por = normalizarTarjetas({
    tarjetas: [
      { agente: 'Neo', estado: 'verde', motivo: 'tokens en los últimos 15 min', enCurso: 0 },
      { agente: 'Huang', estado: 'amarillo', motivo: 'con Carlos', enCurso: 0, ultimaActividad: '2026-10-23T04:41:00.000Z' },
      { agente: 'Jobs', estado: 'rojo', motivo: 'sin actividad desde hace más de 1 h (activo hoy)', enCurso: 3 },
      { agente: 'Lucas', estado: 'gris', motivo: 'sin latido', enCurso: 0 },
      { agente: 'Nadie', estado: 'azul', motivo: 'no' },
      { agente: '', estado: 'verde' },
    ],
  }, ahora);
  assert.equal(por.neo.estado, 'verde');
  assert.equal(por.neo.etiqueta, ETIQUETA.verde);
  assert.equal(por.neo.etiqueta, 'trabajando');
  assert.equal(por.jensen.estado, 'amarillo');
  assert.equal(por.jensen.etiqueta, 'desde 06:41');
  assert.equal(ETIQUETA.amarillo, 'desde HH:MM');
  assert.equal(por.huang, undefined, 'Huang no abre otra fila: cae en Jensen');
  assert.equal(por.jobs.etiqueta, '>1 h');
  assert.equal(por.lucas.etiqueta, 'idle');
  assert.equal(por.nadie, undefined);
  assert.deepEqual(Object.keys(por).sort(), ['jensen', 'jobs', 'lucas', 'neo']);
  assert.equal(por.neo.enTarea, true, 'verde es trabajo aunque no traiga tarea');
  assert.equal(por.lucas.enTarea, false);
});

test('el amarillo dice desde HH:MM en Madrid, y otro día lleva DD/MM', () => {
  const ahora = Date.parse('2026-10-23T05:00:00.000Z');
  assert.equal(formatoDesde(Date.parse('2026-10-23T04:41:00.000Z'), ahora), 'desde 06:41');
  assert.equal(formatoDesde(Date.parse('2026-10-22T16:41:00.000Z'), ahora), 'desde 22/10 18:41');
  assert.equal(formatoDesde(0, ahora), 'desde —');
  assert.equal(ultimaActividadMs({ ultimaActividad: '2026-10-23T04:41:00.000Z' }, ahora), Date.parse('2026-10-23T04:41:00.000Z'));
  assert.equal(ultimaActividadMs({ latidoConsejero: { hasta: 1792731111 } }, ahora), 1792731111000);
  assert.equal(ultimaActividadMs({ haceS: 90 }, 1_000_000), 910_000);
  assert.equal(inicioTarea({ ultimaActividad: '2026-10-22T19:59:04.328Z', haceS: 0 }), 0, 'la última actividad no es el inicio');
  const ayer = normalizarTarjetas({
    tarjetas: [{ agente: 'Morfeo', estado: 'amarillo', motivo: 'con Carlos', ultimaActividad: '2026-10-22T16:41:00.000Z' }],
  }, ahora);
  assert.equal(ayer.morfeo.etiqueta, 'desde 22/10 18:41');
  const ahoraIdle = Date.parse('2026-10-23T06:00:00.000Z');
  assert.equal(formatoIdle(ahoraIdle - 12 * 60000, ahoraIdle), 'idle · 12 min');
  assert.equal(formatoIdle(ahoraIdle - (2 * 60 + 5) * 60000, ahoraIdle), 'idle · 2 h 05 min');
  assert.equal(formatoIdle(0, ahoraIdle), 'idle');
  assert.equal(estaOcupado(true, { estado: 'gris' }), true);
  assert.equal(estaOcupado(false, { estado: 'verde', tarea: 'panel', encargo: '' }), true);
  assert.equal(estaOcupado(false, { estado: 'verde', tarea: '', encargo: '' }), false);
  assert.equal(estaOcupado(false, { estado: 'amarillo', enTarea: true, textoTarea: 'admira.store' }), false);
  assert.equal(estaOcupado(false, { estado: 'gris', etiqueta: 'idle' }), false);
  assert.equal(estaOcupado(false, null), false);
});

test('En curso suma misiones y tareas; Morfeo sin misión sale como TAREA', () => {
  const por = normalizarTarjetas({
    tarjetas: [
      { agente: 'Morfeo', estado: 'amarillo', motivo: 'con Carlos', foco: { proyecto: 'admira.store', fuente: 'ahora', defecto: false } },
      { agente: 'Neo', estado: 'verde', tarea: 'Video 360 a modelo 3D' },
      { agente: 'Trinity', estado: 'verde', tarea: 'FLT-101994/#5761 HECHO: informe', encargo: '#5761' },
      { agente: 'Jobs', estado: 'rojo', tarea: 'encargo 6919', encargo: 'FLT-102622' },
      { agente: 'Disney', estado: 'rojo', tarea: 'Parte nocturno', encargo: '#7040' },
      { agente: 'Huang', estado: 'gris', encargo: 'FLT-102626', foco: { proyecto: 'Training', fuente: 'training' } },
      { agente: 'Lucas', estado: 'gris', motivo: 'sin latido', foco: { proyecto: 'Training', fuente: 'training' } },
      { agente: 'Oráculo', estado: 'verde', motivo: '2 encargos en curso' },
    ],
  });
  assert.equal(por.morfeo.enTarea, true, 'Morfeo trabaja con Carlos aunque no tenga misión');
  assert.equal(por.morfeo.textoTarea, 'admira.store');
  assert.deepEqual(chipDe(false, por.morfeo), { tipo: 'tarea', texto: 'admira.store' });
  assert.equal(por.neo.textoTarea, 'Video 360 a modelo 3D');
  assert.equal(por.trinity.enTarea, true, 'verde sigue siendo trabajo');
  assert.equal(por.trinity.textoTarea, '', 'un texto HECHO no se enseña como tarea');
  assert.equal(por.trinity.encargo, '');
  assert.equal(por.jobs.textoTarea, 'encargo 6919 · FLT-102622');
  assert.equal(por.disney.enTarea, true);
  assert.equal(por.jensen.enTarea, true);
  assert.equal(por.jensen.textoTarea, 'FLT-102626');
  assert.equal(por.lucas.enTarea, false);
  assert.deepEqual(chipDe(false, por.lucas), { tipo: '', texto: '' });
  assert.deepEqual(chipDe(true, por.jobs), { tipo: 'mision', texto: '' }, 'la misión tapa a la tarea');
  assert.deepEqual(contarEnCurso([
    { mision: true, tarjeta: por.jobs },
    { mision: true, tarjeta: por.oraculo },
    { mision: false, tarjeta: por.morfeo },
    { mision: false, tarjeta: por.neo },
    { mision: false, tarjeta: por.trinity },
    { mision: false, tarjeta: por.disney },
    { mision: false, tarjeta: por.jensen },
    { mision: false, tarjeta: por.lucas },
  ]), { total: 7, misiones: 2, tareas: 5 });
});

test('FLT-102626 es de Musk: no se pinta en Jensen ni en Merovingio, y un gris con misión no queda en espera', async () => {
  const misiones = agruparMisiones([
    { id: 'FLT-102626', persona: 'MuskGrokBot', assignee: 'MuskGrokBot', status: 'in_progress', subject: 'Encargos por persona', display_ref: 'Hoy #101', created_at: 1792693022000 },
    { id: 'FLT-102626', persona: 'Merovingio', status: 'in_progress', subject: 'Encargos por persona', display_ref: 'Hoy #101', created_at: 1792693022000 },
  ]);
  assert.deepEqual(Object.keys(misiones), ['musk']);
  const por = normalizarTarjetas({
    tarjetas: [
      { agente: 'Huang', estado: 'gris', encargo: 'FLT-102626', foco: { proyecto: 'Training', fuente: 'training' } },
      { agente: 'Merovingio', estado: 'gris', encargo: 'FLT-102626' },
      { agente: 'Musk', estado: 'gris', encargo: 'FLT-102626' },
      { agente: 'Trinity', estado: 'amarillo', tarea: 'FLT-101994/#5761 HECHO: informe', encargo: '#5761', foco: { proyecto: 'admira.studio', fuente: 'ahora' } },
    ],
  });
  const indice = duenoPorMision(misiones);
  assert.equal(indice.dueno.flt102626, 'musk');
  const jensen = tarjetaPara('jensen', por.jensen, indice);
  const merovingio = tarjetaPara('merovingio', por.merovingio, indice);
  const musk = tarjetaPara('musk', por.musk, indice);
  assert.equal(jensen.enTarea, false);
  assert.equal(jensen.textoTarea, '');
  assert.equal(jensen.encargo, '');
  assert.equal(merovingio.enTarea, false);
  assert.equal(merovingio.encargo, '');
  assert.equal(musk.encargo, 'FLT-102626');
  assert.deepEqual(chipDe(true, musk), { tipo: 'mision', texto: '' });
  assert.deepEqual(chipDe(false, jensen), { tipo: '', texto: '' });
  const vis = estadoVisible(musk, true);
  assert.equal(vis.estado, 'verde');
  assert.equal(vis.etiqueta, 'trabajando');
  assert.equal(estadoVisible({ estado: 'amarillo', etiqueta: 'desde 06:41' }, true).estado, 'amarillo');
  assert.equal(estadoVisible(null, true).etiqueta, 'trabajando');
  const trinity = tarjetaPara('trinity', por.trinity, indice);
  assert.equal(trinity.textoTarea, 'admira.studio');
  assert.doesNotMatch(trinity.textoTarea, /HECHO/i);
  const client = await read('../assets/roadmap-encargos.js');
  assert.match(client, /tarjetaPara\(clave, base, indice\)/);
  assert.match(client, /estadoVisible\(tarjeta, mision\)/);
});

test('las misiones open de Huang cuentan como abiertas y no las tapa la tarea', async () => {
  const crudas = [
    { id: 'FLT-102635', persona: 'HuangGrokBot', status: 'open', subject: 'En antena ahora', display_ref: 'Hoy #25', created_at: 1792730506000, project: 'admira-tv' },
    { id: 'FLT-102636', persona: 'HuangGrokBot', status: 'open', subject: 'Demos y dosieres', display_ref: 'Hoy #24', created_at: 1792730507000, project: 'admira-tv' },
    { id: 'FLT-102637', persona: 'HuangGrokBot', status: 'open', subject: 'Playlist en vivo', display_ref: 'Hoy #23', created_at: 1792730510000, project: 'admira-tv' },
    { id: 'FLT-102634', persona: 'MuskGrokBot', status: 'in_progress', subject: 'Usuarios', display_ref: 'Hoy #19', created_at: 1792730233000 },
  ];
  const por = agruparMisiones(crudas);
  assert.equal(por.jensen.length, 3);
  assert.equal(clavesEnCurso(por).includes('jensen'), false);
  assert.equal(cuentaAbiertos(por.jensen), 3);
  assert.equal(misionesSinCurso(por.jensen).length, 3);
  assert.deepEqual(misionesSinCurso(por.jensen).map((m) => m.numero).sort(), ['Hoy #23', 'Hoy #24', 'Hoy #25']);
  const tarjetas = normalizarTarjetas({
    tarjetas: [{ agente: 'Huang', estado: 'verde', encargo: 'FLT-102634', foco: { proyecto: 'admiranext', fuente: 'latido', defecto: false }, latidoConsejero: { desde: 1792730507 } }],
  });
  const jensen = tarjetaPara('jensen', tarjetas.jensen, duenoPorMision(por));
  assert.equal(jensen.encargo, '', 'FLT-102634 es de Musk: no es tarea de Jensen');
  assert.equal(jensen.enTarea, true, 'verde seguiría pintando una tarea si no hubiera misiones');
  assert.deepEqual(chipDe(false, jensen, 0), { tipo: 'tarea', texto: 'admiranext' });
  assert.deepEqual(chipDe(false, jensen, 3), { tipo: 'abierta', texto: '' });
  assert.deepEqual(contarEnCurso([{ mision: false, tarjeta: jensen, abiertas: 3 }]), { total: 1, misiones: 1, tareas: 0 });
  assert.equal(estaOcupado(false, jensen), false, 'Jensen sin tarea propia está idle aunque el latido venga verde');
  const client = await read('../assets/roadmap-encargos.js');
  assert.match(client, /misionesSinCurso\(lista\)/);
  assert.match(client, /cuentaAbiertos\(lista\)/);
  assert.match(client, /chipDe\(mision, tarjeta, sinCurso\.length\)/);
});

test('el latido «trabajando» fresco pinta trabajando; un open de admira-tv no pasa a en curso', () => {
  const motivo = 'parado vía Merovingio (sin tokens en la última hora (latido «trabajando»)) · app GrokBot abierta en Mini';
  const por = normalizarTarjetas({
    tarjetas: [{
      agente: 'Huang', estado: 'gris', motivo, haceS: 2, proyecto: 'admira-tv', fuente: 'heartbeat',
      foco: { proyecto: 'Training', fuente: 'training', defecto: false }, tarea: '', encargo: null,
    }],
  });
  const jensen = por.jensen;
  assert.equal(jensen.proyecto, 'admira-tv');
  assert.equal(jensen.haceS, 2);
  assert.equal(latidoDeclaradoTrabajando(jensen), true);
  assert.equal(estaOcupado(false, jensen), true);
  const vis = estadoVisible(jensen, false);
  assert.equal(vis.estado, 'verde');
  assert.equal(vis.etiqueta, 'trabajando');
  assert.equal(latidoDeclaradoTrabajando({ ...jensen, haceS: 1246 }), false, 'un latido de hace 20 min no cuenta');
  assert.equal(latidoDeclaradoTrabajando({ motivo: 'parado · app GrokBot abierta', haceS: 2 }), false);
  const m = agruparMisiones([
    { id: 'FLT-102635', persona: 'HuangGrokBot', status: 'open', subject: 'En antena ahora', display_ref: 'Hoy #25', created_at: 1792730506000, project: 'admira-tv' },
  ]);
  assert.equal(m.jensen[0].enCurso, false, 'status open no es en curso: yokup_presencia no cambia el fleet');
  assert.equal(chipDe(false, jensen, 1).tipo, 'abierta');
  const amarillo = normalizarTarjetas({
    tarjetas: [{ agente: 'Huang', estado: 'amarillo', motivo: 'con Carlos: app GrokBot al frente en Mini', haceS: 5, proyecto: 'admira-live' }],
  }).jensen;
  assert.equal(latidoDeclaradoTrabajando(amarillo), false, 'sin la cita del latido, el amarillo de admira.live no basta');
  const declarado = conPresencia(amarillo, { mode: 'trabajando', ageS: 21, proyecto: 'admira-tv', verified: false });
  assert.equal(latidoDeclaradoTrabajando(declarado), true);
  assert.equal(estadoVisible(declarado, false).estado, 'verde');
  assert.equal(estadoVisible(declarado, false).etiqueta, 'trabajando');
  assert.equal(estaOcupado(false, declarado), true);
  assert.equal(conPresencia(amarillo, { mode: 'trabajando', ageS: 3535 }), amarillo);
  const reducido = reducirPresencia({
    now: 1_792_733_218,
    presence: [
      { persona: 'Huang', mode: 'trabajando', project: 'admira-tv', updated: 1_792_733_218 - 21, verified: 0, focus: 'no sale' },
      { persona: 'Wozniak', mode: 'trabajando', project: 'admira.live', updated: 1_792_733_218 - 3535, verified: 0 },
      { persona: 'Musk', mode: 'pasivo', updated: 1_792_733_218 - 10, verified: 0 },
    ],
  });
  assert.deepEqual(Object.keys(reducido), ['jensen']);
  assert.equal(reducido.jensen.verified, false);
  assert.equal(reducido.jensen.proyecto, 'admira-tv');
  assert.equal(reducido.jensen.foco, 'no sale');
  assert.equal(JSON.stringify(reducido).includes('account'), false);
});

test('GET /roadmap/presencia exige sesión y reenvía el foco sin la cuenta', async () => {
  const env = await setup();
  const pideP = (c) => presenciaRuta({
    request: new Request('https://www.admiranext.com/roadmap/presencia', { headers: c ? { cookie: c } : {} }),
    env,
  });
  assert.equal((await pideP(null)).status, 401);
  const ahora = 1_792_733_218;
  const orig = globalThis.fetch;
  globalThis.fetch = async (url) => {
    assert.match(String(url), /bot\.yokup\.com\/api\/presence/);
    return new Response(JSON.stringify({
      ok: true, now: ahora,
      presence: [{ persona: 'Huang', mode: 'trabajando', project: 'admira-tv', updated: ahora - 21, verified: 0, focus: 'secreto', account: 'no-pasa@admira.com' }],
    }), { status: 200, headers: { 'content-type': 'application/json' } });
  };
  try {
    const res = await pideP(await cookie(env, 'csilva@admira.com'));
    assert.equal(res.status, 200);
    assert.equal(res.headers.get('cache-control'), 'private, no-store');
    const body = await res.json();
    assert.equal(body.ok, true);
    assert.equal(body.por.jensen.ageS, 21);
    assert.equal(body.por.jensen.verified, false);
    assert.equal(body.por.jensen.foco, 'secreto');
    assert.doesNotMatch(JSON.stringify(body), /no-pasa/);
  } finally {
    globalThis.fetch = orig;
  }
  const js = await read('../assets/roadmap-encargos.js');
  assert.match(js, /\/roadmap\/presencia/);
  assert.match(js, /conPresencia\(tarjeta, presencia && presencia\[clave\]\)/);
});

test('el chip visible resume el título y el tooltip guarda FLT, número, título y inicio', () => {
  assert.equal(resumenTitulo('Cierre de jornada y handoff a MacStudio del encargo #7077. a) Verificar identidad'), 'Cierre de jornada y handoff');
  assert.equal(resumenTitulo('Pedido de Carlos: en admiranext.com/usuarios, combo junto a 171 proyectos'), 'Pedido de Carlos');
  assert.equal(resumenTitulo('Encargo #7082 (Carlos vía Musk): anotar mi misión más importante de hoy en admiranext.com/roadmap. a) Escribir plan'), 'anotar mi misión más importante');
  assert.equal(resumenTitulo('FLT-102634 · Pedido de Carlos: en admiranext.com/usuarios'), 'Pedido de Carlos');
  assert.equal(resumenTitulo('encargo 6919 · FLT-102622'), '');
  assert.equal(resumenTitulo('Video 360 a modelo 3D'), 'Video 360 a modelo 3D');
  assert.equal(resumenTitulo('Verificar preview #227 y arreglar presencia verde de Woz'), 'Verificar preview y arreglar presencia verde');
  assert.equal(resumenTitulo('Parte nocturno de consumo a admira.live/consumos'), 'Parte nocturno de consumo a admira.live/consumos');
  assert.equal(resumenTitulo('admiranext'), 'admiranext');
  assert.equal(resumenTitulo('admira.tv 1/3 · «En antena ahora» en portada: emisión real'), '«En antena ahora» en portada');
  assert.equal(resumenTitulo(''), '');
  for (const muestra of [
    'FLT-102633 · Encargo #7082 (Carlos vía Musk): anotar mi misión más importante',
    'TAREA · encargo 6919 · FLT-102622',
    resumenTitulo('Cierre de jornada y handoff a MacStudio del encargo #7077'),
  ]) {
    assert.doesNotMatch(muestra && resumenTitulo(muestra), /FLT-\d|#\d|\bencargo\s+\d/i);
  }
  const inicio = 1_792_729_651_000;
  assert.equal(
    tooltipChip({ id: 'FLT-102633', numero: 'Hoy #11', titulo: 'Encargo #7082 (Carlos vía Musk): anotar mi misión más importante de hoy', inicio }),
    'FLT-102633 · Hoy #11 · Encargo #7082 (Carlos vía Musk): anotar mi misión más importante de hoy · ' + fechaMadrid(inicio),
  );
  assert.equal(tooltipChip({ id: 'FLT-102622', numero: 'encargo 6919', titulo: 'encargo 6919 · FLT-102622' }), 'FLT-102622 · encargo 6919');
  assert.equal(tooltipChip({ titulo: 'Video 360 a modelo 3D', inicio }), 'Video 360 a modelo 3D · ' + fechaMadrid(inicio));
  const corto = resumenTitulo('Verificar preview #227 y arreglar presencia verde de Woz');
  assert.ok(corto.split(/\s+/).length <= 6 && corto.split(/\s+/).length >= 3);
  assert.equal(corto, corto.trim());
  assert.doesNotMatch(corto, /\s$/);
});

test('la píldora dice número, título corto, desde HH:MM y minutos', () => {
  const inicio = Date.parse('2026-10-23T05:19:00.000Z');
  const ahora = Date.parse('2026-10-23T05:46:00.000Z');
  assert.equal(numeroDeTrabajo('Encargo #7088', 'PR #252'), '7088');
  assert.equal(numeroDeTrabajo('Hoy #25', 'PR #252'), '');
  assert.equal(numeroDeTrabajo('#252'), '');
  assert.equal(numeroDeTrabajo('PR #252', '#252'), '');
  assert.equal(numeroDeTrabajo('#7088'), '7088');
  assert.equal(numeroDeTrabajo('encargo 6919'), '6919');
  assert.equal(textoPildora({
    numero: '7088',
    titulo: 'admira.tv 1/3 · «En antena ahora» en portada: emisión real del canal',
    inicio,
    ahora,
  }), '#7088 En antena ahora · desde 07:19 · 27 min');
  assert.equal(tooltipPildora({
    numero: '7088',
    titulo: '«En antena ahora» en la portada de admira.tv: emisión real del canal en silencio y en bucle',
    inicio,
    proyecto: 'admira-tv',
  }), 'Empezó: 23-oct-2026 07:19 · Misión #7088: «En antena ahora» en la portada de admira.tv: emisión real del canal en silencio y en bucle · Proyecto admira-tv');
  assert.equal(fechaEmpezo(inicio), '23-oct-2026 07:19');
  assert.doesNotMatch(textoPildora({ titulo: 'panel', inicio, ahora }), /TAREA|hace poco/);
  assert.match(textoPildora({ inicio, ahora }), /^desde 07:19 · 27 min$/);
});

test('el reloj usa el arranque real y corre en agentes y consejeros', async () => {
  assert.equal(formatoReloj(0, 65_000), '01:05');
  assert.equal(formatoReloj(0, 3_599_000), '59:59');
  assert.equal(formatoReloj(0, 3_600_000), '1:00:00');
  assert.equal(formatoReloj(0, 3_600_000 + 23 * 60_000 + 5_000), '1:23:05');
  assert.equal(formatoReloj(5_000, 1_000), '00:00');
  const cruda = {
    id: 'FLT-102626', persona: 'MuskGrokBot', status: 'in_progress', subject: 'Colores encargos',
    created_at: 1_792_693_022_000,
    tasks: [
      { status: 'pending', created_at: 1_792_693_053_918 },
      { status: 'in_progress', started_at: 1_792_694_000_000, created_at: 1_792_693_053_918 },
    ],
  };
  assert.equal(inicioMision(cruda), 1_792_694_000_000);
  const norm = agruparMisiones([cruda]).musk[0];
  assert.equal(norm.inicio, 1_792_694_000_000);
  assert.equal(norm.titulo, 'Colores encargos');
  assert.equal(inicioMision({ id: 'FLT-1', persona: 'Jobs', status: 'in_progress', subject: 'Latido', created_at: 1_792_685_515_000 }), 1_792_685_515_000);
  assert.equal(inicioTarea({ latidoConsejero: { desde: 1_792_698_729 } }), 1_792_698_729_000);
  assert.equal(inicioTarea({ ultimaActividad: '2026-10-22T19:59:04.328Z', haceS: 0 }), 0, 'la última actividad no es el inicio');
  assert.equal(inicioTarea({ started_at: '2026-10-22T18:00:00.000Z' }), Date.parse('2026-10-22T18:00:00.000Z'));
  const por = normalizarTarjetas({ tarjetas: [{ agente: 'Jobs', estado: 'verde', tarea: 'panel', latidoConsejero: { desde: 1_792_698_729 } }] });
  assert.equal(por.jobs.inicio, 1_792_698_729_000);
  const html = await read('../roadmap/encargos.html');
  assert.match(html, /<table class="enc" id="enc-agentes"/);
  assert.match(html, /<table class="enc" id="enc-consejeros"/);
  assert.match(html, /\.enc-reloj\{/);
  const js = await read('../assets/roadmap-encargos.js');
  assert.match(js, /table\.enc\[data-ordenable\] tbody tr\[data-persona\]/);
  assert.match(js, /table\.enc \.enc-reloj/);
  assert.match(js, /table\.enc \.enc-idle/);
  assert.match(js, /\}, 60000\)/);
  assert.doesNotMatch(js, /#enc-agentes \.enc-reloj/);
});
