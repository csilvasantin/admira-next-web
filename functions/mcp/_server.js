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
import { FLEET_EXAMPLE_VIDEO, exampleVideoEntry, ensureExampleVideo, wantsExampleVideo } from '../presentaciones/_slide-media.js';

export const SITE = 'https://www.admiranext.com';
export const SERVER_INFO = { name: 'admiranext-generador-presentaciones', version: '1.5.0' };
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
- help — esta ayuda (tema opcional: crear · presentaciones · versiones · permisos · informes · catalogo · demo).
- list_presentations / get_catalog — catálogo vivo (GET /presentaciones/api/clients): slug, nombre, web, idiomas, outputs, passwordSet, versionCount, updatedAt…
- list_decks — packs de deck (antes/después) disponibles para create_presentation.
- get_presentation {client} — contenido vivo de una presentación (láminas, idiomas, secuencia).
- create_presentation {displayName, website, problem, audience, budgetLines?, …} — crea o mejora (overwrite:true)
  una presentación. Antes: list_presentations. Un cliente = un slug. budgetLines opcional: valoración económica al final de la sala.
- create_yokup_report {mision, titulo, resumen, cliente|client|slug, …} — mejora en sitio el informe
  Yokup del cliente (overwrite:true por defecto si existe). Nunca slug yokup-flt-…. Un cliente = un slug.
- generation_status {client} — estado de la generación en curso (idiomas × entregables).
- list_versions {client} — historial de versiones. restore_version {client,id} — restaurar.
- presentation_urls {client} — URLs de la presentación, de la sala y de las versiones.
- delete_slide {client, blockId} — quita una lámina del esqueleto sin regenerar el deck (misma API que Ctrl+E → Eliminar / Ctrl+Backspace en la sala).

## Permisos
El token hereda el rol del directorio: admin → todo; editor → crear, regenerar y
restaurar; viewer → solo listar y leer. Sin usuario activo o sin el proyecto
«generador-de-presentaciones», el MCP responde 401.

## Flujo típico de un consejero (gesto catálogo)
1. list_presentations (o get_catalog) → catálogo: ¿ya existe el cliente? (un cliente = un slug).
2. Si existe: create_presentation / create_yokup_report con overwrite:true (Mejorar). Si no: crear con displayName + website.
3. generation_status hasta que todos los entregables estén «done».
4. presentation_urls → compartir la URL y la contraseña con el cliente.
UI humana: /presentaciones/galeria (Registro vivo) y /presentaciones/?improve=<slug>.

## Flujo informe Yokup (norma 22)
1. list_presentations → resuelve el slug del cliente (nunca yokup-flt-…).
2. create_yokup_report con mision FLT-…, titulo, resumen, cliente/slug (o displayName) y verificado.
   Si el cliente existe → mejora in situ (overwrite:true por defecto; captura versión).
3. Abre la sala con ?quality=best (vídeo en movimiento si videoUrl / figura + tipografía) o better (fondos).
4. Captura evidencia escritorio → yokup_evidencia.
5. Cierra con yokup_informe pegando la URL+pass de la sala (el generador es el informe completo).`;

const HELP_TOPICS = {
  crear: `create_presentation — campos:
