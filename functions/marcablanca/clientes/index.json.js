/*
 * GET /marcablanca/clientes/index.json · respaldo estático del catálogo de marcas.
 * Sin sesión (Carlos, 10-10-2026) se sirve reducido a Admira y las marcas de ejemplo,
 * igual que /marcablanca/api/marcas (functions/_marcas-publicas.js).
 */
import { conSesion, indicePublico } from '../../_marcas-publicas.js';

export async function onRequestGet(context) {
  const { request, env, next } = context;
  const asset = await next();
  if (!asset.ok) return asset;
  if (await conSesion(request, env)) {
    const h = new Headers(asset.headers); h.set('cache-control', 'private, no-store'); h.set('vary', 'Cookie');
    return new Response(asset.body, { status: asset.status, headers: h });
  }
  let indice;
  try { indice = await asset.json(); } catch (_) { return new Response('{}', { status: 503, headers: { 'content-type': 'application/json; charset=utf-8' } }); }
  return new Response(JSON.stringify(indicePublico(indice), null, 2), { status: 200, headers: {
    'content-type': 'application/json; charset=utf-8', 'access-control-allow-origin': '*', 'cache-control': 'public, max-age=30, must-revalidate', vary: 'Cookie', 'x-content-type-options': 'nosniff',
  } });
}
