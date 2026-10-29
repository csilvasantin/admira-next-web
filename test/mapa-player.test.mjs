// Player por ubicación en móvil y zonas compartidas (misión DCL-fb1c7a60, 29-oct-2026).
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {DatabaseSync} from 'node:sqlite';
import vm from 'node:vm';
import {onRequestGet, onRequestPut, onRequestPost} from '../functions/api/ubicacion/zonas.js';
import {onRequestGet as qrGet} from '../functions/api/ubicacion/player-qr.js';
import {asegurarDirectorio, cookieDeSesion} from '../functions/_webmaster-gate.js';
import {validarZonas, guardarZonas, leerZonas, CLAVE_ZONAS} from '../functions/_mapa-zonas.js';
import {onRequestGet as simGet, onRequestPut as simPut} from '../functions/api/ubicacion/simulacion.js';
import {validarSimulacion, guardarSimulacion, leerSimulacion, CADUCA_SIMULACION_MS} from '../functions/_mapa-simulacion.js';

const URL_ZONAS = 'https://www.admiranext.com/api/ubicacion/zonas';
const read = path => readFile(new URL(path, import.meta.url), 'utf8');
const [editorCode, browserCode, bankCode, simCode, playerCode] = await Promise.all(['../pruebas/mapa/editor-zonas.js','../pruebas/mapa/ubicacion-dispositivo.js','../pruebas/mapa/players-xperiencias.js','../pruebas/mapa/simulador.js','../pruebas/mapa/player.js'].map(read));

class KV {
  entries = new Map();
  async get(key) { return this.entries.has(key) ? this.entries.get(key) : null; }
  async put(key, value) { this.entries.set(key, value); }
}
class Statement {
  constructor(stmt){this.stmt=stmt;this.values=[];}
  bind(...values){this.values=values;return this;}
  first(){return this.stmt.get(...this.values)||null;}
  all(){return {results:this.stmt.all(...this.values)};}
  run(){return {success:true,meta:this.stmt.run(...this.values)};}
}
class D1 {
  constructor(){this.db=new DatabaseSync(':memory:');}
  prepare(sql){return new Statement(this.db.prepare(sql));}
}
async function setup() {
  const env = {AUTH_DB:new D1(), WEBMASTER_SIGNING_KEY:'mapa-zonas-signing-fixture', UBICACIONES:new KV()};
  await asegurarDirectorio(env);
  const user = env.AUTH_DB.prepare('SELECT * FROM admiranext_users WHERE email=?').bind('csilva@admira.com').first();
  const cookie = (await cookieDeSesion(env, user)).split(';')[0];
  return {env, cookie, role:role => env.AUTH_DB.prepare('UPDATE admiranext_users SET role=? WHERE email=?').bind(role, 'csilva@admira.com').run()};
}
function put(cookie, body, {csrf, origin='https://www.admiranext.com', type='application/json'}={}) {
  return new Request(URL_ZONAS, {method:'PUT', headers:{cookie, 'content-type':type, origin, ...(csrf ? {'x-admira-csrf':csrf} : {})}, body:typeof body === 'string' ? body : JSON.stringify(body)});
}

test('el servidor valida las zonas con las mismas reglas que el editor', () => {
  const preset = JSON.parse(JSON.stringify(vm.runInNewContext(editorCode + ';window.AdmiraMapaZonas.officePreset', vm.createContext({window:{}, document:{}}))));
  assert.deepEqual(validarZonas(preset), preset);
  const zone = preset.zones[0];
  for (const broken of [{...zone, radius:49}, {...zone, radius:5001}, {...zone, id:'exterior'}, {...zone, tag:'Con Espacio'}, {...zone, name:'a\nb'}, {...zone, lat:86}, {...zone, lat:'41'}]) {
    assert.equal(validarZonas({...preset, zones:[broken]}), null);
  }
  assert.equal(validarZonas({...preset, zones:Array.from({length:9}, (_, i) => ({...zone, id:'z' + i}))}), null);
  assert.equal(validarZonas({...preset, zones:[zone, zone]}), null, 'ids repetidos');
  assert.equal(validarZonas({...preset, version:2}), null);
  assert.equal(validarZonas({...preset, outside:{tag:''}}), null);
  const extra = validarZonas({...preset, zones:[{...zone, lat:41.4, lon:2.15, precision_m:3, equipo:'iphone-carlos'}]});
  assert.deepEqual(Object.keys(extra.zones[0]).sort(), ['address','id','lat','lon','name','radius','tag'], 'solo se guardan campos de zona');
});

