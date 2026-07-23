import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';
import {ROOM_AREAS,ROOM_DEVICES,applyRoomDeviceReport,createRoomDeviceLab} from '../functions/presentaciones/_room-device-lab.js';
import {onRequest as roomDeviceApi} from '../functions/presentaciones/[client]/api/room-device-lab.js';

const NOW='2026-07-23T22:00:00.000Z',DIGEST='b'.repeat(64);
const makeLab=()=>createRoomDeviceLab({features:['video','animation','css-layout'],now:NOW});
function kv(values){return {async get(key,options){const value=values.get(key);return options?.type==='json'&&value?JSON.parse(value):value||null},async put(key,value){values.set(key,value)}}}

test('creates an honest 4x4 matrix for mobile, laptop, projector and videowall',()=>{
  const lab=makeLab();
  assert.deepEqual(lab.devices,ROOM_DEVICES);
  assert.deepEqual(lab.areas,ROOM_AREAS);
  assert.equal(Object.keys(lab.results).length,16);
  for(const device of ['mobile','laptop'])for(const area of ROOM_AREAS){
    const entry=lab.results[`${device}:${area}`];
    assert.equal(entry.level,'inferred');assert.match(entry.note,/no demuestra una prueba/);assert.match(entry.fallback,/\S/);
  }
  for(const device of ['projector','videowall'])for(const area of ROOM_AREAS){
    const entry=lab.results[`${device}:${area}`];
    assert.equal(entry.level,'unavailable');assert.match(entry.note,/no se afirma/);assert.match(entry.fallback,/\S/);
  }
});

test('capability reports never become measurements',()=>{
  const lab=applyRoomDeviceReport(makeLab(),{
    kind:'capability',device:'mobile',area:'codecs',source:'browser-api',
    capabilities:['h264-probably','vp9-maybe'],checkedAt:NOW
  },NOW);
  const entry=lab.results['mobile:codecs'];
  assert.equal(entry.level,'capability');
  assert.equal(entry.status,'capability_detected');
  assert.equal(entry.evidence,undefined);
  assert.match(entry.note,/no afirma reproducción/);
  assert.throws(()=>applyRoomDeviceReport(makeLab(),{
    kind:'capability',device:'mobile',area:'codecs',source:'browser-api',
    capabilities:Array.from({length:31},(_,index)=>`codec-${index}`),checkedAt:NOW
  },NOW),/entre 1 y 30/);
  assert.throws(()=>applyRoomDeviceReport(makeLab(),{
    kind:'capability',device:'mobile',area:'codecs',source:'browser-api',
    capabilities:['h264','h264'],checkedAt:NOW
  },NOW),/no duplicados/);
});

test('measurement requires public evidence and bounded area metrics',()=>{
  const report={
    kind:'measurement',device:'laptop',area:'performance',status:'passed_with_differences',
    adapter:'playwright-room',adapterVersion:'2.1',environment:'Laptop reference · Chromium stable',
    artifactSha256:DIGEST,evidenceUrl:'https://evidence.example/rooms/laptop.json',
    executedAt:'2026-07-23T21:58:00.000Z',checkedAt:NOW,
    metrics:{startupMs:420,fpsP50:58,droppedFrameRate:0.02,privateLog:'secret'},
    finding:'Inicio correcto; caída menor de frames.',fallback:'Usar PDF si el frame rate cae por debajo de 30.'
  };
  const lab=applyRoomDeviceReport(makeLab(),report,NOW),entry=lab.results['laptop:performance'];
  assert.equal(entry.level,'measured');
  assert.equal(entry.status,'passed_with_differences');
  assert.deepEqual(entry.metrics,{startupMs:420,fpsP50:58,droppedFrameRate:0.02});
  assert.doesNotMatch(JSON.stringify(entry),/secret/);
  assert.equal(entry.evidence.artifactSha256,DIGEST);
});

