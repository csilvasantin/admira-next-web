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
async function hmac(key, message){
  const cryptoKey=await crypto.subtle.importKey('raw',enc.encode(key),{name:'HMAC',hash:'SHA-256'},false,['sign']);
  const bytes=new Uint8Array(await crypto.subtle.sign('HMAC',cryptoKey,enc.encode(message)));
  let out=''; for(const byte of bytes) out+=String.fromCharCode(byte);
  return btoa(out).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
}
function idea(id,title,message,detail){ return {id,title,message,detail,enabled:true}; }
function buildIdeas(input, slug){
  const name=input.displayName;
  const problem=input.problem || `Convertir los espacios físicos de ${name} en una experiencia conectada, medible y capaz de mejorar en tiempo real.`;
  const audience=input.audience || 'Dirección de negocio, experiencia, operaciones, marketing e innovación';
  return {
    schemaVersion:1, client:slug, displayName:name,
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
    notes:`Fuente inicial generada para ${name}. Validar identidad, datos, problema y lenguaje antes de compartir. Referencia: ${input.website || 'web oficial pendiente'}.`,
    updatedAt:new Date().toISOString()
  };
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
  const supplied=text(raw.password,100); const password=supplied || randomPassword();
  if (password.length<10) return json({error:'La contraseña debe tener al menos 10 caracteres.'},400);
  const input={
    displayName, problem:text(raw.problem,1200), audience:text(raw.audience,500),
    title:text(raw.title,220), summary:text(raw.summary,900), objective:text(raw.objective,1200),
    website:text(raw.website,500), primaryColor:color(raw.primaryColor,'#12233e'), accentColor:color(raw.accentColor,'#ffb000')
  };
  if (input.website && !/^https:\/\//i.test(input.website)) return json({error:'La web debe comenzar por https://'},400);
  const ideas=buildIdeas(input,slug);
  const presentation={
    schemaVersion:1,slug,displayName,website:input.website,problem:input.problem,audience:input.audience,
    theme:{primary:input.primaryColor,accent:input.accentColor},
    passwordVerifier:await hmac(context.env.PRES_SIGNING_KEY,`password:${slug}:${password}`),
    createdAt:existing?.createdAt||new Date().toISOString(),updatedAt:new Date().toISOString()
  };
  await Promise.all([
    context.env.PRESENTATION_IDEAS.put(`presentation:${slug}`,JSON.stringify(presentation)),
    context.env.PRESENTATION_IDEAS.put(`ideas:${slug}`,JSON.stringify(ideas)),
    context.env.PRESENTATION_IDEAS.put(`ideas-base:${slug}`,JSON.stringify(ideas))
  ]);
  return json({ok:true,slug,displayName,password,url:`/presentaciones/${slug}/`,ideasUrl:`/presentaciones/${slug}/ideas`,deckUrl:`/presentaciones/${slug}/presentacion`},201);
}
