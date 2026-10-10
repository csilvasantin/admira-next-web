import { ESQUEMA, aEsquema, resolverMacro, validar } from '../subdemos/admira-demo.mjs';
import { RECORRIDOS } from '../subdemos/recorridos-nativos.mjs';
import { ORIGENES_DEMO, choque, resolverNombre } from '../subdemos/nombres-demo.mjs';
import { csrfValido, exigirRol, buscarUsuario } from './_webmaster-gate.js';
import { tokenRow } from './mcp/_tokens.js';
import bizRaw from '../subdemos/biz.subdemos.json' with { type: 'json' };
import storeRaw from '../subdemos/store.subdemos.json' with { type: 'json' };
import studioRaw from '../subdemos/studio.subdemos.json' with { type: 'json' };
import appDoc from '../subdemos/v2/app.json' with { type: 'json' };
import alseaBizApp from '../subdemos/v2/alsea-biz-app.json' with { type: 'json' };
import giraCarlos from '../subdemos/v2/gira-carlos.json' with { type: 'json' };

const REPO = [
  aEsquema(bizRaw, RECORRIDOS.biz),
  aEsquema(storeRaw, RECORRIDOS.store),
  aEsquema(studioRaw, RECORRIDOS.studio),
  validar(appDoc),
];
const MACROS = [validar(alseaBizApp), validar(giraCarlos)];
const ORIGENES = new Set(ORIGENES_DEMO);
const TABLA = `CREATE TABLE IF NOT EXISTS demos (
  id TEXT PRIMARY KEY, kind TEXT NOT NULL, site TEXT, status TEXT NOT NULL,
  version INTEGER NOT NULL, doc TEXT NOT NULL, updated_at INTEGER NOT NULL, updated_by TEXT)`;
const VERSIONES = `CREATE TABLE IF NOT EXISTS demo_versions (
  id TEXT NOT NULL, version INTEGER NOT NULL, doc TEXT NOT NULL,
  saved_at INTEGER NOT NULL, saved_by TEXT, PRIMARY KEY (id, version))`;
const listo = new WeakSet();

function origenCors(request) {
  const origin = request?.headers?.get('origin') || '';
  return ORIGENES.has(origin) ? origin : '*';
}

const responder = (body, status = 200, cache = 'no-store', request) => new Response(JSON.stringify(body), {
  status,
  headers: {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': cache,
    'x-content-type-options': 'nosniff',
    'access-control-allow-origin': origenCors(request),
    'access-control-allow-methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'access-control-allow-headers': 'Content-Type, Authorization, X-Admira-CSRF',
    vary: 'origin',
  },
});

export async function asegurarDemos(env) {
  if (!env?.AUTH_DB || listo.has(env.AUTH_DB)) return;
  await env.AUTH_DB.prepare(TABLA).run();
  await env.AUTH_DB.prepare(VERSIONES).run();
  listo.add(env.AUTH_DB);
}

function repoDe(id) {
  return REPO.find((demo) => demo.id === id) || MACROS.find((macro) => macro.id === id) || null;
}

async function fila(env, id) {
  if (!env?.AUTH_DB) return null;
  await asegurarDemos(env);
  return env.AUTH_DB.prepare('SELECT id, status, version, doc FROM demos WHERE id=?').bind(id).first();
}

function docDe(row) {
  return row ? validar(JSON.parse(row.doc)) : null;
}

export async function leer(env, id) {
  const row = await fila(env, id);
  return docDe(row) || repoDe(id);
}

export async function publicados(env) {
  const mapa = new Map([...REPO, ...MACROS].map((demo) => [demo.id, demo]));
  if (env?.AUTH_DB) {
    try {
      await asegurarDemos(env);
      const rows = await env.AUTH_DB.prepare('SELECT doc, status FROM demos').all();
      for (const row of rows.results || []) {
        const doc = validar(JSON.parse(row.doc));
        if (doc.status === 'published') mapa.set(doc.id, doc);
      }
    } catch { /* el JSON del repo sigue siendo la respuesta */ }
  }
  return [...mapa.values()];
}

function cambios(result) {
  return Number(result?.meta?.changes ?? result?.changes ?? 0);
}

async function archivar(env, doc, user, now) {
  await env.AUTH_DB.prepare(
    'INSERT INTO demo_versions(id, version, doc, saved_at, saved_by) VALUES(?,?,?,?,?)'
  ).bind(doc.id, doc.version, JSON.stringify(doc), now, user.email).run();
}

