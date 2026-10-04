import test from 'node:test';
import assert from 'node:assert/strict';
import { SEEDS } from '../functions/_xpace-registry.js';
import { listarClientes, onRequestGet, onRequestOptions, onRequestPost } from '../functions/api/clientes.js';

const req = () => ({ request: new Request('https://www.admiranext.com/api/clientes'), env: {} });

test('sin D1 el censo es el registro comercial, Altadis y JTI separados, patas provisionales', async () => {
  const lista = await listarClientes({});
  assert.equal(lista.length, SEEDS.length);
  assert.deepEqual(lista.map((c) => c.id), [...lista.map((c) => c.id)].sort((a, b) => a.localeCompare(b, 'es')));
  const ids = new Set(lista.map((c) => c.id));
  assert.equal(ids.size, lista.length);
  assert.ok(ids.has('altadis'));
  assert.ok(ids.has('jti'));
  assert.notEqual(lista.find((c) => c.id === 'altadis').nombre, lista.find((c) => c.id === 'jti').nombre);
  for (const c of lista) {
    assert.match(c.id, /^[a-z0-9]+(?:-[a-z0-9]+)*$/);
    assert.ok(c.nombre.length > 1);
    assert.deepEqual(c.patas, ['todas']);
    assert.equal(c.origen, 'provisional');
    assert.equal(c.id.includes('altadis') && c.id.includes('jti'), false);
  }
  assert.equal(ids.has('lumbre'), false);
  assert.equal(ids.has('brumelle'), false);
  assert.equal(ids.has('frescaria'), false);
});

test('si D1 ya tiene filas manda el registro vivo y sigue sin inventar patas', async () => {
  const env = {
    AUTH_DB: {
      prepare() {
        return { async all() { return { results: [{ id: 'jti', name: 'JTI Xtanco' }, { id: 'altadis', name: 'Altadis' }] }; } };
      },
    },
  };
  const lista = await listarClientes(env);
  assert.deepEqual(lista.map((c) => c.id), ['altadis', 'jti']);
  assert.deepEqual(lista[0], { id: 'altadis', nombre: 'Altadis', patas: ['todas'], origen: 'provisional' });
});

test('GET abre CORS y POST no escribe', async () => {
  const r = await onRequestGet(req());
  assert.equal(r.status, 200);
  assert.equal(r.headers.get('access-control-allow-origin'), '*');
  const body = await r.json();
  assert.equal(body.length, SEEDS.length);
  assert.equal(onRequestOptions().status, 204);
  assert.equal(onRequestOptions().headers.get('access-control-allow-methods'), 'GET, OPTIONS');
  const post = onRequestPost();
  assert.equal(post.status, 405);
  assert.equal(post.headers.get('access-control-allow-origin'), '*');
});
