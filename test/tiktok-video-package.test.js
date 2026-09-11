// ESM (FLT-100016, 6-sep-2026): con `require` este fichero reventaba en `node --test` y no vigilaba nada.
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import fs from 'node:fs';
import test from 'node:test';
import assert from 'node:assert/strict';
const __dirname = path.dirname(fileURLToPath(import.meta.url));

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
      return {size:bytes.byteLength};
    },
    async delete(key){ objects.delete(key); },
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
  const request = new Request('https://www.admiranext.com/presentaciones/api/video-package', {
      method:'POST',
      headers:{
        origin:'https://www.admiranext.com', 'content-type':'video/webm', 'content-length':String(bytes.byteLength),
        'x-client-request-id':'e8a65412-4fd3-4b58-9b66-f4bc15cb6d71', 'x-package-title':encodeURIComponent('Anuncio de pizzería · 25s')
      },
      body:bytes
    });
  const nativeRequestBody = request.body;
  const originalPut = media.put.bind(media);
  media.put = async (key, body, options) => {
    assert.equal(body, nativeRequestBody, 'R2 debe recibir el body nativo con longitud conocida, no un TransformStream');
    return originalPut(key, body, options);
  };
  const response = await onRequest({
    request,
    env:{
      PRESENTATION_IDEAS:store, PRESENTATION_MEDIA:media, PIXERIA_INGEST_TOKEN:'test-ingest-token',
    },
    data:{
      pixeriaFetch:async request => {
        if(request.method === 'GET') return new Response(null, {status:404});
        assert.equal(request.headers.get('x-admiranext-ingest'), 'test-ingest-token');
        publishBody = await request.json();
        assert.match(publishBody.contentHash, /^[a-f0-9]{64}$/, 'el publish lleva el sha256 del máster');
        return Response.json({ok:true, id:'1754074100000-final', url:'https://api.admira.store/stock/asset/1754074100000-final'});
      }
    }
  });
  const payload = await response.json();
  assert.equal(response.status, 201);
  assert.match(payload.id, /^pkg-[a-f0-9]{20}$/);
  assert.equal(payload.duration, 25);
  assert.equal(payload.pixeria.status, 'published');
  assert.equal(publishBody.type, 'video');
  assert.equal(publishBody.motor, 'ADmiraNeXT TikTok Composer');
  assert.match(publishBody.externalId, /^admiranext:tiktok-package:pkg-[a-f0-9]{20}$/);
  assert.equal(publishBody.mime, 'video/webm');
  assert.match(publishBody.sourceUrl, /^https:\/\/www\.admiranext\.com\/tiktok\/media\/pkg-[a-f0-9]{20}\/[a-f0-9]{64}$/);
  assert.equal(media.objects.size, 1);
});

