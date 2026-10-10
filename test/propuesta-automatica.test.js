// PROPUESTA COMERCIAL AUTOMÁTICA (SubMorfeoMacMini, 02-10-2026 · FLT-101369 a/b).
// Marca → estudio de la compañía → presentación con su marca → las 4 soluciones con ?marca=<id>.
// xAI y la web del cliente están simulados: nada sale a la red.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {onRequestPost as lanzar, onRequestGet as consultar} from '../functions/presentaciones/api/propuesta.js';
import {onRequest as middleware} from '../functions/presentaciones/_middleware.js';
import {onRequestGet as renderDeck} from '../functions/presentaciones/[client]/presentacion.js';
import {validarEstudio, enlacesInternos, ESQUEMA_ESTUDIO, estudioPendiente} from '../functions/presentaciones/_estudio.js';
import {normalizarEntrada, etiquetaDominio, laminasDesdeEstudio, LIMITE_DIARIO, PREFIJO_CUPO, diaMadrid, plataformaPara} from '../functions/presentaciones/_propuesta.js';
import {xaiResponsesUrl} from '../functions/presentaciones/_skeleton.js';
import {plataformaDeBloque} from '../functions/presentaciones/_prospect.js';
import {TOOLS, HELP, callTool} from '../functions/mcp/_server.js';

const ROOT = new URL('../', import.meta.url);
const ORIGEN = 'https://www.admiranext.com';
const TYPES = {'.json': 'application/json', '.svg': 'image/svg+xml', '.css': 'text/css', '.html': 'text/html'};
function assets(){
  return {async fetch(input){
    const url = new URL(typeof input === 'string' ? input : input instanceof URL ? input.href : input.url);
    if (url.pathname.endsWith('/')) url.pathname += 'index.html'; // como Pages: /dir/ sirve su index.html
    try { const body = await readFile(new URL('.' + url.pathname, ROOT)); return new Response(body, {headers: {'content-type': TYPES[url.pathname.slice(url.pathname.lastIndexOf('.'))] || 'application/octet-stream'}}); }
    catch (_) { return new Response('404', {status: 404}); }
  }};
}
function kv(){
  const values = new Map(), metas = new Map();
  return {values, metas,
    async get(key, o){ const v = values.get(key); if (v == null) return null; return o?.type === 'json' ? JSON.parse(v) : v; },
    async put(key, value, o){ values.set(key, String(value)); if (o?.metadata) metas.set(key, o.metadata); },
    async delete(key){ values.delete(key); },
    async list(o){ return {list_complete: true, keys: [...values.keys()].filter(k => !o?.prefix || k.startsWith(o.prefix)).map(name => ({name, metadata: metas.get(name)}))}; }};
}
function r2(){
  const objects = new Map();
  return {objects, async put(key, bytes, meta){ objects.set(key, {bytes, meta}); }, async delete(key){ objects.delete(key); },
    async get(key){ const o = objects.get(key); return o ? {body: o.bytes, writeHttpMetadata(){}} : null; }};
}
const entorno = () => ({ASSETS: assets(), PRESENTATION_IDEAS: kv(), PRESENTATION_MEDIA: r2(), PRES_SIGNING_KEY: 'clave-de-prueba', XAI_API_KEY: 'xai-de-prueba'});
const conAcceso = (extra = {}) => ({presentationAccess: {level: 'owner', canGenerate: true, email: 'csilvasantin@gmail.com', ...extra}});

/* ── Web de admira.com y xAI simulados ───────────────────────────────────── */
const PORTADA = `<html><head><title>Admira | Digital Signage y Retail Media</title><meta name="description" content="Soluciones de digital signage para retail."><meta name="theme-color" content="#E4032E">
<style>body{background:#ffffff;font-family:Montserrat, sans-serif}:root{--brand-primary:#E4032E}</style></head><body>
<header><a href="/"><svg class="logo" viewBox="0 0 64 64"><path fill="#E4032E" d="M0 0h64v64H0z"/></svg></a>
<nav><a href="/quienes-somos/">Quiénes somos</a><a href="/soluciones/">Soluciones</a><a href="/clientes/">Clientes</a><a href="/contacto/">Contacto</a><a href="/blog/">Blog</a><a href="https://otra.example/">Fuera</a><a href="/catalogo.pdf">PDF</a></nav></header>
<main><h1>Digital signage para retail</h1><p>Admira conecta pantallas en tiendas.</p></main></body></html>`;
const pagina = (t) => `<html><head><title>${t} · Admira</title></head><body><main><h1>${t}</h1><p>Texto público de ${t}.</p></main></body></html>`;

