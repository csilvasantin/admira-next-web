import { OUTPUTS, LANGUAGES, buildGeneration, publicGeneration } from '../_generation.js';
import { analyzeInspiration, normalizeInspiration } from '../_inspiration.js';
import { normalizeMood, normalizePresentationStyle, themeFromPresentationStyle, presentationStyleBrief } from '../_mood.js';

const MAX_BYTES = 32 * 1024;
const enc = new TextEncoder();

function json(body, status = 200){
  return new Response(JSON.stringify(body), { status, headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store','x-content-type-options':'nosniff'} });
}
function text(value, max){ return String(value == null ? '' : value).replace(/\r\n?/g,'\n').trim().slice(0,max); }
function slugify(value){
  return text(value,80).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'').slice(0,63);
}
function color(value, fallback){ return /^#[0-9a-f]{6}$/i.test(String(value||'')) ? String(value).toLowerCase() : fallback; }
function randomPassword(){
  const alphabet='ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789';
  const bytes=crypto.getRandomValues(new Uint8Array(18));
  return Array.from(bytes, value => alphabet[value % alphabet.length]).join('');
}
async function backupExistingPresentation(store, slug, presentation){
  const id=crypto.randomUUID();
  const createdAt=new Date().toISOString();
  const [ideas,ideasBase,generation]=await Promise.all([
    store.get(`ideas:${slug}`,{type:'json'}),
    store.get(`ideas-base:${slug}`,{type:'json'}),
    store.get(`generation:${slug}`,{type:'json'})
  ]);
  const backup={
    schemaVersion:1,id,client:slug,createdAt,reason:'replacement-confirmed',
    snapshot:{presentation,ideas,ideasBase,generation}
  };
  await store.put(`presentation-backup:${slug}:${id}`,JSON.stringify(backup));
  return {id,createdAt};
}
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
    schemaVersion:2, client:slug, displayName:name, languages, translations:{}, inspiration:input.inspiration||null, presentationStyle:input.presentationStyle, mood:input.mood||null,
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
    notes:`Fuente inicial generada para ${name}. Validar identidad, datos, problema y lenguaje antes de compartir. Web oficial: ${input.website || 'pendiente'}. Inspiración visual: ${input.inspiration?.url || 'dirección propia de ADmiraNeXT'}.`,
    updatedAt:new Date().toISOString()
  };
}

