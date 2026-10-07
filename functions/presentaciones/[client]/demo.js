import {demoGlobalHTML} from '../../../subdemos/demo-player.mjs';
export async function onRequestGet({params,env}) {
  const client=String(params.client||'').toLowerCase();
  if(!/^[a-z0-9][a-z0-9-]{1,62}$/.test(client))return new Response('Presentación no válida.',{status:400});
  const config=await env.PRESENTATION_IDEAS?.get('presentation:'+client,{type:'json'});
  if(!config?.demoProject)return new Response('Este proyecto aún no tiene un recorrido de demos.',{status:404});
  return new Response(demoGlobalHTML(config.demoProject),{headers:{'content-type':'text/html; charset=utf-8','cache-control':'private, no-store','x-robots-tag':'noindex, nofollow','content-security-policy':"default-src 'self'; script-src 'self'; style-src 'self'; media-src 'self' https:; img-src 'self' https: data:; connect-src 'none'; frame-src 'none'; object-src 'none'; base-uri 'none'"}});
}
