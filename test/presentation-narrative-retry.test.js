import test from 'node:test';
import assert from 'node:assert/strict';
import { generateNarrativeWithRetry, RETRYABLE_REASONS } from '../functions/presentaciones/_skeleton.js';

// FLT-100018 (Carlos, 6-sep-2026: «presentarlo bien y rápido»). Un tropiezo rápido de xAI
// (red, rechazo, respuesta ilegible o mal formada) ya no manda la presentación al molde
// genérico a la primera: se reintenta una vez. Un plazo agotado no se repite (doblaría la
// espera) y sin clave no hay nada que reintentar.
const narrative = { hero:{title:'T',summary:'S'}, objective:'O', skeleton:[], closing:{title:'C',action:'A'} };
const secuencia = (resultados) => { let i = 0; return async () => resultados[Math.min(i++, resultados.length - 1)]; };
const sinPausa = async () => {};

test('un fallo de red se reintenta una vez y el segundo intento vale', async () => {
  const run = secuencia([{ narrative:null, reason:'red' }, { narrative, reason:'' }]);
  const result = await generateNarrativeWithRetry({}, {}, { run, sleep:sinPausa });
  assert.equal(result.narrative, narrative);
  assert.equal(result.attempts, 2);
  assert.ok(Number.isFinite(result.ms));
});

test('dos fallos seguidos caen al molde con el motivo del último y dos intentos contados', async () => {
  const run = secuencia([{ narrative:null, reason:'rechazo' }, { narrative:null, reason:'formato' }]);
  const result = await generateNarrativeWithRetry({}, {}, { run, sleep:sinPausa });
  assert.equal(result.narrative, null);
  assert.equal(result.reason, 'formato');
  assert.equal(result.attempts, 2);
});

test('un plazo agotado o la falta de clave no se reintentan', async () => {
  for (const reason of ['plazo', 'sin-clave']) {
    let llamadas = 0;
    const run = async () => { llamadas += 1; return { narrative:null, reason }; };
    const result = await generateNarrativeWithRetry({}, {}, { run, sleep:sinPausa });
    assert.equal(llamadas, 1, reason);
    assert.equal(result.attempts, 1);
    assert.ok(!RETRYABLE_REASONS.has(reason));
  }
});

test('cuando xAI redacta a la primera no hay segundo intento', async () => {
  let llamadas = 0;
  const run = async () => { llamadas += 1; return { narrative, reason:'' }; };
  const result = await generateNarrativeWithRetry({}, {}, { run, sleep:sinPausa });
  assert.equal(llamadas, 1);
  assert.equal(result.attempts, 1);
});
