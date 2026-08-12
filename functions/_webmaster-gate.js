/*
 * Identidad y autorización de AdmiraNeXT.
 *
 * Google demuestra quién es la persona. AUTH_DB decide si entra, con qué rol y
 * si sus sesiones siguen vigentes. La cookie no contiene privilegios que puedan
 * sobrevivir a un cambio: cada petición vuelve a cruzar email + session_version
 * con D1. admira.live usa otro emisor, otra cookie y otra audiencia.
 */

const CLIENT_ID = '861856772040-e1ri6kpu6maagtb6crdfbb923hsaalgb.apps.googleusercontent.com';
const COOKIE = '__Host-an_session';
const LEGACY_COOKIE = 'wm_session';
const LOGIN_COOKIE = '__Host-an_login_csrf';
const MAXAGE = 60 * 60 * 24 * 7;
const ROLES = new Set(['admin', 'editor', 'viewer']);
const BOOTSTRAP = ['csilva@admira.com', 'csilvasantin@gmail.com'];
const READY = new WeakSet();
const enc = new TextEncoder();

const SCHEMA = `
CREATE TABLE IF NOT EXISTS admiranext_users (
  email TEXT PRIMARY KEY,
  display_name TEXT NOT NULL DEFAULT '',
  role TEXT NOT NULL CHECK(role IN ('admin','editor','viewer')),
  status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active','suspended')),
  session_version INTEGER NOT NULL DEFAULT 1,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  last_login_at INTEGER,
  last_login_ip TEXT,
  last_login_ua TEXT
);
CREATE TABLE IF NOT EXISTS admiranext_user_audit (
  id TEXT PRIMARY KEY,
  actor_email TEXT NOT NULL,
  target_email TEXT NOT NULL,
  action TEXT NOT NULL,
  detail TEXT NOT NULL DEFAULT '',
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_admiranext_user_audit_created
  ON admiranext_user_audit(created_at DESC);`;

