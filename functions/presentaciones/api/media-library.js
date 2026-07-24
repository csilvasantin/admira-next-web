import {normalizeSlideMedia} from '../_slide-media.js';

const INVENTORY_LIMIT = 80;
const MAX_MULTIPART_BYTES = 40 * 1024 * 1024 + 256 * 1024;
const LIMITS = {
  image:10 * 1024 * 1024,
  audio:25 * 1024 * 1024,
  video:40 * 1024 * 1024
};

function json(body, status = 200){
  return new Response(JSON.stringify(body), {status, headers:{
    'content-type':'application/json; charset=utf-8',
    'cache-control':'no-store, must-revalidate',
    'x-content-type-options':'nosniff'
  }});
}

function cleanClient(value){
  const client=String(value||'').trim().toLowerCase();
  return /^[a-z0-9][a-z0-9-]{1,62}$/.test(client)?client:'';
}

function cleanText(value, max=180){
  return String(value==null?'':value).replace(/\r\n?/g,'\n').trim().slice(0,max);
}

function sameOrigin(request){
  const origin=request.headers.get('Origin');
  return Boolean(origin)&&origin===new URL(request.url).origin;
}

function mediaType(bytes){
  if(bytes[0]===0x89&&bytes[1]===0x50&&bytes[2]===0x4e&&bytes[3]===0x47)return {kind:'image',extension:'png',contentType:'image/png'};
  if(bytes[0]===0xff&&bytes[1]===0xd8)return {kind:'image',extension:'jpg',contentType:'image/jpeg'};
  if(bytes[0]===0x52&&bytes[1]===0x49&&bytes[2]===0x46&&bytes[3]===0x46&&bytes[8]===0x57&&bytes[9]===0x45&&bytes[10]===0x42&&bytes[11]===0x50)return {kind:'image',extension:'webp',contentType:'image/webp'};
  if(bytes[0]===0x47&&bytes[1]===0x49&&bytes[2]===0x46&&bytes[3]===0x38)return {kind:'image',extension:'gif',contentType:'image/gif'};
  if(bytes[0]===0x49&&bytes[1]===0x44&&bytes[2]===0x33||bytes[0]===0xff&&(bytes[1]&0xe0)===0xe0)return {kind:'audio',extension:'mp3',contentType:'audio/mpeg'};
  if(bytes[0]===0x52&&bytes[1]===0x49&&bytes[2]===0x46&&bytes[3]===0x46&&bytes[8]===0x57&&bytes[9]===0x41&&bytes[10]===0x56&&bytes[11]===0x45)return {kind:'audio',extension:'wav',contentType:'audio/wav'};
  if(bytes[0]===0x1a&&bytes[1]===0x45&&bytes[2]===0xdf&&bytes[3]===0xa3)return {kind:'video',extension:'webm',contentType:'video/webm'};
  const box=String.fromCharCode(...bytes.slice(4,12));
  if(box.startsWith('ftyp')){
    const brand=box.slice(4).toLowerCase();
    if(['m4a ','m4b ','f4a '].includes(brand))return {kind:'audio',extension:'m4a',contentType:'audio/mp4'};
    return {kind:'video',extension:'mp4',contentType:'video/mp4'};
  }
  return null;
}

function publicAsset(asset){
  return {
    id:asset.id,
    name:asset.name,
    kind:asset.kind,
    contentType:asset.contentType,
    size:asset.size,
    url:asset.url,
    uploadedAt:asset.uploadedAt,
    acceptedByCarlos:asset.acceptedByCarlos===true,
    acceptedAt:asset.acceptedAt||'',
    approvalNote:asset.approvalNote||'',
    assignedSlides:Array.isArray(asset.assignedSlides)?asset.assignedSlides:[]
  };
}

