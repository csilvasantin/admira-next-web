// completa.js · ayuda + formulario de la DEMO COMPLETA (merovingio · 06-10-2026).
// Pestañas por hash (#ayuda · #formulario · #rapida), búsqueda de establecimientos
// (localizador oficial guardado en /demo/data o OpenStreetMap), plan en seco con el
// mismo módulo que usa la API (plan-completa.mjs) y envío a /api/demo con modo:"completa".
// v2: altavoz con 2 playlists (hilo continuo + locuciones TPV), marca blanca real (/marca <id>),
// contenido común de marca y desconexiones temporales preparadas (apagadas).
import { construirPlan, slug, MINIMOS } from '/demo/plan-completa.mjs?v=20261006-completa-v2';

const $ = (id) => document.getElementById(id);
const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

// ─── pestañas ────────────────────────────────────────────────────────────────
const PANELES = ['ayuda', 'formulario', 'rapida'];
function mostrar(id) {
  const actual = PANELES.includes(id) ? id : 'ayuda';
  for (const p of PANELES) {
    const panel = $(p); const tab = $(`tab-${p}`);
    if (panel) panel.hidden = p !== actual;
    if (tab) { tab.setAttribute('aria-selected', String(p === actual)); tab.classList.toggle('on', p === actual); }
  }
}
window.addEventListener('hashchange', () => mostrar(location.hash.slice(1)));
mostrar(location.hash.slice(1));

// ─── datos conocidos (localizador oficial guardado) ──────────────────────────
const CONOCIDOS = { '365|barcelona': '/demo/data/365-barcelona.json' };

const form = $('completaForm');
const estado = $('c_estado');
const lista = $('c_lista');
const tbody = lista.querySelector('tbody');
let encontrados = [];   // [{…establecimiento, usar:boolean}]
let ultimoPlan = null;

function aviso(texto, tipo = '') { estado.textContent = texto; estado.className = `estado ${tipo}`.trim(); }

const syncColor = () => { $('c_colorHex').textContent = ($('c_color').value || '').toUpperCase(); };
$('c_color').addEventListener('input', syncColor);
// Marca blanca: siempre la del cliente. El comando se ve en vivo según el nombre.
const syncMarca = () => { $('c_marca_cmd').textContent = `/marca ${slug($('c_cliente').value) || '<cliente>'}`; };
$('c_cliente').addEventListener('input', syncMarca);
const syncSim = () => {
  const sim = $('c_simulacion').checked;
  $('c_enviar').textContent = sim ? 'Guardar simulación' : 'Encolar demo completa (REAL)';
  $('c_enviar').classList.toggle('peligro', !sim);
};
$('c_simulacion').addEventListener('change', syncSim);

function contar() {
  const n = encontrados.filter((e) => e.usar).length;
  const pedidos = Math.max(MINIMOS.establecimientos, Number($('c_n').value) || MINIMOS.establecimientos);
  const c = $('c_cuenta');
  c.textContent = `${n} elegidos · pedidos ${pedidos}`;
  c.className = `cuenta ${n >= pedidos ? 'ok' : 'err'}`;
}
$('c_n').addEventListener('input', contar);

