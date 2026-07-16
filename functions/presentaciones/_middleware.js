/*
 * Gatekeeper por cliente para la ruta castellana /presentaciones/*.
 * Las cookies se comparten con /presentations/* para abrir ambos idiomas una vez.
 *
 * Verifica una password EN EL EDGE antes de servir el deck: el HTML del deck no
 * se envía hasta que la contraseña es correcta (protección real, no un candado JS
 * que se ve con "ver código fuente").
 *
 * AISLAMIENTO POR CLIENTE: cada espacio tiene su propia password (secret de Cloudflare)
 * y su propia cookie firmada. La clave/cookie de Lenovo NO abre La Caixa ni Clear
 * Channel. Todos los recursos bajo /presentaciones/<cliente>/ heredan la clave del
 * primer segmento, incluidos audio, vídeo, PDF y documentos.
 *
 * SECRETS (Cloudflare Pages → Settings → Environment variables, tipo "Secret"):
 *   PRES_SIGNING_KEY  — clave para firmar las cookies (aleatoria; la fija el sistema).
 *   PRES_ADMIN        — password de las galerías (interna, solo equipo).
 *   PRES_<CLIENTE>    — password de cada deck. slug 'lenovo' → PRES_LENOVO, 'caixa' → PRES_CAIXA.
 *
 * Añadir un cliente = crear /presentaciones/<slug>.html + `wrangler pages secret put
 * PRES_<SLUG>` + deploy. Sin secret configurado, el espacio queda BLOQUEADO (fail-closed).
 */

const MAXAGE = 60 * 60 * 24 * 30; // sesión válida 30 días
const enc = new TextEncoder();

