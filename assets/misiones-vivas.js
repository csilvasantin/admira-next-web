/* Misiones en vivo para /roadmap/encargos.
 * La página /misiones de admira.live lee el tablero en api.yokup.com/tickets
 * (hace falta sesión). El JSON público, el mismo de «Misiones vivas» en /flota,
 * es GET https://api.yokup.com/fleet/missions (CORS *). status=in_progress es
 * quien trabaja una misión ahora; status=open son las abiertas que aún no van
 * en curso. Persona llega como JobsGrokBot, OraculoMacMini, TrinityMBP14… */
export const MISIONES_API = 'https://api.yokup.com/fleet/missions';

const ROSTER = ['arquitecto', 'merovingio', 'persefone', 'oraculo', 'trinity', 'wozniak', 'disney', 'morfeo', 'cypher', 'seraph', 'switch', 'niobe', 'smith', 'huang', 'jensen', 'lucas', 'musk', 'jobs', 'link', 'neo'];
const ROSTER_SET = new Set(ROSTER);
/* Huang es la fila de Jensen. Musk, Elon y MuskGrokBot son solo Musk. */
const ALIAS = { musk: 'musk', elon: 'musk', elonmusk: 'musk', huang: 'jensen', jensen: 'jensen' };
/* Sufijo de máquina, del más largo al más corto. No es parte del nombre. */
const SUFIJOS = ['grokbotbox', 'macbookpro16', 'macbookpro', 'macstudio', 'macmini', 'grokbot', 'mbp16', 'mbp14', 'mbp'];

export const ESTADO_TEXTO = Object.freeze({
  pending: 'pendiente',
  ack: 'acusado',
  open: 'abierta',
  in_progress: 'en curso',
  blocked: 'bloqueado',
  done: 'hecho',
  resolved: 'finalizada',
  cancelled: 'anulada',
});

const fold = (s) => String(s || '').normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().replace(/[^a-z]/g, '');

function claveRoster(k) {
  if (!k) return '';
  if (k === 'y') return 'y';
  if (ALIAS[k]) return ALIAS[k];
  if (ROSTER_SET.has(k)) return k;
  return '';
}

/** Clave de la fila (oraculo, jensen, musk, jobs…). Vacío si no casa exacto.
 *  JobsGrokBot o TrinityMBP14 sí: el resto es un sufijo de máquina conocido.
 *  No hay prefijo suelto: MuskMerovingio no cae en Musk ni en Merovingio. */
export function personaClave(raw) {
  const k = fold(raw);
  const exacta = claveRoster(k);
  if (exacta) return exacta;
  for (const suf of SUFIJOS) {
    if (k.length > suf.length && k.endsWith(suf)) {
      const base = claveRoster(k.slice(0, -suf.length));
      if (base) return base;
    }
  }
  return '';
}

/** La misma clave, a partir del data-persona de la fila (Oráculo, Huang, Jensen). */
export function claveFila(dataPersona) {
  return personaClave(dataPersona);
}

export function consultaMisiones(estado, offset = 0) {
  const q = new URLSearchParams({ status: estado, limit: '200', offset: String(offset) });
  return `${MISIONES_API}?${q}`;
}

/** Epoch en milisegundos. Segundos por debajo de 2100-01-01; si no, ya son ms. */
export function epochMs(valor) {
  if (valor == null || valor === '') return 0;
  if (typeof valor === 'string' && !/^\d+(\.\d+)?$/.test(valor.trim())) {
    const t = Date.parse(valor);
    return Number.isFinite(t) && t > 0 ? t : 0;
  }
  const n = Number(valor);
  if (!Number.isFinite(n) || n <= 0) return 0;
  return n > 4102444800 ? n : n * 1000;
}

function inicioPaso(paso) {
  if (!paso || typeof paso !== 'object') return 0;
  return epochMs(paso.started_at || paso.startedAt || paso.inicio) || epochMs(paso.created_at || paso.createdAt);
}

/** Arranque de la misión: el paso in_progress (started_at o created_at) o, si no, la misión. */
export function inicioMision(m) {
  if (!m || typeof m !== 'object') return 0;
  const pasos = Array.isArray(m.tasks) ? m.tasks : (Array.isArray(m.steps) ? m.steps : []);
  let mejor = 0;
  for (const paso of pasos) {
    if (String(paso && (paso.status || paso.estado) || '') !== 'in_progress') continue;
    const t = inicioPaso(paso);
    if (t && (!mejor || t < mejor)) mejor = t;
  }
  if (mejor) return mejor;
  return epochMs(m.started_at || m.startedAt || m.inicio) || epochMs(m.created_at || m.createdAt);
}

export function fechaMadrid(valor) {
  const n = Number(valor);
  const ms = n > 4102444800 ? n : n * 1000;
  if (!Number.isFinite(ms) || ms <= 0) return '';
  const d = new Date(ms);
  const dia = new Intl.DateTimeFormat('es-ES', { timeZone: 'Europe/Madrid', day: 'numeric', month: 'short', year: 'numeric' }).format(d).replace(/\s+de\s+/g, '-').replace(/\./g, '').replace(/\s+/g, '-');
  const hora = new Intl.DateTimeFormat('es-ES', { timeZone: 'Europe/Madrid', hour: '2-digit', minute: '2-digit', hour12: false }).format(d);
  return `${dia} a las ${hora}`;
}

function numeroDe(m) {
  const visible = String(m.display_ref || '').trim();
  if (visible) return visible;
  return String(m.id || '').trim();
}

/** Una misión del JSON, o null si no se puede colgar de una fila. */
export function normalizarMision(m) {
  if (!m || typeof m !== 'object') return null;
  const clave = personaClave(m.persona || m.assignee || '');
  if (!clave) return null;
  const estado = String(m.status || '').trim();
  if (!estado) return null;
  const titulo = String(m.subject || m.title || '').trim();
  if (!titulo) return null;
  const numero = numeroDe(m);
  if (!numero) return null;
  const id = String(m.id || numero);
  return { id, clave, numero, titulo, estado, desde: fechaMadrid(m.created_at), inicio: inicioMision(m), enCurso: estado === 'in_progress' };
}

/** Agrupa por persona. En curso primero; si no, la más reciente. */
export function agruparMisiones(lista) {
  const por = {};
  const vistas = new Set();
  for (const cruda of lista || []) {
    const m = normalizarMision(cruda);
    if (!m || vistas.has(m.id)) continue;
    vistas.add(m.id);
    (por[m.clave] || (por[m.clave] = [])).push(m);
  }
  for (const clave of Object.keys(por)) {
    por[clave].sort((a, b) => Number(b.enCurso) - Number(a.enCurso) || String(b.desde).localeCompare(String(a.desde), 'es'));
  }
  return por;
}

export function clavesEnCurso(por) {
  return Object.keys(por).filter((k) => por[k].some((m) => m.enCurso));
}

/** Abiertas de verdad: open, en curso, pendientes, acusadas o bloqueadas. Las cerradas no. */
const CUENTA_ABIERTOS = new Set(['open', 'pending', 'ack', 'in_progress', 'blocked']);

export function cuentaAbiertos(lista) {
  return (lista || []).filter((m) => m && CUENTA_ABIERTOS.has(m.estado)).length;
}

/** Las que no van en curso y aun así cuentan (status open y el resto no cerrado). */
export function misionesSinCurso(lista) {
  return (lista || []).filter((m) => m && !m.enCurso && CUENTA_ABIERTOS.has(m.estado));
}
