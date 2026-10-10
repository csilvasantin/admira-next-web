import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const leer = (ruta) => readFile(new URL(ruta, import.meta.url), 'utf8');

test('el visor es una web app de 600×600, sin vídeo y detrás de /pruebas', async () => {
  const html = await leer('../pruebas/visor/index.html');
  const css = await leer('../pruebas/visor/visor.css');
  const js = await leer('../pruebas/visor/visor.js');
  const sw = await leer('../pruebas/visor/sw.js');
  const demo = await leer('../pruebas/visor/demo/index.html');
  const datos = JSON.parse(await leer('../pruebas/visor/demo.json'));
  const ficha = await leer('../pruebas/frontier/gafas-meta/index.html');
  const gate = await leer('../functions/pruebas/_middleware.js');

  assert.match(html, /mrbd-web-app-capable" content="yes"/);
  assert.match(html, /width=device-width, initial-scale=1/);
  assert.match(html, /frontier\.js/);
  assert.match(html, /<video id="clip" muted playsinline autoplay/);
  assert.match(css, /background:\s*#000/);
  assert.match(css, /max-width:\s*600px/);
  assert.match(css, /max-height:\s*600px/);
  assert.match(css, /width:\s*100%/);
  assert.match(css, /height:\s*100%/);
  assert.match(js, /ArrowRight/);
  assert.match(js, /ArrowLeft/);
  assert.match(js, /Enter/);
  assert.match(js, /\/\(marca\|brand\|idioma\|language\)/);
  assert.match(js, /dataset\.demo === 'frescaria'/);
  assert.match(js, /admira\.tv\/api\/playlist\?screen=/);
  assert.match(js, /stock\.admira\.store/);
  assert.match(js, /\/pruebas\/visor\/img\?src=/);
  assert.match(js, /segundos \* 1000/);
  assert.match(js, /\/pruebas\/visor\/vid\?src=/);
  assert.match(js, /onended/);
  assert.doesNotMatch(js, /createElement\('video'\)/);
  assert.match(sw, /demo\.json/);
  assert.match(sw, /stock\\?\.admira\\?\.store/);
  assert.match(sw, /api\\?\/playlist/);
  assert.equal(demo.includes('data-demo="frescaria"'), true);
  assert.equal(datos.marca, 'frescaria');
  assert.match(datos.ahora.es, /Fruta de temporada/);
  assert.match(ficha, /href="\/pruebas\/visor\/"/);
  assert.match(gate, /esRutaVisor/);
  assert.match(html, /\/pruebas\/visor\/frontier\.js/);
});
