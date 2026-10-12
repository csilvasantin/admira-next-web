import {
  respuestaUbicacion, claveParteValida, ultimaPosicion, ciudadCercana,
  DESACTUALIZADO_MS,
} from '../../_ubicacion.js';

// Solo lectura para el parte horario. Clave propia (UBICACION_KEY_PARTE):
// ni la clave del iPhone ni la sesión de Google sirven aquí.
export async function onRequestGet({request, env}) {
  let autorizado;
  try { autorizado = await claveParteValida(request, env); }
  catch (_) { return respuestaUbicacion({ok:false,error:'autenticacion_no_disponible'}, 503); }
  if (!autorizado) {
    return respuestaUbicacion({ok:false,error:'no_autorizado'}, 401, {'www-authenticate':'Bearer'});
  }
  if (!env.UBICACIONES) return respuestaUbicacion({ok:false,error:'almacenamiento_no_disponible'}, 503);
  try {
    const now = Date.now();
    const aviso = await ultimaPosicion(env.UBICACIONES, 'iphone-carlos', now);
    if (!aviso) return respuestaUbicacion({ok:true,equipo:'iphone-carlos',estado:'sin_datos'});
    const antiguedad = Math.max(0, now - Date.parse(aviso.ts));
    return respuestaUbicacion({
      ok:true, equipo:'iphone-carlos', lat:aviso.lat, lon:aviso.lon,
      ciudad:ciudadCercana(aviso.lat, aviso.lon),
      hora:aviso.ts, antiguedad_min:Math.round(antiguedad / 60000),
      estado:antiguedad > DESACTUALIZADO_MS ? 'desactualizado' : 'actualizado',
    });
  } catch (_) { return respuestaUbicacion({ok:false,error:'almacenamiento_no_disponible'}, 503); }
}

export async function onRequest(context) {
  if (context.request.method === 'GET') return onRequestGet(context);
  return respuestaUbicacion({ok:false,error:'metodo_no_admitido'}, 405, {allow:'GET'});
}
