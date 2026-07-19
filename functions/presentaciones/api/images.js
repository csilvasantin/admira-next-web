import {buildImageSet, publicImageSet, recomputeImageSet} from '../_grok-images.js';

const MAX_BODY_BYTES = 32 * 1024;
const MAX_BASE64_CHARS = 14 * 1024 * 1024;
const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;
const MAX_MULTIPART_BYTES = MAX_UPLOAD_BYTES + 256 * 1024;
const PROCESSING_TIMEOUT_MS = 10 * 60 * 1000;
const MAX_TEXT_RETRIES = 3;

function json(body, status = 200){
  return new Response(JSON.stringify(body), {status, headers:{
    'content-type':'application/json; charset=utf-8', 'cache-control':'no-store, must-revalidate',
    'x-content-type-options':'nosniff'
  }});
}
function cleanClient(value){
  const client = String(value || '').trim().toLowerCase();
  return /^[a-z0-9][a-z0-9-]{1,62}$/.test(client) ? client : '';
}
function cleanId(value){ return /^[a-z0-9][a-z0-9-]{2,100}$/i.test(String(value || '')) ? String(value) : ''; }
function sameOrigin(request){
  const origin = request.headers.get('Origin');
  return Boolean(origin) && origin === new URL(request.url).origin;
}
async function getInputs(env, client){
  const [presentation, ideas, imageSet] = await Promise.all([
    env.PRESENTATION_IDEAS.get(`presentation:${client}`, {type:'json'}),
    env.PRESENTATION_IDEAS.get(`ideas:${client}`, {type:'json'}),
    env.PRESENTATION_IDEAS.get(`image-set:${client}`, {type:'json'})
  ]);
  return {presentation, ideas, imageSet:imageSet ? recomputeImageSet(imageSet) : null};
}
function recoverStalled(set, now = new Date().toISOString()){
  if(!set) return false;
  const expiredBefore = Date.parse(now) - PROCESSING_TIMEOUT_MS;
  let recovered = false;
  for(const slide of set.slides || []){
    if(slide.status === 'processing' && Date.parse(slide.updatedAt || '') < expiredBefore){
      slide.status = 'failed'; slide.progress = 100; slide.stage = 'Interrumpida';
      slide.error = 'Grok no ha informado de actividad durante 10 minutos. Puedes reintentarla.';
      slide.errorCode = 'processing_stalled'; slide.retryable = true;
      slide.failedAt = now; slide.updatedAt = now; recovered = true;
    }
  }
  if(recovered) recomputeImageSet(set, now);
  return recovered;
}
function decodeBase64(value){
  if(typeof value !== 'string' || !value || value.length > MAX_BASE64_CHARS) throw new Error('La imagen recibida supera el tamaño permitido.');
  const raw = atob(value);
  const bytes = new Uint8Array(raw.length);
  for(let index = 0; index < raw.length; index += 1) bytes[index] = raw.charCodeAt(index);
  return bytes;
}
function imageType(bytes){
  if(bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) return {extension:'png', contentType:'image/png'};
  if(bytes[0] === 0xff && bytes[1] === 0xd8) return {extension:'jpg', contentType:'image/jpeg'};
  if(bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46 && bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50) return {extension:'webp', contentType:'image/webp'};
  throw new Error('El archivo no es una imagen PNG, JPEG o WebP válida.');
}

function slideSourceId(slide){
  return cleanId(slide?.sourceId) || String(slide?.id || '').replace(/^slide-\d+-/, '');
}

function preserveManualImages(previous, candidate){
  const manualBySource = new Map((previous?.slides || [])
    .filter(slide => slide.manual === true && slide.status === 'ready' && slide.url && slide.textFreeVerified)
    .map(slide => [slideSourceId(slide), slide]));
  for(const slide of candidate.slides || []){
    const preserved = manualBySource.get(slideSourceId(slide));
    if(!preserved) continue;
    Object.assign(slide, {
      status:'ready', url:preserved.url, objectKey:preserved.objectKey,
      source:'manual-upload', manual:true, textFreeVerified:true,
      textValidation:preserved.textValidation, generatedAt:preserved.generatedAt,
      completedAt:preserved.completedAt, progress:100, stage:'Imagen manual conservada',
      retryable:false, updatedAt:candidate.updatedAt
    });
  }
  return recomputeImageSet(candidate, candidate.updatedAt);
}

