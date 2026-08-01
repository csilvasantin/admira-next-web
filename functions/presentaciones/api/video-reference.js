const MAX_REQUEST_BYTES = 2 * 1024 * 1024;
const MAX_PROVIDER_BYTES = 64 * 1024;
const MAX_FRAME_CHARS = 420 * 1024;
const MAX_FRAMES = 4;
const MAX_REMOTE_IMAGE_BYTES = 1024 * 1024;
const DATA_IMAGE_RE = /^data:image\/(?:jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/;

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

function clean(value, maxLength = 500){
  return String(value == null ? '' : value)
    .replace(/[\u0000-\u001f\u007f]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, maxLength);
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

async function readProviderJson(response){
  const declared = Number(response.headers.get('content-length') || 0);
  if(declared > MAX_PROVIDER_BYTES) throw new Error('provider_too_large');
  if(!response.body) return {};
  const reader = response.body.getReader();
  const chunks = [];
  let total = 0;
  try{
    while(true){
      const {done, value} = await reader.read();
      if(done) break;
      total += value.byteLength;
      if(total > MAX_PROVIDER_BYTES){ await reader.cancel(); throw new Error('provider_too_large'); }
      chunks.push(value);
    }
  }finally{ reader.releaseLock(); }
  const bytes = new Uint8Array(total);
  let offset = 0;
  for(const chunk of chunks){ bytes.set(chunk, offset); offset += chunk.byteLength; }
  try{ return JSON.parse(new TextDecoder().decode(bytes)); }
  catch(_){ throw new Error('provider_invalid'); }
}

function outputText(payload){
  return payload?.output
    ?.find(item => item?.type === 'message')
    ?.content?.find(item => item?.type === 'output_text')?.text;
}

function providerMessage(status){
  if(status === 401 || status === 403) return 'La conexión visual con Grok no está autorizada.';
  if(status === 429) return 'Grok está ocupado. Prueba de nuevo en unos segundos.';
  if(status >= 500) return 'Grok no está disponible temporalmente.';
  return 'Grok no pudo analizar el vídeo de referencia.';
}

function youtubeVideoId(value){
  try{
    const url = new URL(value);
    if(url.protocol !== 'https:' || url.username || url.password) return '';
    const host = url.hostname.toLowerCase();
    let id = '';
    if(host === 'youtu.be') id = url.pathname.split('/').filter(Boolean)[0] || '';
    else if(host === 'youtube.com' || host.endsWith('.youtube.com')){
      if(url.pathname === '/watch') id = url.searchParams.get('v') || '';
      else id = url.pathname.match(/^\/(?:embed|shorts|live)\/([A-Za-z0-9_-]{11})(?:\/|$)/)?.[1] || '';
    }
    return /^[A-Za-z0-9_-]{11}$/.test(id) ? id : '';
  }catch(_){ return ''; }
}

function base64(bytes){
  let binary = '';
  for(let offset = 0; offset < bytes.length; offset += 0x8000){
    binary += String.fromCharCode(...bytes.subarray(offset, offset + 0x8000));
  }
  return btoa(binary);
}

async function readImageLimited(response){
  if(!response.ok || !String(response.headers.get('content-type') || '').toLowerCase().startsWith('image/')) throw new Error('remote_image_invalid');
  const declared = Number(response.headers.get('content-length') || 0);
  if(declared > MAX_REMOTE_IMAGE_BYTES) throw new Error('remote_image_too_large');
  if(!response.body) throw new Error('remote_image_empty');
  const reader = response.body.getReader();
  const chunks = [];
  let total = 0;
  try{
    while(true){
      const {done, value} = await reader.read();
      if(done) break;
      total += value.byteLength;
      if(total > MAX_REMOTE_IMAGE_BYTES){ await reader.cancel(); throw new Error('remote_image_too_large'); }
      chunks.push(value);
    }
  }finally{ reader.releaseLock(); }
  const bytes = new Uint8Array(total);
  let offset = 0;
  for(const chunk of chunks){ bytes.set(chunk, offset); offset += chunk.byteLength; }
  if(bytes.length < 4 || bytes[0] !== 0xff || bytes[1] !== 0xd8) throw new Error('remote_image_invalid');
  return `data:image/jpeg;base64,${base64(bytes)}`;
}

async function youtubeFrames(videoId){
  const names = ['hq1.jpg', 'hq2.jpg', 'hq3.jpg', 'hqdefault.jpg'];
  const results = await Promise.allSettled(names.map(async name => {
    const url = `https://i.ytimg.com/vi/${videoId}/${name}`;
    const response = await fetch(url, {redirect:'error', headers:{accept:'image/jpeg'}});
    return readImageLimited(response);
  }));
  const frames = results.filter(result => result.status === 'fulfilled').map(result => result.value);
  if(frames.length < 3) throw new Error('youtube_frames_unavailable');
  return frames.slice(0, MAX_FRAMES);
}

function publicProfile(candidate){
  const fields = ['summary','camera','rhythm','palette','lighting','composition','avoid'];
  const profile = {};
  for(const field of fields) profile[field] = clean(candidate?.[field], field === 'summary' ? 360 : 260);
  if(fields.some(field => !profile[field])) throw new Error('profile_invalid');
  profile.promptFragment = clean([
    'REFERENCE STYLE GUIDE (inferred from sampled frames; use as direction, never as source footage):',
    `Overall: ${profile.summary}.`,
    `Camera: ${profile.camera}. Rhythm and movement: ${profile.rhythm}.`,
    `Palette: ${profile.palette}. Lighting: ${profile.lighting}. Composition: ${profile.composition}.`,
    `Originality guardrail: ${profile.avoid}. Do not reproduce identifiable people, brands, logos, locations, characters, text, or exact shot compositions from the reference.`
  ].join(' '), 1500);
  return profile;
}

export async function onRequest(context){
  const {request, env} = context;
  if(request.method !== 'POST') return json({error:'Método no permitido.'}, 405);
  if(!sameOrigin(request)) return json({error:'Origen no permitido.'}, 403);
  if(!env.XAI_API_KEY) return json({error:'La conexión con xAI todavía no está configurada.'}, 503);

  let body;
  try{ body = await readJsonLimited(request, MAX_REQUEST_BYTES); }
  catch(error){
    return json({error:error.message === 'body_too_large' ? 'La referencia supera el tamaño permitido.' : 'No pudimos leer los fotogramas de referencia.'}, error.message === 'body_too_large' ? 413 : 400);
  }
  let frames = Array.isArray(body?.frames) ? body.frames.slice(0, MAX_FRAMES) : [];
  const sourceUrl = clean(body?.sourceUrl, 1000);
  const youtubeId = sourceUrl ? youtubeVideoId(sourceUrl) : '';
  if(!youtubeId){
    if(sourceUrl) return json({error:'La URL remota debe ser un vídeo válido de YouTube.'}, 400);
    if(frames.length < 3 || frames.length > MAX_FRAMES) return json({error:'Necesitamos entre tres y cuatro fotogramas de referencia.'}, 400);
    if(frames.some(frame => typeof frame !== 'string' || frame.length > MAX_FRAME_CHARS || !DATA_IMAGE_RE.test(frame))){
      return json({error:'Algún fotograma no es una imagen JPEG, PNG o WebP válida.'}, 415);
    }
  }

  if(env.PRESENTATION_IDEAS){
    const ip = request.headers.get('CF-Connecting-IP') || 'unknown';
    const hash = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(ip));
    const suffix = Array.from(new Uint8Array(hash)).slice(0, 12).map(byte => byte.toString(16).padStart(2, '0')).join('');
    const key = `tiktok:video-reference:rate:${suffix}`;
    if(await env.PRESENTATION_IDEAS.get(key)) return json({error:'Espera unos segundos antes de analizar otra referencia.'}, 429);
    await env.PRESENTATION_IDEAS.put(key, '1', {expirationTtl:60});
  }

  if(youtubeId){
    try{ frames = await youtubeFrames(youtubeId); }
    catch(_){ return json({error:'No pudimos recuperar fotogramas representativos de ese vídeo de YouTube.'}, 502); }
  }

  const visualContent = [
    {type:'input_text', text:'These are evenly sampled frames from one reference video, in chronological order. Infer a concise visual language for a new, fully original vertical advertisement. Describe observable camera behavior cautiously from frame-to-frame changes. Do not identify people, places, brands, IP, or products. Do not copy content; translate only abstract visual traits.'},
    ...frames.map(image_url => ({type:'input_image', image_url, detail:'high'}))
  ];
  const response = await fetch('https://api.x.ai/v1/responses', {
    method:'POST',
    headers:{'content-type':'application/json', authorization:`Bearer ${env.XAI_API_KEY}`},
    body:JSON.stringify({
      model:env.XAI_VISION_MODEL || env.XAI_TEXT_MODEL || 'grok-4.5',
      store:false,
      input:[
        {role:'system', content:[{type:'input_text', text:'You are a film style analyst. Return Spanish JSON only. Extract reusable abstract direction while enforcing originality and privacy.'}]},
        {role:'user', content:visualContent}
      ],
      text:{format:{type:'json_schema', name:'video_reference_style', strict:true, schema:{
        type:'object', additionalProperties:false,
        properties:{
          summary:{type:'string'}, camera:{type:'string'}, rhythm:{type:'string'},
          palette:{type:'string'}, lighting:{type:'string'}, composition:{type:'string'}, avoid:{type:'string'}
        },
        required:['summary','camera','rhythm','palette','lighting','composition','avoid']
      }}}
    })
  });
  if(!response.ok) return json({error:providerMessage(response.status)}, response.status === 429 ? 429 : 502);
  try{
    const payload = await readProviderJson(response);
    const parsed = JSON.parse(outputText(payload) || '');
    return json({ok:true, source:youtubeId ? {kind:'youtube', videoId:youtubeId} : {kind:'frames'}, profile:publicProfile(parsed)});
  }catch(_){ return json({error:'Grok no devolvió una guía visual válida.'}, 502); }
}
