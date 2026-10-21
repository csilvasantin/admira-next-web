import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
const experto=readFileSync(new URL('../suite/experto.js',import.meta.url),'utf8');
const legacy=readFileSync(new URL('./experto-bugito.test.mjs',import.meta.url),'utf8');
const fixture=legacy.slice(legacy.indexOf('function consola('),legacy.indexOf("test('/bugito está"));
const sites=['admira.studio','admira.store','admira.tv','admira.app','admira.biz'];
const ids=['creativo','arquitecto','bugito','supervisor','angelito','comercial'];
function boot(host,available=true){
 const calls=[],A={assistantContract:1,handle:async t=>calls.push(t),cara:id=>{calls.push(id);return {cerrar(){},enviar(){}};},hide:()=>calls.push('off')};
 const context={experto,vm,URL,URLSearchParams,A};
 vm.runInNewContext(fixture+';result=consola({host:'+JSON.stringify(host)+',AdmiraAvatar:A});',context);
 const c=context.result;if(!available)A.cara=()=>null;
 return {...c,calls};
}
for(const site of sites)for(const id of ids)for(const command of ['/'+id,'/admirito '+id,'/demo '+id]){
 test(site+' '+command+' shows the selected assistant once without leaving its page',async()=>{
  const c=boot(site),before=c.api.plataforma();
  assert(c.api.__sharedCommand(command));
  const result=await c.run(command);
  assert.equal(result.ok,true);assert.equal(result.assistant,id);assert.equal(result.visible,true);
  assert.deepEqual(c.calls,[id]);assert.deepEqual(Array.from(c.fuera),[]);
  assert.equal(c.api.plataforma(),before);
 });
}
test('missing character fails in place rather than redirecting',async()=>{const c=boot('admira.app',false);const r=await c.run('/supervisor');assert.equal(r.ok,false);assert.equal(c.fuera.length,0);});
test('showing a character never starts a camera or submits physical operations',async()=>{const c=boot('admira.tv');await c.run('/supervisor');await c.run('/angelito');assert.deepEqual(c.calls,['supervisor','angelito']);assert.equal(c.fuera.length,0);});
test('explicit off hides without navigation and malformed commands cannot select an assistant',async()=>{const c=boot('admira.studio');assert.equal((await c.run('/creativo off')).visible,false);assert.deepEqual(c.calls,['off']);assert.equal(c.api.assistantRequest('/supervisor rotation-90'),null);assert.equal(c.api.assistantRequest('/supervisores'),null);assert.equal(c.fuera.length,0);});
