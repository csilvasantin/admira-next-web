import {sesionCompleta} from '../_webmaster-gate.js';
import {
  respuestaUbicacion, claveUbicacionValida, leerAviso, validarAviso,
  guardarAviso, listarEquipos, errorAviso, RETENCION_DIAS,
} from '../_ubicacion.js';

export async function onRequestPost({request, env}) {
  // POST es máquina→máquina: no depende del login de Google ni de AUTH_DB.
  let authorized;
  try { authorized = await claveUbicacionValida(request, env); }
  catch (_) { return respuestaUbicacion({ok:false,error:'autenticacion_no_disponible'}, 503); }
  if (!authorized) {
    return respuestaUbicacion({ok:false,error:'no_autorizado'}, 401, {'www-authenticate':'Bearer'});
  }
  let aviso;
  try { aviso = validarAviso(await leerAviso(request)); }
  catch (error) { return errorAviso(error) || respuestaUbicacion({ok:false,error:'datos_invalidos'}, 400); }
  if (!env.UBICACIONES) return respuestaUbicacion({ok:false,error:'almacenamiento_no_disponible'}, 503);
  try {
    await guardarAviso(env.UBICACIONES, aviso);
    return respuestaUbicacion({ok:true,equipo:aviso.equipo,ts:aviso.ts,recibido_en:aviso.recibido_en}, 201);
  } catch (_) { return respuestaUbicacion({ok:false,error:'almacenamiento_no_disponible'}, 503); }
}

export async function onRequestGet({request, env}) {
  let current;
  try { current = await sesionCompleta(request, env); }
  catch (_) { return respuestaUbicacion({ok:false,error:'autenticacion_no_disponible'}, 503); }
  if (!current) return respuestaUbicacion({ok:false,error:'sesion_requerida',login:'/pruebas/mapa/'}, 401);
  if (!env.UBICACIONES) return respuestaUbicacion({ok:false,error:'almacenamiento_no_disponible'}, 503);
  try {
    const now = Date.now();
    return respuestaUbicacion({
      ok:true, generado_en:new Date(now).toISOString(), retencion_dias:RETENCION_DIAS,
      desactualizado_tras_h:2, equipos:await listarEquipos(env.UBICACIONES, now),
    });
  } catch (_) { return respuestaUbicacion({ok:false,error:'almacenamiento_no_disponible'}, 503); }
}

export async function onRequest(context) {
  if (context.request.method === 'POST') return onRequestPost(context);
  if (context.request.method === 'GET') return onRequestGet(context);
  return respuestaUbicacion({ok:false,error:'metodo_no_admitido'}, 405, {allow:'GET, POST'});
}
