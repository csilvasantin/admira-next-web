const test = require('node:test');
const assert = require('node:assert/strict');

function kv(initial = {}){
  const values = new Map(Object.entries(initial));
  return {
    values,
    async get(key, options){
      const value = values.get(key);
      if(value == null) return null;
      return options?.type === 'json' ? JSON.parse(value) : value;
    },
    async put(key, value){ values.set(key, value); }
  };
}

function request(method, body, id){
  const url = id
    ? `https://www.admiranext.com/presentaciones/api/grok-video?id=${encodeURIComponent(id)}`
    : 'https://www.admiranext.com/presentaciones/api/grok-video';
  return new Request(url, {
    method,
    headers:method === 'POST' ? {'content-type':'application/json', origin:'https://www.admiranext.com', 'CF-Connecting-IP':'203.0.113.8'} : {},
    body:method === 'POST' ? JSON.stringify(body) : undefined
  });
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
  const env = {XAI_API_KEY:'secret-not-for-output', XAI_VIDEO_MODEL:'grok-imagine-video-1.5', PRESENTATION_IDEAS:kv()};
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
});

test('consulta el trabajo y devuelve solo una URL x.ai segura', async (t) => {
  const {onRequest} = await import('../functions/presentaciones/api/grok-video.js');
  const originalFetch = global.fetch;
  global.fetch = async () => Response.json({
    status:'done', progress:100, model:'grok-imagine-video-1.5',
    video:{url:'https://vidgen.x.ai/output/demo.mp4', duration:15, respect_moderation:true},
    usage:{cost_in_usd_ticks:999999999}
  });
  t.after(() => { global.fetch = originalFetch; });
  const response = await onRequest({request:request('GET', null, '41eb9a5f-cbd4-9f21-8d59-79005f1e61b7'), env:{XAI_API_KEY:'secret'}});
  const payload = await response.json();

  assert.equal(response.status, 200);
  assert.equal(payload.status, 'done');
  assert.equal(payload.video.url, 'https://vidgen.x.ai/output/demo.mp4');
  assert.equal(payload.usage, undefined);
  assert.equal(JSON.stringify(payload).includes('cost_in_usd_ticks'), false);
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
