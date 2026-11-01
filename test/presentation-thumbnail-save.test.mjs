import test from 'node:test';
import assert from 'node:assert/strict';
import {onRequest as writeNative} from '../functions/presentaciones/[client]/api/inline-edit.js';
import {onRequest as writeIdeas} from '../functions/presentaciones/[client]/api/ideas.js';
import {generatorProject} from '../pruebas/ainimation-presentaciones/refinement/generator.mjs';
import {editField,changesBetween} from '../pruebas/ainimation-presentaciones/refinement/project.mjs';
import {saveRefinement} from '../pruebas/ainimation-presentaciones/save.mjs';
import {onRequestPut as regenerate} from '../functions/presentaciones/api/generate.js';
function setup(){
  const ideas={client:'sample-proposal',displayName:'Órbita',updatedAt:'r1',hero:{title:'Original'},objective:'Un objetivo',skeleton:[{id:'first',title:'Primera',enabled:true}],closing:{title:'Cierre'},notes:'Privado',languages:['es','en'],outputs:['website'],translations:{en:{hero:{title:'Original English'},skeleton:[],closing:{title:'Closing'}}}};
  const values=new Map([['presentation:sample-proposal',{slug:'sample-proposal',displayName:'Órbita',languages:['es','en'],outputs:['website']}],['ideas:sample-proposal',ideas]]);
  const env={PRESENTATION_IDEAS:{get:async key=>structuredClone(values.get(key)||null),put:async(key,value)=>values.set(key,JSON.parse(value))}};
  const request=payload=>new Request('https://source.test/presentaciones/sample-proposal/api/inline-edit',{method:'PUT',headers:{origin:'https://source.test','content-type':'application/json'},body:JSON.stringify(payload)});
  const context=payload=>({request:request(payload),env,params:{client:'sample-proposal'}});
  return {ideas,values,env,context};
}
test('a thumbnail-only save uses the native versioned writer without calling translation or touching the script',async()=>{
  const s=setup(),project=generatorProject(s.ideas);let draft=editField(project,'thumbnail-title','Tu próxima gran idea');draft=editField(draft,'thumbnail-layout','editorial');
  const before=structuredClone(s.ideas),result=await saveRefinement({project,changeset:changesBetween(project,draft),read:async()=>structuredClone(s.values.get('ideas:sample-proposal')),write:async(_,payload)=>{const response=await writeNative(s.context(payload));assert.equal(response.status,200);return response.json();}});
  assert.equal(result.project.document.components.thumbnail.title,'Tu próxima gran idea');assert.ok(result.versionId);assert.ok(result.previousVersionId);
  const saved=s.values.get('ideas:sample-proposal');assert.equal(saved.thumbnails.es.title,'Tu próxima gran idea');const {thumbnails,updatedAt,...rest}=saved;const {updatedAt:old,...original}=before;assert.deepEqual(rest,original);assert.equal(thumbnails.en,undefined);
  assert.deepEqual(s.values.get('version:sample-proposal:'+result.previousVersionId).values.ideas,before);
});
test('stale revisions and foreign or missing image references never write the proposal',async()=>{
  for(const patch of [{revision:'stale'},{thumbnail:{image:'https://evil.test/image.jpg'}},{thumbnail:{image:'/presentaciones/other/images/slide-01-cover.jpg'}},{thumbnail:{image:'/presentaciones/sample-proposal/images/slide-01-missing.jpg'}}]){
    const s=setup(),thumbnail=generatorProject(s.ideas).document.components.thumbnail,payload={language:'es',revision:'r1',refinement:true,edits:[],thumbnail:{...thumbnail,...patch.thumbnail},...('revision'in patch?{revision:patch.revision}:{})};
    const response=await writeNative(s.context(payload));assert.ok([400,409].includes(response.status));assert.deepEqual(s.values.get('ideas:sample-proposal'),s.ideas);
  }
});
test('a regular script save preserves the previously adjusted thumbnail design',async()=>{
  const s=setup(),thumbnail={title:'Una gran idea',kicker:'ÓRBITA',image:'builtin:orbita',accent:'#c3ff6b',layout:'impact'};s.values.get('ideas:sample-proposal').thumbnails={es:thumbnail};
  const response=await writeIdeas(s.context({...s.ideas,hero:{title:'Nuevo guion'}}));assert.equal(response.status,200);assert.deepEqual(s.values.get('ideas:sample-proposal').thumbnails,{es:thumbnail});
});
test('approved library artwork and a separate logo save without assigning either to a slide',async()=>{
  const s=setup(),art='/presentaciones/sample-proposal/media/library-es-1234567890123456.png',logo='/presentaciones/sample-proposal/media/library-es-1234567890123457.png';
  s.values.set('media-library:sample-proposal',[{kind:'image',url:art,acceptedByCarlos:true},{kind:'image',url:logo,acceptedByCarlos:true}]);
  const project=generatorProject(s.ideas);let draft=project;for(const [field,value]of Object.entries({image:art,logo,font:'fira-sans',logoStyle:'white'}))draft=editField(draft,'thumbnail-'+field,value);
  const result=await saveRefinement({project,changeset:changesBetween(project,draft),read:async()=>structuredClone(s.values.get('ideas:sample-proposal')),write:async(_,payload)=>{const response=await writeNative(s.context(payload));assert.equal(response.status,200);return response.json();}});
  assert.equal(result.project.document.components.thumbnail.logo,logo);assert.equal(result.project.document.components.thumbnail.font,'fira-sans');assert.equal(s.values.get('presentation:sample-proposal').slideMedia,undefined);
});
test('unapproved and foreign library resources cannot become thumbnail logos',async()=>{
  const s=setup(),logo='/presentaciones/sample-proposal/media/library-es-1234567890123457.png';s.values.set('media-library:sample-proposal',[{kind:'image',url:logo,acceptedByCarlos:false}]);
  const thumbnail={...generatorProject(s.ideas).document.components.thumbnail,logo};const response=await writeNative(s.context({language:'es',revision:'r1',refinement:true,edits:[],thumbnail}));assert.equal(response.status,400);assert.equal(s.values.get('ideas:sample-proposal').thumbnails,undefined);
});
test('regenerating a proposal and finishing its deferred languages retain an adjusted thumbnail',async()=>{
  const s=setup(),thumbnail={title:'Un diseño ajustado',kicker:'ÓRBITA',image:'builtin:orbita',accent:'#c3ff6b',layout:'editorial'};s.values.get('ideas:sample-proposal').thumbnails={es:thumbnail};
  s.env.PRES_SIGNING_KEY='fixture-key';s.env.PRESENTATION_IDEAS.list=async()=>({keys:[]});s.env.PRESENTATION_MEDIA={put:async()=>{}};const work=[];const originalFetch=globalThis.fetch;globalThis.fetch=async()=>new Response(new Uint8Array([137,80,78,71,13,10,26,10,0,0,0,0]),{headers:{'content-type':'image/png'}});try{
  const response=await regenerate({request:new Request('https://source.test/presentaciones/api/generate',{method:'PUT',headers:{origin:'https://source.test','content-type':'application/json'},body:JSON.stringify({slug:'sample-proposal',displayName:'Órbita',website:'https://example.test',overwrite:true,problem:'Explorar una nueva idea',audience:'Diseñadores',inspiration:{url:'https://example.test',title:'Muestra',description:'Muestra ficticia',primary:'#112233',accent:'#c3ff6b',logo:{type:'url',url:'https://example.test/logo.png'}}})}),env:s.env,waitUntil:promise=>work.push(promise)});
  assert.equal(response.status,201,await response.text());await Promise.all(work);assert.deepEqual(s.values.get('ideas:sample-proposal').thumbnails,{es:thumbnail});}finally{globalThis.fetch=originalFetch;}
});
