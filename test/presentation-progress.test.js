import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {buildGeneration, normalizeGeneration, recomputeGeneration, updateTaskStatus} from '../functions/presentaciones/_generation.js';
import {buildImageSet, publicImageSet, recomputeImageSet} from '../functions/presentaciones/_grok-images.js';
import {onRequest as handleProduction} from '../functions/presentaciones/api/production.js';

const t0='2026-07-19T10:00:00.000Z',t1='2026-07-19T10:01:00.000Z',t2='2026-07-19T10:02:00.000Z',t3='2026-07-19T10:08:00.000Z';

function kv(values){
  return {
    async get(key,options){const value=values.get(key);return options?.type==='json'&&value?JSON.parse(value):value||null},
    async put(key,value){values.set(key,value)}
  };
}

test('NotebookLM tasks preserve sent, progress, activity and completion milestones',()=>{
  const job=buildGeneration({client:'demo',displayName:'Demo',outputs:['audio','video'],languages:['es']});
  for(const task of Object.values(job.tasks)){task.requestedAt=t0;task.updatedAt=t0}
  const audio=job.tasks['es:audio'],video=job.tasks['es:video'];
  updateTaskStatus(audio,'processing',t1);audio.submittedAt=t2;audio.progress=55;audio.stage='NotebookLM sigue procesando';audio.updatedAt=t2;
  recomputeGeneration(job);
  assert.equal(job.artifacts.audio.progress,55);
  assert.equal(job.artifacts.audio.submittedAt,t2);
  assert.equal(job.lastActivityAt,t2);
  updateTaskStatus(audio,'published',t3);
  updateTaskStatus(video,'failed',t3);video.error='Tiempo agotado';
  recomputeGeneration(job);
  assert.equal(job.progress,100);
  assert.equal(job.status,'failed');
  assert.equal(job.artifacts.audio.completedAt,t3);
  assert.equal(job.artifacts.video.failedAt,t3);
});

test('normalization does not invent a third-party submission time',()=>{
  const job=buildGeneration({client:'demo',displayName:'Demo',outputs:['audio'],languages:['es']});
  const task=job.tasks['es:audio'];task.status='processing';task.startedAt=t1;task.updatedAt=t1;delete task.submittedAt;
  normalizeGeneration(job);
  assert.equal(task.submittedAt,undefined);
  assert.equal(task.progress,5);
});

test('background images are recorded as an auxiliary Grok order, not duplicated per language',()=>{
  const job=buildGeneration({client:'demo',displayName:'Demo',outputs:['website','audio','backgrounds'],languages:['es','ca']});
  assert.deepEqual(job.requested,['website','audio']);
  assert.equal(Object.values(job.tasks).some(task=>task.output==='backgrounds'),false);
  assert.deepEqual(Object.keys(job.tasks).sort(),['ca:audio','ca:website','es:audio','es:website']);
});

test('Grok aggregates slide phases into observable package progress',async()=>{
  const presentation={displayName:'Demo',updatedAt:t0,theme:{}};
  const ideas={displayName:'Demo',updatedAt:t0,hero:{title:'Demo',summary:'Resumen'},objective:'Decidir',skeleton:[],closing:{title:'Cierre',action:'Acción'}};
  const set=await buildImageSet({client:'demo',presentation,ideas,now:t0});
  assert.equal(set.progress,0);assert.equal(set.requestedAt,t0);
  set.slides[0].status='processing';set.slides[0].progress=72;set.slides[0].stage='Verificando texto';set.slides[0].startedAt=t1;set.slides[0].updatedAt=t2;
  recomputeImageSet(set,t2);
  assert.equal(set.progress,24);
  assert.equal(set.startedAt,t1);
  assert.equal(set.lastActivityAt,t2);
  assert.equal(set.stage,'Verificando texto');
  const safe=publicImageSet(set);
  assert.equal(safe.slides[0].progress,72);
  assert.equal(safe.slides[0].startedAt,t1);
  assert.equal(safe.slides[0].stage,'Verificando texto');
});

test('the production API accepts phase progress and the real NotebookLM submission time',async()=>{
  const job=buildGeneration({client:'demo',displayName:'Demo',outputs:['audio'],languages:['es']});
  const values=new Map([['generation:demo',JSON.stringify(job)]]),env={PRESENTATION_WORKER_TOKEN:'worker-secret',PRESENTATION_IDEAS:kv(values)};
  const claim=new Request('https://admiranext.test/presentaciones/api/production',{method:'POST',headers:{authorization:'Bearer worker-secret','content-type':'application/json'},body:JSON.stringify({action:'claim',client:'demo',id:job.id,tasks:['es:audio'],worker:'test-worker'})});
  assert.equal((await handleProduction({request:claim,env})).status,200);
  const update=new Request('https://admiranext.test/presentaciones/api/production',{method:'POST',headers:{authorization:'Bearer worker-secret','content-type':'application/json'},body:JSON.stringify({action:'update',client:'demo',id:job.id,tasks:{'es:audio':{status:'processing',stage:'Procesando audio',progress:61,submittedAt:t2}}})});
  const response=await handleProduction({request:update,env}),body=await response.json();
  assert.equal(response.status,200);
  assert.equal(body.job.tasks['es:audio'].progress,61);
  assert.equal(body.job.tasks['es:audio'].submittedAt,t2);
  assert.equal(body.job.tasks['es:audio'].stage,'Procesando audio');
});

test('generator and editor expose progress bars, timelines and interruption recovery',async()=>{
  const [generator,editor,middleware]=await Promise.all([
    readFile(new URL('../assets/presentation-generator-20260721-10.js',import.meta.url),'utf8'),
    readFile(new URL('../assets/presentation-ideas-editor.js',import.meta.url),'utf8'),
    readFile(new URL('../functions/presentaciones/_middleware.js',import.meta.url),'utf8')
  ]);
  for(const source of [generator,editor]){
    assert.match(source,/progress-track/);
    assert.match(source,/Última actividad/);
    assert.match(source,/Finalizado/);
    assert.match(source,/Sin actividad durante más de 10 min/);
  }
  assert.match(generator,/data-resume-images/);
  assert.match(generator,/Continuar imágenes con Grok/);
  assert.match(generator,/body\.outputs\.includes\('backgrounds'\).*runImageGeneration\(false\)/s);
  assert.match(generator,/Imágenes de fondo/);
  assert.match(generator,/Presentación lista:/);
  assert.match(generator,/La presentación sigue lista sin los fondos pendientes/);
  assert.match(generator,/imageMessage/);
  assert.match(generator,/data-image-slide/);
  assert.match(generator,/addEventListener\('dragover'/);
  assert.match(generator,/addEventListener\('drop'/);
  assert.match(generator,/new FormData\(\)/);
  assert.match(generator,/todos los idiomas y versiones/);
  assert.match(generator,/NO contiene texto, números, logos/);
  assert.match(middleware,/if \(isFormPost && !isGeneratorApi\)/);
  assert.match(editor,/value="backgrounds"/);
});
