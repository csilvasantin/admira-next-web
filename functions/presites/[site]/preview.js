import {presiteKey,renderPresite} from '../_presite.js';
export async function onRequestGet({params,env}){
  const site=env.PRESENTATION_IDEAS&&await env.PRESENTATION_IDEAS.get(presiteKey(params.site),{type:'json'});
  if(!site)return new Response('Presite no encontrado',{status:404});
  return new Response(renderPresite(site,{preview:true}),{headers:{'content-type':'text/html; charset=utf-8','cache-control':'no-store','content-security-policy':"default-src 'none'; style-src 'unsafe-inline'; script-src 'unsafe-inline'; img-src data:; media-src 'none'; connect-src 'none'; base-uri 'none'; form-action 'none'; frame-ancestors 'self'"}});
}
