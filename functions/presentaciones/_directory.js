/*
 * Perímetro ÚNICO del Generador de Presentaciones (FLT-1631 · 2026-09-04).
 *
 * Hasta hoy el generador decidía quién entra con una cuenta Google contra una lista
 * escrita en el código (TRUSTED_GENERATOR_EMAILS: dos correos), sin relación con el
 * panel /usuarios, donde AUTH_DB (D1) ya sabe quién existe, con qué rol y en qué
 * proyectos. Dar de alta a alguien en el generador exigía tocar el código y publicar.
 *
 * Ahora la cuenta Google se autoriza contra el directorio central:
 *   - existe en admiranext_users, status = active;
 *   - tiene el proyecto `generador-de-presentaciones` (o `*`) en admiranext_user_projects;
 *   - su rol decide el nivel: admin → owner (generador, galería y APIs del generador),
 *     editor → editor (edición, generación, versiones) + lo del owner,
 *     viewer → viewer (ver presentaciones y galería, nunca zonas internas).
 *
 * Y la sesión que se emite lleva email + session_version: en cada petición se vuelve
 * a cruzar con D1, así que una baja o «revocar sesión» desde /usuarios corta el acceso
 * al generador en la siguiente petición, sin esperar 30 días a que caduque la cookie.
 *
 * Red de seguridad: si AUTH_DB no está (preview local, binding roto) se cae al par de
 * correos de arranque, para no dejar nunca fuera al arquitecto por un despliegue a medias.
 */

import { buscarUsuario, buscarUsuarioIdentidad } from '../_webmaster-gate.js';

export const GENERATOR_PROJECT_KEYS = new Set(['generador-de-presentaciones', 'presentaciones', '*']);
export const BOOTSTRAP_OWNERS = new Set(['csilva@admira.com', 'csilvasantin@gmail.com']);
const LEVELS = { admin: 'owner', editor: 'editor', viewer: 'viewer' };
const enc = new TextEncoder();

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
function same(a, b){
  a = String(a || ''); b = String(b || '');
  if (a.length !== b.length) return false;
  let result = 0;
  for (let index = 0; index < a.length; index += 1) result |= a.charCodeAt(index) ^ b.charCodeAt(index);
  return result === 0;
}

export function levelForRole(role){ return LEVELS[String(role || '').toLowerCase()] || null; }

export function projectGrantsGenerator(keys){
  return (Array.isArray(keys) ? keys : []).some(key => GENERATOR_PROJECT_KEYS.has(String(key || '').trim().toLowerCase()));
}

async function projectKeysOf(env, email){
  const rows = await env.AUTH_DB.prepare('SELECT project_key FROM admiranext_user_projects WHERE user_email=?').bind(email).all();
  return (rows && rows.results || []).map(row => row.project_key);
}

/**
 * Resuelve el acceso al generador de una identidad ya verificada ({email, sub?, name?}).
 * Devuelve {level, email, name, sessionVersion, source} o null si no entra.
 */
export async function generatorAccess(env, identity){
  const email = String(identity && identity.email || '').trim().toLowerCase();
  if (!email) return null;
  if (!env || !env.AUTH_DB) {
    return BOOTSTRAP_OWNERS.has(email)
      ? { level:'owner', email, name:String(identity.name || email), sessionVersion:1, source:'bootstrap' }
      : null;
  }
  let user = null;
  try {
    user = identity.sub ? await buscarUsuarioIdentidad(env, {sub:identity.sub, email}) : await buscarUsuario(env, email);
  } catch (_) { user = null; }
  if (!user || String(user.status) !== 'active') return null;
  const level = levelForRole(user.role);
  if (!level) return null;
  if (!projectGrantsGenerator(await projectKeysOf(env, user.email))) return null;
  return { level, email:user.email, name:String(user.display_name || identity.name || user.email), sessionVersion:Number(user.session_version) || 1, source:'directory' };
}

/** Sesión del generador: exp.level.email.sv.firma — revocable desde /usuarios. */
export async function makeSessionToken(signKey, access, maxAge){
  const exp = Math.floor(Date.now() / 1000) + maxAge;
  const body = `${exp}.${access.level}.${b64url(enc.encode(access.email))}.${access.sessionVersion}`;
  return `${body}.${await hmac(signKey, `_directory:${body}`)}`;
}

/**
 * Valida la sesión: firma + caducidad + que la persona siga activa, con la misma
 * session_version y con el proyecto. Devuelve {level, email, name} o null.
 */
export async function readSession(env, signKey, token){
  if (!signKey || !token) return null;
  const parts = String(token).split('.');
  if (parts.length !== 5) return null;
  const [expRaw, level, emailRaw, svRaw, signature] = parts;
  const body = `${expRaw}.${level}.${emailRaw}.${svRaw}`;
  if (!same(signature, await hmac(signKey, `_directory:${body}`))) return null;
  const exp = parseInt(expRaw, 10);
  if (!exp || exp < Math.floor(Date.now() / 1000)) return null;
  if (!['owner', 'editor', 'viewer'].includes(level)) return null;
  let email = '';
  try { email = new TextDecoder().decode(fromB64url(emailRaw)); } catch (_) { return null; }
  const access = await generatorAccess(env, {email});
  if (!access) return null;
  if (access.source === 'directory' && String(access.sessionVersion) !== String(svRaw)) return null;
  // El nivel vigente es el del directorio HOY, no el que tenía la cookie al emitirse.
  return { level:access.level, email:access.email, name:access.name };
}

/** Qué puede hacer cada nivel, en los términos de zonas del middleware. */
export function allowedBy(level, zones){
  const { ownerAllowed = false, editorAllowed = false, internalArea = false } = zones || {};
  if (level === 'owner') return Boolean(ownerAllowed || editorAllowed || !internalArea);
  if (level === 'editor') return Boolean(editorAllowed || ownerAllowed || !internalArea);
  if (level === 'viewer') return !internalArea;
  return false;
}
