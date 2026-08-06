// Redacción del esqueleto de la presentación.
//
// El arco narrativo es de la casa y NO lo decide el modelo: son siempre los mismos ocho
// pasos, con los mismos ids, porque de esos ids cuelgan las claves de diapositiva
// (sourceSlideKeys) y el contrato de trazabilidad de fuentes. Lo que sí cambia por cliente
// es el TEXTO de cada paso: hasta ahora era un molde con el nombre interpolado y por eso
// ninguna primera generación era presentable sin retoques.
//
// Si falta la clave de xAI, el modelo tarda o devuelve algo que no encaja, se cae al molde
// de siempre: crear la presentación nunca puede depender de que el proveedor responda.

const MAX_OUTPUT_BYTES = 256 * 1024;
// Medido el 6-ago-2026 contra grok-4.5: 33,7 s con effort 'low' y 49,2 s con 'high', para la
// misma especificidad de texto. 45 s de plazo dejaban fuera la respuesta buena por los pelos.
const TIMEOUT_MS = 90000;

export const BLUEPRINT = [
  {id:'problema', role:'La tensión real del negocio del cliente que merece resolverse. Empieza por negocio, nunca por tecnología.'},
  {id:'momento',  role:'Por qué ahora: qué ha cambiado en su sector o en su operación que abre una ventana inmediata.'},
  {id:'vision',   role:'La visión: cómo se ve su espacio cuando el problema está resuelto. Concreta y reconocible para ellos.'},
  {id:'crear',    role:'Crear — Pixeria convierte su brief en contenidos y variantes gobernadas, con su marca y sus aprobaciones.'},
  {id:'activar',  role:'Activar — admira.tv lleva cada contenido al punto y al momento correctos de su red.'},
  {id:'entender', role:'Entender — XpaceOS convierte su espacio físico en información accionable, con privacidad desde el diseño.'},
  {id:'medir',    role:'Medir y aprender — OmniPublicity conecta exposición, comportamiento y resultado de negocio.'},
  {id:'piloto',   role:'El primer piloto: alcance pequeño y real, con ubicación, plazo y métricas que ellos puedan defender.'}
];

const IDS = BLUEPRINT.map(item => item.id);
const LIMITS = {title:120, message:260, detail:420, heroTitle:220, heroSummary:900, objective:1200, closingTitle:220, closingAction:400};

function clean(value, max){
  return String(value == null ? '' : value).replace(/\s+/g,' ').trim().slice(0, max);
}

function stringField(){ return {type:'string'}; }

const SCHEMA = {
  type:'object', additionalProperties:false,
  properties:{
    hero:{type:'object', additionalProperties:false, properties:{title:stringField(), summary:stringField()}, required:['title','summary']},
    objective:stringField(),
    skeleton:{type:'array', items:{
      type:'object', additionalProperties:false,
      properties:{id:stringField(), title:stringField(), message:stringField(), detail:stringField()},
      required:['id','title','message','detail']
    }},
    closing:{type:'object', additionalProperties:false, properties:{title:stringField(), action:stringField()}, required:['title','action']}
  },
  required:['hero','objective','skeleton','closing']
};

const SYSTEM = [
  'You are the lead strategist writing the first draft of a private executive presentation for a real prospective client of ADmiraNeXT.',
  'Write every string in natural Spanish (español de España), in the client\'s own business vocabulary — not in generic marketing filler.',
  'You must return exactly the eight steps you are given, in the same order and with the same ids. The narrative arc is fixed; only the wording is yours.',
  'Each step: "title" is a short headline (max 8 words), "message" is the single idea of the slide, "detail" develops it with something specific to THIS client — their sector, their sites, their operation, their audience.',
  'Ground everything in the supplied context. Never invent figures, client metrics, dates, names of people or contracts: if you do not have a number, describe the mechanism instead.',
  'Mention ADmiraNeXT products (Pixeria, admira.tv, XpaceOS, OmniPublicity) only in the steps where they are given, and always through what they solve for this client.',
  'No emoji, no bullet characters, no markdown, no quotation marks around whole strings.'
].join(' ');

