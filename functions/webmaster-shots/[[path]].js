/*
 * Las miniaturas de /webmaster, tras la misma verja que la página.
 *
 * Son portadas de sitios públicos, así que no revelan nada que no se vea
 * visitándolos. Pero enumerables desde fuera sí dicen algo que la página se
 * guarda: QUÉ sitios forman el ecosistema y cuáles están en obras. Si la página
 * está cerrada, sus imágenes también.
 */
import { sesion } from '../_webmaster-gate.js';

export async function onRequest({ request, env, next }) {
  if (!(await sesion(request, env))) {
    return new Response('Acceso restringido', {
      status: 401,
      headers: { 'cache-control': 'no-store', 'x-robots-tag': 'noindex, nofollow' },
    });
  }
  const respuesta = await next();
  const headers = new Headers(respuesta.headers);
  // Privado: que no las guarde ningún intermediario, solo el navegador de quien entra.
  headers.set('cache-control', 'private, max-age=3600');
  headers.set('x-robots-tag', 'noindex, nofollow');
  return new Response(respuesta.body, { status: respuesta.status, headers });
}
