import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import vm from 'node:vm';
const experto=fs.readFileSync(new URL('../suite/experto.js',import.meta.url),'utf8'),existing=fs.readFileSync(new URL('./experto-bugito.test.mjs',import.meta.url),'utf8');const fixture=existing.slice(existing.indexOf('function consola('),existing.indexOf("test('/bugito está"));
function setup(host){const c={experto,vm,URL,URLSearchParams};vm.runInNewContext(fixture+';result=consola('+JSON.stringify({host,lang:'es'})+');',c);return c.result;}
test('Starbucks 180 launches the same four-screen programme once from every suite host',async()=>{
 for(const host of ['admira.studio','admira.tv','admira.app','admira.biz','admira.store']){const c=setup(host);const d=await c.run('/demo starbucks 180');assert.equal(d.ok,true);assert.equal(d.screens,4);assert.equal(c.fuera.length,1);assert.equal(c.fuera[0],'https://admira.studio/campanas/starbucks-180/?lang=es&start=1');}
});
test('the existing 360 command retains its destination and an extra argument does not launch 180',async()=>{
 const c=setup('admira.studio');await c.run('/contenido starbucks 360');assert.match(c.fuera[0],/starbucks-360/);await c.run('/demo starbucks 180 extra');assert.equal(c.fuera.length,1);
});
test('/demo luka opens the map demo from every suite host, in the console language',async()=>{
 for(const host of ['admira.tv','admira.studio','admira.app','admira.biz','admira.store']){const c=setup(host);const d=await c.run('/demo luka');assert.equal(d.ok,true);assert.equal(c.fuera.length,1);assert.equal(c.fuera[0],'https://www.admiranext.com/pruebas/mapa/?demo=luka&lang=es');}
 const c=setup('admira.tv');await c.run('/demo luka extra');assert.equal(c.fuera.length,0,'an extra argument does not launch it');
});
