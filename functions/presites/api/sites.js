import {appendVersion,json,listKey,normalizePresite,presiteKey,publicSummary,validatePresite,versionsKey} from '../_presite.js';

export async function onRequest(context){
  const {request,env}=context;
  if(!env.PRESENTATION_IDEAS)return json({error:'Almacenamiento de Presites no configurado.'},503);
  if(request.method==='GET'){
    const index=await env.PRESENTATION_IDEAS.get(listKey(),{type:'json'});
    return json({sites:Array.isArray(index)?index:[]});
  }
  if(request.method!=='PUT')return json({error:'Método no permitido.'},405);
  const url=new URL(request.url),origin=request.headers.get('origin');
  if(!origin||origin!==url.origin)return json({error:'Origen no permitido.'},403);
  let raw;try{raw=await request.json()}catch(_){return json({error:'JSON no válido.'},400)}
  const draft=normalizePresite(raw);
  const error=validatePresite(draft);if(error)return json({error},400);
  if(['api','generador','assets','index'].includes(draft.slug))return json({error:'Ese identificador está reservado.'},400);
  const existing=await env.PRESENTATION_IDEAS.get(presiteKey(draft.slug),{type:'json'});
  if(existing&&raw.overwrite!==true)return json({error:'Ya existe un Presite con ese identificador.',exists:true,slug:draft.slug},409);
  const site=normalizePresite(raw,existing);
  const versions=appendVersion(await env.PRESENTATION_IDEAS.get(versionsKey(site.slug),{type:'json'}),site,existing?'presite regenerado':'presite creado');
  const index=await env.PRESENTATION_IDEAS.get(listKey(),{type:'json'}),summaries=(Array.isArray(index)?index:[]).filter(item=>item.slug!==site.slug);
  summaries.unshift(publicSummary(site));
  await Promise.all([
    env.PRESENTATION_IDEAS.put(presiteKey(site.slug),JSON.stringify(site)),
    env.PRESENTATION_IDEAS.put(versionsKey(site.slug),JSON.stringify(versions)),
    env.PRESENTATION_IDEAS.put(listKey(),JSON.stringify(summaries))
  ]);
  return json({ok:true,site:publicSummary(site),studioUrl:`/presites/${site.slug}/`,previewUrl:`/presites/${site.slug}/preview`},existing?200:201);
}
