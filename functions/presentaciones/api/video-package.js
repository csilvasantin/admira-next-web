const MAX_VIDEO_BYTES = 120 * 1024 * 1024;
const MAX_JSON_BYTES = 8 * 1024;
const MAX_PIXERIA_BYTES = 48 * 1024;
const PACKAGE_TTL = 30 * 24 * 60 * 60;
const CLIENT_ID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const PACKAGE_ID_RE = /^pkg-[a-f0-9]{20}$/;
const VIDEO_TYPES = new Map([
  ['video/mp4', 'mp4'],
  ['video/webm', 'webm'],
  ['video/quicktime', 'mov']
]);
const PIXERIA_PUBLISH_URL = 'https://api.admira.store/stock/publish';

function json(payload, status = 200){
  return Response.json(payload, {status, headers:{
    'cache-control':'no-store',
    'content-type':'application/json; charset=utf-8',
    'x-content-type-options':'nosniff'
  }});
}

function sameOrigin(request){
  const origin = request.headers.get('origin');
  if(!origin) return true;
  try{ return new URL(origin).origin === new URL(request.url).origin; }
  catch(_){ return false; }
}

function clean(value, maxLength){
  return String(value == null ? '' : value)
    .replace(/[\u0000-\u001f\u007f]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, maxLength);
}

async function digest(value){
  const bytes = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return Array.from(new Uint8Array(bytes)).map(byte => byte.toString(16).padStart(2, '0')).join('');
}

async function readJsonLimited(source, maxBytes){
  const declared = Number(source.headers.get('content-length') || 0);
  if(declared > maxBytes) throw new Error('body_too_large');
  if(!source.body) throw new Error('body_empty');
  const reader = source.body.getReader();
  const chunks = [];
  let total = 0;
  try{
    while(true){
      const {done, value} = await reader.read();
      if(done) break;
      total += value.byteLength;
      if(total > maxBytes){ await reader.cancel(); throw new Error('body_too_large'); }
      chunks.push(value);
    }
  }finally{ reader.releaseLock(); }
  const bytes = new Uint8Array(total);
  let offset = 0;
  for(const chunk of chunks){ bytes.set(chunk, offset); offset += chunk.byteLength; }
  try{ return JSON.parse(new TextDecoder().decode(bytes)); }
  catch(_){ throw new Error('json_invalid'); }
}

async function publishToPixeria(context, state){
  if(!context.env.PIXERIA_INGEST_TOKEN) return {...state, pixeria:{status:'failed', error:'Pixeria no está conectado.'}};
  const body = {
    type:'video',
    motor:'ADmiraNeXT TikTok Composer',
    prompt:'',
    title:state.title || 'Anuncio vertical · 25 segundos',
    comment:'Master final compuesto: preroll 5s + anuncio Grok 15s + postroll 5s.',
    sourceUrl:state.sourceUrl,
    mime:state.contentType,
    externalId:`admiranext:tiktok-package:${state.id}`,
    // 'vertical' NO es decorativa: es la llave de emisión. El canal de admira.tv
    // segmenta por etiquetas (?tag=tiktok,vertical) y así el MUPI vertical del
    // Xtanco emite estas piezas en 9:16 nativo en vez de recortar un horizontal.
    tags:['tiktok', 'vertical', 'anuncio', '25s'],
    quality:'best'
  };
  let response;
  let payload = {};
  try{
    const publishFetch = context.data?.pixeriaFetch || fetch;
    response = await publishFetch(new Request(PIXERIA_PUBLISH_URL, {
      method:'POST',
      headers:{
        'content-type':'application/json',
        accept:'application/json',
        'x-admiranext-ingest':context.env.PIXERIA_INGEST_TOKEN
      },
      body:JSON.stringify(body)
    }));
    payload = await readJsonLimited(response, MAX_PIXERIA_BYTES);
  }catch(error){
    console.error('video-package:pixeria-fetch', JSON.stringify({id:state.id, message:String(error?.message || error).slice(0, 300)}));
    return {...state, pixeria:{status:'failed', error:'Pixeria no respondió durante la publicación.'}};
  }
  if(!response.ok || !payload?.ok || !payload?.id || !payload?.url){
    console.error('video-package:pixeria-rejected', JSON.stringify({
      id:state.id, status:response.status, providerError:String(payload?.error || '').slice(0, 100),
      providerDetail:String(payload?.detail || '').slice(0, 180), providerStatus:Number(payload?.status || 0)
    }));
    return {...state, pixeria:{status:'failed', error:`Pixeria rechazó el master${payload?.error ? ` (${clean(payload.error, 80)})` : ''}.`}};
  }
  return {...state, pixeria:{
    status:'published', id:String(payload.id), assetUrl:String(payload.url),
    stockUrl:`https://www.pixeria.com/stock.html?highlight=${encodeURIComponent(String(payload.id))}`
  }};
}

