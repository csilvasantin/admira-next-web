import {publicPresiteOpening} from '../_presite-opening.js';

function json(body,status=200){return new Response(JSON.stringify(body),{status,headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store','x-content-type-options':'nosniff'}})}

export async function onRequestGet(context){
  if(!context.env.PRESENTATION_IDEAS)return json({error:'Almacenamiento no configurado.'},503);
  const found=await context.env.PRESENTATION_IDEAS.list({prefix:'presentation:'});
  const clients=(await Promise.all(found.keys.map(async key=>{
    const item=await context.env.PRESENTATION_IDEAS.get(key.name,{type:'json'}); if(!item)return null;
    return {slug:item.slug,displayName:item.displayName,website:item.website||'',inspirationUrl:item.inspirationUrl||'',inspiration:item.inspiration?{host:item.inspiration.host||'',title:item.inspiration.title||'',profile:item.inspiration.profile||''}:null,brand:item.brand?{logoUrl:item.brand.logoUrl||'',website:item.brand.website||''}:null,problem:item.problem||'',theme:item.theme||{},outputs:item.outputs||[],presite:publicPresiteOpening(item.presite,item.slug),createdAt:item.createdAt,updatedAt:item.updatedAt};
  }))).filter(Boolean).sort((a,b)=>String(b.createdAt||b.updatedAt||'').localeCompare(String(a.createdAt||a.updatedAt||'')));
  return json({clients});
}
