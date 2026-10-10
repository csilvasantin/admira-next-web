/*
 * /data/finde-pilares.json — SOLO con sesión webmaster (FLT-101812 / #5505).
 * Cloudflare Pages: esta Function tiene prioridad sobre el estático.
 */
import DATOS from '../../data/finde-pilares.json' with { type: 'json' };
import { sesionCompleta, respuestaLogin } from '../_webmaster-gate.js';

export async function onRequest(context) {
  const { request, env } = context;
  if (request.method !== 'GET' && request.method !== 'HEAD') {
    return new Response('Method Not Allowed', { status: 405, headers: { allow: 'GET, HEAD' } });
  }
  if (!env.WEBMASTER_SIGNING_KEY) {
    return respuestaLogin(env, 'Acceso no disponible ahora mismo.', '/flota', 503);
  }
  const current = await sesionCompleta(request, env);
  if (!current) {
    return respuestaLogin(env, 'Zona protegida: identifícate para entrar.', '/flota', 401);
  }
  const body = request.method === 'HEAD' ? null : JSON.stringify(DATOS, null, 2) + '\n';
  return new Response(body, {
    status: 200,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'private, no-store',
      'x-robots-tag': 'noindex, nofollow',
    },
  });
}
