/**
 * /roadmap — zona protegida (10-10-2026). Ver ./_zona-protegida.js.
 * Con sesión pinta el corte según ?vista=&desde=&proyecto=&cliente=&idea=.
 * Sin parámetros: mes en curso (Europe/Madrid). Sin sesión: 401, el HTML no sale.
 */
import { hitos, cortar, htmlCorte } from './_roadmap.js';
import { sesionCompleta, respuestaLogin } from './_webmaster-gate.js';

export async function onRequestGet({ request, env }) {
  if (!env.WEBMASTER_SIGNING_KEY) {
    return respuestaLogin(env, 'Acceso no disponible ahora mismo.', '/roadmap', 503);
  }
  const current = await sesionCompleta(request, env);
  if (!current) {
    return respuestaLogin(env, 'Zona protegida: identifícate para entrar.', '/roadmap', 401);
  }
  const url = new URL(request.url);
  const asset = await env.ASSETS.fetch(new URL('/roadmap.html', url));
  const corte = cortar(hitos(), url.searchParams.get('vista'), url.searchParams.get('desde'), new Date(), {
    proyecto: url.searchParams.get('proyecto'),
    cliente: url.searchParams.get('cliente'),
    idea: url.searchParams.get('idea'),
  });
  const html = (await asset.text()).replace('<!--CORTE-->', htmlCorte(corte));
  return new Response(html, {
    status: asset.status,
    headers: {
      'content-type': 'text/html; charset=utf-8',
      'cache-control': 'private, no-store',
      'x-robots-tag': 'noindex, nofollow',
    },
  });
}
