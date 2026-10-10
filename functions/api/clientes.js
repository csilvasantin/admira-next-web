/**
 * GET /api/clientes — censo de clientes, de solo lectura y CON SESIÓN (Carlos, 10-10-2026):
 * sin la sesión del directorio de AdmiraNeXT (_webmaster-gate.js) responde 401 y no sale ningún nombre.
 *
 * Clientes: D1 admiranext_commercial_projects, o las semillas de
 * functions/_xpace-registry.js si no hay base. Admira se añade si falta.
 *
 * Patas: D1 admiranext_clientes_acceso (migrations/0007_clientes_acceso.sql y
 * 0008_jti_global.sql). Starbucks, Altadis, JTI y Admira son globales (las cinco patas). El resto
 * conserva patas:["todas"] y origen:"provisional", con global:false.
 */
import { SEEDS } from '../_xpace-registry.js';
import { conSesion } from '../_marcas-publicas.js';

const CORS = {
  'access-control-allow-origin': '*',
  'access-control-allow-methods': 'GET, OPTIONS',
  'access-control-max-age': '86400',
};

const PATAS_GLOBALES = ['studio', 'store', 'tv', 'app', 'biz'];
const ORIGEN_CARLOS = 'carlos-2026-10-04';

/** Misma decisión que persisten migrations/0007_clientes_acceso.sql y 0008_jti_global.sql. */
export const ACCESO_GLOBAL = {
  starbucks: { nombre: 'Starbucks', patas: PATAS_GLOBALES, origen: ORIGEN_CARLOS, por_defecto: false },
  altadis: { nombre: 'Altadis', patas: PATAS_GLOBALES, origen: ORIGEN_CARLOS, por_defecto: false },
  jti: { nombre: 'JTI Xtanco', patas: PATAS_GLOBALES, origen: ORIGEN_CARLOS, por_defecto: false },
  admira: { nombre: 'Admira', patas: PATAS_GLOBALES, origen: ORIGEN_CARLOS, por_defecto: true },
};

function patasGuardadas(valor) {
  if (Array.isArray(valor)) return valor;
  if (typeof valor !== 'string' || !valor) return null;
  try {
    const parsed = JSON.parse(valor);
    return Array.isArray(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

export function fichaCliente(fila, acceso) {
  const id = String(fila.id || '').trim();
  const nombre = String(fila.name || fila.label || acceso?.nombre || '').trim();
  if (acceso) {
    const ficha = {
      id,
      nombre,
      patas: patasGuardadas(acceso.patas) || ['todas'],
      global: Number(acceso.es_global) === 1 || acceso.es_global === true,
      origen: acceso.origen || 'provisional',
    };
    if (Number(acceso.por_defecto) === 1 || acceso.por_defecto === true) ficha.por_defecto = true;
    return ficha;
  }
  const regla = ACCESO_GLOBAL[id];
  if (regla) {
    const ficha = { id, nombre: nombre || regla.nombre, patas: regla.patas, global: true, origen: regla.origen };
    if (regla.por_defecto) ficha.por_defecto = true;
    return ficha;
  }
  return { id, nombre, patas: ['todas'], global: false, origen: 'provisional' };
}

function ordenar(lista) {
  return lista.sort((a, b) => {
    if (a.global !== b.global) return a.global ? -1 : 1;
    if (Boolean(a.por_defecto) !== Boolean(b.por_defecto)) return a.por_defecto ? -1 : 1;
    return a.id.localeCompare(b.id, 'es');
  });
}

async function filasComerciales(env) {
  if (env?.AUTH_DB) {
    try {
      const q = await env.AUTH_DB.prepare(
        'SELECT id, name FROM admiranext_commercial_projects ORDER BY id'
      ).all();
      if (Array.isArray(q?.results) && q.results.length) return q.results;
    } catch {
      /* sin tabla: semillas */
    }
  }
  return SEEDS.map((p) => ({ id: p.id, name: p.label }));
}

async function accesoPersistido(env) {
  if (!env?.AUTH_DB) return null;
  try {
    const q = await env.AUTH_DB.prepare(
      'SELECT id, nombre, patas, es_global, origen, por_defecto FROM admiranext_clientes_acceso'
    ).all();
    if (!Array.isArray(q?.results) || !q.results.length) return null;
    return new Map(q.results.map((fila) => [fila.id, fila]));
  } catch {
    return null;
  }
}

export async function listarClientes(env) {
  const filas = await filasComerciales(env);
  const acceso = await accesoPersistido(env);
  const porId = new Map(filas.map((fila) => [fila.id, fila]));
  if (!porId.has('admira')) porId.set('admira', { id: 'admira', name: 'Admira' });
  if (acceso) {
    for (const [id, fila] of acceso) {
      if (!porId.has(id)) porId.set(id, { id, name: fila.nombre });
    }
  }
  return ordenar([...porId.values()].map((fila) => fichaCliente(fila, acceso ? acceso.get(fila.id) : null)));
}

function json(body, status, extra = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'x-content-type-options': 'nosniff',
      'cache-control': 'public, max-age=60',
      ...CORS,
      ...extra,
    },
  });
}

export async function onRequestGet(context) {
  if (!(await conSesion(context.request, context.env))) {
    return json({ error: 'El censo de clientes es interno: identifícate en /webmaster.', acceso: '/clientes/' }, 401, { 'cache-control': 'no-store' });
  }
  return json(await listarClientes(context.env), 200, { 'cache-control': 'private, no-store', vary: 'Cookie' });
}

export function onRequestOptions() {
  return new Response(null, { status: 204, headers: CORS });
}

function soloLectura() {
  return json({ error: 'Solo lectura.' }, 405, { allow: 'GET, OPTIONS' });
}

export const onRequestPost = soloLectura;
export const onRequestPut = soloLectura;
export const onRequestDelete = soloLectura;
export const onRequestPatch = soloLectura;
