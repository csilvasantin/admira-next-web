import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import puppeteer from 'puppeteer';

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
async function selectLanguage(page){
  await page.evaluate(()=>{const el=[...document.querySelectorAll('[role="combobox"]')].find(node=>(node.getAttribute('aria-label')||'')==='Seleccionar idioma');el?.click();});
  await page.waitForFunction(()=>[...document.querySelectorAll('[role="option"]')].some(el=>(el.innerText||'').trim()==='English'),{timeout:10000});
  await page.evaluate(()=>[...document.querySelectorAll('[role="option"]')].find(el=>(el.innerText||'').trim()==='English')?.click());
}
async function newNotebook(page,job){
  await page.goto('https://notebooklm.google.com/',{waitUntil:'domcontentloaded'});await sleep(2500);
  const accountVisible=await page.evaluate(email=>[...document.querySelectorAll('[aria-label]')].some(el=>(el.getAttribute('aria-label')||'').includes(email)),ACCOUNT);
  if(!accountVisible)throw new Error(`NotebookLM no está autenticado como ${ACCOUNT}. Ejecuta npm run setup.`);
  const continueExists=await page.evaluate(()=>[...document.querySelectorAll('button')].some(el=>(el.innerText||'').trim()==='Adelante'));
  if(continueExists)await clickButton(page,'Adelante');
  await clickButton(page,'Crear cuaderno');await page.waitForFunction(()=>location.pathname.includes('/notebook/'),{timeout:30000});await sleep(1500);
  await clickButton(page,'Texto copiado');await fillByLabel(page,'Texto pegado',job.sourceText);await clickButton(page,'Insertar');
  await page.waitForFunction(()=>[...document.querySelectorAll('button')].some(el=>(el.innerText||'').includes('ADMIRANEXT')), {timeout:60000});
  return page.url();
}
async function generateAudio(page){
  await clickButton(page,'Personalizar resumen de audio');await selectLanguage(page);
  await fillByLabel(page,'¿En qué deben centrarse los presentadores de IA en este episodio?','Create an executive English-language overview for leadership. Focus on the business problem, connected-experience vision, AdmiraNeXT capabilities, proposed pilot and call to action. Do not mention Gemini Notebook or NotebookLM.');
  await clickButton(page,'Generar');
}
async function generateVideo(page){
  await clickButton(page,'Resumen de vídeo');await selectLanguage(page);
  await page.evaluate(()=>[...document.querySelectorAll('[role="radio"]')].find(el=>(el.getAttribute('aria-label')||el.innerText||'').includes('Personalizado'))?.click());
  await fillByLabel(page,'Describe un estilo visual personalizado','Zero University-inspired digital editorial design: stark black and warm off-white fields, oversized condensed neo-grotesk typography, dramatic scale shifts, tight modular grid, electric cobalt and acid-lime accents, simple geometric diagrams, crisp product-interface fragments and premium tech-culture energy. No stock-photo corporate aesthetic and no provider branding.');
  await fillByLabel(page,'¿En qué deben centrarse los presentadores de IA?','Produce an English executive video: business tension, why now, connected-experience vision, Create/Activate/Understand/Measure, four-week pilot and decisive call to action. Do not mention Gemini Notebook or NotebookLM.');
  await clickButton(page,'Generar');
}
async function generateInfographic(page){
  await clickButton(page,'Personalizar infografía');await selectLanguage(page);
  await page.evaluate(()=>[...document.querySelectorAll('[role="radio"]')].find(el=>(el.getAttribute('aria-label')||el.innerText||'').includes('Editorial'))?.click());
  await fillByLabel(page,'Describe la infografía que quieres crear','Create a premium horizontal executive infographic in English inspired by Zero University: warm off-white and black, oversized condensed neo-grotesk headings, electric cobalt and acid-lime accents, tight modular grid and simple geometric diagrams. Show Business tension → Connected experience → Create / Activate / Understand / Measure → Four-week pilot → Success metrics. Omit provider branding.');
  await clickButton(page,'Generar');
}
async function markFailed(job,tasks,error){
  const changes={};for(const task of tasks)changes[task.id]={status:'failed',error:String(error.message||error).slice(0,500)};
  await api('POST','',{action:'update',client:job.client,id:job.id,tasks:changes}).catch(()=>{});
}
async function processNext(browser){
  const queue=await api('GET');if(!queue.jobs?.length)return false;
  const summary=queue.jobs[0],claimed=await api('POST','',{action:'claim',client:summary.client,id:summary.id,tasks:summary.tasks,worker:WORKER});
  const job=claimed.job,tasks=Object.values(job.tasks).filter(task=>summary.tasks.includes(task.id));
  const page=await browser.newPage();page.setDefaultTimeout(45000);
  try{
    const session=await page.createCDPSession();await session.send('Browser.setDownloadBehavior',{behavior:'allow',downloadPath:DOWNLOADS,eventsEnabled:true});
    const notebookUrl=await newNotebook(page,job);
    await api('POST','',{action:'update',client:job.client,id:job.id,providerJob:{url:notebookUrl,account:ACCOUNT,submittedAt:new Date().toISOString()}});
    for(const task of tasks){if(task.output==='audio')await generateAudio(page);else if(task.output==='video')await generateVideo(page);else if(task.output==='infographic')await generateInfographic(page);await sleep(700);}
    // La descarga se completa en una segunda fase del mismo proceso. Se mantiene
    // el navegador vivo y se observa Studio sin consultar APIs privadas de Google.
    await waitAndPublish(page,job,tasks);
    return true;
  }catch(error){await markFailed(job,tasks,error);throw error;}finally{await page.close().catch(()=>{});}
}
async function waitAndPublish(page,job,tasks){
  const pending=new Map(tasks.map(task=>[task.output,task]));const deadline=Date.now()+90*60*1000;
  while(pending.size&&Date.now()<deadline){
    await sleep(20000);
    const text=await page.evaluate(()=>document.body.innerText||'');
    for(const [output,task] of [...pending]){
      const generating=output==='audio'?'Generando resumen de audio':output==='video'?'Generando resumen del vídeo':'Generando infografía';
      if(text.includes(generating))continue;
      const before=new Set(await fs.readdir(DOWNLOADS).catch(()=>[]));
      const label=output==='audio'?'Resumen de audio':output==='video'?'Resumen de vídeo':'Infografía';
      const clicked=await page.evaluate(target=>{const candidates=[...document.querySelectorAll('button')].filter(el=>{const owner=el.closest('div');return owner&&(owner.innerText||'').includes(target)&&(el.getAttribute('aria-label')||el.innerText||'').includes('Más')});if(candidates[0]){candidates[0].click();return true}return false},label);
      if(!clicked)continue;await sleep(500);
      const download=await page.evaluate(()=>[...document.querySelectorAll('button,[role="menuitem"]')].find(el=>(el.getAttribute('aria-label')||el.innerText||'').includes('Descargar'))?.click()||false);
      if(!download)continue;
      let file='';for(let i=0;i<60&&!file;i+=1){await sleep(1000);const files=await fs.readdir(DOWNLOADS).catch(()=>[]);file=files.find(name=>!before.has(name)&&!name.endsWith('.crdownload'))||'';}
      if(file){await upload(job,task,path.join(DOWNLOADS,file));pending.delete(output);}
    }
  }
  if(pending.size)throw new Error(`Tiempo agotado esperando: ${[...pending.keys()].join(', ')}`);
}

await fs.mkdir(DOWNLOADS,{recursive:true});
const chrome='/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const browser=await puppeteer.launch({headless:false,userDataDir:PROFILE,executablePath:await fs.access(chrome).then(()=>chrome).catch(()=>undefined),args:['--no-first-run','--disable-session-crashed-bubble'],defaultViewport:{width:1500,height:980}});
if(setup){const page=await browser.newPage();await page.goto('https://notebooklm.google.com/');console.log(`Accede como ${ACCOUNT} y cierra con Ctrl+C cuando veas tus cuadernos.`);await new Promise(()=>{});}else{
  try{do{const worked=await processNext(browser).catch(error=>{console.error(new Date().toISOString(),error.message);return false});if(once)break;if(!worked)await sleep(POLL_MS);}while(true);}finally{await browser.close();}
}
