import { saneaFicha } from './_ficha-video.mjs';

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
const PIXERIA_ID_RE = /^(?:\d{10,16}-[a-z0-9]{4,16}|auto-[a-f0-9]{20})$/i;

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

async function stockIdDerivado(externalId){
  return `auto-${(await digest(externalId)).slice(0, 20)}`;
}

// ¿Existe ya la identidad estable en el Stock? Primero /stock/exists (el Stock
// lo tiene desde v.11.09.2026.r1: devuelve id y contentHash sin bajar nada);
// si no responde, GET del asset con Range 0-0. Si existe, el máster nuevo la
// SUSTITUYE (o se reutiliza si es idéntico) y la UI lo dice.
async function existeEnStock(publishFetch, externalId, idPrevisto){
  try{
    const response = await publishFetch(new Request(`https://api.admira.store/stock/exists?externalId=${encodeURIComponent(externalId)}`, {method:'GET', headers:{accept:'application/json'}}));
    if(response.ok){
      const payload = await readJsonLimited(response, MAX_JSON_BYTES);
      if(payload?.ok === true) return {exists:payload.exists === true, id:payload.exists ? String(payload.id || idPrevisto) : '', contentHash:payload.contentHash || null, via:'exists'};
    }else{ try{ await response.body?.cancel(); }catch(_){ /* nada */ } }
  }catch(_){ /* Sin /stock/exists: se pregunta por el asset. */ }
  try{
    const response = await publishFetch(new Request(`https://api.admira.store/stock/asset/${idPrevisto}`, {method:'GET', headers:{range:'bytes=0-0'}}));
    try{ await response.body?.cancel(); }catch(_){ /* Solo interesa el estado. */ }
    const exists = response.status === 200 || response.status === 206;
    return {exists, id:exists ? idPrevisto : '', contentHash:null, via:'range'};
  }catch(_){ return {exists:false, id:'', contentHash:null, via:'none'}; }
}

// sha256 hex del máster ya guardado en R2 (se lee de vuelta: el put necesita el
// body nativo con longitud conocida y no admite un tee). Con DigestStream si el
// runtime lo tiene (Workers); si no, se acumula en memoria (tests en Node).
async function hashDelMaster(env, key){
  try{
    const object = await env.PRESENTATION_MEDIA.get(key);
    if(!object?.body) return null;
    if(typeof crypto.DigestStream === 'function'){
      const digestStream = new crypto.DigestStream('SHA-256');
      await object.body.pipeTo(digestStream);
      return Array.from(new Uint8Array(await digestStream.digest)).map(byte => byte.toString(16).padStart(2, '0')).join('');
    }
    const bytes = new Uint8Array(await new Response(object.body).arrayBuffer());
    return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', bytes))).map(byte => byte.toString(16).padStart(2, '0')).join('');
  }catch(error){
    console.error('video-package:hash', JSON.stringify({key, message:String(error?.message || error).slice(0, 200)}));
    return null;
  }
}

