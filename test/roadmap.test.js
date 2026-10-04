import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const html = await readFile(new URL('../roadmap.html', import.meta.url), 'utf8');
const proyectos = await readFile(new URL('../proyectos/index.html', import.meta.url), 'utf8');

test('RoadMap va en el menú del grupo, entre Organigrama y Presentaciones', () => {
  const nav = proyectos.match(/<nav aria-label="Navegación del grupo">[\s\S]*?<\/nav>/)[0];
  assert.match(nav, /<a href="\/organigrama">Organigrama<\/a><a href="\/roadmap">RoadMap<\/a><a href="\/presentaciones\/">Presentaciones<\/a>/);
  assert.match(html, /<a href="\/roadmap" aria-current="page">RoadMap<\/a>/);
});

test('el borrador no fecha hitos: cada solución tiene 0 y los tres meses por definir', () => {
  assert.match(html, /Borrador para validar por Carlos/);
  const cartas = [...html.matchAll(/<article class="carta"[^>]*data-hitos="(\d+)"[\s\S]*?<\/article>/g)];
  assert.equal(cartas.length, 6);
  for (const carta of cartas) {
    assert.equal(carta[1], '0');
    assert.equal((carta[0].match(/Octubre 2026/g) || []).length, 1);
    assert.equal((carta[0].match(/Noviembre 2026/g) || []).length, 1);
    assert.equal((carta[0].match(/Diciembre 2026/g) || []).length, 1);
    assert.equal((carta[0].match(/Por definir con Carlos/g) || []).length, 3);
    assert.ok(carta[0].includes('Fuente:'), 'cada bloque cita su fuente');
  }
  for (const id of ['studio', 'store', 'tv', 'app', 'biz', 'admiranext']) {
    assert.ok(html.includes(`id="${id}"`), id);
  }
});
