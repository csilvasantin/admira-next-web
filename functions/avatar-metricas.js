// /avatar-metricas — puente de sesión hacia digitalavatar.ai/metricas (GrokBot · MacMini, 7-oct-2026, r2).
// El panel vive ya en digitalavatar.ai/metricas (lo sirve el cerebro). Aquí solo se comprueba la
// sesión de AdmiraNeXT (Google + AUTH_DB, _webmaster-gate.js) y se entrega un ticket firmado
// (HMAC-SHA256 con DA_SSO_KEY, 120 s, sin privilegios propios) a digitalavatar.ai/metricas/sso.
import { sesionCompleta, respuestaLogin } from './_webmaster-gate.js';

const RUTA = '/avatar-metricas';
const DESTINO = 'https://digitalavatar.ai/metricas/sso';
const enc = new TextEncoder();
const b64u = (buf) => btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

export async function ticket(key, data) {
  const p = b64u(enc.encode(JSON.stringify(data)));
  const k = await crypto.subtle.importKey('raw', enc.encode(key), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return p + '.' + b64u(await crypto.subtle.sign('HMAC', k, enc.encode('da-sso.' + p)));
}
export const siguiente = (n) => { const s = String(n || ''); return /^\/metricas(\/|\?|$)/.test(s) && !/[\\\s]|\/\//.test(s) ? s : '/metricas/'; };

export async function onRequest(context) {
  const { request, env } = context;
  if (!env.WEBMASTER_SIGNING_KEY || !env.DA_SSO_KEY) return respuestaLogin(env, 'Acceso no disponible ahora mismo.', RUTA, 503);
  const user = await sesionCompleta(request, env);
  if (!user) return respuestaLogin(env, 'Métricas del avatar: identifícate para entrar.', RUTA, 401);
  const url = new URL(request.url);
  const t = await ticket(env.DA_SSO_KEY, { e: user.email, n: user.display_name || user.email, r: user.role || '', exp: Math.floor(Date.now() / 1000) + 120 });
  const loc = DESTINO + '?ticket=' + encodeURIComponent(t) + '&next=' + encodeURIComponent(siguiente(url.searchParams.get('next')));
  return new Response(null, { status: 302, headers: { Location: loc, 'cache-control': 'no-store', 'referrer-policy': 'no-referrer' } });
}
