/*
 * Login por token MCP personal (anmcp_…) — alternativa a Google para agentes y
 * consejeros sin cuenta Google (Carlos, 16-10-2026). Solo POST (el token nunca va
 * en la URL). El token se cruza con admiranext_mcp_tokens (hash) y el directorio
 * (activo, rol, caducidad); emite la misma cookie __Host-an_session que Google.
 */
import { buscarUsuario, auditar, cookieDeSesion, returnToSeguro, consumirDesafioLogin } from '../_webmaster-gate.js';
import { tokenRow, bearerOf } from '../mcp/_tokens.js';
import { limitarFrecuencia } from '../_limite-frecuencia.js';

const ROLES = new Set(['admin', 'editor', 'viewer']);
const json = (body, status = 200, extra = {}) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json', 'cache-control': 'no-store', 'referrer-policy': 'no-referrer', ...extra } });

export async function onRequestPost({ request, env, waitUntil }) {
  const origin = request.headers.get('Origin');
  if (origin && origin !== 'null' && origin !== new URL(request.url).origin) return json({ ok: false, error: 'origen no permitido' }, 403);
  let token = bearerOf(request), returnTo = '/webmaster', isForm = false;
  const type = String(request.headers.get('content-type') || '');
  try {
    if (type.includes('application/json')) { const b = await request.json(); token = token || String(b.token || ''); returnTo = b.return_to || returnTo; }
    else if (type.includes('form')) { isForm = true; const f = await request.formData(); token = token || String(f.get('token') || ''); returnTo = f.get('return_to') || returnTo; }
  } catch (_) {}
  // Freno por IP (DMZ 19-10-2026): probar tokens a ciegas cuesta una consulta D1 por intento.
  const freno = await limitarFrecuencia(env, request, { ambito: 'login-token', maximo: 20, ventanaSeg: 600 });
  if (!freno.permitido) return json({ ok: false, error: 'demasiados intentos; espera un poco' }, 429, { 'retry-after': String(freno.reintentarEn) });
  if (!/^anmcp_[A-Za-z0-9_-]{20,100}$/.test(token)) return json({ ok: false, error: 'token no válido' }, 401);
  const row = await tokenRow(env, token, waitUntil);
  const user = row && await buscarUsuario(env, row.email);
  const expira = Number(user?.expires_at || 0);
  if (!user || user.status !== 'active' || !ROLES.has(user.role) || (expira > 0 && expira < Date.now())) {
    if (row) await auditar(env, row.email, row.email, 'login_denied', 'token').catch(() => {});
    return json({ ok: false, error: 'acceso restringido' }, 401);
  }
  await auditar(env, user.email, user.email, 'login_success', `${user.role} · token`).catch(() => {});
  // amr=token: esta sesión NO entra en la DMZ de /usuarios (hace falta Google).
  const cookie = await cookieDeSesion(env, user, { amr: 'token' });
  // Formulario de la página de acceso: el destino sale del desafío de login (cookie), no del HTML.
  let dest = returnToSeguro(returnTo);
  if (isForm) { const m = /(?:^|;\s*)__Host-an_login_nonce=([^;]+)/.exec(request.headers.get('Cookie') || ''); const d = m && await consumirDesafioLogin(env, m[1]).catch(() => null); if (d) dest = d; }
  if (isForm) return new Response(null, { status: 303, headers: { location: dest, 'set-cookie': cookie, 'cache-control': 'no-store' } });
  return json({ ok: true, email: user.email, role: user.role, return_to: dest }, 200, { 'set-cookie': cookie });
}
export const onRequestGet = () => json({ ok: false, error: 'usa POST' }, 405, { allow: 'POST' });
