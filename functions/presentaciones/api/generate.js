import { OUTPUTS, DEFAULT_OUTPUTS, LANGUAGES, buildGeneration, publicGeneration } from '../_generation.js';
import { analyzeInspiration, normalizeInspiration } from '../_inspiration.js';
import { persistBrandLogo } from '../_brand.js';
import { createPresentationPassword, ensureHttpsUrl } from '../_defaults.js';
import {captureVersion} from '../_versions.js';
import {normalizeSequence} from '../_deck-library.js';
import {presiteOpeningInput,publicPresiteOpening} from '../_presite-opening.js';
import {presiteKey} from '../../presites/_presite.js';
import {normalizeSlideMedia} from '../_slide-media.js';
import {normalizeSourceTraceability} from '../_source-traceability.js';
import {generateNarrative,mergeNarrative,FALLBACK_REASONS,FALLBACK_GENERIC} from '../_skeleton.js';
import {createCompatibilityLab,publicCompatibilityLab} from '../_compatibility-lab.js';
import {createRoomDeviceLab,publicRoomDeviceLab} from '../_room-device-lab.js';

const MAX_BYTES = 256 * 1024;
const enc = new TextEncoder();
const LANGUAGE_NAMES = {es:'Spanish',ca:'Catalan',en:'English'};
const MAX_TERMS = 30;