function estudioXai(fuente, extra = {}){
  return {resumen: 'Admira es una empresa de digital signage para retail.', sector: {texto: 'Digital signage y retail media', tipo: 'hecho', fuente},
    propuestaValor: {texto: 'Conecta pantallas en tiendas', tipo: 'hecho', fuente}, presencia: {texto: 'No consta el número de ubicaciones', tipo: 'hipotesis', fuente: ''},
    publico: {texto: 'Cadenas de retail', tipo: 'hecho', fuente: 'https://inventada.example/'},
    canales: [{texto: 'Web corporativa', tipo: 'hecho', fuente}], retos: [{texto: 'Medir el impacto en tienda', tipo: 'hecho', fuente}, {texto: 'Mantener una red grande de pantallas', tipo: 'hipotesis', fuente: ''}],
    oportunidades: {studio: {titulo: 'Contenidos con su marca', detalle: 'Piezas para cada pantalla.', basadoEn: 'Ofrecen digital signage'}, store: {titulo: 'Inventario del punto de venta', detalle: 'Gemelo digital de cada tienda.', basadoEn: ''},
      tv: {titulo: 'Emisión en pantalla', detalle: 'Qué suena en cada pantalla.', basadoEn: ''},
      app: {titulo: 'Mantenimiento de la red', detalle: 'Incidencias e instaladores.', basadoEn: ''}, biz: {titulo: 'Circuito DOOH', detalle: 'Vender el inventario de pantallas.', basadoEn: ''}},
    confianza: 'alta', inventado: 'esto no está en el esquema', ...extra};
}
const respuestaXai = obj => new Response(JSON.stringify({output: [{type: 'message', content: [{type: 'output_text', text: JSON.stringify(obj)}]}]}), {headers: {'content-type': 'application/json'}});

/** Instala un fetch global simulado. `xai(body)` decide la respuesta del estudio. */
function simular({xai = () => respuestaXai(estudioXai('https://www.admira.com/')), web = {}} = {}){
  const llamadas = {xai: 0, traduccion: 0, web: []};
  const real = globalThis.fetch;
  globalThis.fetch = async (input, init = {}) => {
    const u = String(input instanceof Request ? input.url : input);
    if (u.includes('cloudflare-dns.com')) return new Response(JSON.stringify({Answer: [{type: 1, data: '93.184.216.34'}]}), {headers: {'content-type': 'application/dns-json'}});
    if (u.includes('api.x.ai')) {
      const body = JSON.parse(init.body || '{}');
      if (body.text?.format?.name === 'presentation_languages') { llamadas.traduccion += 1; return new Response('{}', {status: 503}); }
      if (body.text?.format?.name === 'estudio_compania') { llamadas.xai += 1; llamadas.ultimoCuerpo = body; return xai(body); }
      throw new Error('llamada a xAI inesperada: ' + body.text?.format?.name);
    }
    llamadas.web.push(u);
    if (web[u]) return web[u]();
    if (u === 'https://admira.com/') return new Response(null, {status: 301, headers: {location: 'https://www.admira.com/'}});
    if (u === 'https://www.admira.com/') return new Response(PORTADA, {headers: {'content-type': 'text/html; charset=utf-8'}});
    const m = u.match(/^https:\/\/www\.admira\.com\/(quienes-somos|soluciones|clientes|contacto)\/$/);
    if (m) return new Response(pagina(m[1]), {headers: {'content-type': 'text/html'}});
    throw new TypeError('fetch failed: ' + u);
  };
  return {llamadas, restaurar(){ globalThis.fetch = real; }};
}

function post(env, body, {data = conAcceso(), origin = ORIGEN, esperar = []} = {}){
  const request = new Request(ORIGEN + '/presentaciones/api/propuesta', {method: 'POST', headers: {'content-type': 'application/json', ...(origin ? {Origin: origin} : {})}, body: typeof body === 'string' ? body : JSON.stringify(body)});
  return lanzar({request, env, data, params: {}, waitUntil(p){ esperar.push(p); }});
}

