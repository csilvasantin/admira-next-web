import {appendVersion,json,listKey,normalizePresite,presiteKey,publicSummary,validatePresite,versionsKey} from '../../_presite.js';
export async function onRequest({request,params,env}){
  if(!env.PRESENTATION_IDEAS)return json({error:'Almacenamiento no configurado.'},503);
  const existing=await env.PRESENTATION_IDEAS.get(presiteKey(params.site),{type:'json'});
  if(!existing)return json({error:'Presite no encontrado.'},404);
  if(request.method==='GET')return json({site:existing});
  if(request.method!=='PUT')return json({error:'Método no permitido.'},405);
  const origin=request.headers.get('origin'),url=new URL(request.url);if(!origin||origin!==url.origin)return json({error:'Origen no permitido.'},403);
  let raw;try{raw=await request.json()}catch(_){return json({error:'JSON no válido.'},400)}
  let site=normalizePresite({...raw,slug:existing.slug},existing),label='storyboard editado';
  if(raw.action==='simulate-publish'){
    site={...existing,status:'review-ready',publication:{mode:'simulation',published:false,simulatedAt:new Date().toISOString()},updatedAt:new Date().toISOString()};
    label='publicación simulada';
  }
  const error=validatePresite(site);if(error)return json({error},400);
  const versions=appendVersion(await env.PRESENTATION_IDEAS.get(versionsKey(site.slug),{type:'json'}),site,label);
  const index=await env.PRESENTATION_IDEAS.get(listKey(),{type:'json'}),summaries=(Array.isArray(index)?index:[]).filter(item=>item.slug!==site.slug);
  summaries.unshift(publicSummary(site));
  await Promise.all([env.PRESENTATION_IDEAS.put(presiteKey(site.slug),JSON.stringify(site)),env.PRESENTATION_IDEAS.put(versionsKey(site.slug),JSON.stringify(versions)),env.PRESENTATION_IDEAS.put(listKey(),JSON.stringify(summaries))]);
  return json({ok:true,site});
}
