/*!
 * lanzar-propuesta.js · «Lanzar propuesta» (SubMorfeoMacMini, 02-10-2026 · FLT-101369 b).
 * Lo montan /marcablanca (sección «Lanzar propuesta») y el generador de /presentaciones (panel
 * «Propuesta automática»). Un campo «marca, web o idea» → POST /presentaciones/api/propuesta paso a paso
 * (marca → estudio → presentación → plataforma) para enseñar el progreso; cada paso es idempotente, así
 * que «Reintentar» continúa donde iba. Requiere la sesión del generador: sin ella lo explica y enlaza.
 */
const API = '/presentaciones/api/propuesta';
const PASOS = [
  {id: 'marca', titulo: 'Marca', ayuda: 'catálogo de /marcablanca: de su web, del catálogo o neutra'},
  {id: 'estudio', titulo: 'Estudio', ayuda: 'web pública + IA · suele tardar entre 20 y 60 s'},
  {id: 'presentacion', titulo: 'Presentación', ayuda: 'generador con su marca · Studio, Store, App, Biz y «Su galaxia»'},
  {id: 'plataforma', titulo: 'Plataforma', ayuda: 'las 5 patas con ?marca=<id>'}
];
const esc = (v) => String(v == null ? '' : v).replace(/[&<>"']/g, (c) => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'}[c]));
const pareceWeb = (s) => /^https?:\/\//i.test(s) || (!/\s/.test(s) && /^[a-z0-9-]+(\.[a-z0-9-]+)+(?:[/?#]\S*)?$/i.test(s));

/** «admira.com» → web · «Frescaria» → marca · «cadena de gimnasios que…» → idea. */
export function interpretar(texto) {
  const t = String(texto || '').trim();
  if (!t) return null;
  if (pareceWeb(t)) return {url: t};
  if (t.split(/\s+/).length <= 4 && t.length <= 60) return {marca: t};
  return {idea: t};
}

const PLANTILLA = `
<form class="pa-form" novalidate>
  <label class="pa-tit" for="paEntrada"><b>Marca, web o idea</b> · el generador estudia la compañía y prepara su propuesta</label>
  <div class="pa-fila">
    <input id="paEntrada" name="entrada" type="text" maxlength="600" autocomplete="off" spellcheck="false" placeholder="admira.com · Frescaria · cadena de gimnasios que quiere pantallas en sala">
    <button type="submit" class="pa-btn pa-lanzar">Lanzar propuesta</button>
  </div>
  <details class="pa-mas"><summary>Opciones</summary>
    <div class="pa-opciones">
      <label class="pa-f"><span>Para quién (opcional)</span><input name="destinatario" type="text" maxlength="160" placeholder="Dirección de marketing"></label>
      <label class="pa-f"><span>Idioma</span><select name="idioma"><option value="es">Español</option><option value="en">English</option><option value="ca">Català</option></select></label>
      <label class="pa-check"><input name="rehacer" type="checkbox"> Rehacerla entera si ya existe (gasta cupo)</label>
    </div>
  </details>
  <p class="pa-acceso" data-pa="acceso">Comprobando el acceso al generador…</p>
</form>
<ol class="pa-pasos" data-pa="pasos" hidden></ol>
<p class="pa-estado" data-pa="estado" role="status" aria-live="polite"></p>
<div class="pa-resultado" data-pa="resultado" hidden></div>
<div class="pa-recientes" data-pa="recientes" hidden></div>`;

function pintarPasos(raiz, pasos = {}, actual = '') {
  const ol = raiz.querySelector('[data-pa="pasos"]');
  ol.hidden = false;
  ol.innerHTML = PASOS.map((p, i) => {
    const info = pasos[p.id] || {};
    const estado = actual === p.id && info.estado !== 'error' ? 'en-curso' : (info.estado || 'pendiente');
    const etiqueta = {hecho: 'hecho', reserva: 'reserva', error: 'error', 'en-curso': 'en curso…', pendiente: 'pendiente'}[estado] || estado;
    const nota = info.error || info.nota || p.ayuda;
    return `<li class="pa-paso" data-estado="${esc(estado)}" data-paso="${p.id}"><span class="pa-n">${i + 1}</span><div><b>${esc(p.titulo)}</b> <em>${esc(etiqueta)}</em><small>${esc(nota)}</small></div></li>`;
  }).join('');
}

function pintarResultado(raiz, r) {
  const caja = raiz.querySelector('[data-pa="resultado"]');
  const m = r.marca || {};
  const c = m.colores || {};
  const est = r.estudio || {};
  const pres = r.presentacion || {};
  const plat = r.plataforma || {};
  const logo = m.logo ? `<img src="${esc(m.logo)}" alt="Logo de ${esc(m.nombre)}">` : `<b>${esc(m.nombre)}</b>`;
  const sol = ['studio', 'store', 'tv', 'app', 'biz'].filter((k) => plat[k]).map((k) => `<a class="pa-sol" href="${esc(plat[k].url)}" target="_blank" rel="noopener"><b>${esc(plat[k].nombre)}</b> <i>${esc(plat[k].verbo)}</i></a>`).join('');
  caja.hidden = false;
  caja.innerHTML = `
    <div class="pa-cab"><span class="pa-logo" style="background:${esc(c.fondo || '#fff')};color:${esc(c.texto || '#111')}">${logo}</span>
      <div><h3>Propuesta para ${esc(m.nombre || r.id)}</h3>
      <p class="pa-aviso">${esc(m.aviso || '')}</p>
      <p class="pa-paleta">${['primario', 'secundario', 'acento', 'fondo'].filter((k) => c[k]).map((k) => `<i title="${k} ${esc(c[k])}" style="background:${esc(c[k])}"></i>`).join('')} <code>${esc(r.id)}</code></p></div></div>
    <p class="pa-linea">Estudio: <b>${esc(est.estado === 'completo' ? 'completo' : 'pendiente')}</b> · confianza <b>${esc(est.confianza || 'baja')}</b> · ${esc((est.fuentes || []).length)} fuente(s)${est.motivo ? ` · ${esc(est.motivo)}` : ''}</p>
    ${pres.url ? `<p class="pa-linea">Presentación: <a href="${esc(pres.deckUrl || pres.url)}" target="_blank" rel="noopener">${esc(location.origin + pres.url)}</a>${pres.password ? ` · clave <code class="pa-clave">${esc(pres.password)}</code>` : ''}</p>` : ''}
    <div class="pa-sols">${sol}</div>
    <div class="pa-acciones"><a class="pa-btn pa-btn--lleno" href="${esc(r.propuestaUrl)}">Abrir la propuesta →</a>${plat.marcablanca ? `<a class="pa-btn" href="${esc(plat.marcablanca)}">Ver la marca en /marcablanca</a>` : ''}</div>`;
}

function pintarRecientes(raiz, recientes = []) {
  const caja = raiz.querySelector('[data-pa="recientes"]');
  if (!recientes.length) { caja.hidden = true; return; }
  caja.hidden = false;
  caja.innerHTML = `<span class="pa-tit">Últimas propuestas</span><ul>${recientes.slice(0, 6).map((p) => `<li><a href="/marcablanca/propuesta/${encodeURIComponent(p.id)}">${esc(p.nombre || p.id)}</a> <small>${esc(p.estado || '')}${p.autor ? ` · ${esc(p.autor)}` : ''}</small></li>`).join('')}</ul>`;
}

export async function montarLanzador(raiz, {canal = 'marcablanca'} = {}) {
  if (!raiz) return;
  raiz.classList.add('pa');
  raiz.innerHTML = PLANTILLA;
  const $ = (sel) => raiz.querySelector(sel);
  const form = $('.pa-form');
  const estado = (html, tipo = '') => { const p = $('[data-pa="estado"]'); p.innerHTML = html; p.dataset.tipo = tipo; };
  const acceso = $('[data-pa="acceso"]');
  let permitido = false;
  try {
    const r = await fetch(API, {headers: {accept: 'application/json'}, credentials: 'same-origin', cache: 'no-store'});
    const body = await r.json().catch(() => ({}));
    permitido = r.ok && body.ok;
    if (permitido) {
      acceso.dataset.tipo = 'ok';
      acceso.innerHTML = `Sesión del generador: <b>${esc(body.acceso?.nombre || body.acceso?.nivel)}</b> · hoy te quedan <b>${esc(body.cupo?.restantes)}</b> de ${esc(body.cupo?.limite)} propuestas. Úsala ante una oportunidad concreta, no en bucle.`;
      pintarRecientes(raiz, body.recientes);
    }
  } catch (_) { permitido = false; }
  if (!permitido) {
    acceso.dataset.tipo = 'error';
    acceso.innerHTML = 'Lanzar una propuesta requiere entrar en el <a href="/presentaciones/" target="_blank" rel="noopener">generador de presentaciones</a> con una cuenta autorizada (editor o admin). Entra allí y vuelve a esta página.';
  }

  async function paso(cuerpo) {
    const r = await fetch(API, {method: 'POST', credentials: 'same-origin', headers: {'content-type': 'application/json', accept: 'application/json'}, body: JSON.stringify({...cuerpo, canal})});
    const body = await r.json().catch(() => ({}));
    if (!r.ok) { const e = new Error(body.error || `HTTP ${r.status}`); e.estado = r.status; e.id = body.id; e.paso = body.paso; throw e; }
    return body;
  }

  let ultimo = null;
  async function ejecutar(inicio) {
    const boton = form.querySelector('.pa-lanzar');
    boton.disabled = true; form.setAttribute('aria-busy', 'true');
    let r = ultimo;
    try {
      for (const p of PASOS) {
        if (r && r.pasos?.[p.id] && ['hecho', 'reserva'].includes(r.pasos[p.id].estado) && !inicio) continue;
        pintarPasos(raiz, r?.pasos, p.id);
        estado(`${esc(p.titulo)}… <small>${esc(p.ayuda)}</small>`, 'cargando');
        r = await paso(inicio ? {...inicio, hasta: p.id} : {id: r.id, hasta: p.id});
        inicio = null; ultimo = r;
        pintarPasos(raiz, r.pasos);
      }
      estado(`Propuesta lista para <b>${esc(r.marca?.nombre || r.id)}</b>.`, 'ok');
      pintarResultado(raiz, r);
    } catch (error) {
      if (error.estado === 401 || error.estado === 403) {
        estado('Tu sesión del generador no está activa o no tiene permiso. <a href="/presentaciones/" target="_blank" rel="noopener">Entra en el generador</a> y vuelve a intentarlo.', 'error');
      } else {
        if (ultimo) pintarPasos(raiz, {...ultimo.pasos, ...(error.paso ? {[error.paso]: {estado: 'error', error: error.message}} : {})});
        estado(`${esc(error.message)}${error.estado === 429 ? '' : ' <button type="button" class="pa-btn" data-pa-reintentar>Reintentar</button>'}`, 'error');
        if (error.id && !ultimo) ultimo = {id: error.id, pasos: {}};
      }
    } finally {
      boton.disabled = false; form.removeAttribute('aria-busy');
    }
  }

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const entrada = interpretar(form.entrada.value);
    if (!entrada) { estado('Escribe una marca, su web o la idea de la oportunidad.', 'error'); return; }
    if (!permitido) { estado('Primero entra en el <a href="/presentaciones/" target="_blank" rel="noopener">generador de presentaciones</a>: la propuesta usa su sesión.', 'error'); return; }
    ultimo = null;
    $('[data-pa="resultado"]').hidden = true;
    const extra = {destinatario: form.destinatario.value.trim() || undefined, idioma: form.idioma.value, rehacer: form.rehacer.checked || undefined};
    ejecutar({...entrada, ...extra});
  });
  raiz.addEventListener('click', (e) => {
    if (e.target.closest('[data-pa-reintentar]') && ultimo?.id) ejecutar(null);
  });
}

// Montaje automático: cualquier [data-lanzar-propuesta] de la página.
if (typeof document !== 'undefined') {
  for (const nodo of document.querySelectorAll('[data-lanzar-propuesta]')) montarLanzador(nodo, {canal: nodo.dataset.lanzarPropuesta || 'marcablanca'});
}
