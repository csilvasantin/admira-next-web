/**
 * GET /api/roadmap — el fichero data/roadmap.json.
 * Con ?vista=&desde=&proyecto=&cliente=&idea= devuelve el corte.
 */
import { hitos, cortar } from '../_roadmap.js';

const CORS = {
  'access-control-allow-origin': '*',
  'access-control-allow-methods': 'GET, OPTIONS',
  'access-control-max-age': '86400',
};

function json(body, status = 200, extra = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'x-content-type-options': 'nosniff',
      'cache-control': 'public, max-age=60',
      ...CORS,
      ...extra,
    },
  });
}

export function onRequestOptions() {
  return new Response(null, { status: 204, headers: CORS });
}

export function onRequestGet({ request }) {
  const url = new URL(request.url);
  const lista = hitos();
  const params = ['vista', 'desde', 'proyecto', 'cliente', 'idea'];
  if (params.some((k) => url.searchParams.has(k))) {
    return json(cortar(lista, url.searchParams.get('vista'), url.searchParams.get('desde'), new Date(), {
      proyecto: url.searchParams.get('proyecto'),
      cliente: url.searchParams.get('cliente'),
      idea: url.searchParams.get('idea'),
    }));
  }
  return json(lista);
}

function soloLectura() {
  return json({ error: 'Solo lectura.' }, 405, { allow: 'GET, OPTIONS' });
}

export const onRequestPost = soloLectura;
export const onRequestPut = soloLectura;
export const onRequestDelete = soloLectura;
export const onRequestPatch = soloLectura;
