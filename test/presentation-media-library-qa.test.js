import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {
  onRequestGet,
  onRequestPost,
  onRequestPut
} from '../functions/presentaciones/api/media-library.js';
import {onRequestGet as serveMedia} from '../functions/presentaciones/[client]/media/[file].js';
import {onRequestGet as renderPresentation} from '../functions/presentaciones/[client]/presentacion.js';

function kv(seed={}){
  const values=new Map(Object.entries(seed));
  return {
    values,
    async get(key,options){
      const value=values.get(key);
      if(value==null)return null;
      return options?.type==='json'
        ? structuredClone(typeof value==='string'?JSON.parse(value):value)
        : String(value);
    },
    async put(key,value){values.set(key,String(value))}
  };
}

function r2(){
  const values=new Map();
  return {
    values,
    async put(key,value,options){values.set(key,{body:new Uint8Array(value),options})},
    async get(key){
      const stored=values.get(key);
      if(!stored)return null;
      return {
        body:stored.body,
        writeHttpMetadata(headers){headers.set('content-type',stored.options.httpMetadata.contentType)}
      };
    }
  };
}

function bindings(){
  return {
    PRESENTATION_IDEAS:kv({
      'presentation:demo':JSON.stringify({
        slug:'demo',displayName:'Demo',outputs:['website'],languages:['es'],
        theme:{},sequence:{},slideMedia:[]
      }),
      'ideas:demo':JSON.stringify({
        hero:{title:'Portada'},objective:'Objetivo',
        skeleton:[{id:'historia',title:'Historia',message:'Mensaje',detail:'Detalle',enabled:true}],
        closing:{title:'Cierre',action:'Continuar'},
        labels:{objective:'Objetivo',next:'Siguiente'},notes:'Notas privadas'
      }),
      'presentation:otro':JSON.stringify({slug:'otro',slideMedia:[]}),
      'ideas:otro':JSON.stringify({
        hero:{title:'Otro'},objective:'Objetivo',skeleton:[],closing:{title:'Cierre'}
      })
    }),
    PRESENTATION_MEDIA:r2()
  };
}

function sample(kind){
  if(kind==='image')return new File([
    Uint8Array.from([0x89,0x50,0x4e,0x47,0x0d,0x0a,0x1a,0x0a])
  ],'imagen.png',{type:'application/octet-stream'});
  if(kind==='audio')return new File([
    Uint8Array.from([0x49,0x44,0x33,0x04,0,0,0,0])
  ],'audio.mp3',{type:'video/mp4'});
  return new File([
    Uint8Array.from([0,0,0,0x18,0x66,0x74,0x79,0x70,0x69,0x73,0x6f,0x6d])
  ],'video.mp4',{type:'image/png'});
}

async function upload(env,kind,{client='demo',accepted=true,extra}={}){
  const form=new FormData();
  form.set('client',client);
  if(accepted)form.set('acceptedByCarlos','true');
  form.set('approvalNote','OK final de Carlos');
  if(extra)form.set('padding',extra);
  form.set('file',sample(kind));
  const request=new Request('https://admiranext.test/presentaciones/api/media-library',{
    method:'POST',headers:{Origin:'https://admiranext.test'},body:form
  });
  return {request,response:await onRequestPost({request,env})};
}

async function assign(env,assetId,slide='cover',client='demo'){
  return onRequestPut({
    request:new Request('https://admiranext.test/presentaciones/api/media-library',{
      method:'PUT',
      headers:{Origin:'https://admiranext.test','content-type':'application/json'},
      body:JSON.stringify({client,assetId,slide})
    }),
    env
  });
}

test('QA biblioteca: imagen, audio y vídeo se detectan por firma y quedan en rutas privadas del cliente',async()=>{
  const env=bindings();
  for(const kind of ['image','audio','video']){
    const {response}=await upload(env,kind);
    assert.equal(response.status,201);
    const data=await response.json();
    assert.equal(data.assets[0].kind,kind);
    assert.match(data.assets[0].url,new RegExp(`^/presentaciones/demo/media/library-es-[a-z0-9]{16,32}\\.`));
    assert.equal(data.assets[0].acceptedByCarlos,true);
  }
  assert.equal(env.PRESENTATION_MEDIA.values.size,3);
  for(const key of env.PRESENTATION_MEDIA.values.keys())assert.match(key,/^presentations\/demo\/es\/library-es-/);
});

test('QA biblioteca: formatos inválidos y ausencia de aceptación fallan antes de escribir',async()=>{
  const env=bindings();
  const invalid=new FormData();
  invalid.set('client','demo');
  invalid.set('acceptedByCarlos','true');
  invalid.set('file',new File(['not media'],'payload.png',{type:'image/png'}));
  const invalidResponse=await onRequestPost({
    request:new Request('https://admiranext.test/presentaciones/api/media-library',{
      method:'POST',headers:{Origin:'https://admiranext.test'},body:invalid
    }),
    env
  });
  assert.equal(invalidResponse.status,415);
  assert.equal((await upload(env,'image',{accepted:false})).response.status,422);
  assert.equal(env.PRESENTATION_MEDIA.values.size,0);
});