async function publishToPixeria(context, state){
  if(!context.env.PIXERIA_INGEST_TOKEN) return {...state, pixeria:{status:'failed', error:'Pixeria no está conectado.'}};
  const publishFetch = context.data?.pixeriaFetch || fetch;
  if(state.ficha?.externalId && !state.replacedOnce && state.sustituye == null){
    const idPrevisto = await stockIdDerivado(state.ficha.externalId);
    const previa = await existeEnStock(publishFetch, state.ficha.externalId, idPrevisto);
    // Misma identidad y mismo contenido: el Stock responderá reused; distinto: sustituye.
    state = {...state, sustituye:previa.exists ? previa.id : '', identica:Boolean(previa.exists && previa.contentHash && state.contentHash && previa.contentHash === state.contentHash)};
  }
  const body = {
    type:'video',
    motor:'ADmiraNeXT TikTok Composer',
    prompt:'',
    title:state.title || 'Anuncio vertical · 25 segundos',
    comment:state.ficha?.comment || 'Master final compuesto: preroll 5s + anuncio Grok 15s + postroll 5s.',
    sourceUrl:state.sourceUrl,
    mime:state.contentType,
    // Un producto de catálogo trae su propia clave (x-package-ficha): el Stock
    // deriva el id del asset de ella, así que el catálogo sabe si ya existe.
    externalId:state.ficha?.externalId || `admiranext:tiktok-package:${state.id}`,
    // 'vertical' NO es decorativa: es la llave de emisión. El canal de admira.tv
    // segmenta por etiquetas (?tag=tiktok,vertical) y así el MUPI vertical del
    // Xtanco emite estas piezas en 9:16 nativo en vez de recortar un horizontal.
    tags:state.ficha?.tags || ['tiktok', 'vertical', 'anuncio', '25s'],
    // Pieza de catálogo (Yokup #3183): meta con la que el Stock de Pixeria la
    // agrupa en la opción «Catálogo» y la asigna a players. Sin catálogo no va.
    ...(state.ficha?.catalogo ? {catalogo:state.ficha.catalogo} : {}),
    quality:'best',
    // sha256 del máster: el Stock deduplica por contenido sin bajar nada.
    ...(state.contentHash ? {contentHash:state.contentHash} : {}),
    // Póster representativo (data URL JPEG 540×960) y veredicto de la validación
    // que el creador preparó ANTES de subir el máster (Yokup #3199): el Stock lo
    // guarda en stock/<id>/poster.jpg y los consumidores nunca pintan el frame 0.
    ...(state.poster ? {poster:state.poster, ...(state.posterAt != null ? {posterAt:state.posterAt} : {})} : {}),
    ...(state.validacion ? {validacion:state.validacion} : {})
  };
  let response;
  let payload = {};
  try{
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
  // Identidad ESTABLE ya ocupada (reused): el Stock devuelve la pieza vieja sin
  // tocarla. Para un encargo (admiranext:xtore:<lane>, catálogo…) el máster más
  // nuevo debe ocupar el hueco —p. ej. el bruto «sin rótulo» publicado como
  // fallback cede al máster con rótulo— así que se retira la vieja y se vuelve
  // a publicar UNA vez. Sin identidad propia no hay hueco que disputar.
  //
  // Desde el Stock v.11.09.2026.r1 esto lo hace el propio worker: si el contenido
  // cambió responde `replaced:true` (ya es el máster nuevo) y si es idéntico
  // responde `reused` con `reason` — en ambos casos no hay nada que retirar. La
  // danza borrar+republicar queda SOLO para un worker antiguo (sin `reason`).
  // El DELETE exige ahora la misma cabecera que el publish.
  if(response.ok && payload?.ok && payload?.reused && !payload?.reason && state.ficha?.externalId && !state.replacedOnce && PIXERIA_ID_RE.test(String(payload.id || ''))){
    try{
      const removed = await publishFetch(new Request(`https://api.admira.store/stock/${encodeURIComponent(String(payload.id))}`, {
        method:'DELETE',
        headers:{accept:'application/json', 'x-admiranext-ingest':context.env.PIXERIA_INGEST_TOKEN}
      }));
      console.log('video-package:pixeria-replace', JSON.stringify({id:state.id, previous:String(payload.id), removed:removed.status}));
    }catch(error){
      console.error('video-package:pixeria-replace-failed', JSON.stringify({id:state.id, previous:String(payload.id), message:String(error?.message || error).slice(0, 200)}));
    }
    return publishToPixeria(context, {...state, replacedOnce:true});
  }
  if(!response.ok || !payload?.ok || !payload?.id || !payload?.url){
    console.error('video-package:pixeria-rejected', JSON.stringify({
      id:state.id, status:response.status, providerError:String(payload?.error || '').slice(0, 100),
      providerDetail:String(payload?.detail || '').slice(0, 180), providerStatus:Number(payload?.status || 0)
    }));
    return {...state, pixeria:{status:'failed', error:`Pixeria rechazó el master${payload?.error ? ` (${clean(payload.error, 80)})` : ''}.`}};
  }
  // Stock nuevo: `reused` + `reason` = ya existía idéntico (no se crea nada);
  // `replaced` = la identidad ya existía y el binario nuevo la sustituyó.
  const reutilizado = Boolean(payload.reused);
  const sustituye = payload.replaced ? String(payload.id) : (reutilizado ? '' : state.sustituye || '');
  return {...state, pixeria:{
    status:'published', id:String(payload.id), assetUrl:String(payload.url),
    stockUrl:`https://www.pixeria.com/stock.html?highlight=${encodeURIComponent(String(payload.id))}`,
    ...(payload.contentHash ? {contentHash:String(payload.contentHash)} : {}),
    ...(payload.reason ? {reason:String(payload.reason).slice(0, 40)} : {}),
    ...(reutilizado ? {reutilizado:true} : {}),
    ...(sustituye ? {sustituye} : {})
  }};
}

function publicState(state){
  return {ok:true, id:state.id, size:state.size, contentType:state.contentType, duration:25, ...(state.contentHash ? {contentHash:state.contentHash} : {}), pixeria:state.pixeria};
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
  // Ficha opcional (producto de catálogo): JSON codificado en la cabecera
  // x-package-ficha {title, comment, tags, externalId}. Si viene rota, se ignora.
  let ficha = null;
  try{
    const raw = request.headers.get('x-package-ficha');
    if(raw){
      const saneada = saneaFicha(JSON.parse(decodeURIComponent(raw)));
      if(saneada.externalId) ficha = saneada;
    }
  }catch(_){ ficha = null; }
  if(ficha?.title && title === 'Anuncio vertical · 25 segundos') title = ficha.title;
  const origin = new URL(request.url).origin;
  const contentHash = await hashDelMaster(env, key);
  // Póster + validación preparados por el creador con PATCH antes del máster
  // (Yokup #3199). Si no los hay, el máster se publica igual y el catálogo
  // captura el fotograma en cliente.
  const preparado = await env.PRESENTATION_IDEAS.get(`tiktok:video-package:poster:${id}`, {type:'json'}).catch(() => null);
  let state = {
    id, token, key, title, ficha, size:streamed, contentType, contentHash,
    ...(preparado?.poster ? {poster:preparado.poster, posterAt:preparado.posterAt ?? null} : {}),
    ...(preparado?.validacion ? {validacion:preparado.validacion} : {}),
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

// PATCH {clientRequestId, poster?, posterAt?, validacion?} — Yokup #3199.
// El creador valida el máster en el navegador (≥12 fotogramas, luma y varianza)
// y elige el fotograma con más información como póster. Lo manda AQUÍ antes del
// máster, bajo el id que tendrá el montaje (mismo x-client-request-id), y
// createPackage lo reenvía al Stock dentro del mismo publish.
const MAX_POSTER_JSON_BYTES = 560 * 1024; // 400 KB de JPEG en base64 + JSON
const POSTER_TTL = 60 * 60;
function saneaValidacion(v){
  if(!v || typeof v !== 'object') return null;
  const num = (x, max) => (x == null || !Number.isFinite(+x)) ? null : Math.max(0, Math.min(max, Math.round(+x * 100) / 100));
  return {
    ok:v.ok === true, negros:num(v.negros, 10000), muestras:num(v.muestras, 10000), duracion:num(v.duracion, 36000),
    motivo:v.motivo == null ? null : clean(v.motivo, 200), por:clean(v.por || 'creador admiranext (canvas)', 80)
  };
}
async function preparePackage(context){
  const {request, env} = context;
  if(!env.PRESENTATION_IDEAS) return json({error:'El almacenamiento del montaje no está configurado.'}, 503);
  let body;
  try{ body = await readJsonLimited(request, MAX_POSTER_JSON_BYTES); }
  catch(error){
    const grande = String(error?.message || '') === 'body_too_large';
    return json({error:grande ? 'El póster supera el límite de 400 KB.' : 'No pudimos leer el póster.'}, grande ? 413 : 400);
  }
  const clientRequestId = clean(body?.clientRequestId, 40);
  if(!CLIENT_ID_RE.test(clientRequestId)) return json({error:'Identificador de montaje no válido.'}, 400);
  const poster = (typeof body?.poster === 'string' && /^data:image\/(jpeg|webp);base64,[A-Za-z0-9+/=]+$/.test(body.poster)) ? body.poster : '';
  if(typeof body?.poster === 'string' && body.poster && !poster) return json({error:'El póster debe ser una data URL JPEG o WebP.'}, 400);
  const validacion = saneaValidacion(body?.validacion);
  if(!poster && !validacion) return json({error:'Falta el póster o la validación.'}, 400);
  const id = `pkg-${(await digest(clientRequestId)).slice(0, 20)}`;
  const posterAt = Number.isFinite(+body?.posterAt) ? Math.max(0, Math.round(+body.posterAt * 1000) / 1000) : null;
  await env.PRESENTATION_IDEAS.put(`tiktok:video-package:poster:${id}`, JSON.stringify({poster, posterAt, validacion, at:new Date().toISOString()}), {expirationTtl:POSTER_TTL});
  return json({ok:true, id, poster:Boolean(poster), validacion}, 200);
}

export async function onRequest(context){
  if(!sameOrigin(context.request)) return json({error:'Origen no permitido.'}, 403);
  if(context.request.method === 'POST') return createPackage(context);
  if(context.request.method === 'PUT') return retryPackage(context);
  if(context.request.method === 'PATCH') return preparePackage(context);
  return json({error:'Método no permitido.'}, 405);
}
