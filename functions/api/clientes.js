/**
 * GET /api/clientes — censo público de solo lectura.
 *
 * Fuente: la tabla D1 admiranext_commercial_projects cuando ya tiene filas
 * (el mismo registro que siembra functions/_xpace-registry.js). Si no hay
 * base o está vacía, las semillas de ese registro. No se inventan clientes
 * y no se lee el catálogo de marcas ficticias de /marcablanca.
 *
 * Ninguna fila declara a qué patas (studio, store, tv, app, biz) tiene
 * acceso, así que cada una sale con patas:["todas"] y origen:"provisional".
 */
import { SEEDS } from '../_xpace-registry.js';

const CORS = {
  'access-control-allow-origin': '*',
  'access-control-allow-methods': 'GET, OPTIONS',
  'access-control-max-age': '86400',
};

export function fichaCliente(fila) {
  return {
    id: String(fila.id || '').trim(),
    nombre: String(fila.name || fila.label || '').trim(),
    patas: ['todas'],
    origen: 'provisional',
  };
}

export async function listarClientes(env) {
  let filas = null;
  if (env?.AUTH_DB) {
    try {
      const q = await env.AUTH_DB.prepare(
        'SELECT id, name FROM admiranext_commercial_projects ORDER BY id'
      ).all();
      if (Array.isArray(q?.results) && q.results.length) filas = q.results;
    } catch {
      filas = null;
    }
  }
  if (!filas) filas = SEEDS.map((p) => ({ id: p.id, name: p.label }));
  return filas.map(fichaCliente).sort((a, b) => a.id.localeCompare(b.id, 'es'));
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
  return json(await listarClientes(context.env), 200);
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
