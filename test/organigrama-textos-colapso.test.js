import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const html = await readFile(new URL('../organigrama.html', import.meta.url), 'utf8');

test('textos compactos bajo el título y las pastillas de nivel', () => {
  assert.ok(html.includes('Tres niveles: responde · dirige · ejecuta'));
  assert.doesNotMatch(html, /Arriba, quien responde\. En el hueco, quien dirige/);
  assert.ok(html.includes('El Consejo responde de la mesa; cada consejero, de su pata.'));
  assert.doesNotMatch(html, /El Consejo de Silicio responde de la mesa: cada consejero responde de una pata/);
  assert.ok(html.includes('Un DeepAgent dirige cada pata (nombre y motor en la carta).'));
  assert.doesNotMatch(html, /Su nombre y su motor están en cada carta/);
  assert.ok(html.includes('Los agentes ejecutan el trabajo de su pata.'));
  assert.doesNotMatch(html, /la pata que les toca/);
});

test('árbol compactado por defecto: solo nivel superior; clic descompacta el siguiente', () => {
  assert.ok(html.includes('collapseAllByDefault'));
  assert.ok(html.includes('Árbol compactado al cargar'));
  assert.ok(html.includes('is-collapsed-tier'));
  assert.ok(html.includes('display:none!important'));
  assert.match(html, /collapseAllByDefault\(\);\s*\n\s*startMatrix/);
  // applyBranch sigue ocultando hijos de nodos en collapsed
  assert.ok(html.includes("if (collapsed[parentId]) { hide = true; break; }"));
  // toggle abre/cierra el siguiente nivel
  assert.ok(html.includes('function toggleNode(node)'));
  assert.ok(html.includes('delete collapsed[id]'));
  assert.ok(html.includes('collapsed[id] = true'));
});

test('canon y claims del pack siguen presentes', () => {
  assert.ok(html.includes('«La mesa que une las cinco patas.»'));
  assert.ok(html.includes('org-canon'));
  assert.ok(html.includes('id="arbol-interactivo"'));
  for (const id of ['jobs', 'elon', 'lucas', 'jensen', 'woz', 'walt', 'merovingio', 'oraculo', 'cypher', 'smith', 'niobe']) {
    assert.ok(html.includes(`data-id="${id}"`), id);
  }
});
