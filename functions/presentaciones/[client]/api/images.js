import {publicImageSet, recomputeImageSet} from '../../_grok-images.js';

function json(body,status=200){
  return new Response(JSON.stringify(body),{status,headers:{
    'content-type':'application/json; charset=utf-8','cache-control':'no-store, must-revalidate','x-content-type-options':'nosniff'
  }});
}

export async function onRequest(context){
  if(context.request.method!=='GET')return json({error:'Método no permitido.'},405);
  if(!context.env.PRESENTATION_IDEAS)return json({error:'Almacenamiento no configurado.'},503);
  const client=String(context.params.client||'').trim().toLowerCase();
  if(!/^[a-z0-9][a-z0-9-]{1,62}$/.test(client))return json({error:'Presentación no válida.'},400);
  const [presentation,ideas,set]=await Promise.all([
    context.env.PRESENTATION_IDEAS.get(`presentation:${client}`,{type:'json'}),
    context.env.PRESENTATION_IDEAS.get(`ideas:${client}`,{type:'json'}),
    context.env.PRESENTATION_IDEAS.get(`image-set:${client}`,{type:'json'})
  ]);
  if(!presentation||!ideas)return json({error:'Presentación no encontrada.'},404);
  const slideCount=(ideas.skeleton||[]).filter(item=>item?.enabled!==false).length+3;
  return json({ok:true,slideCount,imageSet:publicImageSet(set?recomputeImageSet(set):null)});
}
