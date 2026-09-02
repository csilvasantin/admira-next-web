import fs from 'node:fs/promises';
import fsSync from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import puppeteer from 'puppeteer';
import ffmpegPath from 'ffmpeg-static';
import sharp from 'sharp';
import {brandPdf,brandPowerPoint} from './brand-deck.js';
import {generateVisualBrief} from './visual-brief.js';
import {buildNotebookSourceBundle,sanitizeInfographicBranding,sanitizePowerPointBranding,verifiedWatermark} from './fidelity-bridge.js';

const HERE=path.dirname(new URL(import.meta.url).pathname);
const ROOT=path.resolve(HERE,'../..');
const RUNTIME=path.join(ROOT,'.runtime','notebooklm-local');
const PROFILE=path.join(RUNTIME,'profile');
const DOWNLOADS=path.join(RUNTIME,'downloads');
const API=process.env.PRESENTATION_PRODUCTION_API||'https://www.admiranext.com/presentaciones/api/production';
const ACCOUNT=process.env.NOTEBOOKLM_ACCOUNT||'csilvasantin@gmail.com';
const WORKER=`notebooklm-${os.hostname().toLowerCase().replace(/[^a-z0-9]+/g,'-').slice(0,48)}`;
const POLL_MS=Math.max(15000,Number(process.env.NOTEBOOKLM_POLL_MS)||30000);
const once=process.argv.includes('--once'),setup=process.argv.includes('--setup');
const CLIENT_FILTER=String(process.env.NOTEBOOKLM_CLIENT||'').trim().toLowerCase();
const OUTPUT_FILTER=new Set(String(process.env.NOTEBOOKLM_OUTPUTS||'').split(',').map(value=>value.trim().toLowerCase()).filter(Boolean));

function token(){
  if(process.env.PRESENTATION_WORKER_TOKEN)return process.env.PRESENTATION_WORKER_TOKEN.trim();
  try{return fsSync.readFileSync(path.join(RUNTIME,'worker.token'),'utf8').trim();}
  catch(_){}
  try{return execFileSync('bash',[path.join(os.homedir(),'Claude/admira-vault/vault-get.sh'),'PRESENTATION_WORKER_TOKEN'],{encoding:'utf8',stdio:['ignore','pipe','ignore']}).trim();}
  catch(_){}
  try{return execFileSync('security',['find-generic-password','-a','notebooklm-local','-s','admiranext-presentations','-w'],{encoding:'utf8',stdio:['ignore','pipe','ignore']}).trim();}
  catch(_){return '';}
}
const TOKEN=token();
if(!TOKEN&&!setup)throw new Error('Falta PRESENTATION_WORKER_TOKEN en el entorno o en admira-vault.');

