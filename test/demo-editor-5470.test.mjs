// Encargo #5470: segunda vuelta de Walt sobre el editor, en la misma rama.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { SITIOS, TEXTO, lineaEstado, resumenMacro } from '../demos/editor/modelo.mjs';

const leer = (ruta) => readFileSync(new URL(ruta, import.meta.url), 'utf8');
const css = leer('../demos/editor/editor.css');
const html = leer('../demos/editor/index.html');
const js = leer('../demos/editor/editor.js');

test('las patas usan la paleta oficial y el nombre en minúscula', () => {
  const porId = Object.fromEntries(SITIOS.map((sitio) => [sitio.id, sitio]));
  assert.equal(porId.studio.color, '#FF33CC');
  assert.equal(porId.store.color, '#FFCC00');
  assert.equal(porId.tv.color, '#33FF99');
  assert.equal(porId.app.color, '#FFFFFF');
  assert.equal(porId.biz.color, '#FF3366');
  assert.equal(porId.studio.es, 'admira.studio');
  assert.equal(porId.studio.en, 'admira.studio');
  for (const sitio of SITIOS) {
    assert.equal(sitio.es, sitio.es.toLowerCase());
    assert.equal(sitio.en, sitio.es);
    assert.doesNotMatch(sitio.color, /7ce8d8/i);
  }
  assert.doesNotMatch(leer('../demos/editor/modelo.mjs'), /7ce8d8/i);
  assert.doesNotMatch(leer('../demos/editor/modelo.mjs'), /Admira Studio/);
});

test('la línea de estado separa la pastilla y el ejemplo vive en Soltar aquí', () => {
  const vacia = resumenMacro([], [], 'draft', 'es');
  assert.equal(lineaEstado(vacia, 'es'), 'Borrador · 0 piezas · 0 sitios · 0 s');
  assert.equal(vacia.comando, '/demo editor');
  assert.equal(lineaEstado(resumenMacro([], [], 'draft', 'en'), 'en'), 'Draft · 0 pieces · 0 sites · 0 s');
  assert.equal(TEXTO.es.eligePaso, 'Elige un paso para editarlo');
  assert.equal(TEXTO.en.eligePaso, 'Choose a step to edit it');
  assert.match(TEXTO.es.guiaMacro, /biz×3 \+ app×2/);
  assert.doesNotMatch(TEXTO.es.guiaMacro, /Macro vacía/);
  assert.match(js, /dataset\.vacio = 'macro'/);
  assert.match(js, /pastilla/);
  assert.match(html, /id="pastilla"/);
  assert.doesNotMatch(js, /idioma-barra/);
});

test('la biblioteca es de una línea, el inspector nace apagado y el Experto queda abajo', () => {
  assert.match(css, /text-overflow:\s*ellipsis/);
  assert.match(css, /html:not\(\.yk-open-bottom\) #ykExpertRail/);
  assert.match(css, /button:disabled/);
  assert.match(html, /id="probar" disabled/);
  assert.match(html, /id="h-macro"/);
  assert.match(html, /id="h-pasos"/);
  assert.match(html, /id="h-inspector"/);
  assert.match(html, /Elige un paso para editarlo/);
  assert.match(TEXTO.es.buscarCorto, /Buscar…/);
  assert.match(TEXTO.en.buscarCorto, /Search…/);
  assert.match(js, /ykExpertRail/);
  assert.match(js, /max-width: 800px/);
});
