/* maquetas.js · v1.1.0 · Galaxia Admira
 Maquetas de las cuatro webs (Studio crea · Store distribuye · Biz comercializa · App mantiene).
 Los id internos `app` y `yokup` son los tokens del cargador; el dominio visible es el de la pata.
 pintadas SOLO con tokens --mb-* y componentes de marcablanca.css. Las usan /marcablanca (demo) y
 las presentaciones con prospect (el servidor las pinta con la marca del destinatario).
   import { pintar, PLATAFORMAS } from '/marcablanca/maquetas.js';
   pintar('store', marca, { logo: '<svg…>' })  → HTML (requiere marcablanca.css + maquetas.css)
 El logo es opcional: si no se pasa, marcablanca.js rellena los [data-mb-logo]. */
var LOGO = '';
var N = 0;
var PLATAFORMAS = [
  { id: 'studio', nombre: 'admira.studio', verbo: 'crea', dominio: 'admira.studio', ruta: '/crear' },
  { id: 'store', nombre: 'admira.store', verbo: 'distribuye', dominio: 'admira.store', ruta: '/gemelos' },
  { id: 'tv', nombre: 'admira.tv', verbo: 'emite', dominio: 'admira.tv', ruta: '/' },
  { id: 'app', nombre: 'admira.biz', verbo: 'comercializa', dominio: 'admira.biz', ruta: '/' },
  { id: 'yokup', nombre: 'admira.app', verbo: 'mantiene', dominio: 'admira.app', ruta: '/incidencias' }
];

var ESTADOS = { abierta: ['error', 'Abierta'], curso: ['aviso', 'En curso'], resuelta: ['ok', 'Resuelta'] };

function esc(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
    return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
  });
}
function corto(nombre, m) { return String(nombre).replace(m.nombre.split(' ')[0], '').trim() || nombre; }
function estado(clave) { var e = ESTADOS[clave] || ESTADOS.abierta; return '<span class="mb-estado mb-estado--' + e[0] + '">' + e[1] + '</span>'; }

/* ── Studio · crea ─────────────────────────────────────────────────────── */
function studio(m) {
  var x = m.demo;
  return '<div class="st">' +
    '<header class="st-top"><span class="st-ico">▤</span><span class="mb-logo st-logo" data-mb-logo>' + LOGO + '</span>' +
    '<span class="mk-plat">Studio</span>' +
    '<nav class="st-nav"><a>AUDIO</a><a>MÚSICA</a><a aria-current="page">IMÁGENES</a><a>VÍDEO</a><a>ASSETS</a></nav>' +
    '<span class="st-cta">CONTACTO</span></header>' +
    '<div class="st-head"><h4 class="mk-h">' + esc(m.nombreCorto || m.nombre) + ' Studio · Assets</h4>' +
    '<div class="st-tabs"><b>Creación</b><span>Edición</span><span>Redistribución</span><span>Marketplace</span></div></div>' +
    '<div class="st-cols">' +
      '<section class="st-card"><div class="mk-eye">Tipo de pieza</div>' +
        '<div class="st-item on"><i>DX</i><div><b>Cartel DOOH</b><small>Pantallas y escaparates</small></div></div>' +
        '<div class="st-item"><i>VV</i><div><b>Vídeo vertical</b><small>9:16 · 10 segundos</small></div></div>' +
        '<div class="st-item"><i>MN</i><div><b>Menú digital</b><small>Precios en vivo</small></div></div>' +
        '<div class="st-tags"><span class="mb-chip">Fondo alpha</span><span class="mb-chip mb-chip--on">Marca aplicada</span></div>' +
      '</section>' +
      '<section class="st-card"><div class="mk-eye">Brief de pieza</div>' +
        '<label>Nombre</label><div class="mk-in">' + esc(x.piezas[0]) + '</div>' +
        '<div class="st-2"><div><label>Formato</label><div class="mk-in">9:16 · 1080×1920</div></div><div><label>Duración</label><div class="mk-in">10 s</div></div></div>' +
        '<label>Prompt para IA</label><div class="mk-in mk-ta">' + esc(x.prompt) + '</div>' +
        '<div class="st-btns"><span class="mb-btn mb-btn--primario">Generar con IA</span><span class="mb-btn mb-btn--borde">Subir PNG</span></div>' +
      '</section>' +
      '<section class="st-card"><div class="mk-eye">Resultado</div>' +
        '<div class="st-poster"><span class="mb-logo st-poster-logo" data-mb-logo>' + LOGO + '</span>' +
        '<strong class="mk-tit">' + esc(x.titular) + '</strong><span class="st-prod">' + esc(x.producto) + '</span>' +
        '<span class="st-pcta">' + esc(x.cta) + '</span></div>' +
        '<div class="st-res"><span class="mb-estado mb-estado--ok">Lista para distribuir</span></div>' +
        '<span class="mb-btn mb-btn--primario st-full">Enviar a Store →</span>' +
      '</section>' +
    '</div></div>';
}

