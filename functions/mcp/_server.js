/*
 * MCP del Generador de Presentaciones — servidor Streamable HTTP en admiranext.com/mcp.
 * (0558 · 2026-09-04 · «crea el mcp y el help del generador para que los consejeros
 * lo puedan utilizar»).
 *
 * Principio (Carlos, 21-jun-2026): cada proyecto expone su MCP, al día con sus
 * capacidades, para que silicio y carbono se conecten. Este no reimplementa nada:
 * cada tool envuelve una API que el generador ya tiene, llamándola en el mismo
 * origen con una sesión de directorio de 5 minutos emitida para el dueño del token.
 * Así el MCP tiene EXACTAMENTE los permisos que /usuarios da a esa persona: admin →
 * owner, editor → editor, viewer → solo lectura; baja o revocación → 401 al instante.
 */

import { generatorAccess, makeSessionToken } from '../presentaciones/_directory.js';
import { bearerOf, tokenRow } from './_tokens.js';

export const SITE = 'https://www.admiranext.com';
export const SERVER_INFO = { name: 'admiranext-generador-presentaciones', version: '1.1.0' };
export const PROTOCOL = '2025-06-18';
const SESSION_SECONDS = 300;

export const HELP = `# Generador de Presentaciones · MCP (admiranext.com)

De un cliente y un problema a una presentación viva: el generador crea el portal privado
del cliente (/presentaciones/<slug>), su contraseña, el esqueleto editable, el site
navegable y los entregables, en castellano e inglés como mínimo.

## Conectar
- Endpoint: ${SITE}/mcp  (JSON-RPC 2.0, Streamable HTTP; responde JSON o SSE según Accept)
- Cabecera: Authorization: Bearer anmcp_…  (token personal, lo crea un admin en /usuarios → Tokens MCP)
- Ayuda para humanos: ${SITE}/mcp/generador

## Tools
- help — esta ayuda (tema opcional: crear · presentaciones · versiones · permisos · informes).
- list_presentations — presentaciones existentes (slug, nombre, web, idiomas, entregables).
- list_decks — packs de deck (antes/después) disponibles para create_presentation.
- get_presentation {client} — contenido vivo de una presentación (láminas, idiomas, secuencia).
- create_presentation {displayName, website, problem, audience, …} — crea (o regenera con
  overwrite:true) una presentación. Devuelve slug, contraseña y URLs.
- create_yokup_report {mision, titulo, resumen, …} — crea una sala-informe Yokup (GOOD/BETTER/BEST)
  a partir del cierre de una misión FLT. Devuelve slug, pass, URLs y el bloque listo para yokup_informe.
- generation_status {client} — estado de la generación en curso (idiomas × entregables).
- list_versions {client} — historial de versiones. restore_version {client,id} — restaurar.
- presentation_urls {client} — URLs de la presentación, de la sala y de las versiones.

## Permisos
El token hereda el rol del directorio: admin → todo; editor → crear, regenerar y
restaurar; viewer → solo listar y leer. Sin usuario activo o sin el proyecto
«generador-de-presentaciones», el MCP responde 401.

## Flujo típico de un consejero
1. list_presentations → ¿ya existe el cliente?
2. create_presentation con nombre, web oficial, problema y a quién se presenta.
3. generation_status hasta que todos los entregables estén «done».
4. presentation_urls → compartir la URL y la contraseña con el cliente.

## Flujo informe Yokup (norma 22)
1. create_yokup_report con mision FLT-…, titulo, resumen, verificado (y opcional tiempo/puntos/total).
2. Abre la sala con ?quality=best (vídeo en movimiento si videoUrl / figura + tipografía) o better (fondos).
3. Captura evidencia escritorio → yokup_evidencia.
4. Cierra con yokup_informe pegando la URL+pass de la sala (el generador es el informe completo).`;

