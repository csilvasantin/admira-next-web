/**
 * /api/roadmap-combo — roadmap por proyecto editable (Carlos, 16-10-2026).
 * GET: documento guardado en KV (PRESENTATION_IDEAS, clave roadmap-combo:v1) o la
 *      semilla data/roadmap/proyectos.json. Exige sesión de la zona protegida.
 * PUT: guarda el documento completo. Exige rol admin/editor + CSRF (mismo
 *      perímetro que /webmaster). Control de concurrencia con "rev".
 * Sin binding nuevo ni migración.
 */
import SEMILLA from '../../data/roadmap/proyectos.json' with { type: 'json' };
import { sesionCompleta, csrfValido } from '../_webmaster-gate.js';

const CLAVE = 'roadmap-combo:v1';
const HORIZONTES = ['ayer', 'hoy', 'manana', 'semana', 'mes', 'trimestre'];
const EDITABLES = new Set(['hoy', 'manana', 'semana', 'mes', 'trimestre']);
const ESTADOS = new Set(['hecho', 'parcial', 'no']);

function json(body, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: {
    'content-type': 'application/json; charset=utf-8', 'cache-control': 'private, no-store',
    'x-content-type-options': 'nosniff', 'x-robots-tag': 'noindex, nofollow' } });
}
const txt = (v, max) => (typeof v === 'string' && v.trim() && v.length <= max ? v.trim() : null);

async function leer(env) {
  let doc = null;
  try { doc = env.PRESENTATION_IDEAS && await env.PRESENTATION_IDEAS.get(CLAVE, { type: 'json' }); } catch (_) { doc = null; }
  return doc || { ...SEMILLA, rev: 0, origen: 'semilla' };
}

/** Valida y normaliza. Devuelve null si algo no cuadra (regla del 123 y el abc). */
export function validar(entrada, base) {
  if (!entrada || !Array.isArray(entrada.proyectos)) return null;
  const ids = new Set(base.proyectos.map((p) => p.id));
  const out = { ...base, proyectos: [] };
  for (const p of base.proyectos) {
    const nuevo = entrada.proyectos.find((x) => x && x.id === p.id);
    const roadmap = {};
    for (const h of HORIZONTES) {
      const orig = (p.roadmap && p.roadmap[h]) || [];
      if (!EDITABLES.has(h) || !nuevo || !nuevo.roadmap) { roadmap[h] = orig; continue; }
      const lista = nuevo.roadmap[h];
      if (!Array.isArray(lista) || lista.length > 3) return null;
      roadmap[h] = [];
      for (const it of lista) {
        if (it && typeof it.ref === 'string') { if (!/^[a-z]+-[a-z]+-[0-9a-z]+$/.test(it.ref) || !ids.has(it.ref.split('-')[0])) return null; roadmap[h].push({ ref: it.ref }); continue; }
        const t = txt(it && it.t, 120); const id = txt(it && it.id, 40);
        if (!t || !id || !/^[a-z0-9-]+$/.test(id)) return null;
        const s = Array.isArray(it.s) ? it.s : [];
        if (s.length > 3) return null;
        const subs = s.map((x) => txt(x, 200));
        if (subs.some((x) => !x)) return null;
        const hs = subs.map((_, k) => !!(Array.isArray(it.hs) && it.hs[k]));
        const item = { id, t, s: subs, hs };
        if (it.pct !== undefined && it.pct !== null && it.pct !== '') {
          const n = Number(it.pct); if (!Number.isFinite(n) || n < 0 || n > 100) return null; item.pct = Math.round(n);
        }
        if (Array.isArray(it.de)) item.de = it.de.filter((x) => typeof x === 'string' && /^[a-z0-9-]+$/.test(x)).slice(0, 9);
        if (it.e && ESTADOS.has(it.e)) item.e = it.e;
        roadmap[h].push(item);
      }
    }
    out.proyectos.push({ ...p, roadmap });
  }
  return out;
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
  if (cuerpo.length > 200000) return json({ error: 'Demasiado grande.' }, 413);
  let entrada; try { entrada = JSON.parse(cuerpo); } catch (_) { return json({ error: 'JSON no válido.' }, 400); }
  const base = await leer(env);
  if (Number(entrada.rev) !== Number(base.rev || 0)) return json({ error: 'Otro cambio se guardó antes. Recarga.', rev: base.rev || 0 }, 409);
  const doc = validar(entrada, base);
  if (!doc) return json({ error: 'Datos no válidos (máx. 3 ideas y 3 subobjetivos).' }, 422);
  doc.rev = Number(base.rev || 0) + 1; doc.origen = 'kv';
  doc.editado = { por: current.email, en: new Date().toISOString() };
  await env.PRESENTATION_IDEAS.put(CLAVE, JSON.stringify(doc));
  return json({ ok: true, rev: doc.rev });
}

const no = () => json({ error: 'Método no permitido.' }, 405);
export const onRequestPost = no;
export const onRequestDelete = no;
export const onRequestPatch = no;
