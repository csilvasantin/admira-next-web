import {presiteKey,renderPresite,slugify} from '../_presite.js';
export async function onRequestGet({params,env}){
  const site=env.PRESENTATION_IDEAS&&await env.PRESENTATION_IDEAS.get(presiteKey(params.site),{type:'json'});
  if(!site)return new Response('Presite no encontrado',{status:404});
  return new Response(renderPresite(site),{headers:{'content-type':'text/html; charset=utf-8','content-disposition':`attachment; filename="${slugify(site.displayName)}-home.html"`,'cache-control':'no-store'}});
}
