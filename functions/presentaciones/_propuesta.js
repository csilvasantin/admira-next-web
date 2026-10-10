/*
 * PROPUESTA COMERCIAL AUTOMÁTICA (Carlos, 02-10-2026 · FLT-101369 a · SubMorfeoMacMini).
 *
 * «Se introduce una marca o idea, se hace un estudio de la compañía y se personaliza la presentación
 * y la plataforma con su desarrollo de marca en las 4 soluciones (Studio, Store, App y Biz).»
 *
 * Cuatro pasos, en orden, idempotentes por id (el id de la marca es el de la propuesta):
 *   1. marca        catálogo único (marca:<id>): una marca existente, o una propuesta nueva sacada de su
 *                   web con el MISMO analizador de /marcablanca (analizarMarca → propuestaDesdeDatos), o
 *                   una propuesta neutra a partir del nombre/idea (pendiente de logo). Origen «propuesta».
 *                   Las semillas no se tocan nunca: admira.com → «admira-com», no «admira».
 *   2. estudio      _estudio.js: web pública (portada + hasta 4 internas) → xAI (el proveedor de texto
 *                   del generador) → JSON validado, guardado en KV `estudio:<id>`. Si xAI falla, estudio
 *                   «pendiente» honesto.
 *   3. presentacion la lógica de /presentaciones/api/generate (su propio onRequestPut, sin duplicar
 *                   nada: contraseña, versiones, prospect, traducción…) con prospect = la marca y las
 *                   láminas del estudio: contexto, retos, Studio, Store, App, Biz, piloto → «Su galaxia».
 *   4. plataforma   enlaces a las 4 soluciones vestidas con ?marca=<id>.
 * El registro vive en KV `propuesta:<id>`; cada paso ya hecho se salta (salvo `rehacer`).
 * Coste y control: límite diario por usuario (LIMITE_DIARIO) y registro de cada lanzamiento
 * (`propuesta-registro:<fecha>:<id>`). Nada se dispara solo: lo lanza quien llama (persona o agente).
 */
import {analizarMarca} from '../marcablanca/api/analizar.js';
import {obtenerMarca, guardarMarca, esSemilla, RESERVADOS, ErrorCatalogo} from '../marcablanca/_catalogo.js';
import {crearMarca, idMarca} from '../../marcablanca/marca.js';
import {estudiarCompania, SOLUCIONES} from './_estudio.js';
import {patas} from '../../data/pilares-historia.mjs';
import {onRequestPut as generarPresentacion} from './api/generate.js';
import {ensureHttpsUrl} from './_defaults.js';
import {fetchPublico, resolverDoh, limitedText, assertPublicHttps} from './_inspiration.js';
import {DEFAULT_OUTPUTS} from './_generation.js';

export const PREFIJO = 'propuesta:';
export const PREFIJO_ESTUDIO = 'estudio:';
export const PREFIJO_REGISTRO = 'propuesta-registro:';
export const PREFIJO_CUPO = 'propuesta-cupo:';
export const LIMITE_DIARIO = 20;
export const PASOS = ['marca', 'estudio', 'presentacion', 'plataforma'];
export const MAX_INTENTOS_ESTUDIO = 3;
export const PASO_CADUCA_MS = 5 * 60 * 1000;
export const CANALES = ['marcablanca', 'generador', 'mcp', 'api'];
const REGISTRO_TTL = 400 * 24 * 3600;
/** Primeros segmentos de /presentaciones/<x> que no pueden ser el slug de una presentación. */
const SLUGS_RESERVADOS = new Set(['api', 'generador', 'index', 'assets', 'auth', 'galeria', 'control', 'jobs', 'propuesta', 'clearchannel', 'lacaixa', 'caixa', 'lenovo']);

/** Las cinco patas, con la web de data/arquitectura.json, vestidas con ?marca=. */
export const PLATAFORMA = Object.fromEntries(patas().map((p) => [p.id, {nombre:p.dominio, verbo:p.verbo, web:p.url, maqueta:p.token}]));

export class ErrorPropuesta extends Error { constructor(msg, estado = 400, extra = {}){ super(msg); this.estado = estado; this.extra = extra; } }

const ahora = () => new Date().toISOString();
const limpio = (v, n) => String(v == null ? '' : v).replace(/[\u0000-\u001f<>]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, n);
const sinWww = h => String(h || '').toLowerCase().replace(/^www\./, '').replace(/\.$/, '');
const hostDe = u => { try { return sinWww(new URL(u).hostname); } catch (_) { return ''; } };
const normal = s => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '');
export const pareceWeb = s => /^https?:\/\//i.test(s) || (!/\s/.test(s) && /^[a-z0-9-]+(\.[a-z0-9-]+)+(?:[/?#]\S*)?$/i.test(s));

