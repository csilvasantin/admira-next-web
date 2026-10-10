import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { clasificarPresentacion, contarClases } from '../functions/presentaciones/_clase.js';

const home = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const app = readFileSync(new URL('../assets/app.js', import.meta.url), 'utf8');
const css = readFileSync(new URL('../assets/app.css', import.meta.url), 'utf8');
const deck = readFileSync(new URL('../bits-and-atoms/index.html', import.meta.url), 'utf8');
const clients = readFileSync(new URL('../functions/presentaciones/api/clients.js', import.meta.url), 'utf8');

test('la portada nombra los tres pilares y los cinco sitios', () => {
  assert.match(home, /id="portada"/);
  assert.match(home, /href="https:\/\/www\.admira\.tv\/"/);
  assert.match(home, /href="https:\/\/www\.admira\.app\/"/);
  assert.match(home, /href="https:\/\/www\.admira\.studio\/"/);
  assert.match(home, /href="https:\/\/www\.admira\.store\/"/);
  assert.match(home, /href="https:\/\/www\.admira\.biz\/"/);
  assert.match(home, /href="\/bits-and-atoms\/\?marca=lumbre"/);
  assert.doesNotMatch(home, /four legs/);
  assert.doesNotMatch(home, /cuatro patas/);
  assert.match(home, /Reading the five sites of Bits and Atoms/);
  assert.match(home, /Leyendo los cinco sitios de Bits and Atoms/);
  assert.match(home, /URLSearchParams\(location\.search\)\.get\('lang'\)/);
});

test('el terminal espera al modo Experto', () => {
  assert.match(app, /name: 'terminal'/);
  assert.match(app, /window\.abrirTerminal/);
  assert.match(app, /terminal-abierto/);
  assert.match(app, /await Promise\.resolve\(\)/);
  assert.match(css, /body:not\(\.terminal-abierto\) #terminal/);
  assert.match(css, /body\.terminal-abierto #portada/);
});

test('la presentación corta tiene siete láminas, televisión y los dos idiomas', () => {
  assert.match(deck, /admira\.tv/);
  assert.match(deck, /Try it with your brand/);
  assert.match(deck, /Pruébalo con tu marca/);
  assert.match(deck, /id: 'lumbre'/);
  assert.match(deck, /id: 'brumelle'/);
  assert.match(deck, /id: 'frescaria'/);
  assert.match(deck, /Marcas de ejemplo/);
  assert.match(deck, /&marca=/);
  assert.equal((deck.match(/\{ h:/g) || []).length, 14);
});

test('el censo devuelve la clase', () => {
  assert.match(clients, /clasificarPresentacion/);
  assert.match(clients, /clases:contarClases/);
});

test('las internas citadas no salen como cliente', () => {
  for (const nombre of ['Cápsula retail', 'Prioridad DeepAgents', 'PRUEBA flota', 'Alta asíncrona', 'Consejo semanal']) {
    assert.equal(clasificarPresentacion({ slug: 'x', displayName: nombre }), 'interno', nombre);
  }
  assert.equal(clasificarPresentacion({ slug: 'norte', displayName: 'Tienda Norte', prospect: { activo: true, marca: 'norte' } }), 'prospecto');
  assert.equal(clasificarPresentacion({ slug: 'norte', displayName: 'Tienda Norte' }), 'cliente');
  assert.equal(clasificarPresentacion({ slug: 'capsula-1', displayName: 'Cápsula', clase: 'cliente' }), 'cliente');
  assert.deepEqual(contarClases([
    { displayName: 'Cápsula' },
    { displayName: 'Tienda Norte' },
    { prospect: { activo: true } },
  ]), { cliente: 1, prospecto: 1, interno: 1 });
});
