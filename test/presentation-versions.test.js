import test from 'node:test';import assert from 'node:assert/strict';
import {captureVersion,listVersions,restoreVersion} from '../functions/presentaciones/_versions.js';
function kv(initial={}){const values=new Map(Object.entries(initial).map(([k,v])=>[k,JSON.stringify(v)]));return{values,async get(k,o){const v=values.get(k);return o?.type==='json'&&v?JSON.parse(v):v||null},async put(k,v){values.set(k,v)}}}
test('presentation history records saves and restores without losing the current state',async()=>{
  const store=kv({'presentation:demo':{displayName:'Demo',languages:['es','ca'],outputs:['website']},'ideas:demo':{hero:{title:'Primera'},updatedAt:'1'}}),env={PRESENTATION_IDEAS:store};
  const first=await captureVersion(env,'demo','presentación creada');assert.equal((await listVersions(env,'demo')).length,1);
  await store.put('ideas:demo',JSON.stringify({hero:{title:'Segunda'},updatedAt:'2'}));await captureVersion(env,'demo','textos guardados');
  await restoreVersion(env,'demo',first.id);assert.equal((await store.get('ideas:demo',{type:'json'})).hero.title,'Primera');
  const versions=await listVersions(env,'demo');assert.equal(versions.length,4);assert.match(versions[0].reason,/restaurada/);assert.ok(versions.some(v=>/copia automática/.test(v.reason)));
});
