import test from 'node:test';
import assert from 'node:assert/strict';
import { applyJobResult, expireJobIfStale, jobIsStale, publicCreateJob, STALE_MS, STALE_REASON, writeJob } from '../functions/presentaciones/_create-job.js';

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

function memoria() {
  const store = new Map();
  return {
    async get(key, opts) {
      const value = store.get(key);
      if (value == null) return null;
      return opts && opts.type === 'json' ? JSON.parse(value) : value;
    },
    async put(key, value) { store.set(key, value); }
  };
}

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

test('un alta en curso de más de 10 minutos caduca y suelta el identificador', async () => {
  const now = Date.parse('2026-09-25T18:00:00.000Z');
  const fresh = { id: 'nuevo', slug: 'galaxia', status: 'running', updatedAt: new Date(now - 60 * 1000).toISOString() };
  const stuck = { id: '636440af', slug: 'galaxia', status: 'running', updatedAt: new Date(now - STALE_MS - 1000).toISOString(), error: '' };
  assert.equal(jobIsStale(fresh, now), false);
  assert.equal(jobIsStale(stuck, now), true);
  assert.equal(jobIsStale({ ...stuck, status: 'saved' }, now), false);
  const env = { PRESENTATION_IDEAS: memoria() };
  await writeJob(env, stuck);
  assert.equal(await expireJobIfStale(env, stuck, now), true);
  assert.equal(stuck.status, 'failed');
  assert.equal(stuck.error, STALE_REASON);
  const reserve = await env.PRESENTATION_IDEAS.get('create-reserve:galaxia', { type: 'json' });
  assert.equal(reserve.status, 'failed');
  assert.equal(reserve.id, '636440af');
});

test('el cierre tardío de un alta vieja no vuelve a ocupar el identificador', async () => {
  const env = { PRESENTATION_IDEAS: memoria() };
  await writeJob(env, { id: 'nuevo', slug: 'galaxia', status: 'queued', updatedAt: '2026-09-25T18:10:00.000Z' });
  await writeJob(env, { id: 'viejo', slug: 'galaxia', status: 'saved', updatedAt: '2026-09-25T18:20:00.000Z' });
  const reserve = await env.PRESENTATION_IDEAS.get('create-reserve:galaxia', { type: 'json' });
  assert.equal(reserve.id, 'nuevo');
  assert.equal(reserve.status, 'queued');
});
