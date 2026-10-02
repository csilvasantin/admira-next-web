/*
 * GET /marcablanca/propuesta/<id> · armazón de la página de una propuesta automática (FLT-101369).
 * Solo sirve el HTML estático (marcablanca/propuesta/index.html): los datos, estudio incluido, los pide
 * la página a GET /presentaciones/api/propuesta?id=<id>, detrás de la puerta del generador. Sin sesión
 * la página no enseña nada. noindex.
 */
export async function onRequestGet(context){
  const id = String(context.params.id || '').toLowerCase();
  if (!/^[a-z0-9][a-z0-9-]{0,40}$/.test(id)) return new Response('Propuesta no encontrada', {status:404, headers:{'x-robots-tag':'noindex, nofollow'}});
  const asset = await context.env.ASSETS.fetch(new URL('/marcablanca/propuesta/', context.request.url));
  if (!asset.ok) return new Response('Página no disponible', {status:503});
  return new Response(asset.body, {headers:{'content-type':'text/html; charset=utf-8', 'cache-control':'no-store', 'x-robots-tag':'noindex, nofollow', 'x-content-type-options':'nosniff'}});
}
