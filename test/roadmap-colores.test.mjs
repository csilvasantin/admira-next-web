// #6552 (Carlos, 19-10-2026): en el roadmap de hoy cada consejero y cada agente
// tiene su propio color (nombre, sello e ideas), para ver de un vistazo quién lleva qué.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const js = await readFile(new URL('../assets/roadmap-combo.js', import.meta.url), 'utf8');
const html = await readFile(new URL('../roadmap.html', import.meta.url), 'utf8');
const semilla = JSON.parse(await readFile(new URL('../data/roadmap/proyectos.json', import.meta.url), 'utf8'));
const COLOR = JSON.parse(js.match(/var COLOR=(\{[^}]+\});/)[1]);

test('cada consejero y cada agente tiene un color propio y distinto', () => {
  const personas = semilla.proyectos.filter((p) => p.tipo === 'agente' || p.tipo === 'consejero');
  assert.ok(personas.length >= 20);
  for (const p of personas) assert.match(COLOR[p.id] || '', /^#[0-9a-f]{6}$/, `${p.id} sin color`);
  const usados = personas.map((p) => COLOR[p.id]);
  assert.equal(new Set(usados).size, usados.length, 'dos personas comparten color');
});

test('los responsables de los pilares se resuelven a un color', () => {
  const norm = (v) => v.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\b(consejero|agente)\b/g, ' ').trim().split(/[^a-z0-9]+/)[0];
  for (const p of semilla.proyectos.filter((x) => !x.tipo)) assert.ok(COLOR[norm(p.responsable)], `${p.id}: ${p.responsable}`);
});

test('nombre, sello, ideas y leyenda llevan el color', () => {
  assert.match(js, /chipQuien\(p\.id,p\.nombre\)/);
  assert.match(js, /chipQuien\(p\.responsable\)/);
  assert.match(js, /rmc-sel rmc-sel-'\+esc\(i\.sel\.veredicto\)\+\(cs\?' rmc-q'/);
  assert.match(js, /class=\\?"rmc-q\\?" style=\\?"--q:/);
  assert.match(js, /rmc-leyenda/);
  assert.match(html, /\.rmc-123>li\.rmc-q::before\{[^}]*background:var\(--q\)/);
  assert.match(html, /roadmap-combo\.js\?v=20261028-item-1/);
});
