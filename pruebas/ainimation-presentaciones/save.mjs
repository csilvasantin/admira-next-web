import {generatorProject,nativeEdits,confirmSaved} from './refinement/generator.mjs';
export class RefinementConflict extends Error{
  constructor(current,phase='before-save'){super(phase==='after-save'?'La lectura posterior no coincide con la confirmación. Revisa el historial antes de volver a guardar.':'El origen tiene otra revisión. Compara los cambios antes de guardar.');this.code='source_conflict';this.current=current;this.phase=phase;}
}
export async function saveRefinement({project,changeset,read,write}){
  const fromSource=ideas=>{const value=generatorProject(ideas,project.document.language);if(value.source.id!==project.source.id||value.source.adapter!==project.source.adapter)throw Error('La lectura pertenece a otro origen.');return value;};
  const latest=await read(project.source.id);
  const current=fromSource(latest);
  if(current.source.revision!==project.source.revision)throw new RefinementConflict(current);
  // Rebuild the allowed fields from the current source, never from client bindings.
  const payload=nativeEdits(current,changeset);
  let ack;
  try{ack=await write(current.source.id,payload);}
  catch(error){
    if(error.status===409||error.conflict===true){
      let now;try{now=fromSource(await read(current.source.id));}catch{/* Preserve the original failure when the source cannot be reread. */}
      if(now&&now.source.revision!==current.source.revision)throw new RefinementConflict(now,'after-rejection');
    }
    throw error;
  }
  const after=await read(current.source.id);
  if(ack?.ok&&typeof ack.revision==='string'&&after.updatedAt!==ack.revision&&after.updatedAt!==current.source.revision)throw new RefinementConflict(fromSource(after),'after-save');
  return {project:confirmSaved(current,changeset,ack,after),versionId:ack.versionId||null,previousVersionId:ack.previousVersionId||null};
}