test('rejects fake rooms, unknown dimensions and local or credentialed evidence',()=>{
  const base={
    kind:'measurement',device:'projector',area:'legibility',status:'passed',adapter:'room-probe',adapterVersion:'1',
    environment:'Projector room A',artifactSha256:DIGEST,evidenceUrl:'https://evidence.example/room.json',
    executedAt:'2026-07-23T21:58:00.000Z',checkedAt:NOW,metrics:{minContrast:4.5,minFontPx:28,pass:true}
  };
  assert.throws(()=>applyRoomDeviceReport(makeLab(),{...base,device:'stadium'},NOW),/dispositivo o área desconocida/);
  assert.throws(()=>applyRoomDeviceReport(makeLab(),{...base,evidenceUrl:'https://localhost/room.json'},NOW),/medición real requiere/);
  assert.throws(()=>applyRoomDeviceReport(makeLab(),{...base,evidenceUrl:'https://user:pass@evidence.example/room.json'},NOW),/medición real requiere/);
  assert.throws(()=>applyRoomDeviceReport(makeLab(),{...base,metrics:{rawLog:'secret'}},NOW),/métricas reconocidas/);
});

test('browser probe is bucketed, local-only and labels capabilities honestly',async()=>{
  const source=await readFile(new URL('../assets/presentation-room-device-lab.js',import.meta.url),'utf8');
  const context=vm.createContext({});
  vm.runInContext(source,context);
  const api=context.AdmiraRoomDeviceLab;
  const probe=api.probe({
    window:{innerWidth:390,devicePixelRatio:3,matchMedia:()=>({matches:true})},
    document:{createElement:()=>({canPlayType:type=>type.includes('avc1')?'probably':''})},
    navigator:{deviceMemory:4,hardwareConcurrency:8,userActivation:{isActive:false},userAgent:'private'}
  });
  assert.equal(probe.level,'capability');
  assert.equal(probe.device,'mobile');
  assert.equal(probe.codecs.h264,'probably');
  assert.equal(probe.autoplay.requiresGesture,true);
  assert.equal(probe.legibility.viewport,'compact');
  assert.doesNotMatch(JSON.stringify(probe),/userAgent|390/);
  assert.match(api.checklistStatus(makeLab(),probe),/no es una medición/);
  const absent=api.probe({});
  assert.equal(absent.level,'unavailable');
  assert.equal(absent.device,null);
  assert.match(absent.reason,/no se infiere un dispositivo/);
  assert.doesNotMatch(source,/fetch\(|localStorage|sessionStorage/);
});

test('private API enforces the real body limit even without Content-Length',async()=>{
  const values=new Map([
    ['presentation:demo',JSON.stringify({displayName:'Demo',roomDeviceLab:makeLab()})],
    ['ideas:demo',JSON.stringify({hero:{},skeleton:[],updatedAt:NOW})]
  ]),env={PRESENTATION_IDEAS:kv(values)};
  const oversized=JSON.stringify({padding:'x'.repeat(70*1024)});
  const response=await roomDeviceApi({
    request:new Request('https://admiranext.test/presentaciones/demo/api/room-device-lab',{
      method:'PUT',headers:{origin:'https://admiranext.test','content-type':'application/json'},body:oversized
    }),
    params:{client:'demo'},env
  });
  assert.equal(response.status,413);
});

test('generation and presenter keep the matrix private and expose the bounded API',async()=>{
  const [generator,presentation,presenter,middleware]=await Promise.all([
    readFile(new URL('../functions/presentaciones/api/generate.js',import.meta.url),'utf8'),
    readFile(new URL('../functions/presentaciones/[client]/presentacion.js',import.meta.url),'utf8'),
    readFile(new URL('../assets/presentation-presenter-mode.js',import.meta.url),'utf8'),
    readFile(new URL('../functions/presentaciones/_middleware.js',import.meta.url),'utf8')
  ]);
  assert.match(generator,/createRoomDeviceLab/);assert.match(generator,/roomDeviceLabUrl/);
  assert.match(presentation,/window\.__ADMIRA_ROOM_DEVICE_LAB__/);
  assert.match(presentation,/roomDeviceLabScript=audienceMode\?'':/);
  assert.match(presenter,/roomDeviceChecklistStatus/);
  assert.match(middleware,/isRoomDeviceLabApi/);
});
