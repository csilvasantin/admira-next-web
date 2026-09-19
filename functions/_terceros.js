/*
 * Acceso a terceros (FLT-100644 / FLT-100645).
 * guest|partner: solo lo contratado, con caducidad, sin admin/super ni MCP de flota.
 * La contraseña de sala Presentar no entra aquí.
 */

export const APPS = ['live', 'control', 'webmaster', 'generador', 'mcp', 'yokup'];
export const KINDS = new Set(['team', 'guest', 'partner']);
export const TERCERO = new Set(['guest', 'partner']);
export const OWNERS = ['csilva@admira.com', 'csilvasantin@gmail.com'];

export function kindDe(value) {
  const k = String(value || 'team').trim().toLowerCase();
  return KINDS.has(k) ? k : '';
}

export function esTercero(kind) {
  return TERCERO.has(kindDe(kind));
}

export function esOwner(email) {
  return OWNERS.includes(String(email || '').trim().toLowerCase());
}

export function parseApps(value) {
  const requested = [...new Set((Array.isArray(value) ? value : []).map((v) => String(v || '').trim().toLowerCase()).filter(Boolean))];
  return requested.filter((app) => APPS.includes(app));
}

export function parseExpires(value) {
  if (value == null || value === '') return 0;
  if (typeof value === 'number' && Number.isFinite(value) && value > 0) return Math.floor(value);
  const raw = String(value).trim();
  const ms = Date.parse(raw.includes('T') ? raw : raw + 'T23:59:59.000Z');
  return Number.isFinite(ms) ? ms : 0;
}

export function caducado(user) {
  const exp = Number(user && user.expires_at || 0);
  return exp > 0 && exp < Date.now();
}
