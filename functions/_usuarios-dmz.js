/*
 * ZONA DMZ DE /usuarios (Woz · CTO, 19-10-2026 · petición de Carlos: «protegidísima,
 * militarizada, porque desde allí se puede hacer de todo»).
 *
 * /usuarios y su API dan de alta y baja personas, cambian roles, emiten y revocan tokens
 * MCP y tocan la lista blanca de admira.live. Por eso aquí no basta «rol admin en D1»:
 *
 *   1. Lista blanca EXPLÍCITA de administradores de la DMZ. Por defecto solo los dos
 *      correos de Carlos; se puede cambiar con la variable de entorno USUARIOS_ADMIN_EMAILS
 *      (lista separada por comas, NO es un secreto). Además el usuario tiene que seguir
 *      activo y con rol admin en AUTH_DB: hacen falta las dos cosas.
 *   2. Solo sesiones abiertas con Google en /webmaster (amr=google, con desafío de login
 *      de un solo uso). Una cookie abierta con un token anmcp_ de agente, una heredada de
 *      /presentaciones o una cookie antigua sin amr NO entran: hay que volver a Google.
 *   3. Sesión reciente: lectura con login de menos de USUARIOS_LECTURA_MAX_MIN (480 min por
 *      defecto) y CUALQUIER cambio con login de menos de USUARIOS_REAUTH_MIN (15 min por
 *      defecto, máximo 30). Si no, 401 {reauth:true} y la página manda a Google otra vez.
 *   4. CSRF en mutaciones: Origin exacto + Sec-Fetch-Site same-origin (si el navegador lo
 *      manda) + cabecera X-Admira-CSRF ligada a la sesión + Content-Type JSON + cookie
 *      SameSite=Strict.
 *   5. Límite de frecuencia por IP (KV, es un freno, no una garantía).
 *   6. Auditoría con IP y navegador de cada cambio y de cada intento denegado con sesión.
 *   7. Cabeceras duras: CSP con hashes, frame-ancestors 'none', no-store, noindex.
 */
import { sesionCompleta, csrfValido, auditar } from './_webmaster-gate.js';
import { limitarFrecuencia } from './_limite-frecuencia.js';

export const ADMINS_DMZ_POR_DEFECTO = Object.freeze(['csilvasantin@gmail.com', 'csilva@admira.com']);
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Lista blanca efectiva de administradores de la DMZ. Vacía o mal escrita → la de por defecto. */
export function adminsDmz(env = {}) {
  const lista = String(env.USUARIOS_ADMIN_EMAILS || '').split(/[\s,;]+/)
    .map((v) => v.trim().toLowerCase()).filter((v) => v.length <= 254 && EMAIL.test(v));
  return new Set(lista.length ? lista : ADMINS_DMZ_POR_DEFECTO);
}

function minutos(valor, porDefecto, min, max) {
  const n = Number(valor);
  if (!Number.isFinite(n) || n <= 0) return porDefecto;
  return Math.min(max, Math.max(min, Math.round(n)));
}

export function ventanasDmz(env = {}) {
  return {
    escrituraMin: minutos(env.USUARIOS_REAUTH_MIN, 15, 5, 30),
    lecturaMin: minutos(env.USUARIOS_LECTURA_MAX_MIN, 480, 15, 1440),
  };
}

const ipDe = (request) => String(request.headers.get('CF-Connecting-IP') || '').slice(0, 64);
const uaDe = (request) => String(request.headers.get('User-Agent') || '').slice(0, 300);

export const CABECERAS_DMZ = Object.freeze({
  'cache-control': 'no-store, private, max-age=0',
  'pragma': 'no-cache',
  'x-robots-tag': 'noindex, nofollow, noarchive, nosnippet',
  'x-frame-options': 'DENY',
  'x-content-type-options': 'nosniff',
  'referrer-policy': 'no-referrer',
  'cross-origin-opener-policy': 'same-origin',
  'cross-origin-resource-policy': 'same-origin',
  'permissions-policy': 'camera=(), microphone=(), geolocation=(), payment=(), usb=(), clipboard-read=()',
  'strict-transport-security': 'max-age=31536000',
});

const CSP_API = "default-src 'none'; frame-ancestors 'none'; base-uri 'none'; form-action 'none'";

/** Respuesta JSON de la DMZ con todas las cabeceras duras. */
export function jsonDmz(body, status = 200, extra = {}) {
  const headers = new Headers({ 'content-type': 'application/json; charset=utf-8', ...CABECERAS_DMZ, 'content-security-policy': CSP_API, ...extra });
  return new Response(JSON.stringify(body), { status, headers });
}

/** Aplica las cabeceras duras a cualquier respuesta (y quita CORS abierto si lo hubiera). */
export function endurecer(response, csp = CSP_API) {
  const headers = new Headers(response.headers);
  for (const [k, v] of Object.entries(CABECERAS_DMZ)) headers.set(k, v);
  headers.set('content-security-policy', csp);
  headers.delete('access-control-allow-origin');
  headers.delete('access-control-allow-credentials');
  return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
}

async function sha256b64(texto) {
  const d = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(texto));
  return btoa(String.fromCharCode(...new Uint8Array(d)));
}