/* ── Orquestador ─────────────────────────────────────────────────────────── */
test('admira.com: marca admira-com (sin tocar la semilla), estudio con fuentes, presentación vestida y las 4 soluciones', async () => {
  const env = entorno();
  const sim = simular();
  const pendientes = [];
  try {
    const res = await post(env, {url: 'admira.com', destinatario: 'Dirección de marketing', canal: 'marcablanca'}, {esperar: pendientes});
    const body = await res.json();
    await Promise.allSettled(pendientes);
    assert.equal(res.status, 201, JSON.stringify(body).slice(0, 400));
    assert.equal(body.id, 'admira-com', 'admira es semilla protegida: el id es admira-com');
    assert.equal(body.estado, 'lista');
    assert.deepEqual(Object.values(body.pasos).map(p => p.estado), ['hecho', 'hecho', 'hecho', 'hecho']);
    // Marca: catálogo con origen propuesta; la semilla admira intacta.
    assert.equal(env.PRESENTATION_IDEAS.values.has('marca:admira'), false, 'la semilla no se escribe');
    const marca = JSON.parse(env.PRESENTATION_IDEAS.values.get('marca:admira-com'));
    assert.equal(marca.catalogo.origen, 'propuesta');
    assert.equal(marca.catalogo.propuesta, true);
    assert.match(marca.catalogo.aviso, /marca corporativa de admira\.com, distinta de «admira», la marca por defecto/);
    assert.equal(marca.marca.colores[marca.marca.modo].primario, '#E4032E');
    assert.equal(body.marca.homonimaDe, 'admira');
    assert.ok(env.PRESENTATION_MEDIA.objects.has('marcas/admira-com/logo.svg'), 'el logo detectado va al catálogo (R2)');
    // Estudio: portada + 4 internas relevantes (no el blog, ni otro dominio, ni el PDF); hechos citados.
    const estudio = JSON.parse(env.PRESENTATION_IDEAS.values.get('estudio:admira-com'));
    assert.equal(estudio.estado, 'completo');
    assert.ok(estudio.generadoEn);
    assert.deepEqual(estudio.fuentes.map(f => f.tipo), ['portada', 'quienes', 'soluciones', 'clientes', 'contacto']);
    assert.equal(sim.llamadas.web.some(u => /blog|otra\.example|\.pdf/.test(u)), false);
    assert.equal(sim.llamadas.xai, 1, 'una sola llamada al proveedor de texto para el estudio');
    assert.equal(sim.llamadas.ultimoCuerpo.model, 'grok-4.5', 'el mismo proveedor y modelo que el generador');
    assert.equal(estudio.datos.sector.tipo, 'hecho');
    assert.equal(estudio.datos.publico.tipo, 'hipotesis', 'un «hecho» con una fuente que no se leyó baja a hipótesis');
    assert.equal(estudio.datos.publico.fuente, '');
    assert.ok(estudio.datos.retos.every(r => r.tipo === 'hipotesis'), 'los retos probables son siempre hipótesis');
    assert.equal('inventado' in estudio.datos, false, 'nada fuera del esquema');
    assert.equal(body.estudio.datos.confianza, 'media', 'el modelo dice «alta», pero con 3 hechos citados la evidencia solo da para «media»');
    // Presentación: la lógica de generate, con prospect y láminas del estudio.
    assert.equal(body.presentacion.slug, 'admira-com');
    assert.match(body.presentacion.password, /^AdmiraNeXT-/);
    const pres = JSON.parse(env.PRESENTATION_IDEAS.values.get('presentation:admira-com'));
    assert.equal(pres.prospect.marca, 'admira-com');
    assert.equal(pres.createdBy.email, 'csilvasantin@gmail.com');
    assert.deepEqual(pres.structure.slideCodes, ['contexto', 'retos', 'studio', 'store', 'tv', 'app', 'biz', 'piloto']);
    assert.ok(env.PRESENTATION_IDEAS.values.get('versions:admira-com') || [...env.PRESENTATION_IDEAS.values.keys()].some(k => k.startsWith('version')), 'se captura versión como en cualquier alta');
    const deck = await (await renderDeck({params: {client: 'admira-com'}, request: new Request(ORIGEN + '/presentaciones/admira-com/presentacion'), env, data: {}, next: () => new Response('', {status: 404})})).text();
    for (const p of ['studio', 'store', 'tv', 'app', 'yokup']) assert.match(deck, new RegExp(`data-mb-maqueta="${p}"`), `maqueta ${p}`);
    assert.match(deck, /admira\.tv/);
    assert.doesNotMatch(deck, /pixeria|>Yokup</i);
    assert.match(deck, /galaxia-prospect/, 'termina en «Su galaxia»');
    assert.doesNotMatch(deck.match(/data-block-id="contexto"[^>]*/)?.[0] || '', /data-mb-maqueta/, 'el contexto no roba una maqueta');
    // Plataforma.
    assert.equal(body.plataforma.studio.url, 'https://www.admira.studio/?marca=admira-com');
    assert.equal(body.plataforma.store.url, 'https://www.admira.store/?marca=admira-com');
    assert.equal(body.plataforma.tv.url, 'https://admira.tv/?marca=admira-com');
    assert.equal(body.plataforma.app.url, 'https://admira.app/?marca=admira-com');
    assert.equal(body.plataforma.app.verbo, 'mantiene');
    assert.equal(body.plataforma.biz.url, 'https://admira.biz/?marca=admira-com');
    assert.equal(body.plataforma.biz.verbo, 'comercializa');
    assert.equal(body.plataforma.tv.verbo, 'emite');
    assert.doesNotMatch(JSON.stringify(body.plataforma), /yokup|pixeria/i);
    assert.equal(body.propuestaUrl, '/marcablanca/propuesta/admira-com');
    assert.equal(body.cupo.usados, 1);
    // Registro del lanzamiento: quién, cuándo y para quién.
    const registro = [...env.PRESENTATION_IDEAS.values.entries()].find(([k]) => k.startsWith('propuesta-registro:'));
    assert.ok(registro);
    const r = JSON.parse(registro[1]);
    assert.equal(r.quien.email, 'csilvasantin@gmail.com');
    assert.equal(r.para.web, 'https://admira.com/');
    assert.equal(r.canal, 'marcablanca');
    assert.ok(r.cuando);
    // Nada secreto en la respuesta.
    assert.doesNotMatch(JSON.stringify(body), /xai-de-prueba|clave-de-prueba|csilvasantin@gmail\.com/);
  } finally { sim.restaurar(); }
});

