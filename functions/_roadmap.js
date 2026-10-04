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

export function cortar(lista, vistaBruta, desdeBruto, ahora = new Date()) {
  const vista = VISTAS.includes(vistaBruta) || vistaBruta === 'año' ? (vistaBruta === 'año' ? 'ano' : vistaBruta) : 'mes';
  const ancla = fecha(desdeBruto) || fecha(hoyMadrid(ahora));
  const inicio = inicioDe(vista, ancla);
  const fin = finDe(vista, inicio);
  const desde = iso(inicio);
  const hasta = iso(fin);
  const dentro = (Array.isArray(lista) ? lista : []).filter((h) => pisa(h, desde, hasta));
  return {
    vista,
    desde,
    hasta,
    anterior: iso(mover(vista, inicio, -1)),
    siguiente: iso(mover(vista, inicio, 1)),
    etiqueta: etiqueta(vista, inicio, fin),
    soluciones: SOLUCIONES.map((s) => ({
      id: s.id,
      nombre: s.nombre,
      claim: s.claim,
      hitos: dentro.filter((h) => h.solucion === s.id),
    })),
  };
}

function esc(v) {
  return String(v ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
}

const NOMBRE_VISTA = { dia: 'Día', semana: 'Semana', mes: 'Mes', trimestre: 'Trimestre', ano: 'Año' };

export function htmlCorte(corte) {
  const vistas = VISTAS.map((v) => {
    const actual = v === corte.vista ? ' aria-current="true"' : '';
    return `<a href="/roadmap?vista=${v}&desde=${corte.desde}"${actual}>${NOMBRE_VISTA[v]}</a>`;
  }).join('');
  const cartas = corte.soluciones.map((s) => {
    const cuerpo = s.hitos.length
      ? `<ol class="hitos">${s.hitos.map((h) => `<li class="hito"><strong>${esc(h.titulo)}</strong><span>${esc(h.inicio)} → ${esc(h.fin)}</span><span>${esc(h.estado)} · ${esc(h.responsable)}${h.cliente ? ` · ${esc(h.cliente)}` : ''}</span><cite>Fuente: ${esc(h.fuente)}</cite></li>`).join('')}</ol>`
      : '<p class="vacio">Por definir con Carlos</p>';
    return `<article class="carta" id="${esc(s.id)}" data-hitos="${s.hitos.length}"><span class="rol">${esc(s.nombre)}</span><h2>${esc(s.claim)}</h2>${cuerpo}</article>`;
  });
  const patas = cartas.slice(0, 5).join('');
  const mesa = cartas[5];
  return `<nav class="vistas" aria-label="Escala del RoadMap">${vistas}</nav><p class="periodo"><a href="/roadmap?vista=${corte.vista}&desde=${corte.anterior}" rel="prev">Anterior</a><strong>${esc(corte.etiqueta)}</strong><a href="/roadmap?vista=${corte.vista}&desde=${corte.siguiente}" rel="next">Siguiente</a></p><div class="patas">${patas}</div><div class="mesa">${mesa}</div>`;
}
