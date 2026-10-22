/* Colores de «Trabajando ahora» para /roadmap/encargos.
 * Misma fuente que el panel de admira.live/consumos:
 * GET https://www.admira.live/api/flota/trabajando (CORS *).
 * { tarjetas: [{ agente, estado, motivo, enCurso }] }
 * estado: verde | amarillo | rojo | gris.
 * Huang y Jensen son la misma fila. */
export const TRABAJANDO_API = 'https://www.admira.live/api/flota/trabajando';

const ESTADOS = new Set(['verde', 'amarillo', 'rojo', 'gris']);

export const ETIQUETA = Object.freeze({
  verde: 'trabajando',
  amarillo: 'hace poco',
  rojo: '>1 h',
  gris: 'en espera',
});

const fold = (s) => String(s || '').normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().replace(/[^a-z]/g, '');

/** Clave para casar la tarjeta con data-persona. Huang y Jensen coinciden. */
export function claveTrabajando(raw) {
  const k = fold(raw);
  if (k === 'huang' || k === 'jensen') return 'jensen';
  return k;
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

/**
 * Trabajo visible aunque no haya misión.
 * Verde, o con Carlos (amarillo: Morfeo no está parado), o con tarea o encargo.
 */
export function trabajoDe(t) {
  if (!t || typeof t !== 'object') return { enTarea: false, textoTarea: '' };
  const tarea = plano(t.tarea);
  const encargo = plano(t.encargo);
  const estado = plano(t.estado);
  const enTarea = estado === 'verde' || estado === 'amarillo' || !!tarea || !!encargo;
  let textoTarea = tarea;
  if (encargo && !yaLoDice(tarea, encargo)) textoTarea = textoTarea ? `${textoTarea} · ${encargo}` : encargo;
  if (!textoTarea && (estado === 'verde' || estado === 'amarillo')) textoTarea = focoActual(t.foco);
  return { enTarea, textoTarea, tarea, encargo };
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
      tarea: trabajo.tarea,
      encargo: trabajo.encargo,
      textoTarea: trabajo.textoTarea,
      enTarea: trabajo.enTarea,
    };
  }
  return por;
}
