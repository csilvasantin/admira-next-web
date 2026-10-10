/*
 * ESTUDIO DE LA COMPAÑÍA para la propuesta comercial automática (SubMorfeoMacMini, 02-10-2026 · FLT-101369 a).
 *
 * 1. Recoge información PÚBLICA de la web de la marca con el mismo fetch endurecido del analizador
 *    (fetchPublico: solo https, sin IPs ni nombres locales, DNS comprobado, redirecciones revisadas,
 *    plazo y tope de bytes): la portada y, si existen, hasta 4 páginas internas relevantes
 *    (quiénes somos, soluciones, clientes, contacto/tiendas).
 * 2. Lo sintetiza con el MISMO proveedor de texto que el generador (xAI, env.XAI_TEXT_MODEL, misma
 *    clave XAI_API_KEY): ni proveedores ni claves nuevas. Una llamada; un reintento solo ante fallos
 *    rápidos (generateNarrativeWithRetry de _skeleton.js), nunca ante un «plazo».
 * 3. Valida la salida contra un esquema cerrado: lo que no está en el esquema se descarta, y una
 *    afirmación solo es «hecho» si cita una de las URLs leídas; si no, queda como «hipótesis».
 * 4. Si xAI no está o falla, plantilla de reserva HONESTA («estudio pendiente»), como hace el
 *    generador con FALLBACK_*: nunca se presenta como estudio algo que no lo es.
 */
import {fetchPublico, extractReadableText, limitedText, resolverDoh, esMuroAntibots} from './_inspiration.js';
import {generateNarrativeWithRetry, xaiResponsesUrl} from './_skeleton.js';
import {patas} from '../../data/pilares-historia.mjs';

export const ESTUDIO_TIMEOUT_MS = 60000;
export const MAX_PAGINAS_INTERNAS = 4;
export const MAX_HTML_PAGINA = 400 * 1024;
export const MAX_TEXTO_PAGINA = 3500;
export const PLAZO_PORTADA_MS = 8000;
export const PLAZO_PAGINA_MS = 6000;
const MAX_RESPUESTA = 256 * 1024;
const MAX_CANALES = 6;
const MAX_RETOS = 5;
const HISTORIA = patas();
export const SOLUCIONES_ESTUDIO = HISTORIA.map((p) => p.id);

/** Lo que hace cada pata. El rol sale de data/arquitectura.json. */
export const SOLUCIONES = Object.fromEntries(HISTORIA.map((p) => [p.id, {nombre:p.dominio, verbo:p.verbo, foco:p.rol}]));

/* ── 1. Fuentes públicas ─────────────────────────────────────────────────── */
export const CATEGORIAS = [
  {id:'quienes', re:/qui[eé]n(?:es)?[-_ ]?somos|sobre[-_ ]?nosotros|nosotros|about|empresa|company|compa[nñ]ia|historia|who[-_ ]?we[-_ ]?are|la[-_ ]?empresa/i},
  {id:'soluciones', re:/soluciones|solutions|servicios|services|productos|products|qu[eé][-_ ]?hacemos|what[-_ ]?we[-_ ]?do|plataforma|platform/i},
  {id:'clientes', re:/clientes|customers|clients|casos|case[-_ ]?stud|referencias|success|proyectos|projects/i},
  {id:'contacto', re:/contacto|contact|tiendas|stores|ubicaciones|locations|oficinas|offices|d[oó]nde[-_ ]?estamos|localiza/i}
];
const NO_PAGINA = /\.(?:pdf|jpe?g|png|gif|webp|svg|zip|mp4|mp3|docx?|xlsx?|pptx?)(?:$|\?)/i;
const sinWww = h => String(h || '').toLowerCase().replace(/^www\./, '');
const limpio = (v, n) => String(v == null ? '' : v).replace(/[\u0000-\u001f<>]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, n);

