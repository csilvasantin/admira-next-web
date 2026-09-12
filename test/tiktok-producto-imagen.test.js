// ESM. FLT-100318 (12-sep-2026): el deep-link ?producto= trae `imagen` (foto
// real del folleto). La foto va DENTRO del anuncio: miniatura en la ficha,
// tarjeta en el overlay del máster y referencia de imagen para Grok.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const JPEG = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01]);
const IMAGEN = 'https://admira.tv/contentcatalogue/api/imagen/alcampo-2026-09-10/coca-cola';

function kv(){
  const values = new Map();
  return { async get(k, o){ const v = values.get(k); return v == null ? null : o?.type === 'json' ? JSON.parse(v) : v; }, async put(k, v){ values.set(k, v); } };
}
function request(body){
  return new Request('https://www.admiranext.com/presentaciones/api/grok-video', {
    method:'POST', headers:{'content-type':'application/json', origin:'https://www.admiranext.com', 'CF-Connecting-IP':'203.0.113.8'}, body:JSON.stringify(body)
  });
}
const PROMPT = 'Create a polished vertical sequence showing a can of Coca-Cola on a kitchen table at golden hour, slow push-in, no text.';

test('solo se aceptan URLs https de casa; el resto se ignora sin romper', async () => {
  const {urlImagenProducto} = await import('../functions/presentaciones/api/_imagen-producto.mjs');
  assert.equal(urlImagenProducto(IMAGEN), IMAGEN);
  assert.equal(urlImagenProducto('https://api.admira.store/stock/asset/1782745194419-luxbg4'), 'https://api.admira.store/stock/asset/1782745194419-luxbg4');
  assert.equal(urlImagenProducto('http://admira.tv/contentcatalogue/api/imagen/a/b'), '', 'http no');
  assert.equal(urlImagenProducto('https://evil.example/imagen.jpg'), '', 'fuera de casa no');
  assert.equal(urlImagenProducto('https://user:pw@admira.tv/x'), '', 'sin credenciales');
  assert.equal(urlImagenProducto('javascript:alert(1)'), '');
  assert.equal(urlImagenProducto(null), '');
});

test('el prompt con referencia dice que el producto es el de la imagen y cabe en 3200', async () => {
  const {promptConReferencia, FRASE_REFERENCIA} = await import('../functions/presentaciones/api/_imagen-producto.mjs');
  assert.equal(promptConReferencia(PROMPT, false), PROMPT);
  const con = promptConReferencia(PROMPT, true);
  assert.ok(con.startsWith(PROMPT));
  assert.match(con, /imagen de referencia/);
  assert.match(con, /sin alterarlo ni inventar otro envase/);
  assert.ok(con.endsWith(FRASE_REFERENCIA));
  assert.ok(promptConReferencia('x'.repeat(3200), true).length <= 3200);
});

test('la descarga devuelve data URI solo si es una imagen admitida y de tamaño razonable', async () => {
  const {descargarImagenProducto, MAX_IMAGEN_BYTES} = await import('../functions/presentaciones/api/_imagen-producto.mjs');
  const jpeg = async () => new Response(JPEG, {status:200, headers:{'content-type':'image/jpeg'}});
  const ok = await descargarImagenProducto(IMAGEN, jpeg);
  assert.equal(ok.contentType, 'image/jpeg');
  assert.equal(ok.bytes, JPEG.length);
  assert.ok(ok.dataUrl.startsWith('data:image/jpeg;base64,/9j/4AAQSkZJRgAB'));
  assert.equal(await descargarImagenProducto(IMAGEN, async () => new Response('no', {status:404})), null);
  assert.equal(await descargarImagenProducto(IMAGEN, async () => new Response('<html>', {status:200, headers:{'content-type':'text/html'}})), null);
  assert.equal(await descargarImagenProducto(IMAGEN, async () => new Response(JPEG, {status:200, headers:{'content-type':'image/jpeg', 'content-length':String(MAX_IMAGEN_BYTES + 1)}})), null);
  assert.equal(await descargarImagenProducto(IMAGEN, async () => { throw new Error('red'); }), null);
  assert.equal(await descargarImagenProducto('https://evil.example/x.jpg', jpeg), null, 'ni se intenta fuera de casa');
});

test('con imagen, Grok recibe la foto como referencia (data URI) y el prompt lo dice', async (t) => {
  const {onRequest} = await import('../functions/presentaciones/api/grok-video.js');
  const originalFetch = global.fetch;
  const llamadas = [];
  global.fetch = async (url, options) => {
    if(String(url) === IMAGEN) return new Response(JPEG, {status:200, headers:{'content-type':'image/jpeg'}});
    llamadas.push(JSON.parse(options.body));
    return Response.json({request_id:'41eb9a5f-cbd4-9f21-8d59-79005f1e61b7'});
  };
  t.after(() => { global.fetch = originalFetch; });
  const response = await onRequest({request:request({prompt:PROMPT, resolution:'720p', clientRequestId:'e8a65412-4fd3-4b58-9b66-f4bc15cb6d71', imagen:IMAGEN}), env:{XAI_API_KEY:'k', PRESENTATION_IDEAS:kv()}});
  const payload = await response.json();
  assert.equal(response.status, 202);
  assert.equal(payload.imagen, 'referencia');
  assert.equal(llamadas.length, 1);
  assert.ok(llamadas[0].image.url.startsWith('data:image/jpeg;base64,'));
  assert.match(llamadas[0].prompt, /imagen de referencia/);
  assert.equal(llamadas[0].duration, 15);
  assert.equal(llamadas[0].aspect_ratio, '9:16');
});