/* ── Entrada ─────────────────────────────────────────────────────────────── */
export function normalizarEntrada(body = {}){
  if (!body || typeof body !== 'object' || Array.isArray(body)) throw new ErrorPropuesta('Cuerpo JSON no válido.');
  let url = limpio(body.url, 500), marca = limpio(body.marca, 80);
  const idea = limpio(body.idea, 1200), destinatario = limpio(body.destinatario, 160);
  const idioma = ['es', 'en', 'ca'].includes(body.idioma) ? body.idioma : 'es';
  if (!url && marca && pareceWeb(marca)) { url = marca; marca = ''; }
  if (url) {
    url = ensureHttpsUrl(url);
    let u;
    try { u = new URL(url); } catch (_) { throw new ErrorPropuesta('La web no es una URL válida.'); }
    if (u.protocol !== 'https:') throw new ErrorPropuesta('La web debe empezar por https://');
    // Las mismas reglas que el analizador: nada local, ni IPs, ni puertos raros.
    try { assertPublicHttps(u.toString()); } catch (error) { throw new ErrorPropuesta(String(error.message || 'La web no está permitida.').replace('inspiradora', 'de la marca')); }
    url = u.toString();
  }
  if (!url && !marca && !idea) throw new ErrorPropuesta('Indica al menos una marca, una web o una idea.');
  return {url, marca, idea, destinatario, idioma};
}

/** Etiqueta «de marca» de un dominio: www.admira.com → admira · tienda.marca.co.uk → marca. */
export function etiquetaDominio(host){
  const partes = sinWww(host).split('.').filter(Boolean);
  if (partes.length < 2) return partes[0] || '';
  const sld = partes[partes.length - 2];
  if (partes.length >= 3 && sld.length <= 3 && partes[partes.length - 1].length === 2) return partes[partes.length - 3];
  return sld;
}
async function protegida(env, request, id){ return RESERVADOS.has(id) || id.startsWith('prospect-') || await esSemilla(env, request, id); }

/**
 * Decide el id (de la marca y de la propuesta) sin tocar la red salvo KV. Determinista: la misma
 * entrada da el mismo id, y así relanzar no duplica nada.
 * @returns {Promise<{id, tipo:'catalogo'|'web'|'nombre'|'idea', web, homonimaDe, existente}>}
 */
export async function planificar(env, request, entrada){
  if (entrada.url) {
    const host = hostDe(entrada.url);
    const candidatos = [idMarca(etiquetaDominio(host)), idMarca(host.replace(/\./g, '-'))].filter(Boolean);
    let homonimaDe = '';
    for (const id of candidatos) {
      if (await protegida(env, request, id)) { homonimaDe = homonimaDe || id; continue; }
      const previa = await obtenerMarca(env, request, id);
      if (!previa) return {id, tipo:'web', web:entrada.url, homonimaDe, existente:null};
      const webPrevia = previa.catalogo?.web || previa.origen?.web || '';
      if (hostDe(webPrevia) === host) return {id, tipo:'web', web:entrada.url, homonimaDe, existente:previa};
    }
    throw new ErrorPropuesta(`No hay un identificador libre para ${host} en el catálogo de marcas.`, 409);
  }
  if (entrada.marca) {
    const id = idMarca(entrada.marca);
    if (!id) throw new ErrorPropuesta('El nombre de la marca no es válido.');
    const deCatalogo = await obtenerMarca(env, request, id);
    if (deCatalogo) return {id, tipo:'catalogo', web:deCatalogo.catalogo?.web || deCatalogo.origen?.web || '', homonimaDe:'', existente:deCatalogo};
    const libre = await protegida(env, request, id) ? idMarca(`${id}-marca`) : id;
    return {id:libre, tipo:'nombre', web:'', homonimaDe:libre !== id ? id : '', existente:await obtenerMarca(env, request, libre)};
  }
  const palabras = entrada.idea.split(/\s+/).slice(0, 5).join(' ');
  const id = idMarca(`idea-${palabras}`) || 'idea';
  return {id, tipo:'idea', web:'', homonimaDe:'', existente:await obtenerMarca(env, request, id)};
}

/* ── Paso 1 · marca ─────────────────────────────────────────────────────── */
const NEUTRAS = [
  {primario:'#1F2A44', secundario:'#5B6B8C', acento:'#E0A458'},
  {primario:'#22333B', secundario:'#5E6472', acento:'#3FA7D6'},
  {primario:'#2B2D42', secundario:'#8D99AE', acento:'#EF8354'},
  {primario:'#283618', secundario:'#606C38', acento:'#DDA15E'}
];
function hash(s){ let h = 0; for (const c of String(s)) h = (h * 31 + c.charCodeAt(0)) >>> 0; return h; }