- Antes: list_presentations (censo). Un cliente = un slug. Si ya existe, usa overwrite:true para mejorar in situ (no crees otro).
- displayName (obligatorio): nombre del cliente. slug (opcional): identificador de URL.
- website (obligatorio para el logo): web oficial. inspirationUrl (opcional): otra dirección de arte.
- problem: problema que resolvemos. audience: a quién se la presentamos. objective: objetivo de la reunión. title: título principal.
- languages: ['es','en',…] (es y en siempre). outputs: entregables (por defecto los del generador).
- password: ≥10 caracteres (si no, la genera). overwrite:true para regenerar / mejorar una existente.
- embeds: [{url,title}] webs que se muestran vivas dentro del deck (máx. 5, https).
- beforeDeck / afterDeck: packs de list_decks. primaryColor / accentColor: hex.
- slideMedia: array de medios por lámina (type video puede usar HTTPS flota admira.live /assets/…).
- Norma vídeo (FLT-100315): si outputs incluye video, hay TikTok, o includeExampleVideo:true, el create inyecta un MP4 REAL de flota (no placeholder). Campos: exampleVideoUrl / videoUrl / videoSlide / includeExampleVideo. Default: https://www.admira.live/assets/mouth-v2/boca-v2-ciclo.mp4
- Demo captura (FLT-100316): demoVideo:true o requireExampleVideo:true EXIGEN videoUrl (captura hospedada). videoSlide recomendado: closing. Ver help tema demo.
- budgetLines (opcional): [{concept, price, discount, iva}] valoración económica como ÚLTIMA lámina de la sala (concepto, precio, dto %, IVA %, importe recalculado). Máx. 40 partidas. No es un ERP. Si omites el campo al mejorar, se conserva el presupuesto anterior; [] lo vacía.
- delete_slide {client, blockId}: quita una lámina del esqueleto sin regenerar. En sala: Ctrl+E → botón Eliminar o Ctrl+Backspace.`,
  presentaciones: 'list_presentations / get_catalog es el catálogo vivo (GET /presentaciones/api/clients): slug, displayName, website, languages, outputs, passwordSet, versionCount, createdAt, updatedAt. get_presentation {client} devuelve el contenido vivo (content-data). La URL privada es /presentaciones/<slug>/ y pide la contraseña del cliente o una cuenta con acceso. UI: /presentaciones/galeria.',
  catalogo: `Catálogo = gesto principal (como el registro de proyectos del webmaster).
list_presentations IS the catalog (alias get_catalog). Campos: slug, displayName, website, languages, outputs, passwordSet (sí/no, nunca la clave), versionCount, createdAt, updatedAt.
Gesto del consejero:
1. list_presentations / get_catalog → localiza el cliente.
2. list_versions {client} si necesitas historial (también en la ficha del Registro vivo).
3. create_presentation o create_yokup_report con overwrite:true para Mejorar in situ. Un cliente = un slug.
4. presentation_urls → sala / versiones / portal.
UI: /presentaciones/galeria (Registro vivo + ficha) · /presentaciones/?improve=<slug> (generador en modo Mejorar).
No crees un slug nuevo por misión Yokup.`,
  versiones: 'Cada guardado o regeneración captura una versión. list_versions {client} las lista (id, motivo, fecha). restore_version {client,id} vuelve a esa versión y devuelve la lista actualizada.',
  permisos: 'El token va ligado a un usuario de /usuarios. admin → owner (todo), editor → crear/regenerar/restaurar, viewer → solo lectura. Revocar el token o dar de baja al usuario corta el acceso al instante.',
  informes: `create_yokup_report — informe vivo Yokup: mejora la presentación del cliente in situ (no crea un yokup-flt-… por misión).