async function api(method,query='',body){
  const response=await fetch(`${API}${query}`,{method,headers:{authorization:`Bearer ${TOKEN}`,...(body?{'content-type':'application/json'}:{})},body:body?JSON.stringify(body):undefined});
  const data=await response.json().catch(()=>({}));
  if(!response.ok)throw new Error(data.error||`API ${response.status}`);
  return data;
}
async function upload(job,task,file){
  const bytes=await fs.readFile(file),ext=path.extname(file).toLowerCase();
  const types={'.m4a':'audio/mp4','.mp3':'audio/mpeg','.mp4':'video/mp4','.png':'image/png','.jpg':'image/jpeg','.jpeg':'image/jpeg','.webp':'image/webp','.pdf':'application/pdf','.pptx':'application/vnd.openxmlformats-officedocument.presentationml.presentation'};
  const query=new URLSearchParams({client:job.client,language:task.language,output:task.output,id:job.id});
  const response=await fetch(`${API}?${query}`,{method:'PUT',headers:{authorization:`Bearer ${TOKEN}`,'content-type':types[ext]||'application/octet-stream','x-file-name':path.basename(file),'x-worker':WORKER},body:bytes});
  const data=await response.json().catch(()=>({}));if(!response.ok)throw new Error(data.error||`Upload ${response.status}`);return data;
}
async function clientLogoBadge(logo,maxWidth,maxHeight){
  const resized=await sharp(logo).resize({width:maxWidth,height:maxHeight,fit:'inside',withoutEnlargement:true}).png().toBuffer();
  const metadata=await sharp(resized).metadata(),pad=Math.max(10,Math.round(Math.min(maxWidth,maxHeight)*.14));
  return sharp({create:{width:Number(metadata.width)+pad*2,height:Number(metadata.height)+pad*2,channels:4,background:{r:255,g:255,b:255,alpha:.92}}}).composite([{input:resized,left:pad,top:pad}]).png().toBuffer();
}
async function downloadClientLogo(client){
  const query=new URLSearchParams({client,asset:'logo'});let response=await fetch(`${API}?${query}`,{headers:{authorization:`Bearer ${TOKEN}`}});
  if(response.status===404){await api('POST','',{action:'refresh-brand',client});response=await fetch(`${API}?${query}`,{headers:{authorization:`Bearer ${TOKEN}`}});}
  if(!response.ok)throw new Error(`No se pudo obtener el logo oficial (${response.status}).`);
  const bytes=Buffer.from(await response.arrayBuffer()),dir=path.join(RUNTIME,'brands');await fs.mkdir(dir,{recursive:true});
  const output=path.join(dir,`${client}.png`);await sharp(bytes,{density:240}).trim().resize({width:1200,height:500,fit:'inside',withoutEnlargement:true}).png().toFile(output);return output;
}
async function cleanVideoEnding(file){
  const duration=Number(execFileSync('mdls',['-raw','-name','kMDItemDurationSeconds',file],{encoding:'utf8',stdio:['ignore','pipe','ignore']}).trim());
  if(!ffmpegPath||!Number.isFinite(duration)||duration<=4)throw new Error('No se pudo preparar el cierre limpio del vídeo.');
  const sample=path.join(path.dirname(file),`${path.basename(file,'.mp4')}.ending-sample.png`);
  execFileSync(ffmpegPath,['-hide_banner','-y','-loglevel','error','-ss',Math.max(0,duration-.2).toFixed(3),'-i',file,'-frames:v','1',sample],{stdio:'ignore'});
  const verification=verifiedWatermark(await fs.readFile(sample),process.env.NOTEBOOKLM_VIDEO_ENDING_HASHES||process.env.NOTEBOOKLM_WATERMARK_HASHES||'');
  await fs.unlink(sample).catch(()=>{});
  if(!verification.verified)return {file,report:{changed:false,mode:'verified-freeze-last-clean-frame',fingerprint:verification.fingerprint,reason:'watermark-not-allowlisted',durationPreserved:true,overlaysAdded:false}};
  const cut=(duration-3).toFixed(3),total=duration.toFixed(3);
  const output=path.join(path.dirname(file),`${path.basename(file,'.mp4')}.admiranext.mp4`);
  const filter=`[0:v]trim=start=0:end=${cut},setpts=PTS-STARTPTS,tpad=stop_mode=clone:stop_duration=3,trim=duration=${total},format=yuv420p[v];[0:a]atrim=start=0:end=${total},asetpts=PTS-STARTPTS[a]`;
  execFileSync(ffmpegPath,['-hide_banner','-y','-loglevel','warning','-i',file,'-filter_complex',filter,'-map','[v]','-map','[a]','-c:v','libx264','-preset','medium','-crf','21','-profile:v','high','-r','24','-c:a','aac','-b:a','80k','-movflags','+faststart','-metadata','comment=NotebookLM ending removed · original visual style and duration preserved',output],{stdio:'ignore'});
  return {file:output,report:{changed:true,mode:'verified-freeze-last-clean-frame',fingerprint:verification.fingerprint,durationPreserved:true,overlaysAdded:false}};
}
async function cleanInfographicBranding(file){
  const watermarkHashes=process.env.NOTEBOOKLM_INFOGRAPHIC_WATERMARK_HASHES||process.env.NOTEBOOKLM_WATERMARK_HASHES||'';
  return sanitizeInfographicBranding(file,{watermarkHashes});
}
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
// GEMINI NOTEBOOK PEGA EL NOMBRE DEL ICONO AL TEXTO DEL BOTON (Neo · MBP14, 02-09-2026).
// Verificado en la UI nueva con la sesion de Carlos: el boton de pegar texto ya no dice
// «Texto copiado» sino «content_pasteTexto copiado», y hay «delete Eliminar»,
// «trending_upAnalitica s», «publicDescubrir», «keep_pinGuardar en una nota»… El icono es
// una ligadura de Material Symbols que el navegador SI mete en innerText. Como este
// ayudante comparaba por igualdad exacta, TODOS los clics se quedaban esperando 30 s y el
// trabajo moria. Aqui se compara tambien contra la etiqueta sin esa ligadura —pegada o
// separada por un espacio, siempre en minusculas y seguida de mayuscula—, y se mantiene la
// igualdad estricta, que es lo que evita clicar el boton de al lado.
const ETIQUETA_LIMPIA=[
  '(function(valor){',
  "  var v=String(valor||'').replace(/[\\s\\u00a0]+/g,' ').trim();",
  "  var sinIcono=v.replace(/^[a-z][a-z0-9_]*[ ]?(?=[A-Z\\u00c0-\\u00dc\\u00bf\\u00a1])/,'').trim();",
  '  return sinIcono&&sinIcono!==v?[v,sinIcono]:[v];',
  '})'
].join('\n');
async function button(page,name,{exact=true,timeout=30000}={}){
  const casa=`(function(el,label,strict){
    var formas=${ETIQUETA_LIMPIA}(el.getAttribute('aria-label')||el.innerText||'');
    return formas.some(function(v){return strict?v===label:v.indexOf(label)>=0});
  })`;
  await page.waitForFunction(new Function('label','strict',`return [...document.querySelectorAll('button')].some(function(el){return ${casa}(el,label,strict)})`),{timeout},name,exact);
  return page.evaluateHandle(new Function('label','strict',`return [...document.querySelectorAll('button')].find(function(el){return ${casa}(el,label,strict)})`),name,exact);
}
async function clickButton(page,name,options){const handle=await button(page,name,options);await handle.click();await handle.dispose();}
async function fillByLabel(page,label,value){
  await page.waitForFunction(text=>[...document.querySelectorAll('textarea,input,[contenteditable="true"]')].some(el=>(el.getAttribute('aria-label')||'')===text),{timeout:30000},label);
  await page.evaluate((text,next)=>{const el=[...document.querySelectorAll('textarea,input,[contenteditable="true"]')].find(node=>(node.getAttribute('aria-label')||'')===text);el.focus();if('value'in el){const set=Object.getOwnPropertyDescriptor(el.tagName==='TEXTAREA'?HTMLTextAreaElement.prototype:HTMLInputElement.prototype,'value')?.set;set?.call(el,next);}else el.textContent=next;el.dispatchEvent(new Event('input',{bubbles:true}));el.dispatchEvent(new Event('change',{bubbles:true}));},label,value);
}
const LANGUAGE_OPTIONS={es:'español',ca:'català',en:'English'};
const LANGUAGE_NAMES={es:'Spanish',ca:'Catalan',en:'English'};
// EL SELECTOR DE IDIOMA YA NO SE LLAMA ASI (Neo · MBP14, 02-09-2026). En NotebookLM el
// combobox tenia aria-label «Seleccionar idioma»; en Gemini Notebook ese texto no existe en
// ninguna parte —comprobado en la portada, dentro de un cuaderno y en el dialogo de audio— y
// el control se identifica por el idioma que muestra AHORA («español», «English»…). Como el
// waitForFunction esperaba 10 s a algo inexistente, cada entregable moria antes de empezar.
// Se busca el combobox por su valor visible; si el idioma ya es el pedido, no se toca nada.
async function selectLanguage(page,language){
  const option=LANGUAGE_OPTIONS[language]||'English';
  const conocidos=Object.values(LANGUAGE_OPTIONS);
  const abierto=await page.evaluate((valores,deseado)=>{
    const combos=[...document.querySelectorAll('[role="combobox"]')];
    const objetivo=combos.find(node=>{
      const v=(node.getAttribute('aria-label')||node.innerText||'').trim();
      return valores.some(idioma=>v.toLowerCase()===idioma.toLowerCase());
    })||combos[0];
    if(!objetivo)return 'sin-combobox';
    const actual=(objetivo.getAttribute('aria-label')||objetivo.innerText||'').trim().toLowerCase();
    if(actual===deseado.toLowerCase())return 'ya-esta';
    objetivo.click();return 'abierto';
  },conocidos,option);
  if(abierto==='ya-esta')return;
  if(abierto==='sin-combobox')throw new Error('No encuentro el selector de idioma en Gemini Notebook: la interfaz ha vuelto a cambiar.');
  await page.waitForFunction(value=>[...document.querySelectorAll('[role="option"]')].some(el=>(el.innerText||'').trim().toLowerCase()===value.toLowerCase()),{timeout:10000},option);
  await page.evaluate(value=>[...document.querySelectorAll('[role="option"]')].find(el=>(el.innerText||'').trim().toLowerCase()===value.toLowerCase())?.click(),option);
}
async function ensureNotebookAccount(page){
  await page.goto('https://notebook.google.com/',{waitUntil:'domcontentloaded'});await sleep(2500);
  const accountVisible=await page.evaluate(email=>[...document.querySelectorAll('[aria-label]')].some(el=>(el.getAttribute('aria-label')||'').includes(email)),ACCOUNT);
  if(!accountVisible)throw new Error(`NotebookLM no está autenticado como ${ACCOUNT}. Ejecuta pnpm setup.`);
}
async function newNotebook(page,job,sourceBundle){
  await ensureNotebookAccount(page);
  const continueExists=await page.evaluate(()=>[...document.querySelectorAll('button')].some(el=>(el.innerText||'').trim()==='Adelante'));
  if(continueExists)await clickButton(page,'Adelante');
  await clickButton(page,'Crear cuaderno');await page.waitForFunction(()=>location.pathname.includes('/notebook/'),{timeout:30000});await sleep(1500);
  await clickButton(page,'Texto copiado');await fillByLabel(page,'Texto pegado',sourceBundle.text);await clickButton(page,'Insertar');
  await page.waitForFunction(()=>[...document.querySelectorAll('button')].some(el=>(el.innerText||'').includes('ADMIRANEXT')), {timeout:60000});
  return page.url();
}
async function generateAudio(page,language){
  const name=LANGUAGE_NAMES[language]||'English';
  // «Personalizar resumen de audio» ya no existe: en la UI nueva la propia tarjeta
  // «Resumen de audio» abre el dialogo con idioma, duracion, formato y el campo de enfoque.
  await clickButton(page,'Resumen de audio');await selectLanguage(page,language);
  await fillByLabel(page,'¿En qué deben centrarse los presentadores de IA en este episodio?',`Create an executive ${name}-language overview for leadership. Focus on the business problem, connected-experience vision, AdmiraNeXT capabilities, proposed pilot and call to action. Do not mention Gemini Notebook or NotebookLM.`);
  await clickButton(page,'Generar');
}
async function generateVideo(page,language,style){
  const name=LANGUAGE_NAMES[language]||'English';
  await clickButton(page,'Resumen de vídeo');await selectLanguage(page,language);
  await page.evaluate(()=>[...document.querySelectorAll('[role="radio"]')].find(el=>(el.getAttribute('aria-label')||el.innerText||'').includes('Personalizado'))?.click());
  await fillByLabel(page,'Describe un estilo visual personalizado',style);
  await fillByLabel(page,'¿En qué deben centrarse los presentadores de IA?',`Produce a ${name}-language executive video: business tension, why now, connected-experience vision, Create/Activate/Understand/Measure, four-week pilot and decisive call to action. Do not mention Gemini Notebook or NotebookLM.`);
  await clickButton(page,'Generar');
}
async function generateInfographic(page,language,style){
  const name=LANGUAGE_NAMES[language]||'English';
  await clickButton(page,'Personalizar infografía');await selectLanguage(page,language);
  await page.evaluate(()=>[...document.querySelectorAll('[role="radio"]')].find(el=>(el.getAttribute('aria-label')||el.innerText||'').includes('Editorial'))?.click());
  await fillByLabel(page,'Describe la infografía que quieres crear',`Create a premium horizontal executive infographic in ${name}. Apply this visual direction: ${style} Show Business tension → Connected experience → Create / Activate / Understand / Measure → Pilot → Success metrics. Omit provider branding.`);
  await clickButton(page,'Generar');
}
async function generateSlideDeck(page,language,style){
  const name=LANGUAGE_NAMES[language]||'English';
  await clickButton(page,'Personalizar presentación de diapositivas');
  await page.waitForFunction(()=>[...document.querySelectorAll('[role="radio"]')].some(el=>(el.getAttribute('aria-label')||el.innerText||'').includes('Diapositivas del presentador')),{timeout:15000});
  await page.evaluate(()=>[...document.querySelectorAll('[role="radio"]')].find(el=>(el.getAttribute('aria-label')||el.innerText||'').includes('Diapositivas del presentador'))?.click());
  await selectLanguage(page,language);
  await fillByLabel(page,'Describe la presentación que quieres crear',`Create a polished ${name}-language executive presenter deck for a decision-making meeting. Build a clear narrative: business tension → why now → connected-experience vision → Create / Activate / Understand / Measure → four-week pilot → success metrics → decisive call to action. Use concise headlines, one idea per slide, minimal body copy, meaningful diagrams and evidence-led visuals. Apply this visual design contract consistently:\n${style}\nDo not mention Gemini Notebook or NotebookLM. Do not invent client facts, metrics or claims that are absent from the sources.`);
  await clickButton(page,'Generar');
}
async function setStage(job,tasks,stage,progress,options={}){
  const changes={};for(const task of tasks)changes[task.id]={status:'processing',stage,progress,...(options.submitted?{submittedAt:new Date().toISOString()}:{})};
  if(Object.keys(changes).length)await api('POST','',{action:'update',client:job.client,id:job.id,tasks:changes});
}
async function markFailed(job,tasks,error){
  const changes={};for(const task of tasks)changes[task.id]={status:'failed',error:String(error.message||error).slice(0,500)};
  await api('POST','',{action:'update',client:job.client,id:job.id,tasks:changes}).catch(()=>{});
}
async function processNext(browser){
  const queue=await api('GET');if(!queue.jobs?.length)return false;
  const page=await browser.newPage();page.setDefaultTimeout(45000);
  let job=null,tasks=[];
  try{
    // La sesión se valida antes de reclamar la cola: una autenticación caducada
    // nunca convierte trabajos preparados en errores ni los deja a medias.
    await ensureNotebookAccount(page);
    const summary=queue.jobs.find(item=>(!CLIENT_FILTER||item.client===CLIENT_FILTER)&&(!OUTPUT_FILTER.size||item.tasks.some(id=>OUTPUT_FILTER.has(String(id).split(':')[1]))));if(!summary)return false;
    const eligible=summary.tasks.filter(id=>!OUTPUT_FILTER.size||OUTPUT_FILTER.has(String(id).split(':')[1])),language=String(eligible[0]||'en:').split(':')[0];
    const details=await api('GET',`?client=${encodeURIComponent(summary.client)}`),presentation={...(details.presentation||{}),displayName:summary.displayName},clientLogo=await downloadClientLogo(summary.client);
    const claimIds=eligible.filter(id=>id.startsWith(`${language}:`));
    const claimed=await api('POST','',{action:'claim',client:summary.client,id:summary.id,tasks:claimIds,worker:WORKER});
    job=claimed.job;tasks=Object.values(job.tasks).filter(task=>claimIds.includes(task.id));
    await setStage(job,tasks,'Analizando la referencia y construyendo la guía visual',10);
    const visual=await generateVisualBrief({browser,presentation,job,runtime:RUNTIME}),style=visual.brief;
    const sourceBundle=buildNotebookSourceBundle({job,presentation,visualBrief:style});
    await api('POST','',{action:'update',client:job.client,id:job.id,providerJob:{visualBriefProvider:visual.provider,visualBriefSource:visual.sourceUrl,visualBriefGeneratedAt:visual.generatedAt,visualBriefFallback:Boolean(visual.error),sourceManifest:sourceBundle.manifest}});
    await setStage(job,tasks,'Preparando las fuentes en NotebookLM',22);
    const session=await page.createCDPSession();await session.send('Browser.setDownloadBehavior',{behavior:'allow',downloadPath:DOWNLOADS,eventsEnabled:true});
    const notebookUrl=await newNotebook(page,job,sourceBundle);
    await api('POST','',{action:'update',client:job.client,id:job.id,providerJob:{url:notebookUrl,account:ACCOUNT,submittedAt:new Date().toISOString()}});
    await setStage(job,tasks,'Notebook creado · preparando cada encargo',32);
    const deckTasks=tasks.filter(task=>['pdf','powerpoint'].includes(task.output));
    for(const task of tasks.filter(task=>!['pdf','powerpoint'].includes(task.output))){
      await setStage(job,[task],task.output==='audio'?'Preparando el resumen de audio':task.output==='video'?'Preparando el vídeo con la nueva guía visual':'Preparando la infografía con la nueva guía visual',38);
      if(task.output==='audio')await generateAudio(page,task.language);else if(task.output==='video')await generateVideo(page,task.language,style);else if(task.output==='infographic')await generateInfographic(page,task.language,style);await sleep(700);
      await setStage(job,[task],'Solicitud enviada a NotebookLM · esperando resultado',50,{submitted:true});
    }
    if(deckTasks.length){await setStage(job,deckTasks,'Preparando el nuevo deck con la guía visual',38);await generateSlideDeck(page,language,style);await sleep(700);await setStage(job,deckTasks,'Solicitud enviada a NotebookLM · esperando resultado',50,{submitted:true});}
    // La descarga se completa en una segunda fase del mismo proceso. Se mantiene
    // el navegador vivo y se observa Studio sin consultar APIs privadas de Google.
    await waitAndPublish(page,job,tasks,clientLogo);
    return true;
  }catch(error){if(job)await markFailed(job,tasks,error);throw error;}finally{await page.close().catch(()=>{});}
}
async function waitAndPublish(page,job,tasks,clientLogo){
  const pending=new Map(tasks.map(task=>[task.output,task]));const deadline=Date.now()+90*60*1000;
  const cardMarkers={audio:'audio_magic_eraser',video:'subscriptions',pdf:'tablet',powerpoint:'tablet',infographic:'stacked_bar_chart'};
  const waitingStarted=Date.now(),artifactFidelityReports={};let lastHeartbeat=0;
  await setStage(job,tasks,'NotebookLM está procesando los entregables',55);
  while(pending.size&&Date.now()<deadline){
    await sleep(20000);
    if(Date.now()-lastHeartbeat>=60000){
      const estimated=Math.min(82,55+Math.floor((Date.now()-waitingStarted)/120000)*2);
      await setStage(job,[...pending.values()],'NotebookLM sigue procesando · supervisión activa',estimated);
      lastHeartbeat=Date.now();
    }
    const text=await page.evaluate(()=>document.body.innerText||'');
    for(const [output,task] of [...pending]){
      const generating=output==='audio'?'Generando resumen de audio':output==='video'?'Generando resumen del vídeo':output==='infographic'?'Generando infografía':'Generando presentación';
      if(text.includes(generating))continue;
      const before=new Set(await fs.readdir(DOWNLOADS).catch(()=>[]));
      const clicked=await page.evaluate(marker=>{
        const menus=[...document.querySelectorAll('button')].filter(el=>(el.getAttribute('aria-label')||el.innerText||'').trim()==='Más');
        const target=menus.find(el=>{let node=el;for(let depth=0;depth<6&&node;depth+=1,node=node.parentElement){if((node.innerText||node.textContent||'').includes(marker))return true}return false});
        if(!target)return false;target.click();return true;
      },cardMarkers[output]);
      if(!clicked)continue;await sleep(500);
      const download=await page.evaluate(kind=>{
        const nodes=[...document.querySelectorAll('button,[role="menuitem"]')],label=kind==='pdf'?'PDF':kind==='powerpoint'?'PowerPoint':'Descargar';
        const target=nodes.find(el=>(el.getAttribute('aria-label')||el.innerText||'').includes(label));if(!target)return false;target.click();return true;
      },output);
      if(!download)continue;
      const expected=output==='pdf'?'.pdf':output==='powerpoint'?'.pptx':'';
      let file='';for(let i=0;i<60&&!file;i+=1){await sleep(1000);const files=await fs.readdir(DOWNLOADS).catch(()=>[]);file=files.find(name=>!before.has(name)&&!name.endsWith('.crdownload')&&(!expected||name.toLowerCase().endsWith(expected)))||'';}
      if(file){
        const downloaded=path.join(DOWNLOADS,file);
        await setStage(job,[task],'Descargando el resultado',86);
        const forceDeckLogo=process.env.NOTEBOOKLM_DECK_LOGO_MODE==='overlay';
        await setStage(job,[task],'Verificando la marca y preparando la publicación',92);
        let publishable=downloaded,fidelityReport={changed:false,mode:'original'};
        if(output==='video'){
          const sanitized=await cleanVideoEnding(downloaded);
          publishable=sanitized.file;fidelityReport=sanitized.report;
        }else if(output==='infographic'){
          const sanitized=await cleanInfographicBranding(downloaded);
          publishable=sanitized.file;fidelityReport=sanitized.report;
        }else if(output==='powerpoint'){
          const watermarkHashes=String(process.env.NOTEBOOKLM_WATERMARK_HASHES||'').split(',').map(value=>value.trim());
          const sanitized=await sanitizePowerPointBranding(downloaded,{watermarkHashes});
          publishable=sanitized.file;fidelityReport=sanitized.report;
          if(forceDeckLogo){
            publishable=await brandPowerPoint(publishable,clientLogo);
            fidelityReport={...fidelityReport,legacyLogoOverlay:true};
          }
        }else if(output==='pdf'&&forceDeckLogo){
          publishable=await brandPdf(downloaded,clientLogo);
          fidelityReport={changed:true,mode:'legacy-logo-overlay'};
        }
        artifactFidelityReports[task.id]=fidelityReport;
        await api('POST','',{action:'update',client:job.client,id:job.id,providerJob:{artifactFidelity:artifactFidelityReports}});
        await upload(job,task,publishable);pending.delete(output);
      }
    }
  }
  if(pending.size)throw new Error(`Tiempo agotado esperando: ${[...pending.keys()].join(', ')}`);
}

