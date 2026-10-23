/* Colores de «Trabajando ahora» para /roadmap/encargos.
 * Misma fuente que el panel de admira.live/consumos:
 * GET https://www.admira.live/api/flota/trabajando (CORS *).
 * { tarjetas: [{ agente, estado, motivo, enCurso }] }
 * estado: verde | amarillo | rojo | gris.
 * Huang y Jensen son la misma fila. Musk, Elon y MuskGrokBot son solo Musk.
 * Una misión (FLT-…) se pinta en una sola persona: la de Misiones. */
import { epochMs, fechaMadrid, personaClave } from './misiones-vivas.js';

export const TRABAJANDO_API = 'https://www.admira.live/api/flota/trabajando';

const ESTADOS = new Set(['verde', 'amarillo', 'rojo', 'gris']);

export const ETIQUETA = Object.freeze({
  verde: 'trabajando',
  amarillo: 'desde HH:MM',
  rojo: '>1 h',
  gris: 'idle',
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

function partesMadrid(ms) {
  const o = {};
  for (const p of new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/Madrid',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(new Date(ms))) o[p.type] = p.value;
  return o;
}

/** Última actividad, no el arranque. ultimaActividad, si no el hasta del latido, si no haceS. */
export function ultimaActividadMs(t, ahora = Date.now()) {
  if (!t || typeof t !== 'object') return 0;
  const directa = epochMs(t.ultimaActividad || t.ultima_actividad);
  if (directa) return directa;
  const latido = t.latidoConsejero || t.latido;
  if (latido && typeof latido === 'object') {
    const h = epochMs(latido.hasta || latido.ultima || latido.updated_at);
    if (h) return h;
  }
  const hace = Number(t.haceS);
  if (Number.isFinite(hace) && hace >= 0 && Number.isFinite(Number(ahora))) return Number(ahora) - hace * 1000;
  return 0;
}

/** «desde HH:MM» en Madrid. Otro día: «desde DD/MM HH:MM». */
export function formatoDesde(ms, ahora = Date.now()) {
  const n = Number(ms);
  if (!Number.isFinite(n) || n <= 0) return 'desde —';
  const a = partesMadrid(n);
  const b = partesMadrid(ahora);
  const hora = `${a.hour}:${a.minute}`;
  if (a.year === b.year && a.month === b.month && a.day === b.day) return `desde ${hora}`;
  return `desde ${a.day}/${a.month} ${hora}`;
}

/** Tiempo sin actividad: «idle · 12 min» o «idle · 2 h 05 min». Sin marca: «idle». */
export function formatoIdle(ms, ahora = Date.now()) {
  const n = Number(ms);
  if (!Number.isFinite(n) || n <= 0) return 'idle';
  let min = Math.floor((Number(ahora) - n) / 60000);
  if (!Number.isFinite(min) || min < 0) min = 0;
  if (min < 60) return `idle · ${min} min`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return `idle · ${h} h ${String(m).padStart(2, '0')} min`;
}

/** Hay que repetir yokup_presencia trabajando:true cada 60 s. Pasado esto, ya no cuenta. */
export const PRESENCIA_FRESCURA_S = 90;

/**
 * Trabajando declarado, aunque admira.live lo pinte gris o amarillo.
 * Vale el motivo que cita el latido, o la presencia reducida (verified no importa:
 * un consejero sale declared_surface / verified:0 y aun así está trabajando).
 */
export function latidoDeclaradoTrabajando(tarjeta) {
  if (!tarjeta || typeof tarjeta !== 'object') return false;
  const hace = Number(tarjeta.haceS);
  const fresco = Number.isFinite(hace) && hace >= 0 && hace <= PRESENCIA_FRESCURA_S;
  if (!fresco) return false;
  if (tarjeta.presenciaTrabajando === true) return true;
  return /latido\s*[«"“']trabajando[»"”']/i.test(String(tarjeta.motivo || ''));
}

/** Copia la tarjeta con el latido fresco de /roadmap/presencia. Sin presencia, la tarjeta igual. */
export function conPresencia(tarjeta, p) {
  if (!tarjeta || !p || p.mode !== 'trabajando') return tarjeta;
  const age = Number(p.ageS);
  if (!Number.isFinite(age) || age < 0 || age > PRESENCIA_FRESCURA_S) return tarjeta;
  return {
    ...tarjeta,
    haceS: age,
    presenciaTrabajando: true,
    proyecto: p.proyecto || tarjeta.proyecto || '',
    focoPresencia: String(p.foco || ''),
    tareaPresencia: String(p.tarea || ''),
    encargoPresencia: String(p.encargo || ''),
    sincePresencia: Number(p.sinceMs) || 0,
  };
}

/** Número de encargo o de misión (4 a 6 cifras). «Hoy #25» y «PR #252» no cuentan. */
export function numeroDeTrabajo(...fuentes) {
  const lista = fuentes.flat ? fuentes.flat() : fuentes;
  for (const raw of lista) {
    const m = String(raw || '').match(/\b(?:encargo|misi[oó]n)\s*#?\s*(\d{4,6})\b/i);
    if (m) return m[1];
  }
  for (const raw of lista) {
    const s = String(raw || '').trim();
    if (/^#?\d{4,6}$/.test(s)) return s.replace(/^#/, '');
  }
  return '';
}

/** Título corto. Si abre con «comillas», se queda la frase de dentro. */
export function tituloCorto(titulo) {
  const t = resumenTitulo(titulo);
  const q = t.match(/«([^»]{2,80})»/);
  return q ? q[1].trim() : t;
}

/** «desde HH:MM» en Madrid, también si el arranque es de otro día. */
export function horaDesde(ms) {
  const n = Number(ms);
  if (!Number.isFinite(n) || n <= 0) return '';
  const a = partesMadrid(n);
  if (!a.hour) return '';
  return `desde ${a.hour}:${a.minute}`;
}

/** Minutos desde el arranque: «27 min» o «2 h 05 min». */
export function textoDuracion(ms, ahora = Date.now()) {
  const n = Number(ms);
  if (!Number.isFinite(n) || n <= 0) return '';
  let min = Math.floor((Number(ahora) - n) / 60000);
  if (!Number.isFinite(min) || min < 0) min = 0;
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return `${h} h ${String(m).padStart(2, '0')} min`;
}

/** «#7088 En antena ahora · desde 07:19 · 27 min». Nunca «TAREA» ni «hace poco». */
export function textoPildora({ numero = '', titulo = '', inicio = 0, ahora = Date.now() } = {}) {
  const partes = [];
  const num = String(numero || '').replace(/^#/, '').trim();
  const corto = tituloCorto(titulo);
  if (num && corto) partes.push(`#${num} ${corto}`);
  else if (num) partes.push(`#${num}`);
  else if (corto) partes.push(corto);
  const desde = horaDesde(inicio);
  if (desde) partes.push(desde);
  const dur = textoDuracion(inicio, ahora);
  if (dur) partes.push(dur);
  return partes.join(' · ');
}

const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

/** «23-oct-2026 07:19» en Madrid. */
export function fechaEmpezo(ms) {
  const n = Number(ms);
  if (!Number.isFinite(n) || n <= 0) return '';
  const a = partesMadrid(n);
  const mes = MESES[Number(a.month) - 1];
  if (!mes || !a.day) return '';
  return `${Number(a.day)}-${mes}-${a.year} ${a.hour}:${a.minute}`;
}

/** «Empezó: 23-oct-2026 07:19 · Misión #7088: título · Proyecto admira-tv». */
export function tooltipPildora({ numero = '', titulo = '', inicio = 0, proyecto = '' } = {}) {
  const partes = [];
  const cuando = fechaEmpezo(inicio);
  if (cuando) partes.push(`Empezó: ${cuando}`);
  const num = String(numero || '').replace(/^#/, '').trim();
  const full = String(titulo || '').replace(/\s+/g, ' ').trim();
  if (num && full) partes.push(`Misión #${num}: ${full}`);
  else if (num) partes.push(`Misión #${num}`);
  else if (full) partes.push(`Misión: ${full}`);
  const proy = String(proyecto || '').trim();
  if (proy) partes.push(`Proyecto ${proy}`);
  return partes.join(' · ');
}

/** Trabaja de verdad: misión en curso, latido fresco, o verde con tarea o encargo propios. */
export function estaOcupado(misionEnCurso, tarjeta) {
  if (misionEnCurso) return true;
  if (latidoDeclaradoTrabajando(tarjeta)) return true;
  if (!tarjeta) return false;
  return tarjeta.estado === 'verde' && !!(tarjeta.tarea || tarjeta.encargo);
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

/** Misión in_progress, o un latido «trabajando» fresco, pintan verde aunque la tarjeta venga gris. */
export function estadoVisible(tarjeta, mision) {
  if (latidoDeclaradoTrabajando(tarjeta)) {
    const base = tarjeta || {};
    return { ...base, estado: 'verde', etiqueta: ETIQUETA.verde, motivo: base.motivo || '' };
  }
  if (mision && (!tarjeta || tarjeta.estado === 'gris')) {
    const base = tarjeta || {};
    return { ...base, estado: 'verde', etiqueta: ETIQUETA.verde, motivo: base.motivo || '' };
  }
  return tarjeta;
}

const PALABRAS_MAX = 6;
const COLA = new Set(['de', 'del', 'al', 'a', 'en', 'y', 'e', 'o', 'u', 'con', 'por', 'para', 'el', 'la', 'los', 'las', 'un', 'una', 'que', 'su', 'sus']);

function palabrasDe(s) {
  return String(s || '').split(/\s+/).filter(Boolean);
}

function tokenPalabra(w) {
  return String(w || '').replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, '').toLowerCase();
}

/** Primera cláusula con cuerpo, como máximo 6 palabras, cortada en un espacio. */
function recortaPalabras(s) {
  const ws = palabrasDe(s).slice(0, PALABRAS_MAX);
  while (ws.length > 1 && COLA.has(tokenPalabra(ws[ws.length - 1]))) ws.pop();
  return ws.join(' ').replace(/[….]+$/g, '').trim();
}

/**
 * Título corto del chip: de qué va la misión o la tarea.
 * Quita FLT-xxxxxx y el número de encargo. 3 a 6 palabras si el título da para tanto,
 * siempre en un límite de palabra. El título entero se queda para el tooltip.
 */
export function resumenTitulo(titulo) {
  let t = String(titulo || '').replace(/\s+/g, ' ').trim();
  if (!t) return '';
  t = t.replace(/\bFLT-\d+\b/gi, ' ');
  t = t.replace(/\bencargos?\s*#?\s*\d+\b/gi, ' ');
  t = t.replace(/#\d+\b/g, ' ');
  t = t.replace(/\([^)]*\)/g, ' ');
  t = t.replace(/\s+/g, ' ').trim();
  t = t.replace(/^[\s·|:;,\-–—()]+|[\s·|:;,\-–—()]+$/g, '').trim();
  if (!t) return '';
  const trozos = t.split(/\s*(?:[·:;]|\.(?:\s|$)|\s[a-c]\)\s*)\s*/i)
    .map((c) => c.replace(/^[\s·|:;,\-–—()]+|[\s·|:;,\-–—()]+$/g, '').trim())
    .filter(Boolean);
  for (const c of trozos) {
    if (palabrasDe(c).length >= 3) return recortaPalabras(c);
  }
  return recortaPalabras(trozos.join(' '));
}

/** Tooltip del chip: código FLT, número de encargo, título entero y hora de inicio. */
export function tooltipChip({ id = '', numero = '', titulo = '', inicio = 0 } = {}) {
  const partes = [];
  const visto = new Set();
  const push = (s) => {
    const t = String(s || '').replace(/\s+/g, ' ').trim();
    if (!t) return;
    const k = t.toLowerCase();
    if (visto.has(k)) return;
    visto.add(k);
    partes.push(t);
  };
  for (const fuente of [id, numero, titulo]) {
    for (const m of String(fuente || '').matchAll(/\bFLT-\d+\b/gi)) push(m[0].toUpperCase());
  }
  const num = String(numero || '').trim();
  if (num && !/^FLT-\d+$/i.test(num)) push(num);
  const tituloLimpio = String(titulo || '').replace(/\s+/g, ' ').trim();
  if (tituloLimpio && resumenTitulo(tituloLimpio)) push(tituloLimpio);
  else {
    for (const m of tituloLimpio.matchAll(/\bencargos?\s+#?\d+\b|#\d+\b/gi)) push(m[0].replace(/\s+/g, ' '));
  }
  if (Number(inicio) > 0) push(fechaMadrid(inicio));
  return partes.join(' · ');
}

/** Misión en curso gana. Si no, las abiertas. Si no, la tarea. */
export function chipDe(mision, tarjeta, abiertas = 0) {
  if (mision) return { tipo: 'mision', texto: '' };
  const n = Number(abiertas) || 0;
  if (n > 0) return { tipo: 'abierta', texto: '' };
  if (tarjeta && tarjeta.enTarea) return { tipo: 'tarea', texto: tarjeta.textoTarea || '' };
  return { tipo: '', texto: '' };
}

/** Personas, no encargos: cada fila cuenta una vez. */
export function contarEnCurso(filas) {
  let misiones = 0;
  let tareas = 0;
  for (const f of filas || []) {
    const c = chipDe(f && f.mision, f && f.tarjeta, f && f.abiertas);
    if (c.tipo === 'mision' || c.tipo === 'abierta') misiones += 1;
    else if (c.tipo === 'tarea') tareas += 1;
  }
  return { total: misiones + tareas, misiones, tareas };
}

/** Mapa clave → tarjeta. Ignora tarjetas sin estado conocido. */
export function normalizarTarjetas(data, ahora = Date.now()) {
  const tarjetas = data && Array.isArray(data.tarjetas) ? data.tarjetas : [];
  const por = {};
  for (const t of tarjetas) {
    if (!t || typeof t !== 'object') continue;
    const clave = claveTrabajando(t.agente);
    const estado = String(t.estado || '').trim();
    if (!clave || !ESTADOS.has(estado)) continue;
    const trabajo = trabajoDe(t);
    const actividad = ultimaActividadMs(t, ahora);
    por[clave] = {
      clave,
      agente: String(t.agente || ''),
      estado,
      actividad,
      etiqueta: estado === 'amarillo' ? formatoDesde(actividad, ahora) : ETIQUETA[estado],
      motivo: String(t.motivo || '').trim(),
      haceS: Number.isFinite(Number(t.haceS)) ? Number(t.haceS) : null,
      proyecto: String(t.proyecto || '').trim(),
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
