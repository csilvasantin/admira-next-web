// CATÁLOGO ÚNICO DE MARCAS + «Tu marca · introduce una URL» (SubMorfeoMacMini, 01-10-2026 · FLT-101330 a/b).
// Una sola fuente de verdad para /marcablanca, el cargador marcablanca.js y el generador de
// presentaciones; y el analizador público por URL con sus defensas SSRF.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {onRequestGet as listar, onRequestPost as listarPost} from '../functions/marcablanca/api/marcas/index.js';
import {onRequestGet as una} from '../functions/marcablanca/api/marcas/[id]/index.js';
import {onRequestGet as logoGet} from '../functions/marcablanca/api/marcas/[id]/logo.js';
import {onRequestGet as escrituraGet, onRequestPost as crear, onRequestPut as actualizar} from '../functions/presentaciones/api/marcas.js';
import {onRequest as middleware} from '../functions/presentaciones/_middleware.js';
import {onRequestPost as analizarPost, analizarMarca} from '../functions/marcablanca/api/analizar.js';
import {assertPublicHttps, ipPrivada, fetchPublico, analyzeInspiration, esMuroAntibots} from '../functions/presentaciones/_inspiration.js';
import {onRequestPut as generar} from '../functions/presentaciones/api/generate.js';
import {onRequestGet as renderDeck} from '../functions/presentaciones/[client]/presentacion.js';
import {onRequestGet as demoGet} from '../functions/marcablanca/presentacion.js';
import {datosDesdeInspiracion, propuestaDesdeDatos, validarMarca, contraste, crearMarca} from '../marcablanca/marca.js';

const ROOT = new URL('../', import.meta.url);
const TYPES = {'.json': 'application/json', '.svg': 'image/svg+xml', '.css': 'text/css', '.html': 'text/html'};
function assets(registro = []){
  return {async fetch(input){
    const url = new URL(typeof input === 'string' ? input : input instanceof URL ? input.href : input.url);
    registro.push(url.pathname);
    try { const body = await readFile(new URL('.' + url.pathname, ROOT)); return new Response(body, {headers: {'content-type': TYPES[url.pathname.slice(url.pathname.lastIndexOf('.'))] || 'application/octet-stream'}}); }
    catch (_) { return new Response('404', {status: 404}); }
  }};
}
/** KV de pruebas con metadata (como Cloudflare) y registro de lecturas. */
function kv({roto = false} = {}){
  const values = new Map(), metas = new Map(), lecturas = [];
  return {values, metas, lecturas,
    async get(key, o){ if (roto) throw new Error('KV caído'); lecturas.push(key); const v = values.get(key); if (v == null) return null; return o?.type === 'json' ? JSON.parse(v) : v; },
    async put(key, value, o){ if (roto) throw new Error('KV caído'); values.set(key, String(value)); if (o?.metadata) metas.set(key, o.metadata); },
    async delete(key){ values.delete(key); },
    async list(o){ if (roto) throw new Error('KV caído'); return {list_complete: true, keys: [...values.keys()].filter(k => !o?.prefix || k.startsWith(o.prefix)).map(name => ({name, metadata: metas.get(name)}))}; }};
}
function r2(){
  const objects = new Map();
  return {objects, async put(key, bytes, meta){ objects.set(key, {bytes, meta}); }, async delete(key){ objects.delete(key); },
    async get(key){ const o = objects.get(key); if (!o) return null; return {body: o.bytes, httpEtag: '"e"', writeHttpMetadata(h){ h.set('content-type', o.meta.httpMetadata.contentType); }}; }};
}
const ORIGEN = 'https://www.admiranext.com';
const PNG_1PX = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
const conAcceso = {presentationAccess: {level: 'owner', canGenerate: true, email: 'csilvasantin@gmail.com'}};
const sinAcceso = {presentationAccess: {level: 'client', canGenerate: false}};
const get = (path) => new Request(ORIGEN + path);
function escribir(method, body, {origin = ORIGEN} = {}){
  return new Request(ORIGEN + '/presentaciones/api/marcas', {method, headers: {'content-type': 'application/json', ...(origin ? {Origin: origin} : {})}, body: typeof body === 'string' ? body : JSON.stringify(body)});
}
const marcaOk = (extra = {}) => crearMarca({nombre: 'Ópticas Nubia', primario: '#5B2A86', secundario: '#F2B5D4', acento: '#00B3A4', ...extra});

