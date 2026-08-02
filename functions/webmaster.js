/*
 * /webmaster — la página solo se sirve a quien ha pasado la verja.
 *
 * Al capturar la ruta exacta con una Function, el HTML estático NO llega a salir
 * del edge sin sesión: no es un bloqueo de interfaz, es que no se envía.
 * (/webmaster.html redirige a /webmaster, así que no hay puerta trasera.)
 */
import { sesion, verificarGoogle, cookieDeSesion, paginaLogin, respuestaHtml } from './_webmaster-gate.js';

export async function onRequest(context) {
  const { request, env, next } = context;

  if (!env.WEBMASTER_SIGNING_KEY) {
    return respuestaHtml(paginaLogin('Acceso no disponible ahora mismo.'), 503);
  }

  // Vuelta del botón de Google: se verifica contra Google y se emite la cookie.
  if (request.method === 'POST') {
    let form;
    try { form = await request.formData(); } catch (_) { form = new FormData(); }
    const email = await verificarGoogle(String(form.get('credential') || ''));
    if (!email) {
      return respuestaHtml(paginaLogin('Esa cuenta de Google no tiene acceso.'));
    }
    const headers = new Headers({ Location: '/webmaster', 'cache-control': 'no-store' });
    headers.append('Set-Cookie', await cookieDeSesion(env, email));
    return new Response(null, { status: 303, headers });
  }

  if (!(await sesion(request, env))) {
    return respuestaHtml(paginaLogin());
  }

  // Con sesión: se sirve el HTML, pero nunca cacheado por intermediarios.
  const respuesta = await next();
  const headers = new Headers(respuesta.headers);
  headers.set('cache-control', 'no-store');
  headers.set('x-robots-tag', 'noindex, nofollow');
  return new Response(respuesta.body, { status: respuesta.status, headers });
}