test('idempotente por id: relanzar no repite pasos ni gasta cupo; rehacer sí, y conserva la clave', async () => {
  const env = entorno();
  const sim = simular();
  try {
    const a = await (await post(env, {url: 'https://www.admira.com/'})).json();
    const versiones = [...env.PRESENTATION_IDEAS.values.keys()].length;
    const res = await post(env, {url: 'https://admira.com'});
    const b = await res.json();
    assert.equal(res.status, 200);
    assert.equal(b.id, a.id);
    assert.equal(sim.llamadas.xai, 1, 'el estudio hecho no se repite');
    assert.equal(b.cupo.usados, 1, 'continuar no es un lanzamiento');
    assert.equal(b.presentacion.password, a.presentacion.password);
    assert.equal([...env.PRESENTATION_IDEAS.values.keys()].length, versiones, 'no se escribe nada nuevo');
    const c = await (await post(env, {url: 'https://admira.com', rehacer: true})).json();
    assert.equal(sim.llamadas.xai, 2);
    assert.equal(c.cupo.usados, 2);
    assert.equal(c.presentacion.slug, 'admira-com', 'regenera la misma presentación (overwrite), no crea otra');
    assert.equal(c.presentacion.password, a.presentacion.password, 'la clave se conserva al regenerar');
    // Continuar por id y paso (lo que hace la UI para enseñar el progreso).
    const d = await (await post(env, {id: 'admira-com', hasta: 'estudio'})).json();
    assert.equal(d.id, 'admira-com');
    assert.equal(d.cupo.usados, 2);
  } finally { sim.restaurar(); }
});

test('si xAI falla, «estudio pendiente» honesto: la propuesta sigue y se reintenta como mucho 3 veces', async () => {
  const env = entorno();
  const sim = simular({xai: () => new Response('caído', {status: 500})});
  try {
    const body = await (await post(env, {url: 'https://www.admira.com/'})).json();
    assert.equal(body.estado, 'lista');
    assert.equal(body.pasos.estudio.estado, 'reserva');
    assert.match(body.pasos.estudio.motivo, /xAI rechazó la petición/);
    assert.equal(body.estudio.estado, 'pendiente');
    assert.match(body.estudio.datos.resumen, /^Estudio pendiente/);
    assert.equal(body.estudio.datos.confianza, 'baja');
    assert.ok(body.estudio.fuentes.length >= 1, 'las fuentes leídas se conservan');
    assert.equal(sim.llamadas.xai, 2, 'un reintento ante un fallo rápido, como el generador');
    assert.ok(body.presentacion.slug, 'la presentación se crea igualmente');
    await post(env, {url: 'https://www.admira.com/'});
    await post(env, {url: 'https://www.admira.com/'});
    await post(env, {url: 'https://www.admira.com/'});
    assert.equal(sim.llamadas.xai, 6, 'tres intentos del paso como máximo (cada uno con su reintento rápido)');
  } finally { sim.restaurar(); }
  // Sin clave: ni se llama.
  const env2 = entorno(); delete env2.XAI_API_KEY;
  const sim2 = simular();
  try {
    const body = await (await post(env2, {url: 'https://www.admira.com/'})).json();
    assert.equal(sim2.llamadas.xai, 0);
    assert.match(body.pasos.estudio.motivo, /no tiene configurada la clave de xAI/);
  } finally { sim2.restaurar(); }
});

