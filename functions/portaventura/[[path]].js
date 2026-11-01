/*
 * /portaventura — PortAventura NeXT (preview, 1-nov-2026) en la ZONA PROTEGIDA de admiranext.com.
 * Neo: «solo los usuarios con permiso; de momento csilva@admira.com y csilvasantin@gmail.com».
 * Verja de SERVIDOR: sesión del directorio (_webmaster-gate.js) + lista de emails. Sin sesión → login
 * y vuelta aquí; con sesión pero sin permiso → 403. La lista se amplía con la variable
 * PORTAVENTURA_EMAILS (emails separados por comas) sin tocar código.
 */
import { sesionCompleta, respuestaLogin } from '../_webmaster-gate.js';

export const RUTA_PORTAVENTURA = '/portaventura/';
export const PERMITIDOS_POR_DEFECTO = Object.freeze(['csilva@admira.com', 'csilvasantin@gmail.com']);

export function permitidos(env) {
  const extra = String((env && env.PORTAVENTURA_EMAILS) || '').split(',').map((e) => e.trim().toLowerCase()).filter(Boolean);
  return new Set([...PERMITIDOS_POR_DEFECTO, ...extra]);
}

const PRIVADO = { 'cache-control': 'private, no-store', 'x-robots-tag': 'noindex, nofollow' };

export async function onRequest(context) {
  const { request, env, next } = context;
  if (!env.WEBMASTER_SIGNING_KEY) return respuestaLogin(env, 'Acceso no disponible ahora mismo.', RUTA_PORTAVENTURA, 503);
  const current = await sesionCompleta(request, env);
  if (!current) return respuestaLogin(env, 'Zona protegida: identifícate para entrar.', RUTA_PORTAVENTURA, 401);
  if (!permitidos(env).has(String(current.email || '').toLowerCase())) {
    return new Response('PortAventura NeXT: tu cuenta no tiene permiso para esta preview.\n', { status: 403, headers: { 'content-type': 'text/plain; charset=utf-8', ...PRIVADO } });
  }
  const respuesta = await next();
  const headers = new Headers(respuesta.headers);
  Object.entries(PRIVADO).forEach(([k, v]) => headers.set(k, v));
  return new Response(respuesta.body, { status: respuesta.status, statusText: respuesta.statusText, headers });
}
