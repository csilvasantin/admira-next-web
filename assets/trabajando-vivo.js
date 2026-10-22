/* Colores de «Trabajando ahora» para /roadmap/encargos.
 * Misma fuente que el panel de admira.live/consumos:
 * GET https://www.admira.live/api/flota/trabajando (CORS *).
 * { tarjetas: [{ agente, estado, motivo, enCurso }] }
 * estado: verde | amarillo | rojo | gris.
 * Huang y Jensen son la misma fila. Musk, Elon y MuskGrokBot son solo Musk.
 * Una misión (FLT-…) se pinta en una sola persona: la de Misiones. */
import { epochMs, personaClave } from './misiones-vivas.js';

export const TRABAJANDO_API = 'https://www.admira.live/api/flota/trabajando';

const ESTADOS = new Set(['verde', 'amarillo', 'rojo', 'gris']);

export const ETIQUETA = Object.freeze({
  verde: 'trabajando',
  amarillo: 'hace poco',
  rojo: '>1 h',
  gris: 'en espera',
});

const fold = (s) => String(s || '').normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().replace(/[^a-z]/g, '');

/** Clave para casar la tarjeta con data-persona. Sin prefijo suelto. */
export function claveTrabajando(raw) {
  const mapped = personaClave(raw);
  if (mapped) return mapped;
  const k = fold(raw);
  return k || '';
}

const plano = (v) => (v == null ? '' : String(v).trim());

/** Proyecto en el que trabaja ahora. El foco por defecto o de training no es una tarea. */
function focoActual(foco) {
  if (!foco) return '';
  if (typeof foco === 'string') return foco.trim();
  if (typeof foco !== 'object' || foco.defecto || foco.fuente === 'defecto' || foco.fuente === 'training') return '';
  return plano(foco.proyecto);
}

