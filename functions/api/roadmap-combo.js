/**
 * /api/roadmap-combo — roadmap por proyecto editable (Carlos, 16-10-2026).
 * GET: documento guardado en KV (PRESENTATION_IDEAS, clave roadmap-combo:v1) o la
 *      semilla data/roadmap/proyectos.json. Exige sesión de la zona protegida.
 * PUT: guarda el documento completo. Exige rol admin/editor + CSRF (mismo
 *      perímetro que /webmaster). Control de concurrencia con "rev".
 * También guarda los planes por agente y por consejero (tipo agente|consejero).
 * Sin binding nuevo ni migración.
 */
import { sesionCompleta, csrfValido } from '../_webmaster-gate.js';
import { leer, guardar } from '../_roadmap-combo.js';

function json(body, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: {
    'content-type': 'application/json; charset=utf-8', 'cache-control': 'private, no-store',
    'x-content-type-options': 'nosniff', 'x-robots-tag': 'noindex, nofollow' } });
}
export async function onRequestGet({ request, env }) {
  if (!env.WEBMASTER_SIGNING_KEY) return json({ error: 'Acceso no disponible.' }, 503);
  const current = await sesionCompleta(request, env);
  if (!current) return json({ error: 'Zona protegida.' }, 401);
  const doc = await leer(env);
  return json({ ...doc, puedeEditar: current.role === 'admin' || current.role === 'editor', csrf: current.csrf });
}

export async function onRequestPut({ request, env }) {
  if (!env.WEBMASTER_SIGNING_KEY || !env.PRESENTATION_IDEAS) return json({ error: 'Guardado no disponible.' }, 503);
  const current = await sesionCompleta(request, env);
  if (!current) return json({ error: 'Zona protegida.' }, 401);
  if (current.role !== 'admin' && current.role !== 'editor') return json({ error: 'Sin permiso de edición.' }, 403);
  if (!csrfValido(request, current)) return json({ error: 'CSRF no válido.' }, 403);
  const cuerpo = await request.text();
  // Cada idea y cada sub pueden llevar un detalle de 1000 caracteres (3×4×horizontes).
  if (cuerpo.length > 2500000) return json({ error: 'Demasiado grande.' }, 413);
  let entrada; try { entrada = JSON.parse(cuerpo); } catch (_) { return json({ error: 'JSON no válido.' }, 400); }
  const r = await guardar(env, entrada, current.email);
  if (!r.ok) return json({ error: r.error, rev: r.rev }, r.status);
  return json({ ok: true, rev: r.rev });
}

const no = () => json({ error: 'Método no permitido.' }, 405);
export const onRequestPost = no;
export const onRequestDelete = no;
export const onRequestPatch = no;