test('si Grok rechaza la data URI prueba la URL pública y, si no, sin imagen', async (t) => {
  const {onRequest} = await import('../functions/presentaciones/api/grok-video.js');
  const originalFetch = global.fetch;
  const llamadas = [];
  global.fetch = async (url, options) => {
    if(String(url) === IMAGEN) return new Response(JPEG, {status:200, headers:{'content-type':'image/jpeg'}});
    const body = JSON.parse(options.body);
    llamadas.push(body);
    if(body.image) return Response.json({error:'image not supported'}, {status:400});
    return Response.json({request_id:'41eb9a5f-cbd4-9f21-8d59-79005f1e61b7'});
  };
  t.after(() => { global.fetch = originalFetch; });
  const response = await onRequest({request:request({prompt:PROMPT, resolution:'720p', clientRequestId:'e8a65412-4fd3-4b58-9b66-f4bc15cb6d72', imagen:IMAGEN}), env:{XAI_API_KEY:'k', PRESENTATION_IDEAS:kv()}});
  const payload = await response.json();
  assert.equal(response.status, 202);
  assert.equal(payload.imagen, 'rechazada');
  assert.equal(llamadas.length, 3);
  assert.ok(llamadas[0].image.url.startsWith('data:'));
  assert.equal(llamadas[1].image.url, IMAGEN);
  assert.equal(llamadas[2].image, undefined);
  assert.equal(llamadas[2].prompt, PROMPT, 'sin imagen, el prompt no promete una referencia');
});

test('si la foto no se puede descargar, el vídeo sale como siempre (sin referencia)', async (t) => {
  const {onRequest} = await import('../functions/presentaciones/api/grok-video.js');
  const originalFetch = global.fetch;
  const llamadas = [];
  global.fetch = async (url, options) => {
    if(String(url) === IMAGEN) return new Response('', {status:503});
    llamadas.push(JSON.parse(options.body));
    return Response.json({request_id:'41eb9a5f-cbd4-9f21-8d59-79005f1e61b7'});
  };
  t.after(() => { global.fetch = originalFetch; });
  const response = await onRequest({request:request({prompt:PROMPT, resolution:'720p', clientRequestId:'e8a65412-4fd3-4b58-9b66-f4bc15cb6d73', imagen:IMAGEN}), env:{XAI_API_KEY:'k', PRESENTATION_IDEAS:kv()}});
  const payload = await response.json();
  assert.equal(response.status, 202);
  assert.equal(payload.imagen, 'no-descargada');
  assert.equal(llamadas.length, 1);
  assert.equal(llamadas[0].image, undefined);
  assert.equal(llamadas[0].prompt, PROMPT);
});

test('el estudio lee `imagen`, la precarga con crossOrigin, la enseña en la ficha y la pinta en el máster', async () => {
  const app = await readFile(new URL('../tiktok/app.js', import.meta.url), 'utf8');
  assert.match(app, /imagen:urlImagenProducto\(p\.imagen\)/, 'el deep-link trae la foto');
  assert.match(app, /img\.crossOrigin = 'anonymous';/, 'sin crossOrigin el lienzo del máster se mancha');
  assert.match(app, /img\.onerror = \(\) => \{ imagenProducto = null; \};/, 'si falla, overlay sin imagen');
  assert.match(app, /catalog-product-figure/, 'miniatura en la ficha');
  assert.match(app, /function drawTarjetaProducto\(ctx, p, foto, seconds, k, zona\)/);
  assert.match(app, /const esc = 0\.9 \+ 0\.1 \* \(1 - Math\.pow\(1 - entrada, 3\)\);/, 'entrada 0.9→1');
  assert.match(app, /seconds \/ 0\.4/, 'en 0,4 s');
  assert.match(app, /imagen:productoCatalogo\.imagen/, 'la foto viaja a grok-video');
  const css = await readFile(new URL('../tiktok/styles.css', import.meta.url), 'utf8');
  assert.match(css, /\.catalog-product-figure img/);
});

test('el director creativo sabe que la foto real irá en pantalla', async () => {
  const src = await readFile(new URL('../functions/presentaciones/api/ad-idea.js', import.meta.url), 'utf8');
  assert.match(src, /La foto REAL del producto irá en pantalla dentro del anuncio: no describas otro packaging/);
});
