import {respuestaUbicacion, claveSmartTagValida, leerAviso, guardarAviso, errorAviso} from '../../_ubicacion.js';
import {normalizarSmartTag2} from '../../_smarttag2.js';

export async function onRequest({request, env}) {
  if (request.method !== 'POST') return respuestaUbicacion({ok:false,error:'metodo_no_admitido'}, 405, {allow:'POST'});
  let authorized;
  try { authorized = await claveSmartTagValida(request, env); }
  catch (_) { return respuestaUbicacion({ok:false,error:'autenticacion_no_disponible'}, 503); }
  if (!authorized) return respuestaUbicacion({ok:false,error:'no_autorizado'}, 401, {'www-authenticate':'Bearer'});
  let aviso;
  try { aviso = normalizarSmartTag2(await leerAviso(request)); }
  catch (error) { return errorAviso(error) || respuestaUbicacion({ok:false,error:'datos_invalidos'}, 400); }
  if (!env.UBICACIONES) return respuestaUbicacion({ok:false,error:'almacenamiento_no_disponible'}, 503);
  try {
    await guardarAviso(env.UBICACIONES, aviso);
    return respuestaUbicacion({ok:true,equipo:'luka',label:'Luka',tipo:'smarttag2',ts:aviso.ts,recibido_en:aviso.recibido_en}, 201);
  } catch (_) { return respuestaUbicacion({ok:false,error:'almacenamiento_no_disponible'}, 503); }
}
