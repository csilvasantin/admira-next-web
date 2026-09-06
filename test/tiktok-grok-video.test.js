// ESM (FLT-100016, 6-sep-2026): con `require` este fichero reventaba en `node --test` y no vigilaba nada.
import test from 'node:test';
import assert from 'node:assert/strict';

function kv(initial = {}){
  const values = new Map(Object.entries(initial));
  const puts = [];
  return {
    values,
    puts,
    async get(key, options){
      const value = values.get(key);
      if(value == null) return null;
      return options?.type === 'json' ? JSON.parse(value) : value;
    },
    async put(key, value, options){ puts.push({key, value, options}); values.set(key, value); }
  };
}

function request(method, body, id){
  const url = id
    ? `https://www.admiranext.com/presentaciones/api/grok-video?id=${encodeURIComponent(id)}`
    : 'https://www.admiranext.com/presentaciones/api/grok-video';
  return new Request(url, {
    method,
    headers:method !== 'GET' ? {'content-type':'application/json', origin:'https://www.admiranext.com', 'CF-Connecting-IP':'203.0.113.8'} : {},
    body:method !== 'GET' ? JSON.stringify(body) : undefined
  });
}

function pixeria(handler){
  return {fetch:handler};
}

test('crea un vídeo Grok 15s 9:16 sin exponer la clave', async (t) => {
  const {onRequest} = await import('../functions/presentaciones/api/grok-video.js');
  const originalFetch = global.fetch;
  let upstream;
  global.fetch = async (url, options) => {
    upstream = {url:String(url), options, body:JSON.parse(options.body)};
    return Response.json({request_id:'41eb9a5f-cbd4-9f21-8d59-79005f1e61b7'});
  };
  t.after(() => { global.fetch = originalFetch; });
  const ideas = kv();
  const env = {XAI_API_KEY:'secret-not-for-output', XAI_VIDEO_MODEL:'grok-imagine-video-1.5', PRESENTATION_IDEAS:ideas};
  const response = await onRequest({
    request:request('POST', {
      prompt:'Create a polished vertical sequence showing a compact robot turning a long document into one clear action. No text or logos.',
      resolution:'1080p',
      clientRequestId:'e8a65412-4fd3-4b58-9b66-f4bc15cb6d71'
    }),
    env
  });
  const payload = await response.json();

  assert.equal(response.status, 202);
  assert.equal(payload.requestId, '41eb9a5f-cbd4-9f21-8d59-79005f1e61b7');
  assert.equal(upstream.url, 'https://api.x.ai/v1/videos/generations');
  assert.equal(upstream.options.headers.authorization, 'Bearer secret-not-for-output');
  assert.deepEqual(upstream.body, {
    model:'grok-imagine-video-1.5',
    prompt:'Create a polished vertical sequence showing a compact robot turning a long document into one clear action. No text or logos.',
    duration:15,
    aspect_ratio:'9:16',
    resolution:'1080p'
  });
  assert.equal(JSON.stringify(payload).includes(env.XAI_API_KEY), false);
  assert.equal(JSON.stringify(payload).includes(upstream.body.prompt), false);
  const rateWrite = ideas.puts.find(({key}) => key.startsWith('tiktok:grok-video:rate:'));
  assert.equal(rateWrite.options.expirationTtl, 60);
});