function pintarLista() {
  lista.hidden = encontrados.length === 0;
  tbody.innerHTML = encontrados.map((e, i) => {
    const osm = Number.isFinite(e.lat) ? `https://www.openstreetmap.org/?mlat=${e.lat}&mlon=${e.lng}#map=18/${e.lat}/${e.lng}` : '';
    if (e.manual) {
      return `<tr class="manual"><td><input type="checkbox" data-i="${i}" ${e.usar ? 'checked' : ''} aria-label="Usar establecimiento ${i + 1}"></td>
        <td><input class="mini" data-i="${i}" data-k="direccion" value="${esc(e.direccion)}" placeholder="Dirección" aria-label="Dirección"></td>
        <td><input class="mini num" data-i="${i}" data-k="lat" value="${Number.isFinite(e.lat) ? e.lat : ''}" placeholder="lat" aria-label="Latitud">
            <input class="mini num" data-i="${i}" data-k="lng" value="${Number.isFinite(e.lng) ? e.lng : ''}" placeholder="lng" aria-label="Longitud"></td>
        <td>${osm ? `<a href="${osm}" target="_blank" rel="noopener">OSM ↗</a>` : '—'}</td></tr>`;
    }
    return `<tr class="${e.usar ? 'sel' : ''}"><td><input type="checkbox" data-i="${i}" ${e.usar ? 'checked' : ''} aria-label="Usar ${esc(e.nombre)}"></td>
      <td><b>${esc(e.nombre)}</b>${e.sugerido ? ' <i class="chip">sugerido</i>' : ''}<br><small>${esc([e.direccion, e.cp, e.barrio].filter(Boolean).join(' · '))}</small></td>
      <td><code>${Number(e.lat).toFixed(5)}, ${Number(e.lng).toFixed(5)}</code></td>
      <td><a href="${osm}" target="_blank" rel="noopener">OSM ↗</a></td></tr>`;
  }).join('');
  contar();
}
tbody.addEventListener('change', (ev) => {
  const t = ev.target; const i = Number(t.dataset.i);
  if (!encontrados[i]) return;
  if (t.type === 'checkbox') { encontrados[i].usar = t.checked; t.closest('tr').classList.toggle('sel', t.checked); contar(); return; }
  const k = t.dataset.k;
  if (k === 'lat' || k === 'lng') encontrados[i][k] = Number(String(t.value).replace(',', '.'));
  else if (k) { encontrados[i][k] = t.value; encontrados[i].nombre = `${$('c_cliente').value.trim()} · ${t.value}`; }
});

$('c_manual').addEventListener('click', () => {
  encontrados.push({ manual: true, usar: true, direccion: '', lat: NaN, lng: NaN, fuente: 'manual' });
  pintarLista();
});

