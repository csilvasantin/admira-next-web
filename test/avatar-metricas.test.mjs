import test from 'node:test';
import assert from 'node:assert/strict';
import { ticket, siguiente } from '../functions/avatar-metricas.js';
import { returnToSeguro } from '../functions/_webmaster-gate.js';
test('puente de métricas: ticket firmado y destino seguro', async () => {
  const t = await ticket('k', { e: 'csilva@admira.com', exp: 1 });
  assert.match(t, /^[\w-]+\.[\w-]{43}$/);
  assert.equal(siguiente('/metricas/?brand=starbucks'), '/metricas/?brand=starbucks');
  assert.equal(siguiente('https://evil.com'), '/metricas/');
  assert.equal(siguiente('/metricas//evil.com'), '/metricas/');
  assert.equal(returnToSeguro('/avatar-metricas'), '/avatar-metricas');
});