export function requestBody(env, brief){
  return {
    model: env.XAI_TEXT_MODEL || 'grok-4.5', store:false, reasoning:{effort:'low'},
    input:[
      {role:'system', content:[{type:'input_text', text:SYSTEM}]},
      {role:'user', content:[{type:'input_text', text:JSON.stringify(brief)}]}
    ],
    text:{format:{type:'json_schema', name:'presentation_skeleton', strict:true, schema:SCHEMA}}
  };
}

export function skeletonBrief(input){
  const inspiration = input.inspiration || null;
  return {
    client:{
      name:input.displayName,
      website:input.website,
      host:inspiration?.host || '',
      siteTitle:clean(inspiration?.title, 140),
      siteDescription:clean(inspiration?.description, 240)
    },
    problem:clean(input.problem, 1200),
    audience:clean(input.audience, 500),
    meetingObjective:clean(input.objective, 1200),
    suppliedTitle:clean(input.title, 220),
    suppliedSummary:clean(input.summary, 900),
    steps:BLUEPRINT
  };
}

function parseNarrative(payload){
  const outputText = payload?.output?.find(item => item?.type === 'message')?.content?.find(item => item?.type === 'output_text')?.text;
  let parsed; try{ parsed = JSON.parse(outputText || ''); }catch(_){ return null; }
  const rows = Array.isArray(parsed?.skeleton) ? parsed.skeleton : [];
  if (rows.length !== IDS.length) return null;
  const skeleton = [];
  for (let index = 0; index < IDS.length; index += 1){
    const row = rows[index];
    if (clean(row?.id, 80) !== IDS[index]) return null;
    const title = clean(row?.title, LIMITS.title), message = clean(row?.message, LIMITS.message), detail = clean(row?.detail, LIMITS.detail);
    if (!title || !message || !detail) return null;
    skeleton.push({id:IDS[index], title, message, detail});
  }
  const hero = {title:clean(parsed?.hero?.title, LIMITS.heroTitle), summary:clean(parsed?.hero?.summary, LIMITS.heroSummary)};
  const objective = clean(parsed?.objective, LIMITS.objective);
  const closing = {title:clean(parsed?.closing?.title, LIMITS.closingTitle), action:clean(parsed?.closing?.action, LIMITS.closingAction)};
  if (!hero.title || !hero.summary || !objective || !closing.title || !closing.action) return null;
  return {hero, objective, skeleton, closing};
}

// Devuelve la redacción específica del cliente, o null para que el llamante use el molde.
export async function generateNarrative(env, input){
  if (!env?.XAI_API_KEY) return null;
  let response;
  try{
    response = await fetch('https://api.x.ai/v1/responses', {
      method:'POST',
      headers:{'content-type':'application/json', authorization:`Bearer ${env.XAI_API_KEY}`},
      body:JSON.stringify(requestBody(env, skeletonBrief(input))),
      signal:AbortSignal.timeout(TIMEOUT_MS)
    });
  }catch(_){ return null; }
  if (!response.ok) return null;
  if (Number(response.headers.get('content-length') || 0) > MAX_OUTPUT_BYTES) return null;
  let payload; try{ payload = await response.json(); }catch(_){ return null; }
  return parseNarrative(payload);
}

// Lo que el operador ha escrito en el formulario manda siempre sobre lo redactado.
export function mergeNarrative(base, narrative, input){
  if (!narrative) return base;
  const merged = {...base};
  merged.hero = {
    eyebrow:base.hero.eyebrow,
    title:input.title || narrative.hero.title,
    summary:input.summary || narrative.hero.summary
  };
  merged.objective = input.objective || narrative.objective;
  const byId = new Map(narrative.skeleton.map(item => [item.id, item]));
  merged.skeleton = base.skeleton.map(item => {
    const written = byId.get(item.id);
    return written ? {...item, title:written.title, message:written.message, detail:written.detail} : item;
  });
  merged.closing = narrative.closing;
  merged.narrativeSource = 'xai';
  return merged;
}
