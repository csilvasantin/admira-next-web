import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {onRequest as handleInlineEdit} from '../functions/presentaciones/[client]/api/inline-edit.js';
import {onRequest as readImages} from '../functions/presentaciones/[client]/api/images.js';
import {onRequestGet as renderPresentation} from '../functions/presentaciones/[client]/presentacion.js';

const presentation={displayName:'Cliente Demo',outputs:['website'],languages:['es','ca','en'],theme:{},updatedAt:'2026-07-19T10:00:00.000Z'};
const ideas={
  displayName:'Cliente Demo',languages:['es','ca','en'],translations:{},updatedAt:'2026-07-19T10:00:00.000Z',
  hero:{eyebrow:'Presentación privada',title:'Título original',summary:'Resumen'},objective:'Acordar un piloto',
  skeleton:[{id:'problema',title:'El problema',message:'Mensaje original',detail:'Detalle',enabled:true}],
  closing:{title:'Cierre',action:'Siguiente acción'},labels:{objective:'El objetivo',next:'Siguiente paso'}
};

test('the text editor stays hidden until Ctrl+E and exposes undo and redo history',async()=>{
  const source=await readFile(new URL('../assets/presentation-inline-editor.js',import.meta.url),'utf8');
  assert.match(source,/toolbar\.hidden=true/);
  assert.match(source,/Ctrl\+E editar textos/);
  assert.match(source,/event\.ctrlKey.*event\.key\.toLowerCase\(\)==='e'/);
  assert.match(source,/class="undo"/);
  assert.match(source,/class="redo"/);
  assert.match(source,/function remember\(\)/);
  assert.match(source,/function restore\(index\)/);
  assert.match(source,/history=history\.slice\(0,historyIndex\+1\)/);
  assert.match(source,/Good, Better and Best/);
  assert.match(source,/dataset\.deckQuality/);
  assert.match(source,/activeQuality/);
  assert.match(source,/Look & feel de la presentación Admira/);
  assert.match(source,/Cada lámina con imagen temática del tema \(Grok\)/);
  assert.match(source,/Imagen descriptiva encima del fondo/);
  assert.match(source,/__ADMIRA_APPLY_QUALITY__/);
  assert.match(source,/class="delete-slide"/);
  assert.match(source,/function deleteSlide\(/);
  assert.match(source,/action:'deleteSlide'/);
  assert.match(source,/Ctrl\+Backspace|event\.key==='Backspace'/);
  assert.match(source,/¿Eliminar la lámina/);

});

function kv(values){
  return {
    async get(key,options){const value=values.get(key);return options?.type==='json'&&value?JSON.parse(value):value||null},
    async put(key,value){values.set(key,value)}
  };
}

test('inline edits update the visible language and synchronize every other language',async()=>{
  const values=new Map([['presentation:cliente-demo',JSON.stringify(presentation)],['ideas:cliente-demo',JSON.stringify(ideas)]]);
  const env={XAI_API_KEY:'secret-not-for-output',PRESENTATION_IDEAS:kv(values)};
  const originalFetch=globalThis.fetch;
  globalThis.fetch=async()=>new Response(JSON.stringify({output:[{type:'message',content:[{type:'output_text',text:JSON.stringify({translations:{ca:['Títol nou','Missatge nou'],en:['New title','New message']}})}]}]}));
  try{
    const request=new Request('https://admiranext.test/presentaciones/cliente-demo/api/inline-edit',{method:'PUT',headers:{origin:'https://admiranext.test','content-type':'application/json'},body:JSON.stringify({language:'es',revision:ideas.updatedAt,edits:[{field:'hero.title',value:'Título nuevo'},{field:'skeleton.message',blockId:'problema',value:'Mensaje nuevo'}]})});
    const resultResponse=await handleInlineEdit({request,env,params:{client:'cliente-demo'}});
    assert.equal(resultResponse.status,200);
    const result=await resultResponse.json();
    assert.equal(result.locales.es.hero.title,'Título nuevo');
    assert.equal(result.locales.ca.hero.title,'Títol nou');
    assert.equal(result.locales.en.hero.title,'New title');
    assert.equal(result.locales.ca.skeleton[0].message,'Missatge nou');
    assert.deepEqual(result.translated,['ca','en']);
    const saved=JSON.parse(values.get('ideas:cliente-demo'));
    assert.equal(saved.translations.en.skeleton[0].message,'New message');
  }finally{globalThis.fetch=originalFetch}
});

test('inline edits fail closed when a mixed-source client term is altered by translation',async()=>{
  const terminology=[{es:'Pixeria',ca:'Pixeria',en:'Pixeria'}];
  const values=new Map([
    ['presentation:cliente-demo',JSON.stringify({...presentation,terminology})],
    ['ideas:cliente-demo',JSON.stringify({...ideas,terminology})]
  ]);
  const before=values.get('ideas:cliente-demo'),originalFetch=globalThis.fetch;
  globalThis.fetch=async()=>new Response(JSON.stringify({output:[{type:'message',content:[{type:'output_text',text:JSON.stringify({translations:{es:['Pixeria'],en:['Pixèria']}})}]}]}));
  try{
    const request=new Request('https://admiranext.test/presentaciones/cliente-demo/api/inline-edit',{method:'PUT',headers:{origin:'https://admiranext.test','content-type':'application/json'},body:JSON.stringify({language:'ca',revision:ideas.updatedAt,edits:[{field:'hero.title',value:'Pixeria'}]})});
    const response=await handleInlineEdit({request,env:{XAI_API_KEY:'test-key',PRESENTATION_IDEAS:kv(values)},params:{client:'cliente-demo'}});
    assert.equal(response.status,502);
    assert.match((await response.json()).error,/no respeta el término aprobado/);
    assert.equal(values.get('ideas:cliente-demo'),before);
  }finally{globalThis.fetch=originalFetch}
});

test('the website renders only verified images as slide backgrounds and marks every copy field editable',async()=>{
  const slides=['cover','objective','content','closing'].map((role,index)=>({index:index+1,role,status:'ready',textFreeVerified:true,url:`/presentaciones/cliente-demo/images/slide-${index+1}.jpg`}));
  const values=new Map([
    ['presentation:cliente-demo',JSON.stringify({...presentation,languages:['es']})],
    ['ideas:cliente-demo',JSON.stringify({...ideas,languages:['es']})],
    ['image-set:cliente-demo',JSON.stringify({slides})]
  ]);
  const response=await renderPresentation({params:{client:'cliente-demo'},env:{PRESENTATION_IDEAS:kv(values)},request:new Request('https://admiranext.test/presentaciones/cliente-demo/presentacion'),next(){return new Response('missing',{status:404})}});
  assert.equal(response.status,200);
  const html=await response.text();
  assert.equal((html.match(/<section class="slide[^>]*data-has-image="true"/g)||[]).length,4);
  assert.match(html,/data-edit-field="hero.title"/);
  assert.match(html,/data-edit-field="objective"/);
  assert.match(html,/data-edit-field="skeleton.message"/);
  assert.match(html,/data-edit-field="closing.action"/);
  assert.match(html,/__ADMIRA_PRESENTATION_STATE__/);
  assert.match(html,/data-image-index="0"/);
});

test('a presentation without Grok images remains complete and imports verified backgrounds later',async()=>{
  const values=new Map([
    ['presentation:cliente-demo',JSON.stringify({...presentation,outputs:['website','backgrounds'],languages:['es']})],
    ['ideas:cliente-demo',JSON.stringify({...ideas,languages:['es']})]
  ]);
  const env={PRESENTATION_IDEAS:kv(values)};
  const response=await renderPresentation({params:{client:'cliente-demo'},env,request:new Request('https://admiranext.test/presentaciones/cliente-demo/presentacion'),next(){return new Response('missing',{status:404})}});
  assert.equal(response.status,200);
  const html=await response.text();
  assert.equal((html.match(/<section class="slide[^>]*data-has-image="true"/g)||[]).length,0);
  assert.match(html,/fetch\('api\/images'/);
  assert.match(html,/setInterval\(syncImages,10000\)/);
  assert.match(html,/slide\.style\.setProperty\('--slide-image'/);
  const inlineScripts=[...html.matchAll(/<script>([\s\S]*?)<\/script>/g)];
  assert.doesNotThrow(()=>new Function(inlineScripts.at(-1)[1]));

  const pending=await readImages({request:new Request('https://admiranext.test/presentaciones/cliente-demo/api/images'),params:{client:'cliente-demo'},env});
  assert.equal(pending.status,200);
  assert.deepEqual((await pending.json()).imageSet,null);

  values.set('image-set:cliente-demo',JSON.stringify({schemaVersion:2,slides:[{index:1,role:'cover',status:'ready',textFreeVerified:true,url:'/presentaciones/cliente-demo/images/cover.jpg'}]}));
  const ready=await readImages({request:new Request('https://admiranext.test/presentaciones/cliente-demo/api/images'),params:{client:'cliente-demo'},env});
  const body=await ready.json();
  assert.equal(body.imageSet.slides[0].url,'/presentaciones/cliente-demo/images/cover.jpg');
  assert.equal('prompt' in body.imageSet.slides[0],false);
  const writeAttempt=await readImages({request:new Request('https://admiranext.test/presentaciones/cliente-demo/api/images',{method:'POST'}),params:{client:'cliente-demo'},env});
  assert.equal(writeAttempt.status,405);
});

test('deleteSlide removes one skeleton block without regenerating and keeps at least one lamina',async()=>{
  const {deleteSkeletonBlock}=await import('../functions/presentaciones/[client]/api/inline-edit.js');
  const ideas={
    updatedAt:'2026-07-19T10:00:00.000Z',
    skeleton:[
      {id:'problema',title:'El problema',message:'m',detail:'d',enabled:true},
      {id:'momento',title:'El momento',message:'m2',detail:'d2',enabled:true}
    ],
    translations:{en:{skeleton:[{id:'problema',title:'The problem'},{id:'momento',title:'The moment'}]}}
  };
  assert.equal(deleteSkeletonBlock(ideas,'problema'),'problema');
  assert.deepEqual(ideas.skeleton.map(item=>item.id),['momento']);
  assert.deepEqual(ideas.translations.en.skeleton.map(item=>item.id),['momento']);
  assert.throws(()=>deleteSkeletonBlock(ideas,'momento'),/al menos una lámina/);
  assert.throws(()=>deleteSkeletonBlock(ideas,'no-existe'),/ya no existe/);
});

test('inline-edit action deleteSlide persists the remaining skeleton and captures a version',async()=>{
  const ideas={
    displayName:'Cliente Demo',languages:['es','en'],translations:{en:{skeleton:[{id:'problema',title:'The problem',message:'m',detail:'d'},{id:'momento',title:'The moment',message:'m2',detail:'d2'}]}},updatedAt:'2026-07-19T10:00:00.000Z',
    hero:{eyebrow:'Presentación privada',title:'Título original',summary:'Resumen'},objective:'Acordar un piloto',
    skeleton:[{id:'problema',title:'El problema',message:'Mensaje original',detail:'Detalle',enabled:true},{id:'momento',title:'El momento',message:'Ahora',detail:'Detalle 2',enabled:true}],
    closing:{title:'Cierre',action:'Siguiente acción'},labels:{objective:'El objetivo',next:'Siguiente paso'}
  };
  const values=new Map([['presentation:cliente-demo',JSON.stringify(presentation)],['ideas:cliente-demo',JSON.stringify(ideas)]]);
  const request=new Request('https://admiranext.test/presentaciones/cliente-demo/api/inline-edit',{method:'PUT',headers:{origin:'https://admiranext.test','content-type':'application/json'},body:JSON.stringify({action:'deleteSlide',language:'es',revision:ideas.updatedAt,blockId:'problema'})});
  const resultResponse=await handleInlineEdit({request,env:{PRESENTATION_IDEAS:kv(values)},params:{client:'cliente-demo'}});
  assert.equal(resultResponse.status,200);
  const result=await resultResponse.json();
  assert.equal(result.ok,true);
  assert.equal(result.deleted,'problema');
  assert.equal(result.locales.es.skeleton.length,1);
  assert.equal(result.locales.es.skeleton[0].id,'momento');
  assert.equal(result.locales.en.skeleton.length,1);
  assert.equal(result.locales.en.skeleton[0].id,'momento');
  const saved=JSON.parse(values.get('ideas:cliente-demo'));
  assert.deepEqual(saved.skeleton.map(item=>item.id),['momento']);
  assert.notEqual(saved.updatedAt,ideas.updatedAt);
});
