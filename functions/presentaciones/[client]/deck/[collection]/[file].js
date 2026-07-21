import {isDeckAsset} from '../../../_deck-library.js';

export async function onRequestGet(context){
  const collection=String(context.params.collection||''),file=String(context.params.file||'');
  if(!isDeckAsset(collection,file)||!context.env.PRESENTATION_MEDIA)return new Response('No encontrado',{status:404});
  const object=await context.env.PRESENTATION_MEDIA.get(`presentation-library/${collection}/${file}`);
  if(!object)return new Response('No encontrado',{status:404});
  const headers=new Headers();object.writeHttpMetadata(headers);headers.set('content-type','image/webp');headers.set('cache-control','private, max-age=3600');headers.set('x-content-type-options','nosniff');
  return new Response(object.body,{headers});
}
