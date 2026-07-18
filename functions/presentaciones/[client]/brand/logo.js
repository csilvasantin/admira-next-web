export async function onRequestGet(context){
  const client=String(context.params.client||'').toLowerCase();
  if(!/^[a-z0-9][a-z0-9-]{0,79}$/.test(client))return new Response('Logo no encontrado',{status:404});
  const config=await context.env.PRESENTATION_IDEAS?.get(`presentation:${client}`,{type:'json'});
  const key=String(config?.brand?.logoKey||'');
  if(!key.startsWith(`presentations/${client}/brand/`)||!context.env.PRESENTATION_MEDIA)return new Response('Logo no encontrado',{status:404});
  const object=await context.env.PRESENTATION_MEDIA.get(key);
  if(!object)return new Response('Logo no encontrado',{status:404});
  const headers=new Headers({'cache-control':'private, max-age=86400','x-content-type-options':'nosniff'});
  object.writeHttpMetadata(headers);headers.set('etag',object.httpEtag);
  return new Response(object.body,{headers});
}