test('elimina un master cuya longitud almacenada no coincide con la declarada', async () => {
  const {onRequest} = await import('../functions/presentaciones/api/video-package.js');
  const store = kv();
  const media = r2();
  const originalPut = media.put.bind(media);
  media.put = async (key, body, options) => {
    const stored = await originalPut(key, body, options);
    return {...stored, size:stored.size - 1};
  };
  const bytes = new Uint8Array(2048).fill(3);
  const response = await onRequest({
    request:new Request('https://www.admiranext.com/presentaciones/api/video-package', {
      method:'POST',
      headers:{
        'content-type':'video/webm', 'content-length':String(bytes.byteLength),
        'x-client-request-id':'e8a65412-4fd3-4b58-9b66-f4bc15cb6d73'
      },
      body:bytes
    }),
    env:{PRESENTATION_IDEAS:store, PRESENTATION_MEDIA:media}
  });
  const payload = await response.json();
  assert.equal(response.status, 400);
  assert.equal(payload.code, 'package_size_mismatch');
  assert.equal(media.objects.size, 0);
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

test('el compositor mantiene un reloj de audio durante preroll, anuncio y postroll', async () => {
  const source = fs.readFileSync(path.join(__dirname, '../tiktok/app.js'), 'utf8');
  assert.match(source, /packageAudioContext\.createMediaStreamDestination\(\)/);
  assert.match(source, /packageAudioClock\.connect\(silentGain\)\.connect\(destination\)/);
  assert.match(source, /silentGain\.gain\.value = 0/);
  assert.match(source, /packageAudioContext\.createMediaStreamSource\(sourceStream\)\.connect\(destination\)/);
  assert.match(source, /await packageAudioContext\.close\(\)/);
  assert.match(source, /Seed the canvas before captureStream\(\)/);
  assert.ok(source.indexOf("drawRollFrame(ctx, 'pre', 0") < source.indexOf('const stream = canvas.captureStream(30)'), 'el primer fotograma debe existir antes de capturar el canvas');
});

// Identidad estable ocupada (reused): el máster nuevo sustituye a la pieza vieja
// (p. ej. el bruto «sin rótulo» publicado como fallback en Xtore · Puerta Cam).
test('si el Stock reutiliza la identidad estable, retira la pieza vieja y publica el máster nuevo', async () => {
  const {onRequest} = await import('../functions/presentaciones/api/video-package.js');
  const store = kv();
  const media = r2();
  const calls = [];
  const bytes = new Uint8Array(2048).fill(9);
  const ficha = {title:'Aparca. Entra. Estrena. · Xtore · coche', comment:'Xtore · Puerta Cam', tags:['xtore'], externalId:'admiranext:xtore:coche'};
  const response = await onRequest({
    request:new Request('https://www.admiranext.com/presentaciones/api/video-package', {
      method:'POST',
      headers:{
        origin:'https://www.admiranext.com', 'content-type':'video/mp4', 'content-length':String(bytes.byteLength),
        'x-client-request-id':'2b1c7e40-6d2a-4c1e-9a3f-0f2e9c8d7b6a', 'x-package-ficha':encodeURIComponent(JSON.stringify(ficha))
      },
      body:bytes
    }),
    env:{PRESENTATION_IDEAS:store, PRESENTATION_MEDIA:media, PIXERIA_INGEST_TOKEN:'t'},
    data:{
      pixeriaFetch:async request => {
        calls.push(`${request.method} ${new URL(request.url).pathname}`);
        if(request.method === 'GET' && new URL(request.url).pathname === '/stock/exists') return new Response('caído', {status:503}); // worker sin /stock/exists → Range
        if(request.method === 'GET') return new Response(null, {status:206}); // ya existe: se sustituirá
        if(request.method === 'DELETE'){
          assert.equal(request.headers.get('x-admiranext-ingest'), 't', 'el DELETE del Stock exige la misma cabecera que el publish');
          return Response.json({ok:true, id:'auto-9a75882d2e3a36bce8e6', deleted:2});
        }
        const body = await request.json();
        assert.equal(body.externalId, 'admiranext:xtore:coche');
        return Response.json(calls.filter(c => c.startsWith('POST')).length === 1 // primer publish: worker antiguo dice reused sin reason
          ? {ok:true, reused:true, id:'auto-9a75882d2e3a36bce8e6', url:'https://api.admira.store/stock/asset/auto-9a75882d2e3a36bce8e6'}
          : {ok:true, id:'auto-9a75882d2e3a36bce8e6', url:'https://api.admira.store/stock/asset/auto-9a75882d2e3a36bce8e6'});
      }
    }
  });
  const payload = await response.json();
  assert.equal(response.status, 201);
  assert.equal(payload.pixeria.status, 'published');
  assert.equal(payload.pixeria.sustituye, 'auto-9a75882d2e3a36bce8e6', 'la UI sabe que sustituye a la pieza anterior');
  assert.deepEqual(calls, ['GET /stock/exists', 'GET /stock/asset/auto-9a75882d2e3a36bce8e6', 'POST /stock/publish', 'DELETE /stock/auto-9a75882d2e3a36bce8e6', 'POST /stock/publish']);
});

// Stock v.11.09.2026.r1: /stock/exists + dedup por externalId y contentHash.
function peticionMaster(ficha, clientId, fill){
  const bytes = new Uint8Array(2048).fill(fill);
  return new Request('https://www.admiranext.com/presentaciones/api/video-package', {
    method:'POST',
    headers:{origin:'https://www.admiranext.com', 'content-type':'video/mp4', 'content-length':String(bytes.byteLength), 'x-client-request-id':clientId, 'x-package-ficha':encodeURIComponent(JSON.stringify(ficha))},
    body:bytes
  });
}
const FICHA_COCHE = {title:'Aparca. Entra. Estrena. · Xtore · coche', comment:'Xtore · Puerta Cam', tags:['xtore'], externalId:'admiranext:xtore:coche'};

test('con /stock/exists: la identidad ya existe con otro contenido → el Stock responde replaced y no se borra nada', async () => {
  const {onRequest} = await import('../functions/presentaciones/api/video-package.js');
  const calls = [];
  const response = await onRequest({
    request:peticionMaster(FICHA_COCHE, '6d4e2a10-7b1c-4d2e-9f30-1a2b3c4d5e6f', 4),
    env:{PRESENTATION_IDEAS:kv(), PRESENTATION_MEDIA:r2(), PIXERIA_INGEST_TOKEN:'t'},
    data:{pixeriaFetch:async request => {
      const url = new URL(request.url);
      calls.push(`${request.method} ${url.pathname}`);
      if(url.pathname === '/stock/exists'){
        assert.equal(url.searchParams.get('externalId'), 'admiranext:xtore:coche');
        return Response.json({ok:true, exists:true, by:'externalId', id:'auto-9a75882d2e3a36bce8e6', url:'https://api.admira.store/stock/asset/auto-9a75882d2e3a36bce8e6', contentHash:'0'.repeat(64)});
      }
      const body = await request.json();
      assert.match(body.contentHash, /^[a-f0-9]{64}$/);
      return Response.json({ok:true, id:'auto-9a75882d2e3a36bce8e6', url:'https://api.admira.store/stock/asset/auto-9a75882d2e3a36bce8e6', contentHash:body.contentHash, replaced:true, reason:'content_changed'});
    }}
  });
  const payload = await response.json();
  assert.equal(payload.pixeria.status, 'published');
  assert.equal(payload.pixeria.sustituye, 'auto-9a75882d2e3a36bce8e6');
  assert.equal(payload.pixeria.reason, 'content_changed');
  assert.equal(payload.pixeria.reutilizado, undefined);
  assert.deepEqual(calls, ['GET /stock/exists', 'POST /stock/publish'], 'sin DELETE ni segundo publish: el Stock ya sustituyó');
});

test('con /stock/exists: publish repetido idéntico → reused con reason, sin crear asset ni borrar', async () => {
  const {onRequest} = await import('../functions/presentaciones/api/video-package.js');
  const calls = [];
  let hashEnviado = '';
  const response = await onRequest({
    request:peticionMaster(FICHA_COCHE, '9f8e7d6c-5b4a-4c3d-8e2f-1a0b9c8d7e6f', 4),
    env:{PRESENTATION_IDEAS:kv(), PRESENTATION_MEDIA:r2(), PIXERIA_INGEST_TOKEN:'t'},
    data:{pixeriaFetch:async request => {
      const url = new URL(request.url);
      calls.push(`${request.method} ${url.pathname}`);
      if(url.pathname === '/stock/exists') return Response.json({ok:true, exists:true, by:'externalId', id:'auto-9a75882d2e3a36bce8e6', url:'https://api.admira.store/stock/asset/auto-9a75882d2e3a36bce8e6', contentHash:'8f3e2f8b3b1b3ad6e0d4d3b62d5e2a2f5b3c9d7e6f1a2b3c4d5e6f708192a3b4'});
      hashEnviado = (await request.json()).contentHash;
      return Response.json({ok:true, reused:true, reason:'identical_content', id:'auto-9a75882d2e3a36bce8e6', url:'https://api.admira.store/stock/asset/auto-9a75882d2e3a36bce8e6', contentHash:hashEnviado});
    }}
  });
  const payload = await response.json();
  assert.equal(payload.pixeria.status, 'published');
  assert.equal(payload.pixeria.reutilizado, true);
  assert.equal(payload.pixeria.reason, 'identical_content');
  assert.equal(payload.pixeria.sustituye, undefined, 'reused no es sustitución');
  assert.equal(payload.contentHash, hashEnviado);
  assert.deepEqual(calls, ['GET /stock/exists', 'POST /stock/publish']);
});

test('sin identidad propia no se retira nada aunque el Stock diga reused', async () => {
  const {onRequest} = await import('../functions/presentaciones/api/video-package.js');
  const calls = [];
  const bytes = new Uint8Array(2048).fill(1);
  const response = await onRequest({
    request:new Request('https://www.admiranext.com/presentaciones/api/video-package', {
      method:'POST',
      headers:{origin:'https://www.admiranext.com', 'content-type':'video/mp4', 'content-length':String(bytes.byteLength), 'x-client-request-id':'5c0d2f11-1a2b-4c3d-8e4f-6a7b8c9d0e1f'},
      body:bytes
    }),
    env:{PRESENTATION_IDEAS:kv(), PRESENTATION_MEDIA:r2(), PIXERIA_INGEST_TOKEN:'t'},
    data:{pixeriaFetch:async request => { calls.push(request.method); return request.method === 'GET' ? new Response(null, {status:404}) : Response.json({ok:true, reused:true, id:'auto-0123456789abcdef0123', url:'https://api.admira.store/stock/asset/auto-0123456789abcdef0123'}); }}
  });
  assert.equal((await response.json()).pixeria.status, 'published');
  assert.deepEqual(calls, ['POST'], 'sin identidad propia ni se pregunta ni se retira nada');
});