test('solo un nombre o una idea: marca neutra pendiente de logo; un id del catálogo se usa tal cual', async () => {
  const env = entorno();
  const sim = simular();
  try {
    const nombre = await (await post(env, {marca: 'Cafeterías Lumbrera', idea: 'Cadena de cafeterías de barrio que quiere pantallas'})).json();
    assert.equal(nombre.id, 'cafeterias-lumbrera');
    assert.equal(nombre.marca.pendienteLogo, true);
    assert.equal(nombre.marca.logo, '');
    const guardada = JSON.parse(env.PRESENTATION_IDEAS.values.get('marca:cafeterias-lumbrera'));
    assert.equal(guardada.catalogo.pendienteLogo, true);
    assert.match(guardada.catalogo.aviso, /neutra/);
    assert.equal(nombre.estudio.fuentes.length, 0);
    assert.equal(nombre.estudio.datos.sector.tipo, 'hipotesis', 'sin fuentes, nada puede ser hecho');
    assert.ok(sim.llamadas.web.some(u => u.startsWith('https://www.cafeteriaslumbrera.com/')), 'busca su web si es trivial');
    const idea = await (await post(env, {idea: 'Gimnasios low cost con pantallas en sala'})).json();
    assert.match(idea.id, /^idea-gimnasios-low-cost/);
    const lumbre = await (await post(env, {marca: 'lumbre'})).json();
    assert.equal(lumbre.id, 'lumbre');
    assert.equal(lumbre.marca.origen, 'catalogo');
    assert.equal(env.PRESENTATION_IDEAS.values.has('marca:lumbre'), false, 'la semilla de ejemplo no se toca');
    assert.equal(lumbre.presentacion.slug, 'lumbre');
  } finally { sim.restaurar(); }
});

test('una marca curada del catálogo no se sobrescribe y una presentación ajena tampoco', async () => {
  const env = entorno();
  const sim = simular();
  try {
    env.PRESENTATION_IDEAS.values.set('presentation:admira-com', JSON.stringify({slug: 'admira-com', displayName: 'Otra'}));
    const body = await (await post(env, {url: 'https://www.admira.com/'})).json();
    assert.equal(body.presentacion.slug, 'admira-com-propuesta', 'no pisa la presentación existente');
    assert.equal(JSON.parse(env.PRESENTATION_IDEAS.values.get('presentation:admira-com')).displayName, 'Otra');
  } finally { sim.restaurar(); }
});

/* ── Permisos, origen, campos y límite diario ────────────────────────────── */
test('permisos: sin sesión la puerta contesta 401 en JSON; sin permiso de generar, 403; otro origen, 403', async () => {
  const env = {...entorno(), PRES_ADMIN: 'maestra-de-prueba-123'};
  for (const method of ['GET', 'POST']) {
    const request = new Request(ORIGEN + '/presentaciones/api/propuesta', {method, headers: {accept: 'application/json', 'content-type': 'application/json', Origin: ORIGEN}, body: method === 'GET' ? undefined : JSON.stringify({url: 'https://www.admira.com/'})});
    let llego = false;
    const res = await middleware({request, env, data: {}, next: async () => { llego = true; return new Response('no'); }, waitUntil(){}});
    assert.equal(res.status, 401, method);
    assert.equal(llego, false);
    assert.match(res.headers.get('content-type'), /json/);
  }
  const sinPermiso = {presentationAccess: {level: 'client', canGenerate: false}};
  assert.equal((await post(env, {url: 'https://www.admira.com/'}, {data: sinPermiso})).status, 403);
  assert.equal((await consultar({request: new Request(ORIGEN + '/presentaciones/api/propuesta'), env, data: sinPermiso})).status, 403);
  assert.equal((await post(env, {url: 'https://www.admira.com/'}, {origin: 'https://evil.example'})).status, 403);
  assert.equal((await post(env, {url: 'https://www.admira.com/'}, {origin: ''})).status, 403, 'una cookie de navegador sin Origin no vale');
  assert.equal((await post(env, {nada: 1})).status, 400, 'campos desconocidos');
  assert.equal((await post(env, {idioma: 'es'})).status, 400, 'hace falta url, marca o idea');
  assert.equal((await post(env, {url: 'http://localhost/'})).status, 400);
  assert.equal(env.PRESENTATION_IDEAS.values.size, 0, 'nada se escribe sin permiso o con una petición mala');
  // Un deepagent con su token (Bearer, sin Origin) sí puede.
  const sim = simular();
  try {
    const res = await post(env, {marca: 'lumbre', hasta: 'marca'}, {origin: '', data: conAcceso({via: 'agent-token', tokenLabel: 'Morfeo', level: 'editor'})});
    assert.equal(res.status, 201);
  } finally { sim.restaurar(); }
  const ok = await consultar({request: new Request(ORIGEN + '/presentaciones/api/propuesta'), env, data: conAcceso()});
  const lista = await ok.json();
  assert.equal(lista.cupo.limite, LIMITE_DIARIO);
  assert.equal(lista.recientes[0].id, 'lumbre');
});

