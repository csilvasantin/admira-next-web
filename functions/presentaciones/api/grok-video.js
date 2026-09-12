import { saneaFicha, saneaFormato } from './_ficha-video.mjs';
import { urlImagenProducto, descargarImagenProducto, promptConReferencia } from './_imagen-producto.mjs';

const MAX_BODY_BYTES = 12 * 1024;
const MAX_PROVIDER_BYTES = 96 * 1024;
const MAX_PIXERIA_BYTES = 48 * 1024;
const MAX_PROMPT_CHARS = 3200;
const REQUEST_ID_RE = /^[a-zA-Z0-9][a-zA-Z0-9_-]{15,127}$/;
const CLIENT_ID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const PIXERIA_ID_RE = /^(?:\d{10,16}-[a-z0-9]{4,16}|auto-[a-f0-9]{20})$/i;
const ALLOWED_RESOLUTIONS = new Set(['480p', '720p', '1080p']);
const PIXERIA_PUBLISH_URL = 'https://api.admira.store/stock/publish';
const PIXERIA_PENDING_MS = 10 * 60 * 1000;
const PIXERIA_ASSET_URL = 'https://api.admira.store/stock/asset/';
const MAX_BRUTO_BYTES = 120 * 1024 * 1024;
const PIXERIA_STATE_TTL = 30 * 24 * 60 * 60;

function json(payload, status = 200, extraHeaders = {}){
  return Response.json(payload, {
    status,
    headers:{
      'cache-control':'no-store',
      'content-type':'application/json; charset=utf-8',
      'x-content-type-options':'nosniff',
      ...extraHeaders
    }
  });
}

function sameOrigin(request){
  const origin = request.headers.get('origin');
  if(!origin) return true;
  try{ return new URL(origin).origin === new URL(request.url).origin; }
  catch(_){ return false; }
}

function cleanPrompt(value){
  return String(value == null ? '' : value)
    .replace(/[\u0000-\u001f\u007f]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, MAX_PROMPT_CHARS);
}

async function readJsonLimited(response, maxBytes = MAX_PROVIDER_BYTES){
  const declared = Number(response.headers.get('content-length') || 0);
  if(declared > maxBytes) throw new Error('provider_response_too_large');
  if(!response.body) return {};
  const reader = response.body.getReader();
  const chunks = [];
  let total = 0;
  try{
    while(true){
      const {done, value} = await reader.read();
      if(done) break;
      total += value.byteLength;
      if(total > maxBytes){
        await reader.cancel();
        throw new Error('provider_response_too_large');
      }
      chunks.push(value);
    }
  }finally{
    reader.releaseLock();
  }
  const bytes = new Uint8Array(total);
  let offset = 0;
  for(const chunk of chunks){ bytes.set(chunk, offset); offset += chunk.byteLength; }
  try{ return JSON.parse(new TextDecoder().decode(bytes)); }
  catch(_){ throw new Error('provider_response_invalid'); }
}

function providerMessage(status){
  if(status === 401 || status === 403) return 'La conexión con Grok no está autorizada.';
  if(status === 429) return 'Grok ha alcanzado temporalmente su límite de generación.';
  if(status >= 500) return 'Grok no está disponible temporalmente.';
  return 'Grok no pudo procesar esta solicitud de vídeo.';
}

async function digest(value){
  const bytes = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return Array.from(new Uint8Array(bytes)).map(byte => byte.toString(16).padStart(2, '0')).join('');
}

async function readRequestJson(request){
  const declared = Number(request.headers.get('content-length') || 0);
  if(declared > MAX_BODY_BYTES) return {error:json({error:'Petición demasiado grande.'}, 413)};
  if(!request.body) return {error:json({error:'La petición está vacía.'}, 400)};
  const reader = request.body.getReader();
  const chunks = [];
  let total = 0;
  try{
    while(true){
      const {done, value} = await reader.read();
      if(done) break;
      total += value.byteLength;
      if(total > MAX_BODY_BYTES){
        await reader.cancel();
        return {error:json({error:'Petición demasiado grande.'}, 413)};
      }
      chunks.push(value);
    }
  }catch(_){
    return {error:json({error:'No se pudo leer la petición.'}, 400)};
  }finally{
    reader.releaseLock();
  }
  const bytes = new Uint8Array(total);
  let offset = 0;
  for(const chunk of chunks){ bytes.set(chunk, offset); offset += chunk.byteLength; }
  const raw = new TextDecoder().decode(bytes);
  try{ return {payload:JSON.parse(raw)}; }
  catch(_){ return {error:json({error:'JSON no válido.'}, 400)}; }
}