function buildSource(data){
  const blocks=data.skeleton.filter(item=>item.enabled!==false).map((item,index)=>
    `${index+1}. ${item.title}\nIdea principal: ${item.message}\nDesarrollo: ${item.detail}`
  ).join('\n\n');
  const inspiration=data.inspiration?`\nDIRECCIÓN VISUAL INSPIRADORA\n- Referencia: ${data.inspiration.url}\n- Perfil: ${data.inspiration.profile}; modo ${data.inspiration.mode}; tipografía ${data.inspiration.fontStyle}; geometría ${data.inspiration.radiusStyle}; densidad ${data.inspiration.density}; composición ${data.inspiration.layout}.\n- Paleta extraída: ${(data.inspiration.palette||[]).join(', ')}.\n- Interpretar estos rasgos en clave ADmiraNeXT × ${data.displayName}; no copiar código, logotipos, textos ni elementos propietarios.\n`:'';
  const presentationStyle=presentationStyleBrief(data.presentationStyle,data.mood,data.displayName);
  return `ADMIRANEXT × ${data.displayName}\nGUION MAESTRO DE PRESENTACIÓN\n\n`+
    `Titular: ${data.hero.title}\nEntradilla: ${data.hero.summary}\nObjetivo: ${data.objective}\n\n${blocks}\n\n`+
    `CIERRE\n${data.closing.title}\nSiguiente acción: ${data.closing.action}\n${presentationStyle}${inspiration}\n`+
    `CRITERIOS DE PRODUCCIÓN\n- La identidad editorial y visual es AdmiraNeXT × ${data.displayName}.\n`+
    `- Crear una versión completa por cada idioma solicitado: ${(data.languages||[]).join(', ').toUpperCase()}.\n`+
    `- No mostrar referencias gráficas al proveedor de producción; la marca visible es AdmiraNeXT.\n`+
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
  const requested=Array.isArray(raw.outputs)?raw.outputs.map(value=>String(value).toLowerCase()):[];
  const outputs=[...new Set(requested.filter(value=>OUTPUTS.includes(value)))];
  if (!outputs.length) return json({error:'Selecciona al menos un entregable.'},400);
  const requestedLanguages=Array.isArray(raw.languages)?raw.languages.map(value=>String(value).toLowerCase()):['es'];
  const languages=[...new Set(requestedLanguages.filter(value=>LANGUAGES.includes(value)))];
  if (!languages.length) return json({error:'Selecciona al menos un idioma.'},400);
  const supplied=text(raw.password,100);
  if (supplied && supplied.length<10) return json({error:'La contraseña debe tener al menos 10 caracteres.'},400);
  const password=supplied || (existing ? '' : randomPassword());
  const passwordVerifier=password ? await hmac(context.env.PRES_SIGNING_KEY,`password:${slug}:${password}`) : existing.passwordVerifier;
  const input={
    displayName, problem:text(raw.problem,1200), audience:text(raw.audience,500),
    title:text(raw.title,220), summary:text(raw.summary,900), objective:text(raw.objective,1200),
    website:text(raw.website,500), inspirationUrl:text(raw.inspirationUrl,500), primaryColor:color(raw.primaryColor,'#12233e'), accentColor:color(raw.accentColor,'#ffb000')
  };
  if (input.website && !/^https:\/\//i.test(input.website)) return json({error:'La web debe comenzar por https://'},400);
  let inspiration=null;
  if(input.inspirationUrl){
    try{
      inspiration=normalizeInspiration(raw.inspiration,input.inspirationUrl) || await analyzeInspiration(input.inspirationUrl);
      if(!raw.inspiration){input.primaryColor=inspiration.primary;input.accentColor=inspiration.accent}
    }catch(error){return json({error:error.message||'No se pudo analizar la web inspiradora.'},422)}
  }
  input.inspiration=inspiration;
  input.presentationStyle=normalizePresentationStyle(raw.presentationStyle,'movie');
  input.mood=input.presentationStyle==='movie'?normalizeMood(raw.mood||raw.moodMovie,{randomWhenEmpty:true}):null;
  const ideas=buildIdeas(input,slug,languages);
  const generation=buildGeneration({client:slug,displayName,outputs,languages,presentationStyle:input.presentationStyle,mood:input.mood,sourceText:buildSource(ideas)});
  const moodOverrides={};
  if(/^#[0-9a-f]{6}$/i.test(String(raw.primaryColor||'')))moodOverrides.primary=input.primaryColor;
  if(/^#[0-9a-f]{6}$/i.test(String(raw.accentColor||'')))moodOverrides.accent=input.accentColor;
  if(input.presentationStyle==='movie'&&!input.mood?.theme&&inspiration){Object.assign(moodOverrides,{background:inspiration.background,surface:inspiration.surface,text:inspiration.text,fontStyle:inspiration.fontStyle,radius:inspiration.radius,radiusStyle:inspiration.radiusStyle,density:inspiration.density,layout:inspiration.layout});}
  const presentation={
    schemaVersion:2,slug,displayName,website:input.website,inspirationUrl:input.inspirationUrl,inspiration,presentationStyle:input.presentationStyle,mood:input.mood,problem:input.problem,audience:input.audience,outputs,languages,
    theme:themeFromPresentationStyle(input.presentationStyle,input.mood,moodOverrides),
    passwordVerifier,
    createdAt:existing?.createdAt||new Date().toISOString(),updatedAt:new Date().toISOString()
  };
  const backup=existing?await backupExistingPresentation(context.env.PRESENTATION_IDEAS,slug,existing):null;
  await Promise.all([
    context.env.PRESENTATION_IDEAS.put(`presentation:${slug}`,JSON.stringify(presentation)),
    context.env.PRESENTATION_IDEAS.put(`ideas:${slug}`,JSON.stringify(ideas)),
    context.env.PRESENTATION_IDEAS.put(`ideas-base:${slug}`,JSON.stringify(ideas)),
    context.env.PRESENTATION_IDEAS.put(`generation:${slug}`,JSON.stringify(generation))
  ]);
  return json({ok:true,slug,displayName,password:password||null,passwordPreserved:!password&&Boolean(existing),backup,outputs,languages,presentationStyle:input.presentationStyle,mood:input.mood,generation:publicGeneration(generation),url:`/presentaciones/${slug}/`,ideasUrl:`/presentaciones/${slug}/ideas`,deckUrl:`/presentaciones/${slug}/presentacion`},201);
}
