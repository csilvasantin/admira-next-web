// Norma 31 · la vista previa #5552 (PR #161/#162) vive en /pruebas: nada público, la solicitud solo con sesión.
import test from 'node:test';
import assert from 'node:assert/strict';
import {existsSync, readFileSync} from 'node:fs';
import {onRequest} from '../functions/pruebas/_middleware.js';
import {onRequestPost} from '../functions/pruebas/api/solicitud.js';

const leer = (p) => readFileSync(new URL('../' + p, import.meta.url), 'utf8');
const env = {WEBMASTER_SIGNING_KEY: 'k'};
const siguiente = () => { throw new Error('no debe llegar sin sesión'); };

test('la parte pública no tiene la vista ni la solicitud, y /demo no la enlaza', () => {
  assert.ok(!existsSync(new URL('../marcablanca/vista/index.html', import.meta.url)));
  assert.ok(!existsSync(new URL('../functions/marcablanca/api/solicitud.js', import.meta.url)));
  assert.doesNotMatch(leer('demo/index.html'), /marcablanca\/vista/);
});

test('la copia de /pruebas es noindex y solo llama a /pruebas/api/solicitud', () => {
  assert.match(leer('pruebas/marcablanca/vista/index.html'), /noindex, nofollow/);
  const js = leer('pruebas/marcablanca/vista/vista.js');
  assert.match(js, /fetch\('\/pruebas\/api\/solicitud'/);
  assert.doesNotMatch(js, /\/marcablanca\/api\/solicitud/);
});

test('sin sesión: POST /pruebas/api/solicitud da 401; otro POST en /pruebas sigue en 405', async () => {
  const post = (p) => new Request('https://www.admiranext.com' + p, {method: 'POST', body: '{}', headers: {origin: 'https://www.admiranext.com'}});
  assert.equal((await onRequest({request: post('/pruebas/api/solicitud'), env, next: siguiente})).status, 401);
  assert.equal((await onRequest({request: post('/pruebas/marcablanca/vista/'), env, next: siguiente})).status, 405);
  assert.equal((await onRequestPost({request: post('/pruebas/api/solicitud'), env})).status, 401);
});
