// RECLAMO ATÓMICO DE LA COLA DEL PRODUCTOR (MorfeoMacMini, 21-09-2026 · FLT-100787 a).
//
// api/production.js reclamaba tareas leyendo el trabajo en KV, marcándolas «processing» y
// reescribiéndolo entero, sin exclusión: dos productores que leyeran el mismo estado —KV
// tarda en propagar, y aun sin retraso basta con intercalar lectura y escritura— recibían
// los dos un 200 por la MISMA tarea, y la generaban, gastaban y publicaban dos veces.
//
// La exclusión la da D1: una fila por (cliente, generación, tarea, intento) con clave única.
// Sólo una inserción gana; la otra no cambia nada (changes = 0) y ese productor se queda
// sin esa tarea. El intento es el contador `attempts` de la tarea, así que una tarea que
// vuelve a la cola se puede reclamar otra vez, pero el MISMO intento nunca dos veces,
// aunque KV devuelva un estado viejo. KV sigue siendo lo que se enseña; D1 decide de quién es.
//
// Límite conocido: no caduca. Un productor que muere tras reclamar deja la tarea suya hasta
// que alguien la reencole (nuevo intento). Eso ya pasaba antes; ahora al menos no se duplica.
const READY = new WeakSet();
const SCHEMA = `CREATE TABLE IF NOT EXISTS presentation_claims (
  client TEXT NOT NULL,
  generation TEXT NOT NULL,
  task TEXT NOT NULL,
  attempt INTEGER NOT NULL,
  worker TEXT NOT NULL,
  claimed_at INTEGER NOT NULL,
  PRIMARY KEY (client, generation, task, attempt)
)`;

async function ensure(db){
  if (READY.has(db)) return;
  await db.prepare(SCHEMA).run();
  READY.add(db);
}

// Reserva el siguiente intento de cada tarea para este productor. Devuelve los ids ganados.
export async function reserveTasks(db, {client, generation, tasks, worker, now = Date.now()}){
  await ensure(db);
  if (!tasks.length) return [];
  const insert = 'INSERT INTO presentation_claims (client, generation, task, attempt, worker, claimed_at) VALUES (?, ?, ?, ?, ?, ?) ON CONFLICT DO NOTHING';
  const results = await db.batch(tasks.map(task => db.prepare(insert).bind(client, generation, task.id, Number(task.attempts || 0) + 1, worker, now)));
  return tasks.filter((_, index) => Number(results[index]?.meta?.changes || 0) === 1).map(task => task.id);
}

// Quién tiene ahora la tarea: manda el reclamo del intento más reciente. '' si nadie.
export async function claimOwner(db, {client, generation, task}){
  await ensure(db);
  const row = await db.prepare('SELECT worker FROM presentation_claims WHERE client = ? AND generation = ? AND task = ? ORDER BY attempt DESC LIMIT 1').bind(client, generation, task).first();
  return row ? String(row.worker || '') : '';
}