/* ── Store · distribuye ────────────────────────────────────────────────── */
function store(m) {
  var x = m.demo, t = x.tiendas, s = x.superficiesTipo, p = x.piezas;
  var filas = [
    [p[0], s[0], t[0].nombre, '09:12', 'ok', 'Confirmada'],
    [p[1], s[1], t[1].nombre, '09:14', 'ok', 'Confirmada'],
    [p[2], s[2], t[2].nombre, '09:15', 'info', 'En cola'],
    [p[0], s[1], t[2].nombre, '09:16', 'aviso', 'Reintento']
  ].map(function (f) {
    return '<tr><td>' + esc(f[0]) + '</td><td>' + esc(f[1]) + '</td><td>' + esc(corto(f[2], m)) + '</td><td class="mk-num">' + f[3] +
      '</td><td><span class="mb-estado mb-estado--' + f[4] + '">' + f[5] + '</span></td></tr>';
  }).join('');
  var tarjetas = t.map(function (ti, i) {
    var n = [6, 5, 4][i], vivos = [6, 4, 4][i];
    return '<div class="so-card"><div class="mk-eye">' + esc(x.tipoEspacio) + ' · gemelo</div><b>' + esc(ti.nombre) + '</b><small>' + esc(ti.dir) + '</small>' +
      '<div class="so-chips"><span class="mb-chip">' + n + ' superficies</span><span class="mb-chip so-vivo">● ' + vivos + ' en vivo</span></div></div>';
  }).join('');
  return '<div class="so">' +
    '<header class="so-top"><span class="mb-logo so-logo" data-mb-logo>' + LOGO + '</span><span class="mk-plat">Store</span>' +
    '<nav class="so-nav"><a>Caso de éxito</a><a>Plataforma</a><a aria-current="page">Gemelos</a><a>Publicidad</a></nav>' +
    '<span class="so-lang">ENG</span><span class="so-cta">CONTACTO</span></header>' +
    '<div class="so-body">' +
      '<div class="so-pill">● EN PRODUCCIÓN · ' + esc(x.puntos) + ' GEMELOS · ' + esc(x.superficies) + ' SUPERFICIES EN VIVO</div>' +
      '<div class="so-row"><h4 class="mk-h">Despacho al gemelo</h4><span class="mb-estado mb-estado--ok">En vivo</span></div>' +
      '<p class="so-p">Creado en Studio → despachado aquí → confirmado por la superficie. La misma pieza, el mismo id, de punta a punta.</p>' +
      '<table class="mb-tabla so-tab"><thead><tr><th>Pieza</th><th>Superficie</th><th>Tienda</th><th>Hora</th><th>Estado</th></tr></thead><tbody>' + filas + '</tbody></table>' +
      '<div class="so-cards">' + tarjetas + '</div>' +
      '<div class="so-btns"><span class="mb-btn mb-btn--primario">Supervisar un espacio →</span><span class="mb-btn mb-btn--borde">Abrir el gemelo</span></div>' +
    '</div></div>';
}

