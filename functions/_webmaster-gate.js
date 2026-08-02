/*
 * Verja de /webmaster — igual criterio que la de Yokup: solo entra quien se
 * identifica con Google y está en la lista.
 *
 * A diferencia del auth-gate.js del front (que es un bloqueo BLANDO: oculta la
 * interfaz pero el contenido sigue en el código fuente), esta se aplica en el
 * EDGE: sin cookie válida el HTML no se llega a servir. Tiene que ser así porque
 * /webmaster enseña la topografía de despliegue de todo el ecosistema.
 *
 * El credential de Google se verifica contra Google en el servidor —no basta con
 * decodificar el JWT en el navegador— y solo entonces se emite una cookie propia
 * firmada con HMAC.
 */

const CLIENT_ID = '861856772040-e1ri6kpu6maagtb6crdfbb923hsaalgb.apps.googleusercontent.com';

// Lista inicial (Carlos, 2-ago-2026). Para añadir a alguien, se toca aquí.
export const PERMITIDOS = new Set(['csilva@admira.com', 'csilvasantin@gmail.com']);

const COOKIE = 'wm_session';
const MAXAGE = 60 * 60 * 24 * 30;   // 30 días
const enc = new TextEncoder();

function b64url(buf) {
  return btoa(String.fromCharCode(...new Uint8Array(buf)))
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
async function hmac(key, msg) {
  const k = await crypto.subtle.importKey('raw', enc.encode(key), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return b64url(await crypto.subtle.sign('HMAC', k, enc.encode(msg)));
}
// Comparación en tiempo constante: comparar con === filtra por tiempo.
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

async function crearToken(clave, email, exp) {
  const cuerpo = b64url(enc.encode(JSON.stringify({ email, exp })));
  return `${cuerpo}.${await hmac(clave, `wm:${cuerpo}`)}`;
}

/** Devuelve el email de la sesión válida, o null. */
export async function sesion(request, env) {
  const clave = env.WEBMASTER_SIGNING_KEY;
  if (!clave) return null;
  const token = cookies(request)[COOKIE];
  if (!token) return null;
  const punto = token.lastIndexOf('.');
  if (punto < 0) return null;
  const cuerpo = token.slice(0, punto);
  if (!iguales(token.slice(punto + 1), await hmac(clave, `wm:${cuerpo}`))) return null;
  let datos;
  try {
    datos = JSON.parse(new TextDecoder().decode(
      Uint8Array.from(atob(cuerpo.replace(/-/g, '+').replace(/_/g, '/')), (c) => c.charCodeAt(0))
    ));
  } catch (_) { return null; }
  if (!datos || !datos.exp || datos.exp < Math.floor(Date.now() / 1000)) return null;
  // La lista manda SIEMPRE: si a alguien se le retira el acceso, su cookie deja
  // de valer en la siguiente petición sin esperar a que caduque.
  if (!PERMITIDOS.has(String(datos.email || '').toLowerCase())) return null;
  return datos.email;
}

/** Verifica el credential contra Google. Devuelve el email permitido, o null. */
export async function verificarGoogle(credential) {
  if (!credential || credential.length > 6000) return null;
  try {
    const r = await fetch(`https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(credential)}`);
    if (!r.ok) return null;
    const p = await r.json();
    const email = String(p.email || '').trim().toLowerCase();
    const verificado = p.email_verified === true || p.email_verified === 'true';
    const vigente = Number(p.exp) > Math.floor(Date.now() / 1000);
    if (p.aud !== CLIENT_ID || !verificado || !vigente || !PERMITIDOS.has(email)) return null;
    return email;
  } catch (_) { return null; }
}

export async function cookieDeSesion(env, email) {
  const exp = Math.floor(Date.now() / 1000) + MAXAGE;
  const token = await crearToken(env.WEBMASTER_SIGNING_KEY, email, exp);
  return `${COOKIE}=${token}; Path=/; Max-Age=${MAXAGE}; HttpOnly; Secure; SameSite=Lax`;
}

export function paginaLogin(error = '') {
  return `<!doctype html><html lang="es"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex,nofollow"><title>Webmaster · Acceso</title>
<style>
 :root{--bg:#080b14;--panel:rgba(18,24,40,.85);--ink:#e8ecf6;--dim:#8792ab;
   --line:rgba(124,232,216,.18);--neon:#7ce8d8;--warn:#ff8f7a;
   --mono:ui-monospace,SFMono-Regular,Menlo,monospace}
 *{box-sizing:border-box}
 body{margin:0;min-height:100vh;display:grid;place-items:center;padding:24px;
   background:var(--bg);color:var(--ink);
   font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,system-ui,sans-serif}
 body::before{content:"";position:fixed;inset:0;pointer-events:none;
   background:radial-gradient(90% 60% at 80% -10%,rgba(124,232,216,.10),transparent 60%)}
 .box{position:relative;width:100%;max-width:420px;background:var(--panel);
   border:1px solid var(--line);border-radius:18px;padding:34px 30px;
   box-shadow:0 24px 60px rgba(0,0,0,.5)}
 .eyebrow{font:700 11px/1 var(--mono);letter-spacing:.22em;text-transform:uppercase;
   color:var(--neon);margin-bottom:18px}
 h1{font-size:26px;font-weight:800;margin:0 0 8px;letter-spacing:-.01em}
 p{color:var(--dim);font-size:14px;line-height:1.55;margin:0 0 22px}
 .picker{display:flex;justify-content:center;min-height:44px}
 .err{margin-top:16px;color:var(--warn);font:600 13px/1.45 var(--mono);text-align:center}
 .foot{margin-top:22px;text-align:center;font:600 11px/1 var(--mono);
   letter-spacing:.05em;color:var(--dim)}
</style></head><body>
<div class="box">
  <div class="eyebrow">ADmiraNeXT · Intranet</div>
  <h1>Webmaster</h1>
  <p>Versiones, despliegues y puntos de retorno de todo el ecosistema.
     Zona restringida: identifícate con tu cuenta de Google.</p>
  <form id="f" method="POST" action="/webmaster">
    <input id="cred" type="hidden" name="credential">
    <div id="g_id_onload" data-client_id="${CLIENT_ID}" data-callback="entrar" data-auto_prompt="false"></div>
    <div class="picker"><div class="g_id_signin" data-type="standard" data-shape="rectangular"
      data-theme="outline" data-text="continue_with" data-size="large" data-width="320"></div></div>
  </form>
  ${error ? `<div class="err">${error}</div>` : ''}
  <div class="foot">admiranext.com</div>
</div>
<script>function entrar(r){var i=document.getElementById('cred');
 if(!i||!r||!r.credential)return;i.value=r.credential;document.getElementById('f').submit()}</script>
<script src="https://accounts.google.com/gsi/client" async defer></script>
</body></html>`;
}

export function respuestaHtml(cuerpo, status = 401) {
  return new Response(cuerpo, {
    status,
    headers: {
      'content-type': 'text/html; charset=utf-8',
      'cache-control': 'no-store',
      'x-robots-tag': 'noindex, nofollow',
    },
  });
}
