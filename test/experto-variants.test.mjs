import {installAdmirito} from '../suite/admirito.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
const experto=readFileSync(new URL('../suite/experto.js',import.meta.url),'utf8');
const avatar=readFileSync(new URL('../assets/avatar.js',import.meta.url),'utf8');
const existing=readFileSync(new URL('./experto-bugito.test.mjs',import.meta.url),'utf8');
const base=existing.slice(existing.indexOf('function consola('),existing.indexOf("test('/bugito está"));
function fixture(options={}) {const c={experto,vm,URL,URLSearchParams,options,installAdmirito};vm.runInNewContext(base+';result=consola(options)',c);return c.result;}
test('standard green has explicit non-toggle selection and legacy avatar aliases remain intact',()=>{
 const module={exports:{}};vm.runInNewContext(avatar,{module,globalThis:{},window:undefined});
 for(const command of ['/admirito','/default','/admirito default','/admirito /default'])assert.equal(module.exports.decide(command),'standard');
 assert.equal(module.exports.decide('/avatarDigital'),'mascota');assert.equal(module.exports.decide('/avatar default'),'reset');
});
test('all suite hosts route standard selection once, including repeated invocations',async()=>{
 for(const host of ['www.admira.app','www.admira.biz','www.admira.store','admira.studio','admira.tv','www.yokup.com']){
 const calls=[];const c=fixture({host,AdmiraAvatar:{variantContract:1,floatingCharacters:true,handle:async t=>{calls.push(t);return 'ok';}}});
 for(const command of ['/admirito','/default','/admirito /default','/admirito']){assert.equal(c.api.__sharedCommand(command),true);await c.run(command);}
 assert.deepEqual(calls,Array(4).fill('/admirito default'));
 }
});
test('help is bilingual and Creative opens its own character locally',async()=>{
 for(const lang of ['es','en']){let calls=0;const c=fixture({lang,AdmiraAvatar:{variantContract:1,assistantContract:1,floatingCharacters:true,cara:id=>{assert.equal(id,'creativo');calls++;return {};},handle:async()=>{calls++;return 'ok';}}});
 await c.run('/help admirito');assert.match(c.texto(),lang==='es'?/verde estándar/:/Standard green/);
 assert.equal(c.api.__sharedCommand('/help admirito'),true);
 assert.equal((await c.run('/creativo')).ok,true);assert.equal((await c.run('/admirito /creativo')).ok,true);assert.equal(calls,2);assert.equal(c.fuera.length,0);
 assert.equal((await c.run('/default unexpected')).ok,false);assert.equal(calls,2);
 }
});
test('supervisor subcommand opens the local character once',async()=>{
 const calls=[];const c=fixture({AdmiraAvatar:{assistantContract:1,handle:async()=>'',cara:id=>{calls.push(id);return {};}}});assert.equal((await c.run('/admirito /supervisor')).ok,true);assert.deepEqual(calls,['supervisor']);assert.deepEqual(Array.from(c.fuera),[]);
});
