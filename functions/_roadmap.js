/**
 * Corte del RoadMap. La fuente única es data/roadmap.json.
 * vista: dia | semana | mes | trimestre | ano
 * desde: lunes de la semana, día 1 del mes o del trimestre, 1 de enero, o el propio día.
 */
import HITOS from '../data/roadmap.json' with { type: 'json' };

export const VISTAS = ['dia', 'semana', 'mes', 'trimestre', 'ano'];
export const SOLUCIONES = [
  { id: 'studio', nombre: 'admira.studio', claim: 'Creación y Adaptación de Contenidos' },
  { id: 'store', nombre: 'admira.store', claim: 'Distribución, Gestión y Visualización' },
  { id: 'tv', nombre: 'admira.tv', claim: 'Reproducción, Emisión y Proof of Play' },
  { id: 'app', nombre: 'admira.app', claim: 'Instalaciones, Mantenimiento y Gestión' },
  { id: 'biz', nombre: 'admira.biz', claim: 'Nuevos ingresos con DooH y Retail Media' },
  { id: 'admiranext', nombre: 'AdmiraNeXT', claim: 'La mesa que une las cinco patas' },
];
export const IDEAS = [
  { id: 'clientes-globales', nombre: 'Clientes globales y marca blanca' },
  { id: 'entrada-agentes', nombre: 'Entrada de agentes sin Google' },
  { id: 'modo-experto', nombre: 'Modo Experto' },
  { id: 'instalaciones-soporte', nombre: 'Instalaciones y soporte' },
  { id: 'contenidos-pixeria', nombre: 'Contenidos y Pixeria' },
  { id: 'reproduccion-pop', nombre: 'Reproducción y Proof of Play' },
  { id: 'circuitos-dooh', nombre: 'Circuitos DooH' },
  { id: 'inventario-plano', nombre: 'Inventario y plano del local' },
];
const ORDEN_CLIENTE = ['admira', 'altadis', 'starbucks', 'jti'];
const NOMBRE_CLIENTE = { admira: 'Admira', altadis: 'Altadis', starbucks: 'Starbucks', jti: 'JTI', general: 'General' };

const MES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
const DIA = 86400000;

export function hitos() {
  return HITOS;
}

function fecha(iso) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(iso || ''));
  if (!m) return null;
  const d = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
  return Number.isNaN(d.getTime()) ? null : d;
}

function iso(d) {
  return d.toISOString().slice(0, 10);
}

function sumarDias(d, n) {
  return new Date(d.getTime() + n * DIA);
}

export function hoyMadrid(ahora = new Date()) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Madrid',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(ahora);
}

function inicioDe(vista, d) {
  const y = d.getUTCFullYear();
  const m = d.getUTCMonth();
  if (vista === 'dia') return d;
  if (vista === 'semana') {
    const wd = d.getUTCDay();
    return sumarDias(d, wd === 0 ? -6 : 1 - wd);
  }
  if (vista === 'mes') return new Date(Date.UTC(y, m, 1));
  if (vista === 'trimestre') return new Date(Date.UTC(y, Math.floor(m / 3) * 3, 1));
  return new Date(Date.UTC(y, 0, 1));
}

function finDe(vista, inicio) {
  const y = inicio.getUTCFullYear();
  const m = inicio.getUTCMonth();
  if (vista === 'dia') return inicio;
  if (vista === 'semana') return sumarDias(inicio, 6);
  if (vista === 'mes') return new Date(Date.UTC(y, m + 1, 0));
  if (vista === 'trimestre') return new Date(Date.UTC(y, m + 3, 0));
  return new Date(Date.UTC(y, 11, 31));
}

function mover(vista, inicio, delta) {
  const y = inicio.getUTCFullYear();
  const m = inicio.getUTCMonth();
  if (vista === 'dia') return sumarDias(inicio, delta);
  if (vista === 'semana') return sumarDias(inicio, 7 * delta);
  if (vista === 'mes') return new Date(Date.UTC(y, m + delta, 1));
  if (vista === 'trimestre') return new Date(Date.UTC(y, m + 3 * delta, 1));
  return new Date(Date.UTC(y + delta, 0, 1));
}

