import {analyzeInspiration} from '../_inspiration.js';

const MAX_REQUEST_BYTES = 4 * 1024;
const INTERNAL_HOSTS = new Set(['admiranext.com', 'www.admiranext.com', 'pixeria.com', 'www.pixeria.com']);
const LANGUAGES = new Set(['es', 'en', 'ca']);

function json(payload, status = 200){
  return Response.json(payload, {status, headers:{
    'cache-control':'no-store',
    'content-type':'application/json; charset=utf-8',
    'x-content-type-options':'nosniff'
  }});
}

function clean(value, maxLength = 240){
  return String(value == null ? '' : value)
    .replace(/[\u0000-\u001f\u007f]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, maxLength);
}

function sameOrigin(request){
  const origin = request.headers.get('origin');
  if(!origin) return true;
  try{return new URL(origin).origin === new URL(request.url).origin;}catch(_){return false;}
}

async function readJsonLimited(request){
  const declared = Number(request.headers.get('content-length') || 0);
  if(declared > MAX_REQUEST_BYTES) throw new Error('body_too_large');
  if(!request.body) throw new Error('json_invalid');
  const reader = request.body.getReader();
  const chunks = [];
  let total = 0;
  try{
    while(true){
      const {done, value} = await reader.read();
      if(done) break;
      total += value.byteLength;
      if(total > MAX_REQUEST_BYTES){await reader.cancel(); throw new Error('body_too_large');}
      chunks.push(value);
    }
  }finally{reader.releaseLock();}
  const bytes = new Uint8Array(total);
  let offset = 0;
  for(const chunk of chunks){bytes.set(chunk, offset); offset += chunk.byteLength;}
  try{return JSON.parse(new TextDecoder().decode(bytes));}catch(_){throw new Error('json_invalid');}
}

async function consumeRateLimit(env, request){
  const ip = clean(request.headers.get('cf-connecting-ip'), 80);
  const store = env.PRESENTATION_IDEAS;
  if(!ip || !store || typeof store.get !== 'function' || typeof store.put !== 'function') return true;
  const key = `tiktok:source-brief:rate:${ip}:${Math.floor(Date.now() / 60000)}`;
  const count = Math.max(0, Number(await store.get(key)) || 0);
  if(count >= 12) return false;
  await store.put(key, String(count + 1), {expirationTtl:120});
  return true;
}

export function parseSourceUrl(value){
  let url;
  try{url = new URL(clean(value, 1600));}catch(_){throw new Error('Introduce una URL válida.');}
  if(url.protocol !== 'https:' || url.username || url.password || (url.port && url.port !== '443')){
    throw new Error('La fuente debe ser una URL https pública y segura.');
  }
  url.hash = '';
  const host = url.hostname.toLowerCase();
  const match = INTERNAL_HOSTS.has(host)
    ? url.pathname.match(/^\/presentaciones\/([a-z0-9][a-z0-9-]{0,79})\/presentacion\/?$/i)
    : null;
  return {
    url,
    presentation:match ? {client:match[1].toLowerCase(), language:LANGUAGES.has(url.searchParams.get('lang')) ? url.searchParams.get('lang') : 'es'} : null
  };
}

function block(value = {}){
  return {
    id:clean(value.id, 80),
    title:clean(value.title, 180),
    message:clean(value.message, 360),
    detail:clean(value.detail, 500),
    enabled:value.enabled !== false
  };
}

function locale(value = {}, fallback = {}){
  const ownBlocks = Array.isArray(value.skeleton) ? value.skeleton : [];
  const fallbackBlocks = Array.isArray(fallback.skeleton) ? fallback.skeleton : [];
  return {
    hero:{
      eyebrow:clean(value.hero?.eyebrow || fallback.hero?.eyebrow, 180),
      title:clean(value.hero?.title || fallback.hero?.title, 220),
      summary:clean(value.hero?.summary || fallback.hero?.summary, 600)
    },
    objective:clean(value.objective || fallback.objective, 600),
    skeleton:(ownBlocks.length ? ownBlocks : fallbackBlocks).filter(item => item?.enabled !== false).map(block),
    closing:{
      title:clean(value.closing?.title || fallback.closing?.title, 260),
      action:clean(value.closing?.action || fallback.closing?.action, 180)
    }
  };
}

function audienceFromConfig(config = {}){
  const source = config.audience || config.targetAudience || config.problem?.audience || '';
  if(Array.isArray(source)) return clean(source.join(', '), 110);
  if(typeof source === 'object') return clean(source.primary || source.description || '', 110);
  return clean(source, 110);
}

