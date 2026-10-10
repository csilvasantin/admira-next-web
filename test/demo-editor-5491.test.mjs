// Encargo #5491: la tira de la macro no invade el Inspector y el nombre muestra el inicio.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const leer = (ruta) => readFileSync(new URL(ruta, import.meta.url), 'utf8');
const css = leer('../demos/editor/editor.css');
const js = leer('../demos/editor/editor.js');

test('la columna central contiene la tira y la tira hace scroll dentro de su tarjeta', () => {
  assert.match(css, /grid-template-columns:\s*280px minmax\(0,\s*1fr\) 320px/);
  assert.match(css, /\.centro\s*\{[^}]*min-width:\s*0/);
  assert.match(css, /\.escenario,\s*\.pasos,\s*#macrodemo\s*\{[^}]*min-width:\s*0/);
  assert.match(css, /#fila\s*\{[^}]*overflow-x:\s*auto[^}]*min-width:\s*0/);
  assert.match(css, /\.tarjeta,\s*\.salto\s*\{\s*flex:\s*0 0 auto/);
});

test('el campo del nombre ocupa el ancho de su fila y abre por el principio', () => {
  assert.match(css, /#lista-macros \.slug,\s*#lista-macros \.slug-input,\s*\.estado-fila > \.slug-input\s*\{[^}]*flex:\s*1 0 100%/);
  assert.match(js, /setSelectionRange\(0,\s*0\)/);
  assert.match(js, /input\.scrollLeft = 0/);
  assert.doesNotMatch(js, /input\.select\(\)/);
});