async function createVideo(context){
  if(!sameOrigin(context.request)) return json({error:'Origen no permitido.'}, 403);
  if(!context.env.XAI_API_KEY) return json({error:'La conexión con Grok todavía no está configurada.'}, 503);
  const contentType = (context.request.headers.get('content-type') || '').toLowerCase();
  if(!contentType.startsWith('application/json')) return json({error:'Usa JSON para iniciar el vídeo.'}, 415);
  const parsed = await readRequestJson(context.request);
  if(parsed.error) return parsed.error;
  const prompt = cleanPrompt(parsed.payload?.prompt);
  const resolution = ALLOWED_RESOLUTIONS.has(parsed.payload?.resolution) ? parsed.payload.resolution : '720p';
  const clientRequestId = String(parsed.payload?.clientRequestId || '').trim();
  // Formato (FLT-100372): 9:16 (vertical, el de siempre) o 16:9 (horizontal).
  // Va a Grok como aspect_ratio y queda en la ficha para el Stock.
  const formato = saneaFormato(parsed.payload?.formato || parsed.payload?.ficha?.formato);
  if(prompt.length < 40) return json({error:'Describe con algo más de detalle el vídeo que debe crear Grok.'}, 400);
  if(!CLIENT_ID_RE.test(clientRequestId)) return json({error:'Identificador de solicitud no válido.'}, 400);

  const dedupeKey = `tiktok:grok-video:request:${clientRequestId}`;
  if(context.env.PRESENTATION_IDEAS){
    const previous = await context.env.PRESENTATION_IDEAS.get(dedupeKey, {type:'json'});
    if(previous?.requestId && REQUEST_ID_RE.test(previous.requestId)){
      return json({ok:true, reused:true, requestId:previous.requestId, status:'pending', model:previous.model, resolution:previous.resolution, aspectRatio:previous.formato || formato}, 202);
    }
    const ip = context.request.headers.get('CF-Connecting-IP') || 'unknown';
    const ipHash = await digest(ip);
    // Un vídeo por minuto y FORMATO: «las dos versiones» encadena 9:16 y 16:9
    // del mismo producto en menos de un minuto y no debe chocar consigo mismo.
    const rateKey = `tiktok:grok-video:rate:${ipHash.slice(0, 24)}:${formato}`;
    const limited = await context.env.PRESENTATION_IDEAS.get(rateKey);
    if(limited) return json({error:'Espera un minuto antes de iniciar otro vídeo de Grok.'}, 429, {'retry-after':'60'});
    await context.env.PRESENTATION_IDEAS.put(rateKey, '1', {expirationTtl:60});
  }

  const model = context.env.XAI_VIDEO_MODEL || 'grok-imagine-video-1.5';
  // Imagen real del producto (FLT-100318): se descarga AQUÍ y va a Grok como
  // referencia (`image.url`, image-to-video de docs.x.ai) para que el vídeo
  // muestre el producto tal cual es. Tres intentos, del más fiel al más seguro:
  // data URI → URL pública → sin imagen. Si nada de esto vale, el máster sigue
  // llevando la foto real en el overlay, así que el anuncio nunca se pierde.
  const imagenUrl = urlImagenProducto(parsed.payload?.imagen);
  const referencia = imagenUrl ? await descargarImagenProducto(imagenUrl) : null;
  if(imagenUrl && !referencia) console.error(JSON.stringify({message:'grok video product image download failed', imagen:imagenUrl}));
  const base = {model, prompt, duration:15, aspect_ratio:formato, resolution};
  const intentos = referencia
    ? [
      {...base, prompt:promptConReferencia(prompt, true), image:{url:referencia.dataUrl}},
      {...base, prompt:promptConReferencia(prompt, true), image:{url:imagenUrl}},
      base
    ]
    : [base];
  let response, provider, usado = null;
  for(let i = 0; i < intentos.length; i += 1){
    response = await fetch('https://api.x.ai/v1/videos/generations', {
      method:'POST',
      headers:{'authorization':`Bearer ${context.env.XAI_API_KEY}`, 'content-type':'application/json'},
      body:JSON.stringify(intentos[i])
    });
    try{ provider = await readJsonLimited(response); }
    catch(error){
      console.error(JSON.stringify({message:'invalid grok video create response', error:String(error?.message || error), status:response.status}));
      return json({error:'Grok devolvió una respuesta no válida.'}, 502);
    }
    if(response.ok){ usado = intentos[i]; break; }
    if(response.status === 429 || i === intentos.length - 1) break;
    console.error(JSON.stringify({message:'grok video image reference rejected', intento:i, status:response.status, detail:String(provider?.error?.message || provider?.error || '').slice(0, 200)}));
  }
  if(!response.ok) return json({error:providerMessage(response.status)}, response.status === 429 ? 429 : 502);
  const imagen = referencia ? (usado?.image ? 'referencia' : 'rechazada') : imagenUrl ? 'no-descargada' : undefined;
  const requestId = String(provider?.request_id || '').trim();
  if(!REQUEST_ID_RE.test(requestId)) return json({error:'Grok no devolvió un identificador de vídeo válido.'}, 502);

  // La ficha se guarda ANTES de contestar: quien encarga se pone a sondear en
  // cuanto tiene el requestId, y el sondeo es lo que dispara la publicación. Si
  // se guardara después habría una ventana en la que el vídeo se publica con la
  // ficha genérica justo cuando el encargo sí traía una buena.
  if(parsed.payload?.ficha) await guardaFicha(context, requestId, saneaFicha({...parsed.payload.ficha, formato}));

  if(context.env.PRESENTATION_IDEAS){
    await context.env.PRESENTATION_IDEAS.put(dedupeKey, JSON.stringify({requestId, model, resolution, formato, createdAt:new Date().toISOString()}), {expirationTtl:60 * 60 * 6});
  }
  return json(imagen ? {ok:true, requestId, status:'pending', model, resolution, duration:15, aspectRatio:formato, imagen} : {ok:true, requestId, status:'pending', model, resolution, duration:15, aspectRatio:formato}, 202);
}

