export const OUTPUTS = ['website','audio','video','pdf','powerpoint','documents','infographic'];
export const LANGUAGES = ['es','ca','en'];
export const OUTPUT_LABELS = {
  website:'Website', audio:'Audio', video:'Vídeo', pdf:'PDF', powerpoint:'PowerPoint',
  documents:'Documento de trabajo', infographic:'Infografía'
};
export const LANGUAGE_LABELS = { es:'Castellano', ca:'Català', en:'English' };
export const VALID_STATUSES = new Set(['waiting','queued','processing','ready','published','complete','failed','skipped']);
export const PRODUCTION_LEVELS = {
  classic:{key:'good',label:'Good',style:'classic',look:'Classic',durationSeconds:60,scope:'Esencial'},
  admira:{key:'better',label:'Better',style:'admira',look:'Admira',durationSeconds:180,scope:'Ejecutivo'},
  movie:{key:'best',label:'Best',style:'movie',look:'Película',durationSeconds:300,scope:'Inmersivo'}
};

const BUILT_IN_INVENTORY = {
  lacaixa:{
    languages:['es','ca','en'],
    tasks:{
      'es:website':{url:'/presentaciones/lacaixa/presentacion?lang=es',status:'ready',verified:true},
      'ca:website':{url:'/presentaciones/lacaixa/presentacion?lang=ca',status:'ready',verified:true},
      'en:website':{url:'/presentaciones/lacaixa/presentacion?lang=en',status:'ready',verified:true},
      'es:audio':{url:'/presentaciones/LaCaixa/media/admiranext-caixabank-audio.m4a',status:'ready',verified:true,actualDurationSeconds:98.5},
      'ca:audio':{url:'/presentaciones/LaCaixa/media/admiranext-caixabank-audio-ca.m4a',status:'ready',verified:true,actualDurationSeconds:418.1},
      'es:video':{url:'/presentaciones/LaCaixa/media/admiranext-caixabank-video.mp4',status:'ready',verified:true,actualDurationSeconds:441.5},
      'ca:video':{url:'/presentaciones/LaCaixa/media/admiranext-caixabank-video-ca.mp4',status:'ready',verified:true,actualDurationSeconds:418.1},
      'es:pdf':{url:'/presentaciones/LaCaixa/media/admiranext-caixabank-presentacion.pdf',status:'ready',verified:true},
      'ca:pdf':{url:'/presentaciones/LaCaixa/media/admiranext-caixabank-presentacion-ca.pdf',status:'ready',verified:true},
      'es:powerpoint':{url:'/presentaciones/LaCaixa/media/admiranext-caixabank-presentacion.pptx',status:'ready',verified:true},
      'ca:powerpoint':{url:'/presentaciones/LaCaixa/media/admiranext-caixabank-presentacion-ca.pptx',status:'ready',verified:true},
      'es:documents':{url:'/presentaciones/LaCaixa/media/admiranext-caixabank-documento-trabajo.txt',status:'ready',verified:true},
      'ca:documents':{url:'/presentaciones/LaCaixa/media/admiranext-caixabank-document-treball-ca.txt',status:'ready',verified:true},
      'es:infographic':{url:'/presentaciones/LaCaixa/media/admiranext-caixabank-infografia.png',status:'ready',verified:true},
      'ca:infographic':{url:'/presentaciones/LaCaixa/media/admiranext-caixabank-infografia-ca.png',status:'ready',verified:true}
    }
  }
};

function styleKey(value){
  const normalized=String(value||'').toLowerCase();
  if(['classic','good'].includes(normalized))return 'classic';
  if(['admira','better'].includes(normalized))return 'admira';
  if(['movie','best','pelicula','película'].includes(normalized))return 'movie';
  return 'classic';
}
export function productionLevel(style){ return {...PRODUCTION_LEVELS[styleKey(style)]}; }
export function taskKey(language, output){ return `${language}:${output}`; }