test('GET exige sesión y solo entrega el CSRF a quien puede publicar', async () => {
  const {env, cookie, role} = await setup();
  const anon = await onRequestGet({request:new Request(URL_ZONAS), env});
  assert.equal(anon.status, 401);
  assert.match(anon.headers.get('cache-control'), /no-store/);
  const first = await (await onRequestGet({request:new Request(URL_ZONAS, {headers:{cookie}}), env})).json();
  assert.equal(first.ok, true);assert.equal(first.zonas, null);assert.equal(first.rev, 0);
  assert.equal(first.puede_publicar, true);assert.equal(typeof first.csrf, 'string');assert.ok(first.csrf.length > 10);
  role('viewer');
  const viewer = await (await onRequestGet({request:new Request(URL_ZONAS, {headers:{cookie}}), env})).json();
  assert.equal(viewer.puede_publicar, false);assert.equal('csrf' in viewer, false);
  assert.equal((await onRequestGet({request:new Request(URL_ZONAS, {headers:{cookie}}), env:{...env, UBICACIONES:undefined}})).status, 503);
});

test('PUT publica con rol, CSRF y rev vigente; una rev vieja no pisa a otro editor', async () => {
  const {env, cookie, role} = await setup();
  const {csrf} = await (await onRequestGet({request:new Request(URL_ZONAS, {headers:{cookie}}), env})).json();
  const preset = JSON.parse(JSON.stringify(vm.runInNewContext(editorCode + ';window.AdmiraMapaZonas.officePreset', vm.createContext({window:{}, document:{}}))));
  assert.equal((await onRequestPut({request:put('', {zonas:preset, rev:0}, {csrf}), env})).status, 401);
  assert.equal((await onRequestPut({request:put(cookie, {zonas:preset, rev:0}), env})).status, 403, 'sin CSRF');
  assert.equal((await onRequestPut({request:put(cookie, {zonas:preset, rev:0}, {csrf, origin:'https://evil.example'}), env})).status, 403, 'otro origen');
  assert.equal((await onRequestPut({request:put(cookie, {zonas:preset, rev:0}, {csrf, type:'text/plain'}), env})).status, 415);
  assert.equal((await onRequestPut({request:put(cookie, 'x'.repeat(17 * 1024), {csrf}), env})).status, 413);
  assert.equal((await onRequestPut({request:put(cookie, '{', {csrf}), env})).status, 400);
  assert.equal((await onRequestPut({request:put(cookie, {zonas:{...preset, zones:[{...preset.zones[0], radius:10}]}, rev:0}, {csrf}), env})).status, 400);
  assert.equal(env.UBICACIONES.entries.size, 0, 'nada se guarda sin una publicación válida');

  const ok = await onRequestPut({request:put(cookie, {zonas:preset, rev:0}, {csrf}), env});
  assert.equal(ok.status, 200);
  const saved = await ok.json();
  assert.equal(saved.rev, 1);assert.equal(saved.actualizado_por, 'csilva@admira.com');assert.deepEqual(saved.zonas, preset);
  const stale = await onRequestPut({request:put(cookie, {zonas:{...preset, outside:{tag:'retail'}}, rev:0}, {csrf}), env});
  assert.equal(stale.status, 409);assert.deepEqual(await stale.json(), {ok:false, error:'rev_desfasada', rev:1});
  assert.equal((await leerZonas(env.UBICACIONES)).zonas.outside.tag, 'publicidad');

  const read = await (await onRequestGet({request:new Request(URL_ZONAS, {headers:{cookie}}), env})).json();
  assert.equal(read.rev, 1);assert.deepEqual(read.zonas, preset);
  role('viewer');
  assert.equal((await onRequestPut({request:put(cookie, {zonas:preset, rev:1}, {csrf}), env})).status, 403);
  assert.equal((await onRequestPost()).status, 405);
});

