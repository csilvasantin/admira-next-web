/*
 * presentation-prospect.js · interruptor «Prospect» del generador de presentaciones (01-10-2026).
 *
 * Una presentación para un cliente potencial se viste con SU marca: el operador activa
 * «Prospect», elige una marca de marcablanca/clientes/*.json o crea una «nueva marca»
 * (nombre, logo subido o por URL, primario, secundario, acento y tipografía; la paleta puede
 * salir sola del logo o de la web) y el panel guarda la elección en el campo oculto
 * name="prospect" del formulario. El servidor (functions/presentaciones/_prospect.js) la
 * normaliza con marcablanca/marca.js y la guarda con la presentación.
 *
 * También se monta en /marcablanca (modo demo): ahí no hay formulario, sólo vista previa.
 */
import {crearMarca, normalizarMarca, paletaDesdeColores, TIPOGRAFIAS, variablesMarca, cssVariables, contraste, idMarca} from '/marcablanca/marca.js?v=20261001-prospect';

const LOGO_MAX = 120 * 1024;
const esc = (v) => String(v == null ? '' : v).replace(/[&<>"']/g, (c) => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'}[c]));
const hexOk = (v) => /^#[0-9a-f]{6}$/i.test(String(v || ''));

function cargarMarcaBlanca() {
  if (window.MarcaBlanca) return Promise.resolve(window.MarcaBlanca);
  return new Promise((ok, ko) => {
    const s = document.createElement('script');
    s.src = '/marcablanca/marcablanca.js?v=20261001-prospect'; s.setAttribute('data-mb-auto', 'false');
    s.onload = () => ok(window.MarcaBlanca); s.onerror = ko; document.head.appendChild(s);
  });
}

function leerArchivo(file) {
  return new Promise((ok, ko) => { const r = new FileReader(); r.onload = () => ok(String(r.result)); r.onerror = ko; r.readAsDataURL(file); });
}
function cargarImagen(src) {
  return new Promise((ok, ko) => { const img = new Image(); img.crossOrigin = 'anonymous'; img.onload = () => ok(img); img.onerror = () => ko(new Error('No se pudo cargar el logo.')); img.src = src; });
}
/** Reduce un logo de mapa de bits a ≤ 512 px y lo recodifica (PNG o WebP) para que viaje ligero. */
async function aligerar(dataUrl) {
  if (dataUrl.startsWith('data:image/svg+xml')) return dataUrl;
  const img = await cargarImagen(dataUrl);
  const k = Math.min(1, 512 / Math.max(img.naturalWidth, img.naturalHeight));
  const c = document.createElement('canvas'); c.width = Math.round(img.naturalWidth * k); c.height = Math.round(img.naturalHeight * k);
  c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
  const png = c.toDataURL('image/png');
  return png.length * 0.75 <= LOGO_MAX ? png : c.toDataURL('image/webp', 0.9);
}
/** Histograma de colores de un logo (ignora transparencias). Falla si la imagen es de otro origen sin CORS. */
async function coloresDeImagen(src) {
  const img = await cargarImagen(src);
  const w = img.naturalWidth || 160, h = img.naturalHeight || 160, k = Math.min(1, 160 / Math.max(w, h));
  const c = document.createElement('canvas'); c.width = Math.max(1, Math.round(w * k)); c.height = Math.max(1, Math.round(h * k));
  const ctx = c.getContext('2d'); ctx.drawImage(img, 0, 0, c.width, c.height);
  const d = ctx.getImageData(0, 0, c.width, c.height).data, cubos = new Map();
  for (let i = 0; i < d.length; i += 4) {
    if (d[i + 3] < 160) continue;
    const clave = ((d[i] >> 4) << 8) | ((d[i + 1] >> 4) << 4) | (d[i + 2] >> 4);
    const b = cubos.get(clave) || {r: 0, g: 0, b: 0, n: 0};
    b.r += d[i]; b.g += d[i + 1]; b.b += d[i + 2]; b.n += 1; cubos.set(clave, b);
  }
  const hex = (v) => Math.round(v).toString(16).padStart(2, '0');
  return [...cubos.values()].sort((a, b) => b.n - a.n).slice(0, 24).map((b) => ({hex: ('#' + hex(b.r / b.n) + hex(b.g / b.n) + hex(b.b / b.n)).toUpperCase(), peso: b.n}));
}
const TIPO_DESDE_WEB = {serif: 'serif', rounded: 'redondeada', mono: 'grotesca', grotesk: 'grotesca'};

/**
 * Monta el panel.
 * @param {HTMLElement} raiz        contenedor vacío
 * @param {{modo?:'generador'|'demo', campo?:HTMLInputElement, nombreCliente?:()=>string, webCliente?:()=>string}} o
 */
export function montarProspect(raiz, o = {}) {
  const modo = o.modo || 'generador';
  const estado = {activo: modo === 'demo', marca: '', actual: null, nueva: {nombre: '', logoData: '', logoUrl: '', web: '', primario: '#1F4FD8', secundario: '#0E9F73', acento: '#FF8A00', tipografia: 'grotesca', modo: 'auto'}};
  const catalogo = new Map();
  let aviso = '';
  raiz.classList.add('prospect-panel');
  raiz.innerHTML = `
    ${modo === 'generador' ? `<label class="pp-switch"><input type="checkbox" data-pp="activo"><span class="pp-track" aria-hidden="true"></span><span><b>Presentación para un prospect</b><small>Todo el deck (portada, fondos, tipografías, logo, gráficos y maquetas de Studio, Store, App y Yokup) se viste con la marca del destinatario.</small></span></label>` : ''}
    <div class="pp-cuerpo" data-pp="cuerpo"${modo === 'generador' ? ' hidden' : ''}>
      <div class="pp-label">Marca del destinatario</div>
      <div class="pp-marcas" role="radiogroup" aria-label="Marca del prospect" data-pp="marcas"><span class="pp-cargando">Cargando marcas de /marcablanca…</span></div>
      <div class="pp-nueva" data-pp="nueva" hidden>
        <div class="pp-grid">
          <label class="pp-f"><span>Nombre de la marca</span><input type="text" maxlength="80" data-pp="nombre" placeholder="Nombre del prospect"></label>
          <label class="pp-f"><span>Web del prospect · opcional</span><input type="text" inputmode="url" data-pp="web" placeholder="https://www.prospect.com/"></label>
          <div class="pp-f pp-full"><span>Logo · subida o URL</span>
            <div class="pp-logo-fila"><label class="pp-btn pp-subir">Subir logo<input type="file" accept="image/png,image/jpeg,image/webp,image/gif,image/svg+xml" data-pp="archivo" hidden></label>
            <input type="text" inputmode="url" data-pp="logoUrl" placeholder="o pega la URL https:// del logo"><span class="pp-logo-ver" data-pp="logoVer"></span></div></div>
          <label class="pp-f pp-color"><span>Primario</span><input type="color" data-pp="primario"><code data-pp-hex="primario"></code></label>
          <label class="pp-f pp-color"><span>Secundario</span><input type="color" data-pp="secundario"><code data-pp-hex="secundario"></code></label>
          <label class="pp-f pp-color"><span>Acento</span><input type="color" data-pp="acento"><code data-pp-hex="acento"></code></label>
          <label class="pp-f"><span>Tipografía</span><select data-pp="tipografia">${Object.entries(TIPOGRAFIAS).map(([k, t]) => `<option value="${k}">${esc(t.nombre)}</option>`).join('')}</select></label>
          <label class="pp-f"><span>Modo</span><select data-pp="modo"><option value="auto">Automático (según el primario)</option><option value="claro">Claro</option><option value="oscuro">Oscuro</option></select></label>
        </div>
        <div class="pp-acciones"><button type="button" class="pp-btn" data-pp="deLogo">Extraer paleta del logo</button>${modo === 'generador' ? '<button type="button" class="pp-btn" data-pp="deWeb">Extraer de la web</button>' : ''}<button type="button" class="pp-btn" data-pp="json">Descargar JSON de cliente</button></div>
      </div>
      <div class="pp-vista" data-pp="vista">
        <div class="pp-portada mk-scope-lite" data-pp="portada"><div class="pp-lockup"><span class="mb-logo pp-plogo" data-mb-logo></span><span class="pp-x">× ADmiraNeXT</span></div><div class="pp-eyebrow">Propuesta privada</div><div class="pp-titulo" data-pp="titulo">Cada local puede aprender.</div><div class="pp-botones"><span class="mb-btn mb-btn--primario">Ver presentación</span><span class="mb-btn mb-btn--acento">Piloto</span></div></div>
        <div class="pp-ficha"><div class="pp-swatches" data-pp="swatches"></div><p class="pp-nota" data-pp="nota"></p><button type="button" class="pp-btn pp-primario" data-pp="previa">Vista previa de la presentación ↗</button></div>
      </div>
      <p class="pp-aviso" data-pp="aviso" role="status" aria-live="polite"></p>
    </div>`;
  const $ = (k) => raiz.querySelector(`[data-pp="${k}"]`);

  function marcaNueva() {
    const n = estado.nueva;
    const nombre = n.nombre.trim() || (o.nombreCliente ? o.nombreCliente() : '') || 'Prospect';
    return crearMarca({nombre, logo: n.logoData || n.logoUrl ? {imagen: n.logoData || n.logoUrl} : {}, primario: n.primario, secundario: n.secundario, acento: n.acento, tipografia: n.tipografia, modo: n.modo === 'auto' ? undefined : n.modo, web: n.web});
  }
  function marcaActiva() {
    if (estado.marca === 'nueva') return marcaNueva();
    if (estado.marca === 'actual') return null;
    return catalogo.get(estado.marca) || null;
  }
  function valorCampo() {
    if (!estado.activo || !estado.marca) return '';
    if (estado.marca === 'actual') return JSON.stringify({activo: true, marca: 'actual'});
    if (estado.marca !== 'nueva') return JSON.stringify({activo: true, marca: estado.marca});
    const n = estado.nueva;
    return JSON.stringify({activo: true, marca: 'nueva', nueva: {nombre: n.nombre.trim() || (o.nombreCliente ? o.nombreCliente() : ''), logoData: n.logoData || undefined, logoUrl: n.logoData ? undefined : (n.logoUrl || undefined), web: n.web || undefined, primario: n.primario, secundario: n.secundario, acento: n.acento, tipografia: n.tipografia, modo: n.modo === 'auto' ? undefined : n.modo}});
  }
  let pintando = 0;
  async function pintar() {
    if (o.campo) o.campo.value = valorCampo();
    $('cuerpo').hidden = !estado.activo;
    if ($('activo')) $('activo').checked = estado.activo;
    // Con prospect la web oficial es opcional: el bundle la marca `required` al arrancar y el
    // navegador bloqueaba el envío antes de llegar al servidor (visto en la prueba real).
    if (modo === 'generador') { const web = document.getElementById('website'); if (web) web.required = !(estado.activo && estado.marca); }
    raiz.querySelectorAll('[data-elegir-marca]').forEach((b) => b.setAttribute('aria-checked', String(b.dataset.elegirMarca === estado.marca)));
    $('nueva').hidden = estado.marca !== 'nueva';
    for (const k of ['primario', 'secundario', 'acento']) { $(k).value = estado.nueva[k]; raiz.querySelector(`[data-pp-hex="${k}"]`).textContent = estado.nueva[k].toUpperCase(); }
    $('tipografia').value = estado.nueva.tipografia; $('modo').value = estado.nueva.modo;
    const ver = $('logoVer'); const src = estado.nueva.logoData || estado.nueva.logoUrl;
    ver.innerHTML = src ? `<img src="${esc(src)}" alt="Logo">` : '';
    $('aviso').textContent = aviso;
    const m = marcaActiva();
    $('vista').hidden = !m;
    if (!m) { if (estado.marca === 'actual') { $('vista').hidden = true; } return; }
    const yo = ++pintando;
    const portada = $('portada'), modoM = m.modo, p = m.colores[modoM];
    portada.setAttribute('style', cssVariables(variablesMarca(m, modoM)));
    $('titulo').textContent = `${m.nombreCorto || m.nombre}: cada local puede aprender.`;
    $('swatches').innerHTML = ['primario', 'secundario', 'acento', 'fondo', 'superficie', 'texto'].map((k) => `<span title="${k} ${p[k]}"><i style="background:${p[k]}"></i>${k}<code>${p[k]}</code></span>`).join('');
    const ct = contraste(p.primarioTexto, p.primario);
    $('nota').textContent = `${m.nombre} · modo ${modoM} · ${m.tipografia.titulos.split(',')[0].replace(/'/g, '')} · botón ${ct.toFixed(1)}:1${m.ejemplo ? ' · cliente de ejemplo (ficticio)' : ''}`;
    try {
      const MB = await cargarMarcaBlanca();
      if (yo !== pintando) return;
      const id = estado.marca === 'nueva' ? MB.registrar({...m, id: 'prospect-' + (idMarca(m.id) || 'nueva')}) : m.id;
      await MB.aplicar(id, {objetivo: portada, modo: modoM, favicon: false});
    } catch (_) {}
  }
  function avisar(t) { aviso = t || ''; $('aviso').textContent = aviso; }

  async function cargarCatalogo() {
    try {
      const indice = await (await fetch('/marcablanca/clientes/index.json', {credentials: 'omit'})).json();
      const ids = (indice.clientes || []).map((c) => c.id).filter((id) => id !== indice.porDefecto);
      const marcas = await Promise.all(ids.map((id) => fetch(`/marcablanca/clientes/${id}.json`, {credentials: 'omit'}).then((r) => r.json()).then((j) => normalizarMarca(j)).catch(() => null)));
      marcas.filter(Boolean).forEach((m) => catalogo.set(m.id, m));
    } catch (_) { avisar('No se pudo leer el catálogo de /marcablanca; puedes crear una nueva marca.'); }
    const chips = [...catalogo.values()].map((m) => { const p = m.colores[m.modo]; return `<button type="button" role="radio" class="pp-marca" data-elegir-marca="${esc(m.id)}" aria-checked="false"><span class="pp-chip-logo" data-pp-logo="${esc(m.id)}" style="background:${p.fondo};color:${p.texto}"><span class="mb-logo" data-mb-logo></span></span><b>${esc(m.nombre)}</b><small>${esc(m.sector || '')}</small><span class="pp-mini">${['primario', 'secundario', 'acento'].map((k) => `<i style="background:${p[k]}"></i>`).join('')}</span></button>`; });
    const actual = estado.actual ? `<button type="button" role="radio" class="pp-marca pp-actual" data-elegir-marca="actual" aria-checked="false"><b>Conservar la actual</b><small>${esc(estado.actual.nombre || estado.actual.marca)}</small></button>` : '';
    $('marcas').innerHTML = actual + chips.join('') + `<button type="button" role="radio" class="pp-marca pp-mas" data-elegir-marca="nueva" aria-checked="false"><span class="pp-chip-logo">＋</span><b>Nueva marca</b><small>Nombre, logo, colores y tipografía</small></button>`;
    try { const MB = await cargarMarcaBlanca(); for (const m of catalogo.values()) MB.aplicar(m.id, {objetivo: raiz.querySelector(`[data-pp-logo="${m.id}"]`), modo: m.modo, favicon: false}); } catch (_) {}
    pintar();
  }

  raiz.addEventListener('click', async (e) => {
    const chip = e.target.closest('[data-elegir-marca]');
    if (chip) { estado.marca = chip.dataset.elegirMarca; avisar(''); if (estado.marca === 'nueva' && !estado.nueva.nombre && o.nombreCliente) estado.nueva.nombre = o.nombreCliente(); pintar(); o.onCambio?.(estado); return; }
    const accion = e.target.closest('button[data-pp]')?.dataset.pp;
    if (accion === 'deLogo') {
      const src = estado.nueva.logoData || estado.nueva.logoUrl;
      if (!src) return avisar('Sube un logo o pega su URL para sacar la paleta.');
      try { Object.assign(estado.nueva, paletaDesdeColores(await coloresDeImagen(src))); avisar('Paleta extraída del logo. Retócala si hace falta.'); pintar(); }
      catch (_) { avisar('No se puede leer ese logo desde el navegador (otro dominio sin permiso). Súbelo como archivo o usa «Extraer de la web».'); }
    } else if (accion === 'deWeb') {
      const url = (estado.nueva.web || (o.webCliente ? o.webCliente() : '')).trim();
      if (!url) return avisar('Indica la web del prospect (o la web oficial arriba).');
      avisar('Analizando la web del prospect…');
      try {
        const r = await fetch('/presentaciones/api/inspiration', {method: 'POST', headers: {'content-type': 'application/json', accept: 'application/json'}, body: JSON.stringify({url: /^https?:\/\//.test(url) ? url : 'https://' + url})});
        const body = await r.json().catch(() => ({})); if (!r.ok) throw new Error(body.error || `HTTP ${r.status}`);
        const ins = body.inspiration || {};
        const pal = paletaDesdeColores([ins.primary, ins.accent, ...(ins.palette || [])].filter(Boolean));
        Object.assign(estado.nueva, {primario: hexOk(ins.primary) ? ins.primary.toUpperCase() : pal.primario, secundario: pal.secundario, acento: hexOk(ins.accent) ? ins.accent.toUpperCase() : pal.acento, tipografia: TIPO_DESDE_WEB[ins.fontStyle] || estado.nueva.tipografia, modo: ins.mode === 'dark' ? 'oscuro' : ins.mode === 'light' ? 'claro' : estado.nueva.modo});
        if (!estado.nueva.nombre && ins.title) estado.nueva.nombre = String(ins.title).split(/[|·–-]/)[0].trim().slice(0, 80);
        if (!estado.nueva.logoData && !estado.nueva.logoUrl && ins.logo) {
          if (ins.logo.type === 'url' && /^https:\/\//.test(ins.logo.url || '')) estado.nueva.logoUrl = ins.logo.url;
          else if (ins.logo.type === 'svg' && ins.logo.svg && ins.logo.svg.length < LOGO_MAX) estado.nueva.logoData = 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(ins.logo.svg)));
        }
        avisar(`Identidad sacada de ${ins.host || url}${ins.logo ? ' · logo detectado' : ''}.`); pintar();
      } catch (err) { avisar('No se pudo analizar la web: ' + (err.message || err)); }
    } else if (accion === 'json') {
      const m = marcaNueva(), blob = new Blob([JSON.stringify(m, null, 2) + '\n'], {type: 'application/json'});
      const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `${m.id}.json`; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 2000);
    } else if (accion === 'previa') {
      if (estado.marca && estado.marca !== 'nueva' && estado.marca !== 'actual') { window.open(`/marcablanca/presentacion?marca=${encodeURIComponent(estado.marca)}`, '_blank', 'noopener'); return; }
      const m = marcaNueva(), f = document.createElement('form');
      f.method = 'POST'; f.action = '/marcablanca/presentacion'; f.target = '_blank';
      const i = document.createElement('input'); i.type = 'hidden'; i.name = 'marca'; i.value = JSON.stringify(m); f.appendChild(i);
      document.body.appendChild(f); f.submit(); f.remove();
    }
  });
  raiz.addEventListener('input', (e) => {
    const k = e.target.dataset?.pp;
    if (k === 'activo') { estado.activo = e.target.checked; if (estado.activo && !estado.marca) estado.marca = estado.actual ? 'actual' : ''; pintar(); o.onCambio?.(estado); return; }
    if (['nombre', 'web', 'logoUrl', 'primario', 'secundario', 'acento', 'tipografia', 'modo'].includes(k)) {
      estado.nueva[k] = e.target.value; if (k === 'logoUrl') estado.nueva.logoData = '';
      if (k !== 'nombre' && k !== 'web' && k !== 'logoUrl') pintar(); else { if (o.campo) o.campo.value = valorCampo(); clearTimeout(raiz._t); raiz._t = setTimeout(pintar, 250); }
    }
  });
  raiz.addEventListener('change', async (e) => {
    if (e.target.dataset?.pp !== 'archivo') return;
    const file = e.target.files?.[0]; if (!file) return;
    if (file.type === 'image/svg+xml' && file.size > LOGO_MAX) return avisar('El SVG supera 120 KB.');
    try {
      const data = await aligerar(await leerArchivo(file));
      if (data.length * 0.75 > LOGO_MAX) return avisar('El logo sigue pasando de 120 KB incluso reducido; prueba con otro archivo.');
      estado.nueva.logoData = data; estado.nueva.logoUrl = ''; $('logoUrl').value = '';
      try { Object.assign(estado.nueva, paletaDesdeColores(await coloresDeImagen(data))); avisar('Logo cargado y paleta extraída automáticamente. Retócala si hace falta.'); } catch (_) { avisar('Logo cargado.'); }
      pintar();
    } catch (_) { avisar('No se pudo leer el logo.'); }
  });

  const api = {
    activo: () => estado.activo && Boolean(estado.marca),
    estado: () => JSON.parse(JSON.stringify(estado)),
    valor: valorCampo,
    elegir(marca) { estado.activo = true; estado.marca = marca; pintar(); },
    nueva(datos) { estado.activo = true; estado.marca = 'nueva'; Object.assign(estado.nueva, datos || {}); pintar(); },
    /** Al «Mejorar» una presentación existente: ofrece conservar su marca de prospect. */
    conActual(resumen) { estado.actual = resumen?.activo ? resumen : null; estado.activo = Boolean(estado.actual); estado.marca = estado.actual ? 'actual' : ''; cargarCatalogo(); },
    apagar() { estado.activo = false; estado.marca = ''; pintar(); }
  };
  cargarCatalogo();
  pintar();
  return api;
}

/* ── Generador: el panel entra en el formulario como sección propia ───────── */
function montarEnGenerador() {
  const form = document.getElementById('generator');
  if (!form || form.querySelector('.prospect-panel')) return;
  const seccion = document.createElement('section');
  seccion.className = 'panel prospect-section';
  seccion.id = 'generatorProspect';
  seccion.innerHTML = '<h2>Prospect · marca del destinatario</h2><p class="sub">Si la presentación va para un cliente potencial, se viste con su marca de principio a fin. Sin prospect, todo sigue con la marca Admira. Con prospect, la web oficial pasa a ser opcional.</p><div data-prospect-root></div><input type="hidden" name="prospect" value="">';
  const contexto = form.querySelector(':scope > .panel');
  if (contexto) contexto.after(seccion); else form.prepend(seccion);
  const campo = seccion.querySelector('input[name="prospect"]');
  const api = montarProspect(seccion.querySelector('[data-prospect-root]'), {
    modo: 'generador', campo,
    nombreCliente: () => document.getElementById('displayName')?.value.trim() || '',
    webCliente: () => document.getElementById('website')?.value.trim() || ''
  });
  window.AdmiraProspect = api;
  // «Mejorar» desde el censo: si la presentación ya tenía prospect, se ofrece conservarlo.
  const pick = document.getElementById('catalogPick');
  let censo = null;
  pick?.addEventListener('change', async () => {
    if (!pick.value) { api.conActual(null); return; }
    try { censo = censo || (await (await fetch('/presentaciones/api/clients', {headers: {accept: 'application/json'}, cache: 'no-store'})).json()).clients || []; } catch (_) { censo = []; }
    api.conActual((censo.find((c) => c.slug === pick.value) || {}).prospect || null);
  });
}

if (document.getElementById('generator')) {
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', montarEnGenerador); else montarEnGenerador();
}
if (typeof window !== 'undefined') window.montarProspect = montarProspect;