function supersededError(set){
  const error = new Error('La imagen de Grok ya no es la vigente para esta diapositiva.');
  error.code = 'generation_superseded';
  error.imageSet = set;
  return error;
}

async function activeGeneration(env, client, setId, slideId, requestId){
  const set = await env.PRESENTATION_IDEAS.get(`image-set:${client}`, {type:'json'});
  const slide = (set?.slides || []).find(item => item.id === slideId);
  if(!set || set.id !== setId || !slide || slide.requestId !== requestId || slide.manual === true) throw supersededError(set ? recomputeImageSet(set) : null);
  return {set, slide};
}
function providerMessage(status){
  if(status === 401 || status === 403) return 'La credencial de xAI no es válida.';
  if(status === 429) return 'xAI ha alcanzado temporalmente su límite de generación.';
  if(status >= 500) return 'xAI no está disponible temporalmente.';
  return 'xAI no pudo generar esta imagen.';
}
async function generateImage(env, prompt){
  const response = await fetch('https://api.x.ai/v1/images/generations', {
    method:'POST', headers:{'content-type':'application/json', authorization:`Bearer ${env.XAI_API_KEY}`},
    body:JSON.stringify({model:env.XAI_IMAGE_MODEL || 'grok-imagine-image', prompt, n:1, aspect_ratio:'16:9', resolution:'1k', response_format:'b64_json'})
  });
  if(!response.ok) throw new Error(providerMessage(response.status));
  const length = Number(response.headers.get('content-length') || 0);
  if(length > MAX_BASE64_CHARS) throw new Error('La respuesta de xAI supera el tamaño permitido.');
  const payload = await response.json();
  const item = payload?.data?.[0];
  const bytes = decodeBase64(item?.b64_json);
  return {bytes, base64:item.b64_json, ...imageType(bytes), revisedPrompt:typeof item?.revised_prompt === 'string' ? item.revised_prompt.slice(0, 1000) : ''};
}

async function validateTextFree(env, image){
  const response = await fetch('https://api.x.ai/v1/responses', {
    method:'POST', headers:{'content-type':'application/json', authorization:`Bearer ${env.XAI_API_KEY}`},
    body:JSON.stringify({
      model:env.XAI_VISION_MODEL || env.XAI_TEXT_MODEL || 'grok-4.5', store:false,
      input:[
        {role:'system', content:[{type:'input_text', text:'You are a strict visual quality gate. Reject any image containing visible or pseudo-text, including isolated letters, numbers, glyphs, signage, labels, logos, watermarks or typography-like marks. When uncertain, reject.'}]},
        {role:'user', content:[
          {type:'input_text', text:'Inspect this presentation background. Does any visible text or typography-like mark appear anywhere in the pixels?'},
          {type:'input_image', image_url:`data:${image.contentType};base64,${image.base64}`, detail:'high'}
        ]}
      ],
      text:{format:{type:'json_schema', name:'text_free_image_check', strict:true, schema:{
        type:'object', additionalProperties:false,
        properties:{has_visible_text:{type:'boolean'}, confidence:{type:'number'}, evidence:{type:'string'}},
        required:['has_visible_text','confidence','evidence']
      }}}
    })
  });
  if(!response.ok) throw new Error('No se pudo verificar que la imagen esté libre de texto. No se publicará.');
  const length = Number(response.headers.get('content-length') || 0);
  if(length > MAX_BODY_BYTES) throw new Error('La verificación visual devolvió una respuesta demasiado grande.');
  const payload = await response.json();
  const outputText=payload?.output?.find(item=>item?.type==='message')?.content?.find(item=>item?.type==='output_text')?.text;
  let result;
  try{ result = JSON.parse(outputText || ''); }
  catch(_){ throw new Error('La verificación visual no devolvió un resultado válido.'); }
  if(typeof result?.has_visible_text !== 'boolean') throw new Error('La verificación visual no pudo confirmar la ausencia de texto.');
  const confidence=Math.max(0,Math.min(1,Number(result.confidence||0)));
  return {passed:result.has_visible_text === false&&confidence>=0.9, confidence, evidence:String(result.evidence || '').slice(0, 300)};
}

