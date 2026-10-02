/*
 * /presentaciones/api/propuesta · PROPUESTA COMERCIAL AUTOMÁTICA (SubMorfeoMacMini, 02-10-2026 · FLT-101369 a).
 *
 * Detrás de la MISMA puerta que el generador (_middleware.js: Google/directorio, clave de máquina
 * X-Admira-Machine-Key y token MCP de los deepagents). Solo quien puede generar (owner/editor/master)
 * lanza propuestas; sin sesión, 401 en JSON; con sesión sin permiso, 403.
 *
 *   POST {url?, marca?, idea?, idioma?, destinatario?, rehacer?, hasta?, canal?}
 *        → lanza (o continúa, si ya existe) la propuesta y la lleva hasta el paso `hasta`
 *          (marca → estudio → presentacion → plataforma; por defecto, todos).
 *   POST {id, hasta}   → continúa una propuesta existente (la UI lo usa para enseñar el progreso).
 *   GET  ?id=<id>      → la propuesta con su estudio (privado: nunca sale de esta puerta).
 *   GET                → acceso, cupo del día y últimas propuestas.
 * Límite: LIMITE_DIARIO lanzamientos por usuario y día; cada lanzamiento queda registrado.
 */
import {readIdentity} from '../_access.js';
import {ejecutarPropuesta, normalizarEntrada, vistaPropuesta, leerPropuesta, listarPropuestas, leerCupo, claveQuien, ErrorPropuesta, PASOS, CANALES, LIMITE_DIARIO} from '../_propuesta.js';

const MAX_CUERPO = 8 * 1024;
/** Credenciales que no adjunta el navegador por su cuenta (sin riesgo CSRF): pueden llegar sin Origin. */
const SIN_ORIGEN = new Set(['agent-token', 'machine-key']);

function json(body, status = 200, extra = {}){
  return new Response(JSON.stringify(body), {status, headers:{'content-type':'application/json; charset=utf-8', 'cache-control':'no-store', 'x-content-type-options':'nosniff', 'x-robots-tag':'noindex, nofollow', ...extra}});
}
const acceso = context => context.data?.presentationAccess || null;
const SIN_PERMISO = {error:'Lanzar una propuesta automática requiere entrar en el generador de presentaciones con una cuenta autorizada (editor o admin).', acceso:'/presentaciones/'};

async function autor(context){
  const a = acceso(context) || {};
  const identidad = await readIdentity(context.request, context.env?.PRES_SIGNING_KEY).catch(() => null);
  if (a.via === 'agent-token') return {nombre:a.tokenLabel || 'agente', email:a.email || '', via:'agent-token'};
  const email = a.email || identidad?.email || '';
  return {nombre:identidad?.name || a.tokenLabel || email.split('@')[0] || a.level || '', email, via:a.via || 'sesion'};
}

export async function onRequestGet(context){
  const {env, request} = context;
  const a = acceso(context);
  if (!a?.canGenerate) return json({ok:false, ...SIN_PERMISO}, 403);
  if (!env?.PRESENTATION_IDEAS) return json({error:'La propuesta automática no está disponible (KV).'}, 503);
  const quien = await autor(context);
  const id = new URL(request.url).searchParams.get('id');
  if (id) {
    const reg = await leerPropuesta(env, id);
    if (!reg) return json({error:`No existe la propuesta «${String(id).slice(0, 60)}».`}, 404);
    return json(await vistaPropuesta(env, reg));
  }
  return json({ok:true, acceso:{nivel:a.level, nombre:quien.nombre}, cupo:await leerCupo(env, claveQuien(quien, a)), pasos:PASOS, recientes:await listarPropuestas(env)});
}

export async function onRequestPost(context){
  const {env, request} = context;
  const a = acceso(context);
  if (!a?.canGenerate) return json(SIN_PERMISO, 403);
  if (!env?.PRESENTATION_IDEAS || !env?.PRES_SIGNING_KEY) return json({error:'Generador no configurado.'}, 503);
  const url = new URL(request.url);
  const origen = request.headers.get('Origin');
  if (!SIN_ORIGEN.has(a.via) && (!origen || origen !== url.origin)) return json({error:'Origen no permitido.'}, 403);
  if (Number(request.headers.get('content-length') || 0) > MAX_CUERPO) return json({error:'Petición demasiado grande.'}, 413);
  let body;
  try { const texto = await request.text(); if (texto.length > MAX_CUERPO) return json({error:'Petición demasiado grande.'}, 413); body = JSON.parse(texto || '{}'); }
  catch (_) { return json({error:'JSON no válido.'}, 400); }
  const conocidos = new Set(['url', 'marca', 'idea', 'idioma', 'destinatario', 'rehacer', 'hasta', 'paso', 'canal', 'id']);
  const desconocidos = Object.keys(body || {}).filter(k => !conocidos.has(k));
  if (desconocidos.length) return json({error:`Campos desconocidos: ${desconocidos.join(', ')}.`}, 400);
  const hasta = body.hasta ?? body.paso;
  if (hasta !== undefined && !PASOS.includes(hasta)) return json({error:`«hasta» debe ser uno de: ${PASOS.join(', ')}.`}, 400);
  const quien = await autor(context);
  const ctx = {env, request, data:context.data, waitUntil:typeof context.waitUntil === 'function' ? context.waitUntil.bind(context) : undefined,
    origin:url.origin, cookie:request.headers.get('cookie') || '', autor:quien, acceso:a, opciones:{}};
  try {
    const continuar = body.id && !body.url && !body.marca && !body.idea;
    const pedido = {rehacer:body.rehacer === true, hasta, canal:CANALES.includes(body.canal) ? body.canal : 'api'};
    if (continuar) pedido.id = String(body.id);
    else pedido.entrada = normalizarEntrada(body);
    const {reg, cupo} = await ejecutarPropuesta(ctx, pedido);
    const vista = await vistaPropuesta(env, reg, {cupo:cupo || await leerCupo(env, claveQuien(quien, a))});
    return json(vista, cupo ? 201 : 200);
  } catch (error) {
    if (error instanceof ErrorPropuesta) {
      const extra = error.estado === 429 ? {'retry-after':'3600'} : {};
      return json({error:error.message, limite:error.estado === 429 ? LIMITE_DIARIO : undefined, ...error.extra}, error.estado, extra);
    }
    try { console.error(JSON.stringify({evento:'propuesta-error', error:String(error?.message || error).slice(0, 300)})); } catch (_) {}
    return json({error:'No se pudo lanzar la propuesta.'}, 500);
  }
}
