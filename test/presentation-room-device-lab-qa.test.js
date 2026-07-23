import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';
import {
  ROOM_AREAS,
  ROOM_DEVICES,
  applyRoomDeviceReport,
  createRoomDeviceLab
} from '../functions/presentaciones/_room-device-lab.js';
import {onRequest as roomDeviceApi} from '../functions/presentaciones/[client]/api/room-device-lab.js';
import {onRequestGet as renderPresentation} from '../functions/presentaciones/[client]/presentacion.js';

const NOW='2026-07-23T20:00:00.000Z';
const SHA='0123456789abcdef'.repeat(4);

function lab(features=['video','animation','css-layout','custom-fonts']){
  return createRoomDeviceLab({features,now:NOW});
}

function measurement(overrides={}){
  return {
    kind:'measurement',device:'projector',area:'legibility',status:'passed_with_differences',
    adapter:'room-runner',adapterVersion:'3.0.0',environment:'Sala A · proyector 1080p',
    artifactSha256:SHA,evidenceUrl:'https://evidence.example/rooms/a/legibility.json',
    executedAt:'2026-07-23T19:55:00.000Z',checkedAt:NOW,
    metrics:{minContrast:4.8,minFontPx:28,viewingDistanceM:12,pass:true},
    finding:'Legible salvo texto auxiliar.',fallback:'Usar PDF de alto contraste.',
    ...overrides
  };
}

function kv(values){
  return {
    async get(key,options){const value=values[key];return options?.type==='json'?value:JSON.stringify(value)},
    async put(key,value){values[key]=JSON.parse(value)}
  };
}

const ideas={
  hero:{title:'Propuesta',summary:'Resumen'},objective:'Objetivo',
  skeleton:[{id:'uno',title:'Idea',message:'Mensaje',detail:'Detalle',enabled:true}],
  closing:{title:'Cierre',action:'Acción'},labels:{objective:'Objetivo',next:'Siguiente'},notes:'Privado'
};

test('QA sala: matriz 4×4 honesta, completa y determinista',()=>{
  const first=lab();
  const second=lab(['custom-fonts','css-layout','animation','video','video']);
  assert.deepEqual(second,first);
  assert.deepEqual(first.devices,ROOM_DEVICES);
  assert.deepEqual(first.areas,ROOM_AREAS);
  assert.equal(Object.keys(first.results).length,16);
  for(const device of ROOM_DEVICES)for(const area of ROOM_AREAS){
    const entry=first.results[`${device}:${area}`];
    assert.equal(entry.device,device);
    assert.equal(entry.area,area);
    assert.match(entry.fallback,/\S/);
    assert.equal(entry.evidence,undefined);
    assert.equal(entry.metrics,undefined);
  }
  assert.deepEqual(first.summary,{total:16,measured:0,capability:0,inferred:8,unavailable:8,failed:0});
  assert.match(first.results['mobile:performance'].note,/no demuestra una prueba/);
  assert.match(first.results['videowall:legibility'].note,/no se afirma/);
});

test('QA sala: capability nunca asciende a measured ni se extrapola a otro perfil',()=>{
  const original=lab();
  const updated=applyRoomDeviceReport(original,{
    kind:'capability',device:'mobile',area:'codecs',source:'browser-api',
    capabilities:['h264-probably','vp9-maybe','av1-no'],checkedAt:NOW,
    finding:'Capacidades declaradas por canPlayType.',fallback:'Servir H.264 con póster.'
  },NOW);
  assert.equal(updated.results['mobile:codecs'].level,'capability');
  assert.equal(updated.results['mobile:codecs'].evidence,undefined);
  assert.equal(updated.results['mobile:codecs'].metrics,undefined);
  assert.equal(updated.results['laptop:codecs'].level,'inferred');
  assert.equal(updated.results['projector:codecs'].level,'unavailable');
  assert.equal(updated.summary.measured,0);
  assert.equal(updated.summary.capability,1);
  assert.equal(original.results['mobile:codecs'].level,'inferred','la entrada no se muta');

  for(const capabilities of [
    [],
    ['duplicada','duplicada'],
    ['<script>'],
    Array.from({length:31},(_,index)=>`cap-${index}`)
  ]) assert.throws(()=>applyRoomDeviceReport(original,{
    kind:'capability',device:'mobile',area:'codecs',source:'browser-api',capabilities,checkedAt:NOW
  },NOW),/Sala:/);
});

test('QA sala: una medición completa sólo modifica su combinación y descarta extras privados',()=>{
  const original=lab();
  const updated=applyRoomDeviceReport(original,measurement({
    token:'secret-token',rawLog:'private log',roomPhoto:'data:image/png;base64,private',
    metrics:{minContrast:4.8,minFontPx:28,viewingDistanceM:12,pass:true,privateMetric:'secret'}
  }),NOW);
  const result=updated.results['projector:legibility'];
  assert.equal(result.level,'measured');
  assert.equal(result.status,'passed_with_differences');
  assert.deepEqual(result.metrics,{minContrast:4.8,minFontPx:28,viewingDistanceM:12,pass:true});
  assert.equal(result.evidence.artifactSha256,SHA);
  assert.equal(updated.results['projector:performance'].level,'unavailable');
  assert.equal(updated.results['mobile:legibility'].level,'inferred');
  assert.equal(updated.summary.measured,1);
  assert.doesNotMatch(JSON.stringify(updated),/secret-token|private log|base64,private|privateMetric/);
});

