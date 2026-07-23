import test from 'node:test';
import assert from 'node:assert/strict';
import {
  COMPATIBILITY_TARGETS,
  applyCompatibilityReport,
  createCompatibilityLab
} from '../functions/presentaciones/_compatibility-lab.js';
import {onRequest as compatibilityApi} from '../functions/presentaciones/[client]/api/compatibility.js';
import {onRequestGet as renderPresentation} from '../functions/presentaciones/[client]/presentacion.js';

const NOW='2026-07-24T08:00:00.000Z';
const SHA='abcdef0123456789'.repeat(4);

function lab(overrides={}){
  return createCompatibilityLab({
    decks:[{id:'proposal:qa',label:'QA deck'}],
    requestedOutputs:['website','powerpoint','pdf'],
    features:['video','custom-fonts','interactive-controls','css-layout','video'],
    now:NOW,
    ...overrides
  });
}

function execution(overrides={}){
  return {
    kind:'execution',deckId:'proposal:qa',target:'powerpoint',
    status:'passed_with_differences',adapter:'powerpoint-win',adapterVersion:'2.1.0',
    artifactSha256:SHA,evidenceUrl:'https://evidence.example/qa/powerpoint.json',
    environment:'PowerPoint 2026 · Windows 11',
    executedAt:'2026-07-24T07:55:00.000Z',checkedAt:NOW,
    differences:[{severity:'warning',area:'fonts',detail:'Fuente sustituida',fallback:'Incrustar la familia autorizada'}],
    ...overrides
  };
}

function kv(values){
  return {async get(key,options){const value=values[key];return options?.type==='json'?value:JSON.stringify(value)}};
}

const ideas={
  hero:{title:'Propuesta',summary:'Resumen'},objective:'Objetivo',
  skeleton:[{id:'uno',title:'Idea',message:'Mensaje',detail:'Detalle',enabled:true}],
  closing:{title:'Cierre',action:'Acción'},labels:{objective:'Objetivo',next:'Siguiente'},notes:'Privado'
};

test('QA compatibilidad: crea las cinco superficies sin confundir análisis con ejecución real',()=>{
  const value=lab();
  assert.deepEqual(value.targets,COMPATIBILITY_TARGETS);
  assert.deepEqual(Object.keys(value.results),COMPATIBILITY_TARGETS.map(target=>`proposal:qa:${target}`));
  for(const target of COMPATIBILITY_TARGETS){
    const result=value.results[`proposal:qa:${target}`];
    assert.notEqual(result.level,'executed');
    assert.equal(result.execution,undefined);
    assert.match(result.fallback,/\S/);
  }
  assert.equal(value.summary.executed,0);
  assert.equal(value.summary.structural,5);
  assert.equal(value.summary.unavailable,0);
  assert.match(value.results['proposal:qa:keynote'].note,/no demuestra que la aplicación destino se haya ejecutado/);
});

test('QA compatibilidad: diferencias y fallbacks son deterministas por formato',()=>{
  const first=lab();
  const second=lab({features:['css-layout','video','interactive-controls','custom-fonts']});
  assert.deepEqual(second,first);

  const areas=target=>first.results[`proposal:qa:${target}`].differences.map(item=>item.area);
  assert.deepEqual(areas('powerpoint'),['layout','interaction','fonts']);
  assert.deepEqual(areas('keynote'),['layout','interaction','fonts','media']);
  assert.deepEqual(areas('google-slides'),['layout','interaction','fonts','media']);
  assert.deepEqual(areas('pdf'),['layout','interaction','media']);
  assert.deepEqual(areas('web'),[]);
  for(const result of Object.values(first.results)){
    for(const difference of result.differences){
      assert.equal(difference.severity,'warning');
      assert.match(difference.detail,/\S/);
      assert.match(difference.fallback,/\S/);
    }
  }
});

test('QA compatibilidad: sólo evidencia completa promociona a executed y no persiste extras privados',()=>{
  const original=lab();
  const report=execution({
    token:'secret-token',body:'deck completo privado',notes:'notas del presentador',
    differences:[{
      severity:'warning',area:'fonts',detail:'Fuente sustituida',fallback:'Incrustar fuente',
      screenshot:'data:image/png;base64,private'
    }]
  });
  const updated=applyCompatibilityReport(original,report,NOW);
  const result=updated.results['proposal:qa:powerpoint'];
  assert.equal(result.level,'executed');
  assert.equal(result.status,'passed_with_differences');
  assert.equal(result.execution.artifactSha256,SHA);
  assert.equal(result.differences.length,1);
  assert.doesNotMatch(JSON.stringify(updated),/secret-token|deck completo privado|notas del presentador|base64,private/);
  assert.equal(original.results['proposal:qa:powerpoint'].level,'structural','la aplicación no muta el contrato anterior');

  for(const patch of [
    {status:'analysis_only'},
    {adapter:''},
    {adapterVersion:''},
    {artifactSha256:'abc'},
    {evidenceUrl:'http://evidence.example/proof.json'},
    {evidenceUrl:'https://user:pass@evidence.example/proof.json'},
    {evidenceUrl:'https://evidence.example/proof.json?token=secret'},
    {environment:''},
    {executedAt:'no-date'},
    {checkedAt:'no-date'}
  ]) assert.throws(()=>applyCompatibilityReport(original,execution(patch),NOW),/Compatibilidad:/);
});

