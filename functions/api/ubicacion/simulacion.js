/*
 * /api/ubicacion/simulacion — Luka simulado para los players del móvil (misión DCL-fb1c7a60).
 * GET: cualquier sesión; el player del móvil la consulta cada pocos segundos.
 * PUT: el simulador del mapa publica a Luka al soltarlo. Rol admin/editor + CSRF, como las zonas.
 */
import {sesionCompleta, csrfValido} from '../../_webmaster-gate.js';
import {respuestaUbicacion} from '../../_ubicacion.js';
import {leerSimulacion, guardarSimulacion} from '../../_mapa-simulacion.js';

const PUBLICAN = new Set(['admin', 'editor']);
const MAX_BYTES = 512;

export async function onRequestGet({request, env}) {
  const current = await sesionCompleta(request, env);
  if (!current) return respuestaUbicacion({ok:false, error:'sesion_requerida', login:'/pruebas/mapa/player/'}, 401);
  if (!env.AUTH_DB) return respuestaUbicacion({ok:false, error:'almacenamiento_no_disponible'}, 503);
  try {
    const puede = PUBLICAN.has(current.role);
    return respuestaUbicacion({ok:true, luka:await leerSimulacion(env.AUTH_DB), simulacion:true, puede_publicar:puede, ...(puede ? {csrf:current.csrf} : {})});
  } catch (_) { return respuestaUbicacion({ok:false, error:'almacenamiento_no_disponible'}, 503); }
}

export async function onRequestPut({request, env}) {
  const current = await sesionCompleta(request, env);
  if (!current) return respuestaUbicacion({ok:false, error:'sesion_requerida'}, 401);
  if (!PUBLICAN.has(current.role)) return respuestaUbicacion({ok:false, error:'sin_permiso'}, 403);
  if (!csrfValido(request, current)) return respuestaUbicacion({ok:false, error:'csrf_invalido'}, 403);
  if (!/^application\/json(?:\s*;|\s*$)/i.test(request.headers.get('content-type') || '')) {
    return respuestaUbicacion({ok:false, error:'content_type_invalido'}, 415);
  }
  if (!env.AUTH_DB) return respuestaUbicacion({ok:false, error:'almacenamiento_no_disponible'}, 503);
  const texto = await request.text();
  if (new TextEncoder().encode(texto).byteLength > MAX_BYTES) return respuestaUbicacion({ok:false, error:'cuerpo_demasiado_grande'}, 413);
  let entrada;
  try { entrada = JSON.parse(texto); } catch (_) { return respuestaUbicacion({ok:false, error:'json_invalido'}, 400); }
  try {
    const guardada = await guardarSimulacion(env.AUTH_DB, entrada, current.email);
    if (!guardada) return respuestaUbicacion({ok:false, error:'datos_invalidos'}, 400);
    return respuestaUbicacion({ok:true, luka:guardada, simulacion:true});
  } catch (_) { return respuestaUbicacion({ok:false, error:'almacenamiento_no_disponible'}, 503); }
}

const no = () => respuestaUbicacion({ok:false, error:'metodo_no_admitido'}, 405, {allow:'GET, PUT'});
export const onRequestPost = no;
export const onRequestDelete = no;
export const onRequestPatch = no;