test(`límite diario: ${LIMITE_DIARIO} lanzamientos por usuario y día; continuar no cuenta`, async () => {
  const env = entorno();
  const sim = simular();
  try {
    await post(env, {marca: 'lumbre', hasta: 'marca'});
    env.PRESENTATION_IDEAS.values.set(`${PREFIJO_CUPO}csilvasantin@gmail.com:${diaMadrid()}`, String(LIMITE_DIARIO));
    const res = await post(env, {marca: 'brumelle', hasta: 'marca'});
    assert.equal(res.status, 429);
    assert.match((await res.json()).error, /límite de 20 propuestas/);
    assert.equal(env.PRESENTATION_IDEAS.values.has('propuesta:brumelle'), false);
    assert.equal((await post(env, {id: 'lumbre', hasta: 'estudio'})).status, 200, 'continuar una propuesta ya lanzada no gasta cupo');
    // Otro usuario tiene su propio cupo.
    assert.equal((await post(env, {marca: 'brumelle', hasta: 'marca'}, {data: conAcceso({email: 'otra@admira.com'})})).status, 201);
  } finally { sim.restaurar(); }
});

/* ── Estudio: esquema y validación ───────────────────────────────────────── */
test('el estudio se valida contra un esquema cerrado: sin campos inventados y con la confianza que permiten las fuentes', () => {
  assert.equal(ESQUEMA_ESTUDIO.additionalProperties, false);
  assert.deepEqual(ESQUEMA_ESTUDIO.required, Object.keys(ESQUEMA_ESTUDIO.properties));
  const fuentes = [{url: 'https://www.admira.com/'}];
  const v = validarEstudio(estudioXai('https://www.admira.com'), {fuentes});
  assert.deepEqual(Object.keys(v).sort(), ['canales', 'confianza', 'hechosCitados', 'oportunidades', 'presencia', 'propuestaValor', 'publico', 'resumen', 'retos', 'sector'].sort());
  assert.equal(v.sector.fuente, 'https://www.admira.com/', 'la fuente se normaliza a la URL leída');
  assert.equal(v.confianza, 'media', 'con una sola fuente leída no puede ser «alta»');
  assert.equal(validarEstudio({...estudioXai(''), resumen: ''}, {fuentes}), null, 'sin resumen no vale');
  assert.equal(validarEstudio({...estudioXai(''), oportunidades: {studio: {titulo: 'x', detalle: 'y'}}}, {fuentes}), null, 'faltan soluciones');
  assert.equal(validarEstudio('texto', {fuentes}), null);
  const sinFuentes = validarEstudio(estudioXai('https://www.admira.com/'), {fuentes: []});
  assert.equal(sinFuentes.confianza, 'baja');
  assert.ok([sinFuentes.sector, sinFuentes.propuestaValor, ...sinFuentes.canales].every(a => a.tipo === 'hipotesis'));
  const pendiente = estudioPendiente('X');
  assert.equal(pendiente.confianza, 'baja');
  assert.deepEqual(Object.keys(pendiente.oportunidades), ['studio', 'store', 'tv', 'app', 'biz']);
});

test('fuentes internas: una por categoría, mismo dominio, sin ficheros ni otros sitios', () => {
  const e = enlacesInternos(PORTADA, 'https://www.admira.com/');
  assert.deepEqual(e.map(x => x.tipo), ['quienes', 'soluciones', 'clientes', 'contacto']);
  assert.ok(e.every(x => x.url.startsWith('https://www.admira.com/')));
});

