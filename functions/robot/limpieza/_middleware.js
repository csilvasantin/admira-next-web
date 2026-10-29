/*
 * /robot/limpieza — pantalla de limpieza del robot (encargo #7273).
 * Mismo login que /pruebas: Google + directorio AUTH_DB (_webmaster-gate.js).
 * Sin sesión no sale del edge ni el HTML ni el CSS ni el JS. Tras entrar se
 * vuelve a /robot/limpieza/ (returnToSeguro).
 */
import { sesionCompleta, respuestaLogin, paginaLogin, respuestaHtml } from '../../_webmaster-gate.js';

export function paginaDeLimpieza(pathname) {
  if (pathname === '/robot/limpieza' || pathname === '/robot/limpieza/' || pathname === '/robot/limpieza/index.html') {
    return '/robot/limpieza/';
  }
  return null;
}

function texto(mensaje, status) {
  return new Response(mensaje + '\n', { status, headers: {
    'content-type': 'text/plain; charset=utf-8', 'cache-control': 'private, no-store', 'x-robots-tag': 'noindex, nofollow',
  } });
}

export async function onRequest(context) {
  const { request, env, next } = context;
  const url = new URL(request.url);
  if (url.pathname !== '/robot/limpieza' && !url.pathname.startsWith('/robot/limpieza/')) return next();
  const pagina = request.method === 'GET' || request.method === 'HEAD' ? paginaDeLimpieza(url.pathname) : null;
  if (request.method !== 'GET' && request.method !== 'HEAD') return texto('Método no permitido.', 405);
  if (!env.AUTH_DB && pagina) return respuestaHtml(paginaLogin('Limpieza del robot: identifícate para entrar.', pagina, ''), 401);
  if (!env.WEBMASTER_SIGNING_KEY) {
    return pagina ? respuestaLogin(env, 'Acceso no disponible ahora mismo.', pagina, 503) : texto('Acceso no disponible ahora mismo.', 503);
  }
  const current = await sesionCompleta(request, env);
  if (!current) {
    return pagina ? respuestaLogin(env, 'Limpieza del robot: identifícate para entrar.', pagina, 401) : texto('Sin sesión.', 401);
  }
  if (url.pathname === '/robot/limpieza') return Response.redirect(url.origin + '/robot/limpieza/' + url.search, 302);
  const respuesta = await next();
  const headers = new Headers(respuesta.headers);
  headers.set('cache-control', 'private, no-store');
  headers.set('x-robots-tag', 'noindex, nofollow');
  return new Response(respuesta.body, { status: respuesta.status, statusText: respuesta.statusText, headers });
}
