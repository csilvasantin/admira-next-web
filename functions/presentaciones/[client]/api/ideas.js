import { OUTPUTS, LANGUAGES, buildGeneration, publicGeneration } from '../../_generation.js';
import { normalizeInspiration } from '../../_inspiration.js';
import { normalizeMood, normalizePresentationStyle, themeFromPresentationStyle, presentationStyleBrief } from '../../_mood.js';

const BUILT_IN = new Set(['lacaixa', 'clearchannel', 'lenovo']);
const MAX_BYTES = 64 * 1024;

function response(body, status = 200){
  return new Response(body == null ? null : JSON.stringify(body), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store, must-revalidate',
      'x-content-type-options': 'nosniff'
    }
  });
}

function cleanText(value, max = 1600){
  return String(value == null ? '' : value).replace(/\r\n?/g, '\n').trim().slice(0, max);
}

function normalize(payload, client){
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) throw new Error('Formato no válido.');
  const skeleton = Array.isArray(payload.skeleton) ? payload.skeleton.slice(0, 20) : [];
  if (!skeleton.length) throw new Error('Añade al menos una idea al esqueleto.');
  const requested = Array.isArray(payload.outputs) ? payload.outputs.map(value => String(value).toLowerCase()) : OUTPUTS;
  const outputs = [...new Set(requested.filter(value => OUTPUTS.includes(value)))];
  if (!outputs.length) throw new Error('Selecciona al menos un contenido para generar.');
  const requestedLanguages = Array.isArray(payload.languages) ? payload.languages.map(value => String(value).toLowerCase()) : LANGUAGES;
  const languages = [...new Set(requestedLanguages.filter(value => LANGUAGES.includes(value)))];
  if (!languages.length) throw new Error('Selecciona al menos un idioma.');

  const normalizeContent = (source, fallbackSkeleton = skeleton) => ({
    hero:{eyebrow:cleanText(source?.hero?.eyebrow,120),title:cleanText(source?.hero?.title,220),summary:cleanText(source?.hero?.summary,900)},
    objective:cleanText(source?.objective,1200),
    skeleton:(Array.isArray(source?.skeleton)?source.skeleton:fallbackSkeleton).slice(0,20).map((item,index)=>({
      id:cleanText(item?.id,80)||cleanText(fallbackSkeleton[index]?.id,80)||`idea-${index+1}`,
      title:cleanText(item?.title,180)||`Idea ${index+1}`, message:cleanText(item?.message,900), detail:cleanText(item?.detail,1600), enabled:item?.enabled!==false
    })),
    closing:{title:cleanText(source?.closing?.title,220),action:cleanText(source?.closing?.action,700)},
    notes:cleanText(source?.notes,4000)
  });
  const translations={};
  for(const language of languages){
    if(language==='es'||!payload.translations?.[language]) continue;
    translations[language]=normalizeContent(payload.translations[language]);
  }

  const inspiration=payload.inspiration?.url?normalizeInspiration(payload.inspiration,payload.inspiration.url):null;
  const presentationStyle=normalizePresentationStyle(payload.presentationStyle,payload.mood?'movie':'classic');
  const mood=presentationStyle==='movie'?normalizeMood(payload.mood,{randomWhenEmpty:false}):null;
  return {
    schemaVersion: 2,
    client,
    displayName: cleanText(payload.displayName, 100),
    inspiration,
    presentationStyle,
    mood,
    languages,
    translations,
    hero: {
      eyebrow: cleanText(payload.hero?.eyebrow, 120),
      title: cleanText(payload.hero?.title, 220),
      summary: cleanText(payload.hero?.summary, 900)
    },
    objective: cleanText(payload.objective, 1200),
    outputs,
    skeleton: skeleton.map((item, index) => ({
      id: cleanText(item?.id, 80) || `idea-${index + 1}`,
      title: cleanText(item?.title, 180) || `Idea ${index + 1}`,
      message: cleanText(item?.message, 900),
      detail: cleanText(item?.detail, 1600),
      enabled: item?.enabled !== false
    })),
    closing: {
      title: cleanText(payload.closing?.title, 220),
      action: cleanText(payload.closing?.action, 700)
    },
    notes: cleanText(payload.notes, 4000),
    updatedAt: new Date().toISOString()
  };
}