function safeVideoUrl(value){
  try{
    const url = new URL(String(value || ''));
    return url.protocol === 'https:' && (url.hostname === 'x.ai' || url.hostname.endsWith('.x.ai')) ? url.toString() : '';
  }catch(_){ return ''; }
}

function safePixeriaUrl(value, id){
  try{
    const url = new URL(String(value || ''));
    const expectedPath = `/stock/asset/${id}`;
    return url.protocol === 'https:' && url.hostname === 'api.admira.store' && url.pathname === expectedPath ? url.toString() : '';
  }catch(_){ return ''; }
}

function publicPixeriaState(record){
  if(record?.status === 'published' && PIXERIA_ID_RE.test(record.id || '')){
    const assetUrl = safePixeriaUrl(record.assetUrl, record.id);
    if(assetUrl) return {
      status:'published',
      id:record.id,
      assetUrl,
      stockUrl:`https://www.pixeria.com/stock.html?highlight=${encodeURIComponent(record.id)}`
    };
  }
  if(record?.status === 'uploading') return {status:'uploading'};
  if(record?.status === 'failed') return {status:'failed', error:'El vídeo está listo, pero Pixeria no pudo copiarlo automáticamente.'};
  return {status:'pending'};
}

// La ficha se guarda al ENCARGAR y se lee al PUBLICAR, que ocurren en dos
// peticiones distintas (una crea, otra sondea) y puede que hasta en dos centros
// de datos. Por eso va por KV y bajo el requestId, que es lo único que las dos
// mitades comparten — el clientRequestId solo lo conoce quien encargó.
const fichaKey = (requestId) => `tiktok:grok-video:ficha:${requestId}`;

async function guardaFicha(context, requestId, ficha){
  if(!context.env.PRESENTATION_IDEAS || !ficha) return;
  try{ await context.env.PRESENTATION_IDEAS.put(fichaKey(requestId), JSON.stringify(ficha), {expirationTtl:PIXERIA_STATE_TTL}); }
  catch(error){
    // Sin ficha el vídeo se publica con la genérica. Es peor, pero no se pierde.
    console.error(JSON.stringify({message:'video ficha write failed', requestId, error:String(error?.message || error)}));
  }
}

