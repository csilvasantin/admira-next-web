const MAX_LOGO_BYTES=2*1024*1024;

function extension(contentType){
  return {'image/svg+xml':'svg','image/png':'png','image/jpeg':'jpg','image/webp':'webp','image/gif':'gif'}[String(contentType||'').split(';')[0].trim().toLowerCase()]||'';
}

function clean(value,max=500){return String(value==null?'':value).replace(/\s+/g,' ').trim().slice(0,max);}

async function downloadLogo(candidate){
  if(candidate?.type==='svg'&&candidate.svg){
    const bytes=new TextEncoder().encode(candidate.svg);
    if(bytes.byteLength>MAX_LOGO_BYTES)throw new Error('El logo oficial supera el tamaño permitido.');
    return {bytes,contentType:'image/svg+xml',sourceUrl:clean(candidate.sourceUrl,1000)};
  }
  if(candidate?.type!=='url'||!candidate.url)throw new Error('No hemos encontrado el logo oficial en la web del cliente.');
  const response=await fetch(candidate.url,{headers:{accept:'image/svg+xml,image/png,image/jpeg,image/webp,image/gif;q=.8','user-agent':'ADmiraNeXT Brand Collector/1.0'},redirect:'follow',signal:AbortSignal.timeout(8000)});
  if(!response.ok)throw new Error(`El logo oficial responde con HTTP ${response.status}.`);
  const contentType=(response.headers.get('content-type')||'').split(';')[0].trim().toLowerCase();
  if(!extension(contentType))throw new Error('El recurso detectado como logo no es una imagen compatible.');
  const length=Number(response.headers.get('content-length')||0);if(length>MAX_LOGO_BYTES)throw new Error('El logo oficial supera el tamaño permitido.');
  const bytes=new Uint8Array(await response.arrayBuffer());if(bytes.byteLength>MAX_LOGO_BYTES)throw new Error('El logo oficial supera el tamaño permitido.');
  return {bytes,contentType,sourceUrl:String(response.url||candidate.url)};
}

export async function persistBrandLogo(env,{slug,displayName,website,analysis}){
  if(!env.PRESENTATION_MEDIA)throw new Error('El almacenamiento del logo no está configurado.');
  if(!analysis?.logo)throw new Error(`No hemos encontrado el logo oficial de ${displayName} en ${website}.`);
  const downloaded=await downloadLogo(analysis.logo),ext=extension(downloaded.contentType);
  const key=`presentations/${slug}/brand/logo.${ext}`;
  await env.PRESENTATION_MEDIA.put(key,downloaded.bytes,{httpMetadata:{contentType:downloaded.contentType,cacheControl:'private, max-age=86400'},customMetadata:{client:slug,kind:'official-logo',website:clean(website,500)}});
  return {logoKey:key,logoUrl:`/presentaciones/${slug}/brand/logo`,sourceUrl:downloaded.sourceUrl||website,website,contentType:downloaded.contentType,alt:`Logo de ${displayName}`,capturedAt:new Date().toISOString()};
}