function taskMeta(style,output){
  const level=productionLevel(style);
  return {
    qualityTier:level.key,qualityLabel:level.label,lookLabel:level.look,scope:level.scope,
    targetDurationSeconds:['audio','video'].includes(output)?level.durationSeconds:null
  };
}
function postProcess(output,targetDurationSeconds){
  if(output!=='video')return undefined;
  return {providerCleanup:'ending-only',strategy:'freeze-last-clean-frame',preserveVisualStyle:true,preserveDuration:true,defaultEndingSeconds:2,targetDurationSeconds};
}
function taskUrl(client,language,output,style){
  return output==='website'?`/presentaciones/${client}/presentacion?lang=${language}&look=${styleKey(style)}`:null;
}
function isLanguageReady(language,readiness){ return language==='es'||readiness?.[language]!==false; }
function hasText(value){ return typeof value==='string'&&value.trim().length>0; }
export function languageReadiness(data,languages=data?.languages||['es']){
  const result={};
  for(const language of languages){
    if(language==='es'){result.es=true;continue;}
    const content=data?.translations?.[language],blocks=Array.isArray(content?.skeleton)?content.skeleton.filter(item=>item?.enabled!==false):[];
    result[language]=Boolean(content&&hasText(content.hero?.title)&&hasText(content.hero?.summary)&&hasText(content.objective)&&blocks.length&&blocks.every(item=>hasText(item.title)&&hasText(item.message))&&hasText(content.closing?.title)&&hasText(content.closing?.action));
  }
  return result;
}
function createTask({client,language,output,style,status,url,now}){
  const meta=taskMeta(style,output);
  return {
    id:taskKey(language,output),language,languageLabel:LANGUAGE_LABELS[language]||language.toUpperCase(),output,label:OUTPUT_LABELS[output]||output,
    status,url:url===undefined?taskUrl(client,language,output,style):url,attempts:0,...meta,
    postProcess:postProcess(output,meta.targetDurationSeconds),updatedAt:now
  };
}
function applyBuiltInInventory(job){
  const inventory=BUILT_IN_INVENTORY[job.client]; if(!inventory)return job;
  job.languages=[...new Set([...(job.languages||[]),...inventory.languages])];
  for(const [id,update] of Object.entries(inventory.tasks)){
    const [language,output]=id.split(':');
    if(!(job.requested||[]).includes(output))continue;
    if(!job.tasks[id])job.tasks[id]=createTask({client:job.client,language,output,style:job.presentationStyle,status:'queued',url:null,now:job.updatedAt||job.createdAt||new Date().toISOString()});
    Object.assign(job.tasks[id],update,{id,language,languageLabel:LANGUAGE_LABELS[language],output,label:OUTPUT_LABELS[output],qualityTier:'legacy',qualityLabel:'Existente',lookLabel:'NotebookLM original'});
  }
  return job;
}

export function productionLevelBrief(style){
  const level=productionLevel(style);
  return `\nNIVEL DE ACABADO · ${level.label.toUpperCase()} / ${level.look.toUpperCase()}\n- Alcance: ${level.scope}.\n- Duración objetivo de audio y vídeo: ${level.durationSeconds/60} minuto${level.durationSeconds===60?'':'s'} por idioma.\n- PDF, PowerPoint, documento e infografía deben conservar el mismo nivel de profundidad y acabado.\n- Producir y registrar un archivo independiente para cada idioma solicitado; nunca reutilizar un archivo de otro idioma.\n`;
}

export function buildGeneration({client,displayName,outputs,languages,presentationStyle='movie',mood=null,sourceText='',languageReadiness={}}){
  const now=new Date().toISOString(),style=styleKey(presentationStyle),tasks={};
  for(const language of languages){
    const languageReady=isLanguageReady(language,languageReadiness);
    for(const output of outputs){
      const status=!languageReady?'waiting':output==='website'?'ready':'queued';
      const task=createTask({client,language,output,style,status,url:languageReady?undefined:null,now});
      if(!languageReady)task.error='Traducción pendiente';
      tasks[task.id]=task;
    }
  }
  return recomputeGeneration({
    schemaVersion:3,id:crypto.randomUUID(),client,displayName,requested:outputs,languages,presentationStyle:style,productionLevel:productionLevel(style),mood,tasks,
    artifacts:{},sourceText,provider:'notebooklm',createdAt:now,updatedAt:now
  });
}

