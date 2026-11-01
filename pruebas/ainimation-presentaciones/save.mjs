import {generatorProject,nativeEdits,confirmSaved} from './refinement/generator.mjs';
export async function saveRefinement({project,changeset,read,write}){
  const latest=await read(project.source.id);
  const current=generatorProject(latest,project.document.language);
  // Rebuild the allowed fields from the current source, never from client bindings.
  const payload=nativeEdits(current,changeset);
  const ack=await write(current.source.id,payload);
  const after=await read(current.source.id);
  return {project:confirmSaved(current,changeset,ack,after),versionId:ack.versionId||null,previousVersionId:ack.previousVersionId||null};
}