function textDetectedError(validation){
  const error = new Error('La imagen contenía texto o marcas tipográficas y ha sido descartada automáticamente.');
  error.code = 'visible_text_detected';
  error.validation = validation;
  return error;
}

async function prepare(context, payload){
  const client = cleanClient(payload.client);
  if(!client) return json({error:'Presentación no válida.'}, 400);
  const inputs = await getInputs(context.env, client);
  if(!inputs.presentation || !inputs.ideas) return json({error:'No encontramos el esqueleto de la presentación.'}, 404);
  const candidate = await buildImageSet({
    client, presentation:inputs.presentation, ideas:inputs.ideas,
    model:context.env.XAI_IMAGE_MODEL || 'grok-imagine-image'
  });
  if(inputs.imageSet && inputs.imageSet.sourceHash === candidate.sourceHash && payload.force !== true){
    const recovered = recoverStalled(inputs.imageSet);
    if(recovered){
      await context.env.PRESENTATION_IDEAS.put(`image-set:${client}`, JSON.stringify(inputs.imageSet));
    }
    return json({ok:true, reused:true, imageSet:publicImageSet(inputs.imageSet)});
  }
  if(inputs.imageSet && payload.force !== true) preserveManualImages(inputs.imageSet, candidate);
  await context.env.PRESENTATION_IDEAS.put(`image-set:${client}`, JSON.stringify(candidate));
  return json({ok:true, reused:false, imageSet:publicImageSet(candidate)}, 201);
}

async function upload(context, form){
  if(!context.env.PRESENTATION_MEDIA) return json({error:'El almacenamiento de imágenes no está configurado.'}, 503);
  const client = cleanClient(form.get('client')), setId = cleanId(form.get('setId')), slideId = cleanId(form.get('slideId'));
  if(!client || !setId || !slideId) return json({error:'Destino de imagen no válido.'}, 400);
  if(form.get('textFreeConfirmed') !== 'true') return json({error:'Confirma que la imagen no contiene texto, números, logos ni marcas tipográficas.'}, 400);
  const file = form.get('file');
  if(!file || typeof file.arrayBuffer !== 'function' || !Number.isFinite(Number(file.size))) return json({error:'Selecciona una imagen para esta diapositiva.'}, 400);
  if(file.size < 4 || file.size > MAX_UPLOAD_BYTES) return json({error:'La imagen debe pesar entre 4 bytes y 10 MB.'}, 413);
  const set = await context.env.PRESENTATION_IDEAS.get(`image-set:${client}`, {type:'json'});
  if(!set || set.id !== setId) return json({error:'El paquete visual ya no es el vigente.'}, 409);
  recoverStalled(set);
  const slide = (set.slides || []).find(item => item.id === slideId);
  if(!slide) return json({error:'La diapositiva no existe.'}, 404);
  if(slide.status === 'processing') return json({error:'Grok está trabajando en esta diapositiva. Espera a que termine o se interrumpa antes de sustituirla.', imageSet:publicImageSet(recomputeImageSet(set))}, 409);
  const bytes = new Uint8Array(await file.arrayBuffer());
  if(bytes.byteLength > MAX_UPLOAD_BYTES) return json({error:'La imagen supera el límite de 10 MB.'}, 413);
  let type;
  try{ type = imageType(bytes); }
  catch(error){ return json({error:error.message}, 415); }
  const now = new Date().toISOString();
  const filename = `manual-${slide.id}-${crypto.randomUUID().replace(/-/g, '').slice(0, 12)}.${type.extension}`;
  const key = `presentations/${client}/grok-images/${filename}`;
  await context.env.PRESENTATION_MEDIA.put(key, bytes, {
    httpMetadata:{contentType:type.contentType, cacheControl:'private, max-age=3600'},
    customMetadata:{client, setId:set.id, slideId:slide.id, provider:'manual-upload', safetyContract:set.safetyContract, textFreeVerified:'human-confirmed'}
  });
  Object.assign(slide, {
    status:'ready', url:`/presentaciones/${client}/images/${filename}`, objectKey:key,
    source:'manual-upload', manual:true, generatedAt:now, completedAt:now, updatedAt:now,
    progress:100, stage:'Imagen manual asignada', textFreeVerified:true, retryable:false,
    textValidation:{provider:'human-confirmation', passed:true, confirmedAt:now}
  });
  delete slide.error; delete slide.errorCode; delete slide.failedAt; delete slide.requestId;
  recomputeImageSet(set, now);
  await context.env.PRESENTATION_IDEAS.put(`image-set:${client}`, JSON.stringify(set));
  return json({ok:true, imageSet:publicImageSet(set)}, 201);
}