export function normalizeGeneration(job){
  if(!job||typeof job!=='object')return job;
  const inventory=BUILT_IN_INVENTORY[job.client];
  const languages=Array.isArray(job.languages)&&job.languages.length?job.languages:inventory?.languages||['es'];
  const outputs=Array.isArray(job.requested)&&job.requested.length?job.requested:Object.keys(job.artifacts||{});
  const style=styleKey(job.presentationStyle||'classic');
  const now=job.updatedAt||job.createdAt||new Date().toISOString();
  const tasks={};
  if(job.tasks&&typeof job.tasks==='object'){
    for(const [id,old] of Object.entries(job.tasks)){
      if(!old||typeof old!=='object')continue;
      const language=old.language||id.split(':')[0],output=old.output||id.split(':')[1];
      const task=createTask({client:job.client,language,output,style,status:VALID_STATUSES.has(old.status)?old.status:'queued',url:old.url,now:old.updatedAt||now});
      tasks[id]={...task,...old,...taskMeta(style,output),postProcess:old.postProcess||task.postProcess};
    }
  }else{
    for(const language of languages){
      for(const output of outputs){
        const old=job.artifacts?.[output]||{};
        const useLegacy=language===languages[0]||output==='website';
        const status=useLegacy&&VALID_STATUSES.has(old.status)?old.status:output==='website'?'ready':'queued';
        const url=useLegacy?old.url:null;
        const task=createTask({client:job.client,language,output,style,status,url,now:old.updatedAt||now}); tasks[task.id]=task;
      }
    }
  }
  const normalized={...job,schemaVersion:3,languages,requested:outputs,presentationStyle:style,productionLevel:productionLevel(style),tasks};
  applyBuiltInInventory(normalized);
  return recomputeGeneration(normalized);
}

export function recomputeGeneration(job){
  const now=new Date().toISOString(),tasks=Object.values(job.tasks||{}),artifacts={};
  for(const output of job.requested||[]){
    const variants=tasks.filter(task=>task.output===output);
    const built=variants.filter(task=>task.url&&['ready','published','complete'].includes(task.status));
    const published=built.find(task=>task.status==='published'),ready=built[0];
    const processing=variants.some(task=>task.status==='processing'),waiting=variants.some(task=>task.status==='waiting');
    const allFailed=variants.length&&variants.every(task=>['failed','skipped'].includes(task.status));
    const allBuilt=variants.length&&variants.every(task=>task.status==='skipped'||(task.url&&['ready','published','complete'].includes(task.status)));
    const status=published?'published':ready?'ready':processing?'processing':waiting?'waiting':allFailed?'failed':allBuilt?'complete':'queued';
    const available=published||ready;
    artifacts[output]={
      label:OUTPUT_LABELS[output]||output,status,url:available?.url||null,language:available?.language||null,variants:variants.map(task=>task.id),
      ready:built.length,total:variants.length,waiting:variants.filter(task=>task.status==='waiting').length,updatedAt:now
    };
  }
  const statuses=tasks.map(task=>task.status),allBuilt=tasks.length&&tasks.every(task=>task.status==='skipped'||(task.url&&['ready','published','complete'].includes(task.status)));
  if(allBuilt)job.status='complete';
  else if(statuses.some(status=>status==='processing'))job.status='processing';
  else if(statuses.length&&statuses.every(status=>['failed','skipped'].includes(status)))job.status='failed';
  else if(statuses.some(status=>status==='waiting'))job.status='waiting';
  else job.status='queued';
  job.artifacts=artifacts; job.updatedAt=now; return job;
}

export function publicGeneration(job){
  if(!job)return null;
  const {sourceText,provider,...safe}=job; return safe;
}