async function leeFicha(context, requestId){
  if(!context.env.PRESENTATION_IDEAS) return null;
  try{ return await context.env.PRESENTATION_IDEAS.get(fichaKey(requestId), {type:'json'}); }
  catch(error){
    console.error(JSON.stringify({message:'video ficha read failed', requestId, error:String(error?.message || error)}));
    return null;
  }
}

async function savePixeriaState(context, key, state, ttl = PIXERIA_STATE_TTL){
  try{ await context.env.PRESENTATION_IDEAS.put(key, JSON.stringify(state), {expirationTtl:ttl}); }
  catch(error){
    console.error(JSON.stringify({message:'pixeria video state write failed', requestId:state.requestId, status:state.status, error:String(error?.message || error)}));
  }
}

// El Stock deriva el id del asset del externalId (sha256 → auto-…): con él se
// puede preguntar si la pieza YA existe antes de publicar, y no duplicar.
async function stockIdDerivado(externalId){
  return `auto-${(await digest(externalId)).slice(0, 20)}`;
}

async function existeEnStock(context, id){
  if(!context.env.PIXERIA_STOCK) return false;
  try{
    const response = await context.env.PIXERIA_STOCK.fetch(new Request(`${PIXERIA_ASSET_URL}${id}`, {method:'GET', headers:{range:'bytes=0-0'}}));
    try{ await response.body?.cancel(); }catch(_){ /* Solo interesa el estado. */ }
    return response.status === 200 || response.status === 206;
  }catch(_){ return false; }
}

// Encargo (brief/producto): el bruto NO se publica en el Stock. Se copia a R2
// (PRESENTATION_MEDIA) bajo la misma ruta que los másteres (/tiktok/media/…),
// same-origin, para que el navegador lo pinte en el canvas sin ensuciarlo y
// monte el máster con rótulo, que es lo único que llega al Stock.
const brutoKey = (requestId) => `tiktok:grok-video:bruto:${requestId}`;

function publicBrutoState(record){
  if(record?.status === 'retenido' && record.mediaUrl) return {status:'retenido', id:record.id, mediaUrl:record.mediaUrl, size:record.size};
  if(record?.status === 'uploading') return {status:'uploading'};
  if(record?.status === 'failed') return {status:'failed', error:'El vídeo está listo, pero no se pudo retener como fuente del máster.'};
  return {status:'pending'};
}

async function ensureBrutoRetenido(context, requestId, video, force = false){
  if(!context.env.PRESENTATION_IDEAS || !context.env.PRESENTATION_MEDIA) return {status:'failed', error:'El almacén interno del bruto no está configurado.'};
  const key = brutoKey(requestId);
  let previous = null;
  try{ previous = await context.env.PRESENTATION_IDEAS.get(key, {type:'json'}); }
  catch(_){ return {status:'failed', error:'No se pudo comprobar si el bruto ya estaba retenido.'}; }
  if(previous?.status === 'retenido') return publicBrutoState(previous);
  if(previous?.status === 'uploading' && Date.now() - Number(previous.startedAt || 0) < PIXERIA_PENDING_MS) return {status:'uploading'};
  if(previous?.status === 'failed' && !force) return publicBrutoState(previous);
  await savePixeriaState(context, key, {status:'uploading', requestId, startedAt:Date.now()}, 60 * 60);
  try{
    const origen = await fetch(video.url);
    if(!origen.ok) throw new Error(`origen ${origen.status}`);
    const bytes = await origen.arrayBuffer();
    if(bytes.byteLength < 1024 || bytes.byteLength > MAX_BRUTO_BYTES) throw new Error(`tamaño ${bytes.byteLength}`);
    const id = `pkg-${(await digest(`bruto:${requestId}`)).slice(0, 20)}`;
    const token = crypto.randomUUID().replace(/-/g, '') + crypto.randomUUID().replace(/-/g, '');
    await context.env.PRESENTATION_MEDIA.put(`tiktok/packages/${id}-${token}.mp4`, bytes, {
      httpMetadata:{contentType:'video/mp4', cacheControl:'public, max-age=31536000, immutable'},
      customMetadata:{kind:'tiktok-bruto', requestId, id}
    });
    const origin = new URL(context.request.url).origin;
    const retenido = {status:'retenido', requestId, id, token, size:bytes.byteLength, mediaUrl:`${origin}/tiktok/media/${id}/${token}`, retainedAt:Date.now()};
    await savePixeriaState(context, key, retenido);
    return publicBrutoState(retenido);
  }catch(error){
    console.error(JSON.stringify({message:'grok bruto retain failed', requestId, error:String(error?.message || error).slice(0, 200)}));
    const failed = {status:'failed', requestId, failedAt:Date.now()};
    await savePixeriaState(context, key, failed, 60 * 60);
    return publicBrutoState(failed);
  }
}