test('un documento roto no se sirve y se puede republicar encima', async () => {
  const kv = new KV();
  await kv.put(CLAVE_ZONAS, JSON.stringify({rev:4, zonas:{version:1, zones:'no'}}));
  assert.deepEqual(await leerZonas(kv), {zonas:null, rev:4, actualizado_en:null, actualizado_por:null});
  const preset = JSON.parse(JSON.stringify(vm.runInNewContext(editorCode + ';window.AdmiraMapaZonas.officePreset', vm.createContext({window:{}, document:{}}))));
  assert.equal((await guardarZonas(kv, {zonas:preset, rev:4}, 'a@admira.com', 0)).rev, 5);
  await kv.put(CLAVE_ZONAS, '{roto');
  assert.equal((await leerZonas(kv)).rev, 0);
});

test('el QR del player exige sesión y solo codifica la página del player', async () => {
  const {env, cookie} = await setup();
  assert.equal((await qrGet({request:new Request('https://www.admiranext.com/api/ubicacion/player-qr'), env})).status, 401);
  const response = await qrGet({request:new Request('https://www.admiranext.com/api/ubicacion/player-qr', {headers:{cookie}}), env});
  assert.equal(response.status, 200);assert.match(response.headers.get('content-type'), /image\/svg\+xml/);assert.match(response.headers.get('cache-control'), /no-store/);
  assert.match(await response.text(), /^<svg[^>]+viewBox/);
});

// ── Player del móvil (navegador simulado) ──────────────────────────────────────
function mountPlayer({storage = new Map(), zonesResponse = {status:401, body:{ok:false}}, simResponse = {status:200, body:{ok:true, luka:null}}} = {}) {
  const elements = new Map(), requests = [], docEvents = {}, messages = [];
  let clock = Date.now();
  const geo = {watchPosition(success, error){this.success = success;this.error = error;return 3;}, clearWatch(){}};
  function node() {
    return {hidden:false, textContent:'', attributes:{}, children:[], listeners:{}, contentWindow:{}, setAttribute(k, v){this.attributes[k] = v;}, removeAttribute(k){delete this.attributes[k];}, appendChild(c){c.parent = this;this.children.push(c);return c;}, remove(){if (this.parent) this.parent.children = this.parent.children.filter(c => c !== this);}, replaceChildren(...c){this.children = c;}, addEventListener(k, fn){this.listeners[k] = fn;}, click(){return this.listeners.click?.();}};
  }
  const element = id => {if (!elements.has(id)) elements.set(id, node());return elements.get(id);};
  const document = {documentElement:{lang:'es'}, hidden:false, getElementById:element, createElement:node, addEventListener:(k, fn) => {const old = docEvents[k];docEvents[k] = () => {old?.();fn();};}};
  class Clock extends Date {constructor(...a){super(...(a.length ? a : [clock]));} static now(){return clock;}}
  const context = vm.createContext({document, URL, console, Date:Clock, isSecureContext:true, navigator:{geolocation:geo},
    localStorage:{getItem:k => storage.get(k) ?? null, setItem:(k, v) => storage.set(k, v)},
    crypto:{randomUUID:() => 'aaaaaaaa-bbbb-cccc-dddd-' + String(storage.size).padStart(12, '0')},
    fetch:async (url, options) => {requests.push({url, options});const r = url === '/api/ubicacion/simulacion' ? (typeof simResponse === 'function' ? simResponse() : simResponse) : zonesResponse;return {ok:r.status === 200, status:r.status, json:async () => r.body};},
    addEventListener(k, fn){if (k === 'message') messages.push(fn);}, setInterval:() => 1, clearInterval(){}, setTimeout, clearTimeout});
  context.window = context;
  for (const code of [editorCode, browserCode, bankCode, simCode, playerCode]) vm.runInContext(code, context);
  const player = context.AdmiraMapaPlayer.create({now:() => clock});
  // Each reading is a new measurement: the location module drops repeated timestamps.
  const fix = (lat, lon, accuracy = 5) => {clock += 1000;geo.success({timestamp:clock, coords:{latitude:lat, longitude:lon, accuracy}});};
  const frames = () => element('mp-pantalla').children;
  return {player, element, requests, storage, fix, geo, frames, message:event => messages.forEach(fn => fn(event)), advance:ms => {clock += ms;}, now:() => clock, api:context};
}
const PIXERIA = [41.40300208, 2.15095625], NAVE = [41.40134534, 2.1558339];
const tagOf = ui => new URL(ui.player.state().frameURL).searchParams.get('tag');

