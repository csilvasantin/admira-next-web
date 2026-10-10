// Norma 31 · la vista previa #5552 (PR #161/#162) vive en /pruebas: nada público, la solicitud solo con sesión.
import test from 'node:test';
import assert from 'node:assert/strict';
import {existsSync, readFileSync} from 'node:fs';
import {onRequest} from '../functions/pruebas/_middleware.js';
import {onRequestPost} from '../functions/pruebas/api/solicitud.js';

const leer = (p) => readFileSync(new URL('../' + p, import.meta.url), 'utf8');
const env = {WEBMASTER_SIGNING_KEY: 'k'};
const siguiente = () => { throw new Error('no debe llegar sin sesión'); };

test('la parte pública no tiene la demo ni la solicitud; /demo enlaza la de pruebas', () => {
  assert.ok(!existsSync(new URL('../marcablanca/vista/index.html', import.meta.url)));
  assert.ok(!existsSync(new URL('../functions/marcablanca/api/solicitud.js', import.meta.url)));
  const demo = leer('demo/index.html');
  assert.match(demo, /href="\/pruebas\/marcablanca\/vista\/"/);
  assert.doesNotMatch(demo, /href="\/marcablanca\/vista\/"/);
});

test('la copia de /pruebas es noindex, cinco patas, y solo llama a /pruebas/api/solicitud', () => {
  assert.match(leer('pruebas/marcablanca/vista/index.html'), /noindex, nofollow/);
  const js = leer('pruebas/marcablanca/vista/vista.js');
  assert.match(js, /fetch\('\/pruebas\/api\/solicitud'/);
  assert.doesNotMatch(js, /\/marcablanca\/api\/solicitud/);
  assert.match(js, /id: 'store'[\s\S]*id: 'tv'[\s\S]*id: 'app'[\s\S]*id: 'studio'[\s\S]*id: 'biz'/);
  assert.doesNotMatch(js, /id: 'yokup'/);
  assert.doesNotMatch(js, /pixeria/i);
  assert.match(js, /data-plataforma="\$\{p\.id\}"/);
});

test('la URL pública avisa y lleva a la vista con sesión', async () => {
  const {onRequest} = await import('../functions/marcablanca/vista/index.js');
  const res = await onRequest();
  const html = await res.text();
  assert.equal(res.status, 200);
  assert.match(res.headers.get('cache-control'), /no-store/);
  assert.match(res.headers.get('x-robots-tag'), /noindex/);
  assert.match(html, /href="\/pruebas\/marcablanca\/vista\/"/);
  assert.doesNotMatch(html, /vistaForm|pideForm|Pide tu propuesta/);
});

test('sin sesión: POST /pruebas/api/solicitud da 401; otro POST en /pruebas sigue en 405', async () => {
  const post = (p) => new Request('https://www.admiranext.com' + p, {method: 'POST', body: '{}', headers: {origin: 'https://www.admiranext.com'}});
  assert.equal((await onRequest({request: post('/pruebas/api/solicitud'), env, next: siguiente})).status, 401);
  assert.equal((await onRequest({request: post('/pruebas/marcablanca/vista/'), env, next: siguiente})).status, 405);
  assert.equal((await onRequestPost({request: post('/pruebas/api/solicitud'), env})).status, 401);
});
