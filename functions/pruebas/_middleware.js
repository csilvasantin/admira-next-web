/*
 * /pruebas — ZONA DE PRUEBAS de admiranext.com (Carlos, 10-10-2026).
 *
 * Toda novedad se publica primero aquí, nunca directamente en la parte pública,
 * salvo que Carlos diga otra cosa. El primer inquilino es la portada Bits and
 * Atoms del encargo #5547, que salió al público sin pasar por pruebas y se
 * revirtió de la portada.
 *
 * Mismo perímetro que /flota, /organigrama, /roadmap o /neo58: identidad de
 * Google + directorio AUTH_DB (_webmaster-gate.js). No hay sistema de acceso
 * nuevo. Verja de SERVIDOR: sin sesión no sale del edge ni el HTML ni los
 * assets de /pruebas; la página responde 401 con el login interno y, tras
 * entrar, se vuelve a la página pedida (returnToSeguro admite /pruebas/...).
 */
import { sesionCompleta, respuestaLogin } from '../_webmaster-gate.js';

export const PREFIJO_PRUEBAS = '/pruebas';

function texto(mensaje, status) {
  return new Response(mensaje + '\n', { status, headers: {
    'content-type': 'text/plain; charset=utf-8', 'cache-control': 'private, no-store', 'x-robots-tag': 'noindex, nofollow',
  } });
}

// Ruta de vuelta tras el login: solo páginas (carpetas) dentro de /pruebas.
export function paginaDePruebas(pathname) {
  if (pathname === PREFIJO_PRUEBAS) return '/pruebas/';
  if (pathname.endsWith('/index.html')) pathname = pathname.slice(0, -'index.html'.length);
  return /^\/pruebas\/(?:[a-z0-9-]+\/)*$/.test(pathname) ? pathname : null;
}

export async function onRequest(context) {
  const { request, env, next } = context;
  const url = new URL(request.url);
  if (url.pathname !== PREFIJO_PRUEBAS && !url.pathname.startsWith(PREFIJO_PRUEBAS + '/')) return next();
  const pagina = request.method === 'GET' || request.method === 'HEAD' ? paginaDePruebas(url.pathname) : null;
  if (request.method !== 'GET' && request.method !== 'HEAD') return texto('Método no permitido.', 405);
  if (!env.WEBMASTER_SIGNING_KEY) return pagina ? respuestaLogin(env, 'Acceso no disponible ahora mismo.', pagina, 503) : texto('Acceso no disponible ahora mismo.', 503);
  const current = await sesionCompleta(request, env);
  if (!current) return pagina ? respuestaLogin(env, 'Zona de pruebas: identifícate para entrar.', pagina, 401) : texto('Sin sesión.', 401);
  if (url.pathname === PREFIJO_PRUEBAS) return Response.redirect(url.origin + '/pruebas/' + url.search, 302);
  const respuesta = await next();
  const headers = new Headers(respuesta.headers);
  headers.set('cache-control', 'private, no-store');
  headers.set('x-robots-tag', 'noindex, nofollow');
  return new Response(respuesta.body, { status: respuesta.status, statusText: respuesta.statusText, headers });
}
