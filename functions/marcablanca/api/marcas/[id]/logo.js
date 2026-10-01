/*
 * GET /marcablanca/api/marcas/<id>/logo · logo subido de una marca del catálogo (R2, prefijo marcas/).
 * Se pinta siempre como <img>; abierto a pelo (p. ej. un SVG) no ejecuta nada: CSP con sandbox.
 */
import {leerLogo} from '../../../_catalogo.js';

export async function onRequestGet(context){
  const id = String(context.params.id || '').toLowerCase();
  if (!/^[a-z0-9][a-z0-9-]{0,40}$/.test(id)) return new Response('Logo no encontrado', {status:404});
  const objeto = await leerLogo(context.env, id);
  if (!objeto) return new Response('Logo no encontrado', {status:404});
  const headers = new Headers({'cache-control':'public, max-age=300','x-content-type-options':'nosniff','access-control-allow-origin':'*',
    'content-security-policy':"default-src 'none'; style-src 'unsafe-inline'; img-src data:; sandbox"});
  objeto.writeHttpMetadata?.(headers);
  if (objeto.httpEtag) headers.set('etag', objeto.httpEtag);
  return new Response(objeto.body, {headers});
}