async function ensurePixeriaPublication(context, requestId, video, model, force = false){
  if(!context.env.PRESENTATION_IDEAS || !context.env.PIXERIA_STOCK || !context.env.PIXERIA_INGEST_TOKEN){
    return {status:'failed', error:'La conexión interna con Pixeria no está configurada.'};
  }
  const key = `tiktok:grok-video:pixeria:${requestId}`;
  let previous = null;
  try{ previous = await context.env.PRESENTATION_IDEAS.get(key, {type:'json'}); }
  catch(error){
    console.error(JSON.stringify({message:'pixeria video state read failed', requestId, error:String(error?.message || error)}));
    return {status:'failed', error:'Pixeria no pudo comprobar si el vídeo ya estaba publicado.'};
  }
  if(previous?.status === 'published') return publicPixeriaState(previous);
  if(previous?.status === 'uploading' && Date.now() - Number(previous.startedAt || 0) < PIXERIA_PENDING_MS) return {status:'uploading'};
  if(previous?.status === 'failed' && !force) return publicPixeriaState(previous);

  const uploading = {status:'uploading', requestId, startedAt:Date.now()};
  await savePixeriaState(context, key, uploading, 60 * 60);
  // La ficha la dejó quien encargó el vídeo. Si no hay (encargos del estudio, o
  // uno anterior a esto), se publica con la genérica: perder el vídeo sería peor
  // que publicarlo mal titulado.
  const ficha = saneaFicha(await leeFicha(context, requestId));
  const externalId = ficha.externalId ? `${ficha.externalId}:grok:${requestId}`.slice(0, 160) : `admiranext:grok-video:${requestId}`;
  // Antes de publicar se pregunta al Stock: si esa identidad ya existe (otra
  // pestaña, otra sesión), se reutiliza y no se duplica.
  const idPrevisto = await stockIdDerivado(externalId);
  if(await existeEnStock(context, idPrevisto)){
    const published = {status:'published', requestId, id:idPrevisto, assetUrl:`${PIXERIA_ASSET_URL}${idPrevisto}`, publishedAt:Date.now(), existente:true};
    await savePixeriaState(context, key, published);
    return {...publicPixeriaState(published), existente:true};
  }
  const payload = {
    type:'video',
    motor:'grok-imagine-video',
    prompt:'',
    title:ficha.title,
    comment:ficha.comment,
    tags:ficha.tags,
    // Pieza de catálogo (Yokup #3183): misma meta que el máster, para que el
    // bruto —cuando sí va al Stock— caiga en la misma opción «Catálogo».
    ...(ficha.catalogo ? {catalogo:ficha.catalogo} : {}),
    quality:'best',
    costEst:`xAI · ${String(model || 'Grok Imagine Video').slice(0, 56)}`,
    mime:'video/mp4',
    sourceUrl:video.url,
    // Con clave propia (producto de catálogo) la pieza se identifica por ella,
    // más el requestId para que dos generaciones del mismo producto no se pisen.
    externalId
  };
  let response;
  let provider;
  try{
    response = await context.env.PIXERIA_STOCK.fetch(new Request(PIXERIA_PUBLISH_URL, {
      method:'POST',
      headers:{
        'content-type':'application/json',
        accept:'application/json',
        'x-admiranext-ingest':context.env.PIXERIA_INGEST_TOKEN
      },
      body:JSON.stringify(payload)
    }));
    provider = await readJsonLimited(response, MAX_PIXERIA_BYTES);
  }catch(error){
    console.error(JSON.stringify({message:'pixeria video publish failed', requestId, error:String(error?.message || error)}));
    const failed = {status:'failed', requestId, failedAt:Date.now()};
    await savePixeriaState(context, key, failed, 60 * 60);
    return publicPixeriaState(failed);
  }
  const id = String(provider?.id || '').trim();
  const assetUrl = safePixeriaUrl(provider?.url, id);
  if(!response.ok || !provider?.ok || !PIXERIA_ID_RE.test(id) || !assetUrl){
    console.error(JSON.stringify({
      message:'pixeria video publish rejected',
      requestId,
      status:response.status,
      providerError:String(provider?.error || '').slice(0, 80),
      providerDetail:String(provider?.detail || '').slice(0, 160),
      providerStatus:Number(provider?.status || 0),
      validId:PIXERIA_ID_RE.test(id),
      validUrl:Boolean(assetUrl)
    }));
    const failed = {status:'failed', requestId, failedAt:Date.now()};
    await savePixeriaState(context, key, failed, 60 * 60);
    return publicPixeriaState(failed);
  }
  const published = {status:'published', requestId, id, assetUrl, publishedAt:Date.now()};
  await savePixeriaState(context, key, published);
  return publicPixeriaState(published);
}