test('QA biblioteca: el límite usa el body real aunque falte Content-Length',async()=>{
  const env=bindings();
  const fields=new Map([
    ['client','demo'],
    ['acceptedByCarlos','true'],
    ['file',{name:'demasiado-grande.mp4',size:41*1024*1024,arrayBuffer(){throw new Error('no debe leer el archivo')}}]
  ]);
  const request={
    url:'https://admiranext.test/presentaciones/api/media-library',
    headers:new Headers({Origin:'https://admiranext.test'}),
    async formData(){return {get:name=>fields.get(name),entries:()=>fields.entries()}}
  };
  assert.equal(request.headers.get('content-length'),null);
  const response=await onRequestPost({request,env});
  assert.equal(response.status,413);
  assert.equal(env.PRESENTATION_MEDIA.values.size,0);
});

test('QA biblioteca: inventario, objetos y asignaciones permanecen client-scoped',async()=>{
  const env=bindings();
  const uploaded=await (await upload(env,'video')).response.json();
  const asset=uploaded.assets[0];
  assert.ok([400,404].includes((await assign(env,asset.id,'cover','otro')).status));
  assert.deepEqual(JSON.parse(env.PRESENTATION_IDEAS.values.get('presentation:otro')).slideMedia,[]);
  const served=await serveMedia({
    params:{client:'otro',file:asset.url.split('/').at(-1)},
    env:{PRESENTATION_MEDIA:env.PRESENTATION_MEDIA}
  });
  assert.equal(served.status,404);
  const other=await onRequestGet({
    request:new Request('https://admiranext.test/presentaciones/api/media-library?client=otro'),
    env
  });
  assert.deepEqual((await other.json()).assets,[]);
});

test('QA biblioteca: reemplazar la asignación persiste exactamente un medio y corrige ambos inventarios',async()=>{
  const env=bindings();
  const first=(await (await upload(env,'image')).response.json()).assets[0];
  const second=(await (await upload(env,'audio')).response.json()).assets[0];
  assert.equal((await assign(env,first.id)).status,200);
  const replacement=await assign(env,second.id);
  assert.equal(replacement.status,200);
  const data=await replacement.json();
  assert.equal(data.slideMedia.filter(item=>item.slide==='cover').length,1);
  assert.equal(data.slideMedia[0].src,second.url);
  assert.equal(data.slideMedia[0].rights.acceptedByCarlos,true);
  assert.deepEqual(data.assets.find(item=>item.id===first.id).assignedSlides,[]);
  assert.deepEqual(data.assets.find(item=>item.id===second.id).assignedSlides,['cover']);
  const stored=JSON.parse(env.PRESENTATION_IDEAS.values.get('presentation:demo'));
  assert.equal(stored.slideMedia.filter(item=>item.slide==='cover').length,1);
  assert.equal(stored.slideMedia[0].src,second.url);
});

test('QA biblioteca: preview, carga y asignación ofrecen drag/drop y alternativa completa de teclado',async()=>{
  const source=await readFile(new URL('../assets/presentation-media-library.js',import.meta.url),'utf8');
  assert.match(source,/<img[\s\S]*<video[\s\S]*<audio/);
  assert.match(source,/drop\.addEventListener\('keydown'/);
  assert.match(source,/grid\.addEventListener\('dragstart'/);
  assert.match(source,/slides\.addEventListener\('drop'/);
  assert.match(source,/<button[^>]*data-select-media/);
  assert.match(source,/grid\.addEventListener\('click'/);
  assert.match(source,/slides\.addEventListener\('keydown'/);
  assert.match(source,/aria-(?:pressed|selected|describedby)/);
});

test('QA biblioteca: acceptedByCarlos manda, pero su auditoría y el inventario no llegan a audience',async()=>{
  const env=bindings();
  const asset=(await (await upload(env,'video')).response.json()).assets[0];
  assert.equal((await assign(env,asset.id)).status,200);
  const stored=JSON.parse(env.PRESENTATION_IDEAS.values.get('presentation:demo'));
  assert.equal(stored.slideMedia[0].rights.acceptedByCarlos,true);
  assert.equal(stored.slideMedia[0].usable,true);
  const response=await renderPresentation({
    params:{client:'demo'},
    request:new Request('https://admiranext.test/presentaciones/demo/presentacion?audience=1'),
    env,
    next(){throw new Error('unexpected next')}
  });
  const html=await response.text();
  assert.match(html,new RegExp(asset.url.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')));
  assert.doesNotMatch(html,/OK final de Carlos|acceptedByCarlos|media-library:demo|__ADMIRA_MEDIA_RIGHTS__/);
});
