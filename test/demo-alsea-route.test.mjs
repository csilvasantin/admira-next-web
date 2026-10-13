import test from 'node:test';
import assert from 'node:assert/strict';
import {onRequestGet} from '../functions/pruebas/alsea/index.js';
import {normalizeStructureInput, admiranextBlueprint} from '../functions/presentaciones/_admiranext-structure.js';
import {normalizarDemoProject,documentacionDemos} from '../subdemos/presentacion.mjs';

test('Alsea reuses the generator room, preserving language without passing credentials', async () => {
  for (const lang of ['es','en','invalid']) {
    const reads=[];
    const response=await onRequestGet({request:new Request('https://www.admiranext.com/pruebas/alsea/?lang='+lang+'&token=do-not-copy'), env:{PRESENTATION_IDEAS:{get:async key=>{reads.push(key);return {slug:'alsea-starbucks'};}}}});
    assert.equal(response.status,302);
    const target=new URL(response.headers.get('location'));
    assert.equal(target.pathname,'/presentaciones/alsea-starbucks/presentacion');
    assert.equal(target.searchParams.get('lang'),lang==='en'?'en':'es');
    assert.equal(target.searchParams.has('token'),false);
    assert.deepEqual(reads,['presentation:alsea-starbucks']);
    assert.match(response.headers.get('cache-control'),/private, no-store/);
  }
});

test('missing presentation and missing storage are reported without generating or starting a demo', async () => {
  const request=new Request('https://www.admiranext.com/pruebas/alsea/');
  assert.equal((await onRequestGet({request,env:{}})).status,503);
  const response=await onRequestGet({request,env:{PRESENTATION_IDEAS:{get:async()=>null}}});
  assert.equal(response.status,404);
  assert.match(await response.text(),/aún no está guardada/);
  assert.equal(response.headers.has('location'),false);
});

test('Alsea brief covers five 15-minute platforms and preserves the default three-act template', () => {
  const platforms=['studio','store','tv','app','biz'];
  const brief={displayName:'Example',slides:platforms.map(act=>({code:act+'-chapter',act,title:act,message:'Example',duration:15})),demoProject:{id:'example',demos:['studio/voz','store/tpv','tv/plataforma','app/establecimientos','biz/proyecto'],contexto:{marca:'example'}}};
  const structure=normalizeStructureInput(brief);
  const project=normalizarDemoProject(brief.demoProject,brief);
  assert.equal(project.documentacion.length,5);
  assert.deepEqual([...new Set(project.documentacion.map(s=>s.clave.split('/')[0]))].sort(),['app','biz','store','studio','tv']);
  assert.ok(documentacionDemos(project).some(s=>s.clave==='tv/plataforma'));
  const core=structure.slides.filter(s=>!['opening','closing'].includes(s.code));
  assert.deepEqual([...new Set(core.map(s=>s.act))],['studio','store','tv','app','biz']);
  for (const act of ['studio','store','tv','app','biz']) assert.equal(core.filter(s=>s.act===act).reduce((sum,s)=>sum+s.duration,0),15);
  assert.equal(structure.slides.reduce((sum,s)=>sum+s.duration,0),75);
  assert.equal(admiranextBlueprint('Alsea').length,12);
  assert.deepEqual([...new Set(admiranextBlueprint('Alsea').map(s=>s.act))],['studio','store','app']);
});
