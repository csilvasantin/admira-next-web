/*
 * /proyectos/<clave>/ — detalle de proyecto en la zona protegida (Carlos, 20-10-2026: «todo lo que sea
 * detalle de un proyecto» va con acceso). Mismo login del directorio que /clientes, /flota o /roadmap
 * (_webmaster-gate.js): sin sesión, 401 con el login interno y ni el HTML ni sus ficheros (handon.md,
 * manifest.json) salen del edge. El censo público /proyectos/ sigue abierto.
 */
import { sesionCompleta, respuestaLogin } from '../_webmaster-gate.js';

export async function onRequest(context) {
  const { request, env, next, params } = context;
  const ruta = [].concat(params?.ruta || []).filter(Boolean);
  if (!ruta.length) return next();
  const volver = `/proyectos/${encodeURIComponent(ruta[0])}/`;
  if (!env.WEBMASTER_SIGNING_KEY) return respuestaLogin(env, 'Acceso no disponible ahora mismo.', volver, 503);
  const current = await sesionCompleta(request, env);
  if (!current) return respuestaLogin(env, 'Detalle de proyecto: identifícate para entrar.', volver, 401);
  const respuesta = await next();
  const headers = new Headers(respuesta.headers);
  headers.set('cache-control', 'private, no-store');
  headers.set('x-robots-tag', 'noindex, nofollow');
  return new Response(respuesta.body, { status: respuesta.status, statusText: respuesta.statusText, headers });
}
