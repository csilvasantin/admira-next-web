import test from 'node:test';
import assert from 'node:assert/strict';
import { applyJobResult, publicCreateJob } from '../functions/presentaciones/_create-job.js';

test('un fallo del alta queda escrito en el trabajo y se puede consultar', () => {
  const job = { id: 'j1', slug: 'cliente', displayName: 'Cliente', status: 'running', error: '', result: { slug: 'cliente' } };
  applyJobResult(job, { ok: false, error: 'La web inspiradora responde con HTTP 404.' });
  assert.equal(job.status, 'failed');
  assert.equal(job.result, null);
  const view = publicCreateJob(job);
  assert.equal(view.error, 'La web inspiradora responde con HTTP 404.');
  assert.equal(view.result, null);
  assert.ok(view.finishedAt);
});

test('un alta guardada conserva slug y contraseña para la consulta', () => {
  const job = { id: 'j2', slug: 'cliente', displayName: 'Cliente', status: 'running', error: 'viejo' };
  applyJobResult(job, { ok: true, result: { slug: 'cliente', password: 'secreta-larga', narrativeSource: 'admiranext-structure' } });
  const view = publicCreateJob(job);
  assert.equal(view.status, 'saved');
  assert.equal(view.error, '');
  assert.equal(view.result.slug, 'cliente');
  assert.equal(view.result.password, 'secreta-larga');
  assert.equal(view.result.narrativeSource, 'admiranext-structure');
});
