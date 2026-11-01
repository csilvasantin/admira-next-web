import test from 'node:test';
import assert from 'node:assert/strict';
import {generatorProject} from '../pruebas/ainimation-presentaciones/refinement/generator.mjs';
import {editField,changesBetween} from '../pruebas/ainimation-presentaciones/refinement/project.mjs';
import {saveRefinement} from '../pruebas/ainimation-presentaciones/save.mjs';
const source=()=>({client:'fixture-source',updatedAt:'r1',hero:{title:'Título',summary:'Mensaje',eyebrow:'Marca'},objective:'Objetivo',skeleton:[],closing:{title:'Cerrar',action:'Continuar'},notes:'private'});
test('host reads current source, uses native writer, and confirms via a separate reread',async()=>{
  let ideas=source(),reads=0,writes=0;const project=generatorProject(ideas),changeset=changesBetween(project,editField(project,'closing-title','Acordar el piloto'));
  const result=await saveRefinement({project,changeset,read:async()=>{reads++;return structuredClone(ideas);},write:async(slug,payload)=>{
    writes++;assert.equal(slug,'fixture-source');assert.equal(payload.revision,'r1');assert.equal(payload.refinement,true);ideas.closing.title=payload.edits[0].value;ideas.updatedAt='r2';return {ok:true,revision:'r2',versionId:'after',previousVersionId:'before'};
  }});
  assert.equal(reads,2);assert.equal(writes,1);assert.equal(result.project.source.revision,'r2');assert.equal(result.versionId,'after');assert.equal(ideas.notes,'private');
});
test('stale source prevents native writes',async()=>{
  const ideas=source(),project=generatorProject(ideas),changeset=changesBetween(project,editField(project,'closing-title','Nuevo'));let writes=0;ideas.updatedAt='r2';
  await assert.rejects(saveRefinement({project,changeset,read:async()=>ideas,write:async()=>{writes++;}}),/revisión/);assert.equal(writes,0);
});
test('an OK response alone cannot confirm a save whose reread does not contain the edit',async()=>{
  const ideas=source(),project=generatorProject(ideas),changeset=changesBetween(project,editField(project,'closing-title','Nuevo'));
  await assert.rejects(saveRefinement({project,changeset,read:async()=>ideas,write:async()=>{ideas.updatedAt='r2';return {ok:true,revision:'r2'};}}),/no coincide/);
});
