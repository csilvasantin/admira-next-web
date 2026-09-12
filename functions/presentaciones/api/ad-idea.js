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

// Producto de catálogo (admira.tv/contentcatalogue → /tiktok/?producto=…): el
// precio y la validez son datos REALES del folleto y viajan al director creativo
// tal cual, para que el guion los diga literalmente y no invente cifras.
const UNIDADES = new Set(['ud', 'pack', 'desde', '€/kg', '€/100 g', '€/litro']);
const FECHA_RE = /^\d{4}-\d{2}-\d{2}$/;
const MESES = ['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre'];

function precioTexto(precio){
  return precio.toFixed(2).replace('.', ',') + ' €';
}

function unidadFrase(unidad){
  return {ud:'la unidad', pack:'el pack', desde:'desde', '€/kg':'el kilo', '€/100 g':'los 100 g', '€/litro':'el litro'}[unidad] || '';
}

function validezFrase(validez){
  if(!validez) return '';
  const [, , d1] = validez.desde.split('-').map(Number);
  const [, m2, d2] = validez.hasta.split('-').map(Number);
  const [, m1] = validez.desde.split('-').map(Number);
  return m1 === m2
    ? `del ${d1} al ${d2} de ${MESES[m2 - 1]}`
    : `del ${d1} de ${MESES[m1 - 1]} al ${d2} de ${MESES[m2 - 1]}`;
}

export function normalizeProducto(raw){
  if(!raw || typeof raw !== 'object') return null;
  const nombre = clean(raw.nombre, 120);
  if(!nombre) return null;
  const precio = Number(raw.precio);
  const unidad = clean(raw.unidad, 12);
  const validez = raw.validez && FECHA_RE.test(String(raw.validez.desde || '')) && FECHA_RE.test(String(raw.validez.hasta || ''))
    ? {desde:String(raw.validez.desde), hasta:String(raw.validez.hasta)}
    : null;
  const producto = {
    nombre,
    marca:clean(raw.marca, 60),
    detalle:clean(raw.detalle, 200),
    precio:Number.isFinite(precio) && precio > 0 ? Math.round(precio * 100) / 100 : null,
    unidad:UNIDADES.has(unidad) ? unidad : '',
    promo:clean(raw.promo, 160),
    catalogo:clean(raw.catalogo, 80),
    validez
  };
  producto.precioTexto = producto.precio == null ? '' : `${precioTexto(producto.precio)}${producto.unidad ? ` ${unidadFrase(producto.unidad)}` : ''}`;
  producto.validezTexto = validezFrase(validez);
  if(!producto.precio && !producto.promo) return null;
  return producto;
}

// Brief de campaña (?brief=…, p. ej. admira.tv/videoanalytics/xtore → /tiktok/):
// no hay precio; hay una TIPOLOGÍA de público (quien pasa por delante de la
// tienda) y un título y mensaje que el anuncio debe respetar. El director
// creativo la usa como contexto: tono calle→tienda, 15 s, 9:16.
const PUBLICO_TIPOLOGIA = {
  persona:'una persona a pie que pasa por delante de la tienda',
  coche:'un conductor que pasa en coche por delante de la tienda',
  moto:'un motorista que pasa por delante de la tienda',
  bici:'un ciclista que pasa por delante de la tienda',
  hombre:'un hombre que pasa por delante de la tienda',
  mujer:'una mujer que pasa por delante de la tienda'
};

