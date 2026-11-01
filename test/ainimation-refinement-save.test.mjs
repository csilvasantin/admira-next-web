import test from 'node:test';
import assert from 'node:assert/strict';
import {generatorProject} from '../pruebas/ainimation-presentaciones/refinement/generator.mjs';
import {editField,changesBetween} from '../pruebas/ainimation-presentaciones/refinement/project.mjs';
import {saveRefinement,RefinementConflict} from '../pruebas/ainimation-presentaciones/save.mjs';
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
  await assert.rejects(saveRefinement({project,changeset,read:async()=>ideas,write:async()=>{writes++;}}),error=>error instanceof RefinementConflict&&error.current.source.revision==='r2'&&error.phase==='before-save');assert.equal(writes,0);
});
test('a rejected concurrent write reads the new revision once and never retries it',async()=>{
  const ideas=source(),project=generatorProject(ideas),changeset=changesBetween(project,editField(project,'closing-title','Nuevo'));let reads=0,writes=0;
  await assert.rejects(saveRefinement({project,changeset,read:async()=>{reads++;return structuredClone(ideas);},write:async()=>{writes++;ideas.updatedAt='r2';ideas.closing.title='Del origen';throw Object.assign(Error('Conflicto'),{status:409,conflict:true});}}),error=>error.code==='source_conflict'&&error.phase==='after-rejection'&&error.current.document.components.closing.title==='Del origen');
  assert.equal(writes,1);assert.equal(reads,2);assert.equal(changeset.changes[0].after,'Nuevo');
});
test('a source change after an OK acknowledgement preserves the draft and labels the uncertain save',async()=>{
  const ideas=source(),project=generatorProject(ideas),changeset=changesBetween(project,editField(project,'closing-title','Nuevo'));let writes=0;
  await assert.rejects(saveRefinement({project,changeset,read:async()=>structuredClone(ideas),write:async()=>{writes++;ideas.updatedAt='r3';ideas.closing.title='Cambio posterior';return {ok:true,revision:'r2'};}}),error=>error.code==='source_conflict'&&error.phase==='after-save'&&error.current.source.revision==='r3');assert.equal(writes,1);assert.equal(changeset.changes[0].after,'Nuevo');
});
test('a stale post-save read is not misrepresented as a different current revision',async()=>{
  const ideas=source(),project=generatorProject(ideas),changeset=changesBetween(project,editField(project,'closing-title','Nuevo'));let writes=0;
  await assert.rejects(saveRefinement({project,changeset,read:async()=>structuredClone(ideas),write:async()=>{writes++;return {ok:true,revision:'r2'};}}),error=>error.code!=='source_conflict'&&/no ha confirmado/.test(error.message));assert.equal(writes,1);
});
test('ordinary failures and an unreadable conflict source retain the original error without retrying writes',async()=>{
  for(const status of [401,409]){
    const ideas=source(),project=generatorProject(ideas),changeset=changesBetween(project,editField(project,'closing-title','Nuevo')),failure=Object.assign(Error('Fallo original'),{status});let reads=0,writes=0;
    await assert.rejects(saveRefinement({project,changeset,read:async()=>{if(++reads>1)throw Error('No disponible');return ideas;},write:async()=>{writes++;throw failure;}}),error=>error===failure);assert.equal(writes,1);assert.equal(reads,status===409?2:1);
  }
});
test('a mismatched source is rejected before a native write or a conflict preview',async()=>{
  const ideas=source(),project=generatorProject(ideas),changeset=changesBetween(project,editField(project,'closing-title','Nuevo'));ideas.client='other-source';ideas.updatedAt='r2';let writes=0;
  await assert.rejects(saveRefinement({project,changeset,read:async()=>ideas,write:async()=>{writes++;}}),error=>!error.code&&/otro origen/.test(error.message));assert.equal(writes,0);
});
test('an OK response alone cannot confirm a save whose reread does not contain the edit',async()=>{
  const ideas=source(),project=generatorProject(ideas),changeset=changesBetween(project,editField(project,'closing-title','Nuevo'));
  await assert.rejects(saveRefinement({project,changeset,read:async()=>ideas,write:async()=>{ideas.updatedAt='r2';return {ok:true,revision:'r2'};}}),/no coincide/);
});