async function inputs(env, client){
  const [presentation,ideas,library]=await Promise.all([
    env.PRESENTATION_IDEAS.get(`presentation:${client}`,{type:'json'}),
    env.PRESENTATION_IDEAS.get(`ideas:${client}`,{type:'json'}),
    env.PRESENTATION_IDEAS.get(`media-library:${client}`,{type:'json'})
  ]);
  return {presentation,ideas,library:Array.isArray(library)?library:[]};
}

function slidesFrom(ideas){
  const rows=[
    {id:'cover',title:cleanText(ideas?.hero?.title,100)||'Portada'},
    {id:'objective',title:'Objetivo'},
    ...(Array.isArray(ideas?.skeleton)?ideas.skeleton:[])
      .filter(item=>item&&item.enabled!==false&&/^[a-z0-9][a-z0-9_-]{0,79}$/i.test(String(item.id||'')))
      .map(item=>({id:String(item.id).toLowerCase(),title:cleanText(item.title,100)||String(item.id)})),
    {id:'closing',title:cleanText(ideas?.closing?.title,100)||'Cierre'}
  ];
  return rows;
}

function payload(data, client){
  return {
    ok:true,
    client,
    assets:data.library.slice(0,INVENTORY_LIMIT).map(publicAsset),
    slides:slidesFrom(data.ideas),
    slideMedia:Array.isArray(data.presentation?.slideMedia)?data.presentation.slideMedia:[]
  };
}

export async function onRequestGet(context){
  if(!context.env.PRESENTATION_IDEAS)return json({error:'La biblioteca multimedia no está configurada.'},503);
  const client=cleanClient(new URL(context.request.url).searchParams.get('client'));
  if(!client)return json({error:'Presentación no válida.'},400);
  const data=await inputs(context.env,client);
  if(!data.presentation||!data.ideas)return json({error:'No encontramos esta presentación.'},404);
  return json(payload(data,client));
}

export async function onRequestPost(context){
  if(!sameOrigin(context.request))return json({error:'Origen no permitido.'},403);
  if(!context.env.PRESENTATION_IDEAS||!context.env.PRESENTATION_MEDIA)return json({error:'La biblioteca multimedia no está configurada.'},503);
  if(Number(context.request.headers.get('Content-Length')||0)>MAX_MULTIPART_BYTES)return json({error:'El archivo supera el límite de 40 MB.'},413);
  let form;
  try{form=await context.request.formData()}catch(_){return json({error:'Formulario de subida no válido.'},400)}
  const client=cleanClient(form.get('client'));
  if(!client)return json({error:'Presentación no válida.'},400);
  if(form.get('acceptedByCarlos')!=='true')return json({error:'Carlos debe aceptar expresamente el recurso antes de incorporarlo.'},422);
  const file=form.get('file');
  if(!file||typeof file.arrayBuffer!=='function'||!Number.isFinite(Number(file.size)))return json({error:'Selecciona una imagen, un audio o un vídeo.'},400);
  if(file.size<4||file.size>LIMITS.video)return json({error:'El archivo debe pesar entre 4 bytes y 40 MB.'},413);
  const data=await inputs(context.env,client);
  if(!data.presentation||!data.ideas)return json({error:'No encontramos esta presentación.'},404);
  if(data.library.length>=INVENTORY_LIMIT)return json({error:`La biblioteca admite un máximo de ${INVENTORY_LIMIT} recursos.`},409);
  const bytes=new Uint8Array(await file.arrayBuffer());
  const type=mediaType(bytes);
  if(!type)return json({error:'Formato no admitido. Usa PNG, JPEG, WebP, GIF, MP3, WAV, M4A, MP4 o WebM.'},415);
  if(bytes.byteLength>LIMITS[type.kind]){
    const mb=Math.round(LIMITS[type.kind]/1024/1024);
    return json({error:`El ${type.kind==='image'?'archivo de imagen':type.kind==='audio'?'audio':'vídeo'} supera el límite de ${mb} MB.`},413);
  }
  const id=crypto.randomUUID().replace(/-/g,'').slice(0,16);
  const filename=`library-es-${id}.${type.extension}`;
  const url=`/presentaciones/${client}/media/${filename}`;
  const objectKey=`presentations/${client}/es/${filename}`;
  const now=new Date().toISOString();
  const asset={
    id,
    name:cleanText(file.name,120)||`recurso.${type.extension}`,
    kind:type.kind,
    contentType:type.contentType,
    size:bytes.byteLength,
    url,
    objectKey,
    uploadedAt:now,
    acceptedByCarlos:true,
    acceptedAt:now,
    approvalNote:cleanText(form.get('approvalNote'),240)||'Aceptado por Carlos desde el generador de presentaciones.',
    assignedSlides:[]
  };
  await context.env.PRESENTATION_MEDIA.put(objectKey,bytes,{
    httpMetadata:{contentType:type.contentType,cacheControl:'private, max-age=3600'},
    customMetadata:{client,kind:type.kind,assetId:id,acceptedByCarlos:'true',acceptedAt:now}
  });
  data.library.unshift(asset);
  await context.env.PRESENTATION_IDEAS.put(`media-library:${client}`,JSON.stringify(data.library));
  return json(payload(data,client),201);
}