test('el player precarga un player por Xperiencia al abrir, pero no pide ubicación hasta pulsar Empezar', () => {
  const ui = mountPlayer();
  assert.equal(ui.geo.success, undefined);assert.equal(ui.player.state().frameURL, '', 'ninguno visible antes de empezar');
  assert.equal(ui.frames().length, 6, 'cinco Xperiencias y fuera de zona, ya cargando');
  assert.ok(ui.frames().every(f => f.attributes['data-activo'] === '0'));
  assert.equal(ui.element('mp-inicio').hidden, false);assert.equal(ui.element('mp-gps').textContent, 'GPS apagado');
  ui.element('mp-empezar').click();
  assert.equal(typeof ui.geo.success, 'function');assert.equal(ui.element('mp-inicio').hidden, true);
  assert.equal(tagOf(ui), 'publicidad', 'fuera de zona mientras llega el GPS');
  assert.match(ui.element('mp-gps').textContent, /Buscando/);
});

test('cambia de contenido solo con lecturas confirmadas y nunca envía coordenadas a admira.tv', () => {
  const ui = mountPlayer();
  ui.element('mp-empezar').click();
  ui.fix(...PIXERIA);
  assert.equal(tagOf(ui), 'creatividad');assert.equal(ui.element('mp-zona').textContent, 'Pixería');assert.equal(ui.element('mp-tema').textContent, 'Creatividad');
  assert.match(ui.element('mp-gps').textContent, /confirmada · ±5 m/);
  ui.fix(...NAVE, 500);
  assert.equal(tagOf(ui), 'creatividad', 'una lectura ambigua mantiene el contenido');assert.match(ui.element('mp-gps').textContent, /límite/);
  ui.fix(...NAVE, 8);
  assert.equal(tagOf(ui), 'emprendimiento');assert.equal(ui.element('mp-zona').textContent, 'La Nave');
  const url = new URL(ui.player.state().frameURL);
  for (const key of ['lat', 'lon', 'lng', 'latitude', 'longitude', 'accuracy']) assert.equal(url.searchParams.has(key), false);
  assert.ok(![...url.searchParams.values()].some(value => value.includes('41.40')));
  ui.fix(41.5, 2.3, 10);
  assert.equal(tagOf(ui), 'publicidad');assert.equal(ui.element('mp-zona').textContent, 'Fuera de zona');
});