test('entrada: una web escrita como marca se trata como web; dominios y láminas', () => {
  assert.equal(normalizarEntrada({marca: 'admira.com'}).url, 'https://admira.com/');
  assert.equal(normalizarEntrada({marca: 'Lumbre Café'}).marca, 'Lumbre Café');
  assert.throws(() => normalizarEntrada({url: 'ftp://x.example'}), /https/);
  assert.equal(etiquetaDominio('www.admira.com'), 'admira');
  assert.equal(etiquetaDominio('tienda.marca.co.uk'), 'marca');
  const laminas = laminasDesdeEstudio('Admira', estudioPendiente('Admira'));
  assert.deepEqual(laminas.map(l => plataformaDeBloque({id: l.code, product: l.product, title: l.title, message: l.message})), ['', '', 'studio', 'store', 'tv', 'yokup', 'app', '']);
  assert.equal(plataformaDeBloque({id: 'x', product: 'Contexto', message: 'mantenimiento de Yokup'}), '', 'un producto explícito ajeno no adivina por el texto');
  assert.deepEqual(Object.keys(plataformaPara('x')).filter((k) => k !== 'marcablanca' && k !== 'presentacionDemo'), ['studio', 'store', 'tv', 'app', 'biz']);
});

test('el proveedor de texto es siempre xAI; el simulador local solo puede ser localhost', () => {
  assert.equal(xaiResponsesUrl({}), 'https://api.x.ai/v1/responses');
  assert.equal(xaiResponsesUrl({XAI_API_URL: 'http://127.0.0.1:8899/v1/responses'}), 'http://127.0.0.1:8899/v1/responses');
  for (const malo of ['https://evil.example/v1', 'http://localhost.evil.example/', 'http://10.0.0.1/']) assert.equal(xaiResponsesUrl({XAI_API_URL: malo}), 'https://api.x.ai/v1/responses', malo);
});

/* ── MCP ─────────────────────────────────────────────────────────────────── */
test('MCP: lanzar_propuesta y estado_propuesta registradas, documentadas y con el criterio de uso', async () => {
  const help = await readFile(new URL('../mcp/generador.html', import.meta.url), 'utf8');
  const llms = await readFile(new URL('../mcp/llms.txt', import.meta.url), 'utf8');
  for (const nombre of ['lanzar_propuesta', 'estado_propuesta']) {
    assert.ok(TOOLS.some(t => t.name === nombre), nombre);
    assert.ok(HELP.includes(nombre) && help.includes(nombre) && llms.includes(nombre), `${nombre} documentada`);
  }
  assert.match(HELP, /nunca en bucle/i);
  const tema = await callTool({access: {email: 'a@b.c', level: 'editor'}}, 'help', {tema: 'propuesta'});
  assert.match(tema.help, /Nunca en bucle/);
  assert.match(tema.help, /20 por usuario y día/);
  // Llama paso a paso a la API (mismo origen, sesión del dueño del token) y devuelve URLs absolutas.
  const pedidas = [];
  const ctx = {env: {PRES_SIGNING_KEY: 'k'}, access: {email: 'agente@admira.com', level: 'editor', name: 'Morfeo'}, fetchImpl: async (url, init) => {
    pedidas.push({url, method: init.method, body: init.body ? JSON.parse(init.body) : null, cookie: init.headers.cookie, origin: init.headers.origin});
    return new Response(JSON.stringify({ok: true, id: 'admira-com', propuestaUrl: '/marcablanca/propuesta/admira-com', presentacion: {url: '/presentaciones/admira-com/', slug: 'admira-com'}, plataforma: {studio: {url: 'https://www.admira.studio/?marca=admira-com'}, marcablanca: '/marcablanca/?marca=admira-com'}}), {headers: {'content-type': 'application/json'}});
  }};
  const out = await callTool(ctx, 'lanzar_propuesta', {url: 'https://www.admira.com/'});
  assert.deepEqual(pedidas.map(p => p.body.hasta), ['marca', 'estudio', 'presentacion', 'plataforma']);
  assert.equal(pedidas[0].body.url, 'https://www.admira.com/');
  assert.equal(pedidas[0].body.canal, 'mcp');
  assert.equal(pedidas[1].body.id, 'admira-com');
  assert.ok(pedidas.every(p => p.url === 'https://www.admiranext.com/presentaciones/api/propuesta' && p.method === 'POST' && /^pres_owner=/.test(p.cookie) && p.origin === 'https://www.admiranext.com'));
  assert.equal(out.propuestaUrl, 'https://www.admiranext.com/marcablanca/propuesta/admira-com');
  assert.equal(out.presentacion.url, 'https://www.admiranext.com/presentaciones/admira-com/');
  await assert.rejects(callTool(ctx, 'lanzar_propuesta', {}), /url, marca o idea/);
  await assert.rejects(callTool(ctx, 'lanzar_propuesta', {url: 'x', masivo: true}), /Campos desconocidos/);
  // Un viewer consulta pero no lanza.
  const viewer = {...ctx, access: {...ctx.access, level: 'viewer'}};
  await assert.rejects(callTool(viewer, 'lanzar_propuesta', {url: 'https://www.admira.com/'}), /solo lectura/);
  pedidas.length = 0;
  await callTool(viewer, 'estado_propuesta', {id: 'admira-com'});
  assert.equal(pedidas[0].url, 'https://www.admiranext.com/presentaciones/api/propuesta?id=admira-com');
  await assert.rejects(callTool(viewer, 'estado_propuesta', {id: '../x'}), /id no válido/);
});

