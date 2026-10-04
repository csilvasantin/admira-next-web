import test from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { readFileSync } from 'node:fs';
import { SEEDS } from '../functions/_xpace-registry.js';
import { listarClientes, onRequestGet, onRequestOptions, onRequestPost } from '../functions/api/clientes.js';

const PATAS = ['studio', 'store', 'tv', 'app', 'biz'];
const req = () => ({ request: new Request('https://www.admiranext.com/api/clientes'), env: {} });

function globales(lista) {
  return lista.filter((c) => c.global);
}

test('sin D1 hay Admira por defecto, tres globales primero y el resto provisional', async () => {
  const lista = await listarClientes({});
  assert.equal(lista.length, SEEDS.length + 1);
  assert.deepEqual(globales(lista).map((c) => c.id), ['admira', 'altadis', 'starbucks']);
  assert.deepEqual(lista.slice(0, 3).map((c) => c.id), ['admira', 'altadis', 'starbucks']);
  const admira = lista[0];
  assert.equal(admira.nombre, 'Admira');
  assert.equal(admira.por_defecto, true);
  assert.equal(admira.origen, 'carlos-2026-10-04');
  assert.deepEqual(admira.patas, PATAS);
  for (const id of ['altadis', 'starbucks']) {
    const c = lista.find((x) => x.id === id);
    assert.equal(c.global, true);
    assert.equal(c.por_defecto, undefined);
    assert.equal(c.origen, 'carlos-2026-10-04');
    assert.deepEqual(c.patas, PATAS);
  }
  const jti = lista.find((c) => c.id === 'jti');
  const mx = lista.find((c) => c.id === 'starbucks-mexico');
  assert.notEqual(lista.find((c) => c.id === 'altadis').nombre, jti.nombre);
  assert.deepEqual(jti, { id: 'jti', nombre: 'JTI Xtanco', patas: ['todas'], global: false, origen: 'provisional' });
  assert.equal(mx.global, false);
  assert.deepEqual(mx.patas, ['todas']);
  assert.equal(lista.some((c) => c.id === 'lumbre'), false);
});

test('D1 manda: la migración deja los tres globales y no toca al resto', async () => {
  const db = new DatabaseSync(':memory:');
  db.exec(`CREATE TABLE admiranext_commercial_projects (id TEXT PRIMARY KEY, name TEXT NOT NULL, circuit TEXT NOT NULL, updated_at INTEGER NOT NULL, updated_by TEXT NOT NULL)`);
  const insert = db.prepare('INSERT INTO admiranext_commercial_projects VALUES(?,?,?,?,?)');
  for (const p of SEEDS) insert.run(p.id, p.label, p.circuit, 1, 'test');
  db.exec(readFileSync(new URL('../migrations/0007_clientes_acceso.sql', import.meta.url), 'utf8'));
  const prepare = (sql) => {
    const statement = db.prepare(sql);
    return { async all() { return { results: statement.all() }; } };
  };
  const lista = await listarClientes({ AUTH_DB: { prepare } });
  assert.equal(lista.length, SEEDS.length + 1);
  assert.deepEqual(globales(lista).map((c) => ({ id: c.id, nombre: c.nombre, patas: c.patas, origen: c.origen, por_defecto: c.por_defecto })), [
    { id: 'admira', nombre: 'Admira', patas: PATAS, origen: 'carlos-2026-10-04', por_defecto: true },
    { id: 'altadis', nombre: 'Altadis', patas: PATAS, origen: 'carlos-2026-10-04', por_defecto: undefined },
    { id: 'starbucks', nombre: 'Starbucks', patas: PATAS, origen: 'carlos-2026-10-04', por_defecto: undefined },
  ]);
  const guardados = db.prepare('SELECT id FROM admiranext_clientes_acceso ORDER BY id').all().map((f) => f.id);
  assert.deepEqual(guardados, ['admira', 'altadis', 'starbucks']);
  assert.equal(db.prepare('SELECT name FROM admiranext_commercial_projects WHERE id=?').get('jti').name, 'JTI Xtanco');
});

test('GET abre CORS y POST no escribe', async () => {
  const r = await onRequestGet(req());
  assert.equal(r.status, 200);
  assert.equal(r.headers.get('access-control-allow-origin'), '*');
  const body = await r.json();
  assert.equal(body.length, SEEDS.length + 1);
  assert.equal(body[0].id, 'admira');
  assert.equal(onRequestOptions().status, 204);
  assert.equal(onRequestOptions().headers.get('access-control-allow-methods'), 'GET, OPTIONS');
  const post = onRequestPost();
  assert.equal(post.status, 405);
  assert.equal(post.headers.get('access-control-allow-origin'), '*');
});
