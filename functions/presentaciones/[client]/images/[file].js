function safe(value){ return /^[a-z0-9][a-z0-9._-]{0,159}$/i.test(String(value || '')) ? String(value) : ''; }

export async function onRequestGet(context){
  if(!context.env.PRESENTATION_MEDIA) return new Response('Imágenes no configuradas.', {status:503});
  const client = safe(String(context.params.client || '').toLowerCase());
  const file = safe(context.params.file);
  if(!client || !/^(?:manual-)?slide-[a-z0-9-]+\.(?:png|jpe?g|webp)$/i.test(file)) return new Response('Imagen no válida.', {status:400});
  const key = `presentations/${client}/grok-images/${file}`;
  const cabeceras = context.request?.headers;
  const revalida = Boolean(cabeceras?.has('if-none-match') || cabeceras?.has('if-modified-since'));
  const object = await context.env.PRESENTATION_MEDIA.get(key, revalida ? {onlyIf:cabeceras} : undefined);
  if(!object) return new Response('Imagen no encontrada.', {status:404});
  const headers = new Headers({'cache-control':'private, max-age=3600', 'content-disposition':`inline; filename="${file}"`, 'x-content-type-options':'nosniff'});
  object.writeHttpMetadata(headers);
  if(object.httpEtag) headers.set('etag', object.httpEtag);
  // Sin `body` es que la condicion del navegador se cumplio: ya la tiene.
  if(revalida && !object.body) return new Response(null, {status:304, headers});
  return new Response(object.body, {headers});
}
