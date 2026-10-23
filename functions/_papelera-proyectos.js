/**
 * Papelera del censo de /proyectos (Carlos, 23-oct-2026).
 *
 * api.yokup.com/projects no archiva ni borra: OPTIONS anuncia solo GET, POST y
 * OPTIONS, y DELETE cae en la página genérica del helpdesk. La baja vive aquí,
 * en AUTH_DB. El censo de la página oculta el id. La copia (ficha Yokup + la
 * fila del listado + las pertenencias de este directorio) dura 7 días y se
 * puede restaurar. Al vencer, una lectura purga la copia y deja una lápida:
 * sin lápida el proyecto volvería a salir, porque Yokup sigue publicándolo.
 */
import { auditar, asegurarDirectorio } from './_webmaster-gate.js';

export const RETENCION_MS = 7 * 24 * 60 * 60 * 1000;
const YOKUP = 'https://api.yokup.com/projects';
const SLUG = /^[A-Za-z0-9][A-Za-z0-9_-]{0,80}$/;
const TOPE_COPIA = 400000;
const READY = new WeakSet();

const SCHEMA = [
  `CREATE TABLE IF NOT EXISTS admiranext_project_trash (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL DEFAULT '',
    backup_json TEXT NOT NULL DEFAULT '',
    deleted_at INTEGER NOT NULL,
    purge_at INTEGER NOT NULL,
    deleted_by TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'trashed' CHECK(status IN ('trashed','purged')),
    purged_at INTEGER
  )`,
  `CREATE INDEX IF NOT EXISTS idx_admiranext_project_trash_purge
    ON admiranext_project_trash(status, purge_at)`,
];

function fallo(message, status) {
  const error = new Error(message);
  error.status = status;
  return error;
}

export function slugValido(valor) {
  const id = String(valor || '').trim();
  return SLUG.test(id) ? id : '';
}

export async function asegurarPapelera(env) {
  if (!env.AUTH_DB) throw fallo('AUTH_DB no configurado', 500);
  if (READY.has(env.AUTH_DB)) return;
  for (const sql of SCHEMA) await env.AUTH_DB.prepare(sql).run();
  READY.add(env.AUTH_DB);
}

function metaDe(request) {
  if (!request || !request.headers) return null;
  return {
    ip: String(request.headers.get('CF-Connecting-IP') || '').slice(0, 64),
    ua: String(request.headers.get('User-Agent') || '').slice(0, 300),
  };
}

async function cambios(resultado) {
  const n = resultado && resultado.meta && resultado.meta.changes;
  return Number.isFinite(Number(n)) ? Number(n) : 1;
}

/** Borra las copias vencidas y deja la lápida. Se llama al leer y al escribir. */
export async function purgarVencidas(env, now = Date.now(), request = null) {
  await asegurarPapelera(env);
  const due = await env.AUTH_DB.prepare(
    "SELECT id, deleted_by FROM admiranext_project_trash WHERE status='trashed' AND purge_at<=?"
  ).bind(now).all();
  const purgados = [];
  for (const row of due.results || []) {
    const hecho = await env.AUTH_DB.prepare(
      "UPDATE admiranext_project_trash SET status='purged', backup_json='', purged_at=? WHERE id=? AND status='trashed'"
    ).bind(now, row.id).run();
    if (await cambios(hecho) < 1) continue;
    await auditar(env, 'system', row.deleted_by, 'project_purged', row.id, metaDe(request));
    purgados.push(row.id);
  }
  return purgados;
}

export async function vistaPapelera(env, now = Date.now()) {
  await asegurarPapelera(env);
  const rows = await env.AUTH_DB.prepare(
    'SELECT id, name, deleted_at, purge_at, deleted_by, status FROM admiranext_project_trash ORDER BY deleted_at DESC'
  ).all();
  const todas = rows.results || [];
  return {
    hidden: todas.map((row) => row.id),
    papelera: todas.filter((row) => row.status === 'trashed').map((row) => ({
      id: row.id,
      name: row.name,
      deleted_at: row.deleted_at,
      purge_at: row.purge_at,
      deleted_by: row.deleted_by,
      remaining_ms: Math.max(0, Number(row.purge_at) - now),
    })),
  };
}

async function leerJson(respuesta) {
  if (!respuesta || !respuesta.ok) return null;
  try { return await respuesta.json(); } catch (_) { return null; }
}

