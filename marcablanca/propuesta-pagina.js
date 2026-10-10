/*!
 * propuesta-pagina.js · página /marcablanca/propuesta/<id> (SubMorfeoMacMini, 02-10-2026 · FLT-101369 a).
 * PRIVADA: los datos (estudio incluido) solo los da GET /presentaciones/api/propuesta?id=<id>, detrás de
 * la puerta del generador. Esta página es el armazón: sin sesión, explica cómo entrar y no enseña nada.
 * Pinta el estudio (con fuentes, confianza y hecho/hipótesis), la marca, la presentación y las 4
 * soluciones con su maqueta vestida (maquetas.js + el cargador marcablanca.js) y su enlace ?marca=<id>.
 */
import {pintar} from '/marcablanca/maquetas.js?v=20261002-propuesta';

const $ = (id) => document.getElementById(id);
const esc = (v) => String(v == null ? '' : v).replace(/[&<>"']/g, (c) => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'}[c]));
const SOLUCIONES = [
  {k: 'studio', maqueta: 'studio', foco: 'Creación y adaptación de contenidos'},
  {k: 'store', maqueta: 'store', foco: 'Distribución y gemelo del punto de venta'},
  {k: 'tv', maqueta: 'tv', foco: 'Emisión y proof of play'},
  {k: 'app', maqueta: 'yokup', foco: 'Instalaciones y mantenimiento'},
  {k: 'biz', maqueta: 'app', foco: 'DooH y Retail Media'}
];

function idDeLaRuta() {
  const q = new URLSearchParams(location.search).get('id');
  const m = location.pathname.match(/\/marcablanca\/propuesta\/([a-z0-9][a-z0-9-]{0,40})\/?$/);
  const id = (q || (m && m[1]) || '').toLowerCase();
  return /^[a-z0-9][a-z0-9-]{0,40}$/.test(id) ? id : '';
}

function afirmacion(titulo, a) {
  if (!a || !a.texto) return '';
  const fuente = a.tipo === 'hecho' && a.fuente ? ` · <a href="${esc(a.fuente)}" target="_blank" rel="noopener noreferrer">fuente</a>` : '';
  return `<div class="pp-dato"><h3>${esc(titulo)}</h3><p>${esc(a.texto)}</p><span class="pp-tipo pp-tipo--${a.tipo === 'hecho' ? 'hecho' : 'hipotesis'}">${a.tipo === 'hecho' ? 'hecho' : 'hipótesis'}</span>${fuente}</div>`;
}
function lista(items) {
  return items && items.length ? `<ul class="pp-lista">${items.map((a) => `<li>${esc(a.texto)} <span class="pp-tipo pp-tipo--${a.tipo === 'hecho' ? 'hecho' : 'hipotesis'}">${a.tipo === 'hecho' ? 'hecho' : 'hipótesis'}</span></li>`).join('')}</ul>` : '<p class="pp-nota">No consta en las fuentes.</p>';
}

function privada(estado) {
  $('ppCabecera').innerHTML = '<h1>Propuesta privada</h1>';
  $('ppTerm').textContent = estado === 404 ? 'no encontrada' : 'acceso requerido';
  $('ppCuerpo').innerHTML = estado === 404
    ? '<div class="pp-privada"><p>No existe esa propuesta. Lánzala desde <a href="/marcablanca/#lanzar">/marcablanca · Lanzar propuesta</a> o desde el generador.</p></div>'
    : '<div class="pp-privada"><p>El estudio de la compañía y la propuesta son <b>privados</b>: hace falta la sesión del <a href="/presentaciones/" target="_blank" rel="noopener">generador de presentaciones</a> (cuenta autorizada). Entra allí y vuelve a abrir esta página.</p></div>';
}

async function pintarMaquetas(id) {
  const MB = window.MarcaBlanca;
  if (!MB) return;
  await Promise.all(SOLUCIONES.map(async (s) => {
    const nodo = document.querySelector(`[data-pp-mk="${s.k}"]`);
    if (!nodo) return;
    try {
      const m = await MB.cargar(id);
      nodo.innerHTML = `<div class="mk"><div class="mk-scope">${pintar(s.maqueta, m)}</div></div>`;
      await MB.aplicar(id, {objetivo: nodo.querySelector('.mk-scope'), plataforma: s.maqueta, modo: 'marca'});
    } catch (_) { nodo.innerHTML = '<p class="pp-nota" style="padding:14px">No se pudo pintar la maqueta.</p>'; }
  }));
}

function pintarPropuesta(p) {
  const m = p.marca || {};
  const c = m.colores || {};
  const est = p.estudio || {};
  const d = est.datos || {};
  const pres = p.presentacion || {};
  const plat = p.plataforma || {};
  document.title = `Propuesta · ${m.nombre || p.id} · AdmiraNeXT`;
  $('ppTerm').textContent = p.estado === 'lista' ? 'ok' : p.estado;
  const logo = m.logo ? `<img src="${esc(m.logo)}" alt="Logo de ${esc(m.nombre)}">` : `<b>${esc(m.nombre)}</b>`;
  const casa = m.homonimaDe === 'admira'
    ? `<p class="pp-nota"><b>Marca corporativa de ${esc(new URL(m.web || 'https://admira.com').hostname.replace(/^www\./, ''))}</b> (id <code>${esc(m.id)}</code>), distinta de <code>admira</code>, la marca por defecto de la plataforma (Galaxia Admira). Editar esta no cambia la marca por defecto.</p>` : '';
  $('ppCabecera').innerHTML = `<div class="pp-cab"><span class="pp-logo" style="background:${esc(c.fondo || '#fff')};color:${esc(c.texto || '#111')}">${logo}</span>
    <div><h1>${esc(m.nombre || p.id)}</h1>
    <div class="pp-chips"><span class="pp-chip ${p.estado === 'lista' ? 'pp-chip--ok' : 'pp-chip--aviso'}">${esc(p.estado)}</span>
      <span class="pp-chip">estudio ${esc(est.estado || '—')} · confianza ${esc(d.confianza || 'baja')}</span>
      ${m.pendienteLogo ? '<span class="pp-chip pp-chip--aviso">pendiente de logo</span>' : ''}
      ${m.webDeducida ? '<span class="pp-chip pp-chip--aviso">web deducida: confírmala</span>' : ''}
      ${m.homonimaDe === 'admira' ? '<span class="pp-chip pp-chip--casa">marca corporativa admira.com</span>' : ''}
      <span class="pp-chip">${esc(p.creadaPor?.nombre || '')} · ${esc((p.creadaEn || '').slice(0, 10))}</span></div></div></div>
    <p class="pp-nota">${esc(m.aviso || '')}</p>${casa}`;

  const fuentes = (est.fuentes || []).map((f) => `<li><a href="${esc(f.url)}" target="_blank" rel="noopener noreferrer">${esc(f.titulo || f.url)}</a> <small>· ${esc(f.tipo)}</small></li>`).join('');
  const pendiente = est.estado !== 'completo' ? `<p class="pp-nota"><b>Estudio pendiente</b>${est.motivo ? `: ${esc(est.motivo)}` : ''}. Lo que sigue es genérico, no un estudio de la compañía. Vuelve a lanzar la propuesta para reintentarlo.</p>` : '';
  const sols = SOLUCIONES.map((s) => {
    const x = plat[s.k] || {};
    const op = d.oportunidades?.[s.k] || {};
    return `<article class="pp-sol" data-solucion="${s.k}"><header><b>${esc(x.nombre || s.k)} <i>${esc(x.verbo || '')}</i></b><small>${esc(s.foco)}</small></header>
      <p class="pp-op"><b>${esc(op.titulo || '')}</b> ${esc(op.detalle || '')}${op.basadoEn ? ` <em>(${esc(op.basadoEn)})</em>` : ''}</p>
      <div class="pp-mini" data-pp-mk="${s.k}" aria-label="Maqueta de ${esc(x.nombre || s.k)} con la marca"></div>
      <footer><a class="pa-btn pa-btn--lleno" href="${esc(x.url)}" target="_blank" rel="noopener">${esc((x.url || '').replace(/^https:\/\/(www\.)?/, '').replace(/\/\?.*/, ''))} ↗</a>${x.alternativa ? `<a class="pa-btn" href="${esc(x.alternativa)}" target="_blank" rel="noopener">${esc(x.alternativa.replace(/^https:\/\/(www\.)?/, '').replace(/\/\?.*/, ''))} ↗</a>` : ''}</footer></article>`;
  }).join('');
  const sw = ['primario', 'secundario', 'acento', 'fondo', 'texto'].filter((k) => c[k]).map((k) => `<span><i style="background:${esc(c[k])}"></i>${esc(k)}<code>${esc(c[k])}</code></span>`).join('');

  $('ppCuerpo').innerHTML = `
    <section id="estudio"><div class="sec-head"><span class="ico">◎</span><h2>Estudio de la compañía</h2><span class="note">${esc((est.generadoEn || '').slice(0, 16).replace('T', ' '))} · ${esc((est.fuentes || []).length)} fuente(s) · confianza ${esc(d.confianza || 'baja')}</span></div>
      ${pendiente}<p class="pp-resumen">${esc(d.resumen || '')}</p>
      <div class="pp-grid">${afirmacion('Sector', d.sector)}${afirmacion('Propuesta de valor', d.propuestaValor)}${afirmacion('Tamaño y presencia', d.presencia)}${afirmacion('Público', d.publico)}
        <div class="pp-dato"><h3>Canales</h3>${lista(d.canales)}</div><div class="pp-dato"><h3>Retos probables</h3>${lista(d.retos)}</div></div>
      <p class="pp-nota">Solo es <b>hecho</b> lo que consta en una de las páginas leídas (con su enlace); todo lo demás es <b>hipótesis</b> a validar con el cliente.</p>
      <h3 class="sub">Fuentes leídas</h3>${fuentes ? `<ul class="pp-fuentes">${fuentes}</ul>` : '<p class="pp-nota">Ninguna: sin web pública, todo el estudio es hipótesis.</p>'}
      ${(est.avisos || []).length ? `<p class="pp-nota">${est.avisos.map(esc).join(' · ')}</p>` : ''}
    </section>
    <section id="marca"><div class="sec-head"><span class="ico">◐</span><h2>Su marca</h2><span class="note">catálogo único · <code>?marca=${esc(m.id)}</code></span></div>
      <div class="pp-sw">${sw}</div>
      <p class="pp-pres" style="margin-top:12px"><a class="pa-btn" href="/marcablanca/?marca=${encodeURIComponent(m.id)}">Editar la marca en /marcablanca</a><a class="pa-btn" href="/marcablanca/api/marcas/${encodeURIComponent(m.id)}" target="_blank" rel="noopener">JSON ↗</a></p>
    </section>
    <section id="presentacion"><div class="sec-head"><span class="ico">▶</span><h2>Presentación</h2><span class="note">generador · prospect con su marca</span></div>
      ${pres.url ? `<div class="pp-pres"><a class="pa-btn pa-btn--lleno" href="${esc(pres.deckUrl || pres.url)}" target="_blank" rel="noopener">Abrir la presentación ↗</a><code>${esc(location.origin + pres.url)}</code>${pres.password ? `<code title="Clave del cliente">${esc(pres.password)}</code>` : '<span class="pp-nota">clave: la de su alta (se conserva al regenerar)</span>'}<a class="pa-btn" href="${esc(pres.ideasUrl)}" target="_blank" rel="noopener">Editar esqueleto</a></div>` : '<p class="pp-nota">Todavía no hay presentación: relanza la propuesta.</p>'}
    </section>
    <section id="soluciones"><div class="sec-head"><span class="ico">◆</span><h2>Las 5 patas con su marca</h2><span class="note">studio crea · store distribuye · tv emite · app mantiene · biz comercializa</span></div>
      <div class="pp-sols">${sols}</div>
    </section>`;
  pintarMaquetas(m.id);
}

async function iniciar() {
  const id = idDeLaRuta();
  $('ppRuta').textContent = id || '?';
  if (!id) { privada(404); return; }
  try {
    const r = await fetch(`/presentaciones/api/propuesta?id=${encodeURIComponent(id)}`, {headers: {accept: 'application/json'}, credentials: 'same-origin', cache: 'no-store'});
    if (r.status === 401 || r.status === 403) { privada(r.status); return; }
    if (r.status === 404) { privada(404); return; }
    const p = await r.json();
    if (!r.ok || !p.ok) { privada(r.status); return; }
    pintarPropuesta(p);
  } catch (_) { privada(0); }
  finally { $('propuesta').removeAttribute('aria-busy'); }
}
iniciar();
