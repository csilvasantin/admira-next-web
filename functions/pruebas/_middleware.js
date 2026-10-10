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
 *
 * Excepción (Carlos, 10-oct-2026, 13:46): /pruebas/visor/ también entra con un
 * enlace firmado de un solo dispositivo. El resto de /pruebas sigue cerrado.
 */
import { sesionCompleta, respuestaLogin } from '../_webmaster-gate.js';
import { accesoVisor, esRutaVisor, RUTA_ALTA_VISOR } from './_visor-enlace.js';

export const PREFIJO_PRUEBAS = '/pruebas';
export const POST_PRUEBAS = new Set(['/pruebas/api/solicitud', RUTA_ALTA_VISOR]);

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

function respuestaVisor(respuesta, acceso) {
  const headers = new Headers(respuesta.headers);
  headers.set('cache-control', 'private, no-store');
  headers.set('x-robots-tag', 'noindex, nofollow');
  headers.set('referrer-policy', 'no-referrer');
  if (acceso && acceso.cookie) headers.append('set-cookie', acceso.cookie);
  return new Response(respuesta.body, { status: respuesta.status, statusText: respuesta.statusText, headers });
}

async function servirFrontier(env, url) {
  if (!env.ASSETS || typeof env.ASSETS.fetch !== 'function') return texto('Ahora mismo no está el visor.', 503);
  const destino = new URL('/pruebas/frontier/assets/frontier.js', url.origin);
  const res = await env.ASSETS.fetch(new Request(destino.toString(), { method: 'GET' }));
  const headers = new Headers(res.headers);
  headers.set('content-type', 'text/javascript; charset=utf-8');
  headers.set('x-content-type-options', 'nosniff');
  return new Response(res.body, { status: res.status, headers });
}

export async function onRequest(context) {
  const { request, env, next } = context;
  const url = new URL(request.url);
  if (url.pathname !== PREFIJO_PRUEBAS && !url.pathname.startsWith(PREFIJO_PRUEBAS + '/')) return next();
  const pagina = request.method === 'GET' || request.method === 'HEAD' ? paginaDePruebas(url.pathname) : null;
  const metodoOk = request.method === 'GET' || request.method === 'HEAD';
  // Escrituras: la solicitud de marca blanca y el alta del enlace del visor. Las dos exigen sesión.
  const postPermitido = request.method === 'POST' && POST_PRUEBAS.has(url.pathname);
  const deleteEnlace = request.method === 'DELETE' && url.pathname === RUTA_ALTA_VISOR;
  if (!metodoOk && !postPermitido && !deleteEnlace) return texto('Método no permitido.', 405);
  if (esRutaVisor(url.pathname) && metodoOk) {
    const acceso = await accesoVisor(request, env);
    if (acceso.ok) {
      if (url.pathname === '/pruebas/visor') {
        return respuestaVisor(Response.redirect(url.origin + '/pruebas/visor/' + url.search, 302), acceso);
      }
      const respuesta = url.pathname === '/pruebas/visor/frontier.js' ? await servirFrontier(env, url) : await next();
      return respuestaVisor(respuesta, acceso);
    }
    if (acceso.cerrar) return texto('Sin enlace.', 401);
  }
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
