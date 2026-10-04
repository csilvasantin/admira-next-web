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
