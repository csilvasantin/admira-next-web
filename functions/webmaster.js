/*
 * /webmaster — la página solo se sirve a quien ha pasado el perímetro de seguridad.
 *
 * Al capturar la ruta exacta con una Function, el HTML estático NO llega a salir
 * del edge sin sesión: no es un bloqueo de interfaz, es que no se envía.
 * (/webmaster.html redirige a /webmaster, así que no hay puerta trasera.)
 */
import { sesionCompleta, verificarGoogle, buscarUsuarioIdentidad, auditar, cookieDeSesion, cookiesBorradas, loginCsrfValido, consumirDesafioLogin, respuestaLogin, respuestaContinuacion } from './_webmaster-gate.js';

export async function onRequest(context) {
  const { request, env, next } = context;

  if (!env.WEBMASTER_SIGNING_KEY) {
    return respuestaLogin(env, 'Acceso no disponible ahora mismo.', '/webmaster', 503);
  }

  // Vuelta del botón de Google: se verifica contra Google y se emite la cookie.
  if (request.method === 'POST') {
    let form;
    try { form = await request.formData(); } catch (_) { form = new FormData(); }
    // PUENTE PARA EL GENERADOR DE PRESENTACIONES (0478, 4-sep-2026). Google Identity en
    // modo redirección solo puede volver a una URI registrada en el cliente OAuth, y la
    // única registrada es /webmaster. El generador deja la cookie `pres_return` antes de
    // mandar al usuario a Google; si está, aquí NO se abre sesión de webmaster: se reenvía
    // la credencial (mismo origen, formulario auto-enviado) a la página del generador,
    // que la verifica y decide contra el directorio. Sin popups: funciona en el navegador
    // insertado de Claude, donde ux_mode=popup moría con «Failed to open popup window».
    const presReturn = decodeURIComponent((request.headers.get('Cookie') || '').split(/;\s*/).map((c) => c.split('=')).find((kv) => kv[0] === 'pres_return')?.[1] || '');
    if (form.get('credential') && /^\/presentaciones(\/|$)/.test(presReturn) && !/[<>"'\s]/.test(presReturn)) {
      const escapeHtml = (v) => String(v).replace(/[<>&"']/g, (ch) => ({'<':'&lt;','>':'&gt;','&':'&amp;','"':'&quot;',"'":'&#39;'}[ch]));
      const body = `<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="robots" content="noindex"><title>Volviendo al generador…</title></head><body style="background:#070a10;color:#7186a8;font:14px system-ui;display:grid;place-items:center;min-height:100vh;margin:0"><form id="back" method="POST" action="${escapeHtml(presReturn)}"><input type="hidden" name="intent" value="google"><input type="hidden" name="credential" value="${escapeHtml(form.get('credential'))}"><input type="hidden" name="g_csrf_token" value="${escapeHtml(form.get('g_csrf_token') || '')}"><noscript><button type="submit">Continuar al generador</button></noscript></form><p>Volviendo al generador de presentaciones…</p><script>document.getElementById('back').submit()</script></body></html>`;
      return new Response(body, {status:200, headers:{'content-type':'text/html; charset=utf-8', 'cache-control':'no-store', 'x-robots-tag':'noindex, nofollow', 'set-cookie':'pres_return=; Path=/; Max-Age=0; Secure; SameSite=None'}});
    }
    const identity = await verificarGoogle(String(form.get('credential') || ''));
    if (!identity) {
      return respuestaLogin(env, 'Google no pudo verificar esa identidad.', '/webmaster');
    }
    if (!loginCsrfValido(request, form.get('g_csrf_token'), identity.nonce)) return respuestaLogin(env, 'La solicitud de acceso ha caducado. Reinténtalo.', '/webmaster', 403);
    const returnTo = await consumirDesafioLogin(env, identity.nonce);
    if (!returnTo) return respuestaLogin(env, 'La solicitud de acceso ya se usó o ha caducado. Reinténtalo.', '/webmaster', 403);
    let user;
    try { user = await buscarUsuarioIdentidad(env, identity); }
    catch (error) {
      console.error('admiranext_login_lookup_failed', String(error?.message || error).slice(0,200));
      return respuestaLogin(env, 'El directorio no está disponible ahora mismo. Reinténtalo.', returnTo, 503);
    }
    if (!user || user.status !== 'active') {
      if (env.AUTH_DB) await auditar(env, identity.email, user?.email || identity.email, 'login_denied', user ? 'suspended' : 'not_registered').catch(() => {});
      return respuestaLogin(env, 'Tu usuario no está activo en AdmiraNeXT.', returnTo);
    }
    const now = Date.now();
    await env.AUTH_DB.prepare('UPDATE admiranext_users SET google_sub=COALESCE(google_sub,?),last_login_at=?,last_login_ip=?,last_login_ua=?,updated_at=? WHERE email=? AND (google_sub IS NULL OR google_sub=?)')
      .bind(identity.sub, now, request.headers.get('CF-Connecting-IP') || '', String(request.headers.get('User-Agent') || '').slice(0,300), now, user.email, identity.sub).run();
    await auditar(env, identity.email, user.email, 'login_success', user.role);
    const response = respuestaContinuacion(returnTo);
    response.headers.append('Set-Cookie', await cookieDeSesion(env, user));
    cookiesBorradas().slice(1).forEach((cookie) => response.headers.append('Set-Cookie', cookie));
    return response;
  }

  const current = await sesionCompleta(request, env);
  if (!current) {
    return respuestaLogin(env, '', new URL(request.url).searchParams.get('return_to'));
  }

  // Con sesión: se sirve el HTML, pero nunca cacheado por intermediarios.
  const respuesta = await next();
  const headers = new Headers(respuesta.headers);
  headers.set('cache-control', 'no-store');
  headers.set('x-robots-tag', 'noindex, nofollow');
  return new Response(respuesta.body, { status: respuesta.status, headers });
}