function b64url(buf) {
  return btoa(String.fromCharCode(...new Uint8Array(buf)))
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
function unb64url(value) {
  const raw = String(value).replace(/-/g, '+').replace(/_/g, '/');
  const padded = raw + '='.repeat((4 - raw.length % 4) % 4);
  return Uint8Array.from(atob(padded), (c) => c.charCodeAt(0));
}
async function hmac(key, msg) {
  const k = await crypto.subtle.importKey('raw', enc.encode(key), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return b64url(await crypto.subtle.sign('HMAC', k, enc.encode(msg)));
}
function iguales(a, b) {
  a = String(a); b = String(b);
  if (a.length !== b.length) return false;
  let r = 0;
  for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return r === 0;
}
function cookies(request) {
  const out = {};
  (request.headers.get('Cookie') || '').split(/;\s*/).forEach((p) => {
    const i = p.indexOf('=');
    if (i > 0) out[p.slice(0, i)] = p.slice(i + 1);
  });
  return out;
}
function emailValido(value) {
  const email = String(value || '').trim().toLowerCase();
  return email.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email : '';
}
function id() {
  return crypto.randomUUID ? crypto.randomUUID() : b64url(crypto.getRandomValues(new Uint8Array(24)));
}

export function loginCsrfValido(request, value) {
  const origin = request.headers.get('Origin');
  if (origin !== new URL(request.url).origin) return false;
  const cookie = cookies(request)[LOGIN_COOKIE] || '';
  return cookie.length >= 32 && iguales(cookie, String(value || ''));
}

export async function asegurarDirectorio(env) {
  if (!env.AUTH_DB) throw new Error('AUTH_DB no configurado');
  if (READY.has(env.AUTH_DB)) return;
  await env.AUTH_DB.exec(SCHEMA);
  const now = Date.now();
  await Promise.all(BOOTSTRAP.map((email) => env.AUTH_DB.prepare(
    `INSERT INTO admiranext_users(email,display_name,role,status,session_version,created_at,updated_at)
     VALUES(?,?,'admin','active',1,?,?) ON CONFLICT(email) DO NOTHING`
  ).bind(email, email.split('@')[0], now, now).run()));
  READY.add(env.AUTH_DB);
}

export async function buscarUsuario(env, email) {
  await asegurarDirectorio(env);
  return env.AUTH_DB.prepare('SELECT * FROM admiranext_users WHERE email=?').bind(emailValido(email)).first();
}

export async function auditar(env, actor, target, action, detail = '') {
  await asegurarDirectorio(env);
  await env.AUTH_DB.prepare(
    'INSERT INTO admiranext_user_audit(id,actor_email,target_email,action,detail,created_at) VALUES(?,?,?,?,?,?)'
  ).bind(id(), emailValido(actor) || 'system', emailValido(target) || '-', String(action).slice(0,80), String(detail).slice(0,500), Date.now()).run();
}

async function crearToken(clave, user, exp) {
  const payload = {
    v: 2, email: user.email, role: user.role, sv: Number(user.session_version),
    iat: Math.floor(Date.now() / 1000), exp, sid: id(), csrf: id(), aud: 'admiranext.com'
  };
  const cuerpo = b64url(enc.encode(JSON.stringify(payload)));
  return `${cuerpo}.${await hmac(clave, `an:${cuerpo}`)}`;
}

async function leerToken(request, env) {
  const clave = env.WEBMASTER_SIGNING_KEY;
  if (!clave) return null;
  const jar = cookies(request);
  const current = jar[COOKIE];
  const legacy = !current && jar[LEGACY_COOKIE];
  const token = current || legacy;
  if (!token || token.length > 4096) return null;
  const punto = token.lastIndexOf('.');
  if (punto < 0) return null;
  const cuerpo = token.slice(0, punto);
  const firma = token.slice(punto + 1);
  const prefijo = legacy ? 'wm:' : 'an:';
  if (!iguales(firma, await hmac(clave, prefijo + cuerpo))) return null;
  let data;
  try { data = JSON.parse(new TextDecoder().decode(unb64url(cuerpo))); } catch (_) { return null; }
  const now = Math.floor(Date.now() / 1000);
  if (!data || Number(data.exp) <= now || Number(data.iat || now) > now + 60) return null;
  if (!legacy && data.aud !== 'admiranext.com') return null;
  const email = emailValido(data.email);
  if (!email) return null;
  const user = await buscarUsuario(env, email);
  if (!user || user.status !== 'active' || !ROLES.has(user.role)) return null;
  // Las cookies antiguas sólo migran mientras el usuario siga en la versión 1.
  if (legacy ? Number(user.session_version) !== 1 : Number(data.sv) !== Number(user.session_version)) return null;
  const csrf = legacy ? await hmac(clave, `csrf:${token}`) : String(data.csrf || '');
  if (!csrf) return null;
  return { email, role:user.role, display_name:user.display_name || '', session_version:Number(user.session_version), csrf, sid:String(data.sid || ''), legacy:!!legacy };
}

export async function sesionCompleta(request, env) {
  try { return await leerToken(request, env); } catch (_) { return null; }
}

/** Compatibilidad: las rutas existentes sólo necesitan el email. */
export async function sesion(request, env) {
  const current = await sesionCompleta(request, env);
  return current && current.email;
}

export async function exigirRol(request, env, roles) {
  const current = await sesionCompleta(request, env);
  return current && new Set(roles).has(current.role) ? current : null;
}

export function csrfValido(request, current) {
  if (!current) return false;
  const origin = request.headers.get('Origin');
  if (origin !== new URL(request.url).origin) return false;
  return iguales(request.headers.get('X-Admira-CSRF') || '', current.csrf || '');
}

/** Verifica el credential contra Google; el directorio autoriza después. */
export async function verificarGoogle(credential) {
  if (!credential || credential.length > 6000) return null;
  try {
    const r = await fetch(`https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(credential)}`);
    if (!r.ok) return null;
    const p = await r.json();
    const email = emailValido(p.email);
    const verified = p.email_verified === true || p.email_verified === 'true';
    const current = Number(p.exp) > Math.floor(Date.now() / 1000);
    return p.aud === CLIENT_ID && verified && current ? email : null;
  } catch (_) { return null; }
}

export async function cookieDeSesion(env, user) {
  const exp = Math.floor(Date.now() / 1000) + MAXAGE;
  const token = await crearToken(env.WEBMASTER_SIGNING_KEY, user, exp);
  return `${COOKIE}=${token}; Path=/; Max-Age=${MAXAGE}; HttpOnly; Secure; SameSite=Strict`;
}

export function cookiesBorradas() {
  return [
    `${COOKIE}=; Path=/; Max-Age=0; HttpOnly; Secure; SameSite=Strict`,
    `${LEGACY_COOKIE}=; Path=/; Max-Age=0; HttpOnly; Secure; SameSite=Lax`,
    `${LOGIN_COOKIE}=; Path=/webmaster; Max-Age=0; HttpOnly; Secure; SameSite=Strict`,
  ];
}

function esc(value) {
  return String(value || '').replace(/[&<>"']/g, (c) => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}
export function returnToSeguro(value) {
  const path = String(value || '');
  return path === '/usuarios' || path === '/webmaster' ? path : '/webmaster';
}

export function paginaLogin(error = '', returnTo = '/webmaster', loginCsrf = '') {
  return `<!doctype html><html lang="es"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex,nofollow"><title>AdmiraNeXT · Acceso</title>
<style>:root{--bg:#080b14;--panel:rgba(18,24,40,.9);--ink:#e8ecf6;--dim:#8792ab;--line:rgba(124,232,216,.18);--neon:#7ce8d8;--warn:#ff8f7a;--mono:ui-monospace,SFMono-Regular,Menlo,monospace}*{box-sizing:border-box}body{margin:0;min-height:100vh;display:grid;place-items:center;padding:24px;background:var(--bg);color:var(--ink);font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,system-ui,sans-serif}.box{width:100%;max-width:420px;background:var(--panel);border:1px solid var(--line);border-radius:18px;padding:34px 30px;box-shadow:0 24px 60px #0008}.eyebrow{font:700 11px/1 var(--mono);letter-spacing:.22em;text-transform:uppercase;color:var(--neon);margin-bottom:18px}h1{font-size:26px;margin:0 0 8px}p{color:var(--dim);font-size:14px;line-height:1.55;margin:0 0 22px}.picker{display:flex;justify-content:center;min-height:44px}.err{margin-top:16px;color:var(--warn);font:600 13px/1.45 var(--mono);text-align:center}.foot{margin-top:22px;text-align:center;font:600 11px/1 var(--mono);color:var(--dim)}</style></head><body>
<div class="box"><div class="eyebrow">AdmiraNeXT · Identidad</div><h1>Acceso interno</h1><p>Google verifica tu identidad. El directorio de AdmiraNeXT decide tu rol y mantiene la revocación inmediata.</p>
<form id="f" method="POST" action="/webmaster"><input id="cred" type="hidden" name="credential"><input type="hidden" name="login_csrf" value="${esc(loginCsrf)}"><input type="hidden" name="return_to" value="${esc(returnToSeguro(returnTo))}"><div id="g_id_onload" data-client_id="${CLIENT_ID}" data-callback="entrar" data-auto_prompt="false"></div><div class="picker"><div class="g_id_signin" data-type="standard" data-shape="rectangular" data-theme="outline" data-text="continue_with" data-size="large" data-width="320"></div></div></form>${error ? `<div class="err">${esc(error)}</div>` : ''}<div class="foot">admiranext.com · sesión independiente de admira.live</div></div>
<script>function entrar(r){var i=document.getElementById('cred');if(!i||!r||!r.credential)return;i.value=r.credential;document.getElementById('f').submit()}</script><script src="https://accounts.google.com/gsi/client" async defer></script></body></html>`;
}

export function respuestaLogin(error = '', returnTo = '/webmaster', status = 401) {
  const challenge = id();
  const response = respuestaHtml(paginaLogin(error, returnTo, challenge), status);
  response.headers.append('Set-Cookie', `${LOGIN_COOKIE}=${challenge}; Path=/webmaster; Max-Age=600; HttpOnly; Secure; SameSite=Strict`);
  return response;
}

export function respuestaHtml(cuerpo, status = 401) {
  return new Response(cuerpo, { status, headers: {
    'content-type':'text/html; charset=utf-8', 'cache-control':'no-store',
    'x-robots-tag':'noindex, nofollow', 'referrer-policy':'no-referrer',
    'content-security-policy':"default-src 'none'; script-src 'unsafe-inline' https://accounts.google.com/gsi/client; frame-src https://accounts.google.com/gsi/; style-src 'unsafe-inline'; img-src data: https://*.googleusercontent.com; connect-src https://accounts.google.com/gsi/; form-action 'self'; frame-ancestors 'none'; base-uri 'none'"
  }});
}
