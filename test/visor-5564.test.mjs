import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const leer = (ruta) => readFile(new URL(ruta, import.meta.url), 'utf8');

test('el visor ofrece instalar en las gafas y el QR es un deep link', async () => {
  const html = await leer('../pruebas/visor/index.html');
  const js = await leer('../pruebas/visor/visor.js');
  const css = await leer('../pruebas/visor/visor.css');
  const ficha = await leer('../pruebas/visor/instalar/index.html');
  const enlace = (await leer('../pruebas/visor/instalar/enlace.txt')).trim();
  const png = await readFile(new URL('../pruebas/visor/instalar/qr-gafas.png', import.meta.url));
  const gate = await leer('../functions/pruebas/_middleware.js');

  assert.match(html, /application-name" content="Admira Visor"/);
  assert.match(html, /<title>Admira Visor<\/title>/);
  assert.match(html, /id="btnGafas" hidden/);
  assert.match(html, /Añadir a las gafas/);
  assert.match(js, /navigator\.install\(url, \{ name: 'Admira Visor' \}\)/);
  assert.match(js, /typeof navigator\.install === 'function'/);
  assert.match(js, /\.catch\(function \(\) \{/);
  assert.match(js, /catch \(err\)/);
  assert.match(css, /#btnGafas\[hidden\]|button\[hidden\]|#btnGafas/);
  assert.match(enlace, /^fb-viewapp:\/\/web_app_deep_link\?/);
  assert.match(enlace, /appName=Admira%20Visor/);
  assert.match(enlace, /appUrl=https%3A%2F%2F/);
  assert.doesNotMatch(enlace, /^https:/);
  assert.match(ficha, /qr-gafas\.png/);
  assert.equal(png.subarray(0, 8).toString('hex'), '89504e470d0a1a0a');
  assert.doesNotMatch(gate, /visor/);
});