function b64url(buf){
  let s = btoa(String.fromCharCode(...new Uint8Array(buf)));
  return s.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
async function hmac(key, msg){
  const k = await crypto.subtle.importKey('raw', enc.encode(key), { name:'HMAC', hash:'SHA-256' }, false, ['sign']);
  return b64url(await crypto.subtle.sign('HMAC', k, enc.encode(msg)));
}
function ctEq(a, b){
  a = String(a); b = String(b);
  if (a.length !== b.length) return false;
  let r = 0;
  for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return r === 0;
}
async function makeToken(signKey, slug, exp){
  return exp + '.' + await hmac(signKey, slug + ':' + exp);
}
async function validToken(signKey, slug, token){
  if (!token) return false;
  const dot = token.indexOf('.');
  if (dot < 0) return false;
  const exp = parseInt(token.slice(0, dot), 10);
  if (!exp || exp < Math.floor(Date.now() / 1000)) return false;
  return ctEq(token.slice(dot + 1), await hmac(signKey, slug + ':' + exp));
}
function readCookies(req){
  const out = {};
  (req.headers.get('Cookie') || '').split(/;\s*/).forEach(p => {
    const i = p.indexOf('=');
    if (i > 0) out[p.slice(0, i)] = p.slice(i + 1);
  });
  return out;
}
function esc(s){ return String(s).replace(/[<>&"]/g, c => ({'<':'&lt;','>':'&gt;','&':'&amp;','"':'&quot;'}[c])); }

function loginPage(title, action, error){
  return `<!doctype html><html lang="es"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex, nofollow"><title>${esc(title)} · Acceso</title>
<style>
  :root{--bg:#070a10;--panel:#0d1522;--line:#1e2940;--ink:#e8eef8;--dim:#7186a8;--brand:#3df08a}
  *{box-sizing:border-box}
  body{margin:0;min-height:100vh;display:grid;place-items:center;background:var(--bg);color:var(--ink);
    font-family:-apple-system,"Segoe UI",Roboto,system-ui,sans-serif;padding:24px}
  body::before{content:"";position:fixed;inset:0;background:radial-gradient(90% 60% at 80% -10%,rgba(61,240,138,.08),transparent 60%);pointer-events:none}
  .box{position:relative;width:100%;max-width:380px;background:var(--panel);border:1px solid var(--line);
    border-radius:18px;padding:34px 30px;box-shadow:0 24px 60px rgba(0,0,0,.5)}
  .eyebrow{font:700 11px/1 ui-monospace,monospace;letter-spacing:.22em;text-transform:uppercase;color:var(--brand);
    display:flex;align-items:center;gap:9px;margin-bottom:20px}
  .eyebrow svg{width:14px;height:14px}
  h1{font-size:26px;font-weight:800;letter-spacing:-.01em;margin:0 0 6px}
  p.sub{color:var(--dim);font-size:14px;margin:0 0 24px;line-height:1.5}
  label{display:block;font:700 11px/1 ui-monospace,monospace;letter-spacing:.08em;text-transform:uppercase;color:var(--dim);margin-bottom:8px}
  input{width:100%;background:#0a1220;color:var(--ink);border:1px solid var(--line);border-radius:11px;
    padding:13px 14px;font-size:16px;outline:none;transition:border-color .15s,box-shadow .15s}
  input:focus{border-color:var(--brand);box-shadow:0 0 0 3px rgba(61,240,138,.16)}
  button{width:100%;margin-top:16px;appearance:none;border:0;border-radius:11px;padding:13px;cursor:pointer;
    background:var(--brand);color:#052013;font:800 14px/1 -apple-system,system-ui,sans-serif;letter-spacing:.01em;transition:filter .15s}
  button:hover{filter:brightness(1.08)}
  .err{margin-top:14px;color:#ff6b6b;font:600 13px/1.4 ui-monospace,monospace;text-align:center}
  .foot{margin-top:22px;text-align:center;font:600 11px/1 ui-monospace,monospace;letter-spacing:.04em;color:var(--dim)}
</style></head>
<body><form class="box" method="POST" action="${esc(action)}" autocomplete="off">
  <div class="eyebrow"><svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 2l2.4 6.9L21.5 9l-5.6 4.3 2.1 7-6-4.3-6 4.3 2.1-7L2.5 9l7.1-.1z"/></svg>ADmiraNeXT · Presentación</div>
  <h1>${esc(title)}</h1>
  <p class="sub">Este contenido está protegido. Introduce la contraseña que te hemos facilitado.</p>
  <label for="p">Contraseña</label>
  <input id="p" name="password" type="password" autofocus required autocomplete="off" inputmode="text">
  <button type="submit">Entrar</button>
  ${error ? `<div class="err">${esc(error)}</div>` : ''}
  <div class="foot">admiranext.com</div>
</form></body></html>`;
}

export async function onRequest(context){
  const { request, env, next } = context;
  const url = new URL(request.url);

  // Primer segmento = cliente. Las subrutas conservan el mismo aislamiento:
  // /presentaciones/clearchannel/media/audio.m4a → slug 'clearchannel'.
  const rel = url.pathname.replace(/^\/presentaciones\/?/i, '').replace(/^\/+|\/+$/g, '');
  const parts = rel ? rel.split('/').filter(Boolean) : [];
  const first = (parts[0] || '').replace(/\.html$/i, '').toLowerCase();
  const isGallery = (parts.length === 0 || (parts.length === 1 && first === 'index'));
  const seg = isGallery ? '' : first;
  // El editor y su API son internos: nunca se abren con la clave del cliente.
  // Solo la cookie maestra del equipo puede leerlos o modificarlos.
  const second = (parts[1] || '').replace(/\.html$/i, '').toLowerCase();
  const third = (parts[2] || '').replace(/\.html$/i, '').toLowerCase();
  const isIdeasEditor = !isGallery && second === 'ideas';
  const isIdeasApi = !isGallery && second === 'api' && third === 'ideas';
  const isIdeasWrite = isIdeasApi && request.method !== 'GET';
  const isIdeasArea = isIdeasEditor || isIdeasWrite;

  const cookieName = 'pres_' + (isGallery ? 'admin' : seg);
  const cookieSlug = isGallery ? '_admin' : seg;                 // lo que se firma
  const secretName = isGallery ? 'PRES_ADMIN'
                               : 'PRES_' + seg.toUpperCase().replace(/[^A-Z0-9]+/g, '_');
  const names = { lacaixa:'La Caixa', clearchannel:'Clear Channel', lenovo:'Lenovo', caixa:'La Caixa' };
  const clientTitle = names[seg] || seg.charAt(0).toUpperCase() + seg.slice(1);
  const title = isGallery ? 'Presentaciones' : (isIdeasArea ? `${clientTitle} · Ideas` : clientTitle);

  const signKey = env.PRES_SIGNING_KEY;
  const expected = env[secretName];
  const master = env.PRES_ADMIN;   // clave interna del equipo = MAESTRA: abre cualquier deck
  const editor = env.PRES_EDITOR;  // clave interna limitada a /Ideas y a su API
  const cleanPath = url.pathname;

  // Sin clave de firma, o sin password del espacio NI maestra → fail-closed (nunca público).
  if (!signKey || (!expected && !master)){
    return new Response(loginPage(title, cleanPath, 'Acceso no disponible por ahora.'),
      { status: 503, headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' } });
  }

  const setCookie = (name, slug) => {
    const exp = Math.floor(Date.now() / 1000) + MAXAGE;
    return makeToken(signKey, slug, exp).then((token) => {
      const h = new Headers({ 'Location': cleanPath, 'cache-control': 'no-store' });
      h.append('Set-Cookie', `${name}=${token}; Path=/; Max-Age=${MAXAGE}; HttpOnly; Secure; SameSite=Lax`);
      return new Response(null, { status: 303, headers: h });
    });
  };

  // POST = intento de login
  if (request.method === 'POST'){
    let pw = '';
    try { pw = (await request.formData()).get('password') || ''; } catch (_) {}
    // clave MAESTRA del equipo → cookie 'pres_master' que abre TODOS los decks + galería
    if (master && ctEq(pw, master)) return await setCookie('pres_master', '_master');
    // clave del editor → solo /Ideas y API de ideas; nunca abre otras presentaciones.
    if (isIdeasArea && editor && ctEq(pw, editor)) return await setCookie('pres_editor', '_editor');
    // El cliente no puede entrar en /Ideas ni en su API con su propia clave.
    if (isIdeasArea){
      return new Response(loginPage(title, cleanPath, 'Esta zona requiere acceso interno de Admira.'),
        { status: 401, headers: { 'content-type':'text/html; charset=utf-8', 'cache-control':'no-store' } });
    }
    // clave del propio espacio (cliente, o galería)
    if (expected && ctEq(pw, expected)) return await setCookie(cookieName, cookieSlug);
    return new Response(loginPage(title, cleanPath, 'Contraseña incorrecta.'),
      { status: 401, headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' } });
  }

  // GET = ¿cookie válida? (maestra del equipo → todo · o la del propio espacio)
  const cks = readCookies(request);
  if (await validToken(signKey, '_master', cks['pres_master'])) return next();
  if ((isIdeasEditor || isIdeasApi) && editor && await validToken(signKey, '_editor', cks['pres_editor'])) return next();
  if (isIdeasArea){
    return new Response(loginPage(title, cleanPath, ''),
      { status: 401, headers: { 'content-type':'text/html; charset=utf-8', 'cache-control':'no-store' } });
  }
  if (await validToken(signKey, cookieSlug, cks[cookieName])) return next();

  return new Response(loginPage(title, cleanPath, ''),
    { status: 401, headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' } });
}
