/*
 * CLAVE DE MÁQUINA DEL GENERADOR (Carlos, 01-10-2026: «Monta una clave de máquina para que
 * la flota entre sin Google»).
 *
 * Una sola clave aleatoria larga (`amk_…`), guardada como secreto de Cloudflare Pages
 * `PRES_MACHINE_KEY` —nunca en el repo—, deja entrar a la flota en /presentaciones/* (UI y
 * API) sin la cookie de Google de una persona:
 *   - por cabecera en cada petición: `X-Admira-Machine-Key: amk_…` o
 *     `Authorization: Bearer amk_…`;
 *   - o canjeándola en POST /presentaciones/auth/machine por una cookie corta
 *     `pres_machine` (Path=/presentaciones, 1 h, HttpOnly, Secure, SameSite=Strict) para
 *     navegar la UI con un navegador.
 * Alcance: SOLO lo lee este middleware de /presentaciones. Nivel `editor`: genera y edita
 * como un editor del directorio, pero /presentaciones/control/ (solo owner) sigue fuera.
 * Identidad: machine@admiranext.com, que queda en el registro de accesos y en
 * `createdBy` de lo que se genere.
 * Revocación: borrar o rotar el secreto. La cookie va atada a una huella de la clave, así
 * que al rotarla también caducan las sesiones ya emitidas.
 * La clave nunca se escribe en logs ni en respuestas; se compara por SHA-256 en tiempo
 * constante.
 */

export const MACHINE_KEY_PREFIX = 'amk_';
export const MACHINE_KEY_MIN_LENGTH = 40;
export const MACHINE_KEY_HEADER = 'X-Admira-Machine-Key';
export const MACHINE_COOKIE = 'pres_machine';
export const MACHINE_SESSION_MAXAGE = 60 * 60;
export const MACHINE_LEVEL = 'editor';
export const MACHINE_IDENTITY = Object.freeze({name:'Flota Admira (clave de máquina)', email:'machine@admiranext.com', visitorId:'machine-key'});

const enc = new TextEncoder();

function b64url(buf){
  return btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
async function sha256(value){ return b64url(await crypto.subtle.digest('SHA-256', enc.encode(String(value)))); }
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

/** La clave configurada, o '' si falta o es demasiado corta (entonces la vía está cerrada). */
export function configuredMachineKey(env){
  const key = String(env && env.PRES_MACHINE_KEY || '').trim();
  return key.length >= MACHINE_KEY_MIN_LENGTH ? key : '';
}

/** La clave que trae la petición (cabecera propia o Bearer amk_), sin validarla. */
export function suppliedMachineKey(request){
  const header = String(request.headers.get(MACHINE_KEY_HEADER) || '').trim();
  if (header) return header.slice(0, 512);
  const match = /^Bearer\s+(\S+)$/i.exec(String(request.headers.get('Authorization') || ''));
  return match && match[1].startsWith(MACHINE_KEY_PREFIX) ? match[1].slice(0, 512) : '';
}

/** Compara en tiempo constante (sobre los SHA-256, así la longitud tampoco se filtra). */
export async function machineKeyMatches(env, supplied){
  const expected = configuredMachineKey(env);
  if (!expected || !supplied) return false;
  const [a, b] = await Promise.all([sha256(supplied), sha256(expected)]);
  return same(a, b);
}

async function fingerprint(key){ return (await sha256(`machine-fp:${key}`)).slice(0, 22); }

export async function makeMachineSessionToken(env, signKey, maxAge = MACHINE_SESSION_MAXAGE){
  const key = configuredMachineKey(env);
  if (!key || !signKey) return '';
  const exp = Math.floor(Date.now() / 1000) + maxAge;
  return `${exp}.${await hmac(signKey, `_machine:${exp}:${await fingerprint(key)}`)}`;
}

export async function validMachineSessionToken(env, signKey, token){
  const key = configuredMachineKey(env);
  if (!key || !signKey || !token) return false;
  const dot = String(token).indexOf('.');
  if (dot < 1) return false;
  const exp = parseInt(String(token).slice(0, dot), 10);
  if (!exp || exp < Math.floor(Date.now() / 1000) || exp > Math.floor(Date.now() / 1000) + MACHINE_SESSION_MAXAGE + 60) return false;
  return same(String(token).slice(dot + 1), await hmac(signKey, `_machine:${exp}:${await fingerprint(key)}`));
}

export function machineSessionCookie(token, maxAge = MACHINE_SESSION_MAXAGE){
  return `${MACHINE_COOKIE}=${token}; Path=/presentaciones; Max-Age=${maxAge}; HttpOnly; Secure; SameSite=Strict`;
}

function session(via){
  return {level:MACHINE_LEVEL, email:MACHINE_IDENTITY.email, name:MACHINE_IDENTITY.name, source:'machine-key', via};
}

/**
 * Sesión de máquina para el middleware: {level, email, name, source, via} o null.
 * `attempted` dice si la petición traía una clave (buena o mala) para poder anotarlo.
 */
export async function machineSessionFromRequest(env, request, signKey, cookies = {}){
  const supplied = suppliedMachineKey(request);
  if (supplied) {
    const ok = await machineKeyMatches(env, supplied);
    return {session:ok ? session('machine-key') : null, attempted:true};
  }
  if (cookies[MACHINE_COOKIE] && await validMachineSessionToken(env, signKey, cookies[MACHINE_COOKIE])) {
    return {session:session('machine-session'), attempted:false};
  }
  return {session:null, attempted:false};
}

/** Destino seguro tras el canje: solo rutas de /presentaciones del mismo sitio. */
export function safeNext(value){
  const next = String(value || '/presentaciones/');
  if (!/^\/presentaciones(?:\/|$|\?)/.test(next) || next.startsWith('//') || /[\r\n\\]/.test(next)) return '/presentaciones/';
  return next.slice(0, 500);
}