const HELP_TOPICS = {
  crear: `create_presentation — campos:
- displayName (obligatorio): nombre del cliente. slug (opcional): identificador de URL.
- website (obligatorio para el logo): web oficial. inspirationUrl (opcional): otra dirección de arte.
- problem: problema que resolvemos. audience: a quién se la presentamos. objective: objetivo de la reunión. title: título principal.
- languages: ['es','en',…] (es y en siempre). outputs: entregables (por defecto los del generador).
- password: ≥10 caracteres (si no, la genera). overwrite:true para regenerar una existente.
- embeds: [{url,title}] webs que se muestran vivas dentro del deck (máx. 5, https).
- beforeDeck / afterDeck: packs de list_decks. primaryColor / accentColor: hex.
- slideMedia: array de medios por lámina (type video puede usar HTTPS flota admira.live /assets/…).`,
  presentaciones: 'list_presentations devuelve slug, displayName, website, idiomas y entregables. get_presentation {client} devuelve el contenido vivo (content-data). La URL privada es /presentaciones/<slug>/ y pide la contraseña del cliente o una cuenta con acceso.',
  versiones: 'Cada guardado o regeneración captura una versión. list_versions {client} las lista (id, motivo, fecha). restore_version {client,id} vuelve a esa versión y devuelve la lista actualizada.',
  permisos: 'El token va ligado a un usuario de /usuarios. admin → owner (todo), editor → crear/regenerar/restaurar, viewer → solo lectura. Revocar el token o dar de baja al usuario corta el acceso al instante.',
  informes: `create_yokup_report — convierte el generador de presentaciones en el informe vivo de Yokup (más completo que texto plano).
Campos:
- mision (obligatorio): FLT-1234 o FLT-100235.
- titulo (obligatorio): asunto del informe / displayName.
- resumen (obligatorio): qué se hizo (alimenta problem/summary del deck).
- verificado (recomendado): cómo se comprobó (evidencia, URL, criterio).
- tiempo / puntos / total (opcionales): líneas de la norma 22.
- website (opcional, default https://www.yokup.com).
- password / overwrite / qualityHint (opcionales). qualityHint: good|better|best (default best).
- videoUrl (opcional): HTTPS MP4 de flota (p.ej. https://www.admira.live/assets/mouth-v2/boca-v2-ciclo.mp4) → slideMedia vídeo en BEST.
- videoSlide (opcional, default cover): lámina que lleva el vídeo.
Devuelve: slug, password, urls (sala con ?quality=…), yokupBlock (texto listo para yokup_informe).
Gesto consejero: create_yokup_report (+videoUrl) → sala ?quality=best (motion) → yokup_evidencia → yokup_informe.`
};

export const TOOLS = [
  { name: 'help', description: 'Ayuda del Generador de Presentaciones / informes Yokup y de este MCP. `tema` opcional: crear, presentaciones, versiones, permisos, informes.', inputSchema: { type: 'object', properties: { tema: { type: 'string', description: 'crear · presentaciones · versiones · permisos · informes' } } } },
  { name: 'list_presentations', description: 'Presentaciones existentes con slug, nombre, web, idiomas y entregables.', inputSchema: { type: 'object', properties: {} } },
  { name: 'list_decks', description: 'Packs de deck (antes/después) disponibles para create_presentation.', inputSchema: { type: 'object', properties: {} } },
  { name: 'get_presentation', description: 'Contenido vivo de una presentación (láminas, idiomas, secuencia).', inputSchema: { type: 'object', properties: { client: { type: 'string', description: 'slug de la presentación' } }, required: ['client'] } },
  { name: 'create_presentation', description: 'Crea (o regenera con overwrite:true) una presentación a partir de cliente, web oficial, problema y audiencia. Devuelve slug, contraseña y URLs.', inputSchema: { type: 'object', properties: {
    displayName: { type: 'string' }, slug: { type: 'string' }, website: { type: 'string' }, inspirationUrl: { type: 'string' }, problem: { type: 'string' }, audience: { type: 'string' }, objective: { type: 'string' }, title: { type: 'string' }, summary: { type: 'string' },
    languages: { type: 'array', items: { type: 'string' } }, outputs: { type: 'array', items: { type: 'string' } }, password: { type: 'string' }, overwrite: { type: 'boolean' },
    embeds: { type: 'array', items: { type: 'object', properties: { url: { type: 'string' }, title: { type: 'string' } } } }, beforeDeck: { type: 'string' }, afterDeck: { type: 'string' }, primaryColor: { type: 'string' }, accentColor: { type: 'string' }, slideMedia: { type: 'array', description: 'Medios por lámina (image/video/audio/animation) con rights' } }, required: ['displayName'] } },
  { name: 'create_yokup_report', description: 'Crea una sala-informe Yokup (presentación completa GOOD/BETTER/BEST) a partir de una misión FLT. Opcional videoUrl (MP4 flota) para BEST en movimiento. Devuelve URLs, pass y bloque para yokup_informe.', inputSchema: { type: 'object', properties: {
    mision: { type: 'string', description: 'FLT-…' }, titulo: { type: 'string' }, resumen: { type: 'string' }, verificado: { type: 'string' },
    tiempo: { type: 'string' }, puntos: { type: 'string' }, total: { type: 'string' },
    website: { type: 'string' }, password: { type: 'string' }, overwrite: { type: 'boolean' },
    qualityHint: { type: 'string', description: 'good | better | best (default best)' }, slug: { type: 'string' },
    videoUrl: { type: 'string', description: 'HTTPS MP4 de flota (admira.live /assets/…) para BEST en movimiento' },
    videoSlide: { type: 'string', description: 'Lámina del vídeo (default cover)' }
  }, required: ['mision', 'titulo', 'resumen'] } },
  { name: 'generation_status', description: 'Estado de la generación (idiomas × entregables) de una presentación.', inputSchema: { type: 'object', properties: { client: { type: 'string' } }, required: ['client'] } },
  { name: 'list_versions', description: 'Historial de versiones de una presentación.', inputSchema: { type: 'object', properties: { client: { type: 'string' } }, required: ['client'] } },
  { name: 'restore_version', description: 'Restaura una versión de una presentación.', inputSchema: { type: 'object', properties: { client: { type: 'string' }, id: { type: 'string' } }, required: ['client', 'id'] } },
  { name: 'presentation_urls', description: 'URLs de la presentación, la sala de presentación y el historial.', inputSchema: { type: 'object', properties: { client: { type: 'string' } }, required: ['client'] } }
];

