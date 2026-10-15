import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
const experto=readFileSync(new URL('../suite/experto.js',import.meta.url),'utf8');
const existing=readFileSync(new URL('./experto-bugito.test.mjs',import.meta.url),'utf8');
const fixture=existing.slice(existing.indexOf('function consola('),existing.indexOf("test('/bugito está"));
function consoleFor(host,lang='es') {const c={experto,vm,URL,URLSearchParams};vm.runInNewContext(fixture+';result=consola('+JSON.stringify({host,lang})+');',c);return c.result;}
test('one shared dispatch launches the same demo from all five platforms',async()=>{
 for(const host of ['admira.studio','www.admira.biz','admira.tv','www.admira.app','www.admira.store']) {
  const c=consoleFor(host);assert(c.api.has('contenido'));assert(c.api.__sharedCommand('/contenido starbucks 360'));
  assert.equal((await c.run('/contenido Starbucks 360')).ok,true);
  assert.deepEqual(Array.from(c.fuera),['https://admira.studio/campanas/starbucks-360/?lang=es&start=1']);
  await c.run('/ayuda');assert.match(c.texto(),/contenido starbucks 360/);
 }
});
test('English alias retains the interface language and invalid requests stay in the console',async()=>{
 const en=consoleFor('admira.studio','en');await en.run('/content starbucks 360');assert.match(en.fuera[0],/lang=en/);
 const c=consoleFor('admira.tv');for(const text of ['/contenido','/contenido starbucks','/contenido starbucks 360 extra','/contenido otra 360'])assert.equal((await c.run(text)).ok,false);
 assert.deepEqual(Array.from(c.fuera),[]);assert.equal(c.api.__sharedCommand('/contenidos starbucks 360'),false);
});
test('local adapters cannot replace the common content command',async()=>{
 const c=consoleFor('admira.studio');let stolen=0;c.api.registerAdapter({id:'local-test',verbs:[{name:'contenido',run(){stolen++;}}]});await c.run('/contenido starbucks 360');assert.equal(stolen,0);assert.equal(c.fuera.length,1);
});