await fs.mkdir(DOWNLOADS,{recursive:true});
const chrome='/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const browser=await puppeteer.launch({headless:false,pipe:true,userDataDir:PROFILE,executablePath:await fs.access(chrome).then(()=>chrome).catch(()=>undefined),// La ventana tiene que nacer DONDE ESTA CARLOS (norma 02-09-2026): en macOS se abria
// en el Space del proceso que la lanzo, que casi nunca es el suyo, y una ventana que no
// se ve es una ventana que no existe — el login quedaba esperando a nadie.
  args:['--no-first-run','--disable-session-crashed-bubble','--window-position=60,60','--window-size=1500,980'],defaultViewport:{width:1500,height:980}});
if(setup){
  const page=await browser.newPage();await page.goto('https://notebook.google.com/');
  console.log(`Accede como ${ACCOUNT}; la ventana se cerrará sola cuando la sesión quede validada.`);
  let valid=false;while(!valid){await sleep(2000);valid=await page.evaluate(email=>[...document.querySelectorAll('[aria-label]')].some(el=>(el.getAttribute('aria-label')||'').includes(email)),ACCOUNT).catch(()=>false);}
  console.log(`Sesión validada: ${ACCOUNT}`);await browser.close();
}else{
  try{do{const worked=await processNext(browser).catch(error=>{console.error(new Date().toISOString(),error.message);return false});if(once)break;if(!worked)await sleep(POLL_MS);}while(true);}finally{await browser.close();}
}
