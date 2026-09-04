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
export const SERVER_INFO = { name: 'admiranext-generador-presentaciones', version: '1.0.0' };
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
- help — esta ayuda (tema opcional: crear · presentaciones · versiones · permisos).
- list_presentations — presentaciones existentes (slug, nombre, web, idiomas, entregables).
- list_decks — packs de deck (antes/después) disponibles para create_presentation.
- get_presentation {client} — contenido vivo de una presentación (láminas, idiomas, secuencia).
- create_presentation {displayName, website, problem, audience, …} — crea (o regenera con
  overwrite:true) una presentación. Devuelve slug, contraseña y URLs.
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
4. presentation_urls → compartir la URL y la contraseña con el cliente.`;

const HELP_TOPICS = {
  crear: `create_presentation — campos:
- displayName (obligatorio): nombre del cliente. slug (opcional): identificador de URL.
- website (obligatorio para el logo): web oficial. inspirationUrl (opcional): otra dirección de arte.
- problem: problema que resolvemos. audience: a quién se la presentamos. objective: objetivo de la reunión. title: título principal.
- languages: ['es','en',…] (es y en siempre). outputs: entregables (por defecto los del generador).
- password: ≥10 caracteres (si no, la genera). overwrite:true para regenerar una existente.
- embeds: [{url,title}] webs que se muestran vivas dentro del deck (máx. 5, https).
- beforeDeck / afterDeck: packs de list_decks. primaryColor / accentColor: hex.`,
  presentaciones: 'list_presentations devuelve slug, displayName, website, idiomas y entregables. get_presentation {client} devuelve el contenido vivo (content-data). La URL privada es /presentaciones/<slug>/ y pide la contraseña del cliente o una cuenta con acceso.',
  versiones: 'Cada guardado o regeneración captura una versión. list_versions {client} las lista (id, motivo, fecha). restore_version {client,id} vuelve a esa versión y devuelve la lista actualizada.',
  permisos: 'El token va ligado a un usuario de /usuarios. admin → owner (todo), editor → crear/regenerar/restaurar, viewer → solo lectura. Revocar el token o dar de baja al usuario corta el acceso al instante.'
};

export const TOOLS = [
  { name: 'help', description: 'Ayuda del Generador de Presentaciones y de este MCP. `tema` opcional: crear, presentaciones, versiones, permisos.', inputSchema: { type: 'object', properties: { tema: { type: 'string', description: 'crear · presentaciones · versiones · permisos' } } } },
  { name: 'list_presentations', description: 'Presentaciones existentes con slug, nombre, web, idiomas y entregables.', inputSchema: { type: 'object', properties: {} } },
  { name: 'list_decks', description: 'Packs de deck (antes/después) disponibles para create_presentation.', inputSchema: { type: 'object', properties: {} } },
  { name: 'get_presentation', description: 'Contenido vivo de una presentación (láminas, idiomas, secuencia).', inputSchema: { type: 'object', properties: { client: { type: 'string', description: 'slug de la presentación' } }, required: ['client'] } },
  { name: 'create_presentation', description: 'Crea (o regenera con overwrite:true) una presentación a partir de cliente, web oficial, problema y audiencia. Devuelve slug, contraseña y URLs.', inputSchema: { type: 'object', properties: {
    displayName: { type: 'string' }, slug: { type: 'string' }, website: { type: 'string' }, inspirationUrl: { type: 'string' }, problem: { type: 'string' }, audience: { type: 'string' }, objective: { type: 'string' }, title: { type: 'string' }, summary: { type: 'string' },
    languages: { type: 'array', items: { type: 'string' } }, outputs: { type: 'array', items: { type: 'string' } }, password: { type: 'string' }, overwrite: { type: 'boolean' },
    embeds: { type: 'array', items: { type: 'object', properties: { url: { type: 'string' }, title: { type: 'string' } } } }, beforeDeck: { type: 'string' }, afterDeck: { type: 'string' }, primaryColor: { type: 'string' }, accentColor: { type: 'string' } }, required: ['displayName'] } },
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
      for (const key of ['displayName', 'slug', 'website', 'inspirationUrl', 'problem', 'audience', 'objective', 'title', 'summary', 'languages', 'outputs', 'password', 'overwrite', 'embeds', 'beforeDeck', 'afterDeck', 'primaryColor', 'accentColor']) if (a[key] !== undefined) body[key] = a[key];
      const out = await callGenerator(ctx, 'PUT', '/presentaciones/api/generate', body);
      return { ...out, urls: out && out.slug ? urlsFor(out.slug) : undefined };
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
        instructions: 'Generador de Presentaciones de AdmiraNeXT. Empieza por la tool help. Cada tool envuelve una API del generador con los permisos del dueño del token (directorio /usuarios).' });
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
