function safe(value){ return /^[a-z0-9][a-z0-9._-]{0,159}$/i.test(String(value || '')) ? String(value) : ''; }

export async function onRequestGet(context){
  if(!context.env.PRESENTATION_MEDIA) return new Response('Imágenes no configuradas.', {status:503});
  const client = safe(String(context.params.client || '').toLowerCase());
  const file = safe(context.params.file);
  if(!client || !/^slide-[a-z0-9-]+\.(?:png|jpe?g)$/i.test(file)) return new Response('Imagen no válida.', {status:400});
  const object = await context.env.PRESENTATION_MEDIA.get(`presentations/${client}/grok-images/${file}`);
  if(!object) return new Response('Imagen no encontrada.', {status:404});
  const headers = new Headers({'cache-control':'private, max-age=3600', 'content-disposition':`inline; filename="${file}"`, 'x-content-type-options':'nosniff'});
  object.writeHttpMetadata(headers);
  return new Response(object.body, {headers});
}

