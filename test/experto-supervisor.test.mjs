import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
const experto=readFileSync(new URL('../suite/experto.js',import.meta.url),'utf8');
const existing=readFileSync(new URL('./experto-bugito.test.mjs',import.meta.url),'utf8');
// Same minimal DOM fixture used by the legacy-console integration tests.
const base=existing.slice(existing.indexOf('function consola('),existing.indexOf("test('/bugito está"));
function consoleFor({hostname='admira.studio',search='',lang='es',hidden=false,ready=true,commandsOnly=false}={}) {
  const calls={open:0,reveal:0};let camera,observations=0;
  const toggle={getAttribute:()=>hidden?'false':'true',click(){hidden=false;calls.reveal++;}};
  const entry={click(){calls.open++;camera={querySelector:()=>toggle};}};
  const query=selector=>selector==='#analizar-webcam'?camera:selector==='button[data-verb="analizar"]'?entry:null;
  const fixture=base.replace("hostname: 'www.admira.store'","hostname: testHost").replace("search: ''","search: testSearch")
    .replace('querySelector: () => null, querySelectorAll: () => [],\n    createElement','querySelector: testQuery, querySelectorAll: () => [],\n    createElement')
    .replace('currentScript: { dataset: {} }', 'currentScript: { dataset: testCommandsOnly ? {commandsOnly: \"\"} : {} }')
    .replace('MutationObserver: class { observe() {} disconnect() {} }', 'MutationObserver: class { observe() {testObserved();} disconnect() {} }')
    .replace('sandbox.window = sandbox;', 'if(testReady)sandbox.AdmiraWebcam={mount(){}};sandbox.window = sandbox;');
  const context={experto,vm,URL,URLSearchParams,testHost:hostname,testSearch:search,testQuery:query,testReady:ready,testCommandsOnly:commandsOnly,testObserved:()=>observations++};
  vm.runInNewContext(fixture+';result=consola({lang:'+JSON.stringify(lang)+'});',context);
  return {...context.result,calls,observations:()=>observations};
}
test('the shared command opens the camera from all five sites and client clones',async()=>{
  for(const hostname of ['admira.studio','www.admira.store','admira.tv','www.admira.app','www.admira.biz','studio.client.example','tv.client.example']) {
    const c=consoleFor({hostname});assert.equal(c.api.has('supervisor'),true);
    assert.equal(c.api.__sharedCommand('/supervisor'),true);assert.equal(c.api.__sharedCommand('/supervisores'),false);
    assert.equal((await c.run('/supervisor')).ok,true);
    assert.deepEqual(Array.from(c.fuera),['https://www.admira.live/analizar?supervisor=1&lang=es']);
  }
});
test('Live reuses Analizar and reveals controls without toggling the camera closed',async()=>{
  const c=consoleFor({hostname:'www.admira.live',hidden:true});
  assert.equal((await c.run('/supervisor')).ok,true);await c.run('/supervisor');
  assert.deepEqual(c.calls,{open:1,reveal:1});assert.deepEqual(Array.from(c.fuera),[]);
});
test('the cross-site arrival opens the camera automatically; ordinary visits do not',()=>{
  const c=consoleFor({hostname:'admira.live',search:'?supervisor=1',hidden:true});assert.deepEqual(c.calls,{open:1,reveal:1});
  const normal=consoleFor({hostname:'admira.live'});assert.deepEqual(normal.calls,{open:0,reveal:0});
});
test('English is preserved and the help describes the actual camera',async()=>{
  const c=consoleFor({lang:'en'});await c.run('/supervisor');await c.run('/help');
  assert.deepEqual(Array.from(c.fuera),['https://www.admira.live/analizar?supervisor=1&lang=en']);assert.match(c.texto(),/opens the Mac mini Insta360/);
});
test('missing camera reports failure without claiming a connected stream',async()=>{
  const c=consoleFor({hostname:'admira.live',ready:false});assert.equal((await c.run('/supervisor')).ok,false);
  assert.match(c.texto(),/todavía no está disponible/);assert.deepEqual(c.calls,{open:0,reveal:0});
});
test('arguments never execute display or shell commands',async()=>{
  const c=consoleFor();assert.equal((await c.run('/supervisor rotation-90')).ok,false);assert.deepEqual(Array.from(c.fuera),[]);
});

test('commands-only mode exposes the shared API while preserving the native Fleet terminal',async()=>{
  const c=consoleFor({hostname:'www.yokup.com',commandsOnly:true});
  assert.equal(c.api.has('supervisor'),true);
  assert.equal(c.observations(),0,'does not wait for a panel or attach a skin to the native terminal');
  assert.ok(consoleFor({hostname:'www.yokup.com'}).observations()>0);
  assert.equal((await c.run('/supervisor')).ok,true);
  assert.deepEqual(Array.from(c.fuera),['https://www.admira.live/analizar?supervisor=1&lang=es']);
});
