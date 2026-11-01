import test from 'node:test';
import assert from 'node:assert/strict';
import {exportPresentation} from '../pruebas/ainimation-presentaciones/export.mjs';
import {validatePresentation} from '../pruebas/ainimation-presentaciones/contract.mjs';
const ideas=()=>({client:'demo-bridge',updatedAt:'2026-11-01T16:00:00Z',hero:{title:'Una historia',summary:'Entradilla',eyebrow:'Marca'},objective:'El objetivo',
  skeleton:[{id:'one',title:'Una idea',message:'Mensaje',detail:'Desarrollo',enabled:true},{id:'two',title:'Oculto',message:'No debe viajar',enabled:false}],
  closing:{title:'Cierre',action:'Dar el paso'},notes:'SOLO PRESENTADOR',brief:'BRIEF PRIVADO',password:'CLAVE PRIVADA',
  translations:{en:{hero:{title:'A story',summary:'Introduction'},skeleton:[{title:'An idea',message:'Message',detail:'Detail'}],closing:{title:'Closing',action:'Next step'}}}});
test('exports active audience content only, with stable source revision; never modifies the original',()=>{
  const source=ideas(),before=structuredClone(source),p=exportPresentation(source);
  assert.equal(p.slides.length,4);assert.deepEqual(p.source,{id:source.client,language:'es',revision:source.updatedAt});
  assert.equal(p.slides[2].detail,'Desarrollo');assert.equal(JSON.stringify(p).includes('No debe viajar'),false);
  for(const secret of ['SOLO PRESENTADOR','BRIEF PRIVADO','CLAVE PRIVADA'])assert.equal(JSON.stringify(p).includes(secret),false);
  assert.deepEqual(source,before);assert.deepEqual(validatePresentation(p),p);
});
test('exports the chosen saved language and never silently falls back',()=>{
  const p=exportPresentation(ideas(),'en');assert.equal(p.title,'A story');assert.equal(p.slides[1].title,'An idea');assert.equal(p.source.language,'en');
  assert.throws(()=>exportPresentation(ideas(),'ca'),/versión guardada/);assert.throws(()=>exportPresentation(ideas(),'de'),/Idioma/);
});
test('oversized text, missing headings and invalid identities fail without truncation',()=>{
  const p=ideas();p.skeleton[0].detail='x'.repeat(2001);assert.throws(()=>exportPresentation(p));
  p.skeleton[0].detail='';p.hero.title='';assert.throws(()=>exportPresentation(p));p.client='../secret';assert.throws(()=>exportPresentation(p));
});