async function generate(context, payload){
  if(!context.env.XAI_API_KEY) return json({error:'La conexión con xAI todavía no está configurada.'}, 503);
  if(!context.env.PRESENTATION_MEDIA) return json({error:'El almacenamiento de imágenes no está configurado.'}, 503);
  const client = cleanClient(payload.client), setId = cleanId(payload.setId), slideId = cleanId(payload.slideId);
  if(!client || !setId || !slideId) return json({error:'Solicitud de imagen no válida.'}, 400);
  let set = await context.env.PRESENTATION_IDEAS.get(`image-set:${client}`, {type:'json'});
  if(!set || set.id !== setId) return json({error:'El paquete visual ya no es el vigente.'}, 409);
  let slide = (set.slides || []).find(item => item.id === slideId);
  if(!slide) return json({error:'La diapositiva no existe.'}, 404);
  if(slide.status === 'ready' && slide.url) return json({ok:true, reused:true, imageSet:publicImageSet(recomputeImageSet(set))});
  if(slide.status === 'processing' && Date.parse(slide.updatedAt || '') >= Date.now() - PROCESSING_TIMEOUT_MS){
    return json({error:'La imagen ya se está generando.', imageSet:publicImageSet(recomputeImageSet(set))}, 409);
  }
  const now = new Date().toISOString();
  const requestId = crypto.randomUUID();
  slide.status = 'processing'; slide.progress = 10; slide.stage = 'Solicitud enviada a Grok';
  slide.startedAt ||= now; slide.submittedAt = now; slide.updatedAt = now; slide.attempts = Number(slide.attempts || 0) + 1;
  slide.requestId = requestId; slide.source = 'xai'; slide.manual = false;
  delete slide.error; delete slide.retryable; delete slide.textFreeVerified; delete slide.failedAt;
  recomputeImageSet(set, now);
  await context.env.PRESENTATION_IDEAS.put(`image-set:${client}`, JSON.stringify(set));
  try{
    const generated = await generateImage(context.env, slide.prompt);
    ({set, slide} = await activeGeneration(context.env, client, setId, slideId, requestId));
    const receivedAt = new Date().toISOString();
    slide.progress = 72; slide.stage = 'Imagen recibida · verificando que no contiene texto'; slide.updatedAt = receivedAt;
    recomputeImageSet(set, receivedAt);
    await context.env.PRESENTATION_IDEAS.put(`image-set:${client}`, JSON.stringify(set));
    const validation = await validateTextFree(context.env, generated);
    if(!validation.passed) throw textDetectedError(validation);
    ({set, slide} = await activeGeneration(context.env, client, setId, slideId, requestId));
    const verifiedAt = new Date().toISOString();
    slide.progress = 90; slide.stage = 'Imagen verificada · guardando el fondo'; slide.updatedAt = verifiedAt;
    recomputeImageSet(set, verifiedAt);
    await context.env.PRESENTATION_IDEAS.put(`image-set:${client}`, JSON.stringify(set));
    const suffix = set.id.replace(/-/g, '').slice(0, 10);
    const filename = `${slide.id}-${suffix}.${generated.extension}`;
    const key = `presentations/${client}/grok-images/${filename}`;
    await context.env.PRESENTATION_MEDIA.put(key, generated.bytes, {
      httpMetadata:{contentType:generated.contentType, cacheControl:'private, max-age=3600'},
      customMetadata:{client, setId:set.id, slideId:slide.id, provider:'xai', model:set.model, safetyContract:set.safetyContract, textFreeVerified:'true'}
    });
    ({set, slide} = await activeGeneration(context.env, client, setId, slideId, requestId));
    const completedAt = new Date().toISOString();
    slide.status = 'ready'; slide.url = `/presentaciones/${client}/images/${filename}`;
    slide.objectKey = key; slide.generatedAt = completedAt; slide.completedAt = completedAt; slide.updatedAt = completedAt;
    slide.progress = 100; slide.stage = 'Completada';
    slide.textFreeVerified = true; slide.textValidation = validation; slide.retryable = false; slide.source = 'xai'; slide.manual = false;
    delete slide.requestId;
    if(generated.revisedPrompt) slide.revisedPrompt = generated.revisedPrompt;
    recomputeImageSet(set, completedAt);
    await context.env.PRESENTATION_IDEAS.put(`image-set:${client}`, JSON.stringify(set));
    return json({ok:true, imageSet:publicImageSet(set)}, 201);
  }catch(error){
    if(error?.code === 'generation_superseded') return json({error:error.message, imageSet:publicImageSet(error.imageSet)}, 409);
    const latest = await context.env.PRESENTATION_IDEAS.get(`image-set:${client}`, {type:'json'});
    const latestSlide = (latest?.slides || []).find(item => item.id === slideId);
    if(!latest || latest.id !== setId || !latestSlide || latestSlide.requestId !== requestId || latestSlide.manual === true){
      return json({error:'La imagen de Grok ya no es la vigente para esta diapositiva.', imageSet:publicImageSet(latest ? recomputeImageSet(latest) : null)}, 409);
    }
    set = latest; slide = latestSlide;
    const failedAt = new Date().toISOString();
    slide.status = 'failed'; slide.progress = 100; slide.stage = 'Error'; slide.error = String(error?.message || 'No se pudo generar la imagen.').slice(0, 220);
    slide.errorCode = String(error?.code || 'generation_failed').slice(0, 80);
    slide.retryable = slide.errorCode === 'visible_text_detected' && slide.attempts < MAX_TEXT_RETRIES;
    if(error?.validation) slide.textValidation = error.validation;
    slide.failedAt = failedAt; slide.updatedAt = failedAt;
    delete slide.requestId;
    recomputeImageSet(set, failedAt);
    await context.env.PRESENTATION_IDEAS.put(`image-set:${client}`, JSON.stringify(set));
    console.error(JSON.stringify({message:'grok image generation failed', client, setId:set.id, slideId:slide.id, error:slide.error}));
    return json({error:slide.error, retryable:slide.retryable, imageSet:publicImageSet(set)}, 502);
  }
}

