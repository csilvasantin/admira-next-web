import test from 'node:test';
import assert from 'node:assert/strict';
import {buildImageSet, buildImagePrompt, publicImageSet} from '../functions/presentaciones/_grok-images.js';
import {onRequest as handleImages} from '../functions/presentaciones/api/images.js';

const presentation = {
  displayName:'PortAventura World', updatedAt:'2026-07-19T08:00:00.000Z',
  theme:{profile:'immersive', mode:'dark', layout:'editorial', primary:'#172b55', accent:'#f5a623'}
};
const ideas = {
  displayName:'PortAventura World', updatedAt:'2026-07-19T08:00:00.000Z',
  hero:{title:'PortAventura World: una experiencia conectada', summary:'Una historia para el resort'},
  objective:'Acordar un piloto',
  skeleton:[
    {id:'problema', title:'El problema', message:'Conectar PortAventura con el visitante', detail:'Usar señales del resort', enabled:true},
    {id:'oculta', title:'No se ve', message:'Oculta', detail:'Oculta', enabled:false},
    {id:'piloto', title:'El piloto', message:'Empezar pequeño', detail:'Cuatro semanas', enabled:true}
  ],
  closing:{title:'Demos el primer paso', action:'Elegir una zona'}
};

test('creates exactly one image slot per narrative slide', async () => {
  const set = await buildImageSet({client:'portaventura', presentation, ideas, now:'2026-07-19T09:00:00.000Z'});
  assert.equal(set.total, 5);
  assert.deepEqual(set.slides.map(slide => slide.role), ['cover','objective','content','content','closing']);
  assert.equal(set.slides.every(slide => slide.status === 'queued'), true);
  assert.equal(set.progress,0);
  assert.equal(set.slides.every(slide => slide.progress === 0 && slide.requestedAt),true);
});

test('the prompt removes URLs and client brands and carries the IP-safe contract', () => {
  const prompt = buildImagePrompt({
    slide:{role:'content', title:'PortAventura World', message:'See https://example.com and PortAventura', detail:'AdmiraNeXT concept'},
    presentation, ideas
  });
  assert.doesNotMatch(prompt, /PortAventura|https:\/\/|AdmiraNeXT/i);
  assert.match(prompt, /do not imitate any named artist/i);
  assert.match(prompt, /Do not show logos, trademarks/i);
  assert.match(prompt, /zero visible text and zero typography/i);
  assert.match(prompt, /signs, screens, interfaces/i);
  assert.match(prompt, /human review/i);
});

test('public image state never exposes prompts or R2 object keys', async () => {
  const set = await buildImageSet({client:'portaventura', presentation, ideas});
  set.slides[0].objectKey = 'presentations/private/object.jpg';
  const safe = publicImageSet(set);
  assert.equal('prompt' in safe.slides[0], false);
  assert.equal('objectKey' in safe.slides[0], false);
  assert.equal(safe.humanReviewRequired, true);
});

test('the endpoint prepares, generates and stores one bounded image without exposing the key', async () => {
  const values = new Map([
    ['presentation:test-client', JSON.stringify({...presentation, displayName:'Test Client'})],
    ['ideas:test-client', JSON.stringify({...ideas, displayName:'Test Client'})]
  ]);
  const puts = [];
  const env = {
    XAI_API_KEY:'secret-not-for-output',
    XAI_IMAGE_MODEL:'grok-imagine-image',
    PRESENTATION_IDEAS:{
      async get(key, options){const value=values.get(key);return options?.type==='json'&&value?JSON.parse(value):value||null},
      async put(key, value){values.set(key, value)}
    },
    PRESENTATION_MEDIA:{
      async put(key, value, options){puts.push({key, value, options})}
    }
  };
  const prepareRequest = new Request('https://admiranext.test/presentaciones/api/images', {
    method:'POST', headers:{origin:'https://admiranext.test','content-type':'application/json'},
    body:JSON.stringify({action:'prepare', client:'test-client'})
  });
  const preparedResponse = await handleImages({request:prepareRequest, env});
  assert.equal(preparedResponse.status, 201);
  const prepared = await preparedResponse.json();
  assert.equal(prepared.imageSet.total, 5);
  assert.equal(JSON.stringify(prepared).includes(env.XAI_API_KEY), false);

  const originalFetch = globalThis.fetch;
  globalThis.fetch = async url => String(url).includes('/images/generations')
    ? new Response(JSON.stringify({data:[{b64_json:Buffer.from([0xff,0xd8,0xff,0xd9]).toString('base64')}]}), {headers:{'content-type':'application/json'}})
    : new Response(JSON.stringify({output:[{type:'message',content:[{type:'output_text',text:JSON.stringify({has_visible_text:false,confidence:0.99,evidence:'No visible glyphs'})}]}]}), {headers:{'content-type':'application/json'}});
  try{
    const first = prepared.imageSet.slides[0];
    const generateRequest = new Request('https://admiranext.test/presentaciones/api/images', {
      method:'POST', headers:{origin:'https://admiranext.test','content-type':'application/json'},
      body:JSON.stringify({action:'generate', client:'test-client', setId:prepared.imageSet.id, slideId:first.id})
    });
    const generatedResponse = await handleImages({request:generateRequest, env});
    assert.equal(generatedResponse.status, 201);
    const generated = await generatedResponse.json();
    assert.equal(generated.imageSet.slides[0].status, 'ready');
    assert.equal(generated.imageSet.slides[0].progress,100);
    assert.equal(generated.imageSet.progress,20);
    assert.equal(generated.imageSet.slides[0].textFreeVerified, true);
    assert.match(generated.imageSet.slides[0].url, /^\/presentaciones\/test-client\/images\/slide-/);
    assert.equal(puts.length, 1);
    assert.match(puts[0].key, /^presentations\/test-client\/grok-images\/slide-/);
    assert.equal(puts[0].options.httpMetadata.contentType, 'image/jpeg');
  }finally{
    globalThis.fetch = originalFetch;
  }
});

