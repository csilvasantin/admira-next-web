import {buildImageSet, publicImageSet, recomputeImageSet} from '../_grok-images.js';

const MAX_BODY_BYTES = 32 * 1024;
const MAX_BASE64_CHARS = 14 * 1024 * 1024;
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
  throw new Error('Grok devolvió un formato de imagen no admitido.');
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
    let recovered = false;
    const expiredBefore = Date.now() - PROCESSING_TIMEOUT_MS;
    for(const slide of inputs.imageSet.slides || []){
      if(slide.status === 'processing' && Date.parse(slide.updatedAt || '') < expiredBefore){
        slide.status = 'failed'; slide.error = 'La generación anterior se interrumpió; puedes reintentarla.';
        slide.updatedAt = new Date().toISOString(); recovered = true;
      }
    }
    if(recovered){
      recomputeImageSet(inputs.imageSet);
      await context.env.PRESENTATION_IDEAS.put(`image-set:${client}`, JSON.stringify(inputs.imageSet));
    }
    return json({ok:true, reused:true, imageSet:publicImageSet(inputs.imageSet)});
  }
  await context.env.PRESENTATION_IDEAS.put(`image-set:${client}`, JSON.stringify(candidate));
  return json({ok:true, reused:false, imageSet:publicImageSet(candidate)}, 201);
}

async function generate(context, payload){
  if(!context.env.XAI_API_KEY) return json({error:'La conexión con xAI todavía no está configurada.'}, 503);
  if(!context.env.PRESENTATION_MEDIA) return json({error:'El almacenamiento de imágenes no está configurado.'}, 503);
  const client = cleanClient(payload.client), setId = cleanId(payload.setId), slideId = cleanId(payload.slideId);
  if(!client || !setId || !slideId) return json({error:'Solicitud de imagen no válida.'}, 400);
  const set = await context.env.PRESENTATION_IDEAS.get(`image-set:${client}`, {type:'json'});
  if(!set || set.id !== setId) return json({error:'El paquete visual ya no es el vigente.'}, 409);
  const slide = (set.slides || []).find(item => item.id === slideId);
  if(!slide) return json({error:'La diapositiva no existe.'}, 404);
  if(slide.status === 'ready' && slide.url) return json({ok:true, reused:true, imageSet:publicImageSet(recomputeImageSet(set))});
  if(slide.status === 'processing' && Date.parse(slide.updatedAt || '') >= Date.now() - PROCESSING_TIMEOUT_MS){
    return json({error:'La imagen ya se está generando.', imageSet:publicImageSet(recomputeImageSet(set))}, 409);
  }
  const now = new Date().toISOString();
  slide.status = 'processing'; slide.updatedAt = now; slide.attempts = Number(slide.attempts || 0) + 1;
  delete slide.error; delete slide.retryable; delete slide.textFreeVerified;
  recomputeImageSet(set, now);
  await context.env.PRESENTATION_IDEAS.put(`image-set:${client}`, JSON.stringify(set));
  try{
    const generated = await generateImage(context.env, slide.prompt);
    const validation = await validateTextFree(context.env, generated);
    if(!validation.passed) throw textDetectedError(validation);
    const suffix = set.id.replace(/-/g, '').slice(0, 10);
    const filename = `${slide.id}-${suffix}.${generated.extension}`;
    const key = `presentations/${client}/grok-images/${filename}`;
    await context.env.PRESENTATION_MEDIA.put(key, generated.bytes, {
      httpMetadata:{contentType:generated.contentType, cacheControl:'private, max-age=3600'},
      customMetadata:{client, setId:set.id, slideId:slide.id, provider:'xai', model:set.model, safetyContract:set.safetyContract, textFreeVerified:'true'}
    });
    const completedAt = new Date().toISOString();
    slide.status = 'ready'; slide.url = `/presentaciones/${client}/images/${filename}`;
    slide.objectKey = key; slide.generatedAt = completedAt; slide.updatedAt = completedAt;
    slide.textFreeVerified = true; slide.textValidation = validation; slide.retryable = false;
    if(generated.revisedPrompt) slide.revisedPrompt = generated.revisedPrompt;
    recomputeImageSet(set, completedAt);
    await context.env.PRESENTATION_IDEAS.put(`image-set:${client}`, JSON.stringify(set));
    return json({ok:true, imageSet:publicImageSet(set)}, 201);
  }catch(error){
    const failedAt = new Date().toISOString();
    slide.status = 'failed'; slide.error = String(error?.message || 'No se pudo generar la imagen.').slice(0, 220);
    slide.errorCode = String(error?.code || 'generation_failed').slice(0, 80);
    slide.retryable = slide.errorCode === 'visible_text_detected' && slide.attempts < MAX_TEXT_RETRIES;
    if(error?.validation) slide.textValidation = error.validation;
    slide.failedAt = failedAt; slide.updatedAt = failedAt;
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
    const planned = await buildImageSet({client, presentation:inputs.presentation, ideas:inputs.ideas, model:context.env.XAI_IMAGE_MODEL || 'grok-imagine-image'});
    return json({ok:true, slideCount:planned.total, current:inputs.imageSet?.sourceHash === planned.sourceHash, imageSet:publicImageSet(inputs.imageSet)});
  }
  if(context.request.method !== 'POST') return json({error:'Método no permitido.'}, 405);
  if(!sameOrigin(context.request)) return json({error:'Origen no permitido.'}, 403);
  if(Number(context.request.headers.get('content-length') || 0) > MAX_BODY_BYTES) return json({error:'Petición demasiado grande.'}, 413);
  let payload; try{ payload = await context.request.json(); }catch(_){ return json({error:'JSON no válido.'}, 400); }
  if(payload?.action === 'prepare') return prepare(context, payload);
  if(payload?.action === 'generate') return generate(context, payload);
  return json({error:'Acción no admitida.'}, 400);
}
