// Cuando xAI no redacta, la presentación NO se cae: sale con el molde de la casa.
// Eso está bien — crear una presentación no puede depender de un proveedor. Lo que
// estaba mal es que no se notara: `generateNarrative` devolvía null a secas, el
// motivo se perdía y el generador anunciaba «Presentación lista» exactamente igual.
// El operador copiaba la URL y se la mandaba a un cliente creyendo que llevaba un
// guion escrito para él, cuando era el texto genérico con el nombre cambiado — el
// mismo que ya tenía otro cliente.
//
// Este test vigila las tres piezas de esa señal: el motivo, que viaje en la
// respuesta de la API y que la interfaz avise en vez de felicitar.

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { generateNarrative, mergeNarrative, FALLBACK_REASONS } from '../functions/presentaciones/_skeleton.js';

const base = () => ({
  hero: { eyebrow: 'Presentación privada · Cliente', title: 'T', summary: 'S' },
  objective: 'O',
  skeleton: [{ id: 'problema', title: 'A', message: 'B', detail: 'C', enabled: true }],
  closing: { title: 'C', action: 'A' }
});

test('sin clave de xAI el motivo se nombra, no se pierde', async () => {
  const result = await generateNarrative({}, { displayName: 'Cliente' });
  assert.equal(result.narrative, null);
  assert.equal(result.reason, 'sin-clave');
  assert.ok(FALLBACK_REASONS['sin-clave'], 'todo motivo tiene su frase para el operador');
});

test('cuando se cae al molde queda dicho, y el motivo NO se guarda con las ideas', () => {
  // El motivo es para el operador. `ideas` se persiste en KV y lo sirven las rutas
  // del portal del cliente: un «xAI rechazó la petición» ahí dentro es enseñarle
  // los trapos sucios al prospecto que abre su presentación.
  const merged = mergeNarrative(base(), { narrative: null, reason: 'rechazo' }, {});
  assert.equal(merged.narrativeSource, 'template', 'lo marca explícitamente, sin depender de quien lo llame');
  assert.equal(merged.narrativeFallback, undefined);
  assert.ok(!JSON.stringify(merged).includes('rechazo'), 'el motivo no viaja dentro de las ideas');
});

test('un fallo de red no se le vende al operador como un timeout', async () => {
  assert.notEqual(FALLBACK_REASONS.red, FALLBACK_REASONS.plazo);
  assert.match(FALLBACK_REASONS.plazo, /a tiempo/);
  assert.doesNotMatch(FALLBACK_REASONS.red, /a tiempo/);
});

test('cuando xAI redacta, no queda marca de respaldo', () => {
  const narrative = {
    hero: { title: 'Título propio', summary: 'Resumen propio' },
    objective: 'Objetivo propio',
    skeleton: [{ id: 'problema', title: 'X', message: 'Y', detail: 'Z' }],
    closing: { title: 'Cierre', action: 'Acción' }
  };
  const merged = mergeNarrative(base(), { narrative, reason: '' }, {});
  assert.equal(merged.narrativeSource, 'xai');
  assert.equal(merged.narrativeFallback, undefined);
  assert.equal(merged.skeleton[0].title, 'X');
});

test('mergeNarrative sigue aceptando la narración pelada, sin envoltorio', () => {
  const merged = mergeNarrative(base(), null, {});
  assert.equal(merged.narrativeSource, 'template');
});

test('la respuesta de la API dice quién escribió el guion', async () => {
  const source = await readFile(new URL('../functions/presentaciones/api/generate.js', import.meta.url), 'utf8');
  assert.match(source, /narrativeSource,narrativeFallback/, 'los dos campos viajan al front');
  assert.match(source, /FALLBACK_REASONS\[narrativeResult\?\.reason\]/, 'el motivo sale de la llamada, no de las ideas persistidas');
  assert.match(source, /FALLBACK_GENERIC/, 'un código sin frase cae a una frase, no al slug crudo');
});

test('la interfaz avisa en vez de felicitar cuando el guion es el de respaldo', async () => {
  const bundle = await readFile(new URL('../assets/presentation-generator-20260721-11.js', import.meta.url), 'utf8');
  assert.match(bundle, /body\.narrativeSource==='xai'/, 'la interfaz distingue los dos casos');
  assert.match(bundle, /guion de respaldo/, 'lo dice con esas palabras');
  assert.match(bundle, /ANTES de compartir el enlace/, 'y dice qué hacer antes de mandarlo');
});