const READ_ONLY = new Set(['help', 'list_presentations', 'list_decks', 'get_presentation', 'generation_status', 'list_versions', 'presentation_urls']);

function slug(value){
  const s = String(value == null ? '' : value).trim().toLowerCase();
  if (!/^[a-z0-9][a-z0-9-]{1,62}$/.test(s)) throw new Error('client no válido: usa el slug de la presentación (list_presentations).');
  return s;
}

export function urlsFor(client){
  const c = slug(client);
  return { presentacion: `${SITE}/presentaciones/${c}/`, sala: `${SITE}/presentaciones/${c}/presentacion`, versiones: `${SITE}/presentaciones/${c}/versiones`, ideas: `${SITE}/presentaciones/${c}/ideas`, galeria: `${SITE}/presentaciones/galeria` };
}

/** Llama a una API del generador en el mismo origen con la sesión de directorio del dueño del token. */
async function callGenerator(ctx, method, path, body){
  const token = await makeSessionToken(ctx.env.PRES_SIGNING_KEY, ctx.access, SESSION_SECONDS);
  const headers = { cookie: `pres_owner=${token}`, origin: SITE, accept: 'application/json', 'user-agent': 'admiranext-mcp/1.0' };
  if (body !== undefined) headers['content-type'] = 'application/json';
  const response = await ctx.fetchImpl(SITE + path, { method, headers, body: body === undefined ? undefined : JSON.stringify(body), redirect: 'manual' });
  const text = await response.text();
  let data = null; try { data = JSON.parse(text); } catch (_) { data = null; }
  if (response.status === 401 || response.status === 303) throw new Error(`el generador no ha aceptado la sesión (${response.status}): tu usuario no tiene acceso a ${path}`);
  if (!response.ok) throw new Error((data && (data.error || data.message)) || `HTTP ${response.status} en ${path}`);
  return data == null ? { raw: text.slice(0, 4000) } : data;
}

