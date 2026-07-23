import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {COMPATIBILITY_TARGETS,applyCompatibilityReport,createCompatibilityLab} from '../functions/presentaciones/_compatibility-lab.js';
import {onRequest as compatibilityApi} from '../functions/presentaciones/[client]/api/compatibility.js';

const NOW='2026-07-24T10:00:00.000Z';
const DIGEST='a'.repeat(64);

function makeLab(){
  return createCompatibilityLab({
    decks:[{id:'proposal:demo',label:'Demo'},{id:'library:intro',label:'Intro'}],
    requestedOutputs:['website','powerpoint','pdf'],
    features:['css-layout','interactive-controls','custom-fonts','video'],
    now:NOW
  });
}
function kv(values){
  return {
    async get(key,options){const value=values.get(key);return options?.type==='json'&&value?JSON.parse(value):value||null},
    async put(key,value){values.set(key,value)}
  };
}

test('creates one deterministic PowerPoint, Keynote, Google Slides, PDF and web matrix per deck',()=>{
  const lab=makeLab();
  assert.deepEqual(lab.targets,COMPATIBILITY_TARGETS);
  assert.equal(Object.keys(lab.results).length,10);
  for(const deck of lab.decks)for(const target of COMPATIBILITY_TARGETS)assert.ok(lab.results[`${deck.id}:${target}`]);
  assert.equal(lab.results['proposal:demo:powerpoint'].level,'structural');
  assert.equal(lab.results['proposal:demo:keynote'].level,'structural');
  assert.equal(lab.results['proposal:demo:google-slides'].level,'structural');
  assert.equal(lab.results['proposal:demo:pdf'].level,'structural');
  assert.equal(lab.results['proposal:demo:web'].level,'structural');
  assert.match(lab.results['proposal:demo:keynote'].note,/no demuestra que la aplicación destino se haya ejecutado/);
});

test('distinguishes unavailable targets when no exchange artifact was requested',()=>{
  const lab=createCompatibilityLab({decks:['proposal:demo'],requestedOutputs:['website'],features:['css-layout'],now:NOW});
  assert.equal(lab.results['proposal:demo:web'].level,'structural');
  for(const target of ['powerpoint','keynote','google-slides','pdf']){
    assert.equal(lab.results[`proposal:demo:${target}`].level,'unavailable');
    assert.match(lab.results[`proposal:demo:${target}`].fallback,/\S/);
  }
  assert.deepEqual(lab.summary,{total:5,executed:0,structural:1,unavailable:4,failed:0,differences:0});
});

test('promotes only a complete adapter report to executed and preserves actionable differences',()=>{
  const lab=makeLab();
  const updated=applyCompatibilityReport(lab,{
    kind:'execution',deckId:'proposal:demo',target:'powerpoint',status:'passed_with_differences',
    adapter:'powerpoint-win',adapterVersion:'1.4.0',artifactSha256:DIGEST,
    evidenceUrl:'https://evidence.example/compat/ppt.json',environment:'PowerPoint 2026 · Windows 11',
    executedAt:'2026-07-24T09:58:00.000Z',checkedAt:NOW,
    differences:[{severity:'warning',area:'fonts',detail:'Fallback font used',fallback:'Embed the approved font'}]
  },NOW);
  const result=updated.results['proposal:demo:powerpoint'];
  assert.equal(result.level,'executed');
  assert.equal(result.status,'passed_with_differences');
  assert.equal(result.execution.artifactSha256,DIGEST);
  assert.equal(result.differences[0].fallback,'Embed the approved font');
  assert.match(result.note,/Ejecución declarada por el adaptador/);
  assert.equal(lab.results['proposal:demo:powerpoint'].level,'structural','the update is reversible and does not mutate the previous value');
});

