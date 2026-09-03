import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const lee = (ruta) => readFile(new URL('../' + ruta, import.meta.url), 'utf8');

test('toda presentación se guarda con castellano e inglés como mínimo', async () => {
  const ideas = await lee('functions/presentaciones/[client]/api/ideas.js');
  const cuerpo = ideas.match(/function conMinimoBilingue\(lista\)\{[\s\S]*?\n\}/)?.[0];
  assert.ok(cuerpo, 'no encuentro la garantía de idiomas al guardar el esqueleto');
  const conMinimoBilingue = new Function(`${cuerpo} return conMinimoBilingue;`)();
  // El orden importa: el primero es el idioma por defecto del deck y no debe cambiar.
  assert.deepEqual(conMinimoBilingue(['en']), ['en', 'es'], 'a una en inglés se le añade el castellano detrás');
  assert.deepEqual(conMinimoBilingue(['es']), ['es', 'en']);
  assert.deepEqual(conMinimoBilingue(['ca']), ['ca', 'es', 'en']);
  assert.deepEqual(conMinimoBilingue(['es', 'en']), ['es', 'en'], 'si ya están, no se toca nada');
  assert.deepEqual(conMinimoBilingue([]), ['es', 'en']);
});

test('crear una presentación también obliga a los dos idiomas', async () => {
  const generate = await lee('functions/presentaciones/api/generate.js');
  assert.match(generate, /for\(const obligatorio of \['es','en'\]\) if\(!languages\.includes\(obligatorio\)\) languages\.push\(obligatorio\)/,
    'sin esto una presentación puede nacer monolingüe y la corrección cruzada nace apagada');
});

test('la corrección cruzada depende de que haya más de un idioma', async () => {
  const inline = await lee('functions/presentaciones/[client]/api/inline-edit.js');
  // Este es el motivo real de la norma: editar en un idioma solo corrige "los otros".
  assert.match(inline, /const targetLanguages=languages\.filter\(item=>item!==language\)/);
  assert.match(inline, /translateEdits\(/, 'la propagación ya existía; lo que faltaba era el segundo idioma');
});

test('el botón del cliente entra a pantalla completa y se sale con ESC', async () => {
  const [portal, deck] = await Promise.all([
    lee('functions/presentaciones/[client]/index.js'),
    lee('functions/presentaciones/[client]/presentacion.js')
  ]);
  assert.match(portal, /href="presentacion\?fullscreen=1"/, 'el botón del portal tiene que pedirlo');
  assert.doesNotMatch(portal, /href="presentacion" target/, 'ningún botón del cliente se queda sin pedirlo');
  assert.match(deck, /get\('fullscreen'\)!=='1'\)return/, 'y la presentación tiene que atenderlo');
  assert.match(deck, /once:true/, 'una sola vez: tras salir con ESC no puede volver a entrar sola');
  assert.match(deck, /data-client-fullscreen/, 'el logo del cliente también debe ser el control de pantalla completa');
  assert.match(deck, /querySelector\('\[data-client-fullscreen\]'\).*addEventListener\('click',enterFullscreen\)/,
    'pulsar el logo debe entrar en pantalla completa mediante un gesto real');
  assert.match(deck, /fullscreenActive:'Full screen active · Esc to exit'/,
    'en inglés el propio control debe explicar que ESC sale de pantalla completa');
});

test('las etiquetas flotantes se pueden mover y cerrar sin contaminar el idioma', async () => {
  const [deck, floating, floatingCss, ui] = await Promise.all([
    lee('functions/presentaciones/[client]/presentacion.js'),
    lee('assets/presentation-floating-labels.js'),
    lee('assets/presentation-floating-labels.css'),
    lee('assets/presentation-ui-i18n.js')
  ]);
  assert.match(deck, /presentation-floating-labels\.js\?v=20260902-1/);
  assert.match(floating, /\.languages,\.section-nav,\.nav,\.quality-levels,\.presenter-launch/);
  assert.match(floating, /addEventListener\('pointerdown'/, 'cada etiqueta tiene tirador para moverla');
  assert.match(floating, /shell\.hidden=true/, 'cada etiqueta tiene un cierre independiente');
  assert.match(floating, /en:\{move:'Move control',close:'Hide control'\}/, 'tirador y cierre respetan el inglés');
  assert.match(floatingCss, /\.presentation-floating-close/);
  assert.match(ui, /'Ensayar':'Rehearse'/);
  assert.match(ui, /'Pantalla completa':'Full screen'/);
  assert.match(ui, /'Guardar y traducir':'Save and translate'/);
});

test('H deja únicamente la presentación y vuelve a mostrar las superposiciones',async()=>{
  const [deck,clean,styles]=await Promise.all([
    lee('functions/presentaciones/[client]/presentacion.js'),
    lee('assets/presentation-clean-mode.js'),
    lee('assets/presentation-clean-mode.css')
  ]);
  assert.match(deck,/presentation-clean-mode\.js\?v=20260903-1/);
  assert.match(deck,/presentation-clean-mode\.css\?v=20260903-1/);
  assert.match(deck,/↑ ↓ · F · H/,'la ayuda visible debe enseñar el atajo');
  assert.match(clean,/String\(event\.key\)\.toLowerCase\(\)!=='h'/);
  assert.match(clean,/classList\.toggle\('presentation-clean-mode'/,'H debe ser reversible');
  for(const overlay of ['presentation-floating-shell','presenter-panel','inline-editor','presenter-caption-layer','slide-media-diagnostics']){
    assert.match(styles,new RegExp(overlay),`falta ocultar ${overlay}`);
  }
  assert.doesNotMatch(styles,/body\s*>\s*\.slide(?:\s|,|\{)/,'el modo limpio nunca debe ocultar la presentación');
});

test('el botón de ensayar no se monta sobre el conmutador de calidad', async () => {
  const css = await lee('assets/presentation-presenter-mode.css');
  const bloque = css.match(/\.presenter-launch\{[\s\S]*?\}/)?.[0];
  const top = Number(bloque.match(/top:(\d+)px/)?.[1]);
  assert.ok(top >= 70, `ENSAYAR está a ${top}px: se solapa con el conmutador de la esquina`);
});

test('una traducción fallida no impide crear la presentación', async () => {
  const generate = await lee('functions/presentaciones/api/generate.js');
  // Antes, una presentación en castellano se saltaba la traducción; ahora TODAS pasan por
  // ella. Si el proveedor tropieza y devolvemos 502, el comercial se queda sin poder dar
  // de alta a un cliente: habríamos convertido la mejora en un punto único de fallo.
  assert.doesNotMatch(generate, /No se pudieron generar todos los idiomas\.'\},502\)/,
    'el alta no puede morir porque falle la traducción');
  assert.match(generate, /ideas\.translationPending=/, 'el idioma pendiente queda marcado');
  assert.match(generate, /ideas\.translationError=/, 'y se guarda por qué falló, no se traga el error');
});