export async function callTool(ctx, name, args = {}){
  const a = args || {};
  if (!TOOLS.some(t => t.name === name)) throw new Error(`Tool desconocida: ${name}. Usa tools/list o help.`);
  if (!READ_ONLY.has(name) && ctx.access.level === 'viewer') throw new Error(`Tu rol (viewer) es de solo lectura: ${name} requiere editor o admin en /usuarios.`);
  switch (name) {
    case 'help': {
      const tema = String(a.tema || '').toLowerCase().trim();
      return { help: tema && HELP_TOPICS[tema] ? HELP_TOPICS[tema] : HELP, temas: Object.keys(HELP_TOPICS), usuario: ctx.access.email, rol: ctx.access.level };
    }
    case 'list_presentations': return callGenerator(ctx, 'GET', '/presentaciones/api/clients');
    case 'list_decks': return callGenerator(ctx, 'GET', '/presentaciones/api/decks');
    case 'get_presentation': return callGenerator(ctx, 'GET', `/presentaciones/${slug(a.client)}/content-data`);
    case 'create_presentation': {
      if (!String(a.displayName || '').trim()) throw new Error('displayName es obligatorio.');
      const body = {};
      for (const key of ['displayName', 'slug', 'website', 'inspirationUrl', 'problem', 'audience', 'objective', 'title', 'summary', 'languages', 'outputs', 'password', 'overwrite', 'embeds', 'beforeDeck', 'afterDeck', 'primaryColor', 'accentColor', 'slideMedia']) if (a[key] !== undefined) body[key] = a[key];
      const out = await callGenerator(ctx, 'PUT', '/presentaciones/api/generate', body);
      return { ...out, urls: out && out.slug ? urlsFor(out.slug) : undefined };
    }
    case 'create_yokup_report': {
      const mision = String(a.mision || '').trim().toUpperCase();
      if (!/^FLT-\d+$/.test(mision)) throw new Error('mision debe ser FLT-… (ej. FLT-100235).');
      const titulo = String(a.titulo || '').trim();
      const resumen = String(a.resumen || '').trim();
      if (!titulo || !resumen) throw new Error('titulo y resumen son obligatorios.');
      const verificado = String(a.verificado || '').trim();
      const tiempo = String(a.tiempo || '').trim();
      const puntos = String(a.puntos || '').trim();
      const total = String(a.total || '').trim();
      const qualityHint = ['good', 'better', 'best'].includes(String(a.qualityHint || '').toLowerCase()) ? String(a.qualityHint).toLowerCase() : 'best';
      const digits = mision.replace(/\D/g, '');
      const reportSlug = String(a.slug || `yokup-${mision.toLowerCase()}`).trim().toLowerCase();
      const password = String(a.password || '').trim() || `yokupInforme${digits.slice(-6) || '26'}`;
      if (password.length < 10) throw new Error('password debe tener ≥10 caracteres.');
      const norma = [
        tiempo ? `Tiempo dedicado: ${tiempo}` : '',
        puntos ? `Puntos de la misión: ${puntos}` : '',
        total ? `Total verificado: ${total}` : ''
      ].filter(Boolean).join('\n');
      const problem = `Informe Yokup ${mision}. ${resumen}${verificado ? ` Verificado: ${verificado}.` : ''}`;
      const summary = `${mision} · ${titulo}. ${resumen}${norma ? ` ${norma.replace(/\n/g, ' · ')}` : ''} Abrir en quality=${qualityHint}.`;
      const videoUrl = String(a.videoUrl || '').trim();
      const videoSlide = String(a.videoSlide || 'cover').trim().toLowerCase() || 'cover';
      const body = {
        displayName: `Yokup ${mision} · ${titulo}`.slice(0, 120),
        slug: reportSlug,
        website: String(a.website || 'https://www.yokup.com').trim() || 'https://www.yokup.com',
        problem,
        audience: 'Consejo de Silicio · Yokup (cierre de misión)',
        objective: `Cerrar ${mision} con informe vivo (sala AdmiraNeXT) y evidencia escritorio.`,
        title: titulo,
        summary,
        languages: ['es', 'en'],
        outputs: ['website', 'documents', 'backgrounds'],
        password,
        overwrite: a.overwrite === true
      };
      if (videoUrl) {
        body.slideMedia = [{
          slide: videoSlide,
          type: 'video',
          src: videoUrl,
          loop: true,
          muted: true,
          autoplay: true,
          caption: 'Resultado en movimiento',
          rights: { source: videoUrl, permission: 'owned', license: 'AdmiraNeXT fleet', holder: 'AdmiraNeXT' }
        }];
      }
      const out = await callGenerator(ctx, 'PUT', '/presentaciones/api/generate', body);
      const urls = out && out.slug ? urlsFor(out.slug) : undefined;
      const salaQuality = urls ? `${urls.sala}?quality=${qualityHint}&lang=es` : undefined;
      const yokupBlock = [
        `Informe vivo ${mision}: ${titulo}`,
        resumen,
        verificado ? `Verificado: ${verificado}` : '',
        norma,
        videoUrl ? `Vídeo BEST: ${videoUrl} (lámina ${videoSlide})` : '',
        salaQuality ? `Sala: ${salaQuality}` : '',
        `Pass: ${out && out.password ? out.password : password}`,
        videoUrl
          ? 'Calidad recomendada: BEST (vídeo en movimiento) · BETTER (fondos) · GOOD (texto limpio).'
          : 'Calidad recomendada: BEST (figura descriptiva) · BETTER (fondos) · GOOD (texto limpio).'
      ].filter(Boolean).join('\n');
      return { ...out, kind: 'yokup-report', mision, qualityHint, urls: urls ? { ...urls, salaQuality } : undefined, yokupBlock };
    }
    case 'generation_status': return callGenerator(ctx, 'GET', `/presentaciones/${slug(a.client)}/api/generation`);
    case 'list_versions': return callGenerator(ctx, 'GET', `/presentaciones/${slug(a.client)}/api/versions`);
    case 'restore_version': {
      if (!String(a.id || '').trim()) throw new Error('id de versión obligatorio (list_versions).');
      return callGenerator(ctx, 'POST', `/presentaciones/${slug(a.client)}/api/versions`, { id: String(a.id) });
    }
    case 'presentation_urls': return urlsFor(a.client);
  }
  throw new Error('Tool no implementada.');
}

