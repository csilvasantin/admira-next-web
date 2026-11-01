// /ojosremotos/config — tokens de los nodos de ojosIA para quien ya ha entrado en la zona protegida (Carlos, opción A, 01-11-2026).
// Misma puerta que /ojosremotos (sesión Google + directorio AUTH_DB, _webmaster-gate.js). Sin sesión: 401, sin tokens.
// Los tokens viven SOLO en secretos de Cloudflare Pages (OJOS_TOKEN_MACMINI, OJOS_TOKEN_MACSTUDIO); nunca en el repo ni en logs.
// Los nodos siguen solo en el tailnet: el token no basta sin Tailscale.
import { sesionCompleta, auditar } from '../_webmaster-gate.js';

const json = (o, status = 200) => new Response(JSON.stringify(o), { status, headers: {
  'content-type': 'application/json; charset=utf-8', 'cache-control': 'private, no-store', 'x-robots-tag': 'noindex, nofollow' } });

export async function onRequestGet({ request, env }) {
  if (!env.WEBMASTER_SIGNING_KEY) return json({ error: 'acceso no disponible' }, 503);
  const current = await sesionCompleta(request, env);
  if (!current || !current.email) return json({ error: 'identifícate' }, 401);
  const site = request.headers.get('sec-fetch-site');
  if (site && site !== 'same-origin') return json({ error: 'origen no permitido' }, 403);
  const nodos = {};
  if (env.OJOS_TOKEN_MACMINI) nodos.mm = { tok: env.OJOS_TOKEN_MACMINI };
  if (env.OJOS_TOKEN_MACSTUDIO) nodos.ms = { tok: env.OJOS_TOKEN_MACSTUDIO };
  await auditar(env, current.email, current.email, 'ojosremotos_config', `nodos ${Object.keys(nodos).join(',') || 'ninguno'}`).catch(() => {});
  return json({ nodos });
}
export const onRequest = () => json({ error: 'método no permitido' }, 405);
