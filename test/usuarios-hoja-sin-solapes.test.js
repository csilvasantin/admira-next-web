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

// #6545 · Auditoría compacta: aviso de discrepancia de una línea (detalle plegado) y registro
// de eventos como hoja de una línea por evento. Guarda del CSS/markup (render real medido en navegador).
test('el aviso de discrepancias es una línea resumen con el detalle plegado en un details', () => {
  assert.match(html, /<details\$\{abierto\?' open':''\}><summary[^>]*><span class="dv-main">\$\{titulo\}<\/span>/);
  assert.match(html, /diferencia\$\{n===1\?'':'s'\} con admira\.live/);
  assert.match(css, /\.diverge summary\{[^}]*display:flex[^}]*list-style:none/);
  assert.match(css, /\.diverge \.dv-sub\{[^}]*white-space:nowrap[^}]*text-overflow:ellipsis/);
  // el detalle conserva las acciones de siempre
  for (const marca of ['data-prefill=', 'data-wl-add=', 'data-wl-sync']) assert.ok(html.includes(marca), `falta ${marca}`);
});

test('Auditoría sigue abriéndose sola cuando hay diferencias', () => {
  assert.match(html, /if\(aud&&partes\.length\)aud\.open=true/);
});

test('el registro de eventos es una hoja de filas de una línea con ancho fijo y elipsis', () => {
  assert.match(css, /table\.asheet\{[^}]*table-layout:fixed[^}]*/);
  assert.match(css, /table\.asheet\{[^}]*min-width:\d+px/);
  assert.match(css, /table\.asheet th,table\.asheet td\{[^}]*white-space:nowrap[^}]*overflow:hidden[^}]*text-overflow:ellipsis/);
  for (const n of [1, 2, 3]) assert.match(css, new RegExp(`table\\.asheet th:nth-child\\(${n}\\)\\{width:`));
  assert.doesNotMatch(css, /\.event\{/);
  // hora y evento no se recortan: la columna de hora cabe «18/10/26, 19:48» con su flecha
  const hora = Number(/table\.asheet th:nth-child\(1\)\{width:(\d+)px/.exec(css)[1]);
  assert.ok(hora >= 140, `columna Hora demasiado estrecha (${hora}px)`);
});

test('cada evento tiene tooltip con el texto completo, detalle expandible y cabeceras ordenables', () => {
  assert.match(html, /<td title="\$\{esc\(res\)\}">\$\{esc\(res\)\}<\/td>/);
  assert.match(html, /class="ev-det" hidden/);
  assert.match(css, /\.ev-det\[hidden\]\{display:none!important\}/);
  assert.match(css, /table\.asheet pre\{[^}]*white-space:pre-wrap[^}]*overflow-wrap:anywhere/);
  for (const k of ['time', 'event', 'actor', 'res']) assert.ok(html.includes(`th('${k}',`), `falta ordenar por ${k}`);
});

test('el móvil apila el registro sin ancho mínimo', () => {
  assert.match(css, /@media\(max-width:760px\)[\s\S]*table\.asheet\{min-width:0\}/);
});
