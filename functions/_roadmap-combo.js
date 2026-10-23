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

// Fechas de Ayer/Hoy/Mañana siempre del día real en Europe/Madrid (17-10-2026: el
// sábado seguía saliendo "Hoy · vie 16" porque las etiquetas eran texto fijo).
export function etiquetasHoy(now = new Date()) {
  const f = (d) => new Intl.DateTimeFormat('es-ES', { timeZone: 'Europe/Madrid', weekday: 'short', day: 'numeric', month: 'short' }).format(d).replace(/\./g, '').replace(',', '');
  const dia = 864e5;
  return { ayer: 'Ayer · ' + f(new Date(+now - dia)), hoy: 'Hoy · ' + f(now), manana: 'Mañana · ' + f(new Date(+now + dia)), semana: 'Semana', mes: 'Mes', trimestre: 'Trimestre' };
}
const conFechas = (doc) => ({ ...doc, etiquetas: { ...(doc.etiquetas || {}), ...etiquetasHoy() } });

const txt = (v, max) => (typeof v === 'string' && v.trim() && v.length <= max ? v.trim() : null);
/** Versión detallada opcional de una idea o un sub (Carlos, 23-10-2026, #7087). */
export const DETALLE_MAX = 1000;
export function recortarDetalle(v) {
  if (typeof v !== 'string') return '';
  return v.trim().slice(0, DETALLE_MAX);
}

export async function leer(env) {
  let doc = null;
  try { doc = env.PRESENTATION_IDEAS && await env.PRESENTATION_IDEAS.get(CLAVE, { type: 'json' }); } catch (_) { doc = null; }
  if (!doc) return conFechas({ ...SEMILLA, rev: 0, origen: 'semilla' });
  // Agentes y consejeros (16-10-2026): lo que falte en el documento guardado sale de la semilla.
  const hay = new Set((doc.proyectos || []).map((p) => p.id));
  const faltan = SEMILLA.proyectos.filter((p) => !hay.has(p.id));
  return conFechas(faltan.length ? { ...doc, proyectos: [...doc.proyectos, ...faltan], sinPlan: SEMILLA.sinPlan } : doc);
}

/** Valida y normaliza. Devuelve null si algo no cuadra (regla del 123 y el abc). */
export function validar(entrada, base, confiar = false) {
  if (!entrada || !Array.isArray(entrada.proyectos)) return null;
  const ids = new Set(base.proyectos.map((p) => p.id));
  const out = { ...base, proyectos: [] };
  // Declaración de hecho (dec) y sello del consejero (sel) solo los escribe el MCP
  // (roadmap_declarar_hecho / roadmap_sellar). Un PUT web conserva los guardados.
  const previos = {};
  base.proyectos.forEach((p) => Object.values(p.roadmap || {}).forEach((l) => (l || []).forEach((i) => { if (i && i.id) previos[i.id] = i; })));
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
        const parsed = s.map((x, k) => {
          const sd = Array.isArray(it.sd) ? it.sd[k] : '';
          if (typeof x === 'string') return { texto: txt(x, 200), detalle: recortarDetalle(sd) };
          if (x && typeof x === 'object') {
            const corto = typeof x.texto === 'string' ? x.texto : (typeof x.t === 'string' ? x.t : '');
            return { texto: txt(corto, 200), detalle: recortarDetalle(typeof x.detalle === 'string' ? x.detalle : sd) };
          }
          return { texto: null, detalle: '' };
        });
        if (parsed.some((x) => !x.texto)) return null;
        const subs = parsed.map((x) => x.texto);
        const hs = subs.map((_, k) => !!(Array.isArray(it.hs) && it.hs[k]));
        const item = { id, t, s: subs, hs };
        const ideaDet = recortarDetalle(it.detalle);
        if (ideaDet) item.detalle = ideaDet;
        const sd = parsed.map((x) => x.detalle);
        if (sd.some(Boolean)) item.sd = sd;
        if (it.pct !== undefined && it.pct !== null && it.pct !== '') {
          const n = Number(it.pct); if (!Number.isFinite(n) || n < 0 || n > 100) return null; item.pct = Math.round(n);
        }
        if (Array.isArray(it.de)) item.de = it.de.filter((x) => typeof x === 'string' && /^[a-z0-9-]+$/.test(x)).slice(0, 9);
        if (it.e && ESTADOS.has(it.e)) item.e = it.e;
        const fuente = confiar ? it : previos[id];
        if (fuente && fuente.dec && typeof fuente.dec === 'object') item.dec = fuente.dec;
        if (fuente && fuente.sel && typeof fuente.sel === 'object') item.sel = fuente.sel;
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
export async function guardar(env, entrada, quien, confiar = false) {
  if (!env || !env.PRESENTATION_IDEAS) return { error: 'Guardado no disponible.', status: 503 };
  const base = await leer(env);
  if (Number(entrada.rev) !== Number(base.rev || 0)) return { error: 'Otro cambio se guardó antes. Recarga.', status: 409, rev: base.rev || 0 };
  const doc = validar(entrada, base, confiar);
  if (!doc) return { error: 'Datos no válidos (máx. 3 ideas y 3 subobjetivos).', status: 422 };
  doc.rev = Number(base.rev || 0) + 1; doc.origen = 'kv';
  doc.editado = { por: String(quien || ''), en: new Date().toISOString() };
  await env.PRESENTATION_IDEAS.put(CLAVE, JSON.stringify(doc));
  return { ok: true, rev: doc.rev, doc };
}
