/*
 * Alta y revocación del enlace del visor. Solo con la sesión de Google
 * que ya exige /pruebas. La cookie del visor no abre esta ruta.
 */
import { csrfValido, sesionCompleta } from '../../_webmaster-gate.js';
import { borrarEnlace, crearEnlace, presentarEnlace } from '../_visor-enlace.js';

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'private, no-store',
      'x-robots-tag': 'noindex, nofollow',
      'x-content-type-options': 'nosniff',
    },
  });
}

async function staff(request, env) {
  if (!env || !env.WEBMASTER_SIGNING_KEY) return json({ error: 'Acceso no disponible ahora mismo.' }, 503);
  const current = await sesionCompleta(request, env);
  if (!current) return json({ error: 'Sin sesión.' }, 401);
  if (!csrfValido(request, current)) return json({ error: 'Sesión o CSRF no válidos.' }, 403);
  return current;
}

export async function onRequestGet(context) {
  const { request, env } = context;
  const current = await staff(request, env);
  if (current instanceof Response) return current;
  const id = new URL(request.url).searchParams.get('id');
  const hecho = await presentarEnlace(env, id, new URL(request.url).origin);
  if (!hecho.ok) return json({ error: hecho.error }, hecho.status);
  return json({ ok: true, id: hecho.id, exp: hecho.exp, url: hecho.url, deepLink: hecho.deepLink, qrSvg: hecho.qrSvg });
}

export async function onRequestPost(context) {
  const { request, env } = context;
  const current = await staff(request, env);
  if (current instanceof Response) return current;
  let body;
  try { body = await request.json(); } catch (_) { return json({ error: 'JSON no válido.' }, 400); }
  const dias = body && body.dias == null ? 7 : body && body.dias;
  const hecho = await crearEnlace(env, { origin: new URL(request.url).origin, dias, now: Math.floor(Date.now() / 1000) });
  if (!hecho.ok) return json({ error: hecho.error }, hecho.status);
  return json({ ok: true, id: hecho.id, exp: hecho.exp, url: hecho.url, deepLink: hecho.deepLink, qrSvg: hecho.qrSvg });
}

export async function onRequestDelete(context) {
  const { request, env } = context;
  const current = await staff(request, env);
  if (current instanceof Response) return current;
  let body;
  try { body = await request.json(); } catch (_) { return json({ error: 'JSON no válido.' }, 400); }
  const hecho = await borrarEnlace(env, body && body.id);
  if (!hecho.ok) return json({ error: hecho.error }, hecho.status);
  return json({ ok: true });
}