test('al terminar publica una sola vez en Pixeria y devuelve ambos enlaces seguros', async (t) => {
  const {onRequest} = await import('../functions/presentaciones/api/grok-video.js');
  const originalFetch = global.fetch;
  global.fetch = async () => Response.json({
    status:'done', progress:100, model:'grok-imagine-video-1.5',
    video:{url:'https://vidgen.x.ai/output/demo.mp4', duration:15, respect_moderation:true},
    usage:{cost_in_usd_ticks:999999999}
  });
  t.after(() => { global.fetch = originalFetch; });
  const stock = kv();
  let publishCalls = 0;
  let publishedRequest;
  const env = {
    XAI_API_KEY:'secret',
    PIXERIA_INGEST_TOKEN:'shared-secret-not-for-output',
    PRESENTATION_IDEAS:stock,
    PIXERIA_STOCK:pixeria(async (req) => {
      publishCalls++;
      publishedRequest = {url:req.url, token:req.headers.get('x-admiranext-ingest'), body:await req.json()};
      return Response.json({ok:true, id:'auto-0123456789abcdefabcd', url:'https://api.admira.store/stock/asset/auto-0123456789abcdefabcd'});
    })
  };
  const first = await onRequest({request:request('GET', null, '41eb9a5f-cbd4-9f21-8d59-79005f1e61b7'), env});
  const payload = await first.json();
  const second = await onRequest({request:request('GET', null, '41eb9a5f-cbd4-9f21-8d59-79005f1e61b7'), env});
  const reused = await second.json();

  assert.equal(first.status, 200);
  assert.equal(payload.status, 'done');
  assert.equal(payload.video.url, 'https://vidgen.x.ai/output/demo.mp4');
  assert.deepEqual(payload.pixeria, {
    status:'published',
    id:'auto-0123456789abcdefabcd',
    assetUrl:'https://api.admira.store/stock/asset/auto-0123456789abcdefabcd',
    stockUrl:'https://www.pixeria.com/stock.html?highlight=auto-0123456789abcdefabcd'
  });
  assert.equal(publishedRequest.url, 'https://api.admira.store/stock/publish');
  assert.equal(publishedRequest.token, env.PIXERIA_INGEST_TOKEN);
  assert.equal(publishedRequest.body.sourceUrl, payload.video.url);
  assert.equal(publishedRequest.body.externalId, 'admiranext:grok-video:41eb9a5f-cbd4-9f21-8d59-79005f1e61b7');
  assert.equal(publishedRequest.body.prompt, '');
  assert.equal(publishCalls, 1);
  assert.equal(reused.pixeria.id, payload.pixeria.id);
  assert.equal(payload.usage, undefined);
  assert.equal(JSON.stringify(payload).includes('cost_in_usd_ticks'), false);
  assert.equal(JSON.stringify(payload).includes(env.PIXERIA_INGEST_TOKEN), false);
});

test('un fallo de Pixeria conserva el vídeo y permite reintentar sin regenerarlo', async (t) => {
  const {onRequest} = await import('../functions/presentaciones/api/grok-video.js');
  const originalFetch = global.fetch;
  let xaiCalls = 0;
  global.fetch = async () => {
    xaiCalls++;
    return Response.json({status:'done', progress:100, video:{url:'https://vidgen.x.ai/output/retry.mp4', duration:15}});
  };
  t.after(() => { global.fetch = originalFetch; });
  let stockCalls = 0;
  const env = {
    XAI_API_KEY:'secret', PIXERIA_INGEST_TOKEN:'shared-secret', PRESENTATION_IDEAS:kv(),
    PIXERIA_STOCK:pixeria(async () => {
      stockCalls++;
      if(stockCalls === 1) return Response.json({error:'temporary'}, {status:503});
      return Response.json({ok:true, id:'auto-fedcba9876543210abcd', url:'https://api.admira.store/stock/asset/auto-fedcba9876543210abcd'});
    })
  };
  const first = await onRequest({request:request('GET', null, '41eb9a5f-cbd4-9f21-8d59-79005f1e61b7'), env});
  const failed = await first.json();
  assert.equal(failed.status, 'done');
  assert.equal(failed.video.url, 'https://vidgen.x.ai/output/retry.mp4');
  assert.equal(failed.pixeria.status, 'failed');

  const retry = await onRequest({request:request('PUT', {requestId:'41eb9a5f-cbd4-9f21-8d59-79005f1e61b7'}), env});
  const published = await retry.json();
  assert.equal(retry.status, 200);
  assert.equal(published.pixeria.status, 'published');
  assert.equal(stockCalls, 2);
  assert.equal(xaiCalls, 2);
});

test('falla cerrado ante origen ajeno, falta de clave y URL final no segura', async (t) => {
  const {onRequest} = await import('../functions/presentaciones/api/grok-video.js');
  const foreign = request('POST', {
    prompt:'A sufficiently detailed vertical video prompt that would otherwise be valid for generation.',
    resolution:'720p', clientRequestId:'e8a65412-4fd3-4b58-9b66-f4bc15cb6d71'
  });
  foreign.headers.set('origin', 'https://evil.example');
  assert.equal((await onRequest({request:foreign, env:{XAI_API_KEY:'secret'}})).status, 403);

  const noKey = await onRequest({request:request('POST', {
    prompt:'A sufficiently detailed vertical video prompt that would otherwise be valid for generation.',
    resolution:'720p', clientRequestId:'e8a65412-4fd3-4b58-9b66-f4bc15cb6d71'
  }), env:{}});
  assert.equal(noKey.status, 503);

  const originalFetch = global.fetch;
  global.fetch = async () => Response.json({status:'done', progress:100, video:{url:'https://evil.example/video.mp4', duration:15}});
  t.after(() => { global.fetch = originalFetch; });
  const unsafe = await onRequest({request:request('GET', null, '41eb9a5f-cbd4-9f21-8d59-79005f1e61b7'), env:{XAI_API_KEY:'secret'}});
  assert.equal(unsafe.status, 502);
});
