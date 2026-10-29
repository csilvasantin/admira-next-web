/*
 * /api/ubicacion/player-qr — QR para abrir el player por ubicación en un móvil
 * (misión DCL-fb1c7a60). Solo codifica la URL pública de la página; el móvil entra
 * con su propia sesión de Google. Sin claves ni enlaces firmados.
 */
import {sesionCompleta} from '../../_webmaster-gate.js';
import {respuestaUbicacion} from '../../_ubicacion.js';
import {qrSvg} from '../../pruebas/_qr-svg.js';

export const RUTA_PLAYER = '/pruebas/mapa/player/';

export async function onRequestGet({request, env}) {
  if (!await sesionCompleta(request, env)) return respuestaUbicacion({ok:false, error:'sesion_requerida'}, 401);
  const destino = new URL(RUTA_PLAYER, request.url).href;
  return new Response(qrSvg(destino), {headers:{
    'content-type':'image/svg+xml; charset=utf-8',
    'cache-control':'private, no-store',
    'x-robots-tag':'noindex, nofollow',
    'x-content-type-options':'nosniff',
  }});
}