export function etiqueta(vista, inicio, fin) {
  const a = inicio.getUTCDate();
  const b = fin.getUTCDate();
  const ma = MES[inicio.getUTCMonth()];
  const mb = MES[fin.getUTCMonth()];
  const y = inicio.getUTCFullYear();
  if (vista === 'dia') return `${a} de ${ma} de ${y}`;
  if (vista === 'semana') {
    if (inicio.getUTCMonth() === fin.getUTCMonth()) return `${a}–${b} de ${ma} de ${y}`;
    return `${a} de ${ma} – ${b} de ${mb} de ${y}`;
  }
  if (vista === 'mes') return `${ma} de ${y}`;
  if (vista === 'trimestre') return `T${inicio.getUTCMonth() / 3 + 1} ${y} · ${ma}–${mb}`;
  return String(y);
}

function pisa(hito, desde, hasta) {
  return hito.inicio <= hasta && hito.fin >= desde;
}

function ideaDe(hito) {
  return IDEAS.find((i) => i.nombre === hito.idea) || null;
}

function clienteDe(hito) {
  return hito.cliente || 'general';
}

export function clientesConHitos(lista) {
  const ids = new Set((Array.isArray(lista) ? lista : []).map((h) => h.cliente).filter(Boolean));
  const orden = ORDEN_CLIENTE.filter((id) => ids.has(id));
  for (const id of [...ids].sort()) if (!orden.includes(id)) orden.push(id);
  return orden;
}

function normalizarFiltros(filtros = {}) {
  const proyecto = SOLUCIONES.some((s) => s.id === filtros.proyecto) ? filtros.proyecto : 'todos';
  const conocidos = new Set([...ORDEN_CLIENTE, 'general', ...clientesConHitos(hitos())]);
  const cliente = filtros.cliente === 'general' || conocidos.has(filtros.cliente) ? filtros.cliente : 'todos';
  const idea = IDEAS.some((i) => i.id === filtros.idea) ? filtros.idea : 'todos';
  const agrupar = idea !== 'todos' ? 'idea' : (cliente !== 'todos' ? 'cliente' : 'solucion');
  return { proyecto, cliente, idea, agrupar };
}

function pasaFiltro(hito, filtros) {
  if (filtros.proyecto !== 'todos' && hito.solucion !== filtros.proyecto) return false;
  if (filtros.cliente === 'general' && hito.cliente) return false;
  if (filtros.cliente !== 'todos' && filtros.cliente !== 'general' && hito.cliente !== filtros.cliente) return false;
  if (filtros.idea !== 'todos' && ideaDe(hito)?.id !== filtros.idea) return false;
  return true;
}

function columnasDe(dentro, filtros) {
  if (filtros.agrupar === 'idea') {
    const idea = IDEAS.find((i) => i.id === filtros.idea);
    return [{ id: idea.id, nombre: idea.nombre, claim: 'Idea', hitos: dentro }];
  }
  if (filtros.agrupar === 'cliente') {
    const id = filtros.cliente;
    return [{ id, nombre: NOMBRE_CLIENTE[id] || id, claim: 'Cliente', hitos: dentro }];
  }
  return SOLUCIONES.map((s) => ({
    id: s.id,
    nombre: s.nombre,
    claim: s.claim,
    hitos: dentro.filter((h) => h.solucion === s.id),
  }));
}

export function cortar(lista, vistaBruta, desdeBruto, ahora = new Date(), filtrosBrutos = {}) {
  const vista = VISTAS.includes(vistaBruta) || vistaBruta === 'año' ? (vistaBruta === 'año' ? 'ano' : vistaBruta) : 'mes';
  const ancla = fecha(desdeBruto) || fecha(hoyMadrid(ahora));
  const inicio = inicioDe(vista, ancla);
  const fin = finDe(vista, inicio);
  const desde = iso(inicio);
  const hasta = iso(fin);
  const filtros = normalizarFiltros(filtrosBrutos);
  const dentro = (Array.isArray(lista) ? lista : []).filter((h) => pisa(h, desde, hasta) && pasaFiltro(h, filtros));
  const soluciones = SOLUCIONES.map((s) => ({
    id: s.id,
    nombre: s.nombre,
    claim: s.claim,
    hitos: dentro.filter((h) => h.solucion === s.id),
  }));
  return {
    vista,
    desde,
    hasta,
    anterior: iso(mover(vista, inicio, -1)),
    siguiente: iso(mover(vista, inicio, 1)),
    etiqueta: etiqueta(vista, inicio, fin),
    proyecto: filtros.proyecto,
    cliente: filtros.cliente,
    idea: filtros.idea,
    agrupar: filtros.agrupar,
    soluciones,
    columnas: columnasDe(dentro, filtros),
  };
}

