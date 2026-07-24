import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {
  onRequestGet,
  onRequestPost,
  onRequestPut
} from '../functions/presentaciones/api/media-library.js';

function kv(seed={}){
  const values=new Map(Object.entries(seed));
  return {
    values,
    async get(key,options){
      const value=values.get(key);
      if(value==null)return null;
      return options?.type==='json'?structuredClone(typeof value==='string'?JSON.parse(value):value):String(value);
    },
    async put(key,value){values.set(key,String(value))}
  };
}

function r2(){
  const values=new Map();
  return {
    values,
    async put(key,value,options){values.set(key,{value:new Uint8Array(value),options})}
  };
}

function env(){
  return {
    PRESENTATION_IDEAS:kv({
      'presentation:demo':JSON.stringify({slug:'demo',slideMedia:[],updatedAt:'2026-01-01T00:00:00Z'}),
      'ideas:demo':JSON.stringify({
        hero:{title:'Portada Demo'},
        objective:'Objetivo',
        skeleton:[{id:'historia',title:'Historia',enabled:true}],
        closing:{title:'Cierre'}
      })
    }),
    PRESENTATION_MEDIA:r2()
  };
}

async function body(response){return response.json()}

test('media library uploads verified private media and never trusts a MIME label',async()=>{
  const bindings=env();
  const form=new FormData();
  form.set('client','demo');
  form.set('acceptedByCarlos','true');
  form.set('approvalNote','Carlos dice OK');
  form.set('file',new File([new Uint8Array([0x89,0x50,0x4e,0x47,0x0d,0x0a,0x1a,0x0a])],'portada.exe',{type:'application/x-msdownload'}));
  const response=await onRequestPost({
    request:new Request('https://admiranext.test/presentaciones/api/media-library',{
      method:'POST',
      headers:{Origin:'https://admiranext.test'},
      body:form
    }),
    env:bindings
  });
  assert.equal(response.status,201);
  const data=await body(response);
  assert.equal(data.assets.length,1);
  assert.equal(data.assets[0].kind,'image');
  assert.equal(data.assets[0].contentType,'image/png');
  assert.equal(data.assets[0].acceptedByCarlos,true);
  assert.match(data.assets[0].url,/^\/presentaciones\/demo\/media\/library-es-[a-f0-9]{16}\.png$/);
  assert.equal(bindings.PRESENTATION_MEDIA.values.size,1);
  const [key,stored]=[...bindings.PRESENTATION_MEDIA.values][0];
  assert.match(key,/^presentations\/demo\/es\/library-es-/);
  assert.equal(stored.options.httpMetadata.contentType,'image/png');
  assert.equal(stored.options.customMetadata.acceptedByCarlos,'true');
});

test('media library requires same origin and explicit final acceptance from Carlos',async()=>{
  const bindings=env();
  const file=new File([new Uint8Array([0xff,0xd8,0xff,0xdb])],'foto.jpg',{type:'image/jpeg'});
  const rejectedOrigin=new FormData();
  rejectedOrigin.set('client','demo');rejectedOrigin.set('acceptedByCarlos','true');rejectedOrigin.set('file',file);
  assert.equal((await onRequestPost({
    request:new Request('https://admiranext.test/presentaciones/api/media-library',{method:'POST',headers:{Origin:'https://evil.test'},body:rejectedOrigin}),
    env:bindings
  })).status,403);
  const missingAcceptance=new FormData();
  missingAcceptance.set('client','demo');missingAcceptance.set('file',file);
  const response=await onRequestPost({
    request:new Request('https://admiranext.test/presentaciones/api/media-library',{method:'POST',headers:{Origin:'https://admiranext.test'},body:missingAcceptance}),
    env:bindings
  });
  assert.equal(response.status,422);
  assert.match((await body(response)).error,/aceptar expresamente/);
  assert.equal(bindings.PRESENTATION_MEDIA.values.size,0);
});

test('drag assignment contract updates slideMedia with client-scoped URL and Carlos authority',async()=>{
  const bindings=env();
  const asset={
    id:'aabbccddeeff0011',
    name:'Apertura.mp4',
    kind:'video',
    contentType:'video/mp4',
    size:1200,
    url:'/presentaciones/demo/media/library-es-aabbccddeeff0011.mp4',
    objectKey:'presentations/demo/es/library-es-aabbccddeeff0011.mp4',
    uploadedAt:'2026-07-24T00:00:00.000Z',
    acceptedByCarlos:true,
    acceptedAt:'2026-07-24T00:00:00.000Z',
    approvalNote:'Carlos confirma OK',
    assignedSlides:[]
  };
  await bindings.PRESENTATION_IDEAS.put('media-library:demo',JSON.stringify([asset]));
  const response=await onRequestPut({
    request:new Request('https://admiranext.test/presentaciones/api/media-library',{
      method:'PUT',
      headers:{Origin:'https://admiranext.test','content-type':'application/json'},
      body:JSON.stringify({client:'demo',assetId:asset.id,slide:'cover'})
    }),
    env:bindings
  });
  assert.equal(response.status,200);
  const data=await body(response);
  assert.equal(data.slideMedia.length,1);
  assert.equal(data.slideMedia[0].effectiveSrc,asset.url);
  assert.equal(data.slideMedia[0].rights.acceptedByCarlos,true);
  assert.equal(data.slideMedia[0].rights.status,'carlos-approved');
  assert.deepEqual(data.assets[0].assignedSlides,['cover']);
  const stored=JSON.parse(bindings.PRESENTATION_IDEAS.values.get('presentation:demo'));
  assert.equal(stored.slideMedia[0].src,asset.url);
  assert.equal(stored.slideMedia[0].usable,true);
});

test('inventory is scoped to an existing presentation and exposes slide destinations',async()=>{
  const bindings=env();
  const response=await onRequestGet({
    request:new Request('https://admiranext.test/presentaciones/api/media-library?client=demo'),
    env:bindings
  });
  assert.equal(response.status,200);
  const data=await body(response);
  assert.deepEqual(data.slides.map(item=>item.id),['cover','objective','historia','closing']);
  assert.deepEqual(data.assets,[]);
  assert.deepEqual(data.slideMedia,[]);
  const missing=await onRequestGet({
    request:new Request('https://admiranext.test/presentaciones/api/media-library?client=otro'),
    env:bindings
  });
  assert.equal(missing.status,404);
});

test('generator media library is keyboard accessible and supports previews and drag assignment',async()=>{
  const [script,styles,generator,middleware]=await Promise.all([
    readFile(new URL('../assets/presentation-media-library.js',import.meta.url),'utf8'),
    readFile(new URL('../assets/presentation-media-library.css',import.meta.url),'utf8'),
    readFile(new URL('../functions/presentaciones/generador.js',import.meta.url),'utf8'),
    readFile(new URL('../functions/presentaciones/_middleware.js',import.meta.url),'utf8')
  ]);
  assert.doesNotThrow(()=>new Function(script));
  assert.match(script,/role="button" tabindex="0"/);
  assert.match(script,/aria-pressed/);
  assert.match(script,/selectedAssetId/);
  assert.match(script,/aria-live="polite"/);
  assert.match(script,/<(?:img|video|audio)/);
  assert.match(script,/dragstart/);
  assert.match(script,/dataTransfer/);
  assert.match(script,/admira:presentation-created/);
  assert.match(styles,/:focus-visible/);
  assert.match(styles,/prefers-reduced-motion/);
  assert.match(generator,/presentation-media-library\.js/);
  assert.match(generator,/presentation-media-library\.css/);
  assert.match(middleware,/media-library/);
});