test('cada Xperiencia tiene su pantalla virtual y su playlist; al cambiar de oficina no se recarga ninguna', () => {
  const ui = mountPlayer();
  const bySite = Object.fromEntries(ui.frames().map(f => [f.attributes['data-xperiencia'], f]));
  assert.deepEqual(Object.keys(bySite).sort(), ['exterior', 'garage', 'la-nave', 'pixeria', 'sneaker-store', 'university']);
  for (const [id, frame] of Object.entries(bySite)) assert.equal(new URL(frame.src).searchParams.get('screen'), 'virtual-mapa-xperiencia-' + id);
  assert.equal(new Set(ui.frames().map(f => new URL(f.src).searchParams.get('tag'))).size, 6, 'seis playlists distintas');
  const srcs = ui.frames().map(f => f.src);
  ui.message({origin:'https://admira.tv', source:bySite['la-nave'].contentWindow, data:{source:'admira-tv-canal', event:'media-state', id:'nave-1'}});
  ui.message({origin:'https://evil.example', source:bySite.pixeria.contentWindow, data:{source:'admira-tv-canal', event:'media-state', id:'x'}});
  assert.equal(ui.player.state().ready, 1);assert.match(ui.element('mp-zonas').textContent, /players listos 1\/6/);
  ui.element('mp-empezar').click();ui.fix(...PIXERIA);ui.fix(...NAVE, 8);
  assert.equal(ui.frames().find(f => f.attributes['data-activo'] === '1'), bySite['la-nave']);
  assert.deepEqual(ui.frames().map(f => f.src), srcs, 'ningún player se recarga al moverse');
});

test('usa las zonas publicadas y, sin sesión o sin publicar, las cinco oficinas de ejemplo', async () => {
  const fallback = mountPlayer();
  await fallback.player.loadZones();
  assert.equal(fallback.requests[0].url, '/api/ubicacion/zonas');assert.equal(fallback.requests[0].options.credentials, 'same-origin');
  assert.equal(fallback.player.state().origin, 'example');assert.match(fallback.element('mp-zonas').textContent, /Sin sesión: zonas de ejemplo/);

  const zonas = {version:1, zones:[{id:'oficina', name:'Oficina', tag:'tecnologia', lat:41.40300208, lon:2.15095625, radius:80}], outside:{tag:'retail'}};
  const ui = mountPlayer({zonesResponse:{status:200, body:{ok:true, zonas, rev:3}}});
  ui.element('mp-empezar').click();ui.fix(...PIXERIA);
  assert.equal(tagOf(ui), 'creatividad', 'antes de cargar, ejemplo');
  await ui.player.loadZones();
  assert.equal(ui.player.state().origin, 'published');assert.equal(ui.player.state().rev, 3);
  assert.equal(tagOf(ui), 'tecnologia', 'las zonas nuevas se aplican a la última lectura');assert.equal(ui.element('mp-zona').textContent, 'Oficina');
  assert.match(ui.element('mp-zonas').textContent, /Zonas publicadas · rev 3/);

  const broken = mountPlayer({zonesResponse:{status:200, body:{ok:true, zonas:{version:1, zones:[{id:'x'}], outside:{tag:'retail'}}, rev:9}}});
  await broken.player.loadZones();
  assert.equal(broken.player.state().origin, 'example', 'zonas inválidas no sustituyen a las de ejemplo');
});

test('Detener apaga el GPS y vuelve a la portada sin borrar el contenido', () => {
  const ui = mountPlayer();
  ui.element('mp-empezar').click();ui.fix(...PIXERIA);
  ui.element('mp-detener').click();
  assert.equal(ui.player.state().started, false);assert.equal(ui.element('mp-inicio').hidden, false);assert.equal(ui.element('mp-gps').textContent, 'GPS apagado');
  ui.fix(...NAVE);
  assert.equal(tagOf(ui), 'creatividad', 'tras detener, las lecturas tardías no mueven el player');
});

