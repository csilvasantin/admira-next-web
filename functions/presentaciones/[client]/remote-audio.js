// Inherits the private /presentaciones gate; reads prepared local narration only.
const PRIVATE_HEADERS = {'cache-control':'private, no-store','x-robots-tag':'noindex, nofollow','x-content-type-options':'nosniff'};
function json(value,status=200,extraHeaders={}){return new Response(JSON.stringify(value),{status,headers:{...PRIVATE_HEADERS,'content-type':'application/json; charset=utf-8',...extraHeaders}});}
function validId(value){
  return typeof value==='string'&&value.length<=80&&(/^(?:s(?:00[1-9]|0[1-9][0-9]|[1-9][0-9]{2}))$/.test(value)||/^d-(?:studio|store|biz)-[a-z0-9]+(?:-[a-z0-9]+)*-p(?:0[1-9]|[1-9][0-9])$/.test(value));
}
export async function onRequestGet({request,params,env}){
  const client=String(params.client||'').toLowerCase(),query=new URL(request.url).searchParams;
  const lang=query.get('lang')??'es',id=query.get('id');
  if(!/^[a-z0-9][a-z0-9-]{0,79}$/.test(client)||!['es','en','ca'].includes(lang)||query.getAll('lang').length>1||query.getAll('id').length>1||(id!==null&&!validId(id)))return json({error:'invalid_audio_request'},400);
  // PRESENTATION_MEDIA is the deployed binding shared with protected slide media.
  const bucket=env.PRESENTATION_MEDIA;
  if(!bucket)return json({error:'audio_storage_unavailable'},503);
  const prefix=`presentations/${client}/remote/audio/`;
  try{
    if(id!==null){
      const key=`${prefix}${lang}-${id}.m4a`,rangeHeader=request.headers.get('range');
      let range=null,size=null;
      if(rangeHeader!==null){
        const match=/^bytes=(\d*)-(\d*)$/.exec(rangeHeader);
        if(!match||(!match[1]&&!match[2]))return json({error:'invalid_audio_range'},416);
        const metadata=await bucket.head(key);if(!metadata)return json({error:'audio_not_found'},404);
        size=metadata.size;
        const first=match[1]?Number(match[1]):null,last=match[2]?Number(match[2]):null;
        const start=first===null?Math.max(0,size-last):first,end=first===null?size-1:(last===null?size-1:Math.min(last,size-1));
        if(!Number.isSafeInteger(size)||size<=0||(first!==null&&!Number.isSafeInteger(first))||(last!==null&&(!Number.isSafeInteger(last)||(first===null&&last===0)))||start>=size||end<start)return json({error:'invalid_audio_range'},416,Number.isSafeInteger(size)&&size>=0?{'content-range':`bytes */${size}`}:{ });
        range={offset:start,length:end-start+1};
      }
      const object=await bucket.get(key,range?{range}:undefined);
      if(!object?.body)return json({error:'audio_not_found'},404);
      const headers={...PRIVATE_HEADERS,'content-type':'audio/mp4','content-disposition':`inline; filename="${lang}-${id}.m4a"`,'accept-ranges':'bytes'};
      if(range){headers['content-length']=String(range.length);headers['content-range']=`bytes ${range.offset}-${range.offset+range.length-1}/${size}`;}
      else if(Number.isSafeInteger(object.size)&&object.size>=0)headers['content-length']=String(object.size);
      return new Response(object.body,{status:range?206:200,headers});
    }
    const object=await bucket.get(`${prefix}manifest-${lang}.json`);
    if(!object)return json({error:'audio_manifest_not_found'},404);
    let manifest;try{manifest=await object.json();}catch{return json({error:'invalid_audio_manifest'},502);}
    if(manifest?.version!==1||manifest.lang!==lang||!['macOS say','macOS say · Mónica'].includes(manifest.source)||!Array.isArray(manifest.segments)||manifest.segments.length>200)return json({error:'invalid_audio_manifest'},502);
    const seen=new Set(),segments=[];
    for(const segment of manifest.segments){
      if(!validId(segment?.id)||typeof segment.duration!=='number'||!Number.isFinite(segment.duration)||segment.duration<=0||segment.duration>=600||typeof segment.textHash!=='string'||!/^[a-f0-9]{64}$/.test(segment.textHash)||seen.has(segment.id))return json({error:'invalid_audio_manifest'},502);
      seen.add(segment.id);segments.push({id:segment.id,duration:segment.duration,textHash:segment.textHash,url:`/presentaciones/${client}/remote-audio?lang=${lang}&id=${segment.id}`});
    }
    return json({version:1,lang,source:'macOS say',segments});
  }catch{return json({error:'audio_storage_unavailable'},503);}
}
