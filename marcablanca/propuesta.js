/*!
 * propuesta.js · v1.0.0 · «Tu marca · introduce una URL» en admiranext.com/marcablanca
 * (SubMorfeoMacMini, 01-10-2026 · FLT-101330 b).
 *
 * 1. POST /marcablanca/api/analizar {url} → el servidor lee la web (mismo analizador que el
 *    generador de presentaciones, con defensas SSRF) y devuelve datos + propuesta + análisis.
 * 2. La propuesta (marca completa, mismo esquema que clientes/*.json) se registra en el cargador
 *    (MarcaBlanca.registrar) y se pinta al momento en las maquetas de Studio, Store, App y Yokup.
 * 3. Se puede retocar (nombre, colores, fondo, tipografía, modo), ver la presentación de ejemplo,
 *    descargar el JSON y —con sesión del generador— guardarla en el catálogo único
 *    (POST /presentaciones/api/marcas), que la deja disponible con ?marca=<id> en todas partes.
 * Siempre consta como «propuesta generada automáticamente a partir de <url>», nunca como la
 * marca oficial del cliente.
 */
import {propuestaDesdeDatos, datosDesdeInspiracion, paletaDesdeColores, TIPOGRAFIAS, idMarca, esHex} from '/marcablanca/marca.js?v=20261001-catalogo';
import {coloresDeImagen} from '/marcablanca/logo-paleta.js?v=20261001-catalogo';

