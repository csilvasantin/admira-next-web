/**
 * /roadmap pinta el corte según ?vista=&desde=&proyecto=&cliente=&idea=.
 * Sin parámetros: mes en curso (Europe/Madrid).
 */
import { hitos, cortar, htmlCorte } from './_roadmap.js';

export async function onRequestGet({ request, env }) {
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
      'cache-control': 'public, max-age=60',
    },
  });
}
