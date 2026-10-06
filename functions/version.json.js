/*
 * /version.json — firma pública mínima; las novedades, solo con sesión (06-10-2026).
 *
 * Carlos: el visitante anónimo no ve notas de versión. El deploy sigue generando un
 * version.json estático completo (deploy.sh y .github/workflows/deploy-cloudflare.yml); esta
 * Function lo lee tal cual y, si no hay sesión del directorio (la de /webmaster), quita
 * `novedades` y deja solo su número (`novedadesCount`), que es lo que necesita la verificación
 * del deploy. version, firma, commit e instante (norma 08, Webmaster) siguen públicos.
 * Sin cookie no se toca D1 (leerToken corta antes).
 */
import { sesionCompleta } from './_webmaster-gate.js';

export async function onRequest(context) {
  const { request, env, next } = context;
  const respuesta = await next();
  if (!respuesta.ok) return respuesta;
  let data;
  try { data = await respuesta.clone().json(); } catch (_) { return respuesta; }
  if (!data || typeof data !== 'object' || Array.isArray(data)) return respuesta;
  const headers = new Headers(respuesta.headers);
  headers.set('content-type', 'application/json; charset=utf-8');
  headers.set('cache-control', 'no-store');
  headers.set('vary', 'Cookie');
  headers.delete('content-length');
  headers.delete('etag');
  const current = await sesionCompleta(request, env);
  if (!current) {
    const lista = Array.isArray(data.novedades) ? data.novedades : [];
    delete data.novedades;
    data.novedadesCount = lista.length;
  }
  return new Response(request.method === 'HEAD' ? null : JSON.stringify(data, null, 2) + '\n', { status: 200, headers });
}
