/**
 * Almacén del roadmap por proyecto / agente / consejero (KV PRESENTATION_IDEAS, clave
 * roadmap-combo:v1; semilla data/roadmap/proyectos.json). Lo usan /api/roadmap-combo
 * (web) y las tools roadmap_* del MCP (functions/mcp/_roadmap.js).
 */
import SEMILLA from '../data/roadmap/proyectos.json' with { type: 'json' };

export const CLAVE = 'roadmap-combo:v1';
export const HORIZONTES = ['ayer', 'hoy', 'manana', 'semana', 'mes', 'trimestre'];
export const EDITABLES = new Set(['hoy', 'manana', 'semana', 'mes', 'trimestre']);
const ESTADOS = new Set(['hecho', 'parcial', 'no']);

const txt = (v, max) => (typeof v === 'string' && v.trim() && v.length <= max ? v.trim() : null);

export async function leer(env) {
  let doc = null;
  try { doc = env.PRESENTATION_IDEAS && await env.PRESENTATION_IDEAS.get(CLAVE, { type: 'json' }); } catch (_) { doc = null; }
  if (!doc) return { ...SEMILLA, rev: 0, origen: 'semilla' };
  // Agentes y consejeros (16-10-2026): lo que falte en el documento guardado sale de la semilla.
  const hay = new Set((doc.proyectos || []).map((p) => p.id));
  const faltan = SEMILLA.proyectos.filter((p) => !hay.has(p.id));
  return faltan.length ? { ...doc, proyectos: [...doc.proyectos, ...faltan], sinPlan: SEMILLA.sinPlan } : doc;
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
    const fila = { ...p, roadmap };
    if (p.tipo === 'consejero' && nuevo && (nuevo.aprobacion === 'propuesto' || nuevo.aprobacion === 'ok')) fila.aprobacion = nuevo.aprobacion;
    out.proyectos.push(fila);
  }
  return out;
}


/** Guarda con control de concurrencia (rev). Devuelve {ok, rev} o {error, status}. */
export async function guardar(env, entrada, quien) {
  if (!env || !env.PRESENTATION_IDEAS) return { error: 'Guardado no disponible.', status: 503 };
  const base = await leer(env);
  if (Number(entrada.rev) !== Number(base.rev || 0)) return { error: 'Otro cambio se guardó antes. Recarga.', status: 409, rev: base.rev || 0 };
  const doc = validar(entrada, base);
  if (!doc) return { error: 'Datos no válidos (máx. 3 ideas y 3 subobjetivos).', status: 422 };
  doc.rev = Number(base.rev || 0) + 1; doc.origen = 'kv';
  doc.editado = { por: String(quien || ''), en: new Date().toISOString() };
  await env.PRESENTATION_IDEAS.put(CLAVE, JSON.stringify(doc));
  return { ok: true, rev: doc.rev, doc };
}