test('QA sala: evidencias y formatos maliciosos o privados fallan cerrado',()=>{
  const current=lab();
  for(const evidenceUrl of [
    'http://evidence.example/proof.json',
    'file:///Users/carlos/proof.json',
    'https://user:pass@evidence.example/proof.json',
    'https://evidence.example/proof.json?token=secret',
    'https://localhost/proof.json',
    'https://runner.local/proof.json',
    'https://room.internal/proof.json',
    'https://10.0.0.8/proof.json',
    'https://127.0.0.1/proof.json',
    'https://169.254.1.1/proof.json',
    'https://172.20.0.1/proof.json',
    'https://192.168.1.1/proof.json',
    'https://[::1]/proof.json'
  ]) assert.throws(()=>applyRoomDeviceReport(current,measurement({evidenceUrl}),NOW),/medición real requiere/);
  for(const patch of [
    {device:'tablet'},
    {area:'brightness'},
    {status:'analysis_only'},
    {adapter:''},
    {adapterVersion:''},
    {environment:''},
    {artifactSha256:'short'},
    {executedAt:'invalid'},
    {checkedAt:'invalid'},
    {metrics:{rawLog:'secret'}}
  ]) assert.throws(()=>applyRoomDeviceReport(current,measurement(patch),NOW),/Sala:/);
});

test('QA sala: probe local agrega codecs/autoplay/rendimiento/legibilidad sin afirmar medición',async()=>{
  const source=await readFile(new URL('../assets/presentation-room-device-lab.js',import.meta.url),'utf8');
  const context=vm.createContext({});
  vm.runInContext(source,context);
  const api=context.AdmiraRoomDeviceLab;
  const makeProbe=width=>api.probe({
    window:{innerWidth:width,devicePixelRatio:3,matchMedia:()=>({matches:true}),screen:{width:9999}},
    document:{createElement:()=>({canPlayType:type=>type.includes('avc1')?'probably':type.includes('vp9')?'maybe':''})},
    navigator:{deviceMemory:4,hardwareConcurrency:8,userActivation:{isActive:false},userAgent:'private-agent',connection:{downlink:123}}
  });
  const mobile=makeProbe(390),laptop=makeProbe(1440);
  assert.equal(mobile.level,'capability');
  assert.equal(mobile.device,'mobile');
  assert.equal(laptop.device,'laptop');
  assert.deepEqual(JSON.parse(JSON.stringify(mobile.codecs)),{h264:'probably',vp9:'maybe',av1:'no'});
  assert.deepEqual(JSON.parse(JSON.stringify(mobile.autoplay)),{requiresGesture:true,userActivation:false});
  assert.equal(mobile.performance.memory,'medium');
  assert.equal(mobile.performance.cores,'high');
  assert.equal(mobile.performance.reducedMotion,true);
  assert.equal(mobile.legibility.viewport,'compact');
  assert.doesNotMatch(JSON.stringify(mobile),/private-agent|9999|123|390/);
  assert.match(api.checklistStatus(lab(),mobile),/no es una medición/);
  assert.deepEqual(JSON.parse(JSON.stringify(api.probe({}))),{
    schemaVersion:1,level:'unavailable',device:null,
    reason:'El entorno no expone viewport, document y navigator suficientes; no se infiere un dispositivo.',
    privacy:'Sin sondeo, red, almacenamiento ni envío.'
  });
  assert.doesNotMatch(source,/\bfetch\s*\(|XMLHttpRequest|WebSocket|EventSource|localStorage|sessionStorage|indexedDB|userAgent|connection/i);
});

test('QA sala: API mide el body real aunque falte Content-Length',async()=>{
  const roomDeviceLab=lab();
  const values={'presentation:demo':{displayName:'Demo',roomDeviceLab}};
  const oversized=JSON.stringify({
    kind:'unavailable',device:'projector',area:'codecs',reason:'x'.repeat(70*1024),fallback:'PDF'
  });
  const response=await roomDeviceApi({
    params:{client:'demo'},env:{PRESENTATION_IDEAS:kv(values)},
    request:new Request('https://admiranext.test/presentaciones/demo/api/room-device-lab',{
      method:'PUT',headers:{origin:'https://admiranext.test','content-type':'application/json'},body:oversized
    })
  });
  assert.equal(response.status,413);
  assert.match(await response.text(),/demasiado grande/);
});

test('QA sala: matriz, probe y evidencia quedan fuera de audience',async()=>{
  const roomDeviceLab=applyRoomDeviceReport(lab(),measurement({
    evidenceUrl:'https://evidence.example/room.json#</script><script>window.pwned=1</script>'
  }),NOW);
  const config={displayName:'Demo',outputs:['website'],languages:['es'],theme:{},sequence:{},roomDeviceLab};
  const env={PRESENTATION_IDEAS:kv({'presentation:demo':config,'ideas:demo':ideas})};

  const stage=await renderPresentation({
    params:{client:'demo'},request:new Request('https://admiranext.test/presentaciones/demo/presentacion'),
    env,next(){throw new Error('unexpected next')}
  });
  const stageHtml=await stage.text();
  assert.match(stageHtml,/__ADMIRA_ROOM_DEVICE_LAB__/);
  assert.match(stageHtml,/presentation-room-device-lab\.js/);
  assert.match(stageHtml,/%3C\/script%3E%3Cscript%3Ewindow\.pwned=1%3C\/script%3E/);
  assert.doesNotMatch(stageHtml,/<\/script><script>window\.pwned=1/);

  const audience=await renderPresentation({
    params:{client:'demo'},request:new Request('https://admiranext.test/presentaciones/demo/presentacion?audience=1'),
    env,next(){throw new Error('unexpected next')}
  });
  const audienceHtml=await audience.text();
  assert.doesNotMatch(audienceHtml,/__ADMIRA_ROOM_DEVICE_LAB__|presentation-room-device-lab|room-runner|artifactSha256|evidence\.example|window\.pwned/);
});