export function briefFromPresentation(config = {}, ideas = {}, language = 'es'){
  const base = locale(ideas);
  const selected = language === 'es' ? base : locale(ideas.translations?.[language] || {}, base);
  const keyPoints = selected.skeleton
    .map(item => clean([item.title, item.message || item.detail].filter(Boolean).join(': '), 240))
    .filter(Boolean)
    .slice(0, 5);
  const title = selected.hero.title || selected.objective || clean(config.displayName, 180) || 'Presentación';
  const summary = selected.hero.summary || selected.objective || keyPoints[0] || title;
  const solutionParts = [selected.objective, ...keyPoints.slice(0, 2)].filter(Boolean);
  const solution = clean(solutionParts.join(' · '), 220) || clean(summary, 220);
  const result = clean(selected.closing.title || keyPoints.at(-1) || summary, 150);
  const cta = clean(selected.closing.action, 90) || (language === 'en' ? 'Discover the full presentation' : language === 'ca' ? 'Descobreix la presentació completa' : 'Descubre la presentación completa');
  const audience = audienceFromConfig(config) || (language === 'en' ? 'People interested in this proposal' : language === 'ca' ? 'Persones interessades en aquesta proposta' : 'Personas interesadas en esta propuesta');
  return {
    source:{
      kind:'presentation',
      client:clean(config.slug, 80),
      language,
      title,
      slideCount:selected.skeleton.length + 3
    },
    summary:clean(summary, 600),
    keyPoints,
    brief:{task:clean(title, 180), solution, result, presenter:'nexo', tone:'expert', audience, cta}
  };
}

function sentences(value){
  return clean(value, 5000).split(/(?<=[.!?])\s+/).map(item => clean(item, 260)).filter(item => item.length >= 24);
}

export function briefFromWeb(inspiration = {}){
  const title = clean(inspiration.title || inspiration.host, 180) || 'Contenido web';
  const description = clean(inspiration.description, 600);
  const extracted = sentences(inspiration.contentExcerpt || '');
  const keyPoints = [...new Set([description, ...extracted].filter(Boolean))].slice(0, 5);
  const summary = keyPoints[0] || `Resumen de ${title}`;
  return {
    source:{kind:'web', language:'auto', title, host:clean(inspiration.host, 180)},
    summary,
    keyPoints,
    brief:{
      task:title,
      solution:clean(keyPoints.slice(0, 2).join(' · '), 220) || clean(summary, 220),
      result:clean(keyPoints[2] || summary, 150),
      presenter:'nexo',
      tone:'expert',
      audience:'Personas interesadas en este contenido',
      cta:'Consulta la fuente completa'
    }
  };
}

export async function onRequest(context){
  const {request, env} = context;
  if(request.method !== 'POST') return json({error:'Método no permitido.'}, 405);
  if(!sameOrigin(request)) return json({error:'Origen no permitido.'}, 403);
  if(!(request.headers.get('content-type') || '').toLowerCase().startsWith('application/json')) return json({error:'Usa JSON para preparar la fuente.'}, 415);

  let body;
  try{body = await readJsonLimited(request);}catch(error){
    return json({error:error.message === 'body_too_large' ? 'La solicitud es demasiado grande.' : 'JSON no válido.'}, error.message === 'body_too_large' ? 413 : 400);
  }

  let parsed;
  try{parsed = parseSourceUrl(body?.url);}catch(error){return json({error:error.message}, 422);}
  if(!(await consumeRateLimit(env, request))) return json({error:'Has preparado muchas URLs seguidas. Espera un minuto y vuelve a intentarlo.'}, 429);

  try{
    let result;
    if(parsed.presentation){
      if(!env.PRESENTATION_IDEAS) return json({error:'El almacén de presentaciones no está disponible.'}, 503);
      const {client, language} = parsed.presentation;
      const [config, ideas] = await Promise.all([
        env.PRESENTATION_IDEAS.get(`presentation:${client}`, {type:'json'}),
        env.PRESENTATION_IDEAS.get(`ideas:${client}`, {type:'json'})
      ]);
      if(!config || !ideas) return json({error:'No encontramos esa presentación o todavía no tiene contenido.'}, 404);
      result = briefFromPresentation({...config, slug:client}, ideas, language);
    }else{
      result = briefFromWeb(await analyzeInspiration(parsed.url.toString()));
    }
    return json({ok:true, ...result, source:{...result.source, url:parsed.url.toString()}});
  }catch(error){
    console.error(JSON.stringify({message:'source brief failed', error:String(error?.message || error).slice(0, 300)}));
    return json({error:error?.message || 'No se pudo leer la URL.'}, 422);
  }
}