async function fetchVideoProvider(context, requestId){
  const response = await fetch(`https://api.x.ai/v1/videos/${encodeURIComponent(requestId)}`, {
    headers:{'authorization':`Bearer ${context.env.XAI_API_KEY}`, 'accept':'application/json'}
  });
  let provider;
  try{ provider = await readJsonLimited(response); }
  catch(error){
    console.error(JSON.stringify({message:'invalid grok video status response', requestId, error:String(error?.message || error), status:response.status}));
    return {error:json({error:'Grok devolvió un estado no válido.'}, 502)};
  }
  if(!response.ok) return {error:json({error:providerMessage(response.status)}, response.status === 429 ? 429 : 502)};
  return {provider};
}

async function videoStatusById(context, requestId, forcePixeria = false){
  if(!context.env.XAI_API_KEY) return json({error:'La conexión con Grok todavía no está configurada.'}, 503);
  if(!REQUEST_ID_RE.test(requestId)) return json({error:'Identificador de vídeo no válido.'}, 400);
  const fetched = await fetchVideoProvider(context, requestId);
  if(fetched.error) return fetched.error;
  const provider = fetched.provider;
  const status = ['pending','done','failed','expired'].includes(provider?.status) ? provider.status : 'pending';
  const result = {
    ok:true,
    requestId,
    status,
    progress:Math.max(0, Math.min(100, Math.round(Number(provider?.progress || (status === 'done' ? 100 : 0))))),
    model:String(provider?.model || context.env.XAI_VIDEO_MODEL || 'grok-imagine-video-1.5').slice(0, 80)
  };
  if(status === 'done'){
    const url = safeVideoUrl(provider?.video?.url);
    if(!url) return json({error:'Grok terminó el vídeo, pero no devolvió una URL segura.'}, 502);
    result.video = {
      url,
      duration:Math.max(1, Math.min(15, Number(provider?.video?.duration || 15))),
      respectsModeration:provider?.video?.respect_moderation !== false
    };
    // Encargo (ficha con brutoAlStock:false): el bruto se retiene en R2 y NO va
    // al Stock; solo el máster con rótulo (identidad exacta) se publica.
    const ficha = await leeFicha(context, requestId);
    result.pixeria = ficha?.brutoAlStock === false
      ? await ensureBrutoRetenido(context, requestId, result.video, forcePixeria)
      : await ensurePixeriaPublication(context, requestId, result.video, result.model, forcePixeria);
  }
  if(status === 'failed' || status === 'expired') result.error = status === 'expired' ? 'La solicitud de Grok ha caducado.' : 'Grok no pudo completar este vídeo.';
  return json(result);
}

async function videoStatus(context){
  const requestId = String(new URL(context.request.url).searchParams.get('id') || '').trim();
  return videoStatusById(context, requestId);
}

async function retryPixeria(context){
  if(!sameOrigin(context.request)) return json({error:'Origen no permitido.'}, 403);
  const contentType = (context.request.headers.get('content-type') || '').toLowerCase();
  if(!contentType.startsWith('application/json')) return json({error:'Usa JSON para reintentar el envío.'}, 415);
  const parsed = await readRequestJson(context.request);
  if(parsed.error) return parsed.error;
  const requestId = String(parsed.payload?.requestId || '').trim();
  return videoStatusById(context, requestId, true);
}

export async function onRequest(context){
  if(context.request.method === 'POST') return createVideo(context);
  if(context.request.method === 'GET') return videoStatus(context);
  if(context.request.method === 'PUT') return retryPixeria(context);
  return json({error:'Método no permitido.'}, 405, {'allow':'GET, POST, PUT'});
}