// ── Luka simulado: del simulador del mapa al player del móvil ─────────────────
const SIM_URL = 'https://www.admiranext.com/api/ubicacion/simulacion';
const simReq = (cookie, body, {csrf, origin='https://www.admiranext.com'}={}) => new Request(SIM_URL, {method:'PUT', headers:{cookie, origin, 'content-type':'application/json', ...(csrf ? {'x-admira-csrf':csrf} : {})}, body:typeof body === 'string' ? body : JSON.stringify(body)});
const SNEAKER = [41.40347899, 2.15370648];

test('la simulación de Luka exige sesión, rol y CSRF, y solo admite a Luka con coordenadas', async () => {
  const {env, cookie, role} = await setup();
  assert.equal((await simGet({request:new Request(SIM_URL), env})).status, 401);
  const first = await (await simGet({request:new Request(SIM_URL, {headers:{cookie}}), env})).json();
  assert.equal(first.luka, null);assert.equal(first.simulacion, true);assert.equal(typeof first.csrf, 'string');
  const csrf = first.csrf;
  assert.equal((await simPut({request:simReq(cookie, {equipo:'luka', lat:SNEAKER[0], lon:SNEAKER[1]}), env})).status, 403, 'sin CSRF');
  assert.equal((await simPut({request:simReq(cookie, {equipo:'luka', lat:SNEAKER[0], lon:SNEAKER[1]}, {csrf, origin:'https://evil.example'}), env})).status, 403);
  for (const bad of [{equipo:'iphone-carlos', lat:41, lon:2}, {equipo:'luka', lat:'41', lon:2}, {equipo:'luka', lat:91, lon:2}, {equipo:'luka', lat:41, lon:2, precision_m:3}, [1]]) {
    assert.equal((await simPut({request:simReq(cookie, bad, {csrf}), env})).status, 400, JSON.stringify(bad));
  }
  assert.equal((await simPut({request:simReq(cookie, 'x'.repeat(600), {csrf}), env})).status, 413);
  const ok = await (await simPut({request:simReq(cookie, {equipo:'luka', lat:SNEAKER[0], lon:SNEAKER[1]}, {csrf}), env})).json();
  assert.equal(ok.ok, true);assert.equal(ok.luka.lat, SNEAKER[0]);
  const read = await (await simGet({request:new Request(SIM_URL, {headers:{cookie}}), env})).json();
  assert.deepEqual([read.luka.lat, read.luka.lon], SNEAKER, 'D1 lo devuelve en la lectura siguiente');
  assert.equal(env.UBICACIONES.entries.size, 0, 'no entra en el histórico real de ubicaciones');
  role('viewer');
  assert.equal((await simPut({request:simReq(cookie, {equipo:'luka', lat:41, lon:2}, {csrf}), env})).status, 403);
  const viewer = await (await simGet({request:new Request(SIM_URL, {headers:{cookie}}), env})).json();
  assert.equal(viewer.puede_publicar, false);assert.equal('csrf' in viewer, false);assert.ok(viewer.luka, 'un viewer la sigue desde el móvil');
});

test('la posición simulada caduca a las dos horas y se sobrescribe en una sola fila', async () => {
  const {env} = await setup();
  assert.equal(validarSimulacion({equipo:'luka', lat:41, lon:2, ts:1}), null);
  await guardarSimulacion(env.AUTH_DB, {equipo:'luka', lat:41.1, lon:2.1}, 'a@admira.com', 1000);
  await guardarSimulacion(env.AUTH_DB, {equipo:'luka', lat:41.2, lon:2.2}, 'a@admira.com', 2000);
  assert.equal((await leerSimulacion(env.AUTH_DB, 'luka', 3000)).lat, 41.2);
  assert.equal(env.AUTH_DB.prepare('SELECT COUNT(*) AS n FROM mapa_simulacion').first().n, 1);
  assert.equal(await leerSimulacion(env.AUTH_DB, 'luka', 2000 + CADUCA_SIMULACION_MS + 1), null);
});