test('fails closed on fake execution evidence, unknown targets, future dates and unsafe URLs',()=>{
  const lab=makeLab(),base={
    kind:'execution',deckId:'proposal:demo',target:'powerpoint',status:'passed',
    adapter:'ppt',adapterVersion:'1',artifactSha256:DIGEST,
    evidenceUrl:'https://evidence.example/proof.json',environment:'PowerPoint',
    executedAt:'2026-07-24T09:58:00.000Z',checkedAt:NOW,differences:[]
  };
  assert.throws(()=>applyCompatibilityReport(lab,{...base,target:'libreoffice'},NOW),/destino desconocido/);
  assert.throws(()=>applyCompatibilityReport(lab,{...base,artifactSha256:'short'},NOW),/ejecución real requiere/);
  assert.throws(()=>applyCompatibilityReport(lab,{...base,evidenceUrl:'https://evidence.example/proof?token=secret'},NOW),/ejecución real requiere/);
  for(const evidenceUrl of [
    'https://localhost/proof.json','https://127.0.0.1/proof.json','https://10.0.0.4/proof.json',
    'https://192.168.1.4/proof.json','https://172.16.0.4/proof.json','https://[::1]/proof.json',
    'https://runner.internal/proof.json'
  ])assert.throws(()=>applyCompatibilityReport(lab,{...base,evidenceUrl},NOW),/ejecución real requiere/);
  assert.throws(()=>applyCompatibilityReport(lab,{...base,executedAt:'2026-07-24T11:00:00.000Z'},NOW),/posterior a la comprobación/);
});

test('records real unavailability without pretending an application ran',()=>{
  const updated=applyCompatibilityReport(makeLab(),{
    kind:'unavailable',deckId:'proposal:demo',target:'keynote',checkedAt:NOW,
    reason:'Keynote no está instalado en el runner asignado.',
    fallback:'Verificar PPTX en PowerPoint y entregar PDF para fidelidad visual.'
  },NOW);
  const result=updated.results['proposal:demo:keynote'];
  assert.equal(result.level,'unavailable');
  assert.equal(result.status,'not_available');
  assert.equal(result.execution,undefined);
  assert.match(result.fallback,/PDF/);
});

test('private API persists bounded reports and never accepts cross-origin writes',async()=>{
  const presentation={displayName:'Demo',languages:['es'],outputs:['website','powerpoint','pdf'],compatibilityLab:makeLab()};
  const values=new Map([
    ['presentation:demo',JSON.stringify(presentation)],
    ['ideas:demo',JSON.stringify({hero:{},skeleton:[],updatedAt:NOW})]
  ]);
  const env={PRESENTATION_IDEAS:kv(values)};
  const report={
    kind:'unavailable',deckId:'proposal:demo',target:'keynote',checkedAt:new Date().toISOString(),
    reason:'Runner sin Keynote',fallback:'Usar PowerPoint y PDF.'
  };
  const denied=await compatibilityApi({
    request:new Request('https://admiranext.test/presentaciones/demo/api/compatibility',{method:'PUT',headers:{origin:'https://evil.example','content-type':'application/json'},body:JSON.stringify(report)}),
    params:{client:'demo'},env
  });
  assert.equal(denied.status,403);
  const response=await compatibilityApi({
    request:new Request('https://admiranext.test/presentaciones/demo/api/compatibility',{method:'PUT',headers:{origin:'https://admiranext.test','content-type':'application/json'},body:JSON.stringify(report)}),
    params:{client:'demo'},env
  });
  assert.equal(response.status,200);
  const stored=JSON.parse(values.get('presentation:demo'));
  assert.equal(stored.compatibilityLab.results['proposal:demo:keynote'].level,'unavailable');
});

test('generator and presenter integrate the lab privately with an honest preflight report',async()=>{
  const [generator,presentation,presenter,middleware]=await Promise.all([
    readFile(new URL('../functions/presentaciones/api/generate.js',import.meta.url),'utf8'),
    readFile(new URL('../functions/presentaciones/[client]/presentacion.js',import.meta.url),'utf8'),
    readFile(new URL('../assets/presentation-presenter-mode.js',import.meta.url),'utf8'),
    readFile(new URL('../functions/presentaciones/_middleware.js',import.meta.url),'utf8')
  ]);
  assert.match(generator,/createCompatibilityLab/);
  assert.match(generator,/compatibilityUrl/);
  assert.match(presentation,/audienceMode\?'':`<script>window\.__ADMIRA_PRESENTER_NOTES__/);
  assert.match(presentation,/window\.__ADMIRA_COMPATIBILITY_LAB__/);
  assert.match(presenter,/Compatibilidad parcial:/);
  assert.match(middleware,/isCompatibilityApi/);
});