/* ── Lectura pública ─────────────────────────────────────────────────────── */
test('la API pública lista las semillas aunque KV esté vacío o caído, con el formato de index.json', async () => {
  for (const [PRESENTATION_IDEAS, degradado] of [[kv(), false], [kv({roto: true}), true], [undefined, true]]) {
    const res = await listar({request: get('/marcablanca/api/marcas'), env: {ASSETS: assets(), PRESENTATION_IDEAS}});
    assert.equal(res.status, 200);
    assert.equal(res.headers.get('access-control-allow-origin'), '*', 'cualquier web de la Galaxia la lee');
    const body = await res.json();
    assert.equal(body.porDefecto, 'admira');
    assert.deepEqual(body.clientes.map(c => c.id), ['admira', 'altadis', 'jti', '365', 'lumbre', 'brumelle', 'frescaria']);
    assert.deepEqual(body.clientes.filter(c => c.catalogo.tipo === 'ejemplo').map(c => c.id), ['lumbre', 'brumelle', 'frescaria']);
    assert.equal(body.clientes[0].catalogo.tipo, 'real');
    assert.ok(body.clientes.every(c => c.catalogo.origen === 'semilla' && c.catalogo.protegida));
    assert.ok(body.dominios['lumbre.admira.studio']);
    assert.equal(body.degradado, degradado);
  }
});