function publicState(state){
  return {ok:true, id:state.id, size:state.size, contentType:state.contentType, duration:25, pixeria:state.pixeria};
}

async function saveState(env, state){
  await env.PRESENTATION_IDEAS.put(`tiktok:video-package:${state.id}`, JSON.stringify(state), {expirationTtl:PACKAGE_TTL});
}

async function createPackage(context){
  const {request, env} = context;
  if(!env.PRESENTATION_MEDIA || !env.PRESENTATION_IDEAS) return json({error:'El almacenamiento del montaje no está configurado.'}, 503);
  const clientRequestId = request.headers.get('x-client-request-id') || '';
  if(!CLIENT_ID_RE.test(clientRequestId)) return json({error:'Identificador de montaje no válido.'}, 400);
  const contentType = String(request.headers.get('content-type') || '').split(';')[0].trim().toLowerCase();
  const extension = VIDEO_TYPES.get(contentType);
  if(!extension) return json({error:'El montaje debe ser MP4, WebM o MOV.'}, 415);
  const declared = Number(request.headers.get('content-length') || 0);
  if(!Number.isFinite(declared) || declared < 1024) return json({error:'El archivo de vídeo está vacío o no declara su tamaño.'}, 400);
  if(declared > MAX_VIDEO_BYTES) return json({error:'El montaje supera el límite de 120 MB.'}, 413);

  const id = `pkg-${(await digest(clientRequestId)).slice(0, 20)}`;
  const stateKey = `tiktok:video-package:${id}`;
  const existing = await env.PRESENTATION_IDEAS.get(stateKey, {type:'json'});
  if(existing?.pixeria?.status === 'published') return json(publicState(existing));

  const token = existing?.token || crypto.randomUUID().replace(/-/g, '') + crypto.randomUUID().replace(/-/g, '');
  const key = `tiktok/packages/${id}-${token}.${extension}`;
  let stored = null;
  try{
    // El cuerpo nativo de Request conserva la longitud declarada por el navegador.
    // No debe pasar por TransformStream: al hacerlo se pierde esa longitud conocida
    // y R2 rechaza vídeos reales con un 502 aunque estén muy por debajo del límite.
    // Cloudflare ya limita el request completo y, después del put, contrastamos el
    // tamaño que R2 almacenó para detectar una transferencia incompleta.
    stored = await env.PRESENTATION_MEDIA.put(key, request.body, {
      httpMetadata:{contentType, cacheControl:'public, max-age=31536000, immutable'},
      customMetadata:{kind:'tiktok-package', duration:'25', id}
    });
  }catch(error){
    console.error('video-package:r2-put', JSON.stringify({id, declared, contentType, message:String(error?.message || error).slice(0, 300)}));
    return json({error:'No pudimos guardar el montaje final en el almacenamiento.', code:'package_storage_failed'}, 502);
  }
  const streamed = Number(stored?.size);
  if(!Number.isFinite(streamed) || streamed !== declared){
    await env.PRESENTATION_MEDIA.delete(key).catch(() => {});
    return json({error:'La transferencia del montaje quedó incompleta.', code:'package_size_mismatch'}, 400);
  }

  let title = 'Anuncio vertical · 25 segundos';
  try{ title = clean(decodeURIComponent(request.headers.get('x-package-title') || ''), 180) || title; }catch(_){ /* Default title. */ }
  const origin = new URL(request.url).origin;
  let state = {
    id, token, key, title, size:streamed, contentType,
    sourceUrl:`${origin}/tiktok/media/${id}/${token}`,
    createdAt:new Date().toISOString(), pixeria:{status:'uploading'}
  };
  await saveState(env, state);
  state = await publishToPixeria(context, state);
  await saveState(env, state);
  return json(publicState(state), state.pixeria.status === 'published' ? 201 : 202);
}

async function retryPackage(context){
  let body;
  try{ body = await readJsonLimited(context.request, MAX_JSON_BYTES); }
  catch(_){ return json({error:'No pudimos leer el montaje que quieres reintentar.'}, 400); }
  const id = clean(body?.id, 32);
  if(!PACKAGE_ID_RE.test(id)) return json({error:'Montaje no válido.'}, 400);
  let state = await context.env.PRESENTATION_IDEAS?.get(`tiktok:video-package:${id}`, {type:'json'});
  if(!state) return json({error:'Este montaje ya no está disponible para reintentar.'}, 404);
  if(state.pixeria?.status !== 'published'){
    state = await publishToPixeria(context, state);
    await saveState(context.env, state);
  }
  return json(publicState(state), state.pixeria?.status === 'published' ? 200 : 202);
}

export async function onRequest(context){
  if(!sameOrigin(context.request)) return json({error:'Origen no permitido.'}, 403);
  if(context.request.method === 'POST') return createPackage(context);
  if(context.request.method === 'PUT') return retryPackage(context);
  return json({error:'Método no permitido.'}, 405);
}
