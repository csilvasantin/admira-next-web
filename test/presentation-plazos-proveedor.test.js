// FLT-100766 a (Morfeo, 21-sep-2026) · ninguna llamada a xAI sin reloj.
//
// El guion (_skeleton.js) y el análisis de la web ya cortaban a su plazo; la
// traducción, las imágenes de lámina y el vídeo no. Un cuelgue del proveedor dejaba
// el alta «Construyendo el relato…» sin fin, la lámina en 'processing' 10 minutos y el
// sondeo del vídeo sin respuesta.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {generateTranslations, TRANSLATION_TIMEOUT_MS} from '../functions/presentaciones/api/generate.js';
import {IMAGE_TIMEOUT_MS, VALIDATION_TIMEOUT_MS} from '../functions/presentaciones/api/images.js';
import {VIDEO_CREATE_TIMEOUT_MS, VIDEO_STATUS_TIMEOUT_MS, VIDEO_DOWNLOAD_TIMEOUT_MS} from '../functions/presentaciones/api/grok-video.js';

const ideas = {
  hero:{eyebrow:'E', title:'Título', summary:'Resumen'}, objective:'Objetivo',
  skeleton:[{id:'uno', title:'Uno', message:'Mensaje', detail:'Detalle'}],
  closing:{title:'Cierre', action:'Acción'}, labels:{objective:'Objetivo', next:'Siguiente'}
};

async function conFetch(falso, cuerpo){
  const original = globalThis.fetch;
  globalThis.fetch = falso;
  try { return await cuerpo(); } finally { globalThis.fetch = original; }
}

test('la traducción viaja con un plazo y, si vence, lo dice con los segundos', async () => {
  let senal = null;
  const error = await conFetch(async (_url, init) => {
    senal = init?.signal;
    throw new DOMException('The operation was aborted due to timeout', 'TimeoutError');
  }, () => generateTranslations({XAI_API_KEY:'k'}, ideas, ['es', 'en']).then(() => null, e => e));
  assert.ok(senal instanceof AbortSignal, 'la petición a xAI lleva AbortSignal');
  assert.ok(error, 'un plazo vencido rechaza la traducción (y el alta la degrada a translationPending)');
  assert.match(error.message, new RegExp(`no respondió a tiempo con la traducción \\(${TRANSLATION_TIMEOUT_MS / 1000} s\\)`));
});

test('un fallo de red en la traducción no se disfraza de plazo', async () => {
  const error = await conFetch(async () => { throw new TypeError('fetch failed'); },
    () => generateTranslations({XAI_API_KEY:'k'}, ideas, ['es', 'en']).then(() => null, e => e));
  assert.match(error.message, /No se pudo llegar a xAI para traducir/);
});

test('una respuesta que no es JSON se explica, no revienta con un SyntaxError', async () => {
  const error = await conFetch(async () => new Response('<html>gateway</html>', {status:200, headers:{'content-type':'text/html'}}),
    () => generateTranslations({XAI_API_KEY:'k'}, ideas, ['es', 'en']).then(() => null, e => e));
  assert.match(error.message, /La traducción no devolvió un resultado válido/);
});

test('los plazos son razonables: ni tan cortos que corten trabajo real ni eternos', () => {
  for (const [nombre, ms] of Object.entries({TRANSLATION_TIMEOUT_MS, IMAGE_TIMEOUT_MS, VALIDATION_TIMEOUT_MS, VIDEO_CREATE_TIMEOUT_MS, VIDEO_STATUS_TIMEOUT_MS, VIDEO_DOWNLOAD_TIMEOUT_MS})) {
    assert.ok(ms >= 15000 && ms <= 180000, `${nombre}=${ms}`);
  }
});

test('imágenes y vídeo: cada fetch a xAI lleva su señal, y un plazo vencido de lámina se reintenta', async () => {
  const imagenes = await readFile(new URL('../functions/presentaciones/api/images.js', import.meta.url), 'utf8');
  assert.equal((imagenes.match(/await xaiFetch\('https:\/\/api\.x\.ai/g) || []).length, 2);
  assert.doesNotMatch(imagenes, /await fetch\('https:\/\/api\.x\.ai/);
  assert.match(imagenes, /\['visible_text_detected', 'provider_timeout'\]\.includes\(slide\.errorCode\)/);
  const video = await readFile(new URL('../functions/presentaciones/api/grok-video.js', import.meta.url), 'utf8');
  assert.equal((video.match(/signal:AbortSignal\.timeout\(VIDEO_/g) || []).length, 3);
  // La descarga del bruto mira el tamaño anunciado antes de leer el cuerpo.
  assert.ok(video.indexOf("origen.headers.get('content-length')") < video.indexOf('await origen.arrayBuffer()'));
  // Y el sondeo de TikTok trata el 504 como pasajero, igual que el 429.
  const tiktok = await readFile(new URL('../tiktok/app.js', import.meta.url), 'utf8');
  assert.match(tiktok, /error\?\.status === 429 \|\| error\?\.status === 504/);
});

test('el formulario del generador cuenta los segundos, tiene techo y avisa del idioma sin traducir', async () => {
  const cliente = await readFile(new URL('../assets/presentation-generator-20260721-11.js', import.meta.url), 'utf8');
  assert.match(cliente, /const CREATE_TIMEOUT_MS=5\*60\*1000/);
  assert.match(cliente, /signal:AbortSignal\.timeout\(CREATE_TIMEOUT_MS\)/);
  assert.match(cliente, /mira la galería antes de volver a generar/);
  assert.match(cliente, /body\.translationPending/);
  const api = await readFile(new URL('../functions/presentaciones/api/generate.js', import.meta.url), 'utf8');
  assert.match(api, /translationPending:ideas\.translationPending\|\|\[\]/);
});