async function buscarOverpass(marca, ciudad) {
  const re = marca.replace(/[\\"^$.*+?()[\]{}|]/g, '');
  const q = `[out:json][timeout:25];area["name"="${ciudad.replace(/"/g, '')}"]["boundary"="administrative"]->.a;`
    + `(nwr(area.a)["brand"~"^${re}$",i];nwr(area.a)["name"~"^${re}( |$)",i]["shop"];nwr(area.a)["name"~"^${re}( |$)",i]["amenity"];);out center tags 80;`;
  const r = await fetch('https://overpass-api.de/api/interpreter', { method: 'POST', body: new URLSearchParams({ data: q }) });
  if (!r.ok) throw new Error(`OpenStreetMap respondió ${r.status}`);
  const d = await r.json();
  const vistos = new Set();
  return (d.elements || []).map((el) => {
    const t = el.tags || {}; const c = el.center || el;
    const dir = [t['addr:street'], t['addr:housenumber']].filter(Boolean).join(', ');
    return {
      ref: `osm-${el.type}-${el.id}`, nombre: `${t.name || marca}${dir ? ` · ${dir}` : ''}`, direccion: dir || t.name || '',
      cp: t['addr:postcode'] || '', lat: Number(c.lat), lng: Number(c.lon),
      fuente: 'OpenStreetMap (Overpass)', fuente_url: `https://www.openstreetmap.org/${el.type}/${el.id}`,
    };
  }).filter((e) => Number.isFinite(e.lat) && !vistos.has(e.ref) && vistos.add(e.ref));
}

async function buscar({ silencioso = false } = {}) {
  const marca = $('c_cliente').value.trim();
  const ciudad = $('c_ciudad').value.trim();
  if (!marca || !ciudad) { aviso('Escribe la marca y la ciudad para buscar.', 'err'); return; }
  const btn = $('c_buscar'); btn.disabled = true;
  if (!silencioso) aviso(`Buscando ${marca} en ${ciudad}…`);
  try {
    const clave = `${slug(marca)}|${slug(ciudad)}`;
    let res = []; let fuente = '';
    if (CONOCIDOS[clave]) {
      const d = await (await fetch(CONOCIDOS[clave])).json();
      res = d.establecimientos.map((e) => ({ ...e, fuente: d.fuente, fuente_url: d.fuente_url }));
      fuente = `${d.total} locales · ${d.fuente} (consultado ${d.consultado}) · <a href="${esc(d.fuente_url)}" target="_blank" rel="noopener">fuente ↗</a>`;
    } else {
      res = await buscarOverpass(marca, ciudad);
      fuente = `${res.length} resultados · OpenStreetMap (Overpass). Revisa que sean de la marca.`;
    }
    const pedidos = Math.max(MINIMOS.establecimientos, Number($('c_n').value) || MINIMOS.establecimientos);
    const manuales = encontrados.filter((e) => e.manual);
    const haySugeridos = res.some((e) => e.sugerido);
    encontrados = res.map((e, i) => ({ ...e, usar: haySugeridos ? Boolean(e.sugerido) : i < pedidos })).concat(manuales);
    $('c_fuente').innerHTML = fuente;
    pintarLista();
    if (!silencioso) aviso(res.length ? `Encontrados ${res.length}. Marcados ${encontrados.filter((e) => e.usar).length}.` : 'Sin resultados: añade los locales a mano.', res.length ? 'ok' : 'err');
  } catch (e) {
    aviso(`No se pudo buscar (${e.message}). Añade los locales a mano.`, 'err');
  } finally { btn.disabled = false; }
}
$('c_buscar').addEventListener('click', () => buscar());

function leer() {
  return {
    modo: 'completa',
    cliente: $('c_cliente').value.trim(),
    website: $('c_website').value.trim(),
    color: ($('c_color').value || '').toUpperCase(),
    franquicia: $('c_franquicia').checked,
    marca: { modo: 'marca-blanca-cliente' },
    ciudad: { nombre: $('c_ciudad').value.trim(), pais: $('c_pais').value },
    n_establecimientos: Number($('c_n').value) || MINIMOS.establecimientos,
    establecimientos: encontrados.filter((e) => e.usar).map(({ usar, manual, ...e }) => e),
    xpacio_tipo: form.querySelector('input[name="c_xpacio_tipo"]:checked')?.value || 'cafeteria',
    xpacio_subtipo: $('c_subtipo').value.trim(),
    dispositivos: [...form.querySelectorAll('input[name="disp"]:checked')].map((c) => c.value),
    idiomas: [...form.querySelectorAll('input[name="c_idioma"]:checked')].map((c) => c.value),
    contenidos_por_playlist: Number($('c_contenidos').value) || MINIMOS.contenidos,
    cierre: $('c_cierre').value || '21:00',
    fuente_contenido: form.querySelector('input[name="fuente"]:checked')?.value || 'pixeria',
    contenidos_compartidos: true,
    desconexiones: [],   // próximamente (la opción del formulario está apagada)
    simulacion: $('c_simulacion').checked,
    notas: $('c_notas').value.trim(),
  };
}

const BADGE = { LISTO: 'listo', PARCIAL: 'parcial', FALTA: 'falta', PROXIMAMENTE: 'pro' };
const plTxt = (x) => `<code>${esc(x.playlist)}</code>${x.reproduccion === 'bajo_demanda' ? ' <i class="chip tpv">TPV · bajo demanda</i>' : ''} (${x.contenidos.length})`;
function pintarPlan(plan) {
  ultimoPlan = plan;
  $('c_resultado').hidden = false;
  $('c_plan_titulo').textContent = `${plan.cliente.nombre} · ${plan.ciudad.nombre} (${plan.ciudad.pais}) · ${plan.simulacion ? 'SIMULACIÓN' : 'REAL'}`;
  const t = plan.totales;
  $('c_kpis').innerHTML = [['locales', t.establecimientos], ['gemelos', t.gemelos], ['equipos ITIL', t.equipos], ['playlists', t.playlists],
    ['bajo demanda TPV', t.playlists_bajo_demanda], ['huecos', t.huecos_contenido], ['piezas de marca', t.piezas_unicas], ['plataformas /marca', t.plataformas_marca], ['desconexiones', t.desconexiones]]
    .map(([k, v]) => `<div class="kpi"><b>${v}</b><span>${k}</span></div>`).join('');
  const mb = plan.marca_blanca;
  $('c_marca_plan').innerHTML = mb ? `Marca blanca <b>${esc(mb.nombre)}</b> (real) · <code>${esc(mb.comando)}</code> → ${mb.plataformas.map((x) => esc(x.nombre)).join(' · ')}`
    + ` <i class="estado-hoy ${BADGE[mb.estado_hoy] || ''}" title="${esc(mb.falta)}">${esc(mb.estado_hoy)}</i>` : '';
  $('c_tabla_pasos').querySelector('tbody').innerHTML = plan.pasos.map((p) => `<tr><td>${p.n}</td><td><i class="chip">${esc(p.componente)}</i></td>
    <td><b>${esc(p.titulo)}</b><br><small>${esc(p.accion)}</small></td>
    <td><i class="estado-hoy ${BADGE[p.estado_hoy] || ''}" title="${esc(p.falta)}">${esc(p.estado_hoy)}</i></td></tr>`).join('');
  $('c_tabla_nombres').querySelector('tbody').innerHTML = plan.establecimientos.map((e) => `<tr><td><b>${esc(e.nombre)}</b><br><small>${esc(e.direccion)} · ${e.lat.toFixed(5)}, ${e.lng.toFixed(5)}</small></td>
    <td><code>${esc(e.id)}</code></td>
    <td>${e.equipos.map((q) => `<code>${esc(q.itil_code)}</code> → ${q.playlists.length ? q.playlists.map(plTxt).join(' + ') : '<small>sin playlist</small>'}`).join('<br>')}</td></tr>`).join('');
  $('c_json').textContent = JSON.stringify(plan, null, 2);
  $('c_descargar').disabled = false;
}

$('c_plan').addEventListener('click', () => {
  const plan = construirPlan(leer());
  pintarPlan(plan);
  if (plan.valido) aviso(`Plan listo (sin enviar): ${plan.totales.equipos} equipos, ${plan.totales.playlists} playlists (${plan.totales.playlists_bajo_demanda} bajo demanda TPV), ${plan.totales.huecos_contenido} huecos, marca ${plan.marca_blanca.comando}.`, 'ok');
  else aviso(plan.errores.join(' '), 'err');
  $('c_resultado').scrollIntoView({ behavior: 'smooth', block: 'start' });
});

$('c_descargar').addEventListener('click', () => {
  if (!ultimoPlan) return;
  const blob = new Blob([JSON.stringify(ultimoPlan, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `demo-${ultimoPlan.cliente.id}-${ultimoPlan.ciudad.corta}-plan.json`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
});

form.addEventListener('submit', async (ev) => {
  ev.preventDefault();
  const p = leer();
  const plan = construirPlan(p);
  pintarPlan(plan);
  if (!plan.valido) { aviso(plan.errores.join(' '), 'err'); return; }
  if (!p.simulacion && !window.confirm('Sin simulación la demo queda en cola para ejecutarse DE VERDAD en producción. ¿Seguro?')) return;
  const btn = $('c_enviar'); btn.disabled = true;
  aviso(p.simulacion ? 'Guardando simulación…' : 'Encolando demo completa…');
  try {
    const r = await fetch('/api/demo', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(p) });
    const data = await r.json().catch(() => ({}));
    if (!r.ok || !data.ok) throw new Error(data.error || `HTTP ${r.status}`);
    if (data.plan) pintarPlan(data.plan);
    aviso(`${data.mensaje} · id ${data.id} · estado ${data.estado}`, 'ok');
  } catch (e) {
    aviso(e.message || String(e), 'err');
  } finally { btn.disabled = false; }
});

// ─── ejemplo 365 · Barcelona ─────────────────────────────────────────────────
async function rellenar365() {
  $('c_cliente').value = '365';
  $('c_website').value = 'https://365obrador.com/';
  syncMarca();
  $('c_color').value = '#1D1D1B'; syncColor();
  $('c_franquicia').checked = true;
  $('c_ciudad').value = 'Barcelona';
  $('c_pais').value = 'ES';
  $('c_n').value = '4';
  form.querySelector('input[name="c_xpacio_tipo"][value="cafeteria"]').checked = true;
  $('c_subtipo').value = 'Panadería';
  form.querySelectorAll('input[name="c_idioma"]').forEach((c) => { c.checked = ['en', 'es'].includes(c.value); });
  $('c_contenidos').value = '3';
  $('c_cierre').value = '21:00';
  $('c_simulacion').checked = true; syncSim();
  encontrados = [];
  await buscar({ silencioso: true });
  aviso('Ejemplo 365 · Barcelona cargado: 4 locales sugeridos del localizador oficial. Pulsa «Generar plan».', 'ok');
}
for (const id of ['btn365', 'irForm365']) {
  $(id)?.addEventListener('click', (ev) => { ev.preventDefault(); location.hash = '#formulario'; rellenar365(); });
}

syncColor(); syncSim(); syncMarca();
if (!$('c_cliente').value) rellenar365().then(() => {
  if (new URLSearchParams(location.search).get('plan') === '1') $('c_plan').click();
});