async function tocarMacros(env, demo, user, now) {
  const refs = new Set(demo.subdemos.map((sub) => demo.site + '/' + sub.id));
  const rows = await env.AUTH_DB.prepare("SELECT doc FROM demos WHERE kind='macro' AND status!='deleted'").all();
  for (const row of rows.results || []) {
    const macro = validar(JSON.parse(row.doc));
    if (!macro.items.some((item) => refs.has(item.ref))) continue;
    const next = validar({ ...macro, version: macro.version + 1 });
    const guardado = await env.AUTH_DB.prepare(
      'UPDATE demos SET version=?, doc=?, updated_at=?, updated_by=? WHERE id=? AND version=?'
    ).bind(next.version, JSON.stringify(next), now, user.email, macro.id, macro.version).run();
    if (cambios(guardado) === 1) await archivar(env, next, user, now);
  }
}

async function documentos(env) {
  const lista = await publicados(env);
  if (!env?.AUTH_DB) return lista;
  try {
    await asegurarDemos(env);
    const rows = await env.AUTH_DB.prepare('SELECT doc FROM demos').all();
    for (const row of rows.results || []) {
      try { lista.push(validar(JSON.parse(row.doc))); } catch { /* un borrador ilegible no bloquea el resto */ }
    }
  } catch { /* sin base, manda el repo */ }
  return lista;
}

async function guardar(env, doc, expected, user, estado) {
  await asegurarDemos(env);
  const ocupado = choque(await documentos(env), doc);
  if (ocupado) return { error: responder({ error: 'nombre ocupado', nombre: ocupado }, 409) };
  const row = await fila(env, doc.id);
  const base = docDe(row) || repoDe(doc.id);
  if (!base || base.version !== expected) {
    return { error: responder({ error: 'version', version: base?.version || 0 }, 409) };
  }
  const next = validar({ ...doc, version: base.version + 1, status: estado });
  const now = Date.now();
  const sql = row
    ? ['UPDATE demos SET kind=?, site=?, status=?, version=?, doc=?, updated_at=?, updated_by=? WHERE id=? AND version=?',
      [next.kind, next.site || '', next.status, next.version, JSON.stringify(next), now, user.email, next.id, base.version]]
    : ['INSERT INTO demos(id, kind, site, status, version, doc, updated_at, updated_by) VALUES(?,?,?,?,?,?,?,?)',
      [next.id, next.kind, next.site || '', next.status, next.version, JSON.stringify(next), now, user.email]];
  try {
    const guardado = await env.AUTH_DB.prepare(sql[0]).bind(...sql[1]).run();
    if (row && cambios(guardado) !== 1) return { error: responder({ error: 'version', version: base.version }, 409) };
  } catch {
    return { error: responder({ error: 'version', version: base.version }, 409) };
  }
  await archivar(env, next, user, now);
  if (next.kind === 'demo' && next.status === 'published') await tocarMacros(env, next, user, now);
  return { doc: next };
}

export async function autor(request, env, waitUntil) {
  const bearer = /^Bearer\s+(\S+)$/i.exec(request.headers.get('Authorization') || '')?.[1] || '';
  if (bearer.startsWith('anmcp_')) {
    const row = await tokenRow(env, bearer, waitUntil);
    const user = row && await buscarUsuario(env, row.email);
    if (!user || user.status !== 'active' || !['admin', 'editor'].includes(user.role)) return null;
    return { email: user.email, role: user.role, via: 'agent' };
  }
  const current = await exigirRol(request, env, ['admin', 'editor']);
  if (!current || !csrfValido(request, current)) return null;
  return current;
}

async function cuerpo(request) {
  const text = await request.text();
  if (text.length > 500000) throw new Error('cuerpo');
  return JSON.parse(text);
}