Un cliente = un slug. Censo: list_presentations.
Campos:
- mision (obligatorio): FLT-1234 o FLT-100257.
- titulo / resumen (obligatorios). FLT va en title/summary/problem; displayName permanece el del cliente.
- cliente | client | slug (muy recomendado): slug existente o displayName a resolver.
- displayName (opcional): nombre del cliente; obligatorio al crear la primera vez si no hay cliente.
- verificado / tiempo / puntos / total (opcionales, norma 22).
- website (opcional; al mejorar conserva el del cliente si no se pasa; al crear default https://www.yokup.com).
- password (opcional): al mejorar, si no se pasa se conserva la existente.
- overwrite (opcional): por defecto true si el cliente ya existe. Si false y existe → error claro (usa overwrite/improve).
- forceNew (opcional, desaconsejado): solo true permite crear un slug nuevo en vez de mejorar el existente.
- qualityHint: good|better|best (default best). videoUrl / exampleVideoUrl / videoSlide / includeExampleVideo.
- budgetLines (opcional): [{concept, price, discount, iva}] presupuesto al final de la sala. Si omites, se conserva; [] vacía. No es un ERP.
- Norma vídeo: si pasas videoUrl, exampleVideoUrl o includeExampleVideo, BEST lleva un MP4 real de flota (default boca-v2). No uses texto placeholder.
Resolución: GET clients → match slug exacto (ci) o displayName (ci) → improve con overwrite:true.
Sin match → slugify(displayName||cliente), NUNCA yokup-flt-<misión>.
Devuelve: kind, mode improved|created, mision, slug, urls, yokupBlock, previous?
Gesto: list_presentations → create_yokup_report(cliente=…) → sala ?quality=best → yokup_evidencia → yokup_informe.
Demo completa (FLT-100316): si la demo es parte del informe, graba la captura, súbela a admira.live/assets/… o /presentaciones/<slug>/media/, y pasa videoUrl (+ videoSlide closing). Con demoVideo:true o requireExampleVideo:true el tool RECHAZA sin videoUrl — no uses placeholder ni abras admira.app en la sala.`
,
  demo: `Gesto DEMO en vídeo (FLT-100316) — la demo completa termina como MP4 embebido en la sala; el consejero NO abre admira.app / Tour DOOH en la reunión.

1. Graba la demo en vivo (Tour DOOH en admira.app, player, etc.): OBS, ffmpeg o screen record del box.
2. Hostea el MP4:
   - Flota: https://www.admira.live/assets/<ruta>/<clip>.mp4
   - O privado: /presentaciones/<slug>/media/<clip>.mp4
3. create_presentation o create_yokup_report con:
   - videoUrl: URL HTTPS del MP4 (obligatorio si demoVideo:true o requireExampleVideo:true)
   - videoSlide: closing | cover | clave de lámina demo (recomendado closing)
   - Opcional: demoVideo:true / requireExampleVideo:true (rechaza sin videoUrl)
4. Abre la sala ?quality=best — BEST muestra el motion embebido. Sin abrir la plataforma.

Stand-in de flota (smoke): https://www.admira.live/assets/mouth-v2/boca-v2-ciclo.mp4
Doc: /mcp/GESTO-DEMO-VIDEO.md · help tema demo.`
};

export const TOOLS = [
  { name: 'help', description: 'Ayuda del Generador de Presentaciones / informes Yokup y de este MCP. `tema` opcional: crear, presentaciones, versiones, permisos, informes, catalogo, demo.', inputSchema: { type: 'object', properties: { tema: { type: 'string', description: 'crear · presentaciones · versiones · permisos · informes · catalogo · demo' } } } },
  { name: 'list_presentations', description: 'Catálogo / censo vivo (slug, displayName, website, languages, outputs, passwordSet, versionCount, updatedAt…). Consulta antes de crear o mejorar.', inputSchema: { type: 'object', properties: {} } },
  { name: 'get_catalog', description: 'Alias de list_presentations: el catálogo es el gesto principal. Mismos campos.', inputSchema: { type: 'object', properties: {} } },
  { name: 'list_decks', description: 'Packs de deck (antes/después) disponibles para create_presentation.', inputSchema: { type: 'object', properties: {} } },
  { name: 'get_presentation', description: 'Contenido vivo de una presentación (láminas, idiomas, secuencia).', inputSchema: { type: 'object', properties: { client: { type: 'string', description: 'slug de la presentación' } }, required: ['client'] } },
  { name: 'create_presentation', description: 'Crea o mejora (overwrite:true) una presentación. Antes: list_presentations. Un cliente = un slug. Devuelve slug, contraseña y URLs.', inputSchema: { type: 'object', properties: {
    displayName: { type: 'string' }, slug: { type: 'string' }, website: { type: 'string' }, inspirationUrl: { type: 'string' }, problem: { type: 'string' }, audience: { type: 'string' }, objective: { type: 'string' }, title: { type: 'string' }, summary: { type: 'string' },
    languages: { type: 'array', items: { type: 'string' } }, outputs: { type: 'array', items: { type: 'string' } }, password: { type: 'string' }, overwrite: { type: 'boolean', description: 'true para mejorar una presentación existente in situ' },
    embeds: { type: 'array', items: { type: 'object', properties: { url: { type: 'string' }, title: { type: 'string' } } } }, beforeDeck: { type: 'string' }, afterDeck: { type: 'string' }, primaryColor: { type: 'string' }, accentColor: { type: 'string' }, slideMedia: { type: 'array', description: 'Medios por lámina (image/video/audio/animation) con rights' },
    exampleVideoUrl: { type: 'string', description: 'HTTPS MP4 de flota (admira.live /assets/…) para BEST en movimiento' },
    videoUrl: { type: 'string', description: 'Alias de exampleVideoUrl' },
    videoSlide: { type: 'string', description: 'Lámina del vídeo (default cover)' },
    includeExampleVideo: { type: 'boolean', description: 'Inyecta ejemplo vídeo de flota si no hay slideMedia video. También se inyecta si outputs incluye video.' },
    demoVideo: { type: 'boolean', description: 'FLT-100316: demo completa como captura embebida; exige videoUrl (rechaza sin él)' },
    requireExampleVideo: { type: 'boolean', description: 'Alias de demoVideo: exige videoUrl / exampleVideoUrl explícito' },
    budgetLines: { type: 'array', description: 'Valoración económica al final de la sala (concepto, precio, dto %, IVA %). No es un ERP.', items: { type: 'object', properties: { concept: { type: 'string' }, price: { type: 'number' }, discount: { type: 'number' }, iva: { type: 'number' } } } } }, required: ['displayName'] } },
  { name: 'create_yokup_report', description: 'Mejora in situ el informe Yokup del cliente (overwrite:true si existe). Resuelve por cliente/client/slug o displayName. Nunca crea yokup-flt-…. forceNew solo si hace falta un slug nuevo (desaconsejado).', inputSchema: { type: 'object', properties: {
    mision: { type: 'string', description: 'FLT-…' }, titulo: { type: 'string' }, resumen: { type: 'string' }, verificado: { type: 'string' },
    tiempo: { type: 'string' }, puntos: { type: 'string' }, total: { type: 'string' },
    cliente: { type: 'string', description: 'slug o displayName del cliente (preferido)' }, client: { type: 'string', description: 'alias de cliente' }, slug: { type: 'string', description: 'slug existente o a usar' },
    displayName: { type: 'string', description: 'nombre del cliente; obligatorio al crear la primera vez' },
    website: { type: 'string' }, password: { type: 'string' }, overwrite: { type: 'boolean', description: 'default true si el cliente existe; false + existe → error' },
    forceNew: { type: 'boolean', description: 'solo true permite crear un slug nuevo (desaconsejado)' },
    qualityHint: { type: 'string', description: 'good | better | best (default best)' },
    videoUrl: { type: 'string', description: 'HTTPS MP4 de flota (admira.live /assets/…) para BEST en movimiento' },
    exampleVideoUrl: { type: 'string', description: 'Alias de videoUrl (norma ejemplo vídeo)' },
    includeExampleVideo: { type: 'boolean', description: 'Si true y no hay videoUrl, inyecta el MP4 de flota boca-v2' },
    videoSlide: { type: 'string', description: 'Lámina del vídeo (default cover; para demos suele ser closing)' },
    demoVideo: { type: 'boolean', description: 'FLT-100316: exige videoUrl de la captura (no placeholder; no abrir plataforma en sala)' },
    requireExampleVideo: { type: 'boolean', description: 'Alias de demoVideo: exige videoUrl / exampleVideoUrl' },
    budgetLines: { type: 'array', description: 'Valoración económica al final de la sala. Si se omite al mejorar, se conserva.', items: { type: 'object', properties: { concept: { type: 'string' }, price: { type: 'number' }, discount: { type: 'number' }, iva: { type: 'number' } } } }
  }, required: ['mision', 'titulo', 'resumen'] } },
  { name: 'generation_status', description: 'Estado de la generación (idiomas × entregables) de una presentación.', inputSchema: { type: 'object', properties: { client: { type: 'string' } }, required: ['client'] } },
  { name: 'list_versions', description: 'Historial de versiones de una presentación.', inputSchema: { type: 'object', properties: { client: { type: 'string' } }, required: ['client'] } },
  { name: 'restore_version', description: 'Restaura una versión de una presentación.', inputSchema: { type: 'object', properties: { client: { type: 'string' }, id: { type: 'string' } }, required: ['client', 'id'] } },
  { name: 'presentation_urls', description: 'URLs de la presentación, la sala de presentación y el historial.', inputSchema: { type: 'object', properties: { client: { type: 'string' } }, required: ['client'] } },
  { name: 'delete_slide', description: 'Elimina una lámina del esqueleto (blockId) sin regenerar el deck. En sala: Ctrl+E → Eliminar o Ctrl+Backspace.', inputSchema: { type: 'object', properties: { client: { type: 'string' }, blockId: { type: 'string', description: 'id de la lámina (p.ej. problema)' }, language: { type: 'string' } }, required: ['client', 'blockId'] } }
];

const READ_ONLY = new Set(['help', 'list_presentations', 'get_catalog', 'list_decks', 'get_presentation', 'generation_status', 'list_versions', 'presentation_urls']);

function slug(value){
  const s = String(value == null ? '' : value).trim().toLowerCase();
  if (!/^[a-z0-9][a-z0-9-]{1,62}$/.test(s)) throw new Error('client no válido: usa el slug de la presentación (list_presentations).');
  return s;
}

/** Slug de alta (mismo criterio que /presentaciones/api/generate). Nunca desde FLT. */
function slugifyName(value){
  const s = String(value == null ? '' : value).trim().toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 63);
  if (s.length < 2) throw new Error('nombre de cliente no válido para slug: indica displayName o cliente.');
  return s;
}

function clientsList(data){
  if (Array.isArray(data)) return data;
  if (data && Array.isArray(data.clients)) return data.clients;
  return [];
}

function findClient(clients, hint){
  const q = String(hint || '').trim().toLowerCase();
  if (!q) return null;
  const bySlug = clients.find(c => String(c.slug || '').toLowerCase() === q);
  if (bySlug) return bySlug;
  return clients.find(c => String(c.displayName || '').toLowerCase() === q) || null;
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

/** FLT-100316: demoVideo / requireExampleVideo exigen videoUrl explícito (captura hospedada). */
function requiresDemoVideoUrl(a = {}){
  return a.demoVideo === true || a.demoVideo === 'true' || a.demoVideo === 1 || a.demoVideo === '1'
    || a.requireExampleVideo === true || a.requireExampleVideo === 'true' || a.requireExampleVideo === 1 || a.requireExampleVideo === '1';
}
function assertDemoVideoUrl(a = {}){
  if (!requiresDemoVideoUrl(a)) return;
  const url = String(a.videoUrl || a.exampleVideoUrl || '').trim();
  if (!url) {
    throw new Error('demoVideo/requireExampleVideo exige videoUrl (HTTPS admira.live/assets/… o /presentaciones/<slug>/media/). Graba la demo, súbela y pásala; no abras la plataforma en la sala. Ver help tema demo.');
  }
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
    case 'list_presentations':
    case 'get_catalog': return callGenerator(ctx, 'GET', '/presentaciones/api/clients');
    case 'list_decks': return callGenerator(ctx, 'GET', '/presentaciones/api/decks');
    case 'get_presentation': return callGenerator(ctx, 'GET', `/presentaciones/${slug(a.client)}/content-data`);
    case 'create_presentation': {
      if (!String(a.displayName || '').trim()) throw new Error('displayName es obligatorio.');
      assertDemoVideoUrl(a);
      const body = {};
      for (const key of ['displayName', 'slug', 'website', 'inspirationUrl', 'problem', 'audience', 'objective', 'title', 'summary', 'languages', 'outputs', 'password', 'overwrite', 'embeds', 'beforeDeck', 'afterDeck', 'primaryColor', 'accentColor', 'slideMedia', 'exampleVideoUrl', 'includeExampleVideo', 'videoUrl', 'videoSlide', 'demoVideo', 'requireExampleVideo', 'budgetLines']) if (a[key] !== undefined) body[key] = a[key];
      if (wantsExampleVideo(body) || requiresDemoVideoUrl(a)) body.slideMedia = ensureExampleVideo(body.slideMedia, body, body.slug || '');
      const out = await callGenerator(ctx, 'PUT', '/presentaciones/api/generate', body);
      return { ...out, urls: out && out.slug ? urlsFor(out.slug) : undefined };
    }
    case 'create_yokup_report': {
      const mision = String(a.mision || '').trim().toUpperCase();
      if (!/^FLT-\d+$/.test(mision)) throw new Error('mision debe ser FLT-… (ej. FLT-100257).');
      const titulo = String(a.titulo || '').trim();
      const resumen = String(a.resumen || '').trim();
      if (!titulo || !resumen) throw new Error('titulo y resumen son obligatorios.');
      const verificado = String(a.verificado || '').trim();
      const tiempo = String(a.tiempo || '').trim();
      const puntos = String(a.puntos || '').trim();
      const total = String(a.total || '').trim();
      const qualityHint = ['good', 'better', 'best'].includes(String(a.qualityHint || '').toLowerCase()) ? String(a.qualityHint).toLowerCase() : 'best';
      const forceNew = a.forceNew === true;
      const hint = String(a.slug || a.cliente || a.client || '').trim();
      const displayNameArg = String(a.displayName || '').trim();
      const census = clientsList(await callGenerator(ctx, 'GET', '/presentaciones/api/clients'));
      let matched = null;
      if (!forceNew) {
        if (hint) matched = findClient(census, hint);
        if (!matched && displayNameArg) matched = findClient(census, displayNameArg);
      }
      if (matched && a.overwrite === false) {
        throw new Error(`Ya existe la presentación «${matched.slug}» (${matched.displayName || matched.slug}). Para mejorar in situ pasa overwrite:true (o omite overwrite); forceNew:true solo si realmente necesitas otro slug (desaconsejado).`);
      }
      let reportSlug;
      let mode;
      let clientDisplayName;
      let overwrite;
      let previous;
      if (matched) {
        reportSlug = String(matched.slug).toLowerCase();
        mode = 'improved';
        clientDisplayName = String(matched.displayName || displayNameArg || hint || matched.slug).trim();
        overwrite = true;
        previous = { slug: matched.slug, displayName: matched.displayName || '', website: matched.website || '', updatedAt: matched.updatedAt || matched.createdAt || '' };
      } else {
        const seed = displayNameArg || hint;
        if (!seed) throw new Error('Para crear un informe nuevo indica displayName o cliente (slug/nombre). Un cliente = un slug; nunca se usa yokup-flt-<misión>. Consulta list_presentations.');
        reportSlug = slugifyName(seed);
        if (reportSlug.startsWith('yokup-flt-')) throw new Error('slug ilegal: no uses yokup-flt-…. Un cliente = un slug de cliente.');
        mode = 'created';
        clientDisplayName = displayNameArg || hint;
        overwrite = false;
      }
      const norma = [
        tiempo ? `Tiempo dedicado: ${tiempo}` : '',
        puntos ? `Puntos de la misión: ${puntos}` : '',
        total ? `Total verificado: ${total}` : ''
      ].filter(Boolean).join('\n');
      const problem = `Informe Yokup ${mision}. ${resumen}${verificado ? ` Verificado: ${verificado}.` : ''}`;
      const summary = `Informe ${mision} · ${titulo}. ${resumen}${norma ? ` ${norma.replace(/\n/g, ' · ')}` : ''} Abrir en quality=${qualityHint}.`;
      const reportTitle = `Informe ${mision}: ${titulo}`.slice(0, 220);
      assertDemoVideoUrl(a);
      const videoUrl = String(a.videoUrl || a.exampleVideoUrl || '').trim();
      const includeExampleVideo = a.includeExampleVideo === true || a.includeExampleVideo === 'true';
      const demoMode = requiresDemoVideoUrl(a);
      const videoSlide = String(a.videoSlide || (demoMode ? 'closing' : 'cover')).trim().toLowerCase() || (demoMode ? 'closing' : 'cover');
      const websiteArg = String(a.website || '').trim();
      const website = websiteArg || (matched && matched.website) || 'https://www.yokup.com';
      const passwordArg = String(a.password || '').trim();
      if (passwordArg && passwordArg.length < 10) throw new Error('password debe tener ≥10 caracteres.');
      const body = {
        displayName: clientDisplayName.slice(0, 120),
        slug: reportSlug,
        website,
        problem,
        audience: 'Consejo de Silicio · Yokup (cierre de misión)',
        objective: `Cerrar ${mision} con informe vivo (sala AdmiraNeXT) y evidencia escritorio.`,
        title: reportTitle,
        summary,
        languages: ['es', 'en'],
        outputs: ['website', 'documents', 'backgrounds'],
        overwrite
      };
      if (passwordArg) body.password = passwordArg;
      if (a.budgetLines !== undefined) body.budgetLines = a.budgetLines;
      if (videoUrl || includeExampleVideo || demoMode) {
        body.slideMedia = [exampleVideoEntry({
          src: videoUrl || FLEET_EXAMPLE_VIDEO,
          slide: videoSlide,
          caption: demoMode ? 'Demo en captura · sin abrir la plataforma' : 'Resultado en movimiento'
        })];
      }
      const out = await callGenerator(ctx, 'PUT', '/presentaciones/api/generate', body);
      const finalSlug = (out && out.slug) || reportSlug;
      const urls = urlsFor(finalSlug);
      const salaQuality = `${urls.sala}?quality=${qualityHint}&lang=es`;
      const passLine = (out && out.password) ? `Pass: ${out.password}` : (out && out.passwordPreserved ? 'Pass: (conservada)' : (passwordArg ? `Pass: ${passwordArg}` : ''));
      const yokupBlock = [
        `Informe vivo ${mision}: ${titulo}`,
        `Cliente: ${clientDisplayName} (${finalSlug}) · modo ${mode}`,
        resumen,
        verificado ? `Verificado: ${verificado}` : '',
        norma,
        (videoUrl || includeExampleVideo || demoMode) ? `Vídeo BEST: ${videoUrl || FLEET_EXAMPLE_VIDEO} (lámina ${videoSlide})` : '',
        `Sala: ${salaQuality}`,
        passLine,
        (videoUrl || includeExampleVideo || demoMode)
          ? 'Calidad recomendada: BEST (vídeo en movimiento) · BETTER (fondos) · GOOD (texto limpio).'
          : 'Calidad recomendada: BEST (figura descriptiva) · BETTER (fondos) · GOOD (texto limpio).'
      ].filter(Boolean).join('\n');
      return { ...out, kind: 'yokup-report', mode, mision, slug: finalSlug, qualityHint, urls: { ...urls, salaQuality }, yokupBlock, previous };
    }
    case 'generation_status': return callGenerator(ctx, 'GET', `/presentaciones/${slug(a.client)}/api/generation`);
    case 'list_versions': return callGenerator(ctx, 'GET', `/presentaciones/${slug(a.client)}/api/versions`);
    case 'restore_version': {
      if (!String(a.id || '').trim()) throw new Error('id de versión obligatorio (list_versions).');
      return callGenerator(ctx, 'POST', `/presentaciones/${slug(a.client)}/api/versions`, { id: String(a.id) });
    }
    case 'presentation_urls': return urlsFor(a.client);
    case 'delete_slide': {
      const blockId = String(a.blockId || '').trim();
      if (!blockId) throw new Error('blockId es obligatorio (id de la lámina del esqueleto, p.ej. problema).');
      const language = ['es', 'ca', 'en'].includes(String(a.language || '').toLowerCase()) ? String(a.language).toLowerCase() : 'es';
      return callGenerator(ctx, 'PUT', `/presentaciones/${slug(a.client)}/api/inline-edit`, { action: 'deleteSlide', language, blockId });
    }
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
