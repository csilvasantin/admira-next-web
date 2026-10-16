import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
const source = readFileSync(new URL('../assets/avatar.js', import.meta.url), 'utf8');
const origin = 'https://digitalavatar.ai';
const plain = x => JSON.parse(JSON.stringify(x));
function setup(engine) {
  const responses=[], navigation=[], listeners={};
  const frame={contentWindow:{postMessage:(data,target)=>responses.push({data:plain(data),target})}};
  const document={readyState:'loading',currentScript:null,documentElement:{lang:'es'},
    getElementById:id=>id==='da-suite-frame'?frame:null,addEventListener(){},
    createElement:()=>({textContent:'',error:false,querySelector(selector){return selector==='.err'&&this.error?{}:null;}})};
  const window={document,location:{host:'www.admira.biz',origin:'https://www.admira.biz',assign:u=>navigation.push(u)},
    AdmiraExperto:engine,addEventListener:(name,fn)=>listeners[name]=fn};
  vm.runInNewContext(source,{window,document,URL,Promise,WeakMap,Map});
  return {responses,navigation,window,frame,send(data,extra={}){listeners.message({data,origin,source:frame.contentWindow,...extra});}};
}
const flush = () => new Promise(resolve=>setImmediate(resolve));
test('owned source and origin required; invalid commands never execute',async()=>{
  let calls=0;const q=setup({demo(){calls++;return {id:'biz/proyecto'};}});
  q.send({type:'da-demo',texto:'/demo 1',requestId:'one'},{origin:'https://evil.example'});
  q.send({type:'da-demo',texto:'/demo 1',requestId:'two'},{source:{postMessage(){}}});
  q.send({type:'da-demo',texto:'/venta 1',requestId:'three'});
  q.send({type:'da-demo',texto:'/demo auto\n/demo stop',requestId:'four'});
  q.send({type:'da-demo',texto:'/demo auto',requestId:{}});
  await flush();assert.equal(calls,0);assert.equal(q.responses.length,2);assert.ok(q.responses.every(x=>x.data.ok===false));
});
test('waits for catalog and real result, deduplicates pending and completed requests',async()=>{
  let ready,finish,calls=0;const loaded=new Promise(r=>ready=r),result=new Promise(r=>finish=r);
  const q=setup({listo:()=>loaded,demo(){calls++;return result;},demoEstado:()=>({activo:true,pausado:true,demo:'biz/proyecto',fase:2,secret:'excluded'})});
  const req={type:'da-demo',texto:'/demo pausa',requestId:'same'};q.send(req);q.send(req);await flush();
  assert.equal(calls,0);assert.equal(q.responses.length,0);ready();await flush();assert.equal(calls,1);assert.equal(q.responses.length,0);
  finish({activo:true,pausado:true});await flush();assert.equal(q.responses.length,2);
  q.send(req);await flush();assert.equal(calls,1);assert.equal(q.responses.length,3);
  const ack=q.responses[0];assert.equal(ack.target,origin);assert.equal(ack.data.type,'da-demo-result');assert.equal(ack.data.requestId,'same');assert.equal(ack.data.ok,true);assert.equal(ack.data.estado.pausado,true);assert.equal(ack.data.estado.secret,undefined);
  assert.deepEqual(q.responses[2],ack);
  q.send({...req,texto:'/demo stop'});await flush();assert.equal(calls,1);assert.equal(q.responses.at(-1).data.ok,false);
});
test('help null return succeeds from actual log, errors and thrown failures do not',async()=>{
  const q=setup({demo(text,log){if(text==='/demo help'){log.textContent='Demos: 1–5, auto, pausa';return null;}if(text==='/demo desconocida'){log.textContent='Demo desconocida';log.error=true;return null;}throw Error('private internal data');}});
  for(const [i,texto] of ['/demo help','/demo desconocida','/demo auto'].entries()){q.send({type:'da-demo',texto,requestId:'r'+i});await flush();}
  assert.deepEqual(q.responses.map(r=>r.data.ok),[true,false,false]);assert.match(q.responses[0].data.message,/Demos/);assert.match(q.responses[1].data.message,/desconocida/);assert.doesNotMatch(JSON.stringify(q.responses),/private internal/);
});
test('inactive control reports real inactive state, without claiming pause or resume',async()=>{
  const q=setup({demo:()=>({activo:false}),demoEstado:()=>({activo:false})});
  q.send({type:'da-demo',texto:'/demo pausa',requestId:'inactive'});await flush();
  assert.equal(q.responses[0].data.ok,true);assert.deepEqual(q.responses[0].data.estado,{activo:false});assert.deepEqual(q.responses[0].data.result,{activo:false});assert.doesNotMatch(q.responses[0].data.message,/paused|pausado|resumed|reanudado/i);
});
test('bounded plain-text log and serializable result; legacy execution and navigation preserved',async()=>{
  const q=setup({demo(text,log){log.textContent='<script>text only</script>'+ 'x'.repeat(6000);return {id:'studio/voz'};}});
  q.send({type:'da-demo',texto:'/demo 1',requestId:'bounded'});await flush();assert.equal(q.responses[0].data.message.length,4000);assert.equal(q.responses[0].data.result.id,'studio/voz');
  q.send({type:'da-demo',texto:'/demo 1'});await flush();assert.equal(q.responses.length,1);
  const fallback=setup(null);fallback.send({type:'da-demo',id:'studio'});await flush();assert.equal(fallback.navigation.length,1);assert.equal(new URL(fallback.navigation[0]).origin,'https://www.admira.studio');assert.equal(new URL(fallback.navigation[0]).searchParams.get('ax_demo'),'studio');assert.ok(new URL(fallback.navigation[0]).searchParams.get('ax_run'));assert.equal(fallback.responses.length,0);
});
test('unavailable local engine fails honestly and replay cache stays bounded',async()=>{
  const missing=setup(null);missing.send({type:'da-demo',texto:'/demo auto',requestId:'missing'});await flush();assert.equal(missing.responses[0].data.ok,false);assert.match(missing.responses[0].data.message,/unavailable/);
  let calls=0;const q=setup({demo(){calls++;return {activo:false};}});
  for(let i=0;i<140;i++){q.send({type:'da-demo',texto:'/demo estado',requestId:'r'+i});await flush();}
  assert.equal(calls,128);assert.equal(q.responses.length,140);assert.equal(q.responses.filter(r=>r.data.ok).length,128);q.send({type:'da-demo',texto:'/demo estado',requestId:'r0'});await flush();assert.equal(calls,128);assert.equal(q.responses.at(-1).data.ok,true);
});
