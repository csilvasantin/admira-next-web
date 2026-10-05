import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const html = await readFile(new URL('../organigrama.html', import.meta.url), 'utf8');

test('pack completo: una sola escena viva, sin cartas estáticas duplicadas a la vista', () => {
  assert.ok(html.includes('id="arbol-interactivo"'));
  assert.ok(html.includes('org-canon'), 'cartas canónicas ocultas para SEO/tests');
  assert.ok(html.includes('Escena viva') || html.includes('org-stage'));
  assert.doesNotMatch(html, /section class="bloque" id="mesa"/);
  assert.doesNotMatch(html, /section class="bloque" id="patas"/);
});

test('pack completo: matrix rain cyan/teal Galaxia, nunca verde Pixeria', () => {
  assert.ok(html.includes('id="org-matrix"'));
  assert.ok(html.includes('#78f3ff'));
  assert.ok(html.includes('#4ae3d1'));
  const matrixBlock = html.slice(html.indexOf('startMatrix'), html.indexOf('function zoomBy'));
  assert.ok(matrixBlock.includes('#78f3ff') && matrixBlock.includes('#4ae3d1'));
  assert.doesNotMatch(matrixBlock, /#00ff41|#33ff33|#0f0\b/i);
});

test('pack completo: latido flota + data-flow SVG + avatares/chips', () => {
  assert.ok(html.includes('api.yokup.com/highscore/active-work'));
  assert.ok(html.includes('data-presence-for'));
  assert.ok(html.includes('is-ok') && html.includes('is-warn') && html.includes('is-bad'));
  assert.ok(html.includes('hace '));
  assert.ok(html.includes('is-flow') || html.includes('orgDash'));
  assert.ok(html.includes('org-avatar'));
  assert.ok(html.includes('is-engine'));
  assert.ok(html.includes('data-agents-for'));
});

test('pack completo: zoom/pan, un clic, teclado y presentador', () => {
  assert.ok(html.includes('org-viewport'));
  assert.ok(html.includes('org-zoom-in'));
  assert.ok(html.includes('pointerdown'));
  assert.ok(html.includes('wheel'));
  assert.ok(html.includes('is-presenter') || html.includes('Presentador'));
  assert.ok(html.includes('Escape'));
  assert.ok(html.includes('toggleNode(node)'));
  assert.ok(html.includes('dblclick'));
  assert.ok(html.includes('Un clic') || html.includes('un clic'));
});

test('pack completo: sin React ni Three.js', () => {
  assert.doesNotMatch(html, /react|three\.js|from ['"]three['"]/i);
});