test('«Seguir a Luka» no pide GPS y cambia el contenido cuando Luka se mueve en el mapa', async () => {
  let luka = null;
  const ui = mountPlayer({simResponse:() => ({status:200, body:{ok:true, luka}})});
  ui.element('mp-empezar-luka').click();await new Promise(setImmediate);
  assert.equal(ui.geo.success, undefined, 'no se pide la ubicación del teléfono');
  assert.equal(ui.player.state().mode, 'luka');assert.equal(tagOf(ui), 'publicidad');
  assert.match(ui.element('mp-gps').textContent, /Esperando a Luka/);
  luka = {equipo:'luka', lat:SNEAKER[0], lon:SNEAKER[1], ts:new Date(ui.now() - 4000).toISOString()};
  await ui.player.pollLuka();
  assert.equal(tagOf(ui), 'retail');assert.equal(ui.element('mp-zona').textContent, 'Sneaker Store');
  assert.match(ui.element('mp-gps').textContent, /Luka del simulador · movido hace 4 s/);
  assert.equal(ui.element('mp-gps').attributes['data-tono'], 'ok');
  luka = {...luka, lat:NAVE[0], lon:NAVE[1]};
  await ui.player.pollLuka();
  assert.equal(tagOf(ui), 'emprendimiento');
  assert.ok(ui.requests.every(r => !r.options.method || r.options.method === 'GET'), 'el móvil solo lee');
  assert.equal(ui.element('mp-fuente').textContent, 'Usar GPS');
  ui.element('mp-fuente').click();
  assert.equal(ui.player.state().mode, 'gps');assert.equal(typeof ui.geo.success, 'function');
  ui.fix(...PIXERIA);assert.equal(tagOf(ui), 'creatividad');
});

test('el interruptor del mapa no hace peticiones apagado y, encendido, envía solo el último Luka con CSRF', async () => {
  const requests = [], elements = new Map();
  const node = () => ({textContent:'', attributes:{}, listeners:{}, setAttribute(k, v){this.attributes[k] = v;}, addEventListener(k, fn){this.listeners[k] = fn;}, click(){return this.listeners.click?.();}});
  const document = {documentElement:{lang:'es'}, getElementById:id => {if (!elements.has(id)) elements.set(id, node());return elements.get(id);}, addEventListener(){}};
  const context = vm.createContext({document, console, Date, fetch:async (url, options = {}) => {requests.push({url, options});
    return options.method === 'PUT' ? {ok:true, status:200, json:async () => ({ok:true})} : {ok:true, status:200, json:async () => ({ok:true, puede_publicar:true, csrf:'csrf-fixture', luka:null})};}});
  context.window = context;
  vm.runInContext(await read('../pruebas/mapa/luka-remoto.js'), context);
  const remote = context.AdmiraMapaLukaRemoto.create();
  remote.publish({lat:1, lng:2});
  assert.equal(requests.length, 0, 'apagado no sale nada');
  document.getElementById('simulador-remoto').click();
  await new Promise(setImmediate);await new Promise(setImmediate);
  const put = requests.find(r => r.options.method === 'PUT');
  assert.deepEqual(JSON.parse(put.options.body), {equipo:'luka', lat:1, lon:2}, 'al encender manda el último Luka');
  assert.equal(put.options.headers['X-Admira-CSRF'], 'csrf-fixture');
  remote.publish({lat:3, lng:4});remote.publish({lat:5, lng:6});
  await new Promise(setImmediate);await new Promise(setImmediate);
  const puts = requests.filter(r => r.options.method === 'PUT').map(r => JSON.parse(r.options.body).lat);
  assert.equal(puts.at(-1), 5);assert.ok(puts.length <= 3);
  assert.match(document.getElementById('simulador-remoto-estado').textContent, /Luka enviado al móvil/);
  assert.equal(document.getElementById('simulador-remoto').attributes['aria-pressed'], 'true');
});