/* ── Token app · maqueta de campaña (DooH, admira.biz) ─────────────────── */
function mapa() {
  var calles = [
    'M-10 120 C 120 90, 220 160, 360 120 S 560 60, 700 110',
    'M-10 260 C 140 230, 260 300, 420 250 S 600 210, 700 240',
    'M120 -10 C 140 120, 90 240, 150 420',
    'M330 -10 C 300 120, 380 240, 330 420',
    'M520 -10 C 540 140, 480 260, 560 420',
    'M-10 360 L 700 330'
  ].map(function (dd, i) { return '<path d="' + dd + '" class="ap-calle' + (i < 2 ? ' ap-calle--gr' : '') + '"/>'; }).join('');
  var marcas = [[205, 150, 18], [395, 205, 7], [470, 105, 11], [560, 270, 4], [270, 300, 2], [610, 150, 3]].map(function (c) {
    var r = c[2] > 9 ? 17 : c[2] > 3 ? 14 : 11;
    return '<g class="ap-pin"><circle cx="' + c[0] + '" cy="' + c[1] + '" r="' + (r + 6) + '" class="ap-halo"/><circle cx="' + c[0] + '" cy="' + c[1] + '" r="' + r +
      '"/><text x="' + c[0] + '" y="' + (c[1] + 4) + '">' + c[2] + '</text></g>';
  }).join('');
  return '<svg class="ap-svg" viewBox="0 0 680 400" preserveAspectRatio="xMidYMid slice" aria-hidden="true">' +
    '<defs><pattern id="apGrid' + (++N) + '" width="34" height="34" patternUnits="userSpaceOnUse"><path d="M34 0H0V34" class="ap-rej"/></pattern></defs>' +
    '<rect width="680" height="400" fill="url(#apGrid' + N + ')"/>' +
    '<path d="M420 -10 C 470 90, 640 120, 700 200 L700 -10 Z" class="ap-parque"/>' +
    '<path d="M-10 300 C 90 280, 160 340, 240 410 L -10 410 Z" class="ap-agua"/>' + calles + marcas + '</svg>';
}
function app(m) {
  var x = m.demo;
  var filas = [[x.piezas[0], 'ok', 'Emitiendo'], [x.piezas[1], 'aviso', 'Pendiente'], [x.piezas[2], 'error', 'Rechazada']].map(function (f) {
    return '<tr><td>' + esc(f[0]) + '</td><td><span class="mb-estado mb-estado--' + f[1] + '">' + f[2] + '</span></td></tr>';
  }).join('');
  return '<div class="ap">' +
    '<header class="ap-top"><span class="ap-btn">☰</span><span class="mb-logo ap-logo" data-mb-logo>' + LOGO + '</span><span class="mk-plat">App</span>' +
    '<div class="ap-search"><span>⌕</span> Buscar Xpace · «' + esc(corto(x.tiendas[0].nombre, m)) + '», «' + esc(corto(x.tiendas[1].nombre, m)) + '» o cualquier dirección</div>' +
    '<span class="ap-login">Login</span><span class="ap-btn">▤</span><span class="ap-btn">⌘</span></header>' +
    '<div class="ap-map">' + mapa() +
      '<aside class="ap-panel"><div class="mk-eye">Planificar campaña</div>' +
        '<label>Circuito</label><div class="mk-in mk-sel">' + esc(x.circuito) + '</div>' +
        '<label>Target</label><div class="ap-chips"><span class="mb-chip mb-chip--on">Joven 15-30</span><span class="mb-chip">Adulto 30-50</span><span class="mb-chip mb-chip--on">Mañana 08-12</span><span class="mb-chip">Tarde</span></div>' +
        '<div class="ap-kpis"><div><b>' + esc(x.puntos) + '</b><small>puntos</small></div><div><b>' + esc(x.imprDia) + '</b><small>impr/día</small></div><div><b>' + esc(x.cpm) + '</b><small>CPM</small></div></div>' +
        '<div class="ap-btns"><span class="mb-btn mb-btn--primario">＋ Crear campaña</span><span class="mb-btn mb-btn--borde">Comparar</span></div>' +
      '</aside>' +
      '<div class="ap-tools"><span>3D</span><span>ISO</span><span>＋</span><span>−</span></div>' +
      '<div class="ap-live"><div class="mk-eye"><i class="ap-dot"></i>Pujas en vivo</div>' +
        '<div class="ap-lrow"><span>impr/min</span><b>▲ 1.284</b></div><div class="ap-lrow"><span>Xpaces</span><b>' + esc(x.puntos) + '</b></div><div class="ap-lrow"><span>€ vendido hoy</span><b>3.420</b></div></div>' +
      '<div class="ap-req"><div class="mk-eye">Mis solicitudes</div><table class="mb-tabla">' + filas + '</table></div>' +
    '</div></div>';
}

