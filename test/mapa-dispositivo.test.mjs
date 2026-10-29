import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';

const code=await readFile(new URL('../pruebas/mapa/ubicacion-dispositivo.js',import.meta.url),'utf8');
function mount({secure=true,available=true,allowed=true,synchronousDenied=false}={}) {
  const events={},docEvents={},intervals=new Map(),changes=[],cleared=[];
  let calls=0,success,error,settings;
  const geo={watchPosition(ok,fail,opts){calls++;success=ok;error=fail;settings=opts;if(synchronousDenied)fail({code:1});return 9;},clearWatch:id=>cleared.push(id)};
  const document={hidden:false,permissionsPolicy:{allowsFeature:name=>name==='geolocation'&&allowed},addEventListener:(name,fn)=>docEvents[name]=fn};
  const context=vm.createContext({document,isSecureContext:secure,navigator:available?{geolocation:geo}:{},addEventListener:(name,fn)=>events[name]=fn,setInterval:fn=>{intervals.set(1,fn);return 1;},clearInterval:id=>intervals.delete(id)});
  context.window=context;vm.runInContext(code,context);
  const controller=context.AdmiraMapaUbicacionDispositivo.create({onChange:state=>changes.push(state)});
  return {controller,changes,cleared,intervals,document,calls:()=>calls,success:fix=>success(fix),error:code=>error({code}),settings:()=>settings,hide:()=>{document.hidden=true;docEvents.visibilitychange();},show:()=>{document.hidden=false;docEvents.visibilitychange();},leave:()=>events.pagehide()};
}
const fix=(stamp=Date.now(),extra={})=>({timestamp:stamp,coords:{latitude:0,longitude:0,accuracy:10,...extra}});

test('no pide ubicación hasta activar; stop cancela y descarta callbacks tardíos',()=>{
  const ui=mount();assert.equal(ui.calls(),0);ui.controller.start();ui.controller.start();assert.equal(ui.calls(),1);
  assert.deepEqual(JSON.parse(JSON.stringify(ui.settings())),{enableHighAccuracy:true,maximumAge:0,timeout:15000});
  ui.success(fix());assert.equal(ui.changes.at(-1).status,'position');ui.controller.stop();assert.deepEqual(ui.cleared,[9]);assert.equal(ui.intervals.size,0);
  const n=ui.changes.length;ui.success(fix(Date.now()+1));ui.error(3);assert.equal(ui.changes.length,n);
});
test('respeta HTTPS, capacidad y política sin pedir ni ampliar permiso',()=>{
  for(const [opts,status] of [[{secure:false},'insecure'],[{available:false},'unsupported'],[{allowed:false},'policy']]){
    const ui=mount(opts);ui.controller.start();assert.equal(ui.calls(),0);assert.equal(ui.changes.at(-1).status,status);
  }
});
test('ocultar o abandonar detiene; volver no reinicia la adquisición',()=>{
  for(const action of ['hide','leave']){
    const ui=mount();ui.controller.start();ui[action]();assert.deepEqual(ui.cleared,[9]);assert.equal(ui.changes.at(-1).status,'stopped');ui.show();assert.equal(ui.calls(),1);
  }
  const hidden=mount();hidden.document.hidden=true;hidden.controller.start();assert.equal(hidden.calls(),0);assert.equal(hidden.changes.at(-1).status,'hidden');
});
test('negación, timeout y pérdida de señal tienen causa explícita sin recuperar una posición antigua',()=>{
  const ui=mount();ui.controller.start();const stamp=Date.now();ui.success(fix(stamp));ui.error(3);assert.equal(ui.changes.at(-1).status,'timeout');
  for(const tick of ui.intervals.values())tick();assert.equal(ui.changes.at(-1).status,'timeout');
  ui.success(fix(stamp));assert.equal(ui.changes.at(-1).status,'timeout');
  ui.success(fix(stamp+1));assert.equal(ui.changes.at(-1).status,'position');ui.error(2);assert.equal(ui.changes.at(-1).status,'unavailable');
  ui.error(1);assert.equal(ui.changes.at(-1).status,'denied');assert.deepEqual(ui.cleared,[9]);assert.equal(ui.intervals.size,0);
});
test('repetir el timestamp y recibir mediciones desordenadas no crea una medición nueva',()=>{
  const ui=mount();ui.controller.start();const stamp=Date.now();ui.success(fix(stamp));const n=ui.changes.length;
  ui.success(fix(stamp,{latitude:1}));ui.success(fix(stamp-1));assert.equal(ui.changes.length,n);
  ui.success(fix(stamp+1,{altitude:100,speed:30}));assert.equal(ui.changes.length,n+1);
  assert.deepEqual(Object.keys(ui.changes.at(-1).position.coords).sort(),['accuracy','latitude','longitude']);ui.controller.stop();
});
test('una denegación síncrona tampoco deja un watch o reloj huérfano',()=>{
  const ui=mount({synchronousDenied:true});ui.controller.start();assert.equal(ui.changes.at(-1).status,'denied');assert.deepEqual(ui.cleared,[9]);assert.equal(ui.intervals.size,0);
});
