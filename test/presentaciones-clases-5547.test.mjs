// Encargo #5547 · solo el etiquetado del catálogo de /presentaciones (zona con sesión).
// La portada Bits and Atoms sigue en /pruebas (norma 31); aquí no vuelve nada público.
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import test from 'node:test';
import { clasificarPresentacion, contarClases } from '../functions/presentaciones/_clase.js';

const clients = readFileSync(new URL('../functions/presentaciones/api/clients.js', import.meta.url), 'utf8');
const home = readFileSync(new URL('../index.html', import.meta.url), 'utf8');

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
  assert.deepEqual(contarClases([{ displayName: 'Cápsula' }, { displayName: 'Tienda Norte' }, { prospect: { activo: true } }]), { cliente: 1, prospecto: 1, interno: 1 });
});

test('no vuelve nada público: ni la portada nueva ni /bits-and-atoms', () => {
  assert.doesNotMatch(home, /id="portada"/);
  assert.equal(existsSync(new URL('../bits-and-atoms/index.html', import.meta.url)), false);
});
