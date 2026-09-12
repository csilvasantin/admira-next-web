// Yokup #3199 (12-sep-2026): el creador manda con PATCH el póster representativo
// y el veredicto de la validación ANTES del máster; el publish al Stock los lleva.
import test from 'node:test';
import assert from 'node:assert/strict';

function kv(){
  const values = new Map();
  return {
    values,
    async get(key, options){ const v = values.get(key); if(v == null) return null; return options?.type === 'json' ? JSON.parse(v) : v; },
    async put(key, value){ values.set(key, value); }
  };
}
function r2(){
  const objects = new Map();
  return {
    objects,
    async put(key, body, options){ const bytes = new Uint8Array(await new Response(body).arrayBuffer()); objects.set(key, {bytes, options}); return {size:bytes.byteLength}; },
    async delete(key){ objects.delete(key); },
    async get(key){ const v = objects.get(key); if(!v) return null; return {size:v.bytes.byteLength, body:new Blob([v.bytes]).stream(), writeHttpMetadata(h){ h.set('content-type', v.options.httpMetadata.contentType); }}; },
    async head(key){ const v = objects.get(key); if(!v) return null; return {size:v.bytes.byteLength, writeHttpMetadata(h){ h.set('content-type', v.options.httpMetadata.contentType); }}; }
  };
}
const ORIGIN = 'https://www.admiranext.com';
const URL_API = `${ORIGIN}/presentaciones/api/video-package`;
const CLIENT_ID = 'e8a65412-4fd3-4b58-9b66-f4bc15cb6d99';
const POSTER = 'data:image/jpeg;base64,' + Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(900, 3)]).toString('base64');
const VALIDACION = {ok:true, negros:1, muestras:12, duracion:15.02, motivo:null, por:'creador admiranext (canvas)'};

function patch(body){
  const raw = JSON.stringify(body);
  return new Request(URL_API, {method:'PATCH', headers:{origin:ORIGIN, 'content-type':'application/json', 'content-length':String(Buffer.byteLength(raw))}, body:raw});
}

test('PATCH guarda póster+validación bajo el id del montaje y el POST los reenvía al Stock en el publish', async () => {
  const {onRequest} = await import('../functions/presentaciones/api/video-package.js');
  const store = kv();
  const media = r2();
  const env = {PRESENTATION_IDEAS:store, PRESENTATION_MEDIA:media, PIXERIA_INGEST_TOKEN:'t'};
  const prep = await onRequest({request:patch({clientRequestId:CLIENT_ID, poster:POSTER, posterAt:4.46, validacion:VALIDACION}), env});
  const prepBody = await prep.json();
  assert.equal(prep.status, 200, JSON.stringify(prepBody));
  assert.match(prepBody.id, /^pkg-[a-f0-9]{20}$/);
  assert.equal(prepBody.poster, true);
  assert.equal(prepBody.validacion.ok, true);
  assert.equal(prepBody.validacion.negros, 1);

  let publishBody;
  const bytes = new Uint8Array(2048).fill(9);
  const response = await onRequest({
    request:new Request(URL_API, {method:'POST', headers:{origin:ORIGIN, 'content-type':'video/webm', 'content-length':String(bytes.byteLength), 'x-client-request-id':CLIENT_ID}, body:bytes}),
    env,
    data:{pixeriaFetch:async request => {
      if(request.method === 'GET') return new Response(null, {status:404});
      publishBody = await request.json();
      return Response.json({ok:true, id:'1754074100000-final', url:'https://api.admira.store/stock/asset/1754074100000-final', poster:'https://api.admira.store/stock/poster/1754074100000-final'});
    }}
  });
  const payload = await response.json();
  assert.equal(response.status, 201, JSON.stringify(payload));
  assert.equal(payload.id, prepBody.id, 'el PATCH y el POST derivan el MISMO id del x-client-request-id');
  assert.equal(publishBody.poster, POSTER);
  assert.equal(publishBody.posterAt, 4.46);
  assert.deepEqual(publishBody.validacion, VALIDACION);
  assert.equal(payload.pixeria.status, 'published');
});

test('PATCH: id inválido → 400; póster que no es data URL JPEG/WebP → 400; sin póster ni validación → 400; sin origen propio → 403', async () => {
  const {onRequest} = await import('../functions/presentaciones/api/video-package.js');
  const env = {PRESENTATION_IDEAS:kv(), PRESENTATION_MEDIA:r2()};
  assert.equal((await onRequest({request:patch({clientRequestId:'nope', poster:POSTER}), env})).status, 400);
  assert.equal((await onRequest({request:patch({clientRequestId:CLIENT_ID, poster:'data:image/png;base64,AAAA'}), env})).status, 400);
  assert.equal((await onRequest({request:patch({clientRequestId:CLIENT_ID}), env})).status, 400);
  const ajeno = new Request(URL_API, {method:'PATCH', headers:{origin:'https://otro.example', 'content-type':'application/json', 'content-length':'2'}, body:'{}'});
  assert.equal((await onRequest({request:ajeno, env})).status, 403);
});

test('sin PATCH previo el POST publica igual, sin póster ni validación en el body', async () => {
  const {onRequest} = await import('../functions/presentaciones/api/video-package.js');
  let publishBody;
  const bytes = new Uint8Array(2048).fill(1);
  const response = await onRequest({
    request:new Request(URL_API, {method:'POST', headers:{origin:ORIGIN, 'content-type':'video/webm', 'content-length':String(bytes.byteLength), 'x-client-request-id':'e8a65412-4fd3-4b58-9b66-f4bc15cb6d98'}, body:bytes}),
    env:{PRESENTATION_IDEAS:kv(), PRESENTATION_MEDIA:r2(), PIXERIA_INGEST_TOKEN:'t'},
    data:{pixeriaFetch:async request => { if(request.method === 'GET') return new Response(null, {status:404}); publishBody = await request.json(); return Response.json({ok:true, id:'1-x', url:'https://api.admira.store/stock/asset/1-x'}); }}
  });
  assert.equal(response.status, 201);
  assert.equal('poster' in publishBody, false);
  assert.equal('validacion' in publishBody, false);
});