function slug(value){
  return String(value == null ? '' : value).normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toLowerCase().replace(/[^a-z0-9-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40);
}

export function normalizeBrief(raw){
  if(!raw || typeof raw !== 'object') return null;
  const titulo = clean(raw.titulo, 120);
  if(!titulo) return null;
  const lane = slug(raw.lane || raw.tipologia);
  const duracion = Number(raw.duracion);
  const brief = {
    campana:clean(raw.campana, 80) || 'Campaña',
    lane,
    tipologia:clean(raw.tipologia, 40) || lane,
    titulo,
    mensaje:clean(raw.mensaje, 240),
    claim:clean(raw.claim, 60) || 'Xtore · IoT Gallery',
    marca:clean(raw.marca, 60) || 'Xtore',
    formato:clean(raw.formato, 8) || '9:16',
    duracion:Number.isFinite(duracion) && duracion > 0 ? Math.min(60, Math.round(duracion)) : 15,
    origen:clean(raw.origen, 80)
  };
  brief.publico = PUBLICO_TIPOLOGIA[lane] || `${brief.tipologia || 'una persona'} que pasa por delante de la tienda`;
  return brief;
}

// Garantía del brief: la marca es la del brief y el titular conserva su título.
function aseguraBrief(ad, brief){
  if(!brief) return ad;
  if(!ad.brand || /ficticia|genérica|generica/i.test(ad.brand)) ad.brand = brief.marca;
  const clave = brief.titulo.toLowerCase().slice(0, 18);
  if(!ad.idea.toLowerCase().includes(clave)) ad.idea = clean(`${brief.titulo} · ${ad.idea}`, 200);
  return ad;
}

// Garantía literal: si el modelo se deja el precio o la validez, se añaden tal
// cual al detalle. Un anuncio de folleto sin precio no es un anuncio de folleto.
function aseguraPrecio(ad, producto){
  if(!producto) return ad;
  const faltas = [];
  if(producto.precio && !ad.detail.includes(precioTexto(producto.precio))) faltas.push(`Precio: ${producto.precioTexto}.`);
  if(producto.promo && !ad.detail.toLowerCase().includes(producto.promo.toLowerCase().slice(0, 24))) faltas.push(`Promoción: ${producto.promo}.`);
  if(producto.validezTexto && !ad.detail.toLowerCase().includes(producto.validezTexto.slice(4))) faltas.push(`Válido ${producto.validezTexto}.`);
  if(faltas.length) ad.detail = clean(`${ad.detail} ${faltas.join(' ')}`, 1400);
  if(producto.precio && !ad.idea.includes(precioTexto(producto.precio))) ad.idea = clean(`${ad.idea} · ${producto.precioTexto}`, 200);
  return ad;
}

function providerMessage(status){
  if(status === 401 || status === 403) return 'La conexión creativa con Grok no está autorizada.';
  if(status === 429) return 'El director creativo está ocupado. Vuelve a intentarlo en unos segundos.';
  if(status >= 500) return 'El director creativo no está disponible temporalmente.';
  return 'No se pudo crear la idea publicitaria.';
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

async function developAd(context, headline, producto, brief = null){
  const mode = producto ? 'producto' : brief ? 'brief' : headline ? 'develop' : 'create';
  const assignment = mode === 'brief'
    ? `Hay un BRIEF DE CAMPAÑA para una pantalla vertical en la puerta de una tienda (${brief.marca}: tienda de zapatillas · IoT Gallery). Campaña: «${brief.campana}». El anuncio lo verá ${brief.publico} ${brief.marca}; ese es el público objetivo y el guion debe hablarle directamente en su situación (a pie, al volante, sobre la moto o la bici) sin ponerle en peligro ni pedirle que mire la pantalla conduciendo. Título obligatorio de la campaña: «${brief.titulo}»${brief.mensaje ? `; mensaje que debe respetar: «${brief.mensaje}»` : ''}. Tono de calle a tienda: una invitación concreta a entrar ahora, sin precios ni descuentos. El titular (idea) debe incluir el título literal. La marca (brand) es ${brief.marca}. Dura ${brief.duracion} segundos en formato ${brief.formato}. El objetivo es visits.`
    : mode === 'producto'
    ? `Hay un PRODUCTO DE CATÁLOGO real con precio de folleto. Es un anuncio de supermercado (${producto.catalogo || 'Alcampo'}): el producto es «${producto.nombre}»${producto.marca ? ` de la marca ${producto.marca}` : ''}${producto.detalle ? ` (${producto.detalle})` : ''}. Usa literalmente el precio y la unidad tal como llegan: «${producto.precioTexto || producto.promo}»${producto.promo && producto.precioTexto ? `, con la promoción literal «${producto.promo}»` : ''}. No inventes precios, descuentos, promociones ni cifras que no estén en los datos. El titular (idea) debe contener el precio literal y el nombre del producto. El detalle debe decir el precio exacto${producto.validezTexto ? ` y la validez literal «${producto.validezTexto}»` : ''}. La marca (brand) es la marca del producto o ${producto.catalogo || 'Alcampo'}. La foto REAL del producto irá en pantalla dentro del anuncio: no describas otro packaging, envase ni etiqueta distintos del producto tal cual es. El objetivo es sales.`
    : mode === 'create'
    ? 'No hay titular. Inventa desde cero una idea de anuncio completa, concreta y visualmente potente. Elige una categoría de negocio reconocible, un problema o deseo humano, una propuesta honesta, un público y un objetivo. Crea también un nombre de trabajo claramente ficticio o una etiqueta neutral de categoría; nunca uses una marca real. Evita ideas vagas como “mejorar tu vida”.'
    : 'Hay un titular aportado. Consérvalo como intención central y desarróllalo en una campaña completa. Puedes mejorar su redacción, pero no cambies de categoría, problema ni promesa principal.';
  const response = await fetch('https://api.x.ai/v1/responses', {
    method:'POST',
    headers:{'content-type':'application/json', authorization:`Bearer ${context.env.XAI_API_KEY}`},
    body:JSON.stringify({
      model:context.env.XAI_TEXT_MODEL || 'grok-4.5',
      store:false,
      input:[
        {
          role:'system',
          content:[{type:'input_text', text:`Actúa como director creativo publicitario senior en español. Crea una sola idea concreta para un anuncio vertical de 15 segundos. No hagas preguntas. ${assignment} No inventes descuentos, precios, premios, ingredientes, ubicaciones, garantías, testimonios ni cualidades verificables; los únicos precios y promociones permitidos son los que lleguen literalmente en los datos del producto. Si faltan datos, plantea una dirección visual honesta sin convertir supuestos en afirmaciones. La idea debe ser un titular de campaña terminado y específico. El detalle debe explicar en 2 o 3 frases el gancho, qué veremos, la propuesta y el cierre. No menciones el proceso interno ni palabras como genérico, editable, supuesto, datos ausentes o faltan datos. Elige exactamente un objetivo entre leads, visits, sales, launch y awareness. Devuelve solo el objeto solicitado.`}]
        },
        {
          role:'user',
          content:[{type:'input_text', text:JSON.stringify({mode:mode === 'producto' ? 'catalog_product' : mode === 'brief' ? 'campaign_brief' : mode === 'create' ? 'create_from_scratch' : 'develop_headline', headline:headline || null, producto:producto ? {nombre:producto.nombre, marca:producto.marca || null, detalle:producto.detalle || null, precio:producto.precioTexto || null, promo:producto.promo || null, validez:producto.validezTexto || null, catalogo:producto.catalogo || null} : null, brief:brief ? {campana:brief.campana, tipologia:brief.tipologia, lane:brief.lane || null, publico:brief.publico, titulo:brief.titulo, mensaje:brief.mensaje || null, claim:brief.claim, marca:brief.marca} : null, format:brief ? `vídeo vertical de ${brief.duracion} segundos (${brief.formato})` : 'vídeo vertical de 15 segundos', language:'es'})}]
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
  return {ad:aseguraBrief(aseguraPrecio(ad, producto), brief), mode};
}

export async function onRequest(context){
  if(context.request.method !== 'POST') return json({error:'Método no permitido.'}, 405);
  if(!sameOrigin(context.request)) return json({error:'Origen no permitido.'}, 403);
  if(!(context.request.headers.get('content-type') || '').toLowerCase().startsWith('application/json')) return json({error:'Usa JSON para desarrollar la idea.'}, 415);
  if(!context.env.XAI_API_KEY) return json({error:'El desarrollador creativo todavía no está configurado.'}, 503);
  if(!context.env.PRESENTATION_IDEAS) return json({error:'El control de uso no está configurado.'}, 503);

  let body;
  try{ body = await readJsonLimited(context.request, MAX_REQUEST_BYTES); }
  catch(error){ return json({error:error.message === 'body_too_large' ? 'La solicitud creativa es demasiado grande.' : 'JSON no válido.'}, error.message === 'body_too_large' ? 413 : 400); }
  const headline = clean(body?.headline, 200);
  const producto = normalizeProducto(body?.producto);
  const brief = producto ? null : normalizeBrief(body?.brief);

  const ip = context.request.headers.get('CF-Connecting-IP') || 'unknown';
  const rateKey = `tiktok:ad-idea:rate:${ip}:${Math.floor(Date.now() / 10000)}`;
  if(await context.env.PRESENTATION_IDEAS.get(rateKey)) return json({error:'Espera unos segundos antes de desarrollar otra idea.'}, 429);
  await context.env.PRESENTATION_IDEAS.put(rateKey, '1', {expirationTtl:60});

  try{
    const result = await developAd(context, headline, producto, brief);
    if(result.error) return result.error;
    return json({mode:result.mode, ad:result.ad, producto:producto ? {nombre:producto.nombre, precio:producto.precioTexto, validez:producto.validezTexto} : null, brief:brief ? {campana:brief.campana, tipologia:brief.tipologia, lane:brief.lane, titulo:brief.titulo} : null});
  }catch(error){
    console.error(JSON.stringify({message:'ad idea development failed', error:String(error?.message || error)}));
    return json({error:'No se pudo conectar con el desarrollador creativo.'}, 502);
  }
}
