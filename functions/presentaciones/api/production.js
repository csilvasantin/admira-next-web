import { LANGUAGE_LABELS, OUTPUT_LABELS, normalizeGeneration, publicGeneration, recomputeGeneration, taskKey, updateTaskStatus, VALID_STATUSES } from '../_generation.js';
import { analyzeInspiration } from '../_inspiration.js';
import { persistBrandLogo } from '../_brand.js';

const enc = new TextEncoder();
const NOTEBOOK_OUTPUTS = new Set(['audio','video','pdf','powerpoint','infographic']);
const MIME_EXTENSIONS = {
  'audio/mp4':'m4a', 'audio/m4a':'m4a', 'audio/mpeg':'mp3',
  'video/mp4':'mp4', 'image/png':'png', 'image/jpeg':'jpg', 'image/webp':'webp',
  'application/pdf':'pdf',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation':'pptx'
};

function json(body,status=200){
  return new Response(JSON.stringify(body),{status,headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store, must-revalidate','x-content-type-options':'nosniff'}});
}
function same(a,b){
  const left=enc.encode(String(a||'')),right=enc.encode(String(b||''));
  if(left.length!==right.length)return false;
  let value=0;for(let i=0;i<left.length;i+=1)value|=left[i]^right[i];
  return value===0;
}
function authorized(context){
  const header=context.request.headers.get('Authorization')||'';
  return Boolean(context.env.PRESENTATION_WORKER_TOKEN)&&same(header,`Bearer ${context.env.PRESENTATION_WORKER_TOKEN}`);
}
function cleanClient(value){
  const client=String(value||'').trim().toLowerCase();
  return /^[a-z0-9][a-z0-9-]{0,79}$/.test(client)?client:'';
}
function cleanWorker(value){return String(value||'notebooklm-local').replace(/[^a-z0-9_.-]/gi,'').slice(0,80)||'notebooklm-local';}
function cleanError(value){return typeof value==='string'?value.trim().slice(0,500):'';}
function cleanStage(value){return typeof value==='string'?value.replace(/\s+/g,' ').trim().slice(0,160):'';}
function cleanProgress(value){const number=Number(value);return Number.isFinite(number)?Math.max(0,Math.min(100,Math.round(number))):null;}
function cleanTimestamp(value){if(typeof value!=='string'||!Number.isFinite(Date.parse(value)))return null;return new Date(value).toISOString();}
function safeJob(job){
  if(!job)return null;
  const safe=publicGeneration(job);
  return {...safe,sourceText:job.sourceText||'',provider:job.provider||'notebooklm'};
}
async function getJob(env,client){
  const saved=await env.PRESENTATION_IDEAS.get(`generation:${client}`,{type:'json'});
  return saved?normalizeGeneration(saved):null;
}
async function brandAsset(context,client){
  const presentation=await context.env.PRESENTATION_IDEAS.get(`presentation:${client}`,{type:'json'});
  const key=String(presentation?.brand?.logoKey||'');
  if(!key.startsWith(`presentations/${client}/brand/`)||!context.env.PRESENTATION_MEDIA)return json({error:'Logo no encontrado.'},404);
  const object=await context.env.PRESENTATION_MEDIA.get(key);if(!object)return json({error:'Logo no encontrado.'},404);
  const headers=new Headers({'cache-control':'private, max-age=3600','x-content-type-options':'nosniff'});object.writeHttpMetadata(headers);headers.set('etag',object.httpEtag);
  return new Response(object.body,{headers});
}
async function publishedAsset(context,client,output,language){
  if(!NOTEBOOK_OUTPUTS.has(output)||!['es','ca','en'].includes(language)||!context.env.PRESENTATION_MEDIA)return json({error:'Entregable no encontrado.'},404);
  const job=await getJob(context.env,client),task=job?.tasks?.[`${language}:${output}`],filename=String(task?.url||'').split('/').pop()||'';
  if(!filename||filename.includes('..'))return json({error:'Entregable no encontrado.'},404);
  const object=await context.env.PRESENTATION_MEDIA.get(`presentations/${client}/${language}/${filename}`);if(!object)return json({error:'Entregable no encontrado.'},404);
  const headers=new Headers({'cache-control':'private, max-age=3600','x-content-type-options':'nosniff'});object.writeHttpMetadata(headers);headers.set('etag',object.httpEtag);
  return new Response(object.body,{headers});
}
async function putJob(env,client,job){
  recomputeGeneration(job);
  await env.PRESENTATION_IDEAS.put(`generation:${client}`,JSON.stringify(job));
}
function notebookTasks(job,statuses=['queued']){
  const wanted=new Set(statuses);
  return Object.values(job?.tasks||{}).filter(task=>NOTEBOOK_OUTPUTS.has(task.output)&&task.provider==='notebooklm'&&wanted.has(task.status));
}

async function listQueue(context){
  const requestUrl=new URL(context.request.url),client=cleanClient(requestUrl.searchParams.get('client'));
  if(client){
    const asset=String(requestUrl.searchParams.get('asset')||'').toLowerCase();
    if(asset==='logo')return brandAsset(context,client);
    if(NOTEBOOK_OUTPUTS.has(asset))return publishedAsset(context,client,asset,String(requestUrl.searchParams.get('language')||'en').toLowerCase());
    const [job,presentation]=await Promise.all([
      getJob(context.env,client),
      context.env.PRESENTATION_IDEAS.get(`presentation:${client}`,{type:'json'})
    ]);
    if(!job)return json({error:'Generación no encontrada.'},404);
    return json({ok:true,job:safeJob(job),presentation:presentation?{displayName:presentation.displayName,website:presentation.website,inspirationUrl:presentation.inspirationUrl,inspirationSource:presentation.inspirationSource,inspiration:presentation.inspiration,theme:presentation.theme,brand:presentation.brand,languages:presentation.languages}:null});
  }
  const jobs=[];let cursor;
  do{
    const page=await context.env.PRESENTATION_IDEAS.list({prefix:'generation:',limit:100,cursor});
    const values=await Promise.all(page.keys.map(async key=>{
      const client=key.name.slice(11);
      const [job,presentation]=await Promise.all([
        context.env.PRESENTATION_IDEAS.get(key.name,{type:'json'}),
        context.env.PRESENTATION_IDEAS.get(`presentation:${client}`,{type:'json'})
      ]);
      return {client,job,presentation};
    }));
    for(const item of values){
      if(!item.presentation)continue;
      const job=normalizeGeneration(item.job);const tasks=notebookTasks(job,['queued']);
      if(tasks.length)jobs.push({client:item.client,id:job.id,displayName:job.displayName,createdAt:job.createdAt,updatedAt:job.updatedAt,languages:job.languages,tasks:tasks.map(task=>task.id)});
    }
    cursor=page.list_complete?undefined:page.cursor;
  }while(cursor);
  jobs.sort((a,b)=>String(a.createdAt).localeCompare(String(b.createdAt)));
  return json({ok:true,jobs});
}

async function refreshBrand(context,payload){
  const client=cleanClient(payload.client);if(!client)return json({error:'Cliente no válido.'},400);
  const presentation=await context.env.PRESENTATION_IDEAS.get(`presentation:${client}`,{type:'json'});
  if(!presentation)return json({error:'Presentación no encontrada.'},404);
  if(!presentation.website)return json({error:'La presentación no tiene web oficial.'},422);
  try{
    const analysis=await analyzeInspiration(presentation.website);
    const brand=await persistBrandLogo(context.env,{slug:client,displayName:presentation.displayName,website:presentation.website,analysis});
    presentation.brand=brand;presentation.inspirationSource=presentation.inspirationSource||(presentation.inspirationUrl&&presentation.inspirationUrl!==presentation.website?'explicit':'client-website');presentation.schemaVersion=Math.max(3,Number(presentation.schemaVersion)||0);presentation.updatedAt=new Date().toISOString();
    const ideas=await context.env.PRESENTATION_IDEAS.get(`ideas:${client}`,{type:'json'});if(ideas){ideas.brand=brand;ideas.updatedAt=presentation.updatedAt;}
    await Promise.all([context.env.PRESENTATION_IDEAS.put(`presentation:${client}`,JSON.stringify(presentation)),ideas?context.env.PRESENTATION_IDEAS.put(`ideas:${client}`,JSON.stringify(ideas)):Promise.resolve()]);
    return json({ok:true,client,brand});
  }catch(error){return json({error:error.message||'No se pudo actualizar el logo oficial.'},422);}
}

async function updateJob(context,payload){
  const client=cleanClient(payload.client);
  if(!client)return json({error:'Cliente no válido.'},400);
  const job=await getJob(context.env,client);
  if(!job)return json({error:'Generación no encontrada.'},404);
  if(payload.id&&payload.id!==job.id)return json({error:'La generación ya no es la vigente.'},409);
  const now=new Date().toISOString();
  if(payload.action==='enqueue'){
    const outputs=[...new Set((Array.isArray(payload.outputs)?payload.outputs:[]).map(value=>String(value||'').toLowerCase()).filter(value=>NOTEBOOK_OUTPUTS.has(value)))];
    const languages=[...new Set((Array.isArray(payload.languages)&&payload.languages.length?payload.languages:job.languages||[]).map(value=>String(value||'').toLowerCase()).filter(value=>['es','ca','en'].includes(value)))];
    if(!outputs.length||!languages.length)return json({error:'Indica entregables e idiomas válidos.'},400);
    job.requested=[...new Set([...(job.requested||[]),...outputs])];job.languages=[...new Set([...(job.languages||[]),...languages])];
    for(const language of languages)for(const output of outputs){
      const id=taskKey(language,output),existing=job.tasks?.[id];if(existing&&!payload.force)continue;
      job.tasks[id]={id,language,languageLabel:LANGUAGE_LABELS[language],output,label:OUTPUT_LABELS[output],status:'queued',url:null,attempts:Number(existing?.attempts||0),provider:'notebooklm',requestedAt:now,updatedAt:now,...(['pdf','powerpoint'].includes(output)?{postProcess:{providerCleanup:'fidelity-bridge',identifiedElementsOnly:true,preserveVisualStyle:true,preserveTheme:true,preserveMasters:true,preserveFonts:true,preserveComposition:true}}:{})};
    }
  }else if(payload.action==='claim'){
    const requested=new Set(Array.isArray(payload.tasks)?payload.tasks:[]);
    const candidates=notebookTasks(job,['queued']).filter(task=>!requested.size||requested.has(task.id));
    if(!candidates.length)return json({error:'No hay tareas preparadas para reclamar.'},409);
    for(const task of candidates){updateTaskStatus(task,'processing',now);task.progress=5;task.stage='Encargo reclamado por el productor';task.worker=cleanWorker(payload.worker);task.attempts=Number(task.attempts||0)+1;}
    job.providerJob={...(job.providerJob||{}),worker:cleanWorker(payload.worker),claimedAt:now};
  }else if(payload.action==='update'){
    for(const [taskId,change] of Object.entries(payload.tasks||{})){
      const task=job.tasks?.[taskId];if(!task||!change||typeof change!=='object')continue;
      if(VALID_STATUSES.has(change.status))updateTaskStatus(task,change.status,now);
      if(typeof change.url==='string'&&change.url.length<=1000)task.url=change.url;
      const error=cleanError(change.error);if(error)task.error=error;
      const stage=cleanStage(change.stage);if(stage&&task.status==='processing')task.stage=stage;
      const progress=cleanProgress(change.progress);if(progress!==null)task.progress=progress;
      const submittedAt=cleanTimestamp(change.submittedAt);if(submittedAt)task.submittedAt ||= submittedAt;
      task.updatedAt=now;
    }
    if(payload.providerJob&&typeof payload.providerJob==='object')job.providerJob={...(job.providerJob||{}),...payload.providerJob,updatedAt:now};
  }else return json({error:'Acción no admitida.'},400);
  await putJob(context.env,client,job);
  return json({ok:true,job:safeJob(job)});
}

async function uploadArtifact(context){
  if(!context.env.PRESENTATION_MEDIA)return json({error:'Almacenamiento multimedia no configurado.'},503);
  const url=new URL(context.request.url),client=cleanClient(url.searchParams.get('client'));
  const language=String(url.searchParams.get('language')||'').toLowerCase(),output=String(url.searchParams.get('output')||'').toLowerCase();
  if(!client||!['es','ca','en'].includes(language)||!NOTEBOOK_OUTPUTS.has(output))return json({error:'Destino de publicación no válido.'},400);
  const job=await getJob(context.env,client);if(!job)return json({error:'Generación no encontrada.'},404);
  if(url.searchParams.get('id')&&url.searchParams.get('id')!==job.id)return json({error:'La generación ya no es la vigente.'},409);
  const task=job.tasks?.[`${language}:${output}`];if(!task)return json({error:'Entregable no solicitado.'},404);
  const contentType=(context.request.headers.get('content-type')||'application/octet-stream').split(';')[0].trim().toLowerCase();
  const hinted=String(context.request.headers.get('x-file-name')||'').toLowerCase().match(/\.([a-z0-9]{2,5})$/)?.[1];
  const extension=MIME_EXTENSIONS[contentType]||hinted;
  if(!extension||!['m4a','mp3','mp4','png','jpg','jpeg','webp','pdf','pptx'].includes(extension))return json({error:'Formato de archivo no admitido.'},415);
  const stamp=new Date().toISOString().replace(/[-:.TZ]/g,'');
  const filename=`${output}-${language}-${stamp}.${extension}`;
  const objectKey=`presentations/${client}/${language}/${filename}`;
  await context.env.PRESENTATION_MEDIA.put(objectKey,context.request.body,{httpMetadata:{contentType,cacheControl:'private, max-age=3600'},customMetadata:{client,language,output,generationId:job.id}});
  const now=new Date().toISOString();
  task.url=`/presentaciones/${client}/media/${filename}`;
  updateTaskStatus(task,'published',now);
  task.worker=cleanWorker(context.request.headers.get('x-worker'));
  job.providerJob={...(job.providerJob||{}),lastPublishedAt:now};
  await putJob(context.env,client,job);
  return json({ok:true,task:{id:task.id,status:task.status,url:task.url,completedAt:task.completedAt},generation:publicGeneration(job)},201);
}

export async function onRequest(context){
  if(!authorized(context))return json({error:'No autorizado.'},401);
  if(!context.env.PRESENTATION_IDEAS)return json({error:'Almacenamiento no configurado.'},503);
  if(context.request.method==='GET')return listQueue(context);
  if(context.request.method==='PUT')return uploadArtifact(context);
  if(context.request.method!=='POST')return json({error:'Método no permitido.'},405);
  let payload;try{payload=await context.request.json();}catch(_){return json({error:'JSON no válido.'},400);}
  if(payload?.action==='refresh-brand')return refreshBrand(context,payload);
  return updateJob(context,payload||{});
}
