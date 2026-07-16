function javascript(source,status=200){
  return new Response(source,{status,headers:{
    'content-type':'application/javascript; charset=utf-8',
    'cache-control':'no-store, must-revalidate',
    'x-content-type-options':'nosniff'
  }});
}

export async function onRequestGet(context){
  const client=String(context.params.client||'').toLowerCase();
  if(!/^[a-z0-9][a-z0-9-]{1,62}$/.test(client)||!context.env.PRESENTATION_IDEAS){
    return javascript('window.__ADMIRA_PRESENTATION_CONTENT__=null;',404);
  }
  const ideas=await context.env.PRESENTATION_IDEAS.get(`ideas:${client}`,{type:'json'});
  const data=JSON.stringify(ideas||null).replace(/</g,'\\u003c');
  return javascript(`window.__ADMIRA_PRESENTATION_CONTENT__=${data};`,ideas?200:404);
}