/** Enlaces internos relevantes de una portada: como mucho uno por categoría, en orden. */
export function enlacesInternos(html, base, maximo = MAX_PAGINAS_INTERNAS){
  const origen = new URL(base);
  const vistos = new Set([origen.href.replace(/#.*$/, '')]);
  const candidatos = [];
  for (const m of String(html || '').matchAll(/<a\b([^>]*)>([\s\S]{0,400}?)<\/a>/gi)) {
    const href = (m[1].match(/\shref\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/i) || []).slice(1).find(Boolean);
    if (!href || /^(?:#|mailto:|tel:|javascript:)/i.test(href)) continue;
    let url;
    try { url = new URL(href, origen); } catch (_) { continue; }
    if (url.protocol !== 'https:' || sinWww(url.hostname) !== sinWww(origen.hostname) || NO_PAGINA.test(url.pathname)) continue;
    url.hash = '';
    if (vistos.has(url.href) || url.pathname === '/') continue;
    vistos.add(url.href);
    const texto = limpio(m[2].replace(/<[^>]+>/g, ' '), 80);
    let ruta = url.pathname;
    try { ruta = decodeURIComponent(ruta); } catch (_) {}
    const senal = `${ruta} ${texto}`;
    const cat = CATEGORIAS.find(c => c.re.test(senal));
    if (cat) candidatos.push({url:url.href, tipo:cat.id, texto});
  }
  const salida = [];
  for (const cat of CATEGORIAS) {
    const uno = candidatos.find(c => c.tipo === cat.id);
    if (uno) salida.push(uno);
    if (salida.length >= maximo) break;
  }
  return salida;
}

function tituloDe(html){ return limpio(String(html || '').match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1]?.replace(/<[^>]+>/g, ''), 140); }
function descripcionDe(html){ return limpio(String(html || '').match(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']+)/i)?.[1] || String(html || '').match(/<meta[^>]+content=["']([^"']+)["'][^>]+name=["']description["']/i)?.[1], 300); }

async function leerPagina(url, {resolver, fetchImpl, timeoutMs}){
  const {response, url:final} = await fetchPublico(url, {resolver, fetchImpl, timeoutMs});
  if (!response.ok) { try { await response.body?.cancel(); } catch (_) {} return {error:`HTTP ${response.status}`, estado:response.status}; }
  if (!/text\/html|application\/xhtml\+xml/i.test(response.headers.get('content-type') || '')) { try { await response.body?.cancel(); } catch (_) {} return {error:'no es HTML'}; }
  const html = await limitedText(response, MAX_HTML_PAGINA);
  if (esMuroAntibots(response, html)) return {error:'página de verificación antibots', bloqueo:true};
  return {html, final:final.toString()};
}

/**
 * Lee la portada y hasta 4 páginas internas. Nunca lanza: devuelve {fuentes, avisos}.
 * `opciones`: resolver/fetchImpl (pruebas), maxPaginas.
 */
export async function recogerFuentes(web, opciones = {}){
  const fetchImpl = opciones.fetchImpl || fetch;
  const base = opciones.resolver === undefined ? (host => resolverDoh(host, {fetchImpl})) : opciones.resolver;
  const memo = new Map();
  const resolver = base ? (host => { if (!memo.has(host)) memo.set(host, base(host)); return memo.get(host); }) : null;
  const avisos = [];
  if (!web) return {fuentes:[], avisos:['Sin web pública: el estudio se basa solo en el nombre o la idea, y todo es hipótesis.']};
  let portada;
  try { portada = await leerPagina(web, {resolver, fetchImpl, timeoutMs:PLAZO_PORTADA_MS}); }
  catch (error) { portada = {error:error?.name === 'TimeoutError' || error?.name === 'AbortError' ? 'la web tardó demasiado' : (error?.message || 'no se pudo leer')}; }
  if (!portada.html) return {fuentes:[], avisos:[`No se pudo leer la portada de ${web}: ${portada.error}.`]};
  const fuentes = [{url:portada.final, tipo:'portada', titulo:tituloDe(portada.html), descripcion:descripcionDe(portada.html), texto:extractReadableText(portada.html).slice(0, MAX_TEXTO_PAGINA)}];
  const internas = enlacesInternos(portada.html, portada.final, opciones.maxPaginas ?? MAX_PAGINAS_INTERNAS);
  const leidas = await Promise.all(internas.map(async enlace => {
    try {
      const r = await leerPagina(enlace.url, {resolver, fetchImpl, timeoutMs:PLAZO_PAGINA_MS});
      if (!r.html) { avisos.push(`No se pudo leer ${enlace.url}: ${r.error}.`); return null; }
      return {url:r.final, tipo:enlace.tipo, titulo:tituloDe(r.html), descripcion:descripcionDe(r.html), texto:extractReadableText(r.html).slice(0, MAX_TEXTO_PAGINA)};
    } catch (error) { avisos.push(`No se pudo leer ${enlace.url}.`); return null; }
  }));
  for (const f of leidas) if (f && !fuentes.some(x => x.url === f.url)) fuentes.push(f);
  return {fuentes, avisos};
}

/* ── 2. Síntesis con xAI ─────────────────────────────────────────────────── */
const str = () => ({type:'string'});
const AFIRMACION = {type:'object', additionalProperties:false, properties:{texto:str(), tipo:{type:'string', enum:['hecho', 'hipotesis']}, fuente:str()}, required:['texto', 'tipo', 'fuente']};
const OPORTUNIDAD = {type:'object', additionalProperties:false, properties:{titulo:str(), detalle:str(), basadoEn:str()}, required:['titulo', 'detalle', 'basadoEn']};
export const ESQUEMA_ESTUDIO = {
  type:'object', additionalProperties:false,
  properties:{
    resumen:str(), sector:AFIRMACION, propuestaValor:AFIRMACION, presencia:AFIRMACION, publico:AFIRMACION,
    canales:{type:'array', items:AFIRMACION}, retos:{type:'array', items:AFIRMACION},
    oportunidades:{type:'object', additionalProperties:false, properties:Object.fromEntries(SOLUCIONES_ESTUDIO.map(k => [k, OPORTUNIDAD])), required:SOLUCIONES_ESTUDIO},
    confianza:{type:'string', enum:['alta', 'media', 'baja']}
  },
  required:['resumen', 'sector', 'propuestaValor', 'presencia', 'publico', 'canales', 'retos', 'oportunidades', 'confianza']
};

const IDIOMAS = {es:'Spanish (español de España)', en:'English', ca:'Catalan'};
const SISTEMA = [
  'You are a B2B commercial analyst at ADmiraNeXT preparing a private company study before a sales proposal.',
  'You receive the public pages of a company website (already fetched, with their URLs) and must describe the company and where each of the five ADmiraNeXT pillars could help it.',
  'STRICT HONESTY RULES: use only the supplied sources. A statement is "hecho" ONLY if it is explicitly stated in one of the supplied pages, and then "fuente" must be exactly that page URL. Anything you deduce, estimate or infer is "hipotesis" with "fuente" empty.',
  'Never invent figures, store counts, revenues, employee numbers, client names, people or dates. If the size or number of locations is not stated, say it is not stated (as a hipotesis) instead of guessing.',
  'Do not use any knowledge about the company that is not in the sources; if there are no sources, everything is "hipotesis" and "confianza" is "baja".',
  '"retos" are probable challenges: they are always hipotesis. "oportunidades" are concrete proposals for THIS company, one per solution, each grounded ("basadoEn") in something from the sources, or "" if nothing supports it.',
  'Write every text in the requested language, concise and specific: "resumen" 2-3 sentences; each texto at most 2 sentences. No markdown, no emoji.'
].join(' ');

export function cuerpoEstudio(env, contexto){
  return {
    model:env.XAI_TEXT_MODEL || 'grok-4.5', store:false, reasoning:{effort:'low'},
    input:[
      {role:'system', content:[{type:'input_text', text:SISTEMA}]},
      {role:'user', content:[{type:'input_text', text:JSON.stringify({
        idioma:IDIOMAS[contexto.idioma] || IDIOMAS.es,
        empresa:{nombre:contexto.nombre, web:contexto.web || '', idea:contexto.idea || '', destinatario:contexto.destinatario || ''},
        soluciones:Object.fromEntries(SOLUCIONES_ESTUDIO.map(k => [k, `${SOLUCIONES[k].nombre} (${SOLUCIONES[k].verbo}) — ${SOLUCIONES[k].foco}`])),
        fuentes:(contexto.fuentes || []).map(f => ({url:f.url, tipo:f.tipo, titulo:f.titulo, descripcion:f.descripcion, texto:f.texto}))
      })}]}
    ],
    text:{format:{type:'json_schema', name:'estudio_compania', strict:true, schema:ESQUEMA_ESTUDIO}}
  };
}

const NIVEL = {baja:0, media:1, alta:2};
const normUrl = u => String(u || '').trim().replace(/#.*$/, '').replace(/\/+$/, '').toLowerCase();

/**
 * Valida y normaliza la salida del modelo. Solo sobreviven los campos del esquema; un «hecho» sin
 * una URL leída como fuente baja a «hipótesis». Devuelve null si falta lo esencial.
 */
export function validarEstudio(bruto, {fuentes = []} = {}){
  if (!bruto || typeof bruto !== 'object' || Array.isArray(bruto)) return null;
  const leidas = new Map(fuentes.map(f => [normUrl(f.url), f.url]));
  const afirmacion = (a, {forzarHipotesis = false} = {}) => {
    const o = a && typeof a === 'object' && !Array.isArray(a) ? a : {};
    const texto = limpio(o.texto, 400);
    const fuente = leidas.get(normUrl(o.fuente)) || '';
    const hecho = !forzarHipotesis && o.tipo === 'hecho' && Boolean(fuente) && Boolean(texto);
    return {texto, tipo:hecho ? 'hecho' : 'hipotesis', fuente:hecho ? fuente : ''};
  };
  const lista = (v, max, op) => (Array.isArray(v) ? v : []).map(x => afirmacion(x, op)).filter(x => x.texto).slice(0, max);
  const op = o => { const x = o && typeof o === 'object' && !Array.isArray(o) ? o : {}; return {titulo:limpio(x.titulo, 120), detalle:limpio(x.detalle, 500), basadoEn:limpio(x.basadoEn, 300)}; };
  const datos = {
    resumen:limpio(bruto.resumen, 700),
    sector:afirmacion(bruto.sector), propuestaValor:afirmacion(bruto.propuestaValor), presencia:afirmacion(bruto.presencia), publico:afirmacion(bruto.publico),
    canales:lista(bruto.canales, MAX_CANALES), retos:lista(bruto.retos, MAX_RETOS, {forzarHipotesis:true}),
    oportunidades:Object.fromEntries(SOLUCIONES_ESTUDIO.map(k => [k, op(bruto.oportunidades?.[k])]))
  };
  if (!datos.resumen || !datos.sector.texto || !datos.propuestaValor.texto) return null;
  if (SOLUCIONES_ESTUDIO.some(k => !datos.oportunidades[k].titulo || !datos.oportunidades[k].detalle)) return null;
  // Confianza: la del modelo, como mucho la que permiten las pruebas (fuentes leídas y hechos citados).
  const hechos = [datos.sector, datos.propuestaValor, datos.presencia, datos.publico, ...datos.canales].filter(a => a.tipo === 'hecho').length;
  const porEvidencia = !fuentes.length ? 'baja' : (hechos >= 4 && fuentes.length >= 2 ? 'alta' : hechos >= 2 ? 'media' : 'baja');
  const delModelo = NIVEL[bruto.confianza] === undefined ? 'baja' : bruto.confianza;
  datos.confianza = NIVEL[delModelo] <= NIVEL[porEvidencia] ? delModelo : porEvidencia;
  datos.hechosCitados = hechos;
  return datos;
}

/** Una llamada a xAI. Devuelve {narrative, reason} para poder usar generateNarrativeWithRetry. */
export async function llamarXai(env, contexto){
  if (!env?.XAI_API_KEY) return {narrative:null, reason:'sin-clave'};
  let r;
  try {
    r = await fetch(xaiResponsesUrl(env), {method:'POST', headers:{'content-type':'application/json', authorization:`Bearer ${env.XAI_API_KEY}`},
      body:JSON.stringify(cuerpoEstudio(env, contexto)), signal:AbortSignal.timeout(ESTUDIO_TIMEOUT_MS)});
  } catch (error) {
    return {narrative:null, reason:error && (error.name === 'TimeoutError' || error.name === 'AbortError') ? 'plazo' : 'red'};
  }
  if (!r.ok) return {narrative:null, reason:'rechazo'};
  if (Number(r.headers.get('content-length') || 0) > MAX_RESPUESTA) return {narrative:null, reason:'demasiado-grande'};
  let payload; try { payload = await r.json(); } catch (_) { return {narrative:null, reason:'ilegible'}; }
  const texto = payload?.output?.find(i => i?.type === 'message')?.content?.find(i => i?.type === 'output_text')?.text;
  let bruto; try { bruto = JSON.parse(texto || ''); } catch (_) { return {narrative:null, reason:'ilegible'}; }
  const datos = validarEstudio(bruto, {fuentes:contexto.fuentes || []});
  return datos ? {narrative:datos, reason:''} : {narrative:null, reason:'formato'};
}

export const MOTIVOS_ESTUDIO = {
  'sin-clave':'el generador no tiene configurada la clave de xAI',
  'plazo':`xAI no respondió a tiempo (${Math.round(ESTUDIO_TIMEOUT_MS / 1000)} s)`,
  'red':'no se pudo llegar a xAI',
  'rechazo':'xAI rechazó la petición',
  'demasiado-grande':'la respuesta de xAI era demasiado grande',
  'ilegible':'xAI devolvió algo que no era JSON',
  'formato':'la respuesta de xAI no cumplía el esquema del estudio'
};

/* ── 3. Plantilla de reserva honesta ─────────────────────────────────────── */
export function estudioPendiente(nombre){
  const h = texto => ({texto, tipo:'hipotesis', fuente:''});
  return {
    resumen:`Estudio pendiente: todavía no hay un análisis de ${nombre}. Lo que sigue es la descripción genérica de cada solución, no un estudio de la compañía.`,
    sector:h('Pendiente de estudio.'), propuestaValor:h('Pendiente de estudio.'), presencia:h('Pendiente de estudio: no consta el número de tiendas o ubicaciones.'), publico:h('Pendiente de estudio.'),
    canales:[], retos:[],
    oportunidades:Object.fromEntries(SOLUCIONES_ESTUDIO.map(k => [k, {titulo:`${SOLUCIONES[k].nombre} ${SOLUCIONES[k].verbo}`, detalle:SOLUCIONES[k].foco, basadoEn:''}])),
    confianza:'baja', hechosCitados:0
  };
}

/**
 * Hace el estudio completo. Nunca lanza: si xAI falla, devuelve el estudio «pendiente» con el motivo.
 * @returns {Promise<{estado:'completo'|'pendiente', motivo:string, datos:object, fuentes:Array, avisos:string[], intentos:number, ms:number}>}
 */
export async function estudiarCompania(env, {nombre, web = '', idea = '', destinatario = '', idioma = 'es'}, opciones = {}){
  const inicio = Date.now();
  const {fuentes, avisos} = await recogerFuentes(web, opciones);
  const contexto = {nombre, web, idea, destinatario, idioma, fuentes};
  const r = await generateNarrativeWithRetry(env, contexto, {run:opciones.run || llamarXai});
  const fuentesPublicas = fuentes.map(f => ({url:f.url, tipo:f.tipo, titulo:f.titulo}));
  if (r?.narrative) return {estado:'completo', motivo:'', datos:r.narrative, fuentes:fuentesPublicas, avisos, intentos:r.attempts || 1, ms:Date.now() - inicio, modelo:env.XAI_TEXT_MODEL || 'grok-4.5'};
  return {estado:'pendiente', motivo:MOTIVOS_ESTUDIO[r?.reason] || 'la síntesis con IA no estuvo disponible', datos:estudioPendiente(nombre), fuentes:fuentesPublicas, avisos, intentos:r?.attempts || 1, ms:Date.now() - inicio, modelo:''};
}