/** CSP estricta para el HTML de /usuarios: solo scripts propios y los inline exactos (por hash). */
export async function cspPagina(html) {
  const hashes = [];
  const re = /<script(?![^>]*\bsrc\s*=)[^>]*>([\s\S]*?)<\/script>/gi;
  let m;
  while ((m = re.exec(String(html || '')))) if (m[1].trim()) hashes.push(`'sha256-${await sha256b64(m[1])}'`);
  const propio = "'self' https://www.admiranext.com";
  return [
    "default-src 'none'",
    `script-src ${propio}${hashes.length ? ' ' + hashes.join(' ') : ''}`,
    `style-src ${propio} 'unsafe-inline'`,
    `img-src ${propio} data:`,
    `font-src ${propio} data:`,
    `connect-src ${propio}`,
    "manifest-src 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    "frame-src 'none'",
    "object-src 'none'",
    "base-uri 'none'",
  ].join('; ');
}

/**
 * Evalúa la sesión contra la DMZ sin efectos (útil para la página y para los tests).
 * @returns {{ok:true,current:object}|{ok:false,status:number,motivo:string,reauth?:boolean,current?:object}}
 */
export async function evaluarDmz(request, env, { escritura = false, ahora = Date.now() } = {}) {
  const current = await sesionCompleta(request, env);
  if (!current) return { ok: false, status: 403, motivo: 'sin_sesion' };
  if (current.role !== 'admin') return { ok: false, status: 403, motivo: 'rol', current };
  if (!adminsDmz(env).has(current.email)) return { ok: false, status: 403, motivo: 'fuera_de_lista_dmz', current };
  if (current.amr !== 'google') return { ok: false, status: 401, motivo: 'login_no_google', reauth: true, current };
  const { escrituraMin, lecturaMin } = ventanasDmz(env);
  const edadMin = (ahora - Number(current.auth_time || 0) * 1000) / 60000;
  if (!(edadMin >= -1) || edadMin > lecturaMin) return { ok: false, status: 401, motivo: 'sesion_caducada_dmz', reauth: true, current };
  if (escritura) {
    const tipo = String(request.headers.get('content-type') || '').toLowerCase();
    if (!tipo.startsWith('application/json')) return { ok: false, status: 415, motivo: 'content_type', current };
    const sitio = request.headers.get('Sec-Fetch-Site');
    if (sitio && sitio !== 'same-origin') return { ok: false, status: 403, motivo: 'csrf_sec_fetch_site', current };
    if (!csrfValido(request, current)) return { ok: false, status: 403, motivo: 'csrf', current };
    if (edadMin > escrituraMin) return { ok: false, status: 401, motivo: 'reauth_requerida', reauth: true, current };
  }
  return { ok: true, current };
}

const MENSAJES = {
  sin_sesion: 'administrador requerido',
  rol: 'administrador requerido',
  fuera_de_lista_dmz: 'zona DMZ: tu cuenta no está en la lista de administradores de /usuarios',
  login_no_google: 'zona DMZ: entra con Google en /webmaster (no vale una sesión abierta con token ni heredada)',
  sesion_caducada_dmz: 'zona DMZ: tu login es antiguo; vuelve a verificar con Google',
  reauth_requerida: 'zona DMZ: los cambios exigen un login con Google de hace pocos minutos; vuelve a verificar',
  content_type: 'Content-Type application/json requerido',
  csrf_sec_fetch_site: 'CSRF inválido',
  csrf: 'CSRF inválido',
  frecuencia: 'demasiadas peticiones; espera un poco',
};

/**
 * Puerta de la API de usuarios / tokens. Devuelve {error:Response} o
 * {current, auditar(target, action, detail)} que anota quién, qué, cuándo, IP y navegador.
 */
export async function exigirDmz(request, env, { escritura = false, ambito = 'usuarios' } = {}) {
  const meta = { ip: ipDe(request), ua: uaDe(request) };
  const freno = await limitarFrecuencia(env, request, escritura
    ? { ambito: `dmz-w-${ambito}`, maximo: 30, ventanaSeg: 600 }
    : { ambito: `dmz-r-${ambito}`, maximo: 120, ventanaSeg: 600 });
  if (!freno.permitido) return { error: jsonDmz({ ok: false, error: MENSAJES.frecuencia }, 429, { 'retry-after': String(freno.reintentarEn) }) };
  const r = await evaluarDmz(request, env, { escritura });
  if (!r.ok) {
    // Solo se audita el intento con sesión válida: los anónimos no llenan la tabla.
    if (r.current) await auditar(env, r.current.email, r.current.email, 'dmz_denied',
      `${request.method} ${new URL(request.url).pathname} · ${r.motivo}`, meta).catch(() => {});
    return { error: jsonDmz({ ok: false, error: MENSAJES[r.motivo] || 'acceso restringido', ...(r.reauth ? { reauth: true, reauth_url: '/usuarios?reauth=1' } : {}) }, r.status) };
  }
  const current = r.current;
  return { current, meta, auditar: (target, action, detail = '') => auditar(env, current.email, target, action, detail, meta) };
}
