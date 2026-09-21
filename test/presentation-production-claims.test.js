// FLT-100787 (Morfeo, 21-sep-2026) · dos productores ya no se llevan el mismo encargo.
//
// El claim leía el trabajo en KV, marcaba las tareas y lo reescribía sin exclusión: dos
// productores que leyeran el mismo estado recibían un 200 por la MISMA tarea. Y el worker
// procesaba todo lo que había pedido aunque el servidor le concediera una parte.
// Aquí la D1 es SQLite real (node:sqlite) y el KV devuelve a propósito un estado VIEJO,
// que es justo la condición en la que se colaba el duplicado.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {DatabaseSync} from 'node:sqlite';
import {onRequest as production} from '../functions/presentaciones/api/production.js';
import {buildGeneration} from '../functions/presentaciones/_generation.js';

function d1(){
  const db = new DatabaseSync(':memory:');
  const stmt = (sql, args = []) => ({
    bind:(...values) => stmt(sql, values),
    async run(){ return {meta:{changes:Number(db.prepare(sql).run(...args).changes)}}; },
    async first(){ return db.prepare(sql).get(...args) ?? null; },
    exec(){ return {meta:{changes:Number(db.prepare(sql).run(...args).changes)}}; }
  });
  return {
    db,
    prepare:sql => stmt(sql),
    async batch(list){ db.exec('BEGIN'); try { const out = list.map(s => s.exec()); db.exec('COMMIT'); return out; } catch (e) { db.exec('ROLLBACK'); throw e; } }
  };
}
// KV «eventual»: con `congelado`, las lecturas del trabajo devuelven la foto inicial aunque
// alguien ya haya escrito encima (lo que ve un productor en otra ubicación de Cloudflare).
function kv(inicial, {congelado = false} = {}){
  const values = new Map(inicial);
  const foto = new Map(inicial);
  return {values, async get(key, options){ const v = (congelado && foto.has(key) ? foto : values).get(key); return v == null ? null : options?.type === 'json' ? JSON.parse(v) : v; }, async put(key, value){ values.set(key, value); }};
}
const job = () => buildGeneration({client:'demo', displayName:'Demo', outputs:['audio', 'video'], languages:['es']});
function entorno({congelado = true} = {}){
  const generation = job();
  return {generation, env:{PRESENTATION_WORKER_TOKEN:'w', AUTH_DB:d1(), PRESENTATION_IDEAS:kv([['generation:demo', JSON.stringify(generation)]], {congelado}), PRESENTATION_MEDIA:{async put(){}}}};
}
const post = (env, body) => production({env, request:new Request('https://x/presentaciones/api/production', {method:'POST', headers:{authorization:'Bearer w', 'content-type':'application/json'}, body:JSON.stringify(body)})});
const reclama = (env, generation, worker, tasks) => post(env, {action:'claim', client:'demo', id:generation.id, tasks, worker});

test('dos productores con el mismo estado a la vez: sólo UNO se lleva la tarea', async () => {
  const {env, generation} = entorno();
  const [a, b] = await Promise.all([reclama(env, generation, 'mini', ['es:audio']), reclama(env, generation, 'mbp16', ['es:audio'])]);
  const estados = [a.status, b.status].sort();
  assert.deepEqual(estados, [200, 409]);
  const ganador = a.status === 200 ? await a.json() : await b.json();
  assert.deepEqual(ganador.claimedTasks, ['es:audio']);
});

test('reclamo parcial: el segundo sólo recibe la tarea que nadie tenía, y el servidor lo dice', async () => {
  const {env, generation} = entorno();
  assert.equal((await reclama(env, generation, 'mini', ['es:audio'])).status, 200);
  const r = await reclama(env, generation, 'mbp16', ['es:audio', 'es:video']);
  assert.equal(r.status, 200);
  assert.deepEqual((await r.json()).claimedTasks, ['es:video']);
});

test('el perdedor no puede pisar la tarea del ganador (ni marcarla fallida ni cambiar su progreso)', async () => {
  const {env, generation} = entorno({congelado:false});
  assert.equal((await reclama(env, generation, 'mini', ['es:audio'])).status, 200);
  await post(env, {action:'update', client:'demo', id:generation.id, worker:'mini', tasks:{'es:audio':{status:'processing', progress:40}}});
  const intruso = await post(env, {action:'update', client:'demo', id:generation.id, worker:'mbp16', tasks:{'es:audio':{status:'failed', error:'no era mía'}}});
  const body = await intruso.json();
  assert.deepEqual(body.rejectedTasks, ['es:audio']);
  assert.equal(body.job.tasks['es:audio'].status, 'processing');
  assert.equal(body.job.tasks['es:audio'].progress, 40);
});

test('sólo el dueño publica el entregable', async () => {
  const {env, generation} = entorno({congelado:false});
  assert.equal((await reclama(env, generation, 'mini', ['es:audio'])).status, 200);
  const subir = worker => production({env, request:new Request(`https://x/presentaciones/api/production?client=demo&language=es&output=audio&id=${generation.id}`, {method:'PUT', headers:{authorization:'Bearer w', 'content-type':'audio/mp4', 'x-worker':worker}, body:new Uint8Array([1, 2, 3])})});
  assert.equal((await subir('mbp16')).status, 409);
  assert.equal((await subir('mini')).status, 201);
});

test('una tarea que vuelve a la cola se puede reclamar otra vez (intento nuevo), pero nunca el mismo intento', async () => {
  const {env, generation} = entorno({congelado:false});
  assert.equal((await reclama(env, generation, 'mini', ['es:audio'])).status, 200);
  await post(env, {action:'update', client:'demo', id:generation.id, worker:'mini', tasks:{'es:audio':{status:'queued'}}});
  const otra = await reclama(env, generation, 'mbp16', ['es:audio']);
  assert.equal(otra.status, 200, 'el intento 2 es reclamable');
  assert.deepEqual((await otra.json()).claimedTasks, ['es:audio']);
  const filas = env.AUTH_DB.db.prepare('SELECT attempt, worker FROM presentation_claims ORDER BY attempt').all();
  assert.deepEqual(filas.map(f => [f.attempt, f.worker]), [[1, 'mini'], [2, 'mbp16']]);
});

test('el worker procesa sólo lo concedido y firma todas sus llamadas', async () => {
  const worker = await readFile(new URL('../tools/notebooklm-local/worker.js', import.meta.url), 'utf8');
  assert.match(worker, /const concedidas=Array\.isArray\(claimed\.claimedTasks\)\?claimed\.claimedTasks:claimIds;/);
  assert.match(worker, /tasks=Object\.values\(job\.tasks\)\.filter\(task=>concedidas\.includes\(task\.id\)\)/);
  assert.match(worker, /if\(body&&typeof body==='object'&&!body\.worker\)body=\{\.\.\.body,worker:WORKER\};/);
});
