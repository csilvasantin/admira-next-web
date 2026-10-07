// Esta descarga atraviesa la misma puerta privada de la presentación.
export async function onRequestGet({request,params,env}) {
  const client=String(params.client||'').toLowerCase(),format=new URL(request.url).searchParams.get('format')||'zip';
  if(!/^[a-z0-9][a-z0-9-]{1,62}$/.test(client)||!['zip','pdf'].includes(format))return new Response('Descarga no válida.',{status:400});
  if(!env.PRESENTATION_MEDIA)return new Response('Almacenamiento no configurado.',{status:503});
  const object=await env.PRESENTATION_MEDIA.get(`presentations/${client}/offline/paquete.${format}`);
  if(!object)return new Response('Todavía no hay un paquete offline preparado para esta presentación.',{status:404});
  return new Response(object.body,{headers:{'content-type':format==='zip'?'application/zip':'application/pdf','content-disposition':`attachment; filename="${client}.${format}"`,'content-length':String(object.size),'cache-control':'private, no-store','x-content-type-options':'nosniff','x-robots-tag':'noindex, nofollow'}});
}
