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
(function aplicarLangDeUrl(){
  const q = new URLSearchParams(location.search).get('lang') || '';
  if (/^en/i.test(q)) document.documentElement.lang = 'en';
  else if (/^es/i.test(q)) document.documentElement.lang = 'es';
})();
const idioma = () => /^en/i.test(document.documentElement.lang || '') ? 'en' : 'es';
const tr = (es, en) => idioma() === 'en' ? en : es;
const SOLUCIONES = [
  {k: 'studio', maqueta: 'studio', foco: 'Contenido', focoEn: 'Content'},
  {k: 'store', maqueta: 'store', foco: 'Distribución e inventario del punto de venta', focoEn: 'Distribution and store inventory'},
  {k: 'app', maqueta: 'app', foco: 'Comercialización y circuitos DOOH', focoEn: 'Selling and DOOH circuits'},
  {k: 'biz', maqueta: 'yokup', foco: 'Mantenimiento, comercios e instaladores', focoEn: 'Maintenance, venues and installers'}
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
  $('ppCabecera').innerHTML = `<h1>${tr('Propuesta privada', 'Private proposal')}</h1>`;
  $('ppTerm').textContent = estado === 404 ? tr('no encontrada', 'not found') : tr('acceso requerido', 'sign-in required');
  $('ppCuerpo').innerHTML = estado === 404
    ? `<div class="pp-privada"><p>${tr('No existe esa propuesta. Lánzala desde <a href="/pruebas/marcablanca/#lanzar">/marcablanca · Lanzar propuesta</a> o desde el generador.', 'That proposal does not exist. Launch it from <a href="/pruebas/marcablanca/#lanzar">/marcablanca · Launch a proposal</a> or from the generator.')}</p></div>`
    : `<div class="pp-privada"><p>${tr('El estudio de la compañía y la propuesta son <b>privados</b>: hace falta la sesión del <a href="/presentaciones/" target="_blank" rel="noopener">generador de presentaciones</a> (cuenta autorizada). Entra allí y vuelve a abrir esta página.', 'The company study and the proposal are <b>private</b>: they need the <a href="/presentaciones/" target="_blank" rel="noopener">presentation generator</a> session (an authorized account). Sign in there and open this page again.')}</p></div>`;
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
    return `<article class="pp-sol" data-solucion="${s.k}"><header><b>${esc(x.nombre || s.k)} <i>${esc(x.verbo || '')}</i></b><small>${esc(idioma() === 'en' ? s.focoEn : s.foco)}</small></header>
      <p class="pp-op"><b>${esc(op.titulo || '')}</b> ${esc(op.detalle || '')}${op.basadoEn ? ` <em>(${esc(op.basadoEn)})</em>` : ''}</p>
      <div class="pp-mini" data-pp-mk="${s.k}" aria-label="Maqueta de ${esc(x.nombre || s.k)} con la marca"></div>
      <footer><a class="pa-btn pa-btn--lleno" href="${esc(x.url)}" target="_blank" rel="noopener">${esc((x.url || '').replace(/^https:\/\/(www\.)?/, '').replace(/\/\?.*/, ''))} ↗</a>${x.alternativa ? `<a class="pa-btn" href="${esc(x.alternativa)}" target="_blank" rel="noopener">${esc(x.alternativa.replace(/^https:\/\/(www\.)?/, '').replace(/\/\?.*/, ''))} ↗</a>` : ''}</footer></article>`;
  }).join('');
  const sw = ['primario', 'secundario', 'acento', 'fondo', 'texto'].filter((k) => c[k]).map((k) => `<span><i style="background:${esc(c[k])}"></i>${esc(k)}<code>${esc(c[k])}</code></span>`).join('');

  $('ppCuerpo').innerHTML = `
    <section id="estudio"><div class="sec-head"><span class="ico">◎</span><h2>${tr('Estudio de la compañía', 'Company study')}</h2><span class="note">${esc((est.generadoEn || '').slice(0, 16).replace('T', ' '))} · ${esc((est.fuentes || []).length)} ${tr('fuente(s)', 'source(s)')} · ${tr('confianza', 'confidence')} ${esc(d.confianza || tr('baja', 'low'))}</span></div>
      ${pendiente}<p class="pp-resumen">${esc(d.resumen || '')}</p>
      <div class="pp-grid">${afirmacion('Sector', d.sector)}${afirmacion('Propuesta de valor', d.propuestaValor)}${afirmacion('Tamaño y presencia', d.presencia)}${afirmacion('Público', d.publico)}
        <div class="pp-dato"><h3>Canales</h3>${lista(d.canales)}</div><div class="pp-dato"><h3>Retos probables</h3>${lista(d.retos)}</div></div>
      <p class="pp-nota">Solo es <b>hecho</b> lo que consta en una de las páginas leídas (con su enlace); todo lo demás es <b>hipótesis</b> a validar con el cliente.</p>
      <h3 class="sub">Fuentes leídas</h3>${fuentes ? `<ul class="pp-fuentes">${fuentes}</ul>` : '<p class="pp-nota">Ninguna: sin web pública, todo el estudio es hipótesis.</p>'}
      ${(est.avisos || []).length ? `<p class="pp-nota">${est.avisos.map(esc).join(' · ')}</p>` : ''}
    </section>
    <section id="marca"><div class="sec-head"><span class="ico">◐</span><h2>${tr('Su marca', 'Its brand')}</h2><span class="note">${tr('catálogo único', 'single catalog')} · <code>?marca=${esc(m.id)}</code></span></div>
      <div class="pp-sw">${sw}</div>
      <p class="pp-pres" style="margin-top:12px"><a class="pa-btn" href="/pruebas/marcablanca/?marca=${encodeURIComponent(m.id)}">Editar la marca en /marcablanca</a><a class="pa-btn" href="/marcablanca/api/marcas/${encodeURIComponent(m.id)}" target="_blank" rel="noopener">JSON ↗</a></p>
    </section>
    <section id="presentacion"><div class="sec-head"><span class="ico">▶</span><h2>${tr('Presentación', 'Presentation')}</h2><span class="note">${tr('generador · prospect con su marca', 'generator · prospect with its brand')}</span></div>
      ${pres.url ? `<div class="pp-pres"><a class="pa-btn pa-btn--lleno" href="${esc(pres.deckUrl || pres.url)}" target="_blank" rel="noopener">Abrir la presentación ↗</a><code>${esc(location.origin + pres.url)}</code>${pres.password ? `<code title="Clave del cliente">${esc(pres.password)}</code>` : '<span class="pp-nota">clave: la de su alta (se conserva al regenerar)</span>'}<a class="pa-btn" href="${esc(pres.ideasUrl)}" target="_blank" rel="noopener">Editar esqueleto</a></div>` : '<p class="pp-nota">Todavía no hay presentación: relanza la propuesta.</p>'}
    </section>
    <section id="soluciones"><div class="sec-head"><span class="ico">◆</span><h2>${tr('Las 4 soluciones con su marca', 'The 4 solutions with its brand')}</h2><span class="note">${tr('Studio crea · Store distribuye · App comercializa · Biz mantiene', 'Studio creates · Store distributes · App sells · Biz maintains')}</span></div>
      <div class="pp-sols">${sols}</div>
    </section>`;
  pintarMaquetas(m.id);
}

let cacheP = null;
let cachePriv = null;
function privadaMem(estado) { cachePriv = estado; cacheP = null; privada(estado); }
window.addEventListener('admira:languagechange', (ev) => {
  const l = ev && ev.detail && ev.detail.lang;
  if (l === 'en' || l === 'es') document.documentElement.lang = l;
  if (cacheP) pintarPropuesta(cacheP);
  else if (cachePriv != null) privada(cachePriv);
});

async function iniciar() {
  const id = idDeLaRuta();
  $('ppRuta').textContent = id || '?';
  if (!id) { privadaMem(404); return; }
  try {
    const r = await fetch(`/presentaciones/api/propuesta?id=${encodeURIComponent(id)}`, {headers: {accept: 'application/json'}, credentials: 'same-origin', cache: 'no-store'});
    if (r.status === 401 || r.status === 403) { privadaMem(r.status); return; }
    if (r.status === 404) { privadaMem(404); return; }
    const p = await r.json();
    if (!r.ok || !p.ok) { privadaMem(r.status); return; }
    cacheP = p; cachePriv = null;
    pintarPropuesta(p);
  } catch (_) { privadaMem(0); }
  finally { $('propuesta').removeAttribute('aria-busy'); }
}
iniciar();
