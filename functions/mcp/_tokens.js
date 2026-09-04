/*
 * Tokens MCP del Generador de Presentaciones (0558 · 2026-09-04).
 *
 * Un consejero (silicio) o una persona conecta su asistente al MCP con un token
 * `anmcp_…` ligado a UN usuario del directorio (/usuarios). El token no lleva
 * privilegios: en cada llamada se cruza con el directorio (activo + rol + proyecto),
 * así que dar de baja o revocar desde /usuarios corta también el MCP. Se guarda el
 * hash SHA-256, nunca el token: se enseña una sola vez al crearlo.
 */

export const MCP_TOKENS_TABLE_SQL =
  'CREATE TABLE IF NOT EXISTS admiranext_mcp_tokens (' +
  'id TEXT PRIMARY KEY, token_hash TEXT NOT NULL UNIQUE, email TEXT NOT NULL, label TEXT, ' +
  'created_at INTEGER NOT NULL, created_by TEXT, last_used_at INTEGER, revoked_at INTEGER)';

const enc = new TextEncoder();
const READY = new WeakSet();

function b64url(bytes){
  let value = btoa(String.fromCharCode(...new Uint8Array(bytes)));
  return value.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export async function sha256Hex(value){
  const digest = await crypto.subtle.digest('SHA-256', enc.encode(String(value)));
  return [...new Uint8Array(digest)].map(b => b.toString(16).padStart(2, '0')).join('');
}

export function newToken(){
  const bytes = new Uint8Array(32); crypto.getRandomValues(bytes);
  return 'anmcp_' + b64url(bytes);
}

export function bearerOf(request){
  const auth = String(request.headers.get('Authorization') || '');
  const match = /^Bearer\s+(\S+)$/i.exec(auth);
  return match ? match[1] : '';
}

export async function ensureTokensTable(env){
  if (!env || !env.AUTH_DB || READY.has(env.AUTH_DB)) return;
  await env.AUTH_DB.prepare(MCP_TOKENS_TABLE_SQL).run();
  READY.add(env.AUTH_DB);
}

export async function createToken(env, {email, label, createdBy}){
  await ensureTokensTable(env);
  const token = newToken();
  const row = { id: crypto.randomUUID(), token_hash: await sha256Hex(token), email: String(email).toLowerCase(), label: String(label || '').slice(0, 80), created_at: Date.now(), created_by: String(createdBy || '').slice(0, 120) };
  await env.AUTH_DB.prepare('INSERT INTO admiranext_mcp_tokens(id,token_hash,email,label,created_at,created_by) VALUES(?,?,?,?,?,?)')
    .bind(row.id, row.token_hash, row.email, row.label, row.created_at, row.created_by).run();
  return { token, row };
}

export async function listTokens(env){
  await ensureTokensTable(env);
  const rows = await env.AUTH_DB.prepare('SELECT id,email,label,created_at,created_by,last_used_at,revoked_at FROM admiranext_mcp_tokens ORDER BY created_at DESC').all();
  return rows.results || [];
}

export async function revokeToken(env, id, by){
  await ensureTokensTable(env);
  await env.AUTH_DB.prepare('UPDATE admiranext_mcp_tokens SET revoked_at=? WHERE id=? AND revoked_at IS NULL').bind(Date.now(), String(id)).run();
  return { id, revoked_by: by };
}

/** Devuelve la fila viva del token o null. Anota last_used_at sin bloquear. */
export async function tokenRow(env, token, waitUntil){
  if (!token || !env || !env.AUTH_DB) return null;
  await ensureTokensTable(env);
  const hash = await sha256Hex(token);
  const row = await env.AUTH_DB.prepare('SELECT id,email,label,revoked_at FROM admiranext_mcp_tokens WHERE token_hash=?').bind(hash).first();
  if (!row || row.revoked_at) return null;
  const touch = env.AUTH_DB.prepare('UPDATE admiranext_mcp_tokens SET last_used_at=? WHERE id=?').bind(Date.now(), row.id).run().catch(() => {});
  if (typeof waitUntil === 'function') waitUntil(touch);
  return row;
}