const FIJAS = ['admira', 'lumbre', 'brumelle', 'frescaria'];
const $ = (id) => document.getElementById(id);
const esc = (v) => String(v == null ? '' : v).replace(/[&<>"']/g, (c) => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'}[c]));

const estado = {datos: null, original: null, analisis: null, aviso: '', acceso: null, guardada: ''};

function esperar(cond) {
  return new Promise((ok) => { const t = () => (cond() ? ok() : setTimeout(t, 30)); t(); });
}
function idSeguro(id) {
  const limpio = idMarca(id) || 'tu-marca';
  return FIJAS.includes(limpio) ? `${limpio}-web` : limpio;
}
function marcaActual() {
  const m = propuestaDesdeDatos({...estado.datos, id: idSeguro(estado.datos.id || estado.datos.nombre)});
  m.ejemplo = false;
  return m;
}

/* ── Estado del formulario de URL ────────────────────────────────────────── */
function avisoUrl(texto, tipo = '') {
  const p = $('urlEstado');
  p.textContent = texto;
  p.dataset.tipo = tipo;
}
function avisoPanel(html, tipo = '') {
  const p = $('prEstado');
  p.innerHTML = html;
  p.dataset.tipo = tipo;
}

/* ── Pintado ─────────────────────────────────────────────────────────────── */
let pendiente = 0;
async function aplicar({empujar = false} = {}) {
  const m = marcaActual();
  const MB = window.MarcaBlanca;
  MB.registrar(m);
  const p = m.colores[m.modo];
  for (const k of ['primario', 'secundario', 'acento', 'fondo']) {
    const valor = (k === 'fondo' ? (esHex(estado.datos.fondo) ? estado.datos.fondo : p.fondo) : estado.datos[k]) || p[k];
    const input = document.querySelector(`[data-pr="${k}"]`);
    if (document.activeElement !== input) input.value = String(valor).toLowerCase();
    document.querySelector(`[data-pr-hex="${k}"]`).textContent = String(valor).toUpperCase() + (k === 'fondo' && !esHex(estado.datos.fondo) ? ' · auto' : '');
  }
  const nombre = document.querySelector('[data-pr="nombre"]');
  if (document.activeElement !== nombre) nombre.value = estado.datos.nombre;
  document.querySelector('[data-pr="tipografia"]').value = estado.datos.tipografia;
  document.querySelector('[data-pr="modo"]').value = m.modo;
  $('prNombre').textContent = m.nombre;
  const logo = $('prLogo');
  logo.innerHTML = estado.datos.logo ? `<img src="${esc(estado.datos.logo)}" alt="Logo detectado de ${esc(m.nombre)}">` : `<b>${esc(m.nombre)}</b>`;
  logo.style.background = p.fondo; logo.style.color = p.texto;
  const yo = ++pendiente;
  await new Promise((ok) => setTimeout(ok, 120));
  if (yo !== pendiente) return;
  await window.MarcaBlancaDemo.mostrar(m.id, {propuesta: !estado.guardada, empujar});
}

function pintarAnalisis() {
  const a = estado.analisis || {};
  $('prAviso').innerHTML = `Propuesta generada automáticamente a partir de <a href="${esc(a.url)}" target="_blank" rel="noopener noreferrer">${esc(a.url)}</a>. <b>No es la marca oficial de ${esc(estado.datos.nombre)}</b>: revísala antes de enseñarla.`;
  const partes = [`logo: ${a.logo?.origen || 'no detectado'}`];
  if (a.colorTema) partes.push(`color de tema ${a.colorTema.toUpperCase()}`);
  if (a.fuente) partes.push(`fuente de la web «${a.fuente}» → ${TIPOGRAFIAS[estado.datos.tipografia]?.nombre || estado.datos.tipografia}`);
  else partes.push(`tipografía: ${TIPOGRAFIAS[estado.datos.tipografia]?.nombre || estado.datos.tipografia} (no se detectó la de la web)`);
  partes.push(`fondo de la web ${String(a.fondoWeb || '').toUpperCase()} · modo ${a.modoWeb || 'claro'}`);
  $('prDetectado').textContent = 'Detectado — ' + partes.join(' · ') + '.';
}

/* ── Análisis ────────────────────────────────────────────────────────────── */
async function analizar(url) {
  const form = $('formUrl');
  const boton = form.querySelector('button');
  boton.disabled = true; form.setAttribute('aria-busy', 'true');
  avisoUrl(`Analizando ${url}…`, 'cargando');
  try {
    const r = await fetch('/marcablanca/api/analizar', {method: 'POST', headers: {'content-type': 'application/json', accept: 'application/json'}, body: JSON.stringify({url})});
    const body = await r.json().catch(() => ({}));
    if (!r.ok || !body.ok) {
      const codigo = body.estado ? ` [HTTP ${body.estado}]` : '';
      const motivo = body.bloqueo ? 'La web bloquea el análisis automático' : 'No se pudo analizar';
      avisoUrl(`${motivo}${codigo}: ${body.error || `error ${r.status}`}`, 'error');
      form.dataset.error = body.bloqueo ? 'bloqueo' : 'error';
      return;
    }
    delete form.dataset.error;
    estado.analisis = body.analisis; estado.guardada = '';
    estado.datos = {...body.datos, id: idSeguro(body.datos.id)};
    // Logo de mapa de bits ya en data: → su paleta también cuenta (el servidor no decodifica PNG).
    if (/^data:image\/(png|jpeg|webp|gif)/.test(estado.datos.logo || '') && body.inspiracion) {
      try {
        const colores = await coloresDeImagen(estado.datos.logo);
        const d = datosDesdeInspiracion(body.inspiracion, {logo: estado.datos.logo, logoColores: colores});
        Object.assign(estado.datos, {primario: d.primario, secundario: d.secundario, acento: d.acento});
      } catch (_) {}
    }
    estado.original = JSON.parse(JSON.stringify(estado.datos));
    $('propuesta').hidden = false;
    pintarAnalisis();
    avisoPanel('');
    await aplicar();
    avisoUrl(`Propuesta lista para ${estado.datos.nombre} · ${body.analisis.host}. Retócala abajo.`, 'ok');
    comprobarAcceso();
    $('propuesta').scrollIntoView({behavior: 'smooth', block: 'nearest'});
  } catch (error) {
    avisoUrl('No se pudo contactar con el analizador: ' + (error.message || error), 'error');
  } finally {
    boton.disabled = false; form.removeAttribute('aria-busy');
  }
}

/* ── Acceso al generador (solo para ofrecer «Guardar») ──────────────────── */
async function comprobarAcceso() {
  if (estado.acceso !== null) return estado.acceso;
  try {
    const r = await fetch('/presentaciones/api/marcas', {headers: {accept: 'application/json'}, credentials: 'same-origin', cache: 'no-store'});
    const body = r.ok ? await r.json() : null;
    estado.acceso = body?.ok ? body.acceso : false;
  } catch (_) { estado.acceso = false; }
  $('prAcceso').innerHTML = estado.acceso
    ? `Sesión del generador: <b>${esc(estado.acceso.nombre || estado.acceso.nivel)}</b>. «Guardar en el catálogo» la deja disponible con <code>?marca=&lt;id&gt;</code> en Studio, Store, App, Yokup y el generador.`
    : 'Guardar en el catálogo requiere la sesión del <a href="/presentaciones/" target="_blank" rel="noopener">generador de presentaciones</a>: entra allí y vuelve a esta página.';
  return estado.acceso;
}

async function guardar(actualizar = false) {
  const m = marcaActual();
  avisoPanel('Guardando en el catálogo…', 'cargando');
  try {
    const r = await fetch('/presentaciones/api/marcas', {method: actualizar ? 'PUT' : 'POST', credentials: 'same-origin',
      headers: {'content-type': 'application/json', accept: 'application/json'},
      body: JSON.stringify({marca: m, origen: 'url', tipo: 'real', propuesta: true, web: estado.analisis?.url || ''})});
    const body = await r.json().catch(() => ({}));
    if (r.status === 401 || r.status === 403 || (r.status === 503 && !body.error)) {
      estado.acceso = false;
      avisoPanel('Para guardar en el catálogo hace falta entrar en el <a href="/presentaciones/" target="_blank" rel="noopener">generador de presentaciones</a> (cuenta autorizada). Mientras tanto puedes descargar el JSON.', 'error');
      return;
    }
    if (r.status === 409 && !actualizar && /ya existe/i.test(body.error || '')) {
      if (window.confirm(`${body.error}\n\n¿Sustituir la marca guardada por esta propuesta?`)) return guardar(true);
      avisoPanel(esc(body.error), 'error');
      return;
    }
    if (!r.ok) { avisoPanel(esc(body.error || `No se pudo guardar (HTTP ${r.status}).`), 'error'); return; }
    estado.guardada = body.id;
    window.MarcaBlancaDemo.catalogo();
    const id = encodeURIComponent(body.id);
    avisoPanel(`Guardada en el catálogo como <code>${esc(body.id)}</code>: <a href="/marcablanca/?marca=${id}">/marcablanca/?marca=${esc(body.id)}</a> · <a href="/marcablanca/presentacion?marca=${id}" target="_blank" rel="noopener">presentación ↗</a> · <a href="/marcablanca/api/marcas/${id}" target="_blank" rel="noopener">JSON ↗</a>. En cualquier web de la Galaxia: <code>?marca=${esc(body.id)}</code>.`, 'ok');
    await window.MarcaBlancaDemo.mostrar(body.id, {propuesta: false, empujar: true});
  } catch (error) {
    avisoPanel('No se pudo guardar: ' + esc(error.message || error), 'error');
  }
}

function descargar() {
  const m = marcaActual();
  const blob = new Blob([JSON.stringify(m, null, 2) + '\n'], {type: 'application/json'});
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `${m.id}.json`; a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}
function presentacion() {
  const f = document.createElement('form');
  f.method = 'POST'; f.action = '/marcablanca/presentacion'; f.target = '_blank';
  const i = document.createElement('input'); i.type = 'hidden'; i.name = 'marca'; i.value = JSON.stringify(marcaActual()); f.appendChild(i);
  document.body.appendChild(f); f.submit(); f.remove();
}
async function paletaDelLogo() {
  if (!estado.datos.logo) { avisoPanel('No se detectó logo en la web: ajusta los colores a mano.', 'error'); return; }
  try {
    const pal = paletaDesdeColores(await coloresDeImagen(estado.datos.logo));
    Object.assign(estado.datos, pal);
    avisoPanel('Paleta sacada del logo. Retócala si hace falta.', 'ok');
    aplicar();
  } catch (_) { avisoPanel('Ese logo no se puede leer desde el navegador (está en otro dominio sin permiso). Ajusta los colores a mano.', 'error'); }
}

/* ── Arranque ────────────────────────────────────────────────────────────── */
async function iniciar() {
  await esperar(() => window.MarcaBlanca && window.MarcaBlancaDemo);
  const sel = document.querySelector('[data-pr="tipografia"]');
  sel.innerHTML = Object.entries(TIPOGRAFIAS).map(([k, t]) => `<option value="${k}">${esc(t.nombre)}</option>`).join('');
  $('formUrl').addEventListener('submit', (e) => {
    e.preventDefault();
    const bruto = $('urlMarca').value.trim();
    if (!bruto) { avisoUrl('Escribe la web de la marca, por ejemplo https://www.tumarca.com', 'error'); return; }
    const url = /^https?:\/\//i.test(bruto) ? bruto.replace(/^http:/i, 'https:') : 'https://' + bruto;
    analizar(url);
  });
  $('propuesta').addEventListener('input', (e) => {
    const k = e.target.dataset?.pr;
    if (!k || !estado.datos) return;
    estado.datos[k] = e.target.value;
    if (k === 'nombre') estado.datos.id = idSeguro(e.target.value);
    if (k === 'modo') estado.datos.fondo = '';
    estado.guardada = '';
    aplicar();
  });
  $('propuesta').addEventListener('click', (e) => {
    const accion = e.target.closest('[data-pr-accion]')?.dataset.prAccion;
    if (!accion || !estado.datos) return;
    if (accion === 'guardar') guardar(false);
    else if (accion === 'json') descargar();
    else if (accion === 'presentacion') presentacion();
    else if (accion === 'paletaLogo') paletaDelLogo();
    else if (accion === 'restaurar') { estado.datos = JSON.parse(JSON.stringify(estado.original)); estado.guardada = ''; avisoPanel('Vuelta a la propuesta original.', 'ok'); aplicar(); }
  });
  // ?web=https://… analiza al abrir (enlace compartible a la propuesta, que no se guarda).
  const web = new URLSearchParams(location.search).get('web');
  if (web) { $('urlMarca').value = web; analizar(/^https:\/\//i.test(web) ? web : 'https://' + web.replace(/^http:\/\//i, '')); }
}
iniciar();
