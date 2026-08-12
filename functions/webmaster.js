/*
 * /webmaster — la página solo se sirve a quien ha pasado el perímetro de seguridad.
 *
 * Al capturar la ruta exacta con una Function, el HTML estático NO llega a salir
 * del edge sin sesión: no es un bloqueo de interfaz, es que no se envía.
 * (/webmaster.html redirige a /webmaster, así que no hay puerta trasera.)
 */
import { sesionCompleta, verificarGoogle, buscarUsuario, auditar, cookieDeSesion, cookiesBorradas, loginCsrfValido, respuestaLogin, returnToSeguro } from './_webmaster-gate.js';

export async function onRequest(context) {
  const { request, env, next } = context;

  if (!env.WEBMASTER_SIGNING_KEY) {
    return respuestaLogin('Acceso no disponible ahora mismo.', '/webmaster', 503);
  }

  // Vuelta del botón de Google: se verifica contra Google y se emite la cookie.
  if (request.method === 'POST') {
    let form;
    try { form = await request.formData(); } catch (_) { form = new FormData(); }
    if (!loginCsrfValido(request, form.get('login_csrf'))) return respuestaLogin('La solicitud de acceso ha caducado. Reinténtalo.', form.get('return_to'), 403);
    const email = await verificarGoogle(String(form.get('credential') || ''));
    if (!email) {
      return respuestaLogin('Google no pudo verificar esa identidad.', form.get('return_to'));
    }
    const user = await buscarUsuario(env, email).catch(() => null);
    if (!user || user.status !== 'active') {
      if (env.AUTH_DB) await auditar(env, email, email, 'login_denied', user ? 'suspended' : 'not_registered').catch(() => {});
      return respuestaLogin('Tu usuario no está activo en AdmiraNeXT.', form.get('return_to'));
    }
    const now = Date.now();
    await env.AUTH_DB.prepare('UPDATE admiranext_users SET last_login_at=?,last_login_ip=?,last_login_ua=?,updated_at=? WHERE email=?')
      .bind(now, request.headers.get('CF-Connecting-IP') || '', String(request.headers.get('User-Agent') || '').slice(0,300), now, email).run();
    await auditar(env, email, email, 'login_success', user.role);
    const headers = new Headers({ Location: returnToSeguro(form.get('return_to')), 'cache-control': 'no-store' });
    headers.append('Set-Cookie', await cookieDeSesion(env, user));
    cookiesBorradas().slice(1).forEach((cookie) => headers.append('Set-Cookie', cookie));
    return new Response(null, { status: 303, headers });
  }

  const current = await sesionCompleta(request, env);
  if (!current) {
    return respuestaLogin('', new URL(request.url).searchParams.get('return_to'));
  }

  // Con sesión: se sirve el HTML, pero nunca cacheado por intermediarios.
  const respuesta = await next();
  const headers = new Headers(respuesta.headers);
  headers.set('cache-control', 'no-store');
  headers.set('x-robots-tag', 'noindex, nofollow');
  return new Response(respuesta.body, { status: respuesta.status, headers });
}
