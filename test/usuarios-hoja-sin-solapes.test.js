import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

// #6528 · /usuarios Directorio a ~1024 y 1440 px: nada se pisa ni se corta.
// Es una guarda del CSS (el render real se comprobó en navegador): si alguien vuelve a
// table-layout:auto con nowrap en todo, el rol vuelve a quedar ilegible y las píldoras
// de proyectos/estado vuelven a solaparse.
const html = fs.readFileSync(new URL('../usuarios.html', import.meta.url), 'utf8');
const css = html.slice(html.indexOf('<style>'), html.indexOf('</style>'));

test('la hoja usa table-layout fijo con anchos por columna y ancho mínimo', () => {
  assert.match(css, /table\.sheet\{[^}]*table-layout:fixed/);
  assert.match(css, /table\.sheet\{[^}]*min-width:\d+px/);
  for (let n = 2; n <= 8; n++) assert.match(css, new RegExp(`table\\.sheet th:nth-child\\(${n}\\)\\{width:`));
});

test('el select de rol llena su columna y la píldora de proyectos recorta con puntos suspensivos y título', () => {
  assert.match(css, /table\.sheet td select\{width:100%/);
  assert.match(css, /\.scope-button\{[^}]*overflow:hidden[^}]*text-overflow:ellipsis/);
  assert.match(html, /class="scope-button"[^>]*title="\$\{esc\(scopeFull\(u\.project_keys\)\)\}"/);
});

test('estado y acciones envuelven en vez de salirse de su celda', () => {
  assert.match(css, /\.status\{[^}]*white-space:normal/);
  assert.match(css, /\.row-actions\{[^}]*flex-wrap:wrap/);
  assert.doesNotMatch(css, /\.actions-scroll\{[^}]*max-width:min\(52vw/);
});

test('el móvil sigue apilado sin ancho mínimo de tabla', () => {
  assert.match(css, /@media\(max-width:760px\)[\s\S]*table\.sheet\{min-width:0\}/);
});
