/*
 * Enlace de un solo dispositivo para /pruebas/visor/ (Carlos, 10-oct-2026, 13:46).
 * La clave VISOR_LINK_KEY vive en Cloudflare. No se escribe en el código.
 * Caduca como máximo a los 7 días. Revocar es borrar la clave visor:<id> en KV.
 */
import { qrSvg } from './_qr-svg.js';

export const RUTA_ALTA_VISOR = '/pruebas/api/visor-enlace';
export const COOKIE_VISOR = 'admira_visor';
export const DIAS_MAX_VISOR = 7;
const MAX_SEG = DIAS_MAX_VISOR * 24 * 60 * 60;
const TOKEN_MAX = 600;

const enc = new TextEncoder();

function b64url(bytes) {
  let s = '';
  for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
function unb64url(value) {
  const raw = String(value).replace(/-/g, '+').replace(/_/g, '/');
  const padded = raw + '='.repeat((4 - raw.length % 4) % 4);
  const bin = atob(padded);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}
async function hmacB64(key, msg) {
  const k = await crypto.subtle.importKey('raw', enc.encode(key), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const mac = new Uint8Array(await crypto.subtle.sign('HMAC', k, enc.encode(msg)));
  // 128 bits caben en el QR del deep link. La clave sigue entera en Cloudflare.
  return b64url(mac.slice(0, 16));
}
function iguales(a, b) {
  a = String(a);
  b = String(b);
  if (a.length !== b.length) return false;
  let r = 0;
  for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return r === 0;
}
function idValido(id) {
  return typeof id === 'string' && /^[A-Za-z0-9_-]{16,40}$/.test(id);
}
function ahoraSeg(now) {
  return Number.isInteger(now) ? now : Math.floor(Date.now() / 1000);
}

export function esRutaVisor(pathname) {
  if (typeof pathname !== 'string' || pathname.includes('..') || pathname.includes('\\') || pathname.includes('\0')) return false;
  return pathname === '/pruebas/visor' || pathname.startsWith('/pruebas/visor/');
}

export function deepLink(pageUrl) {
  const u = new URL(pageUrl);
  if (u.protocol !== 'https:') throw new Error('https');
  return `fb-viewapp://web_app_deep_link?appName=Admira%20Visor&appUrl=${encodeURIComponent(u.toString())}`;
}

export async function firmarToken(key, { id, iat, exp }) {
  const payload = b64url(enc.encode(JSON.stringify({ id, iat, exp })));
  const sig = await hmacB64(key, `visor:${payload}`);
  return `${payload}.${sig}`;
}

export async function leerToken(key, token, now) {
  now = ahoraSeg(now);
  if (typeof token !== 'string' || token.length < 20 || token.length > TOKEN_MAX) return null;
  const i = token.indexOf('.');
  if (i <= 0 || token.indexOf('.', i + 1) !== -1) return null;
  const payload = token.slice(0, i);
  const sig = token.slice(i + 1);
  if (!iguales(sig, await hmacB64(key, `visor:${payload}`))) return null;
  let data;
  try { data = JSON.parse(new TextDecoder().decode(unb64url(payload))); } catch (_) { return null; }
  if (!data || !idValido(data.id) || !Number.isInteger(data.iat) || !Number.isInteger(data.exp)) return null;
  if (data.exp <= data.iat || data.exp - data.iat > MAX_SEG) return null;
  if (data.iat > now + 60 || data.exp <= now) return null;
  return { id: data.id, iat: data.iat, exp: data.exp };
}

function cookiesNombradas(request, name) {
  const values = [];
  for (const part of String(request.headers.get('Cookie') || '').split(';')) {
    const p = part.trim();
    const i = p.indexOf('=');
    if (i > 0 && p.slice(0, i) === name) values.push(p.slice(i + 1));
  }
  return values;
}

async function leerCookie(key, cookie, now) {
  const parts = String(cookie || '').split('.');
  if (parts.length !== 4) return null;
  const [id, expRaw, random, sig] = parts;
  if (!idValido(id) || !/^[A-Za-z0-9_-]{16,40}$/.test(random)) return null;
  if (!/^\d+$/.test(expRaw)) return null;
  const exp = Number(expRaw);
  if (!Number.isInteger(exp) || exp <= now || exp - now > MAX_SEG) return null;
  if (!iguales(sig, await hmacB64(key, `dev:${id}:${exp}:${random}`))) return null;
  return { id, exp, random };
}

async function emitirCookie(key, { id, exp, random, now }) {
  const sig = await hmacB64(key, `dev:${id}:${exp}:${random}`);
  const value = `${id}.${exp}.${random}.${sig}`;
  const maxAge = Math.max(1, exp - now);
  return `${COOKIE_VISOR}=${value}; Path=/pruebas/visor/; Max-Age=${maxAge}; HttpOnly; Secure; SameSite=Lax`;
}

async function leerFila(kv, id) {
  const raw = await kv.get(`visor:${id}`);
  if (!raw) return null;
  const row = JSON.parse(raw);
  if (!row || row.id !== id || !Number.isInteger(row.iat) || !Number.isInteger(row.exp)) return null;
  if (row.device !== null && typeof row.device !== 'string') return null;
  return row;
}

async function guardarFila(kv, row) {
  await kv.put(`visor:${row.id}`, JSON.stringify({ id: row.id, iat: row.iat, exp: row.exp, device: row.device || null, boundAt: row.boundAt || null }), { expiration: row.exp });
}

function uaDe(request) {
  return String(request.headers.get('user-agent') || '').replace(/[\u0000-\u001f]/g, ' ').trim().slice(0, 180);
}

export async function registrarUso(env, { id, ua, ok, via, now }) {
  const linea = {
    visor: true,
    id: id || null,
    ts: new Date(ahoraSeg(now) * 1000).toISOString(),
    ua: String(ua || '').slice(0, 180),
    ok: Boolean(ok),
    via: String(via || '').slice(0, 24),
  };
  try { console.log(JSON.stringify(linea)); } catch (_) {}
  if (!env || !env.VISOR_LINKS) return;
  try {
    const clave = `visor-uso:${linea.id || 'x'}:${ahoraSeg(now)}:${b64url(crypto.getRandomValues(new Uint8Array(4)))}`;
    await env.VISOR_LINKS.put(clave, JSON.stringify(linea), { expirationTtl: MAX_SEG });
  } catch (_) {}
}

export async function crearEnlace(env, { origin, dias, now }) {
  now = ahoraSeg(now);
  if (!env || !env.VISOR_LINK_KEY || !env.VISOR_LINKS) return { ok: false, status: 503, error: 'Falta la clave del visor.' };
  if (!Number.isInteger(dias) || dias < 1 || dias > DIAS_MAX_VISOR) return { ok: false, status: 400, error: 'El enlace caduca entre 1 y 7 días.' };
  let page;
  try { page = new URL(origin); } catch (_) { return { ok: false, status: 400, error: 'Origen no válido.' }; }
  if (page.protocol !== 'https:') return { ok: false, status: 400, error: 'El enlace tiene que ser https.' };
  const id = b64url(crypto.getRandomValues(new Uint8Array(16)));
  const iat = now;
  const exp = iat + dias * 86400;
  const token = await firmarToken(env.VISOR_LINK_KEY, { id, iat, exp });
  try {
    await guardarFila(env.VISOR_LINKS, { id, iat, exp, device: null });
  } catch (_) {
    return { ok: false, status: 503, error: 'No he podido guardar el enlace.' };
  }
  const url = `${page.origin}/pruebas/visor/?t=${token}`;
  const link = deepLink(url);
  return { ok: true, id, iat, exp, url, deepLink: link, qrSvg: qrSvg(link) };
}

export async function borrarEnlace(env, id) {
  if (!env || !env.VISOR_LINKS) return { ok: false, status: 503, error: 'Falta la clave del visor.' };
  if (!idValido(id)) return { ok: false, status: 400, error: 'Enlace no válido.' };
  await env.VISOR_LINKS.delete(`visor:${id}`);
  return { ok: true };
}

export async function accesoVisor(request, env, now) {
  now = ahoraSeg(now);
  const url = new URL(request.url);
  const tokens = url.searchParams.getAll('t').map((s) => String(s || '')).filter(Boolean);
  const cookiesVisor = cookiesNombradas(request, COOKIE_VISOR);
  const ua = uaDe(request);
  if (tokens.length > 1 || cookiesVisor.length > 1) {
    await registrarUso(env, { id: null, ua, ok: false, via: 'duplicado', now });
    return { ok: false, cerrar: true };
  }
  const token = tokens[0] || '';
  const cookie = cookiesVisor[0] || '';
  if (!token && !cookie) return { ok: false, cerrar: false };

  const key = env && env.VISOR_LINK_KEY;
  const kv = env && env.VISOR_LINKS;
  if (!key || !kv) {
    await registrarUso(env, { id: null, ua, ok: false, via: 'sin-clave', now });
    return { ok: false, cerrar: Boolean(token) };
  }

  let data = null;
  if (token) {
    data = await leerToken(key, token, now);
    if (!data) {
      await registrarUso(env, { id: null, ua, ok: false, via: 'token', now });
      return { ok: false, cerrar: true };
    }
  }
  let cookieData = null;
  if (cookie) {
    cookieData = await leerCookie(key, cookie, now);
    if (!cookieData) {
      if (token) {
        await registrarUso(env, { id: data.id, ua, ok: false, via: 'cookie', now });
        return { ok: false, cerrar: true };
      }
      return { ok: false, cerrar: false };
    }
  }
  if (data && cookieData && (cookieData.id !== data.id || cookieData.exp !== data.exp)) {
    await registrarUso(env, { id: data.id, ua, ok: false, via: 'cruce', now });
    return { ok: false, cerrar: true };
  }

  const id = (data && data.id) || cookieData.id;
  const exp = (data && data.exp) || cookieData.exp;
  let row;
  try { row = await leerFila(kv, id); } catch (_) { row = null; }
  if (!row || row.exp !== exp || row.exp <= now || (data && row.iat !== data.iat)) {
    await registrarUso(env, { id, ua, ok: false, via: 'revocado', now });
    return { ok: false, cerrar: true };
  }

  if (row.device) {
    if (!cookieData || cookieData.random !== row.device) {
      await registrarUso(env, { id, ua, ok: false, via: 'otro', now });
      return { ok: false, cerrar: true };
    }
    await registrarUso(env, { id, ua, ok: true, via: 'cookie', now });
    return { ok: true, id };
  }

  if (cookieData) {
    row.device = cookieData.random;
    row.boundAt = now;
    try { await guardarFila(kv, row); } catch (_) {
      await registrarUso(env, { id, ua, ok: false, via: 'alta', now });
      return { ok: false, cerrar: true };
    }
    let again = null;
    try { again = await leerFila(kv, id); } catch (_) {}
    if (!again || again.device !== cookieData.random) {
      await registrarUso(env, { id, ua, ok: false, via: 'otro', now });
      return { ok: false, cerrar: true };
    }
    await registrarUso(env, { id, ua, ok: true, via: 'alta', now });
    return { ok: true, id };
  }

  const random = b64url(crypto.getRandomValues(new Uint8Array(16)));
  const setCookie = await emitirCookie(key, { id, exp, random, now });
  await registrarUso(env, { id, ua, ok: true, via: 'token', now });
  return { ok: true, id, cookie: setCookie };
}
