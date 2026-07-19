import test from 'node:test';
import assert from 'node:assert/strict';
import {onRequest as handleInlineEdit} from '../functions/presentaciones/[client]/api/inline-edit.js';
import {onRequestGet as renderPresentation} from '../functions/presentaciones/[client]/presentacion.js';

const presentation={displayName:'Cliente Demo',outputs:['website'],languages:['es','ca','en'],theme:{},updatedAt:'2026-07-19T10:00:00.000Z'};
const ideas={
  displayName:'Cliente Demo',languages:['es','ca','en'],translations:{},updatedAt:'2026-07-19T10:00:00.000Z',
  hero:{eyebrow:'Presentación privada',title:'Título original',summary:'Resumen'},objective:'Acordar un piloto',
  skeleton:[{id:'problema',title:'El problema',message:'Mensaje original',detail:'Detalle',enabled:true}],
  closing:{title:'Cierre',action:'Siguiente acción'},labels:{objective:'El objetivo',next:'Siguiente paso'}
};

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
});