/** Marca neutra (sin logo, paleta provisional) a partir de un nombre: honesta y fácil de sustituir. */
export function marcaNeutra({id, nombre, web = '', sector = ''}){
  const p = NEUTRAS[hash(nombre) % NEUTRAS.length];
  return crearMarca({id, nombre, ...p, tipografia:'grotesca', modo:'claro', web, sector:sector || 'Por determinar', origenTipo:'propuesta',
    descripcion:`Propuesta neutra a partir del nombre «${nombre}»: pendiente de logo y de colores oficiales.`});
}

/**
 * «Busca su web si es trivial»: prueba www.<nombre>.com y .es y solo la acepta si su título o
 * nombre de sitio contiene el nombre buscado. Siempre queda marcada como DEDUCIDA (a confirmar).
 */
export async function buscarWebTrivial(nombre, opciones = {}){
  const base = normal(nombre);
  if (base.length < 3 || base.length > 30 || String(nombre).trim().split(/\s+/).length > 3) return '';
  const fetchImpl = opciones.fetchImpl || fetch;
  const resolver = opciones.resolver === undefined ? (host => resolverDoh(host, {fetchImpl})) : opciones.resolver;
  for (const tld of ['com', 'es']) {
    try {
      const {response, url} = await fetchPublico(`https://www.${base}.${tld}/`, {resolver, fetchImpl, timeoutMs:5000});
      if (!response.ok || !/text\/html/i.test(response.headers.get('content-type') || '')) { try { await response.body?.cancel(); } catch (_) {} continue; }
      const html = await limitedText(response, 200 * 1024);
      const titulo = html.match(/<title[^>]*>([\s\S]{0,300}?)<\/title>/i)?.[1] || '';
      const sitio = html.match(/<meta[^>]+property=["']og:site_name["'][^>]+content=["']([^"']+)/i)?.[1] || '';
      if (normal(`${titulo} ${sitio}`).includes(base)) return url.toString();
    } catch (_) { /* siguiente */ }
  }
  return '';
}

function avisoHomonima(homonimaDe, host){
  if (!homonimaDe) return '';
  return homonimaDe === 'admira'
    ? ` Es la marca corporativa de ${host}, distinta de «admira», la marca por defecto de la plataforma (Galaxia Admira).`
    : ` No es «${homonimaDe}», que es una marca protegida del catálogo.`;
}

function resumenMarca(m, extra = {}){
  const modo = m.modo && m.colores?.[m.modo] ? m.modo : Object.keys(m.colores || {})[0] || 'claro';
  const p = m.colores?.[modo] || {};
  return {id:m.id, nombre:m.nombre, sector:m.sector || '', modo, logo:m.logo?.svg || m.logo?.imagen || '',
    colores:{primario:p.primario || '', secundario:p.secundario || '', acento:p.acento || '', fondo:p.fondo || '', texto:p.texto || ''}, ...extra};
}

async function pasoMarca(ctx, reg){
  const {env, request, autor, opciones} = ctx;
  const plan = reg.plan, e = reg.entrada;
  if (plan.tipo === 'catalogo') {
    const m = await obtenerMarca(env, request, plan.id);
    if (!m) throw new ErrorPropuesta(`La marca «${plan.id}» ya no está en el catálogo.`, 404);
    reg.marca = resumenMarca(m, {origen:'catalogo', web:plan.web, pendienteLogo:Boolean(m.catalogo?.pendienteLogo), protegida:Boolean(m.catalogo?.protegida), aviso:m.catalogo?.aviso || ''});
    return {nota:`Marca del catálogo: ${m.nombre}.`};
  }
  // Una marca que ya estaba en el catálogo y no es de una propuesta (curada en el generador o en
  // /marcablanca) se usa tal cual: la propuesta automática no la sustituye nunca.
  const previa = ctx.previa;
  if (previa && previa.catalogo?.origen !== 'propuesta') {
    reg.marca = resumenMarca(previa, {origen:previa.catalogo?.origen || 'catalogo', web:plan.web || previa.catalogo?.web || '', pendienteLogo:Boolean(previa.catalogo?.pendienteLogo), aviso:previa.catalogo?.aviso || ''});
    return {nota:`Ya estaba en el catálogo (${previa.catalogo?.origen || 'catálogo'}): se reutiliza sin tocarla.`};
  }
  let web = plan.web, webDeducida = false, marca = null, aviso = '', pendienteLogo = false, nota = '';
  if (plan.tipo === 'nombre' && opciones.buscarWeb !== false) {
    web = await buscarWebTrivial(e.marca, opciones);
    webDeducida = Boolean(web);
  }
  if (web) {
    const host = hostDe(web);
    try {
      const a = await analizarMarca(web, opciones);
      const nombre = plan.tipo === 'nombre' ? e.marca : a.propuesta.nombre;
      marca = {...a.propuesta, id:plan.id, nombre};
      pendienteLogo = !a.analisis?.logo?.enLinea && !a.analisis?.logo?.url;
      aviso = `Propuesta generada automáticamente a partir de ${a.analisis?.url || web}; no es la marca oficial de ${nombre}.${avisoHomonima(plan.homonimaDe, host)}${webDeducida ? ` Web DEDUCIDA del nombre (${host}): confírmala.` : ''}${pendienteLogo ? ' Pendiente de logo.' : ''}`;
      nota = `Marca sacada de ${host}${a.analisis?.logo?.origen ? ` · logo: ${a.analisis.logo.origen}` : ''}.`;
    } catch (error) {
      const motivo = error?.name === 'TimeoutError' || error?.name === 'AbortError' ? 'la web no respondió a tiempo (8 s)'
        : error instanceof TypeError ? 'no se pudo conectar con la web' : limpio(error?.message || 'no se pudo analizar', 200);
      const nombre = plan.tipo === 'nombre' ? e.marca : (etiquetaDominio(host).replace(/^./, c => c.toUpperCase()) || host);
      marca = marcaNeutra({id:plan.id, nombre, web});
      pendienteLogo = true;
      aviso = `No se pudo analizar ${web} (${motivo}): propuesta neutra a partir del nombre, pendiente de logo y colores oficiales.${avisoHomonima(plan.homonimaDe, host)}`;
      nota = `La web no se dejó analizar: ${motivo}`;
    }
  } else {
    const nombre = plan.tipo === 'nombre' ? e.marca : (e.destinatario || `Idea · ${e.idea.split(/\s+/).slice(0, 5).join(' ')}`).slice(0, 80);
    marca = marcaNeutra({id:plan.id, nombre});
    pendienteLogo = true;
    aviso = `Propuesta neutra a partir ${plan.tipo === 'idea' ? 'de una idea' : 'del nombre'}: pendiente de logo y colores oficiales.${avisoHomonima(plan.homonimaDe, '')}`;
    nota = plan.tipo === 'nombre' ? 'No se encontró una web evidente: marca neutra.' : 'Marca neutra a partir de la idea.';
  }
  let r;
  try { r = await guardarMarca(env, request, {marca, origen:'propuesta', propuesta:true, web, autor, actualizar:Boolean(previa), aviso, pendienteLogo}); }
  catch (error) {
    // Un logo que no cabe (sin almacén de ficheros, > 48 KB) no tumba la propuesta: se guarda sin logo.
    if (!(error instanceof ErrorCatalogo) || error.estado !== 413 || !marca.logo?.imagen) throw error;
    marca = {...marca, logo:{alt:marca.logo.alt}, favicon:''};
    pendienteLogo = true;
    aviso += ' Pendiente de logo (no se pudo guardar el detectado).';
    r = await guardarMarca(env, request, {marca, origen:'propuesta', propuesta:true, web, autor, actualizar:Boolean(previa), aviso, pendienteLogo});
  }
  reg.marca = resumenMarca(r.marca, {origen:'propuesta', web, webDeducida, pendienteLogo, homonimaDe:plan.homonimaDe || '', aviso:r.marca.catalogo?.aviso || aviso});
  return {nota};
}

/* ── Paso 2 · estudio ───────────────────────────────────────────────────── */
async function pasoEstudio(ctx, reg){
  const {env, opciones} = ctx;
  const e = reg.entrada;
  const r = await estudiarCompania(env, {nombre:reg.marca.nombre, web:reg.marca.web || e.url || '', idea:e.idea, destinatario:e.destinatario, idioma:e.idioma}, opciones);
  const estudio = {version:1, id:reg.id, marca:{id:reg.marca.id, nombre:reg.marca.nombre}, idioma:e.idioma, generadoEn:ahora(), ...r};
  await env.PRESENTATION_IDEAS.put(PREFIJO_ESTUDIO + reg.id, JSON.stringify(estudio));
  reg.resumenEstudio = {estado:r.estado, confianza:r.datos.confianza, fuentes:r.fuentes.length, sector:r.datos.sector.texto};
  return {estado:r.estado === 'completo' ? 'hecho' : 'reserva', nota:r.estado === 'completo' ? `Estudio con ${r.fuentes.length} fuente(s), confianza ${r.datos.confianza}.` : `Estudio pendiente: ${r.motivo}.`, motivo:r.motivo};
}

/* ── Paso 3 · presentación ──────────────────────────────────────────────── */
const marcaHipotesis = a => a?.texto ? `${a.texto}${a.tipo === 'hipotesis' ? ' (hipótesis)' : ''}` : '';

/** Láminas de la presentación a partir del estudio: contexto, retos, las cinco patas y el piloto. */
export function laminasDesdeEstudio(nombre, datos){
  const op = datos.oportunidades || {};
  const sol = (code, act, product, k, chapter) => {
    const dato = op[k] || {titulo:'', detalle:'', basadoEn:''};
    return {code, act, product, chapter, title:limpio(dato.titulo, 120) || `${SOLUCIONES[k].nombre} ${SOLUCIONES[k].verbo}`, message:limpio(dato.detalle, 600) || SOLUCIONES[k].foco, promise:limpio(dato.basadoEn ? `Por qué: ${dato.basadoEn}` : SOLUCIONES[k].foco, 600), duration:5};
  };
  const retos = datos.retos || [];
  return [
    {code:'contexto', act:'studio', product:'Lo que hemos leído', chapter:'estudio', title:`Qué hemos entendido de ${nombre}`.slice(0, 120), message:limpio([marcaHipotesis(datos.sector), marcaHipotesis(datos.propuestaValor)].filter(Boolean).join(' '), 600) || datos.resumen, promise:limpio([marcaHipotesis(datos.presencia), marcaHipotesis(datos.publico)].filter(Boolean).join(' '), 600) || datos.resumen, duration:3},
    {code:'retos', act:'studio', product:'Hipótesis a validar', chapter:'estudio', title:'Retos probables', message:limpio(retos[0]?.texto || `Convertir los espacios de ${nombre} en un canal conectado, medible y mantenido.`, 600), promise:limpio(retos.slice(1, 3).map(r => r.texto).join(' · ') || 'Hipótesis a validar juntos en la reunión.', 600), duration:3},
    sol('studio', 'studio', 'admira.studio · crea', 'studio', '1/5'),
    sol('store', 'store', 'admira.store · distribuye', 'store', '2/5'),
    sol('tv', 'store', 'admira.tv · emite', 'tv', '3/5'),
    sol('app', 'app', 'admira.app · mantiene', 'app', '4/5'),
    sol('biz', 'app', 'admira.biz · comercializa', 'biz', '5/5'),
    {code:'piloto', act:'app', product:'Siguiente paso', chapter:'piloto', title:'El primer piloto', message:`Un espacio de ${nombre}, cuatro semanas y su marca en studio, store, tv, app y biz.`.slice(0, 600), promise:'Validamos juntos este estudio (lo marcado como hipótesis), elegimos la ubicación y tres métricas de éxito.', duration:3}
  ];
}

export function cuerpoGenerate(reg, estudio, slug, overwrite){
  const nombre = reg.marca.nombre, datos = estudio?.datos || {}, e = reg.entrada;
  const retos = (datos.retos || []).map(r => r.texto).filter(Boolean);
  return {
    displayName:nombre.slice(0, 100), slug, ...(reg.marca.web ? {website:reg.marca.web} : {}),
    problem:limpio(e.idea || (retos.length ? `Retos probables (hipótesis del estudio): ${retos.slice(0, 3).join(' · ')}` : `Llevar a ${nombre} la Galaxia Admira con su marca.`), 4000),
    audience:limpio([e.destinatario, datos.publico?.texto ? `Público de la marca: ${datos.publico.texto}` : ''].filter(Boolean).join(' · ') || 'Dirección de negocio, marketing y operaciones', 1000),
    title:`${nombre}: crear, distribuir, emitir, mantener y comercializar con su marca.`.slice(0, 220),
    summary:limpio(datos.resumen || `Propuesta de ADmiraNeXT para ${nombre} en las cinco patas de la Galaxia Admira.`, 1200),
    objective:`Acordar con ${nombre} un primer piloto en las cinco patas de la Galaxia Admira.`.slice(0, 600),
    closingTitle:`Elijamos el primer espacio de ${nombre}.`.slice(0, 220),
    closingAction:'Validar el estudio con su equipo, elegir una ubicación piloto y fijar tres métricas de éxito.',
    languages:[e.idioma], outputs:DEFAULT_OUTPUTS,
    prospect:{activo:true, marca:reg.marca.id},
    slides:laminasDesdeEstudio(nombre, datos),
    overwrite
  };
}

async function elegirSlug(env, reg){
  if (reg.presentacion?.slug) return {slug:reg.presentacion.slug, nuestra:Boolean(await env.PRESENTATION_IDEAS.get(`presentation:${reg.presentacion.slug}`))};
  for (const slug of [reg.id, `${reg.id}-propuesta`].map(s => s.slice(0, 63))) {
    if (SLUGS_RESERVADOS.has(slug)) continue;
    if (!await env.PRESENTATION_IDEAS.get(`presentation:${slug}`)) return {slug, nuestra:false};
  }
  throw new ErrorPropuesta(`Ya existen las presentaciones «${reg.id}» y «${reg.id}-propuesta» y no son de esta propuesta: no se sobrescriben.`, 409);
}

async function pasoPresentacion(ctx, reg){
  const {env} = ctx;
  const estudio = await env.PRESENTATION_IDEAS.get(PREFIJO_ESTUDIO + reg.id, {type:'json'});
  const {slug, nuestra} = await elegirSlug(env, reg);
  const body = cuerpoGenerate(reg, estudio, slug, nuestra);
  const res = await generarPresentacion({
    env, params:{}, data:ctx.data, waitUntil:ctx.waitUntil,
    request:new Request(new URL('/presentaciones/api/generate', ctx.origin), {method:'PUT', headers:{origin:ctx.origin, 'content-type':'application/json', accept:'application/json', cookie:ctx.cookie || ''}, body:JSON.stringify(body)})
  });
  let out = {};
  try { out = await res.json(); } catch (_) {}
  if (!res.ok) throw new ErrorPropuesta(`El generador no creó la presentación: ${out.error || `HTTP ${res.status}`}`, res.status >= 500 ? 502 : 422);
  reg.presentacion = {slug, url:`/presentaciones/${slug}/`, deckUrl:`/presentaciones/${slug}/presentacion`, ideasUrl:`/presentaciones/${slug}/ideas`,
    password:out.password || reg.presentacion?.password || null, narrativeSource:out.narrativeSource || '', translationPending:out.translationPending || [], slideCount:out.slideCount || 0, actualizadaEn:ahora()};
  return {nota:`Presentación ${nuestra ? 'regenerada' : 'creada'} en /presentaciones/${slug}/ (${out.slideCount || '?'} láminas).`};
}

/* ── Paso 4 · plataforma ────────────────────────────────────────────────── */
export function plataformaPara(id){
  const q = `?marca=${encodeURIComponent(id)}`;
  const salida = {};
  for (const [k, p] of Object.entries(PLATAFORMA)) salida[k] = {nombre:p.nombre, verbo:p.verbo, url:p.web + q};
  salida.marcablanca = `/marcablanca/?marca=${encodeURIComponent(id)}`;
  salida.presentacionDemo = `/marcablanca/presentacion?marca=${encodeURIComponent(id)}`;
  return salida;
}
async function pasoPlataforma(ctx, reg){
  reg.plataforma = plataformaPara(reg.marca.id);
  return {nota:'studio, store, tv, app y biz vestidas con ?marca=' + reg.marca.id + '.'};
}

const EJECUTORES = {marca:pasoMarca, estudio:pasoEstudio, presentacion:pasoPresentacion, plataforma:pasoPlataforma};

/* ── Registro, cupo y ejecución ─────────────────────────────────────────── */
export async function leerPropuesta(env, id){
  if (!env?.PRESENTATION_IDEAS || !idMarca(id)) return null;
  try { return await env.PRESENTATION_IDEAS.get(PREFIJO + idMarca(id), {type:'json'}); } catch (_) { return null; }
}
async function guardar(env, reg){
  reg.actualizadaEn = ahora();
  const est = PASOS.map(p => reg.pasos[p].estado);
  reg.estado = est.includes('error') ? 'error' : est.every(s => s === 'hecho' || s === 'reserva') ? 'lista' : 'en-curso';
  await env.PRESENTATION_IDEAS.put(PREFIJO + reg.id, JSON.stringify(reg), {metadata:{nombre:limpio(reg.marca?.nombre || reg.entrada.marca || reg.entrada.url || reg.entrada.idea, 80), estado:reg.estado, web:limpio(reg.marca?.web || reg.entrada.url, 200), creadaEn:reg.creadaEn, actualizadaEn:reg.actualizadaEn, autor:limpio(reg.creadaPor?.nombre, 80)}});
}

export function diaMadrid(fecha = new Date()){
  try { return new Intl.DateTimeFormat('sv-SE', {timeZone:'Europe/Madrid', year:'numeric', month:'2-digit', day:'2-digit'}).format(fecha); }
  catch (_) { return fecha.toISOString().slice(0, 10); }
}
export function claveQuien(autor = {}, acceso = {}){
  return limpio(autor.email || acceso.email || (acceso.tokenLabel ? `token:${acceso.tokenLabel}` : '') || `nivel:${acceso.level || 'anonimo'}`, 180).toLowerCase();
}
export async function leerCupo(env, quien, fecha = new Date()){
  const usados = Number(await env.PRESENTATION_IDEAS.get(`${PREFIJO_CUPO}${quien}:${diaMadrid(fecha)}`)) || 0;
  return {limite:LIMITE_DIARIO, usados, restantes:Math.max(0, LIMITE_DIARIO - usados), dia:diaMadrid(fecha)};
}
async function gastarCupo(env, quien, fecha = new Date()){
  const cupo = await leerCupo(env, quien, fecha);
  if (cupo.usados >= LIMITE_DIARIO) throw new ErrorPropuesta(`Has llegado al límite de ${LIMITE_DIARIO} propuestas automáticas por día. Vuelve mañana o pide a un administrador que lo revise.`, 429, {cupo});
  await env.PRESENTATION_IDEAS.put(`${PREFIJO_CUPO}${quien}:${cupo.dia}`, String(cupo.usados + 1), {expirationTtl:3 * 24 * 3600});
  return {...cupo, usados:cupo.usados + 1, restantes:Math.max(0, LIMITE_DIARIO - cupo.usados - 1)};
}
async function registrarLanzamiento(env, reg, {autor, canal, rehacer}){
  const cuando = ahora();
  const entrada = {id:reg.id, cuando, quien:{nombre:limpio(autor.nombre, 100), email:limpio(autor.email, 180), via:limpio(autor.via, 40)}, canal, rehacer:Boolean(rehacer),
    para:{nombre:limpio(reg.marca?.nombre || reg.entrada.marca || '', 80), web:reg.entrada.url || '', idea:limpio(reg.entrada.idea, 200), destinatario:reg.entrada.destinatario || ''}};
  try {
    await env.PRESENTATION_IDEAS.put(`${PREFIJO_REGISTRO}${cuando}:${reg.id}`, JSON.stringify(entrada), {expirationTtl:REGISTRO_TTL, metadata:{id:reg.id, quien:entrada.quien.email || entrada.quien.nombre, canal}});
  } catch (_) { /* el registro no tumba la propuesta; queda la línea de log */ }
  try { console.log(JSON.stringify({evento:'propuesta-lanzada', ...entrada, quien:{nombre:entrada.quien.nombre, via:entrada.quien.via}})); } catch (_) {}
}

function nuevoRegistro(plan, entrada, autor, canal){
  const t = ahora();
  return {version:1, id:plan.id, entrada, plan:{tipo:plan.tipo, web:plan.web, homonimaDe:plan.homonimaDe, id:plan.id}, estado:'en-curso',
    pasos:Object.fromEntries(PASOS.map(p => [p, {estado:'pendiente'}])), creadaPor:{nombre:limpio(autor.nombre, 100), email:limpio(autor.email, 180), via:limpio(autor.via, 40)}, canal, creadaEn:t, actualizadaEn:t, lanzamientos:0};
}
const debeCorrer = (paso, info) => info.estado === 'pendiente' || info.estado === 'error' || (info.estado === 'en-curso' && Date.now() - Date.parse(info.en || 0) > PASO_CADUCA_MS) || (paso === 'estudio' && info.estado === 'reserva' && (info.intentos || 0) < MAX_INTENTOS_ESTUDIO);

/**
 * Lanza o continúa una propuesta.
 * @param ctx {env, request, data, waitUntil, origin, cookie, autor:{nombre,email,via}, acceso, opciones}
 * @param pedido {entrada?|id, rehacer?, hasta?:'marca'|'estudio'|'presentacion'|'plataforma', canal?}
 */
export async function ejecutarPropuesta(ctx, pedido){
  const {env, request} = ctx;
  if (!env?.PRESENTATION_IDEAS) throw new ErrorPropuesta('La propuesta automática no está disponible (KV).', 503);
  const canal = CANALES.includes(pedido.canal) ? pedido.canal : 'api';
  let reg, plan;
  if (pedido.id && !pedido.entrada) {
    reg = await leerPropuesta(env, pedido.id);
    if (!reg) throw new ErrorPropuesta(`No existe la propuesta «${limpio(pedido.id, 60)}».`, 404);
  } else {
    plan = await planificar(env, request, pedido.entrada);
    reg = await leerPropuesta(env, plan.id);
  }
  const lanzamiento = !reg || pedido.rehacer === true;
  let cupo = null;
  if (lanzamiento) {
    cupo = await gastarCupo(env, claveQuien(ctx.autor, ctx.acceso));
    if (!reg) reg = nuevoRegistro(plan, pedido.entrada, ctx.autor, canal);
    else {
      // Rehacer: todo vuelve a pendiente (los datos anteriores siguen hasta que se sustituyen).
      if (pedido.entrada) reg.entrada = pedido.entrada;
      if (plan) reg.plan = {tipo:plan.tipo, web:plan.web, homonimaDe:plan.homonimaDe, id:plan.id};
      for (const p of PASOS) reg.pasos[p] = {estado:'pendiente'};
    }
    reg.lanzamientos = (reg.lanzamientos || 0) + 1;
    await registrarLanzamiento(env, reg, {autor:ctx.autor, canal, rehacer:pedido.rehacer === true});
  }
  // La marca previa se vuelve a leer en cada ejecución (puede haberla creado un paso anterior).
  ctx.previa = reg.plan.tipo === 'catalogo' ? null : await obtenerMarca(env, request, reg.plan.id);
  const hasta = PASOS.includes(pedido.hasta) ? pedido.hasta : 'plataforma';
  const objetivo = PASOS.slice(0, PASOS.indexOf(hasta) + 1);
  for (const paso of objetivo) {
    const info = reg.pasos[paso];
    if (!debeCorrer(paso, info)) {
      if (info.estado === 'en-curso') throw new ErrorPropuesta(`El paso «${paso}» de esta propuesta ya está en curso. Espera un momento y vuelve a consultarla.`, 409, {id:reg.id});
      continue;
    }
    if (paso !== 'marca' && !reg.marca) throw new ErrorPropuesta('Falta la marca de la propuesta.', 409);
    reg.pasos[paso] = {...info, estado:'en-curso', en:ahora()};
    await guardar(env, reg);
    try {
      const r = await EJECUTORES[paso](ctx, reg) || {};
      reg.pasos[paso] = {estado:r.estado || 'hecho', en:ahora(), nota:limpio(r.nota, 300), ...(r.motivo ? {motivo:limpio(r.motivo, 200)} : {}), ...(paso === 'estudio' ? {intentos:(info.intentos || 0) + 1} : {})};
    } catch (error) {
      reg.pasos[paso] = {estado:'error', en:ahora(), error:limpio(error?.message || 'error', 300), ...(paso === 'estudio' ? {intentos:(info.intentos || 0) + 1} : {})};
      await guardar(env, reg);
      if (error instanceof ErrorPropuesta || error instanceof ErrorCatalogo) throw new ErrorPropuesta(error.message, error.estado || 400, {id:reg.id, paso});
      throw new ErrorPropuesta(`Falló el paso «${paso}»: ${limpio(error?.message || error, 200)}`, 500, {id:reg.id, paso});
    }
    await guardar(env, reg);
  }
  return {reg, cupo};
}

/** Vista de una propuesta para el operador (detrás de la puerta del generador). Sin secretos de servidor. */
export async function vistaPropuesta(env, reg, {cupo = null} = {}){
  const estudio = await env.PRESENTATION_IDEAS.get(PREFIJO_ESTUDIO + reg.id, {type:'json'});
  return {
    ok:true, id:reg.id, estado:reg.estado, pasos:reg.pasos, entrada:reg.entrada,
    marca:reg.marca || null,
    estudio:estudio ? {estado:estudio.estado, motivo:estudio.motivo || '', confianza:estudio.datos?.confianza || 'baja', generadoEn:estudio.generadoEn, fuentes:estudio.fuentes || [], avisos:estudio.avisos || [], datos:estudio.datos} : null,
    presentacion:reg.presentacion ? {slug:reg.presentacion.slug, url:reg.presentacion.url, deckUrl:reg.presentacion.deckUrl, ideasUrl:reg.presentacion.ideasUrl, narrativeSource:reg.presentacion.narrativeSource, translationPending:reg.presentacion.translationPending, ...(reg.presentacion.password ? {password:reg.presentacion.password} : {})} : null,
    plataforma:reg.plataforma || (reg.marca ? plataformaPara(reg.marca.id) : null),
    propuestaUrl:`/marcablanca/propuesta/${reg.id}`,
    creadaPor:{nombre:reg.creadaPor?.nombre || '', via:reg.creadaPor?.via || ''}, canal:reg.canal || '', creadaEn:reg.creadaEn, actualizadaEn:reg.actualizadaEn, lanzamientos:reg.lanzamientos || 1,
    ...(cupo ? {cupo} : {})
  };
}

/** Últimas propuestas (metadata de KV, sin leer cada una). */
export async function listarPropuestas(env, limite = 50){
  try {
    const page = await env.PRESENTATION_IDEAS.list({prefix:PREFIJO, limit:1000});
    return (page.keys || []).map(k => ({id:k.name.slice(PREFIJO.length), ...(k.metadata || {})}))
      .sort((a, b) => String(b.actualizadaEn || '').localeCompare(String(a.actualizadaEn || ''))).slice(0, limite);
  } catch (_) { return []; }
}
