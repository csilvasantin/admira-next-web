/*
 * /documentacion — material de la presentación agéntica (informe estratégico, FAQ de ventas, guía de estudio,
 * diapositivas…). Carlos, 20-10-2026: sale de la parte pública de clearchannel.tv/admira.biz y pasa detrás del
 * mismo login del directorio que /clientes (_webmaster-gate.js). Sin sesión, 401 con el login interno: ni el
 * HTML ni los ficheros salen del edge.
 */
import { sesionCompleta, respuestaLogin } from '../_webmaster-gate.js';

export async function onRequest(context) {
  const { request, env, next } = context;
  if (!env.WEBMASTER_SIGNING_KEY) return respuestaLogin(env, 'Acceso no disponible ahora mismo.', '/documentacion/', 503);
  const current = await sesionCompleta(request, env);
  if (!current) return respuestaLogin(env, 'Documentación: identifícate para entrar.', '/documentacion/', 401);
  const respuesta = await next();
  const headers = new Headers(respuesta.headers);
  headers.set('cache-control', 'private, no-store');
  headers.set('x-robots-tag', 'noindex, nofollow');
  return new Response(respuesta.body, { status: respuesta.status, statusText: respuesta.statusText, headers });
}