export function rpcResult(id, result){ return { jsonrpc: '2.0', id: id == null ? null : id, result }; }
export function rpcError(id, code, message){ return { jsonrpc: '2.0', id: id == null ? null : id, error: { code, message } }; }

/** Un mensaje JSON-RPC → respuesta (o null si era notificación). ctx.access puede ser null (sin token). */
export async function handleRpc(ctx, msg){
  const { id, method, params } = msg || {};
  switch (method) {
    case 'initialize':
      return rpcResult(id, { protocolVersion: (params && params.protocolVersion) || PROTOCOL, capabilities: { tools: { listChanged: false } }, serverInfo: SERVER_INFO,
        instructions: 'Generador de Presentaciones e informes Yokup de AdmiraNeXT. Empieza por help (tema informes para cierres FLT). Cada tool envuelve una API del generador con los permisos del dueño del token (directorio /usuarios).' });
    case 'notifications/initialized':
    case 'notifications/cancelled':
      return null;
    case 'ping': return rpcResult(id, {});
    case 'tools/list': return rpcResult(id, { tools: TOOLS });
    case 'tools/call': {
      const name = params && params.name;
      if (!ctx.access) return rpcResult(id, { content: [{ type: 'text', text: 'Falta un token MCP válido. Cabecera Authorization: Bearer anmcp_… (lo crea un admin en /usuarios → Tokens MCP). Sin token solo funcionan initialize, tools/list y help.' }], isError: name !== 'help' });
      try {
        const out = await callTool(ctx, name, (params && params.arguments) || {});
        const text = typeof out === 'string' ? out : JSON.stringify(out, null, 2);
        return rpcResult(id, { content: [{ type: 'text', text }], structuredContent: typeof out === 'object' && out ? out : undefined, isError: false });
      } catch (e) {
        return rpcResult(id, { content: [{ type: 'text', text: `Error: ${e && e.message || e}` }], isError: true });
      }
    }
    default:
      return rpcError(id, -32601, `Método no soportado: ${method}`);
  }
}

/** Resuelve el acceso del token de la petición: null si no hay token o no entra. */
export async function accessFromRequest(env, request, waitUntil){
  const token = bearerOf(request);
  if (!token) return { access: null, reason: 'sin token' };
  const row = await tokenRow(env, token, waitUntil);
  if (!row) return { access: null, reason: 'token desconocido o revocado' };
  const access = await generatorAccess(env, { email: row.email });
  if (!access) return { access: null, reason: `el usuario ${row.email} no tiene acceso al generador (activo + proyecto generador-de-presentaciones)` };
  return { access: { ...access, tokenLabel: row.label || '' }, reason: '' };
}

export function wantsSse(request){ return /text\/event-stream/i.test(request.headers.get('Accept') || ''); }

export function encodeResponse(payload, sse){
  if (sse) return new Response(`event: message\ndata: ${JSON.stringify(payload)}\n\n`, { status: 200, headers: { 'content-type': 'text/event-stream', 'cache-control': 'no-cache, no-transform' } });
  return new Response(JSON.stringify(payload), { status: 200, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' } });
}