async function copiaCompleta(env, id) {
  const traer = typeof env.YOKUP_FETCH === 'function' ? env.YOKUP_FETCH : fetch;
  let listado;
  try {
    listado = await leerJson(await traer(YOKUP, { headers: { Accept: 'application/json' }, cache: 'no-store' }));
  } catch (_) {
    throw fallo('Yokup no responde; no se ha guardado la copia', 502);
  }
  const entry = listado && Array.isArray(listado.projects)
    ? listado.projects.find((p) => p && String(p.id) === id)
    : null;
  if (!entry) throw fallo('ese proyecto no está en el censo de Yokup', 404);
  const fichaResp = await traer(`${YOKUP}/${encodeURIComponent(id)}`, {
    headers: { Accept: 'application/json' }, cache: 'no-store',
  }).catch(() => null);
  const fichaJson = await leerJson(fichaResp);
  const ficha = fichaJson && (fichaJson.project || fichaJson);
  let grants = [];
  try {
    await asegurarDirectorio(env);
    const rows = await env.AUTH_DB.prepare(
      'SELECT user_email, project_key, created_at, created_by FROM admiranext_user_projects WHERE project_key=?'
    ).bind(id).all();
    grants = rows.results || [];
  } catch (_) { grants = []; }
  const backup = {
    source: 'api.yokup.com/projects',
    captured_at: Date.now(),
    note: 'Yokup no admite DELETE. Esta copia es la ficha, la fila del censo y las pertenencias del directorio.',
    entry,
    ficha: ficha && typeof ficha === 'object' ? ficha : null,
    grants,
  };
  let json = JSON.stringify(backup);
  if (json.length > TOPE_COPIA) json = JSON.stringify({ ...backup, ficha: null, truncated: true });
  return { name: String(entry.name || id).slice(0, 200), json };
}

export async function eliminarProyecto(env, { id, confirm, actor, request, now = Date.now() }) {
  const slug = slugValido(id);
  if (!slug) throw fallo('slug inválido', 400);
  if (String(confirm || '') !== slug) throw fallo('escribe el slug exacto para confirmar', 409);
  await purgarVencidas(env, now, request);
  const previo = await env.AUTH_DB.prepare(
    'SELECT status FROM admiranext_project_trash WHERE id=?'
  ).bind(slug).first();
  if (previo && previo.status === 'trashed') throw fallo('ya está en la papelera', 409);
  const copia = await copiaCompleta(env, slug);
  if (previo && previo.status === 'purged') {
    await env.AUTH_DB.prepare(
      `UPDATE admiranext_project_trash
       SET name=?, backup_json=?, deleted_at=?, purge_at=?, deleted_by=?, status='trashed', purged_at=NULL
       WHERE id=?`
    ).bind(copia.name, copia.json, now, now + RETENCION_MS, actor, slug).run();
  } else {
    await env.AUTH_DB.prepare(
      `INSERT INTO admiranext_project_trash(id,name,backup_json,deleted_at,purge_at,deleted_by,status)
       VALUES(?,?,?,?,?,?,'trashed')`
    ).bind(slug, copia.name, copia.json, now, now + RETENCION_MS, actor).run();
  }
  await auditar(env, actor, actor, 'project_deleted', slug, metaDe(request));
  return { id: slug, name: copia.name, purge_at: now + RETENCION_MS };
}

export async function restaurarProyecto(env, { id, actor, request, now = Date.now() }) {
  const slug = slugValido(id);
  if (!slug) throw fallo('slug inválido', 400);
  await purgarVencidas(env, now, request);
  const row = await env.AUTH_DB.prepare(
    'SELECT id, status, backup_json FROM admiranext_project_trash WHERE id=?'
  ).bind(slug).first();
  if (!row || row.status !== 'trashed' || !row.backup_json) throw fallo('ya no se puede restaurar', 409);
  const hecho = await env.AUTH_DB.prepare(
    "DELETE FROM admiranext_project_trash WHERE id=? AND status='trashed'"
  ).bind(slug).run();
  if (await cambios(hecho) < 1) throw fallo('ya no se puede restaurar', 409);
  await auditar(env, actor, actor, 'project_restored', slug, metaDe(request));
  return { id: slug };
}
