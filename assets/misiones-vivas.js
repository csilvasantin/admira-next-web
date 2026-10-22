/* Misiones en vivo para /roadmap/encargos.
 * La página /misiones de admira.live lee el tablero en api.yokup.com/tickets
 * (hace falta sesión). El JSON público, el mismo de «Misiones vivas» en /flota,
 * es GET https://api.yokup.com/fleet/missions (CORS *). status=in_progress es
 * quien trabaja una misión ahora; status=open son las abiertas que aún no van
 * en curso. Persona llega como JobsGrokBot, OraculoMacMini, TrinityMBP14… */
export const MISIONES_API = 'https://api.yokup.com/fleet/missions';

const ROSTER = ['arquitecto', 'merovingio', 'persefone', 'oraculo', 'trinity', 'wozniak', 'disney', 'morfeo', 'cypher', 'seraph', 'switch', 'niobe', 'smith', 'huang', 'jensen', 'lucas', 'musk', 'jobs', 'link', 'neo'];

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

/** Clave de la fila (oraculo, huang, jobs…). Vacío si no es alguien de la tabla. */
export function personaClave(raw) {
  const k = fold(raw);
  if (k === 'y') return 'y';
  let best = '';
  for (const n of ROSTER) {
    if ((k === n || k.startsWith(n)) && n.length > best.length) best = n;
  }
  if (best === 'jensen') return 'huang';
  return best;
}

/** La misma clave, a partir del data-persona de la fila (Oráculo, Huang, Jensen). */
export function claveFila(dataPersona) {
  return personaClave(dataPersona);
}

export function consultaMisiones(estado, offset = 0) {
  const q = new URLSearchParams({ status: estado, limit: '200', offset: String(offset) });
  return `${MISIONES_API}?${q}`;
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
  return { id, clave, numero, titulo, estado, desde: fechaMadrid(m.created_at), enCurso: estado === 'in_progress' };
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
