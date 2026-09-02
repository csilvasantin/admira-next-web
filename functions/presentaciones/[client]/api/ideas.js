import { OUTPUTS, DEFAULT_OUTPUTS, LANGUAGES, buildGeneration, publicGeneration } from '../../_generation.js';
import { normalizeInspiration } from '../../_inspiration.js';
import {captureVersion} from '../../_versions.js';

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

// Minutos declarados por lámina para el ensayo. Acepta minutes o seconds, descarta lo
// imposible y pone tope de una hora: el mismo criterio que aplica el render.
function minutosDeEnsayo(item){
  const segundos = Number(item?.seconds) > 0 ? Number(item.seconds) : Number(item?.minutes) * 60;
  if (!Number.isFinite(segundos) || segundos <= 0) return {};
  return {minutes: Math.round(Math.min(segundos, 3600) / 6) / 10};
}

// DOS IDIOMAS COMO MINIMO, CASTELLANO E INGLES (Carlos, 02-09-2026). Una presentacion
// monolingue no solo se ve a medias: apaga la propagacion de ediciones, porque
// inline-edit traduce a los OTROS idiomas de la presentacion y, si no hay otros, no hay
// nada que corregir. El deck de NVIDIA nacio solo en 'en' y por eso editar un texto no
// tocaba el castellano. El orden se respeta —el primero manda como idioma por defecto—
// y solo se anaden los que falten.
function conMinimoBilingue(lista){
  const salida = Array.isArray(lista) ? lista.filter(Boolean) : [];
  for (const obligatorio of ['es','en']) if (!salida.includes(obligatorio)) salida.push(obligatorio);
  return salida;
}

function normalize(payload, client){
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) throw new Error('Formato no válido.');
  const skeleton = Array.isArray(payload.skeleton) ? payload.skeleton.slice(0, 20) : [];
  if (!skeleton.length) throw new Error('Añade al menos una idea al esqueleto.');
  const requested = Array.isArray(payload.outputs) ? payload.outputs.map(value => String(value).toLowerCase()) : DEFAULT_OUTPUTS;
  const outputs = [...new Set(requested.filter(value => OUTPUTS.includes(value)))];
  if (!outputs.length) throw new Error('Selecciona al menos un contenido para generar.');
  const requestedLanguages = Array.isArray(payload.languages) ? payload.languages.map(value => String(value).toLowerCase()) : LANGUAGES;
  const languages = conMinimoBilingue([...new Set(requestedLanguages.filter(value => LANGUAGES.includes(value)))]);
  if (!languages.length) throw new Error('Selecciona al menos un idioma.');

  const normalizeContent = (source, fallbackSkeleton = skeleton) => ({
    hero:{eyebrow:cleanText(source?.hero?.eyebrow,120),title:cleanText(source?.hero?.title,220),summary:cleanText(source?.hero?.summary,900)},
    objective:cleanText(source?.objective,1200),
    skeleton:(Array.isArray(source?.skeleton)?source.skeleton:fallbackSkeleton).slice(0,20).map((item,index)=>({
      id:cleanText(item?.id,80)||cleanText(fallbackSkeleton[index]?.id,80)||`idea-${index+1}`,
      title:cleanText(item?.title,180)||`Idea ${index+1}`, message:cleanText(item?.message,900), detail:cleanText(item?.detail,1600), enabled:item?.enabled!==false
    })),
    closing:{title:cleanText(source?.closing?.title,220),action:cleanText(source?.closing?.action,700)},
    labels:{objective:cleanText(source?.labels?.objective,80),next:cleanText(source?.labels?.next,80)},
    notes:cleanText(source?.notes,4000)
  });
  const translations={};
  for(const language of languages){
    if(language==='es'||!payload.translations?.[language]) continue;
    translations[language]=normalizeContent(payload.translations[language]);
  }

  const inspiration=payload.inspiration?.url?normalizeInspiration(payload.inspiration,payload.inspiration.url):null;
  return {
    schemaVersion: 2,
    client,
    displayName: cleanText(payload.displayName, 100),
    inspiration,
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
      enabled: item?.enabled !== false,
      // Minutos de ensayo de ESTA lámina (Neo · MBP14, 02-09-2026). Sin esto el guardado
      // limpiaba el campo, y el atributo que el render escribe y el entrenador de ritmo
      // lee no llegaba nunca: el contrato tenía tres mitades —quien lo lee, quien lo
      // escribe y quien lo guarda— y ésta era la que faltaba.
      ...minutosDeEnsayo(item)
    })),
    closing: {
      title: cleanText(payload.closing?.title, 220),
      action: cleanText(payload.closing?.action, 700)
    },
    labels: {
      objective: cleanText(payload.labels?.objective, 80) || 'El objetivo',
      next: cleanText(payload.labels?.next, 80) || 'Siguiente paso'
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
  return `ADMIRANEXT × ${data.displayName}\nGUION MAESTRO DE PRESENTACIÓN\n\n` +
    `Titular: ${data.hero.title}\nEntradilla: ${data.hero.summary}\nObjetivo: ${data.objective}\n\n` +
    `${blocks}\n\nCIERRE\n${data.closing.title}\nSiguiente acción: ${data.closing.action}\n${inspiration}\n` +
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

  const generation = buildGeneration({...data, sourceText:buildSource(data)});
  const writes = [
    context.env.PRESENTATION_IDEAS.put(key, JSON.stringify(data)),
    context.env.PRESENTATION_IDEAS.put(`generation:${client}`, JSON.stringify(generation))
  ];
  if (generated){
    generated.outputs = data.outputs;
    generated.languages = data.languages;
    generated.updatedAt = data.updatedAt;
    writes.push(context.env.PRESENTATION_IDEAS.put(`presentation:${client}`, JSON.stringify(generated)));
  }
  await Promise.all(writes);
  await captureVersion(context.env,client,'esqueleto guardado',{presentation:generated?{...generated,outputs:data.outputs,languages:data.languages,updatedAt:data.updatedAt}:undefined,ideas:data,generation});
  return response({ ok: true, data, generation: publicGeneration(generation) });
}