export async function onRequestPut(context){
  if(!sameOrigin(context.request))return json({error:'Origen no permitido.'},403);
  if(!context.env.PRESENTATION_IDEAS)return json({error:'La biblioteca multimedia no está configurada.'},503);
  let body;
  try{body=await context.request.json()}catch(_){return json({error:'JSON no válido.'},400)}
  const client=cleanClient(body.client);
  const assetId=cleanText(body.assetId,40);
  const slide=cleanText(body.slide,80).toLowerCase();
  if(!client||!/^[a-f0-9]{16}$/.test(assetId)||!slide)return json({error:'Asignación no válida.'},400);
  const data=await inputs(context.env,client);
  if(!data.presentation||!data.ideas)return json({error:'No encontramos esta presentación.'},404);
  const asset=data.library.find(item=>item.id===assetId);
  if(!asset)return json({error:'El recurso ya no existe en esta biblioteca.'},404);
  if(asset.acceptedByCarlos!==true)return json({error:'El recurso no tiene la aceptación final de Carlos.'},422);
  if(!slidesFrom(data.ideas).some(item=>item.id===slide))return json({error:'La diapositiva no existe.'},404);
  const current=(Array.isArray(data.presentation.slideMedia)?data.presentation.slideMedia:[]).filter(item=>String(item?.slide||'').toLowerCase()!==slide);
  current.push({
    slide,
    type:asset.kind,
    src:asset.url,
    caption:cleanText(body.caption,180)||asset.name,
    fallback:cleanText(body.fallback,240)||'El contenido multimedia no está disponible. Continúa con el relato de la diapositiva.',
    preload:'metadata',
    autoplay:false,
    loop:false,
    rights:{
      source:'Biblioteca multimedia de la presentación',
      permission:'granted',
      license:'Aceptación final de Carlos',
      holder:'Carlos Silva',
      acceptedByCarlos:true,
      acceptedAt:asset.acceptedAt,
      approvalNote:asset.approvalNote
    }
  });
  let normalized;
  try{normalized=normalizeSlideMedia(current,client)}catch(error){return json({error:error.message},422)}
  const now=new Date().toISOString();
  data.presentation.slideMedia=normalized;
  data.presentation.updatedAt=now;
  for(const item of data.library){
    item.assignedSlides=(Array.isArray(item.assignedSlides)?item.assignedSlides:[]).filter(value=>value!==slide);
  }
  asset.assignedSlides.push(slide);
  await Promise.all([
    context.env.PRESENTATION_IDEAS.put(`presentation:${client}`,JSON.stringify(data.presentation)),
    context.env.PRESENTATION_IDEAS.put(`media-library:${client}`,JSON.stringify(data.library))
  ]);
  return json(payload(data,client));
}