export async function onRequest(context){
  if(!context.env.PRESENTATION_IDEAS) return json({error:'Almacenamiento no configurado.'}, 503);
  if(context.request.method === 'GET'){
    const client = cleanClient(new URL(context.request.url).searchParams.get('client'));
    if(!client) return json({error:'Presentación no válida.'}, 400);
    const inputs = await getInputs(context.env, client);
    if(!inputs.presentation || !inputs.ideas) return json({error:'Presentación no encontrada.'}, 404);
    if(recoverStalled(inputs.imageSet)) await context.env.PRESENTATION_IDEAS.put(`image-set:${client}`, JSON.stringify(inputs.imageSet));
    const planned = await buildImageSet({client, presentation:inputs.presentation, ideas:inputs.ideas, model:context.env.XAI_IMAGE_MODEL || 'grok-imagine-image'});
    return json({ok:true, slideCount:planned.total, current:inputs.imageSet?.sourceHash === planned.sourceHash, imageSet:publicImageSet(inputs.imageSet)});
  }
  if(context.request.method !== 'POST') return json({error:'Método no permitido.'}, 405);
  if(!sameOrigin(context.request)) return json({error:'Origen no permitido.'}, 403);
  const contentType = context.request.headers.get('content-type') || '';
  const contentLength = Number(context.request.headers.get('content-length') || 0);
  if(contentType.toLowerCase().startsWith('multipart/form-data')){
    if(contentLength > MAX_MULTIPART_BYTES) return json({error:'La imagen supera el límite de 10 MB.'}, 413);
    let form; try{ form = await context.request.formData(); }catch(_){ return json({error:'No se pudo leer la imagen.'}, 400); }
    if(form.get('action') !== 'upload') return json({error:'Acción no admitida.'}, 400);
    return upload(context, form);
  }
  if(contentLength > MAX_BODY_BYTES) return json({error:'Petición demasiado grande.'}, 413);
  let payload; try{ payload = await context.request.json(); }catch(_){ return json({error:'JSON no válido.'}, 400); }
  if(payload?.action === 'prepare') return prepare(context, payload);
  if(payload?.action === 'generate') return generate(context, payload);
  return json({error:'Acción no admitida.'}, 400);
}