function yaLoDice(tarea, encargo) {
  if (!tarea || !encargo) return false;
  if (tarea.includes(encargo)) return true;
  const num = encargo.replace(/^#/, '');
  return num.length > 1 && tarea.includes(num);
}

/** La tarea o el encargo ya están cerrados. «HECHO:» no es trabajo en curso. */
export function esHecho(texto) {
  return /\bhecho\b/i.test(String(texto || ''));
}

const ESTADOS_CERRADOS = new Set(['done', 'resolved', 'cancelled', 'hecho', 'finalizada', 'anulada']);

export function tokenDe(valor) {
  return String(valor || '').trim().toLowerCase().replace(/[^a-z0-9]/g, '');
}

/** id de misión → persona. Las cerradas no tienen dueño activo. */
export function duenoPorMision(por) {
  const dueno = {};
  const cerradas = {};
  for (const clave of Object.keys(por || {})) {
    for (const m of por[clave] || []) {
      const token = tokenDe(m && m.id);
      if (!token) continue;
      if (ESTADOS_CERRADOS.has(m.estado)) cerradas[token] = true;
      else if (!dueno[token]) dueno[token] = clave;
    }
  }
  return { dueno, cerradas };
}

/**
 * Trabajo visible aunque no haya misión.
 * Verde, o con Carlos (amarillo: Morfeo no está parado), o con tarea o encargo.
 */
export function trabajoDe(t) {
  if (!t || typeof t !== 'object') return { enTarea: false, textoTarea: '', tarea: '', encargo: '' };
  let tarea = plano(t.tarea);
  let encargo = plano(t.encargo);
  const estado = plano(t.estado);
  if (esHecho(tarea)) {
    if (encargo && yaLoDice(tarea, encargo)) encargo = '';
    tarea = '';
  }
  if (esHecho(encargo) || t.encargoCerrado) encargo = '';
  const enTarea = estado === 'verde' || estado === 'amarillo' || !!tarea || !!encargo;
  let textoTarea = tarea;
  if (encargo && !yaLoDice(tarea, encargo)) textoTarea = textoTarea ? `${textoTarea} · ${encargo}` : encargo;
  if (!textoTarea && (estado === 'verde' || estado === 'amarillo')) textoTarea = focoActual(t.foco);
  return { enTarea, textoTarea, tarea, encargo };
}

/** Quita de esta fila una misión que es de otra persona o que ya está cerrada. */
export function tarjetaPara(clave, tarjeta, indice) {
  if (!tarjeta) return null;
  const dueno = (indice && indice.dueno) || {};
  const cerradas = (indice && indice.cerradas) || {};
  let tarea = tarjeta.tarea || '';
  let encargo = tarjeta.encargo || '';
  const token = tokenDe(encargo);
  const ajena = token && dueno[token] && dueno[token] !== clave;
  const cerrada = token && cerradas[token];
  if (ajena || cerrada) {
    if (tarea && yaLoDice(tarea, encargo)) tarea = '';
    encargo = '';
  }
  const trabajo = trabajoDe({
    tarea,
    encargo,
    estado: tarjeta.estado,
    foco: tarjeta.foco ? { proyecto: tarjeta.foco, fuente: 'ahora' } : null,
    encargoCerrado: !!cerrada,
  });
  return { ...tarjeta, ...trabajo };
}

/** Arranque que traiga Trabajando ahora. La última actividad no es un inicio. */
export function inicioTarea(t) {
  if (!t || typeof t !== 'object') return 0;
  const directo = epochMs(t.started_at || t.startedAt || t.inicio || t.desde || t.start);
  if (directo) return directo;
  const latido = t.latidoConsejero || t.latido;
  if (latido && typeof latido === 'object') {
    const d = epochMs(latido.desde || latido.started_at || latido.inicio);
    if (d) return d;
  }
  const foco = t.foco;
  if (foco && typeof foco === 'object' && !foco.defecto && foco.fuente !== 'defecto' && foco.fuente !== 'training') {
    const a = epochMs(foco.actualizado || foco.inicio || foco.desde);
    if (a) return a;
  }
  return 0;
}

/** Bajo una hora, mm:ss. A partir de una hora, h:mm:ss. */
export function formatoReloj(inicioMs, ahoraMs) {
  let s = Math.floor((Number(ahoraMs) - Number(inicioMs)) / 1000);
  if (!Number.isFinite(s) || s < 0) s = 0;
  const hh = Math.floor(s / 3600);
  const mm = Math.floor((s % 3600) / 60);
  const ss = s % 60;
  const p = (n) => String(n).padStart(2, '0');
  if (hh >= 1) return `${hh}:${p(mm)}:${p(ss)}`;
  return `${p(mm)}:${p(ss)}`;
}

/** Quien tiene una misión in_progress está trabajando, aunque la tarjeta venga gris. */
export function estadoVisible(tarjeta, mision) {
  if (mision && (!tarjeta || tarjeta.estado === 'gris')) {
    const base = tarjeta || {};
    return { ...base, estado: 'verde', etiqueta: ETIQUETA.verde, motivo: base.motivo || '' };
  }
  return tarjeta;
}

/** Misión en curso gana. Si no, la tarea. Si no, nada. */
export function chipDe(mision, tarjeta) {
  if (mision) return { tipo: 'mision', texto: '' };
  if (tarjeta && tarjeta.enTarea) return { tipo: 'tarea', texto: tarjeta.textoTarea || '' };
  return { tipo: '', texto: '' };
}

/** Personas, no encargos: cada fila cuenta una vez. */
export function contarEnCurso(filas) {
  let misiones = 0;
  let tareas = 0;
  for (const f of filas || []) {
    const c = chipDe(f && f.mision, f && f.tarjeta);
    if (c.tipo === 'mision') misiones += 1;
    else if (c.tipo === 'tarea') tareas += 1;
  }
  return { total: misiones + tareas, misiones, tareas };
}

/** Mapa clave → tarjeta. Ignora tarjetas sin estado conocido. */
export function normalizarTarjetas(data) {
  const tarjetas = data && Array.isArray(data.tarjetas) ? data.tarjetas : [];
  const por = {};
  for (const t of tarjetas) {
    if (!t || typeof t !== 'object') continue;
    const clave = claveTrabajando(t.agente);
    const estado = String(t.estado || '').trim();
    if (!clave || !ESTADOS.has(estado)) continue;
    const trabajo = trabajoDe(t);
    por[clave] = {
      clave,
      agente: String(t.agente || ''),
      estado,
      etiqueta: ETIQUETA[estado],
      motivo: String(t.motivo || '').trim(),
      foco: focoActual(t.foco),
      tarea: trabajo.tarea,
      encargo: trabajo.encargo,
      textoTarea: trabajo.textoTarea,
      enTarea: trabajo.enTarea,
      inicio: inicioTarea(t),
    };
  }
  return por;
}
