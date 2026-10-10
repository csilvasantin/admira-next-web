/*
 * /clientes — censo de clientes (Carlos, 10-10-2026): sale de la parte pública y
 * pasa detrás del mismo login que /pruebas, /flota o /presentaciones
 * (_webmaster-gate.js). Sin sesión, 401 con el login interno; el HTML no sale del edge.
 */
import { sesionCompleta, respuestaLogin } from '../_webmaster-gate.js';

export async function onRequest(context) {
  const { request, env, next } = context;
  if (!env.WEBMASTER_SIGNING_KEY) return respuestaLogin(env, 'Acceso no disponible ahora mismo.', '/clientes/', 503);
  const current = await sesionCompleta(request, env);
  if (!current) return respuestaLogin(env, 'Censo de clientes: identifícate para entrar.', '/clientes/', 401);
  const respuesta = await next();
  const headers = new Headers(respuesta.headers);
  headers.set('cache-control', 'private, no-store');
  headers.set('x-robots-tag', 'noindex, nofollow');
  return new Response(respuesta.body, { status: respuesta.status, statusText: respuesta.statusText, headers });
}
