function safe(value){return /^[a-z0-9][a-z0-9._-]{0,159}$/i.test(String(value||''))?String(value):'';}

export async function onRequestGet(context){
  if(!context.env.PRESENTATION_MEDIA)return new Response('Media no configurado.',{status:503});
  const client=safe(String(context.params.client||'').toLowerCase()),file=safe(context.params.file);
  if(!client||!file)return new Response('Archivo no válido.',{status:400});
  const language=(file.match(/-(es|ca|en)-\d+\./i)||[])[1]?.toLowerCase();
  if(!language)return new Response('Archivo no válido.',{status:400});
  const object=await context.env.PRESENTATION_MEDIA.get(`presentations/${client}/${language}/${file}`);
  if(!object)return new Response('Archivo no encontrado.',{status:404});
  const headers=new Headers({'cache-control':'private, max-age=3600','content-disposition':`inline; filename="${file}"`,'x-content-type-options':'nosniff'});
  object.writeHttpMetadata(headers);
  return new Response(object.body,{headers});
}
