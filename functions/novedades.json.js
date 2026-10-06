/*
 * /novedades.json — la fuente de las notas de versión, solo con sesión (06-10-2026).
 * Es un fichero del repo que el deploy copia tal cual; sin sesión del directorio no sale
 * del edge (401). El deploy lo lee del árbol de git, no de producción, así que no le afecta.
 */
import { sesionCompleta } from './_webmaster-gate.js';

export async function onRequest({ request, env, next }) {
  const current = await sesionCompleta(request, env);
  if (!current) return Response.json({ ok: false, error: 'acceso restringido' }, { status: 401, headers: { 'cache-control': 'no-store', 'x-robots-tag': 'noindex, nofollow' } });
  const respuesta = await next();
  const headers = new Headers(respuesta.headers);
  headers.set('cache-control', 'private, no-store');
  headers.set('x-robots-tag', 'noindex, nofollow');
  return new Response(respuesta.body, { status: respuesta.status, headers });
}
