function response(body,status=200){
  return new Response(JSON.stringify(body),{status,headers:{
    'content-type':'application/json; charset=utf-8',
    'cache-control':'no-store, must-revalidate',
    'x-content-type-options':'nosniff'
  }});
}

export async function onRequestGet(context){
  const client=String(context.params.client||'').toLowerCase();
  if(!/^[a-z0-9][a-z0-9-]{1,62}$/.test(client)) return response({error:'Cliente no válido.'},404);
  if(!context.env.PRESENTATION_IDEAS) return response({error:'Contenido no disponible.'},503);
  const ideas=await context.env.PRESENTATION_IDEAS.get(`ideas:${client}`,{type:'json'});
  return ideas?response(ideas):response({error:'Contenido no disponible.'},404);
}
