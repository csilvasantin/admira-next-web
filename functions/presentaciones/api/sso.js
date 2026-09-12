/*
 * SSO admira.tv → Generador de Presentaciones (Yokup #3165 · 12-sep-2026).
 *
 * Carlos llegaba a /tiktok/?producto=… desde admira.tv ya logado, y ad-idea /
 * grok-video le contestaban 401 porque el Generador sólo conocía SU cookie
 * (pres_owner, la que emite el login Google o Cloudflare Access en _middleware.js).
 * admira.tv emite ahora un PASE FIRMADO con un secreto compartido y esta puerta lo
 * canjea por la MISMA sesión que hoy crea el login del Generador (makeSessionToken
 * de _directory.js + identidad de _access.js). El resto de endpoints no cambian:
 * siguen exigiendo sesión, sólo que ya la tienen.
 *
 * Contrato del pase (fijo, compartido con quien lo emite):
 *   pase    = payload + "." + firma
 *   payload = base64url(JSON{v:1, email, iat, exp (≤ iat+120), nonce, iss:"admira.tv",
 *             aud:"admiranext.com", origen})
 *   firma   = base64url(HMAC-SHA256(ADMIRA_SSO_SECRET, payload))
 * Un pase se acepta UNA vez: el nonce usado se guarda en KV (PRESENTATION_IDEAS)
 * 180 s. Sin KV se acepta sin memoria de nonce y la respuesta lo dice.
 *
 * Doble cerrojo: el correo tiene que estar en ADMIRA_SSO_EMAILS Y dado de alta en el
 * directorio (/usuarios · AUTH_DB) con el proyecto del generador; si no, la sesión
 * que emitiéramos moriría en la primera petición (readSession vuelve a cruzar D1).
 *
 * Nunca se escribe el pase en logs ni en la respuesta.
 */

import {cleanIdentity, identityCookie, makeIdentityToken, readIdentity, writeAccessEvent} from '../_access.js';
import {generatorAccess, makeSessionToken} from '../_directory.js';

export const PASE_ISS = 'admira.tv';
export const PASE_AUD = 'admiranext.com';
export const PASE_VIGENCIA_MAX = 120;   // segundos entre iat y exp
export const NONCE_TTL = 180;           // segundos que recordamos un nonce
const MAXAGE = 60 * 60 * 24 * 30;       // la misma vida que la cookie del login
const MAX_BODY_BYTES = 8 * 1024;
const MAX_PASE_LENGTH = 4096;
const SKEW = 30;                        // tolerancia de reloj entre servidores
const enc = new TextEncoder();

function json(payload, status = 200, headers = {}){
  return Response.json(payload, {
    status,
    headers:{'cache-control':'no-store', 'content-type':'application/json; charset=utf-8', 'x-content-type-options':'nosniff', ...headers}
  });
}