function buildSource(data){
  const blocks = data.skeleton.filter(item => item.enabled !== false).map((item, index) =>
    `${index + 1}. ${item.title}\nIdea principal: ${item.message}\nDesarrollo: ${item.detail}`
  ).join('\n\n');
  const translated = (data.languages||[]).filter(language=>language!=='es'&&data.translations?.[language]).map(language=>{
    const content=data.translations[language];
    const localizedBlocks=(content.skeleton||[]).filter(item=>item.enabled!==false).map((item,index)=>`${index+1}. ${item.title}\n${item.message}\n${item.detail}`).join('\n\n');
    return `\n\nVERSIÓN ${language.toUpperCase()}\n${content.hero?.title||''}\n${content.hero?.summary||''}\n\n${localizedBlocks}\n\n${content.closing?.title||''}\n${content.closing?.action||''}`;
  }).join('');
  const inspiration=data.inspiration?`\nDIRECCIÓN VISUAL\nReferencia: ${data.inspiration.url}\nPerfil: ${data.inspiration.profile}; modo ${data.inspiration.mode}; tipografía ${data.inspiration.fontStyle}; geometría ${data.inspiration.radiusStyle}; densidad ${data.inspiration.density}; composición ${data.inspiration.layout}.\nInterpretar, no copiar: conservar el ADN visual en todos los entregables sin reutilizar marca, código ni textos propietarios.\n`:'';
  const presentationStyle=presentationStyleBrief(data.presentationStyle,data.mood,data.displayName);
  return `ADMIRANEXT × ${data.displayName}\nGUION MAESTRO DE PRESENTACIÓN\n\n` +
    `Titular: ${data.hero.title}\nEntradilla: ${data.hero.summary}\nObjetivo: ${data.objective}\n\n` +
    `${blocks}\n\nCIERRE\n${data.closing.title}\nSiguiente acción: ${data.closing.action}\n${presentationStyle}${inspiration}\n` +
    `CRITERIOS DE PRODUCCIÓN\n- La identidad editorial y visual principal es AdmiraNeXT × ${data.displayName}.\n` +
    `- Mantener un tono ejecutivo, claro, humano y orientado a decisión.\n` +
    `- Respetar la marca, logotipo y colores oficiales del cliente y la dirección visual inspiradora.\n` +
    `- No inventar cifras ni afirmaciones que no estén respaldadas por las fuentes.\n` +
    `- En vídeo, eliminar únicamente la tarjeta final del proveedor y prolongar el último fotograma limpio durante ese tramo.\n` +
    `- No sustituir el cierre por otra plantilla ni cambiar paleta, tipografía, textura, composición o duración.\n` +
    `- Notas del editor: ${data.notes || 'Sin notas adicionales.'}${translated}`;
}

export async function onRequest(context){
  const client = String(context.params.client || '').toLowerCase();
  if (!context.env.PRESENTATION_IDEAS) return response({ error: 'Almacenamiento no configurado.' }, 503);
  const validSlug = /^[a-z0-9][a-z0-9-]{1,62}$/.test(client);
  const generated = validSlug ? await context.env.PRESENTATION_IDEAS.get(`presentation:${client}`, { type:'json' }) : null;
  if (!BUILT_IN.has(client) && !generated) return response({ error: 'Cliente no válido.' }, 404);

  const key = `ideas:${client}`;
  if (context.request.method === 'GET'){
    const requestedKey = new URL(context.request.url).searchParams.get('base') === '1' ? `ideas-base:${client}` : key;
    const saved = await context.env.PRESENTATION_IDEAS.get(requestedKey, { type: 'json' }) ||
      await context.env.PRESENTATION_IDEAS.get(key, { type: 'json' });
    return saved ? response(saved) : response({ error: 'Todavía no hay una versión guardada.' }, 404);
  }

  if (context.request.method !== 'PUT') return response({ error: 'Método no permitido.' }, 405);

  const origin = context.request.headers.get('Origin');
  const url = new URL(context.request.url);
  if (!origin || origin !== url.origin) return response({ error: 'Origen no permitido.' }, 403);
  const length = Number(context.request.headers.get('Content-Length') || 0);
  if (length > MAX_BYTES) return response({ error: 'El contenido es demasiado grande.' }, 413);

  let payload;
  try { payload = await context.request.json(); }
  catch (_) { return response({ error: 'JSON no válido.' }, 400); }

  let data;
  try { data = normalize(payload, client); }
  catch (error) { return response({ error: error.message || 'Contenido no válido.' }, 400); }

  const generation = buildGeneration({...data, presentationStyle:data.presentationStyle, mood:data.mood, sourceText:buildSource(data)});
  const writes = [
    context.env.PRESENTATION_IDEAS.put(key, JSON.stringify(data)),
    context.env.PRESENTATION_IDEAS.put(`generation:${client}`, JSON.stringify(generation))
  ];
  if (generated){
    generated.outputs = data.outputs;
    generated.languages = data.languages;
    generated.presentationStyle = data.presentationStyle;
    generated.mood = data.mood;
    const themeOverrides={};
    if(generated.theme?.primary)themeOverrides.primary=generated.theme.primary;
    if(generated.theme?.accent)themeOverrides.accent=generated.theme.accent;
    generated.theme=themeFromPresentationStyle(data.presentationStyle,data.mood,themeOverrides);
    generated.updatedAt = data.updatedAt;
    writes.push(context.env.PRESENTATION_IDEAS.put(`presentation:${client}`, JSON.stringify(generated)));
  }
  await Promise.all(writes);
  return response({ ok: true, data, generation: publicGeneration(generation) });
}
