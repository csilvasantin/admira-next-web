/*
 * /api/ubicacion/zonas — zonas compartidas del player por ubicación (misión DCL-fb1c7a60).
 * GET: cualquier sesión de la zona protegida; el player del móvil las lee así.
 * PUT: publica las zonas del editor. Rol admin/editor + CSRF, como /api/roadmap-combo.
 * Mismo KV que las ubicaciones (UBICACIONES), sin binding nuevo.
 */
import {sesionCompleta, csrfValido} from '../../_webmaster-gate.js';
import {respuestaUbicacion} from '../../_ubicacion.js';
import {leerZonas, guardarZonas, MAX_ZONAS_BYTES} from '../../_mapa-zonas.js';

const PUBLICAN = new Set(['admin', 'editor']);

export async function onRequestGet({request, env}) {
  const current = await sesionCompleta(request, env);
  if (!current) return respuestaUbicacion({ok:false, error:'sesion_requerida', login:'/pruebas/mapa/player/'}, 401);
  if (!env.UBICACIONES) return respuestaUbicacion({ok:false, error:'almacenamiento_no_disponible'}, 503);
  try {
    const puede = PUBLICAN.has(current.role);
    return respuestaUbicacion({ok:true, ...await leerZonas(env.UBICACIONES), puede_publicar:puede, ...(puede ? {csrf:current.csrf} : {})});
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
  if (!env.UBICACIONES) return respuestaUbicacion({ok:false, error:'almacenamiento_no_disponible'}, 503);
  const texto = await request.text();
  if (new TextEncoder().encode(texto).byteLength > MAX_ZONAS_BYTES) return respuestaUbicacion({ok:false, error:'cuerpo_demasiado_grande'}, 413);
  let entrada;
  try { entrada = JSON.parse(texto); } catch (_) { return respuestaUbicacion({ok:false, error:'json_invalido'}, 400); }
  try {
    const r = await guardarZonas(env.UBICACIONES, entrada, current.email);
    if (!r.ok) return respuestaUbicacion({ok:false, error:r.error, ...(r.rev !== undefined ? {rev:r.rev} : {})}, r.status);
    return respuestaUbicacion(r);
  } catch (_) { return respuestaUbicacion({ok:false, error:'almacenamiento_no_disponible'}, 503); }
}

const no = () => respuestaUbicacion({ok:false, error:'metodo_no_admitido'}, 405, {allow:'GET, PUT'});
export const onRequestPost = no;
export const onRequestDelete = no;
export const onRequestPatch = no;