test('QA compatibilidad: evidencia local/privada y formatos desconocidos fallan cerrado',()=>{
  const current=lab();
  for(const evidenceUrl of [
    'file:///Users/carlos/proof.json',
    'https://localhost/proof.json',
    'https://worker.local/proof.json',
    'https://runner.internal/proof.json',
    'https://10.0.0.8/proof.json',
    'https://100.64.0.1/proof.json',
    'https://127.0.0.1/proof.json',
    'https://169.254.1.1/proof.json',
    'https://172.31.0.1/proof.json',
    'https://192.168.1.1/proof.json',
    'https://[::1]/proof.json'
  ]) assert.throws(()=>applyCompatibilityReport(current,execution({evidenceUrl}),NOW),/ejecución real requiere/);
  assert.throws(()=>applyCompatibilityReport(current,execution({target:'odp'}),NOW),/destino desconocido/);
  assert.throws(()=>applyCompatibilityReport(current,execution({
    differences:Array.from({length:51},()=>({severity:'info',area:'layout',detail:'d',fallback:'f'}))
  }),NOW),/hasta 50 diferencias/);
  assert.throws(()=>applyCompatibilityReport(current,execution({
    differences:[{severity:'critical',area:'layout',detail:'d',fallback:'f'}]
  }),NOW),/Diferencia 1/);
});

test('QA compatibilidad: el límite real del body se aplica aunque falte Content-Length',async()=>{
  const presentation={displayName:'Demo',compatibilityLab:lab()};
  const store=new Map([['presentation:demo',JSON.stringify(presentation)]]);
  const env={PRESENTATION_IDEAS:{
    async get(key,options){const value=store.get(key);return options?.type==='json'&&value?JSON.parse(value):value||null},
    async put(key,value){store.set(key,value)}
  }};
  const oversized=JSON.stringify({padding:'x'.repeat(65*1024)});
  const response=await compatibilityApi({
    params:{client:'demo'},env,
    request:new Request('https://admiranext.test/presentaciones/demo/api/compatibility',{
      method:'PUT',headers:{origin:'https://admiranext.test','content-type':'application/json'},body:oversized
    })
  });
  assert.equal(response.status,413);
  assert.equal(JSON.parse(store.get('presentation:demo')).compatibilityLab.summary.executed,0);
});

test('QA compatibilidad: el contrato y la evidencia quedan fuera de la salida audience',async()=>{
  const compatibilityLab=applyCompatibilityReport(lab(),execution({
    evidenceUrl:'https://evidence.example/qa/proof.json#</script><script>window.pwned=1</script>'
  }),NOW);
  const config={displayName:'Demo',outputs:['website'],languages:['es'],theme:{},sequence:{},compatibilityLab};
  const env={PRESENTATION_IDEAS:kv({'presentation:demo':config,'ideas:demo':ideas})};

  const stage=await renderPresentation({
    params:{client:'demo'},request:new Request('https://admiranext.test/presentaciones/demo/presentacion'),
    env,next(){throw new Error('unexpected next')}
  });
  const stageHtml=await stage.text();
  assert.match(stageHtml,/__ADMIRA_COMPATIBILITY_LAB__/);
  assert.match(stageHtml,/%3C\/script%3E%3Cscript%3Ewindow\.pwned=1%3C\/script%3E/);
  assert.doesNotMatch(stageHtml,/<\/script><script>window\.pwned=1/);

  const audience=await renderPresentation({
    params:{client:'demo'},request:new Request('https://admiranext.test/presentaciones/demo/presentacion?audience=1'),
    env,next(){throw new Error('unexpected next')}
  });
  const audienceHtml=await audience.text();
  assert.doesNotMatch(audienceHtml,/__ADMIRA_COMPATIBILITY_LAB__|powerpoint-win|artifactSha256|evidence\.example|window\.pwned/);
});
