import {appendVersion,json,listKey,presiteKey,publicSummary,versionsKey} from '../../_presite.js';
export async function onRequest({request,params,env}){
  if(!env.PRESENTATION_IDEAS)return json({error:'Almacenamiento no configurado.'},503);
  const versions=await env.PRESENTATION_IDEAS.get(versionsKey(params.site),{type:'json'}),items=Array.isArray(versions)?versions:[];
  if(request.method==='GET')return json({versions:items.map(({site,...item})=>({...item,quality:site?.quality,language:site?.language}))});
  if(request.method!=='POST')return json({error:'Método no permitido.'},405);
  const origin=request.headers.get('origin'),url=new URL(request.url);if(!origin||origin!==url.origin)return json({error:'Origen no permitido.'},403);
  let raw;try{raw=await request.json()}catch(_){return json({error:'JSON no válido.'},400)}
  const selected=items.find(item=>item.id===raw.id);if(!selected?.site)return json({error:'Versión no encontrada.'},404);
  const site={...selected.site,updatedAt:new Date().toISOString()},next=appendVersion(items,site,'versión restaurada');
  const index=await env.PRESENTATION_IDEAS.get(listKey(),{type:'json'}),summaries=(Array.isArray(index)?index:[]).filter(item=>item.slug!==site.slug);summaries.unshift(publicSummary(site));
  await Promise.all([env.PRESENTATION_IDEAS.put(presiteKey(site.slug),JSON.stringify(site)),env.PRESENTATION_IDEAS.put(versionsKey(site.slug),JSON.stringify(next)),env.PRESENTATION_IDEAS.put(listKey(),JSON.stringify(summaries))]);
  return json({ok:true,site});
}