test('una marca por id: semilla con rutas absolutas, guardada en KV, y 404 si no existe', async () => {
  const PRESENTATION_IDEAS = kv();
  const env = {ASSETS: assets(), PRESENTATION_IDEAS, PRESENTATION_MEDIA: r2()};
  const lumbre = await (await una({request: get('/marcablanca/api/marcas/lumbre'), env, params: {id: 'lumbre'}})).json();
  assert.equal(lumbre.logo.svg, '/marcablanca/logos/lumbre.svg', 'la semilla servida por la API no depende de su ruta');
  assert.match(lumbre.tipografia.fuentes[0].url, /^\/marcablanca\/fuentes\//);
  assert.equal(lumbre.catalogo.tipo, 'ejemplo');
  const res = await crear({request: escribir('POST', {marca: marcaOk(), origen: 'generador'}), env, data: conAcceso});
  assert.equal(res.status, 201);
  const nubia = await (await una({request: get('/marcablanca/api/marcas/opticas-nubia'), env, params: {id: 'opticas-nubia'}})).json();
  assert.equal(nubia.nombre, 'Ópticas Nubia');
  assert.equal(nubia.catalogo.origen, 'generador');
  assert.equal(nubia.catalogo.autor, 'csilvasantin@gmail.com');
  assert.equal(JSON.stringify(nubia).includes('"email"'), false, 'el correo del autor no sale en público');
  assert.equal(validarMarca(nubia).length, 0, 'cumple el esquema');
  const lista = await (await listar({request: get('/marcablanca/api/marcas?completo=1'), env})).json();
  assert.ok(lista.clientes.some(c => c.id === 'opticas-nubia' && c.nombre === 'Ópticas Nubia'));
  assert.ok(lista.marcas.some(m => m.id === 'opticas-nubia'));
  assert.equal((await una({request: get('/marcablanca/api/marcas/no-existe'), env, params: {id: 'no-existe'}})).status, 404);
  assert.equal((await una({request: get('/marcablanca/api/marcas/..%2Fx'), env, params: {id: '../x'}})).status, 404);
  // Con KV caído, la semilla se sigue sirviendo.
  const caida = await una({request: get('/marcablanca/api/marcas/brumelle'), env: {ASSETS: assets(), PRESENTATION_IDEAS: kv({roto: true})}, params: {id: 'brumelle'}});
  assert.equal(caida.status, 200);
});

/* ── Escritura protegida ─────────────────────────────────────────────────── */
test('escribir exige acceso al generador: sin sesión la puerta de /presentaciones contesta 401 en JSON', async () => {
  const env = {ASSETS: assets(), PRESENTATION_IDEAS: kv(), PRES_SIGNING_KEY: 'clave-de-prueba', PRES_ADMIN: 'maestra-de-prueba-123'};
  for (const method of ['GET', 'POST', 'PUT']) {
    const request = new Request(ORIGEN + '/presentaciones/api/marcas', {method, headers: {accept: 'application/json', 'content-type': 'application/json', Origin: ORIGEN}, body: method === 'GET' ? undefined : JSON.stringify({marca: marcaOk()})});
    let llego = false;
    const res = await middleware({request, env, data: {}, next: async () => { llego = true; return new Response('no'); }, waitUntil(){}});
    assert.equal(res.status, 401, method);
    assert.equal(llego, false, 'sin sesión no llega a la función');
    assert.match(res.headers.get('content-type'), /json/);
  }
  assert.equal(env.PRESENTATION_IDEAS.values.size, 0);
  // Y aunque alguien llamara a la función sin pasar por la puerta, sin permiso de generar no escribe.
  const directa = await crear({request: escribir('POST', {marca: marcaOk()}), env, data: sinAcceso});
  assert.equal(directa.status, 403);
  assert.equal((await escrituraGet({request: get('/presentaciones/api/marcas'), env, data: sinAcceso})).status, 403);
  assert.equal((await escrituraGet({request: get('/presentaciones/api/marcas'), env, data: conAcceso})).status, 200);
  // La ruta pública es de solo lectura.
  const publica = await listarPost({request: new Request(ORIGEN + '/marcablanca/api/marcas', {method: 'POST'})});
  assert.equal(publica.status, 405);
  assert.equal((await publica.json()).escritura, '/presentaciones/api/marcas');
});

test('escribir valida contra el esquema, normaliza el id y protege las semillas', async () => {
  const env = {ASSETS: assets(), PRESENTATION_IDEAS: kv(), PRESENTATION_MEDIA: r2()};
  const post = (body, o) => crear({request: escribir('POST', body, o), env, data: conAcceso});
  assert.equal((await post({marca: marcaOk()}, {origin: 'https://evil.example'})).status, 403, 'otro origen');
  assert.equal((await post('{no json')).status, 400);
  assert.equal((await post({marca: {nombre: 'Sin color'}})).status, 400, 'sin primario');
  assert.equal((await post({marca: {colores: {claro: {primario: '#123456'}}}})).status, 400, 'sin nombre');
  assert.equal((await post({marca: marcaOk({nombre: 'Admira'})})).status, 409, 'Admira no se puede sobrescribir');
  assert.equal((await post({marca: {...marcaOk(), id: 'lumbre'}})).status, 409, 'ni las semillas de ejemplo');
  assert.equal((await post({marca: {...marcaOk(), logo: {imagen: 'javascript:alert(1)'}}})).status, 400);
  assert.equal((await post({marca: {...marcaOk(), logo: {imagen: 'http://inseguro.example/l.png'}}})).status, 400, 'solo https');
  assert.equal((await post({marca: marcaOk(), relleno: 'x'.repeat(330 * 1024)})).status, 413);
  const ok = await post({marca: {...marcaOk(), id: 'Ópticas NUBIA!!', nombre: '<b>Ópticas Nubia</b>', logo: {imagen: PNG_1PX}}, origen: 'url', web: 'https://www.nubia.example/'});
  const body = await ok.json();
  assert.equal(ok.status, 201, JSON.stringify(body));
  assert.equal(body.id, 'opticas-nubia', 'id normalizado a slug');
  const guardada = JSON.parse(env.PRESENTATION_IDEAS.values.get('marca:opticas-nubia'));
  assert.doesNotMatch(guardada.marca.nombre, /[<>]/);
  assert.equal(guardada.catalogo.origen, 'url');
  assert.equal(guardada.catalogo.propuesta, true);
  assert.match(guardada.catalogo.aviso, /Propuesta generada automáticamente a partir de https:\/\/www\.nubia\.example\//);
  assert.equal(guardada.catalogo.autor.email, 'csilvasantin@gmail.com');
  assert.ok(guardada.catalogo.creadaEn);
  assert.equal(guardada.marca.logo.imagen, '/marcablanca/api/marcas/opticas-nubia/logo', 'el logo subido va a R2');
  assert.ok(env.PRESENTATION_MEDIA.objects.has('marcas/opticas-nubia/logo.png'));
  assert.equal(env.PRESENTATION_IDEAS.metas.get('marca:opticas-nubia').nombre, guardada.marca.nombre, 'la metadata permite listar sin leer cada marca');
  const logo = await logoGet({params: {id: 'opticas-nubia'}, env});
  assert.equal(logo.status, 200);
  assert.match(logo.headers.get('content-security-policy'), /sandbox/);
  assert.equal((await post({marca: marcaOk()})).status, 409, 'crear no pisa una existente');
  const put = await actualizar({request: escribir('PUT', {marca: {...marcaOk(), colores: {claro: {primario: '#0E7C66'}}}, origen: 'generador'}), env, data: conAcceso});
  assert.equal(put.status, 200);
  const nueva = JSON.parse(env.PRESENTATION_IDEAS.values.get('marca:opticas-nubia'));
  assert.equal(nueva.marca.colores.claro.primario, '#0E7C66');
  assert.equal(nueva.catalogo.creadaEn, guardada.catalogo.creadaEn, 'actualizar conserva la fecha de alta');
  // Un token MCP de deepagent no manda Origin y también escribe (la puerta ya lo validó).
  const agente = await crear({request: escribir('POST', {marca: marcaOk({nombre: 'Agente SA'})}, {origin: ''}), env, data: {presentationAccess: {level: 'editor', canGenerate: true, via: 'agent-token', tokenLabel: 'Morfeo'}}});
  assert.equal(agente.status, 201);
});

/* ── El catálogo llega a todas partes ────────────────────────────────────── */
test('una marca guardada vale con ?marca=<id> en la demo de presentación y en un deck real', async () => {
  const env = {ASSETS: assets(), PRESENTATION_IDEAS: kv(), PRESENTATION_MEDIA: r2(), PRES_SIGNING_KEY: 'k', XAI_API_KEY: 'x'};
  await crear({request: escribir('POST', {marca: marcaOk(), origen: 'generador'}), env, data: conAcceso});
  const demo = await demoGet({request: get('/marcablanca/presentacion?marca=opticas-nubia'), env});
  assert.equal(demo.status, 200);
  assert.match(await demo.text(), /data-prospect="opticas-nubia"/);
  env.PRESENTATION_IDEAS.values.set('presentation:vieja', JSON.stringify({slug: 'vieja', displayName: 'Vieja', outputs: ['website'], languages: ['es'], theme: {primary: '#12233e', accent: '#ffb000'}}));
  env.PRESENTATION_IDEAS.values.set('ideas:vieja', JSON.stringify({hero: {title: 'Hola'}, objective: 'x', skeleton: [{id: 'crear', title: 'Crear', message: 'Admira.Studio', detail: 'd'}], closing: {title: 'c', action: 'a'}, labels: {}}));
  const deck = async (q) => (await renderDeck({params: {client: 'vieja'}, request: get('/presentaciones/vieja/presentacion' + q), env, data: {}, next: () => new Response('', {status: 404})})).text();
  assert.match(await deck('?marca=opticas-nubia'), /data-prospect="opticas-nubia"/);
  assert.doesNotMatch(await deck('?marca=no-existe'), /data-prospect=/);
});

test('sin prospect, el generador no toca el catálogo y su render no cambia', async () => {
  const leidos = [];
  const env = {ASSETS: assets(leidos), PRESENTATION_IDEAS: kv(), PRESENTATION_MEDIA: r2(), PRES_SIGNING_KEY: 'k', XAI_API_KEY: 'x'};
  const html = '<html><head><title>Cliente Real</title><meta name="theme-color" content="#E30613"><style>:root{--brand-primary:#E30613}body{background:#ffffff}</style></head><body><header><a href="/"><img class="logo" src="https://cliente.example/logo.png" alt="Logo"></a></header></body></html>';
  const realFetch = globalThis.fetch;
  globalThis.fetch = async (url) => {
    const u = String(url);
    if (u.includes('cloudflare-dns.com')) return new Response(JSON.stringify({Answer: [{type: 1, data: '93.184.216.34'}]}), {headers: {'content-type': 'application/dns-json'}});
    if (u.startsWith('https://cliente.example/logo.png')) return new Response(new Uint8Array([137, 80, 78, 71]), {headers: {'content-type': 'image/png'}});
    if (u.startsWith('https://cliente.example')) return new Response(html, {headers: {'content-type': 'text/html'}});
    if (u.includes('api.x.ai')) throw new Error('ECONNRESET');
    throw new Error('fetch inesperado: ' + u);
  };
  let res;
  try {
    res = await generar({request: new Request(ORIGEN + '/presentaciones/api/generate', {method: 'PUT', headers: {'content-type': 'application/json', Origin: ORIGEN}, body: JSON.stringify({displayName: 'Cliente Real', website: 'https://cliente.example/', outputs: ['website']})}), env, params: {}, waitUntil(){}});
  } finally { globalThis.fetch = realFetch; }
  const body = await res.json();
  assert.equal(res.status, 201, JSON.stringify(body).slice(0, 300));
  assert.equal(body.catalogo, undefined, 'sin prospect la respuesta no trae catálogo');
  assert.equal([...env.PRESENTATION_IDEAS.values.keys()].some(k => k.startsWith('marca:')), false, 'ni se escribe en él');
  const saved = JSON.parse(env.PRESENTATION_IDEAS.values.get('presentation:cliente-real'));
  assert.equal(saved.prospect, null);
  leidos.length = 0; env.PRESENTATION_IDEAS.lecturas.length = 0;
  const deck = await (await renderDeck({params: {client: 'cliente-real'}, request: get('/presentaciones/cliente-real/presentacion'), env, data: {}, next: () => new Response('', {status: 404})})).text();
  assert.doesNotMatch(deck, /data-prospect=|marcablanca|pm-mk|pc-lockup|galaxia-prospect/);
  assert.equal(leidos.some(p => p.startsWith('/marcablanca/')), false, 'el render sin prospect no lee el catálogo');
  assert.equal(env.PRESENTATION_IDEAS.lecturas.some(k => k.startsWith('marca:')), false);
});

test('al «Generar» con una nueva marca, se guarda también en el catálogo (sin pisar semillas)', async () => {
  const env = {ASSETS: assets(), PRESENTATION_IDEAS: kv(), PRESENTATION_MEDIA: r2(), PRES_SIGNING_KEY: 'k', XAI_API_KEY: 'x'};
  const realFetch = globalThis.fetch;
  globalThis.fetch = async (url) => { if (String(url).includes('api.x.ai')) throw new Error('ECONNRESET'); throw new Error('fetch inesperado: ' + url); };
  const put = (body) => generar({request: new Request(ORIGEN + '/presentaciones/api/generate', {method: 'PUT', headers: {'content-type': 'application/json', Origin: ORIGEN}, body: JSON.stringify(body)}), env, params: {}, waitUntil(){}, data: conAcceso});
  try {
    const res = await put({displayName: 'Ópticas Nubia', outputs: ['website'], prospect: {activo: true, marca: 'nueva', nueva: {nombre: 'Ópticas Nubia', logoData: PNG_1PX, primario: '#5B2A86', secundario: '#F2B5D4', acento: '#00B3A4', tipografia: 'geometrica'}}});
    const body = await res.json();
    assert.equal(res.status, 201, JSON.stringify(body).slice(0, 300));
    assert.deepEqual({guardada: body.catalogo.guardada, id: body.catalogo.id}, {guardada: true, id: 'opticas-nubia'});
    const entrada = JSON.parse(env.PRESENTATION_IDEAS.values.get('marca:opticas-nubia'));
    assert.equal(entrada.catalogo.origen, 'generador');
    assert.equal(entrada.catalogo.propuesta, false);
    assert.equal(entrada.marca.logo.imagen, '/marcablanca/api/marcas/opticas-nubia/logo', 'el logo del catálogo es público, no el privado de la presentación');
    // La presentación sigue con su propia copia de la marca y su logo privado.
    assert.equal(JSON.parse(env.PRESENTATION_IDEAS.values.get('presentation:opticas-nubia')).prospect.cliente.logo.imagen, '/presentaciones/opticas-nubia/brand/logo');
    // Del catálogo (lumbre) no se guarda nada nuevo.
    await put({displayName: 'Lumbre Café', outputs: ['website'], prospect: {activo: true, marca: 'lumbre'}});
    assert.equal(env.PRESENTATION_IDEAS.values.has('marca:lumbre'), false);
    // Y una marca del catálogo único (guardada) se puede elegir como prospect.
    const elegida = await put({displayName: 'Otra', outputs: ['website'], prospect: {activo: true, marca: 'opticas-nubia'}});
    assert.equal(elegida.status, 201);
  } finally { globalThis.fetch = realFetch; }
});

/* ── Análisis por URL · defensas SSRF ────────────────────────────────────── */
test('el analizador rechaza URLs privadas, locales, de metadatos o no https', () => {
  const malas = ['http://www.starbucks.es', 'ftp://x.example', 'https://localhost/', 'https://app.localhost/', 'https://127.0.0.1/', 'https://0x7f.1/', 'https://2130706433/',
    'https://[::1]/', 'https://[::ffff:127.0.0.1]/', 'https://169.254.169.254/latest/meta-data/', 'https://metadata.google.internal/', 'https://metadata/', 'https://10.0.0.8/',
    'https://192.168.1.1/', 'https://172.20.0.1/', 'https://100.64.0.1/', 'https://8.8.8.8/', 'https://www.starbucks.es:8443/', 'https://user:pass@www.starbucks.es/', 'https://router.lan/', 'https://nas.local./', 'no es una url'];
  for (const url of malas) assert.throws(() => assertPublicHttps(url), undefined, url);
  assert.equal(assertPublicHttps('https://www.starbucks.es/').hostname, 'www.starbucks.es');
  for (const ip of ['127.0.0.1', '10.1.2.3', '172.31.255.255', '192.168.0.1', '169.254.169.254', '100.100.100.100', '0.0.0.0', '224.0.0.1', '::1', '::', 'fd00::1', 'fe80::1', '::ffff:10.0.0.1', '64:ff9b::7f00:1']) assert.equal(ipPrivada(ip), true, ip);
  for (const ip of ['93.184.216.34', '8.8.8.8', '2606:4700::6810:84e5']) assert.equal(ipPrivada(ip), false, ip);
});

test('el analizador revisa cada redirección y el DNS: nada de saltar a una red privada', async () => {
  const publica = async () => ['93.184.216.34'];
  const redirige = (destino) => async (url) => String(url).startsWith('https://www.marca.example') ? new Response('', {status: 302, headers: {location: destino}}) : new Response('<html></html>', {headers: {'content-type': 'text/html'}});
  await assert.rejects(fetchPublico('https://www.marca.example/', {resolver: publica, fetchImpl: redirige('https://127.0.0.1/')}), /privada|IP/);
  await assert.rejects(fetchPublico('https://www.marca.example/', {resolver: publica, fetchImpl: redirige('http://otra.example/')}), /https/);
  await assert.rejects(fetchPublico('https://www.marca.example/', {resolver: publica, fetchImpl: redirige('https://metadata.google.internal/')}), /local/);
  // Un dominio que resuelve a una IP privada (DNS «trampa» o rebinding) se corta antes de pedirlo.
  let pedido = false;
  await assert.rejects(fetchPublico('https://trampa.example/', {resolver: async () => ['10.0.0.5'], fetchImpl: async () => { pedido = true; return new Response(''); }}), /privada/);
  assert.equal(pedido, false);
  // Bucle de redirecciones.
  await assert.rejects(fetchPublico('https://www.marca.example/', {resolver: publica, fetchImpl: redirige('https://www.marca.example/otra')}), /demasiadas/);
  // Redirección buena: se sigue y se devuelve la URL final.
  const buena = await fetchPublico('https://www.marca.example/', {resolver: publica, fetchImpl: redirige('https://marca.example/es/')});
  assert.equal(buena.url.toString(), 'https://marca.example/es/');
});

test('si la web bloquea el análisis se dice claramente, con el código HTTP, sin disfrazarse de navegador', async () => {
  const resolver = async () => ['93.184.216.34'];
  let agente = '';
  const prohibido = async (url, o) => { agente = o.headers['user-agent']; return new Response('Forbidden', {status: 403, headers: {'content-type': 'text/html'}}); };
  await assert.rejects(analyzeInspiration('https://www.marca.example/', {resolver, fetchImpl: prohibido, detectarBloqueo: true}), (e) => e.estado === 403 && e.bloqueo === true && /HTTP 403/.test(e.message));
  assert.match(agente, /ADmiraNeXT/, 'el analizador se identifica como lo que es');
  const reto = async () => new Response('<html><head><title>Just a moment...</title></head><body><form id="challenge-form"></form></body></html>', {status: 200, headers: {'content-type': 'text/html'}});
  await assert.rejects(analyzeInspiration('https://www.marca.example/', {resolver, fetchImpl: reto, detectarBloqueo: true}), (e) => e.bloqueo === true && /antibots/.test(e.message));
  assert.equal(esMuroAntibots({headers: new Headers({'cf-mitigated': 'challenge'})}, ''), true);
});

test('POST /marcablanca/api/analizar: mismo origen, límite por IP y respuesta clara ante un bloqueo', async () => {
  const env = {PRESENTATION_IDEAS: kv()};
  const pedir = (body, headers = {}) => analizarPost({request: new Request(ORIGEN + '/marcablanca/api/analizar', {method: 'POST', headers: {'content-type': 'application/json', Origin: ORIGEN, ...headers}, body: JSON.stringify(body)}), env});
  assert.equal((await analizarPost({request: new Request(ORIGEN + '/marcablanca/api/analizar', {method: 'POST', headers: {Origin: 'https://evil.example'}, body: '{}'}), env})).status, 403);
  assert.equal((await pedir({url: ''})).status, 400);
  const privada = await pedir({url: 'https://169.254.169.254/latest/meta-data/'});
  assert.equal(privada.status, 400);
  assert.match((await privada.json()).error, /privada|IP/);
  const realFetch = globalThis.fetch;
  globalThis.fetch = async (url) => String(url).includes('cloudflare-dns.com') ? new Response(JSON.stringify({Answer: [{type: 1, data: '93.184.216.34'}]})) : new Response('denied', {status: 403, headers: {'content-type': 'text/html'}});
  try {
    const bloqueada = await pedir({url: 'https://www.marca.example/'}, {'CF-Connecting-IP': '203.0.113.9'});
    assert.equal(bloqueada.status, 422);
    const b = await bloqueada.json();
    assert.deepEqual({estado: b.estado, bloqueo: b.bloqueo}, {estado: 403, bloqueo: true});
    for (let i = 0; i < 12; i += 1) await pedir({url: 'https://www.marca.example/'}, {'CF-Connecting-IP': '198.51.100.7'});
    const tope = await pedir({url: 'https://www.marca.example/'}, {'CF-Connecting-IP': '198.51.100.7'});
    assert.equal(tope.status, 429, 'tope por IP');
    assert.ok(Number(tope.headers.get('retry-after')) > 0);
  } finally { globalThis.fetch = realFetch; }
  assert.equal([...env.PRESENTATION_IDEAS.values.keys()].some(k => k.startsWith('marca:')), false, 'analizar no guarda ninguna marca');
});

test('la propuesta sale de la web y del logo, es legible y se declara automática', async () => {
  const html = `<html><head><title>Homepage | Starbucks</title><meta name="theme-color" content="#006241"></head><body><header><a href="/"><svg class="Header_logo" viewBox="0 0 64 64"><path fill="#006241" d="M0 0h64v64H0z"/><path fill="#fff" d="M8 8h8v8H8z"/></svg></a></header><style>body{background:#ffffff;font-family:SoDoSans, Helvetica, sans-serif}</style></body></html>`;
  const fetchImpl = async () => new Response(html, {headers: {'content-type': 'text/html; charset=utf-8'}});
  const r = await analizarMarca('https://www.starbucks.es/', {resolver: async () => ['23.1.2.3'], fetchImpl});
  assert.equal(r.datos.nombre, 'Starbucks', 'el trozo del título que casa con el dominio');
  assert.equal(r.propuesta.id, 'starbucks');
  assert.equal(r.datos.primario, '#006241');
  assert.match(r.datos.logo, /^data:image\/svg\+xml;base64,/);
  assert.equal(r.analisis.fuente, 'SoDoSans');
  assert.match(r.aviso, /Propuesta generada automáticamente a partir de https:\/\/www\.starbucks\.es\/\. No es la marca oficial de Starbucks/);
  assert.match(r.propuesta.descripcion, /No es la marca oficial/);
  assert.equal(r.propuesta.ejemplo, false);
  assert.deepEqual(validarMarca(r.propuesta), []);
  for (const modo of ['claro', 'oscuro']) {
    const p = r.propuesta.colores[modo];
    assert.ok(contraste(p.texto, p.fondo) >= 7 && contraste(p.primarioTexto, p.primario) >= 4.5, modo);
  }
  // Retoque a mano del fondo: el texto se re-deriva para seguir leyéndose.
  const oscura = propuestaDesdeDatos({...r.datos, modo: 'oscuro', fondo: '#1E3932'});
  assert.equal(oscura.colores.oscuro.fondo, '#1E3932');
  assert.ok(contraste(oscura.colores.oscuro.texto, '#1E3932') >= 7);
  // Una web que se llama como una marca protegida no la pisa.
  const admira = await analizarMarca('https://www.admira.com/', {resolver: async () => ['23.1.2.3'], fetchImpl: async () => new Response('<title>Admira</title>', {headers: {'content-type': 'text/html'}})});
  assert.equal(admira.propuesta.id, 'admira-web');
  assert.equal(datosDesdeInspiracion({title: 'Inicio - Frescos Martínez', host: 'frescosmartinez.es'}).nombre, 'Frescos Martínez');
});

/* ── Navegador: cargador y página ────────────────────────────────────────── */
test('el cargador y la página leen del catálogo (con caída a los estáticos) y ofrecen «Tu marca · URL»', async () => {
  const js = await readFile(new URL('../marcablanca/marcablanca.js', import.meta.url), 'utf8');
  assert.match(js, /BASE \+ 'api\/marcas'/);
  assert.match(js, /clientes\/index\.json/, 'respaldo estático del índice');
  assert.match(js, /'clientes\/' \+ id \+ '\.json'/, 'respaldo estático de cada marca');
  const html = await readFile(new URL('../marcablanca/index.html', import.meta.url), 'utf8');
  assert.match(html, /id="formUrl"/);
  assert.match(html, /Tu marca<\/b> · introduce una URL/);
  assert.match(html, /data-pr-accion="guardar"/);
  assert.match(html, /data-pr-accion="json"/);
  assert.match(html, /\/marcablanca\/propuesta\.js\?v=/);
  const propuesta = await readFile(new URL('../marcablanca/propuesta.js', import.meta.url), 'utf8');
  assert.match(propuesta, /\/marcablanca\/api\/analizar/);
  assert.match(propuesta, /\/presentaciones\/api\/marcas/);
  assert.match(propuesta, /hace falta entrar en el/);
  assert.match(propuesta, /HTTP \$\{body\.estado\}/, 'el bloqueo enseña el código HTTP');
  const panel = await readFile(new URL('../assets/presentation-prospect.js', import.meta.url), 'utf8');
  assert.match(panel, /\/marcablanca\/api\/marcas\?completo=1/, 'el panel prospect lista desde el catálogo');
  assert.match(panel, /from '\/marcablanca\/logo-paleta\.js/, 'la paleta del logo es código compartido');
});