function json(body, status = 200){
  return new Response(JSON.stringify(body), { status, headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store','x-content-type-options':'nosniff'} });
}
function text(value, max){ return String(value == null ? '' : value).replace(/\r\n?/g,'\n').trim().slice(0,max); }
function slugify(value){
  return text(value,80).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'').slice(0,63);
}
function color(value, fallback){ return /^#[0-9a-f]{6}$/i.test(String(value||'')) ? String(value).toLowerCase() : fallback; }
export function normalizeTerminology(value){
  const rows=Array.isArray(value)?value:String(value||'').split(/\r?\n/);
  const output=[],seen=new Set();
  for(const row of rows){
    const parts=Array.isArray(row)?row:(row&&typeof row==='object'?[row.es,row.ca,row.en]:String(row||'').split(/\s*[|\t]\s*/));
    const values=parts.slice(0,3).map(item=>text(item,120));
    if(values.every(item=>!item))continue;
    if(values.length!==3||values.some(item=>!item))throw new Error('Cada término debe incluir ES | CA | EN.');
    const key=values.map(item=>item.toLocaleLowerCase('es')).join('|');
    if(seen.has(key))continue;seen.add(key);output.push({es:values[0],ca:values[1],en:values[2]});
    if(output.length>MAX_TERMS)throw new Error(`La revisión terminológica admite hasta ${MAX_TERMS} términos.`);
  }
  return output;
}
function hasTerm(value,term){return String(value||'').normalize('NFC').includes(String(term||'').normalize('NFC'))}
function validateTerminology(source,translated,language,terminology){
  for(let index=0;index<source.length;index+=1){
    for(const entry of terminology){
      if(Object.values(entry).some(term=>hasTerm(source[index],term))&&!hasTerm(translated[index],entry[language]))throw new Error(`La versión ${language.toUpperCase()} no respeta el término aprobado “${entry[language]}”.`);
    }
  }
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
    labels:{objective:'El objetivo',next:'Siguiente paso'}, narrativeSource:'template',
    notes:`Fuente inicial generada para ${name}. Validar identidad, datos, problema y lenguaje antes de compartir. Web oficial y fuente de marca: ${input.website}. Inspiración visual: ${input.inspiration?.url || input.website}. Logo oficial obligatorio: ${input.brand?.logoUrl || 'no localizado'}.`,
    updatedAt:new Date().toISOString()
  };
}

function sourceSlideKeys(ideas){
  return ['cover','objective',...(ideas.skeleton||[]).filter(item=>item.enabled!==false).map((item,index)=>slugify(item.id||`idea-${index+1}`)),'closing'];
}

function translatableCopy(ideas){
  return [
    ideas.hero.eyebrow, ideas.hero.title, ideas.hero.summary, ideas.objective,
    ...ideas.skeleton.flatMap(item=>[item.title,item.message,item.detail]),
    ideas.closing.title, ideas.closing.action, ideas.labels.objective, ideas.labels.next
  ];
}

function localizedCopy(ideas, values){
  let at=0; const next=()=>String(values[at++]??'');
  const localized={
    hero:{eyebrow:next(),title:next(),summary:next()},objective:next(),
    skeleton:ideas.skeleton.map(item=>({...item,title:next(),message:next(),detail:next()})),
    closing:{title:next(),action:next()},labels:{objective:next(),next:next()}
  };
  if(at!==values.length) throw new Error('La traducción devolvió un número de textos inesperado.');
  return localized;
}

export async function generateTranslations(env, ideas, languages, terminology=[]){
  const requested=[...new Set(languages.filter(language=>LANGUAGE_NAMES[language]))];
  const targets=requested.some(language=>language!=='es')?requested:[];
  if(!targets.length)return {};
  if(!env.XAI_API_KEY)throw new Error('La traducción automática no está configurada.');
  const source=translatableCopy(ideas),languageProperties=Object.fromEntries(targets.map(language=>[language,{type:'array',items:{type:'string'}}]));
  const provider=await fetch('https://api.x.ai/v1/responses',{
    method:'POST',headers:{'content-type':'application/json',authorization:`Bearer ${env.XAI_API_KEY}`},
    body:JSON.stringify({
      model:env.XAI_TEXT_MODEL||'grok-4.5',store:false,
      input:[
        {role:'system',content:[{type:'input_text',text:'Localize this complete executive presentation faithfully and naturally. The source is mainly Spanish but may contain ordinary phrases in English or other languages: translate every such phrase into each requested target language. Apply the supplied client terminology exactly in every target language. Preserve only registered product names, client names, numbers, punctuation, line breaks and factual meaning; do not preserve a sentence merely because it is written in English. When Spanish is a target, keep text already written naturally in Spanish and translate foreign-language phrases into Spanish. Return one array per requested language in exactly the same order and with exactly the same number of non-empty strings as the source. Do not add explanations.'}]},
        {role:'user',content:[{type:'input_text',text:JSON.stringify({sourceLanguage:'Mixed, mainly Spanish',targetLanguages:targets.map(language=>LANGUAGE_NAMES[language]),terminology,texts:source})}]}
      ],
      text:{format:{type:'json_schema',name:'presentation_languages',strict:true,schema:{
        type:'object',additionalProperties:false,properties:{translations:{type:'object',additionalProperties:false,properties:languageProperties,required:targets}},required:['translations']
      }}}
    })
  });
  if(!provider.ok)throw new Error(provider.status===429?'xAI ha alcanzado temporalmente el límite de traducción.':'No se pudieron generar todos los idiomas.');
  if(Number(provider.headers.get('content-length')||0)>MAX_BYTES)throw new Error('La traducción recibida es demasiado grande.');
  const payload=await provider.json(),outputText=payload?.output?.find(item=>item?.type==='message')?.content?.find(item=>item?.type==='output_text')?.text;
  let parsed;try{parsed=JSON.parse(outputText||'')}catch(_){throw new Error('La traducción no devolvió un resultado válido.')}
  const translations={};
  for(const language of targets){
    const values=parsed?.translations?.[language];
    if(!Array.isArray(values)||values.length!==source.length||values.some(value=>!String(value||'').trim()))throw new Error(`La versión ${language.toUpperCase()} quedó incompleta y la presentación no se ha guardado.`);
    validateTerminology(source,values,language,terminology);
    translations[language]=localizedCopy(ideas,values);
  }
  return translations;
}

function buildSource(data){
  const blocks=data.skeleton.filter(item=>item.enabled!==false).map((item,index)=>
    `${index+1}. ${item.title}\nIdea principal: ${item.message}\nDesarrollo: ${item.detail}`
  ).join('\n\n');
  const inspiration=data.inspiration?`\nDIRECCIÓN VISUAL INSPIRADORA\n- Referencia: ${data.inspiration.url}\n- Perfil: ${data.inspiration.profile}; modo ${data.inspiration.mode}; tipografía ${data.inspiration.fontStyle}; geometría ${data.inspiration.radiusStyle}; densidad ${data.inspiration.density}; composición ${data.inspiration.layout}.\n- Paleta extraída: ${(data.inspiration.palette||[]).join(', ')}.\n- Interpretar estos rasgos en clave ADmiraNeXT × ${data.displayName}; no copiar código, textos, logotipos ni elementos propietarios de la web inspiradora.\n`:'';
  const brand=data.brand?`\nIDENTIDAD OFICIAL DEL CLIENTE\n- Fuente oficial: ${data.brand.website}\n- El logo oficial de ${data.displayName} es obligatorio y debe aparecer de forma consistente en toda la presentación, cada diapositiva y cada pieza visual.\n- Mantener proporciones, colores y área de respeto; no redibujar, reinterpretar ni sustituir el logo por texto.\n`:'';
  const translated=(data.languages||[]).filter(language=>language!=='es'&&data.translations?.[language]).map(language=>{
    const content=data.translations[language],localizedBlocks=(content.skeleton||[]).filter(item=>item.enabled!==false).map((item,index)=>`${index+1}. ${item.title}\nIdea principal: ${item.message}\nDesarrollo: ${item.detail}`).join('\n\n');
    return `\n\nVERSIÓN ${language.toUpperCase()}\nTitular: ${content.hero?.title||''}\nEntradilla: ${content.hero?.summary||''}\nObjetivo: ${content.objective||''}\n\n${localizedBlocks}\n\nCIERRE\n${content.closing?.title||''}\nSiguiente acción: ${content.closing?.action||''}`;
  }).join('');
  const terminology=(data.terminology||[]).length?`\nTERMINOLOGÍA APROBADA DEL CLIENTE\n${data.terminology.map(item=>`- ES: ${item.es} · CA: ${item.ca} · EN: ${item.en}`).join('\n')}\n`:'';
  return `ADMIRANEXT × ${data.displayName}\nGUION MAESTRO DE PRESENTACIÓN\n\n`+
    `Titular: ${data.hero.title}\nEntradilla: ${data.hero.summary}\nObjetivo: ${data.objective}\n\n${blocks}\n\n`+
    `CIERRE\n${data.closing.title}\nSiguiente acción: ${data.closing.action}\n${inspiration}${brand}${terminology}\n`+
    `CRITERIOS DE PRODUCCIÓN\n- La identidad editorial y visual es AdmiraNeXT × ${data.displayName}; ambas marcas deben convivir.\n`+
    `- Crear una versión completa por cada idioma solicitado: ${(data.languages||[]).join(', ').toUpperCase()}.\n`+
    `- No mostrar referencias gráficas al proveedor de producción; las marcas visibles son AdmiraNeXT y el logo oficial de ${data.displayName}.\n`+
    `- En vídeo, eliminar únicamente la tarjeta final del proveedor y prolongar el último fotograma limpio durante ese tramo.\n`+
    `- Mantener la misma dirección visual inspiradora en website, PDF, PowerPoint, documentos e infografía.\n`+
    `- No sustituir el cierre por otra plantilla ni cambiar paleta, tipografía, textura, composición o duración.${translated}`;
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
  let presite=null;
  try{presite=presiteOpeningInput(raw,existing?.presite)}
  catch(error){return json({error:error.message},400)}
  if(presite&&!await context.env.PRESENTATION_IDEAS.get(presiteKey(presite.slug),{type:'json'}))return json({error:'El Presite seleccionado no existe.',presite:presite.slug},422);
  const requested=Array.isArray(raw.outputs)?raw.outputs.map(value=>String(value).toLowerCase()):DEFAULT_OUTPUTS;
  const outputs=[...new Set(requested.filter(value=>OUTPUTS.includes(value)))];
  if (!outputs.length) return json({error:'Selecciona al menos un entregable.'},400);
  const requestedLanguages=Array.isArray(raw.languages)?raw.languages.map(value=>String(value).toLowerCase()):['es'];
  const languages=[...new Set(requestedLanguages.filter(value=>LANGUAGES.includes(value)))];
  if (!languages.length) return json({error:'Selecciona al menos un idioma.'},400);
  let terminology;try{terminology=normalizeTerminology(raw.terminology)}catch(error){return json({error:error.message},400)}
  let slideMedia;try{slideMedia=normalizeSlideMedia(raw.slideMedia,slug)}catch(error){return json({error:error.message},400)}
  const supplied=text(raw.password,100);
  if (supplied && supplied.length<10) return json({error:'La contraseña debe tener al menos 10 caracteres.'},400);
  const password=supplied || (existing ? '' : createPresentationPassword());
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
  // El motivo del respaldo se queda AQUÍ, en una variable del operador: nunca dentro
  // de `ideas`, que se persiste en KV y lo leen las rutas del portal del cliente.
  const narrativeResult=await generateNarrative(context.env,input);
  const ideas=mergeNarrative(buildIdeas(input,slug,languages),narrativeResult,input);
  ideas.terminology=terminology;
  let sourceTraceability;
  try{
    sourceTraceability=normalizeSourceTraceability(raw.sourceTraceability,sourceSlideKeys(ideas),{
      website:input.website,websiteLabel:`Web oficial de ${displayName}`
    });
  }catch(error){return json({error:error.message||'La trazabilidad de fuentes no es válida.'},400)}
  try{
    const localized=await generateTranslations(context.env,ideas,languages,terminology),spanish=localized.es;
    if(spanish){ideas.hero=spanish.hero;ideas.objective=spanish.objective;ideas.skeleton=spanish.skeleton;ideas.closing=spanish.closing;ideas.labels=spanish.labels;delete localized.es}
    ideas.translations=localized;
  }
  catch(error){return json({error:error.message||'No se pudieron generar todos los idiomas.'},502)}
  const generation=buildGeneration({client:slug,displayName,outputs,languages,sourceText:buildSource(ideas)});
  const sequence=normalizeSequence({before:raw.beforeDeck,beforeLength:raw.beforeLength,beforeQuality:raw.beforeQuality,after:raw.afterDeck});
  const compatibilityFeatures=['css-layout','interactive-controls','custom-fonts'];
  for(const entry of slideMedia){
    if(entry.type==='animation')compatibilityFeatures.push('animation');
    if(entry.type==='audio')compatibilityFeatures.push('audio');
    if(entry.type==='video')compatibilityFeatures.push('video');
  }
  if(languages.length>1)compatibilityFeatures.push('multilingual');
  const compatibilityLab=createCompatibilityLab({
    decks:[
      {id:`proposal:${slug}`,label:`Propuesta · ${displayName}`},
      ...(sequence.before?[{id:`library:${sequence.before}`,label:'Apertura corporativa'}]:[]),
      ...(sequence.after?[{id:`library:${sequence.after}`,label:'Cierre corporativo'}]:[])
    ],
    requestedOutputs:outputs,features:compatibilityFeatures
  });
  const roomDeviceLab=createRoomDeviceLab({features:compatibilityFeatures});
  const presentation={
    schemaVersion:11,slug,displayName,website:input.website,inspirationUrl:input.inspirationUrl,inspirationSource:input.requestedInspirationUrl?'explicit':'client-website',inspiration,brand:input.brand,problem:input.problem,audience:input.audience,outputs,languages,terminology,slideMedia,sourceTraceability,compatibilityLab,roomDeviceLab,presite,sequence,
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
  await captureVersion(context.env,slug,existing?'presentación regenerada':'presentación creada',{presentation,ideas,generation,'image-set':null});
  const slideCount=ideas.skeleton.filter(item=>item.enabled!==false).length+3;
  // Quién escribió el guion viaja en la respuesta. Si se cayó al molde, el operador
  // tiene que enterarse ANTES de mandarle el enlace a un cliente: ese texto es el
  // mismo para todos y solo cambia el nombre.
  const narrativeSource=ideas.narrativeSource==='xai'?'xai':'template';
  const narrativeFallback=narrativeSource==='xai'?'':(FALLBACK_REASONS[narrativeResult?.reason]||FALLBACK_GENERIC);
  const publicPresite=publicPresiteOpening(presentation.presite,slug);
  return json({ok:true,slug,displayName,narrativeSource,narrativeFallback,password:password||null,passwordPreserved:!password&&Boolean(existing),outputs,languages,slideCount,sequence:presentation.sequence,presite:publicPresite,generation:publicGeneration(generation),compatibility:publicCompatibilityLab(compatibilityLab),compatibilityUrl:`/presentaciones/${slug}/api/compatibility`,roomDeviceLab:publicRoomDeviceLab(roomDeviceLab),roomDeviceLabUrl:`/presentaciones/${slug}/api/room-device-lab`,url:`/presentaciones/${slug}/`,ideasUrl:`/presentaciones/${slug}/ideas`,launchUrl:publicPresite?.launchUrl||`/presentaciones/${slug}/presentacion`,deckUrl:`/presentaciones/${slug}/presentacion`},201);
}