test('documentación: README de marcablanca con cuándo usarla, coste y límite', async () => {
  const readme = await readFile(new URL('../marcablanca/README.md', import.meta.url), 'utf8');
  assert.match(readme, /Propuesta comercial automática/);
  assert.match(readme, /lanzar_propuesta/);
  assert.match(readme, /nunca en bucle/i);
  assert.match(readme, /20/);
  assert.match(readme, /coste/i);
});

/* ── Entradas en la interfaz ─────────────────────────────────────────────── */
test('UI: «Lanzar propuesta» en /marcablanca y en el generador; página de propuesta privada y noindex', async () => {
  const {interpretar} = await import('../marcablanca/lanzar-propuesta.js');
  assert.deepEqual(interpretar('admira.com'), {url: 'admira.com'});
  assert.deepEqual(interpretar('https://www.admira.com'), {url: 'https://www.admira.com'});
  assert.deepEqual(interpretar('Frescaria'), {marca: 'Frescaria'});
  assert.deepEqual(interpretar('cadena de gimnasios que quiere pantallas en sala'), {idea: 'cadena de gimnasios que quiere pantallas en sala'});
  const mb = await readFile(new URL('../marcablanca/index.html', import.meta.url), 'utf8');
  assert.match(mb, /<section id="lanzar">[\s\S]*data-lanzar-propuesta="marcablanca"/);
  assert.match(mb, /lanzar-propuesta\.js\?v=/);
  const js = await readFile(new URL('../marcablanca/lanzar-propuesta.js', import.meta.url), 'utf8');
  assert.match(js, /\/presentaciones\/api\/propuesta/);
  assert.match(js, /requiere entrar en el/);
  for (const p of ['marca', 'estudio', 'presentacion', 'plataforma']) assert.match(js, new RegExp(`id: '${p}'`));
  const {onRequestGet: generador} = await import('../functions/presentaciones/generador.js');
  const html = await (await generador({request: new Request(ORIGEN + '/presentaciones/'), env: {ASSETS: assets()}})).text();
  assert.match(html, /id="propuestaAutomatica"[\s\S]*data-lanzar-propuesta="generador"[\s\S]*<form id="generator">/);
  assert.match(html, /lanzar-propuesta\.js/);
  const {onRequestGet: pagina} = await import('../functions/marcablanca/propuesta/[id].js');
  const res = await pagina({params: {id: 'admira-com'}, request: new Request(ORIGEN + '/marcablanca/propuesta/admira-com'), env: {ASSETS: assets()}});
  assert.equal(res.status, 200);
  assert.match(res.headers.get('x-robots-tag'), /noindex/);
  const shell = await res.text();
  assert.doesNotMatch(shell, /"datos"|AdmiraNeXT-[A-Za-z0-9]{8}/, 'el armazón no lleva datos');
  assert.equal((await pagina({params: {id: '../x'}, request: new Request(ORIGEN + '/marcablanca/propuesta/x'), env: {ASSETS: assets()}})).status, 404);
  const script = await readFile(new URL('../marcablanca/propuesta-pagina.js', import.meta.url), 'utf8');
  assert.match(script, /\/presentaciones\/api\/propuesta\?id=/, 'los datos vienen de la API privada');
  assert.match(script, /privados/);
});
