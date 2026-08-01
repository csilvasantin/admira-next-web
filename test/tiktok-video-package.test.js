const test = require('node:test');
const assert = require('node:assert/strict');

function kv(){
  const values = new Map();
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

function r2(){
  const objects = new Map();
  return {
    objects,
    async put(key, body, options){
      const bytes = new Uint8Array(await new Response(body).arrayBuffer());
      objects.set(key, {bytes, options});
    },
    async get(key){
      const value = objects.get(key);
      if(!value) return null;
      return {
        size:value.bytes.byteLength,
        body:new Blob([value.bytes]).stream(),
        writeHttpMetadata(headers){ headers.set('content-type', value.options.httpMetadata.contentType); }
      };
    },
    async head(key){
      const value = objects.get(key);
      if(!value) return null;
      return {
        size:value.bytes.byteLength,
        writeHttpMetadata(headers){ headers.set('content-type', value.options.httpMetadata.contentType); }
      };
    }
  };
}

test('guarda el master 25s en streaming y lo publica en Pixeria', async () => {
  const {onRequest} = await import('../functions/presentaciones/api/video-package.js');
  const store = kv();
  const media = r2();
  let publishBody;
  const bytes = new Uint8Array(2048).fill(7);
  const response = await onRequest({
    request:new Request('https://www.admiranext.com/presentaciones/api/video-package', {
      method:'POST',
      headers:{
        origin:'https://www.admiranext.com', 'content-type':'video/webm', 'content-length':String(bytes.byteLength),
        'x-client-request-id':'e8a65412-4fd3-4b58-9b66-f4bc15cb6d71', 'x-package-title':encodeURIComponent('Anuncio de pizzería · 25s')
      },
      body:bytes
    }),
    env:{
      PRESENTATION_IDEAS:store, PRESENTATION_MEDIA:media,
      PIXERIA_STOCK:{fetch:async request => {
        publishBody = await request.json();
        return Response.json({ok:true, id:'1754074100000-final', url:'https://api.admira.store/stock/asset/1754074100000-final'});
      }}
    }
  });
  const payload = await response.json();
  assert.equal(response.status, 201);
  assert.match(payload.id, /^pkg-[a-f0-9]{20}$/);
  assert.equal(payload.duration, 25);
  assert.equal(payload.pixeria.status, 'published');
  assert.equal(publishBody.type, 'video');
  assert.equal(publishBody.motor, 'ADmiraNeXT TikTok Composer');
  assert.match(publishBody.sourceUrl, /^https:\/\/www\.admiranext\.com\/tiktok\/media\/pkg-[a-f0-9]{20}\/[a-f0-9]{64}$/);
  assert.equal(media.objects.size, 1);
});

test('sirve el master únicamente mediante su ruta opaca', async () => {
  const {onRequest} = await import('../functions/tiktok/media/[[path]].js');
  const media = r2();
  const id = 'pkg-0123456789abcdefabcd';
  const token = 'a'.repeat(64);
  await media.put(`tiktok/packages/${id}-${token}.webm`, new Blob(['video']).stream(), {httpMetadata:{contentType:'video/webm'}});
  const found = await onRequest({
    request:new Request(`https://www.admiranext.com/tiktok/media/${id}/${token}`),
    env:{PRESENTATION_MEDIA:media}
  });
  assert.equal(found.status, 200);
  assert.equal(found.headers.get('content-type'), 'video/webm');
  assert.equal(await found.text(), 'video');

  const missing = await onRequest({
    request:new Request(`https://www.admiranext.com/tiktok/media/${id}/bad`),
    env:{PRESENTATION_MEDIA:media}
  });
  assert.equal(missing.status, 404);
});