test('a generated image containing text is discarded and never written to R2', async () => {
  const values = new Map([
    ['presentation:test-client', JSON.stringify({...presentation, displayName:'Test Client'})],
    ['ideas:test-client', JSON.stringify({...ideas, displayName:'Test Client'})]
  ]);
  const puts=[];
  const env={
    XAI_API_KEY:'secret-not-for-output',
    PRESENTATION_IDEAS:{
      async get(key,options){const value=values.get(key);return options?.type==='json'&&value?JSON.parse(value):value||null},
      async put(key,value){values.set(key,value)}
    },
    PRESENTATION_MEDIA:{async put(...args){puts.push(args)}}
  };
  const preparedResponse=await handleImages({request:new Request('https://admiranext.test/presentaciones/api/images',{method:'POST',headers:{origin:'https://admiranext.test','content-type':'application/json'},body:JSON.stringify({action:'prepare',client:'test-client'})}),env});
  const prepared=await preparedResponse.json();
  const originalFetch=globalThis.fetch;
  globalThis.fetch=async url=>String(url).includes('/images/generations')
    ? new Response(JSON.stringify({data:[{b64_json:Buffer.from([0xff,0xd8,0xff,0xd9]).toString('base64')}]}))
    : new Response(JSON.stringify({output:[{type:'message',content:[{type:'output_text',text:JSON.stringify({has_visible_text:true,confidence:0.98,evidence:'A sign contains letters'})}]}]}));
  try{
    const slide=prepared.imageSet.slides[0];
    const generatedResponse=await handleImages({request:new Request('https://admiranext.test/presentaciones/api/images',{method:'POST',headers:{origin:'https://admiranext.test','content-type':'application/json'},body:JSON.stringify({action:'generate',client:'test-client',setId:prepared.imageSet.id,slideId:slide.id})}),env});
    assert.equal(generatedResponse.status,502);
    const generated=await generatedResponse.json();
    assert.equal(generated.retryable,true);
    assert.equal(generated.imageSet.slides[0].status,'failed');
    assert.equal(generated.imageSet.slides[0].textFreeVerified,false);
    assert.equal(puts.length,0);
  }finally{globalThis.fetch=originalFetch}
});

test('a Grok request without activity for ten minutes becomes resumable',async()=>{
  const values=new Map([
    ['presentation:test-client',JSON.stringify({...presentation,displayName:'Test Client'})],
    ['ideas:test-client',JSON.stringify({...ideas,displayName:'Test Client'})]
  ]);
  const env={PRESENTATION_IDEAS:{
    async get(key,options){const value=values.get(key);return options?.type==='json'&&value?JSON.parse(value):value||null},
    async put(key,value){values.set(key,value)}
  }};
  const preparedResponse=await handleImages({request:new Request('https://admiranext.test/presentaciones/api/images',{method:'POST',headers:{origin:'https://admiranext.test','content-type':'application/json'},body:JSON.stringify({action:'prepare',client:'test-client'})}),env});
  const prepared=await preparedResponse.json(),stored=JSON.parse(values.get('image-set:test-client'));
  stored.slides[0].status='processing';stored.slides[0].progress=10;stored.slides[0].updatedAt='2026-07-19T00:00:00.000Z';
  values.set('image-set:test-client',JSON.stringify(stored));
  const response=await handleImages({request:new Request('https://admiranext.test/presentaciones/api/images?client=test-client'),env}),body=await response.json();
  assert.equal(response.status,200);
  assert.equal(body.imageSet.id,prepared.imageSet.id);
  assert.equal(body.imageSet.slides[0].status,'failed');
  assert.equal(body.imageSet.slides[0].retryable,true);
  assert.match(body.imageSet.slides[0].error,/10 minutos/);
});
