/*
 * ZONA PROTEGIDA de admiranext.com (Carlos, 06-10-2026).
 *
 * Style Book (/libro-de-estilo), Agentes (/flota) y Organigrama (/organigrama) salen
 * de la navegación pública de la portada y pasan detrás del MISMO perímetro que
 * /webmaster, /usuarios y /github: identidad de Google + directorio AUTH_DB
 * (_webmaster-gate.js). No hay sistema de acceso nuevo.
 *
 * Verja de SERVIDOR, no de interfaz: sin sesión el HTML estático no sale del edge;
 * se responde 401 con el login interno y, tras entrar, se vuelve a la página pedida
 * (returnToSeguro las admite). Las variantes .html y la barra final las redirige
 * Cloudflare Pages a la ruta limpia, así que no hay puerta trasera.
 */
import { sesionCompleta, respuestaLogin } from './_webmaster-gate.js';

export const ZONA_PROTEGIDA = Object.freeze([
  Object.freeze({ ruta: '/libro-de-estilo', titulo: 'Style Book', descripcion: 'Libro de estilo: quiénes somos y cómo nos gustan las cosas' }),
  Object.freeze({ ruta: '/flota', titulo: 'Agentes', descripcion: 'Marcador y misiones de los agentes' }),
  Object.freeze({ ruta: '/organigrama', titulo: 'Organigrama', descripcion: 'Organigrama de ADmiraNeXT' }),
]);

export const RUTAS_PROTEGIDAS = new Set(ZONA_PROTEGIDA.map((p) => p.ruta));

export async function servirProtegida(context, ruta) {
  const { request, env, next } = context;
  if (!RUTAS_PROTEGIDAS.has(ruta)) throw new Error(`ruta fuera de la zona protegida: ${ruta}`);
  if (!env.WEBMASTER_SIGNING_KEY) return respuestaLogin(env, 'Acceso no disponible ahora mismo.', ruta, 503);
  const current = await sesionCompleta(request, env);
  if (!current) return respuestaLogin(env, 'Zona protegida: identifícate para entrar.', ruta, 401);
  const respuesta = await next();
  const headers = new Headers(respuesta.headers);
  headers.set('cache-control', 'private, no-store');
  headers.set('x-robots-tag', 'noindex, nofollow');
  return new Response(respuesta.body, { status: respuesta.status, statusText: respuesta.statusText, headers });
}