/* ── admira.tv · emite ─────────────────────────────────────────────────── */
function tv(m) {
  return '<div class="st">' +
    '<header class="st-top"><span class="st-ico">▶</span><span class="mb-logo st-logo" data-mb-logo>' + LOGO + '</span>' +
    '<span class="mk-plat">admira.tv</span>' +
    '<nav class="st-nav"><a aria-current="page">EMISIÓN</a><a>PLAYLIST</a><a>PROOF</a></nav>' +
    '<span class="st-cta">EN AIRE</span></header>' +
    '<div class="st-head"><h4 class="mk-h">' + esc(m.nombreCorto || m.nombre) + ' · en emisión</h4>' +
    '<div class="st-tabs"><b>Ahora</b><span>Siguiente</span><span>Proof of play</span></div></div>' +
    '<section class="st-card"><div class="mk-eye">Pantalla</div><div class="mk-in">Hilo y visual de ' + esc(m.nombre) + '</div>' +
    '<div class="st-tags"><span class="mb-chip mb-chip--on">Emitiendo</span><span class="mb-chip">Proof of play</span></div></section></div>';
}

/* ── admira.app · mantiene (token interno del cargador) ────────────────── */
function yokup(m) {
  var x = m.demo;
  var filas = x.incidencias.map(function (i) {
    return '<tr><td class="mk-num">' + esc(i.id) + '</td><td>' + esc(i.equipo) + '</td><td>' + esc(corto(i.tienda, m)) + '</td><td>' + esc(i.prioridad) + '</td><td>' + estado(i.estado) + '</td></tr>';
  }).join('');
  return '<div class="yk">' +
    '<header class="yk-top"><span class="yk-ico">▤</span><span class="mb-logo yk-logo" data-mb-logo>' + LOGO + '</span><span class="mk-plat">admira.app</span>' +
    '<nav class="yk-nav"><a>DASHBOARD</a><a>MISIONES</a><a aria-current="page">INCIDENCIAS</a><a>INFORMES</a></nav>' +
    '<span class="yk-pill">● TODOS</span></header>' +
    '<div class="yk-body">' +
      '<div class="yk-hero"><div><div class="mb-eyebrow">Soporte · incidencias</div>' +
        '<h4 class="yk-h1">Incidencias.<span>Todo lo que falla, en un solo sitio.</span></h4>' +
        '<p>Pantallas, hilo musical, climatización y redes de ' + esc(m.nombre) + '. La IA las diagnostica y asigna técnico.</p></div>' +
        '<div class="yk-kb"><div class="mk-eye">Base de conocimiento · IA</div><b>Pregunta a la base de conocimiento</b>' +
        '<div class="yk-ask"><div class="mk-in">p. ej. «pantalla sin red»</div><span class="mb-btn mb-btn--primario">Preguntar</span></div></div></div>' +
      '<div class="yk-kpis"><div class="yk-kpi"><span><i class="yk-d e"></i>Abiertas</span><b>7</b></div><div class="yk-kpi"><span><i class="yk-d a"></i>En curso</span><b>3</b></div><div class="yk-kpi"><span><i class="yk-d o"></i>Resueltas</span><b>41</b></div></div>' +
      '<div class="yk-new"><b>Comunicar una incidencia</b><div class="yk-form"><div class="mk-in">Nueva incidencia…</div><div class="mk-in mk-sel">Pantalla</div><div class="mk-in mk-sel">Alta</div><span class="mb-btn mb-btn--primario">Crear incidencia</span></div></div>' +
      '<div class="yk-tray"><div class="yk-trh"><b>Bandeja de incidencias</b><span class="yk-frase" data-mb-frase="vacio"></span></div>' +
      '<table class="mb-tabla"><thead><tr><th>ID</th><th>Equipo</th><th>Tienda</th><th>Prioridad</th><th>Estado</th></tr></thead><tbody>' + filas + '</tbody></table></div>' +
    '</div></div>';
}


var PINTORES = { studio: studio, store: store, tv: tv, app: app, yokup: yokup };

/** HTML de la maqueta `id` vestida con la marca `m` (un cliente normalizado con su `demo`). */
export function pintar(id, m, o) {
if (!PINTORES[id]) throw new Error('maquetas: plataforma desconocida «' + id + '»');
LOGO = (o && o.logo) || '';
try { return PINTORES[id](m); } finally { LOGO = ''; }
}
/** URL de ejemplo que muestra la barra del navegador de la maqueta. */
export function urlDe(id, marcaId) {
var p = PLATAFORMAS.filter(function (x) { return x.id === id; })[0];
return p ? (marcaId === 'admira' ? '' : marcaId + '.') + p.dominio + p.ruta : '';
}
export { PLATAFORMAS, esc };
if (typeof window !== 'undefined') window.MarcaBlancaMaquetas = { pintar: pintar, urlDe: urlDe, PLATAFORMAS: PLATAFORMAS };
