import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { patas, plataformasCatalogo } from '../data/pilares-historia.mjs';
import { onRequestGet as listar } from '../functions/marcablanca/api/marcas/index.js';

const leer = (ruta) => readFile(new URL('../' + ruta, import.meta.url), 'utf8');

test('las cinco patas salen de arquitectura con el mismo verbo', () => {
  const lista = patas();
  assert.deepEqual(lista.map((p) => p.id), ['studio', 'store', 'tv', 'app', 'biz']);
  assert.deepEqual(lista.map((p) => [p.id, p.verbo, p.pilar]), [
    ['studio', 'crea', 'creatividad'],
    ['store', 'distribuye', 'negocio'],
    ['tv', 'emite', 'tecnologia'],
    ['app', 'mantiene', 'tecnologia'],
    ['biz', 'comercializa', 'negocio']
  ]);
  for (const p of lista) {
    assert.equal(p.nombre, p.dominio);
    assert.doesNotMatch(`${p.nombre} ${p.rol}`, /pixeria|yokup/i);
  }
});

test('GET /marcablanca/api/marcas publica esas cinco patas y no el token yokup', async () => {
  const res = await listar({ request: new Request('https://www.admiranext.com/marcablanca/api/marcas'), env: {} });
  const body = await res.json();
  assert.deepEqual(body.plataformas, plataformasCatalogo());
  assert.deepEqual(Object.keys(body.plataformas), ['studio', 'store', 'tv', 'app', 'biz']);
  assert.equal(body.plataformas.app.verbo, 'mantiene');
  assert.equal(body.plataformas.biz.verbo, 'comercializa');
  assert.doesNotMatch(JSON.stringify(body.plataformas), /yokup|pixeria/i);
});

test('las páginas citadas cuentan la misma historia', async () => {
  const home = await leer('index.html');
  const marca = await leer('marcablanca/index.html');
  const demo = await leer('demo/index.html');
  assert.match(home, /admira\.tv/);
  assert.doesNotMatch(home, /four legs|cuatro patas/);
  assert.match(marca, /cinco patas/);
  assert.match(marca, /admira\.tv/);
  assert.match(marca, /marcablanca --aplicar studio store tv app biz/);
  assert.doesNotMatch(marca, /cuatro patas|pixeria|El sitio anterior era el de Yokup/i);
  assert.match(demo, /<i class="chip">admira\.studio<\/i>/);
  assert.doesNotMatch(demo, /pixeria\.com|Pixeria/);
  const css = await leer('demo/demo.css');
  assert.match(css, /\.estado-hoy,\.estado-leyenda\{display:none\}/);
  assert.match(css, /html\[data-ax-experto="on"\] \.estado-hoy\{display:inline-block/);
});
