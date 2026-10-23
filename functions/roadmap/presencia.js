/**
 * GET /roadmap/presencia — latidos mode=trabajando de los últimos 90 s.
 * Misma verja que /roadmap/encargos. verified:0 no se descarta.
 */
import { sesionCompleta, respuestaLogin } from '../_webmaster-gate.js';
import { leerPresenciaTrabajando } from '../_presencia-flota.js';

const JSON_HEADERS = {
  'content-type': 'application/json; charset=utf-8',
  'cache-control': 'private, no-store',
  'x-robots-tag': 'noindex, nofollow',
  'x-content-type-options': 'nosniff',
};

function json(body, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: JSON_HEADERS });
}

export async function onRequestGet({ request, env }) {
  if (!env.WEBMASTER_SIGNING_KEY) return respuestaLogin(env, 'Acceso no disponible ahora mismo.', '/roadmap/encargos', 503);
  const current = await sesionCompleta(request, env);
  if (!current) return respuestaLogin(env, 'Zona protegida: identifícate para entrar.', '/roadmap/encargos', 401);
  try {
    const por = await leerPresenciaTrabajando();
    return json({ ok: true, por });
  } catch {
    return json({ ok: false, por: {} }, 502);
  }
}
