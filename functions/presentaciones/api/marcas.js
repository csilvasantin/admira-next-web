/*
 * /presentaciones/api/marcas · ESCRITURA del catálogo único de marcas (SubMorfeoMacMini, 01-10-2026 · FLT-101330 a).
 *
 * Vive bajo /presentaciones a propósito: la sesión del generador (cookie pres_owner, Path=/presentaciones,
 * más pres_master/pres_editor y el token MCP de los deepagents) la valida _middleware.js, igual que en
 * el resto de /presentaciones/api/*. Aquí no hay contraseñas nuevas ni otra puerta: si el middleware
 * deja pasar y el nivel puede generar (owner/editor/master), se escribe; si no, 401/403.
 *
 *   GET    → {ok, acceso:{nivel, nombre}} · lo usa /marcablanca para saber si ofrecer «Guardar».
 *   GET ?catalogo=1 → el catálogo ENTERO (clientes y prospectos incluidos) para el panel Prospect del
 *          generador. Desde el 10-10-2026 la lectura pública (/marcablanca/api/marcas) solo da Admira y
 *          las marcas de ejemplo; el catálogo real se lee aquí, detrás de la puerta del generador.
 *   POST   {marca, origen:'url'|'generador', tipo?:'real'|'ejemplo', web?} → crea (409 si ya existe).
 *   PUT    igual, pero actualiza una marca existente del catálogo (las semillas nunca).
 * La lectura pública está en /marcablanca/api/marcas.
 */
import {guardarMarca, listarMarcas, ErrorCatalogo, MAX_CUERPO} from '../../marcablanca/_catalogo.js';
import {readIdentity} from '../_access.js';

function json(body, status = 200){
  return new Response(JSON.stringify(body), {status, headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store','x-content-type-options':'nosniff','x-robots-tag':'noindex, nofollow'}});
}
function acceso(context){ return context.data?.presentationAccess || null; }

async function autor(context){
  const a = acceso(context) || {};
  const identidad = await readIdentity(context.request, context.env?.PRES_SIGNING_KEY).catch(() => null);
  if (a.via === 'agent-token') return {nombre:a.tokenLabel || 'agente', email:a.email || ''};
  return {nombre:identidad?.name || a.email || a.level || '', email:a.email || identidad?.email || ''};
}

export async function onRequestGet(context){
  const a = acceso(context);
  if (!a?.canGenerate) return json({ok:false, error:'Para guardar marcas en el catálogo hace falta entrar en el generador de presentaciones.', acceso:'/presentaciones/'}, 403);
  if (new URL(context.request.url).searchParams.get('catalogo') === '1') {
    return json({ok:true, ...(await listarMarcas(context.env, context.request, {completo:true}))});
  }
  const quien = await autor(context);
  return json({ok:true, acceso:{nivel:a.level, nombre:quien.nombre}});
}

async function escribir(context, actualizar){
  const {request, env} = context;
  const a = acceso(context);
  if (!a?.canGenerate) return json({error:'Para guardar marcas en el catálogo hace falta entrar en el generador de presentaciones.', acceso:'/presentaciones/'}, 403);
  // Mismo origen para los navegadores; los deepagents (token MCP) llegan sin Origin.
  const origen = request.headers.get('Origin');
  if (a.via !== 'agent-token' && (!origen || origen !== new URL(request.url).origin)) return json({error:'Origen no permitido.'}, 403);
  if (Number(request.headers.get('content-length') || 0) > MAX_CUERPO) return json({error:'La marca supera 320 KB.'}, 413);
  let body;
  try { const texto = await request.text(); if (texto.length > MAX_CUERPO) return json({error:'La marca supera 320 KB.'}, 413); body = JSON.parse(texto); }
  catch (_) { return json({error:'JSON no válido.'}, 400); }
  try {
    const r = await guardarMarca(env, request, {marca:body?.marca, origen:body?.origen, tipo:body?.tipo, web:body?.web, propuesta:typeof body?.propuesta === 'boolean' ? body.propuesta : undefined, autor:await autor(context), actualizar});
    if (actualizar && r.creada) return json({ok:true, ...r, aviso:'No existía: se ha creado.'}, 201);
    return json({ok:true, ...r, url:`/marcablanca/?marca=${r.id}`, api:`/marcablanca/api/marcas/${r.id}`, presentacion:`/marcablanca/presentacion?marca=${r.id}`}, r.creada ? 201 : 200);
  } catch (error) {
    if (error instanceof ErrorCatalogo) return json({error:error.message}, error.estado);
    return json({error:'No se pudo guardar la marca en el catálogo.'}, 500);
  }
}
export const onRequestPost = context => escribir(context, false);
export const onRequestPut = context => escribir(context, true);
