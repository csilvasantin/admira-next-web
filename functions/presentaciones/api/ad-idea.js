const MAX_REQUEST_BYTES = 4 * 1024;
const MAX_PROVIDER_BYTES = 48 * 1024;
const OBJECTIVES = new Set(['leads', 'visits', 'sales', 'launch', 'awareness']);

function json(payload, status = 200){
  return Response.json(payload, {
    status,
    headers:{
      'cache-control':'no-store',
      'content-type':'application/json; charset=utf-8',
      'x-content-type-options':'nosniff'
    }
  });
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
      if(total > maxBytes){
        await reader.cancel();
        throw new Error('body_too_large');
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
  catch(_){ throw new Error('json_invalid'); }
}

function providerMessage(status){
  if(status === 401 || status === 403) return 'La conexión creativa con Grok no está autorizada.';
  if(status === 429) return 'El desarrollador creativo está ocupado. Vuelve a intentarlo en unos segundos.';
  if(status >= 500) return 'El desarrollador creativo no está disponible temporalmente.';
  return 'No se pudo desarrollar esta idea.';
}

function outputText(payload){
  return payload?.output
    ?.find(item => item?.type === 'message')
    ?.content?.find(item => item?.type === 'output_text')?.text;
}

function normalizeAd(candidate){
  const ad = candidate?.ad;
  const objective = clean(ad?.objective, 20);
  const normalized = {
    idea:clean(ad?.idea, 200),
    detail:clean(ad?.detail, 1400),
    brand:clean(ad?.brand, 90),
    objective:OBJECTIVES.has(objective) ? objective : '',
    audience:clean(ad?.audience, 110)
  };
  if(normalized.idea.length < 8 || normalized.detail.length < 30 || !normalized.objective || normalized.audience.length < 5) return null;
  return normalized;
}

async function developAd(context, headline){
  const response = await fetch('https://api.x.ai/v1/responses', {
    method:'POST',
    headers:{'content-type':'application/json', authorization:`Bearer ${context.env.XAI_API_KEY}`},
    body:JSON.stringify({
      model:context.env.XAI_TEXT_MODEL || 'grok-4.5',
      store:false,
      input:[
        {
          role:'system',
          content:[{type:'input_text', text:'Actúa como director creativo publicitario senior en español. Convierte un titular mínimo en una sola idea concreta para un anuncio vertical de 15 segundos. No hagas preguntas. Desarrolla un concepto útil y específico, pero no inventes descuentos, precios, premios, ingredientes, ubicaciones, garantías, testimonios ni cualidades verificables que el usuario no haya aportado. Si faltan datos, plantea una dirección visual y un beneficio genérico editable. La idea debe ser un titular de campaña mejorado. El detalle debe explicar en 2 o 3 frases el gancho, qué veremos, la propuesta y el cierre. La marca debe usar el nombre aportado o una etiqueta genérica de la categoría; nunca inventes una marca real. Elige exactamente un objetivo entre leads, visits, sales, launch y awareness. Devuelve solo el objeto solicitado.'}]
        },
        {
          role:'user',
          content:[{type:'input_text', text:JSON.stringify({headline, format:'vídeo vertical de 15 segundos', language:'es'})}]
        }
      ],
      text:{format:{type:'json_schema', name:'developed_ad_idea', strict:true, schema:{
        type:'object',
        additionalProperties:false,
        properties:{ad:{
          type:'object',
          additionalProperties:false,
          properties:{
            idea:{type:'string'},
            detail:{type:'string'},
            brand:{type:'string'},
            objective:{type:'string', enum:['leads','visits','sales','launch','awareness']},
            audience:{type:'string'}
          },
          required:['idea','detail','brand','objective','audience']
        }},
        required:['ad']
      }}}
    })
  });
  if(!response.ok) return {error:json({error:providerMessage(response.status)}, response.status === 429 ? 429 : 502)};
  let payload;
  try{ payload = await readJsonLimited(response, MAX_PROVIDER_BYTES); }
  catch(_){ return {error:json({error:'El desarrollador creativo devolvió una respuesta no válida.'}, 502)}; }
  let parsed;
  try{ parsed = JSON.parse(outputText(payload) || ''); }
  catch(_){ return {error:json({error:'El desarrollador creativo no devolvió una idea estructurada.'}, 502)}; }
  const ad = normalizeAd(parsed);
  if(!ad) return {error:json({error:'La idea recibida quedó incompleta. Vuelve a intentarlo.'}, 502)};
  return {ad};
}

export async function onRequest(context){
  if(context.request.method !== 'POST') return json({error:'Método no permitido.'}, 405);
  if(!sameOrigin(context.request)) return json({error:'Origen no permitido.'}, 403);
  if(!(context.request.headers.get('content-type') || '').toLowerCase().startsWith('application/json')) return json({error:'Usa JSON para desarrollar la idea.'}, 415);
  if(!context.env.XAI_API_KEY) return json({error:'El desarrollador creativo todavía no está configurado.'}, 503);
  if(!context.env.PRESENTATION_IDEAS) return json({error:'El control de uso no está configurado.'}, 503);

  let body;
  try{ body = await readJsonLimited(context.request, MAX_REQUEST_BYTES); }
  catch(error){ return json({error:error.message === 'body_too_large' ? 'El titular es demasiado grande.' : 'JSON no válido.'}, error.message === 'body_too_large' ? 413 : 400); }
  const headline = clean(body?.headline, 200);
  if(headline.length < 4) return json({error:'Escribe un titular mínimo, por ejemplo: “anuncio de pizzería”.'}, 400);

  const ip = context.request.headers.get('CF-Connecting-IP') || 'unknown';
  const rateKey = `tiktok:ad-idea:rate:${ip}:${Math.floor(Date.now() / 10000)}`;
  if(await context.env.PRESENTATION_IDEAS.get(rateKey)) return json({error:'Espera unos segundos antes de desarrollar otra idea.'}, 429);
  await context.env.PRESENTATION_IDEAS.put(rateKey, '1', {expirationTtl:60});

  try{
    const result = await developAd(context, headline);
    if(result.error) return result.error;
    return json({ad:result.ad});
  }catch(error){
    console.error(JSON.stringify({message:'ad idea development failed', error:String(error?.message || error)}));
    return json({error:'No se pudo conectar con el desarrollador creativo.'}, 502);
  }
}
