import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const html = await readFile(new URL('../organigrama.html', import.meta.url), 'utf8');

test('debajo del organigrama estático hay un árbol interactivo con líneas y doble clic', () => {
  assert.ok(html.includes('id="arbol-interactivo"'));
  assert.ok(html.includes('id="org-lines"'));
  assert.ok(html.includes('dblclick'));
  assert.ok(html.indexOf('id="patas"') < html.indexOf('id="arbol-interactivo"'));
  for (const id of ['jobs','elon','lucas','jensen','woz','walt','merovingio','oraculo','cypher','smith','niobe']) {
    assert.ok(html.includes(`data-id="${id}"`), id);
  }
  assert.ok(html.includes('«La mesa que une las cinco patas.»'));
  assert.ok(html.includes('Morfeo (Claude Code)'));
  assert.doesNotMatch(html, /JTI|Altadis/i);
});

test('#5060 columnas consejero→DeepAgent, líneas SVG al cargar y también en móvil', () => {
  assert.ok(html.includes('org-cols'), 'org-cols');
  assert.ok(html.includes('org-col'), 'org-col');
  assert.ok(html.includes('path.org-line'), 'clear only paths');
  // must NOT blank lines under 720 (old bug); matchMedia may still pick layout
  assert.doesNotMatch(html, /matchMedia\([^)]*720[^)]*\)[\s\S]{0,120}return;/);
  assert.doesNotMatch(html, /\.org-svg\s*\{\s*display\s*:\s*none/);
  assert.ok(html.includes('jobsGlow') || html.includes('is-top'), 'Jobs highlight');
  assert.ok(html.includes('orgPulse') || html.includes('org-line'), 'animated glow lines');
  const elonCol = html.indexOf('data-col="elon"');
  const mer = html.indexOf('data-id="merovingio"');
  const lucasCol = html.indexOf('data-col="lucas"');
  assert.ok(elonCol > 0 && mer > elonCol && mer < lucasCol, 'Merovingio under Elon column');
});
