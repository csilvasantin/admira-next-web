import { OUTPUTS, DEFAULT_OUTPUTS, LANGUAGES, buildGeneration, publicGeneration } from '../_generation.js';
import { analyzeInspiration, normalizeInspiration } from '../_inspiration.js';
import { persistBrandLogo } from '../_brand.js';
import { DEFAULT_PRESENTATION_PASSWORD, ensureHttpsUrl } from '../_defaults.js';

const MAX_BYTES = 256 * 1024;
const enc = new TextEncoder();

function json(body, status = 200){
  return new Response(JSON.stringify(body), { status, headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store','x-content-type-options':'nosniff'} });
}
function text(value, max){ return String(value == null ? '' : value).replace(/\r\n?/g,'\n').trim().slice(0,max); }
function slugify(value){
  return text(value,80).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'').slice(0,63);
}
function color(value, fallback){ return /^#[0-9a-f]{6}$/i.test(String(value||'')) ? String(value).toLowerCase() : fallback; }
async function hmac(key, message){
  const cryptoKey=await crypto.subtle.importKey('raw',enc.encode(key),{name:'HMAC',hash:'SHA-256'},false,['sign']);
  const bytes=new Uint8Array(await crypto.subtle.sign('HMAC',cryptoKey,enc.encode(message)));
  let out=''; for(const byte of bytes) out+=String.fromCharCode(byte);
  return btoa(out).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
}
function idea(id,title,message,detail){ return {id,title,message,detail,enabled:true}; }
function buildIdeas(input, slug, languages){
  const name=input.displayName;
  const problem=input.problem || `Convertir los espacios físicos de ${name} en una experiencia conectada, medible y capaz de mejorar en tiempo real.`;
  const audience=input.audience || 'Dirección de negocio, experiencia, operaciones, marketing e innovación';
  return {
    schemaVersion:2, client:slug, displayName:name, languages, translations:{}, inspiration:input.inspiration||null, brand:input.brand||null,
    hero:{eyebrow:`Presentación privada · ${name}`,title:input.title || `${name}: cada espacio puede aprender.`,summary:input.summary || `Una propuesta para conectar contenido, operación, experiencia y medición alrededor de un problema concreto: ${problem}`},
    objective:input.objective || `Acordar un piloto concreto con ${name}, responsables, alcance y métricas de éxito.`,
    skeleton:[
      idea('problema','El problema que merece resolverse',problem,`Poner una tensión real de ${name} en el centro. La presentación debe empezar por negocio, no por tecnología.`),
      idea('momento','Por qué ahora',`La experiencia física ya genera señales; falta convertirlas en decisiones.`,`Audiencia: ${audience}. Conectar contexto, demanda, contenido y operación abre una ventana inmediata de mejora.`),
      idea('vision','La visión',`Un espacio que entiende lo que ocurre y responde con la experiencia adecuada.`,`La solución une creación, emisión, inteligencia espacial y medición en un solo ciclo operativo.`),
      idea('crear','Crear',`Pixeria transforma el brief de ${name} en contenidos y variantes gobernadas.`,`Más velocidad sin perder control de marca, formato, canal ni aprobación.`),
      idea('activar','Activar',`admira.tv lleva cada contenido al punto correcto, en el momento correcto.`,`Programación, flota, prueba de emisión y operación central con capacidad de adaptación local.`),
      idea('entender','Entender',`XpaceOS convierte el espacio físico en información accionable.`,`Flujos, ocupación, interacción y salud operativa con privacidad desde el diseño.`),
      idea('medir','Medir y aprender',`OmniPublicity conecta exposición, comportamiento y resultado.`,`Cada activación produce un aprendizaje que mejora la siguiente decisión.`),
      idea('piloto','El primer piloto',`Empezar pequeño, medir de verdad y escalar lo que funciona.`,`Un espacio, dos recorridos prioritarios, cuatro semanas de aprendizaje y un cuadro compartido de métricas.`)
    ],
    closing:{title:`Elijamos el primer espacio de ${name}.`,action:'Definir problema, ubicación, responsables, señales disponibles y tres métricas de éxito.'},
    labels:{objective:'El objetivo',next:'Siguiente paso'},
    notes:`Fuente inicial generada para ${name}. Validar identidad, datos, problema y lenguaje antes de compartir. Web oficial y fuente de marca: ${input.website}. Inspiración visual: ${input.inspiration?.url || input.website}. Logo oficial obligatorio: ${input.brand?.logoUrl || 'no localizado'}.`,
    updatedAt:new Date().toISOString()
  };
}

function buildSource(data){
  const blocks=data.skeleton.filter(item=>item.enabled!==false).map((item,index)=>
    `${index+1}. ${item.title}\nIdea principal: ${item.message}\nDesarrollo: ${item.detail}`
  ).join('\n\n');
  const inspiration=data.inspiration?`\nDIRECCIÓN VISUAL INSPIRADORA\n- Referencia: ${data.inspiration.url}\n- Perfil: ${data.inspiration.profile}; modo ${data.inspiration.mode}; tipografía ${data.inspiration.fontStyle}; geometría ${data.inspiration.radiusStyle}; densidad ${data.inspiration.density}; composición ${data.inspiration.layout}.\n- Paleta extraída: ${(data.inspiration.palette||[]).join(', ')}.\n- Interpretar estos rasgos en clave ADmiraNeXT × ${data.displayName}; no copiar código, textos, logotipos ni elementos propietarios de la web inspiradora.\n`:'';
  const brand=data.brand?`\nIDENTIDAD OFICIAL DEL CLIENTE\n- Fuente oficial: ${data.brand.website}\n- El logo oficial de ${data.displayName} es obligatorio y debe aparecer de forma consistente en toda la presentación, cada diapositiva y cada pieza visual.\n- Mantener proporciones, colores y área de respeto; no redibujar, reinterpretar ni sustituir el logo por texto.\n`:'';
  return `ADMIRANEXT × ${data.displayName}\nGUION MAESTRO DE PRESENTACIÓN\n\n`+
    `Titular: ${data.hero.title}\nEntradilla: ${data.hero.summary}\nObjetivo: ${data.objective}\n\n${blocks}\n\n`+
    `CIERRE\n${data.closing.title}\nSiguiente acción: ${data.closing.action}\n${inspiration}${brand}\n`+
    `CRITERIOS DE PRODUCCIÓN\n- La identidad editorial y visual es AdmiraNeXT × ${data.displayName}; ambas marcas deben convivir.\n`+
    `- Crear una versión completa por cada idioma solicitado: ${(data.languages||[]).join(', ').toUpperCase()}.\n`+
    `- No mostrar referencias gráficas al proveedor de producción; las marcas visibles son AdmiraNeXT y el logo oficial de ${data.displayName}.\n`+
    `- En vídeo, eliminar únicamente la tarjeta final del proveedor y prolongar el último fotograma limpio durante ese tramo.\n`+
    `- Mantener la misma dirección visual inspiradora en website, PDF, PowerPoint, documentos e infografía.\n`+
    `- No sustituir el cierre por otra plantilla ni cambiar paleta, tipografía, textura, composición o duración.`;
}

export async function onRequestPut(context){
  if (!context.env.PRESENTATION_IDEAS || !context.env.PRES_SIGNING_KEY) return json({error:'Generador no configurado.'},503);
  const origin=context.request.headers.get('Origin'); const url=new URL(context.request.url);
  if (!origin || origin!==url.origin) return json({error:'Origen no permitido.'},403);
  if (Number(context.request.headers.get('Content-Length')||0)>MAX_BYTES) return json({error:'Petición demasiado grande.'},413);
  let raw; try{raw=await context.request.json();}catch(_){return json({error:'JSON no válido.'},400);}
  const displayName=text(raw.displayName,100); const slug=slugify(raw.slug||displayName);
  if (!displayName || slug.length<2) return json({error:'Indica un nombre de cliente válido.'},400);
  if (['api','generador','index','assets'].includes(slug)) return json({error:'Ese identificador está reservado.'},400);
  const existing=await context.env.PRESENTATION_IDEAS.get(`presentation:${slug}`,{type:'json'});
  if (existing && raw.overwrite!==true) return json({error:'Ya existe una presentación con ese identificador.',exists:true,slug},409);
  const requested=Array.isArray(raw.outputs)?raw.outputs.map(value=>String(value).toLowerCase()):DEFAULT_OUTPUTS;
  const outputs=[...new Set(requested.filter(value=>OUTPUTS.includes(value)))];
  if (!outputs.length) return json({error:'Selecciona al menos un entregable.'},400);
  const requestedLanguages=Array.isArray(raw.languages)?raw.languages.map(value=>String(value).toLowerCase()):['es'];
  const languages=[...new Set(requestedLanguages.filter(value=>LANGUAGES.includes(value)))];
  if (!languages.length) return json({error:'Selecciona al menos un idioma.'},400);
  const supplied=text(raw.password,100);
  if (supplied && supplied.length<10) return json({error:'La contraseña debe tener al menos 10 caracteres.'},400);
  const password=supplied || (existing ? '' : DEFAULT_PRESENTATION_PASSWORD);
  const passwordVerifier=password ? await hmac(context.env.PRES_SIGNING_KEY,`password:${slug}:${password}`) : existing.passwordVerifier;
  const input={
    displayName, problem:text(raw.problem,1200), audience:text(raw.audience,500),
    title:text(raw.title,220), summary:text(raw.summary,900), objective:text(raw.objective,1200),
    website:ensureHttpsUrl(raw.website), requestedInspirationUrl:ensureHttpsUrl(raw.inspirationUrl), primaryColor:color(raw.primaryColor,'#12233e'), accentColor:color(raw.accentColor,'#ffb000')
  };
  if (!input.website) return json({error:'Indica la web oficial del cliente: es la fuente del logo y la inspiración por defecto.'},400);
  if (!/^https:\/\//i.test(input.website)) return json({error:'La web oficial debe comenzar por https://'},400);
  if (input.requestedInspirationUrl && !/^https:\/\//i.test(input.requestedInspirationUrl)) return json({error:'La web inspiradora debe comenzar por https://'},400);
  input.inspirationUrl=input.requestedInspirationUrl||input.website;
  let inspiration=null;
  let brandAnalysis=null;
  try{
    inspiration=normalizeInspiration(raw.inspiration,input.inspirationUrl) || await analyzeInspiration(input.inspirationUrl);
    brandAnalysis=input.inspirationUrl===input.website?inspiration:await analyzeInspiration(input.website);
    if(!raw.inspiration){input.primaryColor=inspiration.primary;input.accentColor=inspiration.accent}
    input.brand=await persistBrandLogo(context.env,{slug,displayName,website:input.website,analysis:brandAnalysis});
  }catch(error){return json({error:error.message||'No se pudo analizar la identidad del cliente.'},422)}
  input.inspiration=inspiration;
  const ideas=buildIdeas(input,slug,languages);
  const generation=buildGeneration({client:slug,displayName,outputs,languages,sourceText:buildSource(ideas)});
  const presentation={
    schemaVersion:3,slug,displayName,website:input.website,inspirationUrl:input.inspirationUrl,inspirationSource:input.requestedInspirationUrl?'explicit':'client-website',inspiration,brand:input.brand,problem:input.problem,audience:input.audience,outputs,languages,
    theme:{primary:input.primaryColor,accent:input.accentColor,background:inspiration?.background||'#f3f6f9',surface:inspiration?.surface||'#ffffff',text:inspiration?.text||'#142238',mode:inspiration?.mode||'light',fontStyle:inspiration?.fontStyle||'grotesk',radius:inspiration?.radius??10,radiusStyle:inspiration?.radiusStyle||'soft',density:inspiration?.density||'balanced',layout:inspiration?.layout||'editorial',profile:inspiration?.profile||'structured'},
    passwordVerifier,
    createdAt:existing?.createdAt||new Date().toISOString(),updatedAt:new Date().toISOString()
  };
  await Promise.all([
    context.env.PRESENTATION_IDEAS.put(`presentation:${slug}`,JSON.stringify(presentation)),
    context.env.PRESENTATION_IDEAS.put(`ideas:${slug}`,JSON.stringify(ideas)),
    context.env.PRESENTATION_IDEAS.put(`ideas-base:${slug}`,JSON.stringify(ideas)),
    context.env.PRESENTATION_IDEAS.put(`generation:${slug}`,JSON.stringify(generation))
  ]);
  const slideCount=ideas.skeleton.filter(item=>item.enabled!==false).length+3;
  return json({ok:true,slug,displayName,password:password||null,passwordPreserved:!password&&Boolean(existing),outputs,languages,slideCount,generation:publicGeneration(generation),url:`/presentaciones/${slug}/`,ideasUrl:`/presentaciones/${slug}/ideas`,deckUrl:`/presentaciones/${slug}/presentacion`},201);
}
