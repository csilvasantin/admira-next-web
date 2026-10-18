import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
const experto=readFileSync(new URL('../pruebas/admirito-variantes/experto.js',import.meta.url),'utf8');
const avatar=readFileSync(new URL('../pruebas/admirito-variantes/avatar.js',import.meta.url),'utf8');
const existing=readFileSync(new URL('./experto-bugito.test.mjs',import.meta.url),'utf8');
const base=existing.slice(existing.indexOf('function consola('),existing.indexOf("test('/bugito está"));
function fixture(options={}) {const c={experto,vm,URL,URLSearchParams,options};vm.runInNewContext(base+';result=consola(options)',c);return c.result;}
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
test('help is bilingual and creative fails explicitly without invoking another character',async()=>{
 for(const lang of ['es','en']){let calls=0;const c=fixture({lang,AdmiraAvatar:{variantContract:1,floatingCharacters:true,handle:async()=>{calls++;return 'ok';}}});
 await c.run('/help admirito');assert.match(c.texto(),lang==='es'?/verde estándar/:/standard green/);
 assert.equal(c.api.__sharedCommand('/help admirito'),true);
 assert.equal((await c.run('/creativo')).ok,false);assert.equal((await c.run('/admirito /creativo')).ok,false);assert.equal(calls,0);
 assert.equal((await c.run('/default unexpected')).ok,false);assert.equal(calls,0);
 }
});
test('supervisor subcommand uses the existing camera route exactly once',async()=>{
 const c=fixture();assert.equal((await c.run('/admirito /supervisor')).ok,true);assert.deepEqual(Array.from(c.fuera),['https://www.admira.live/analizar?supervisor=1&lang=es']);
});