function esc(v) {
  return String(v ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
}

const NOMBRE_VISTA = { dia: 'Día', semana: 'Semana', mes: 'Mes', trimestre: 'Trimestre', ano: 'Año' };

function enlace(corte, extra = {}) {
  const vista = extra.vista || corte.vista;
  const desde = extra.desde || corte.desde;
  const proyecto = extra.proyecto ?? corte.proyecto ?? 'todos';
  const cliente = extra.cliente ?? corte.cliente ?? 'todos';
  const idea = extra.idea ?? corte.idea ?? 'todos';
  const q = new URLSearchParams({ vista, desde });
  if (proyecto !== 'todos') q.set('proyecto', proyecto);
  if (cliente !== 'todos') q.set('cliente', cliente);
  if (idea !== 'todos') q.set('idea', idea);
  return `/roadmap?${q}`;
}

function selector(etiqueta, actual, opciones, corte, clave) {
  const links = opciones.map((op) => {
    const marcado = op.id === actual ? ' aria-current="true"' : '';
    return `<a href="${esc(enlace(corte, { [clave]: op.id }))}"${marcado}>${esc(op.nombre)}</a>`;
  }).join('');
  return `<nav class="vistas" aria-label="${esc(etiqueta)}"><span>${esc(etiqueta)}</span>${links}</nav>`;
}

export function htmlCorte(corte) {
  const vistas = VISTAS.map((v) => {
    const actual = v === corte.vista ? ' aria-current="true"' : '';
    return `<a href="${esc(enlace(corte, { vista: v, desde: corte.desde }))}"${actual}>${NOMBRE_VISTA[v]}</a>`;
  }).join('');
  const proyectos = [{ id: 'todos', nombre: 'Todos' }, ...SOLUCIONES.map((s) => ({ id: s.id, nombre: s.nombre }))];
  const clientes = [{ id: 'todos', nombre: 'Todos' }, ...clientesConHitos(hitos()).map((id) => ({ id, nombre: NOMBRE_CLIENTE[id] || id })), { id: 'general', nombre: 'General' }];
  const ideas = [{ id: 'todos', nombre: 'Todos' }, ...IDEAS];
  const filtros = [
    selector('Proyecto', corte.proyecto || 'todos', proyectos, corte, 'proyecto'),
    selector('Cliente', corte.cliente || 'todos', clientes, corte, 'cliente'),
    selector('Idea', corte.idea || 'todos', ideas, corte, 'idea'),
  ].join('');
  const grupos = corte.columnas || corte.soluciones;
  const cartas = grupos.map((s) => {
    const cuerpo = s.hitos.length
      ? `<ol class="hitos">${s.hitos.map((h) => `<li class="hito"><strong>${esc(h.titulo)}</strong><span>${esc(h.inicio)} → ${esc(h.fin)}</span><span>${esc(h.estado)} · ${esc(h.responsable)}${h.cliente ? ` · ${esc(h.cliente)}` : ' · General'} · ${esc(h.idea)}</span><cite>Fuente: ${esc(h.fuente)}</cite></li>`).join('')}</ol>`
      : '<p class="vacio">Por definir con Carlos</p>';
    return `<article class="carta" id="${esc(s.id)}" data-hitos="${s.hitos.length}"><span class="rol">${esc(s.nombre)}</span><h2>${esc(s.claim)}</h2>${cuerpo}</article>`;
  });
  const porSolucion = (corte.agrupar || 'solucion') === 'solucion';
  const patas = porSolucion ? cartas.slice(0, 5).join('') : cartas.join('');
  const mesa = porSolucion ? `<div class="mesa">${cartas[5] || ''}</div>` : '';
  const clase = porSolucion ? 'patas' : 'patas eje';
  return `${filtros}<nav class="vistas" aria-label="Escala del RoadMap">${vistas}</nav><p class="periodo"><a href="${esc(enlace(corte, { desde: corte.anterior }))}" rel="prev">Anterior</a><strong>${esc(corte.etiqueta)}</strong><a href="${esc(enlace(corte, { desde: corte.siguiente }))}" rel="next">Siguiente</a></p><div class="${clase}">${patas}</div>${mesa}`;
}