function b64url(bytes){
  let value = btoa(String.fromCharCode(...new Uint8Array(bytes)));
  return value.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
function fromB64url(value){
  const normalized = String(value || '').replace(/-/g, '+').replace(/_/g, '/');
  return Uint8Array.from(atob(normalized + '='.repeat((4 - normalized.length % 4) % 4)), char => char.charCodeAt(0));
}
async function hmac(key, message){
  const cryptoKey = await crypto.subtle.importKey('raw', enc.encode(key), {name:'HMAC', hash:'SHA-256'}, false, ['sign']);
  return b64url(await crypto.subtle.sign('HMAC', cryptoKey, enc.encode(message)));
}
function ctEq(a, b){
  a = String(a || ''); b = String(b || '');
  if (a.length !== b.length) return false;
  let result = 0;
  for (let index = 0; index < a.length; index += 1) result |= a.charCodeAt(index) ^ b.charCodeAt(index);
  return result === 0;
}

function sameOrigin(request){
  const origin = request.headers.get('origin');
  if (!origin) return true;
  try { return new URL(origin).origin === new URL(request.url).origin; }
  catch (_) { return false; }
}

/** Lista blanca de correos con pase (ADMIRA_SSO_EMAILS, separados por coma). */
export function correosConPase(env){
  return new Set(String(env?.ADMIRA_SSO_EMAILS || '').split(/[,\s;]+/).map(v => v.trim().toLowerCase()).filter(Boolean));
}

/** cs…in@admira.com — lo justo para que Carlos reconozca su cuenta sin exponerla. */
export function enmascararCorreo(email){
  const value = String(email || '').toLowerCase();
  const at = value.indexOf('@');
  if (at < 1) return '';
  const local = value.slice(0, at);
  const domain = value.slice(at);
  const visible = local.length > 4 ? `${local.slice(0, 2)}…${local.slice(-2)}` : `${local.slice(0, 1)}…`;
  return `${visible}${domain}`;
}

/**
 * Verifica un pase. Devuelve {ok:true, email, nonce, origen} o
 * {ok:false, status, error, code}. `nonces` es opcional: {get(nonce), put(nonce)}.
 */
export async function verificarPase(pase, {secret, emails, now = Math.floor(Date.now() / 1000), nonces = null} = {}){
  const fail = (status, code, error) => ({ok:false, status, code, error});
  if (!secret) return fail(503, 'sin_secreto', 'El pase de admira.tv todavía no está configurado en este sitio.');
  if (typeof pase !== 'string' || !pase || pase.length > MAX_PASE_LENGTH) return fail(400, 'pase_malformado', 'Pase ausente o malformado.');
  const dot = pase.indexOf('.');
  if (dot < 1 || dot === pase.length - 1 || pase.indexOf('.', dot + 1) !== -1) return fail(400, 'pase_malformado', 'Pase ausente o malformado.');
  const payloadB64 = pase.slice(0, dot);
  const signature = pase.slice(dot + 1);
  if (!/^[A-Za-z0-9_-]+$/.test(payloadB64) || !/^[A-Za-z0-9_-]+$/.test(signature)) return fail(400, 'pase_malformado', 'Pase ausente o malformado.');

  let payload;
  try { payload = JSON.parse(new TextDecoder().decode(fromB64url(payloadB64))); }
  catch (_) { return fail(400, 'pase_malformado', 'Pase ausente o malformado.'); }
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return fail(400, 'pase_malformado', 'Pase ausente o malformado.');
  if (Number(payload.v) !== 1) return fail(400, 'version', 'Versión de pase no reconocida.');

  // La firma antes que cualquier otra decisión: un pase sin firma válida no
  // merece ni que le miremos las fechas.
  if (!ctEq(signature, await hmac(secret, payloadB64))) return fail(401, 'firma', 'La firma del pase no es válida.');
  if (payload.iss !== PASE_ISS) return fail(401, 'emisor', 'El pase no viene de admira.tv.');
  if (payload.aud !== PASE_AUD) return fail(401, 'destinatario', 'El pase no es para admiranext.com.');

  const iat = Number(payload.iat);
  const exp = Number(payload.exp);
  if (!Number.isFinite(iat) || !Number.isFinite(exp) || exp <= iat || exp - iat > PASE_VIGENCIA_MAX) return fail(401, 'vigencia', 'El pase tiene una vigencia no permitida.');
  if (iat > now + SKEW) return fail(401, 'futuro', 'El pase todavía no es válido.');
  if (exp < now) return fail(401, 'caducado', 'El pase ha caducado: vuelve a abrir el enlace desde admira.tv.');

  const nonce = String(payload.nonce || '');
  if (nonce.length < 8 || nonce.length > 128 || !/^[A-Za-z0-9_-]+$/.test(nonce)) return fail(400, 'nonce', 'El pase no lleva un nonce válido.');

  const email = String(payload.email || '').trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return fail(400, 'correo', 'El pase no lleva un correo válido.');
  if (!(emails instanceof Set) || !emails.has(email)) return fail(403, 'correo_fuera_de_lista', 'Ese correo no tiene pase para el Generador.');

  let nonceGuard = 'sin-kv';
  if (nonces) {
    if (await nonces.get(nonce)) return fail(401, 'nonce_repetido', 'Ese pase ya se usó. Vuelve a abrir el enlace desde admira.tv.');
    await nonces.put(nonce);
    nonceGuard = 'kv';
  }
  return {ok:true, email, nonce, nonceGuard, origen:String(payload.origen || '').slice(0, 300)};
}

function nonceStore(env){
  const kv = env?.PRESENTATION_IDEAS;
  if (!kv) return null;
  return {
    get:(nonce) => kv.get(`sso:nonce:${nonce}`),
    put:(nonce) => kv.put(`sso:nonce:${nonce}`, '1', {expirationTtl:NONCE_TTL})
  };
}

async function readJsonLimited(request){
  const declared = Number(request.headers.get('content-length') || 0);
  if (declared > MAX_BODY_BYTES) throw new Error('body_too_large');
  const text = await request.text();
  if (text.length > MAX_BODY_BYTES) throw new Error('body_too_large');
  return JSON.parse(text);
}

export async function onRequest(context){
  const {request, env} = context;
  if (request.method !== 'POST') return json({error:'Método no permitido.'}, 405, {allow:'POST'});
  if (!sameOrigin(request)) return json({error:'Origen no permitido.'}, 403);
  if (!(request.headers.get('content-type') || '').toLowerCase().startsWith('application/json')) return json({error:'Envía el pase como JSON {pase}.'}, 415);
  if (!env.PRES_SIGNING_KEY) return json({error:'La sesión del Generador no está disponible ahora mismo.'}, 503);

  let body;
  try { body = await readJsonLimited(request); }
  catch (error) { return json({error:error.message === 'body_too_large' ? 'Pase demasiado grande.' : 'JSON no válido.'}, error.message === 'body_too_large' ? 413 : 400); }

  const verdict = await verificarPase(body?.pase, {secret:env.ADMIRA_SSO_SECRET, emails:correosConPase(env), nonces:nonceStore(env)});
  if (!verdict.ok) {
    context.waitUntil?.(writeAccessEvent(env, request, {type:'sso_pase_rechazado', client:'generador', presentation:'Generador de presentaciones', access:'denied', path:new URL(request.url).pathname, target:verdict.code}));
    return json({error:verdict.error, code:verdict.code}, verdict.status);
  }

  const localPart = verdict.email.split('@')[0];
  const access = await generatorAccess(env, {email:verdict.email, name:localPart});
  if (!access) {
    context.waitUntil?.(writeAccessEvent(env, request, {type:'sso_pase_sin_alta', client:'generador', presentation:'Generador de presentaciones', identity:{email:verdict.email, name:localPart}, access:'denied', path:new URL(request.url).pathname}));
    return json({error:'El pase es válido pero ese correo no está dado de alta en el Generador. Pide el alta en /usuarios.', code:'sin_alta'}, 403);
  }

  const previous = await readIdentity(request, env.PRES_SIGNING_KEY);
  const identity = cleanIdentity({name:access.name || localPart, email:access.email, visitorId:previous?.visitorId});
  const [sessionToken, identityToken] = await Promise.all([
    makeSessionToken(env.PRES_SIGNING_KEY, access, MAXAGE),
    makeIdentityToken(env.PRES_SIGNING_KEY, identity, MAXAGE)
  ]);
  const headers = new Headers({'cache-control':'no-store', 'content-type':'application/json; charset=utf-8', 'x-content-type-options':'nosniff'});
  // La MISMA pareja de cookies que emite el login Google / Cloudflare Access en
  // _middleware.js: pres_owner (sesión del directorio) + pres_identity (registro).
  headers.append('Set-Cookie', `pres_owner=${sessionToken}; Path=/presentaciones; Max-Age=${MAXAGE}; HttpOnly; Secure; SameSite=Lax`);
  headers.append('Set-Cookie', identityCookie(identityToken, MAXAGE));
  context.waitUntil?.(writeAccessEvent(env, request, {type:'sso_pase_login', client:'generador', presentation:'Generador de presentaciones', identity, access:access.level, path:new URL(request.url).pathname, target:verdict.origen}));
  return new Response(JSON.stringify({ok:true, email_masked:enmascararCorreo(access.email), nivel:access.level, nonce_guard:verdict.nonceGuard, origen:verdict.origen}), {status:200, headers});
}