export async function onRequest(context) {
  const { request, env } = context;
  if (request.method === 'OPTIONS') return responder({ ok: true });
  const partes = new URL(request.url).pathname.replace(/\/+$/, '').split('/').filter(Boolean);
  const id = partes[2] ? decodeURIComponent(partes[2]) : '';
  const accion = partes[3] || '';
  try {
    if (request.method === 'GET' && !id) {
      const todos = await publicados(env);
      const demos = todos.filter((doc) => doc.kind === 'demo');
      const macros = todos.filter((doc) => doc.kind === 'macro').map((macro) => resolverMacro(macro, demos));
      return responder({ schema: ESQUEMA, demos, macros }, 200, 'public, max-age=60');
    }
    if (request.method === 'GET' && id === 'resolver') {
      const nombre = new URL(request.url).searchParams.get('nombre') || '';
      const todos = await publicados(env);
      const hallado = resolverNombre(todos, nombre);
      const demos = todos.filter((item) => item.kind === 'demo');
      const plan = hallado.macro ? resolverMacro(hallado.macro, demos) : (hallado.demo || null);
      const cuerpoRes = {
        tipo: hallado.tipo,
        nombre: hallado.nombre || '',
        id: hallado.id || '',
        via: hallado.via || '',
        candidatos: hallado.candidatos || [],
        nombres: hallado.nombres || [],
        plan,
      };
      if (Number.isInteger(hallado.index)) cuerpoRes.index = hallado.index;
      const status = hallado.tipo === 'no' || hallado.tipo === 'ambiguo' || hallado.tipo === 'reservado' ? 404 : 200;
      return responder(cuerpoRes, status, 'public, max-age=60', request);
    }
    if (request.method === 'GET' && id && !accion) {
      let doc = await leer(env, id);
      if (!doc || doc.status !== 'published') {
        const hallado = resolverNombre(await publicados(env), id);
        doc = hallado.macro || null;
      }
      if (!doc || doc.status !== 'published') return responder({ error: 'no encontrada' }, 404);
      const demos = (await publicados(env)).filter((item) => item.kind === 'demo');
      return responder(doc.kind === 'macro' ? resolverMacro(doc, demos) : doc, 200, 'public, max-age=60', request);
    }
    const user = await autor(request, env, context.waitUntil);
    if (!user) return responder({ error: 'prohibido' }, 403);
    if (request.method === 'POST' && !id) {
      const raw = await cuerpo(request);
      const doc = validar({ ...raw, version: 1, status: 'draft' });
      if (repoDe(doc.id) || await fila(env, doc.id)) return responder({ error: 'ya existe' }, 409);
      const ocupado = choque(await documentos(env), doc);
      if (ocupado) return responder({ error: 'nombre ocupado', nombre: ocupado }, 409);
      await asegurarDemos(env);
      const now = Date.now();
      await env.AUTH_DB.prepare(
        'INSERT INTO demos(id, kind, site, status, version, doc, updated_at, updated_by) VALUES(?,?,?,?,?,?,?,?)'
      ).bind(doc.id, doc.kind, doc.site || '', doc.status, doc.version, JSON.stringify(doc), now, user.email).run();
      await archivar(env, doc, user, now);
      return responder(doc, 201);
    }
    if (!id) return responder({ error: 'no encontrada' }, 404);
    if (request.method === 'PUT' && !accion) {
      const raw = await cuerpo(request);
      const doc = validar({ ...raw, id, status: 'draft' });
      const saved = await guardar(env, doc, Number(raw.version), user, 'draft');
      return saved.error || responder(saved.doc);
    }
    if (request.method === 'POST' && accion === 'publish') {
      const actual = await leer(env, id);
      if (!actual || actual.status === 'deleted') return responder({ error: 'no encontrada' }, 404);
      const saved = await guardar(env, actual, actual.version, user, 'published');
      return saved.error || responder(saved.doc);
    }
    if (request.method === 'DELETE' && !accion) {
      const actual = await leer(env, id);
      if (!actual || actual.status === 'deleted') return responder({ error: 'no encontrada' }, 404);
      if (!await fila(env, id)) return responder({ error: 'el respaldo del repo no se borra' }, 409);
      const saved = await guardar(env, { ...actual, status: 'deleted' }, actual.version, user, 'deleted');
      return saved.error || responder(saved.doc);
    }
    if (request.method === 'POST' && accion === 'restore') {
      const row = await fila(env, id);
      const actual = docDe(row);
      if (!actual || actual.status !== 'deleted') return responder({ error: 'no encontrada' }, 404);
      const saved = await guardar(env, actual, actual.version, user, 'draft');
      return saved.error || responder(saved.doc);
    }
    return responder({ error: 'no encontrada' }, 404);
  } catch (error) {
    const mensaje = error instanceof SyntaxError ? 'JSON no válido' : 'documento no válido';
    return responder({ error: mensaje }, 400);
  }
}
