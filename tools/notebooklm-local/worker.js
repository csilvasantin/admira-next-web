import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import puppeteer from 'puppeteer';
import ffmpegPath from 'ffmpeg-static';
import sharp from 'sharp';

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

function token(){
  if(process.env.PRESENTATION_WORKER_TOKEN)return process.env.PRESENTATION_WORKER_TOKEN.trim();
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
  const types={'.m4a':'audio/mp4','.mp3':'audio/mpeg','.mp4':'video/mp4','.png':'image/png','.jpg':'image/jpeg','.jpeg':'image/jpeg','.webp':'image/webp'};
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
async function cleanVideoEnding(file,clientLogo){
  const duration=Number(execFileSync('mdls',['-raw','-name','kMDItemDurationSeconds',file],{encoding:'utf8',stdio:['ignore','pipe','ignore']}).trim());
  if(!ffmpegPath||!Number.isFinite(duration)||duration<=4)throw new Error('No se pudo preparar el cierre limpio del vídeo.');
  const cut=(duration-3).toFixed(3),total=duration.toFixed(3);
  const output=path.join(path.dirname(file),`${path.basename(file,'.mp4')}.admiranext.mp4`);
  const badge=path.join(RUNTIME,'admiranext-video-badge.png');
  const clientBadge=path.join(RUNTIME,`${path.basename(file,'.mp4')}.client-logo.png`);
  execFileSync('sips',['-s','format','png',path.join(ROOT,'presentaciones/LaCaixa/assets/admiranext-video-badge.svg'),'--out',badge],{stdio:'ignore'});
  execFileSync('sips',['-Z','180',badge],{stdio:'ignore'});
  await fs.writeFile(clientBadge,await clientLogoBadge(clientLogo,210,62));
  const filter=`[0:v][1:v]overlay=W-w-18:H-h-18:format=auto[admira];[admira][2:v]overlay=18:18:format=auto,trim=start=0:end=${cut},setpts=PTS-STARTPTS,tpad=stop_mode=clone:stop_duration=3,trim=duration=${total},format=yuv420p[v];[0:a]atrim=start=0:end=${total},asetpts=PTS-STARTPTS[a]`;
  execFileSync(ffmpegPath,['-hide_banner','-y','-loglevel','warning','-i',file,'-loop','1','-i',badge,'-loop','1','-i',clientBadge,'-filter_complex',filter,'-map','[v]','-map','[a]','-c:v','libx264','-preset','medium','-crf','21','-profile:v','high','-r','24','-c:a','aac','-b:a','80k','-movflags','+faststart','-metadata','comment=NotebookLM branding removed · AdmiraNeXT and client identity applied · duration preserved','-shortest',output],{stdio:'ignore'});
  return output;
}
async function cleanInfographicBranding(file,clientLogo){
  const metadata=await sharp(file).metadata(),width=Number(metadata.width),height=Number(metadata.height);
  if(!width||!height)throw new Error('No se pudo leer la infografía descargada.');
  const coverWidth=Math.ceil(width*.09),coverHeight=Math.ceil(height*.035),top=height-coverHeight;
  const sampleLeft=Math.max(0,width-(coverWidth*2)-24);
  // Gemini Notebook sitúa su firma en la última franja derecha. Clonamos una
  // franja de fondo inmediatamente anterior para conservar papel, grano y luz.
  const background=await sharp(file).extract({left:sampleLeft,top,width:coverWidth,height:coverHeight}).png().toBuffer();
  const footerHeight=Math.max(96,Math.ceil(height*.085)),logo=await clientLogoBadge(clientLogo,Math.ceil(width*.14),Math.ceil(footerHeight*.62)),logoMeta=await sharp(logo).metadata();
  const pixel=await sharp(file).extract({left:0,top:height-1,width:1,height:1}).ensureAlpha().raw().toBuffer(),footerColor={r:pixel[0],g:pixel[1],b:pixel[2],alpha:(pixel[3]??255)/255};
  const output=path.join(path.dirname(file),`${path.basename(file,'.png')}.admiranext.png`);
  const cleaned=await sharp(file).composite([{input:background,left:width-coverWidth,top}]).png().toBuffer();
  await sharp(cleaned).extend({bottom:footerHeight,background:footerColor}).composite([{input:logo,left:Math.max(18,width-Number(logoMeta.width)-Math.ceil(width*.018)),top:height+Math.max(0,Math.floor((footerHeight-Number(logoMeta.height))/2))}]).png().toFile(output);
  return output;
}
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
async function button(page,name,{exact=true,timeout=30000}={}){
  await page.waitForFunction((label,strict)=>[...document.querySelectorAll('button')].some(el=>{const value=(el.getAttribute('aria-label')||el.innerText||'').trim();return strict?value===label:value.includes(label)}),{timeout},name,exact);
  return page.evaluateHandle((label,strict)=>[...document.querySelectorAll('button')].find(el=>{const value=(el.getAttribute('aria-label')||el.innerText||'').trim();return strict?value===label:value.includes(label)}),name,exact);
}
async function clickButton(page,name,options){const handle=await button(page,name,options);await handle.click();await handle.dispose();}
async function fillByLabel(page,label,value){
  await page.waitForFunction(text=>[...document.querySelectorAll('textarea,input,[contenteditable="true"]')].some(el=>(el.getAttribute('aria-label')||'')===text),{timeout:30000},label);
  await page.evaluate((text,next)=>{const el=[...document.querySelectorAll('textarea,input,[contenteditable="true"]')].find(node=>(node.getAttribute('aria-label')||'')===text);el.focus();if('value'in el){const set=Object.getOwnPropertyDescriptor(el.tagName==='TEXTAREA'?HTMLTextAreaElement.prototype:HTMLInputElement.prototype,'value')?.set;set?.call(el,next);}else el.textContent=next;el.dispatchEvent(new Event('input',{bubbles:true}));el.dispatchEvent(new Event('change',{bubbles:true}));},label,value);
}
const LANGUAGE_OPTIONS={es:'español',ca:'català',en:'English'};
const LANGUAGE_NAMES={es:'Spanish',ca:'Catalan',en:'English'};
function visualStyle(presentation={}){
  const logoRule=` The official ${presentation.displayName||'client'} logo is mandatory, must preserve its proportions and colors, and must remain visible throughout every visual deliverable.`;
  if(/(?:^|\.)zero\.university/i.test(String(presentation.inspirationUrl||'')))return `Zero University-inspired digital editorial design: stark black and warm off-white fields, oversized condensed neo-grotesk typography, dramatic scale shifts, tight modular grid, electric cobalt and acid-lime accents, simple geometric diagrams, crisp product-interface fragments and premium tech-culture energy. No stock-photo corporate aesthetic and no provider branding.${logoRule}`;
  const theme=presentation.theme||{};
  return `Premium ${theme.profile||'structured'} ${theme.layout||'editorial'} brand system with ${theme.mode||'light'} surfaces, primary ${theme.primary||'#12233e'}, accent ${theme.accent||'#ffb000'}, ${theme.fontStyle||'grotesk'} typography, a clear modular grid, simple geometric diagrams and generous whitespace. No stock-photo corporate aesthetic and no provider branding.${logoRule}`;
}
async function selectLanguage(page,language){
  const option=LANGUAGE_OPTIONS[language]||'English';
  await page.evaluate(()=>{const el=[...document.querySelectorAll('[role="combobox"]')].find(node=>(node.getAttribute('aria-label')||'')==='Seleccionar idioma');el?.click();});
  await page.waitForFunction(value=>[...document.querySelectorAll('[role="option"]')].some(el=>(el.innerText||'').trim()===value),{timeout:10000},option);
  await page.evaluate(value=>[...document.querySelectorAll('[role="option"]')].find(el=>(el.innerText||'').trim()===value)?.click(),option);
}
async function ensureNotebookAccount(page){
  await page.goto('https://notebooklm.google.com/',{waitUntil:'domcontentloaded'});await sleep(2500);
  const accountVisible=await page.evaluate(email=>[...document.querySelectorAll('[aria-label]')].some(el=>(el.getAttribute('aria-label')||'').includes(email)),ACCOUNT);
  if(!accountVisible)throw new Error(`NotebookLM no está autenticado como ${ACCOUNT}. Ejecuta pnpm setup.`);
}
async function newNotebook(page,job){
  await ensureNotebookAccount(page);
  const continueExists=await page.evaluate(()=>[...document.querySelectorAll('button')].some(el=>(el.innerText||'').trim()==='Adelante'));
  if(continueExists)await clickButton(page,'Adelante');
  await clickButton(page,'Crear cuaderno');await page.waitForFunction(()=>location.pathname.includes('/notebook/'),{timeout:30000});await sleep(1500);
  await clickButton(page,'Texto copiado');await fillByLabel(page,'Texto pegado',job.sourceText);await clickButton(page,'Insertar');
  await page.waitForFunction(()=>[...document.querySelectorAll('button')].some(el=>(el.innerText||'').includes('ADMIRANEXT')), {timeout:60000});
  return page.url();
}
async function generateAudio(page,language){
  const name=LANGUAGE_NAMES[language]||'English';
  await clickButton(page,'Personalizar resumen de audio');await selectLanguage(page,language);
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
    const summary=queue.jobs[0],language=String(summary.tasks[0]||'en:').split(':')[0];
    const details=await api('GET',`?client=${encodeURIComponent(summary.client)}`),presentation=details.presentation||{},style=visualStyle({...presentation,displayName:summary.displayName}),clientLogo=await downloadClientLogo(summary.client);
    const claimIds=summary.tasks.filter(id=>id.startsWith(`${language}:`));
    const claimed=await api('POST','',{action:'claim',client:summary.client,id:summary.id,tasks:claimIds,worker:WORKER});
    job=claimed.job;tasks=Object.values(job.tasks).filter(task=>claimIds.includes(task.id));
    const session=await page.createCDPSession();await session.send('Browser.setDownloadBehavior',{behavior:'allow',downloadPath:DOWNLOADS,eventsEnabled:true});
    const notebookUrl=await newNotebook(page,job);
    await api('POST','',{action:'update',client:job.client,id:job.id,providerJob:{url:notebookUrl,account:ACCOUNT,submittedAt:new Date().toISOString()}});
    for(const task of tasks){if(task.output==='audio')await generateAudio(page,task.language);else if(task.output==='video')await generateVideo(page,task.language,style);else if(task.output==='infographic')await generateInfographic(page,task.language,style);await sleep(700);}
    // La descarga se completa en una segunda fase del mismo proceso. Se mantiene
    // el navegador vivo y se observa Studio sin consultar APIs privadas de Google.
    await waitAndPublish(page,job,tasks,clientLogo);
    return true;
  }catch(error){if(job)await markFailed(job,tasks,error);throw error;}finally{await page.close().catch(()=>{});}
}
async function waitAndPublish(page,job,tasks,clientLogo){
  const pending=new Map(tasks.map(task=>[task.output,task]));const deadline=Date.now()+90*60*1000;
  const cardMarkers={audio:'audio_magic_eraser',video:'subscriptions',infographic:'stacked_bar_chart'};
  while(pending.size&&Date.now()<deadline){
    await sleep(20000);
    const text=await page.evaluate(()=>document.body.innerText||'');
    for(const [output,task] of [...pending]){
      const generating=output==='audio'?'Generando resumen de audio':output==='video'?'Generando resumen del vídeo':'Generando infografía';
      if(text.includes(generating))continue;
      const before=new Set(await fs.readdir(DOWNLOADS).catch(()=>[]));
      const clicked=await page.evaluate(marker=>{
        const menus=[...document.querySelectorAll('button')].filter(el=>(el.getAttribute('aria-label')||el.innerText||'').trim()==='Más');
        const target=menus.find(el=>{let node=el;for(let depth=0;depth<6&&node;depth+=1,node=node.parentElement){if((node.innerText||node.textContent||'').includes(marker))return true}return false});
        if(!target)return false;target.click();return true;
      },cardMarkers[output]);
      if(!clicked)continue;await sleep(500);
      const download=await page.evaluate(()=>[...document.querySelectorAll('button,[role="menuitem"]')].find(el=>(el.getAttribute('aria-label')||el.innerText||'').includes('Descargar'))?.click()||false);
      if(!download)continue;
      let file='';for(let i=0;i<60&&!file;i+=1){await sleep(1000);const files=await fs.readdir(DOWNLOADS).catch(()=>[]);file=files.find(name=>!before.has(name)&&!name.endsWith('.crdownload'))||'';}
      if(file){
        const downloaded=path.join(DOWNLOADS,file);
        const publishable=output==='video'?await cleanVideoEnding(downloaded,clientLogo):output==='infographic'?await cleanInfographicBranding(downloaded,clientLogo):downloaded;
        await upload(job,task,publishable);pending.delete(output);
      }
    }
  }
  if(pending.size)throw new Error(`Tiempo agotado esperando: ${[...pending.keys()].join(', ')}`);
}

await fs.mkdir(DOWNLOADS,{recursive:true});
const chrome='/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const browser=await puppeteer.launch({headless:false,pipe:true,userDataDir:PROFILE,executablePath:await fs.access(chrome).then(()=>chrome).catch(()=>undefined),args:['--no-first-run','--disable-session-crashed-bubble'],defaultViewport:{width:1500,height:980}});
if(setup){
  const page=await browser.newPage();await page.goto('https://notebooklm.google.com/');
  console.log(`Accede como ${ACCOUNT}; la ventana se cerrará sola cuando la sesión quede validada.`);
  let valid=false;while(!valid){await sleep(2000);valid=await page.evaluate(email=>[...document.querySelectorAll('[aria-label]')].some(el=>(el.getAttribute('aria-label')||'').includes(email)),ACCOUNT).catch(()=>false);}
  console.log(`Sesión validada: ${ACCOUNT}`);await browser.close();
}else{
  try{do{const worked=await processNext(browser).catch(error=>{console.error(new Date().toISOString(),error.message);return false});if(once)break;if(!worked)await sleep(POLL_MS);}while(true);}finally{await browser.close();}
}
