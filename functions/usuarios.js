/*
 * /usuarios — zona DMZ (19-10-2026). La página solo sale del edge si la sesión pasa la
 * misma puerta que su API (admin en D1 + lista blanca DMZ + login con Google reciente).
 * Si no, se sirve la pantalla de login con Google (nunca el HTML del gestor), y
 * /usuarios?reauth=1 fuerza volver a verificar aunque la sesión aún valga.
 */
import { respuestaLogin, auditar } from './_webmaster-gate.js';
import { evaluarDmz, cspPagina, endurecer } from './_usuarios-dmz.js';
import { limitarFrecuencia } from './_limite-frecuencia.js';

const MENSAJE = {
  sin_sesion: 'Necesitas una sesión de administrador.',
  rol: 'Necesitas una sesión de administrador.',
  fuera_de_lista_dmz: 'Zona DMZ: esta cuenta no está autorizada para /usuarios.',
  login_no_google: 'Zona DMZ: entra con tu cuenta de Google (una sesión abierta con token no vale aquí).',
  sesion_caducada_dmz: 'Zona DMZ: vuelve a verificar tu identidad con Google.',
};

export async function onRequest({ request, env, next }) {
  if (request.method !== 'GET' && request.method !== 'HEAD') {
    return endurecer(new Response('método no permitido', { status: 405, headers: { allow: 'GET, HEAD', 'content-type': 'text/plain; charset=utf-8' } }));
  }
  // Freno por IP: cada pantalla de login escribe un desafío en D1.
  const freno = await limitarFrecuencia(env, request, { ambito: 'dmz-pagina-usuarios', maximo: 60, ventanaSeg: 600 });
  if (!freno.permitido) return endurecer(new Response('demasiadas peticiones', { status: 429, headers: { 'retry-after': String(freno.reintentarEn), 'content-type': 'text/plain; charset=utf-8' } }));
  const url = new URL(request.url);
  const r = await evaluarDmz(request, env);
  if (!r.ok || url.searchParams.has('reauth')) {
    if (r.current && !r.ok && !r.reauth) {
      await auditar(env, r.current.email, r.current.email, 'dmz_denied', `GET /usuarios · ${r.motivo}`,
        { ip: request.headers.get('CF-Connecting-IP') || '', ua: request.headers.get('User-Agent') || '' }).catch(() => {});
    }
    const texto = r.ok ? 'Zona DMZ: vuelve a verificar tu identidad con Google para hacer cambios.' : (MENSAJE[r.motivo] || MENSAJE.sin_sesion);
    // También la pantalla de login de la DMZ lleva las cabeceras duras (X-Frame-Options, HSTS,
    // no-store, private…), conservando su CSP propia, que necesita el botón de Google.
    const login = await respuestaLogin(env, texto, '/usuarios', r.ok ? 401 : (r.status === 403 && r.current ? 403 : 401));
    return endurecer(login, login.headers.get('content-security-policy'));
  }
  const response = await next();
  const html = await response.text();
  const csp = await cspPagina(html);
  const headers = new Headers(response.headers); headers.delete('content-length'); headers.delete('etag');
  return endurecer(new Response(request.method === 'HEAD' ? null : html, { status: response.status, headers }), csp);
}
