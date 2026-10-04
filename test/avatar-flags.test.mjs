// Interruptor del avatar por proyecto: documento, precedencia y API pública.
import test from 'node:test';
import assert from 'node:assert/strict';
import {AVATAR_PROJECTS, AVATAR_HOSTS, emptyFlags, sanitize, stateForHost, applyChange, readFlags} from '../functions/_avatar-flags.js';
import {onRequest} from '../functions/api/avatar/flags.js';

function kv(initial) {
  const m = new Map(initial ? Object.entries(initial) : []);
  return {get: async (k) => (m.has(k) ? m.get(k) : null), put: async (k, v) => { m.set(k, v); }, m};
}

test('todos los proyectos nacen apagados, admiranext incluido', () => {
  const d = emptyFlags();
  for (const k of AVATAR_PROJECTS) assert.equal(d.projects[k].on, false);
  assert.ok(AVATAR_PROJECTS.includes('admiranext'));
  assert.equal(AVATAR_HOSTS['www.pixeria.com'], 'pixeria');
});

test('la excepción por dominio gana al proyecto', () => {
  let d = applyChange(emptyFlags(), {project: 'clearchannel-tv', on: true}, 'a@b.c');
  assert.equal(stateForHost(d, 'www.clearchannel.tv').on, true);
  d = applyChange(d, {host: 'www.clearchannel.tv', on: false}, 'a@b.c');
  assert.equal(stateForHost(d, 'www.clearchannel.tv').on, false);
  assert.equal(stateForHost(d, 'clearchannel.tv').on, true);
  d = applyChange(d, {host: 'www.clearchannel.tv', on: null}, 'a@b.c');
  assert.equal(stateForHost(d, 'www.clearchannel.tv').on, true);
  assert.equal(d.v, 3);
});

test('rechaza proyectos, dominios y valores desconocidos', () => {
  assert.throws(() => applyChange(emptyFlags(), {project: 'evil', on: true}));
  assert.throws(() => applyChange(emptyFlags(), {project: 'pixeria', on: 'yes'}));
  assert.throws(() => applyChange(emptyFlags(), {host: 'evil.com', on: true}));
  assert.equal(stateForHost(emptyFlags(), 'evil.com').on, false);
  assert.equal(sanitize({projects: {pixeria: {on: 'true'}, evil: {on: true}}}).projects.pixeria.on, false);
});

test('usa AVATAR_FLAGS y, sin él, el KV ya enlazado con prefijo avatar:', async () => {
  const a = kv({flags: JSON.stringify({projects: {pixeria: {on: true}}})});
  assert.equal((await readFlags({AVATAR_FLAGS: a})).doc.projects.pixeria.on, true);
  const b = kv({'avatar:flags': JSON.stringify({projects: {xpaceos: {on: true}}})});
  const r = await readFlags({PRESENTATION_IDEAS: b});
  assert.equal(r.storage, 'PRESENTATION_IDEAS');
  assert.equal(r.doc.projects.xpaceos.on, true);
  assert.equal((await readFlags({})).doc.projects.pixeria.on, false);
});

test('GET es público, con CORS * y 60 s de caché', async () => {
  const env = {AVATAR_FLAGS: kv({flags: JSON.stringify({projects: {pixeria: {on: true}}})})};
  const r = await onRequest({request: new Request('https://www.admiranext.com/api/avatar/flags?host=www.pixeria.com'), env});
  assert.equal(r.status, 200);
  assert.equal(r.headers.get('access-control-allow-origin'), '*');
  assert.equal(r.headers.get('cache-control'), 'public, max-age=60');
  const d = await r.json();
  assert.deepEqual([d.project, d.on], ['pixeria', true]);
  const o = await onRequest({request: new Request('https://www.admiranext.com/api/avatar/flags', {method: 'OPTIONS'}), env});
  assert.equal(o.status, 204);
});

test('PUT sin sesión de administrador se rechaza y no escribe', async () => {
  const store = kv();
  const r = await onRequest({request: new Request('https://www.admiranext.com/api/avatar/flags', {method: 'PUT', body: '{"project":"pixeria","on":true}'}), env: {AVATAR_FLAGS: store}});
  assert.equal(r.status, 403);
  assert.equal(store.m.size, 0);
  const p = await onRequest({request: new Request('https://www.admiranext.com/api/avatar/flags', {method: 'POST'}), env: {}});
  assert.equal(p.status, 405);
});
