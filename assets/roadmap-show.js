/* RoadMap espectacular (06-10-2026) · escena Galaxia cyan/teal de /roadmap.
 * Lee /api/roadmap (data/roadmap.json, sin inventar nada) y pinta:
 *   contadores animados · % hecho por pata (anillos + barra de estados) · flujos SVG
 *   AdmiraNeXT → patas · raíl mensual clicable · mini-Gantt SVG por pata (swimlanes) con la
 *   línea de HOY y la banda del corte · fichas al pasar el ratón · presentador con P.
 * Respeta los filtros de ☰ Opciones (proyecto, cliente, idea): los lee de .rm-meta,
 * que pinta functions/_roadmap.js junto al corte. Sin JS, el corte del servidor sigue ahí. */
(function () {
  'use strict';
  var show = document.getElementById('rm-show');
  if (!show) return;
  var reduce = !!(window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches);
  var DAY = 86400000;
  var MES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
  var ESTADOS = [
    {id: 'hecho', nom: 'Hecho', c: '#4ae3d1'},
    {id: 'en_curso', nom: 'En curso', c: '#78f3ff'},
    {id: 'confirmado', nom: 'Confirmado', c: '#5ec8ff'},
    {id: 'propuesta', nom: 'Propuesta', c: '#b8c7da'}
  ];
  var EST = {};
  ESTADOS.forEach(function (e) { EST[e.id] = e; });
  function est(id) { return EST[id] || {id: id, nom: String(id || '—'), c: '#92a0b4'}; }

  var meta = document.querySelector('#corte .rm-meta');
  var md = (meta && meta.dataset) || {};
  var PATAS = [];
  try { PATAS = JSON.parse(md.patas || '[]'); } catch (e) { PATAS = []; }
  if (!PATAS.length) {
    PATAS = [
      {id: 'studio', nombre: 'admira.studio', claim: ''}, {id: 'store', nombre: 'admira.store', claim: ''},
      {id: 'tv', nombre: 'admira.tv', claim: ''}, {id: 'app', nombre: 'admira.app', claim: ''},
      {id: 'biz', nombre: 'admira.biz', claim: ''}, {id: 'admiranext', nombre: 'AdmiraNeXT', claim: ''}
    ];
  }
  var filtro = {
    proyecto: md.proyecto || 'todos', cliente: md.cliente || 'todos',
    idea: md.idea || 'todos', ideaNombre: md.ideaNombre || ''
  };

  var $ = function (id) { return document.getElementById(id); };
  var els = {
    live: $('rm-live'), filtro: $('rm-filtro-activo'), kpis: $('rm-kpis'), constel: $('rm-constel'),
    flows: $('rm-flows'), mesa: $('rm-mesa'), patas: $('rm-patas5'), rail: $('rm-rail'), legend: $('rm-legend'),
    wrap: $('rm-gantt-wrap'), card: $('rm-card'), caption: $('rm-caption'), presenter: $('rm-presenter'), matrix: $('rm-matrix')
  };
  var S = {all: [], list: [], hidden: {}, month: null, spot: null, pin: null, items: [], tour: null, paused: false};

  function esc(v) { return String(v == null ? '' : v).replace(/[&<>"']/g, function (c) { return {'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'}[c]; }); }
  function fecha(iso) { var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(iso || '')); return m ? Date.UTC(+m[1], +m[2] - 1, +m[3]) : NaN; }
  function hoy() {
    try { return fecha(new Intl.DateTimeFormat('en-CA', {timeZone: 'Europe/Madrid', year: 'numeric', month: '2-digit', day: '2-digit'}).format(new Date())); }
    catch (e) { var d = new Date(); return Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()); }
  }
  function dmy(t, conAno) { var d = new Date(t); return d.getUTCDate() + ' ' + MES[d.getUTCMonth()] + (conAno ? ' ' + d.getUTCFullYear() : ''); }
  function inicioMes(t) { var d = new Date(t); return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1); }
  function finMes(t) { var d = new Date(t); return Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0); }
  function sumaMes(t, n) { var d = new Date(t); return Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + n, 1); }
  function pct(a, b) { return b ? Math.round(a / b * 100) : 0; }
  function cuenta(lista) {
    var c = {total: lista.length};
    ESTADOS.forEach(function (e) { c[e.id] = 0; });
    lista.forEach(function (h) { c[h.estado] = (c[h.estado] || 0) + 1; });
    return c;
  }
  function pasa(h) {
    if (filtro.proyecto !== 'todos' && h.solucion !== filtro.proyecto) return false;
    if (filtro.cliente === 'general' && h.cliente) return false;
    if (filtro.cliente !== 'todos' && filtro.cliente !== 'general' && h.cliente !== filtro.cliente) return false;
    if (filtro.idea !== 'todos' && filtro.ideaNombre && h.idea !== filtro.ideaNombre) return false;
    return true;
  }
  function pataDe(id) { for (var i = 0; i < PATAS.length; i++) if (PATAS[i].id === id) return PATAS[i]; return {id: id, nombre: id, claim: ''}; }
  var NS = 'http://www.w3.org/2000/svg';

  // ── Contadores animados ───────────────────────────────────────────────────
  function contar(el, to, suf) {
    suf = suf || '';
    if (reduce) { el.textContent = to + suf; return; }
    var t0 = null, dur = 1100 + Math.min(900, to * 12);
    function step(t) {
      if (t0 == null) t0 = t;
      var k = Math.min(1, (t - t0) / dur), e = 1 - Math.pow(1 - k, 3);
      el.textContent = Math.round(to * e) + suf;
      if (k < 1) requestAnimationFrame(step);
    }
    requestAnimationFrame(step);
  }
  function pintarKpis() {
    var c = cuenta(S.list);
    var defs = [
      {k: 'total', n: c.total, l: 'Hitos', cls: 'is-total'},
      {k: 'hecho', n: c.hecho, l: 'Hechos', cls: 'is-hecho'},
      {k: 'en_curso', n: c.en_curso, l: 'En curso', cls: 'is-en_curso'},
      {k: 'confirmado', n: c.confirmado, l: 'Confirmados', cls: 'is-confirmado'},
      {k: 'propuesta', n: c.propuesta, l: 'Propuestas', cls: 'is-propuesta'},
      {k: 'pct', n: pct(c.hecho, c.total), l: '% completado', cls: 'is-hecho', suf: '%'}
    ];
    els.kpis.innerHTML = defs.map(function (d) { return '<div class="rm-kpi ' + d.cls + '"><b data-n="' + d.n + '" data-suf="' + (d.suf || '') + '">0' + (d.suf || '') + '</b><span>' + esc(d.l) + '</span></div>'; }).join('');
    els.kpis.querySelectorAll('b').forEach(function (b) { contar(b, +b.getAttribute('data-n'), b.getAttribute('data-suf')); });
  }

  // ── Patas: anillo de % hecho, barra de estados y chips ───────────────────
  function tarjeta(p, lista) {
    var c = cuenta(lista), r = 24, C = 2 * Math.PI * r, k = c.total ? c.hecho / c.total : 0;
    var stack = ESTADOS.map(function (e) { return '<i data-w="' + (c.total ? (c[e.id] / c.total * 100) : 0).toFixed(2) + '" style="background:' + e.c + (e.id === 'propuesta' ? ';opacity:.5' : '') + '" title="' + esc(e.nom) + ': ' + c[e.id] + '"></i>'; }).join('');
    var chips = ESTADOS.filter(function (e) { return c[e.id]; }).map(function (e) { return '<span class="rm-chip is-' + e.id + '" style="--c:' + e.c + '">' + c[e.id] + ' ' + esc(e.nom.toLowerCase()) + '</span>'; }).join('');
    return '<button type="button" class="rm-pata" data-pata="' + esc(p.id) + '" aria-pressed="false" title="Resaltar ' + esc(p.nombre) + ' en el Gantt">' +
      '<span class="rm-pata-top"><svg class="rm-ring" viewBox="0 0 58 58" aria-hidden="true"><circle class="bg" cx="29" cy="29" r="' + r + '"/>' +
      '<circle class="fg" cx="29" cy="29" r="' + r + '" stroke-dasharray="' + C.toFixed(2) + '" stroke-dashoffset="' + C.toFixed(2) + '" data-off="' + (C * (1 - k)).toFixed(2) + '"/>' +
      '<text x="29" y="29">' + pct(c.hecho, c.total) + '%</text></svg>' +
      '<span><span class="rm-pata-nom">' + esc(p.nombre) + '</span><span class="rm-pata-claim">' + esc(p.claim || '') + '</span></span></span>' +
      '<span class="rm-stack" aria-hidden="true">' + stack + '</span>' +
      '<span class="rm-chips"><span class="rm-chip" style="--c:#f2f6fc">' + c.total + ' hitos</span>' + chips + '</span></button>';
  }
  function pintarPatas() {
    var por = {};
    PATAS.forEach(function (p) { por[p.id] = []; });
    S.list.forEach(function (h) { (por[h.solucion] = por[h.solucion] || []).push(h); });
    var mesa = PATAS.filter(function (p) { return p.id === 'admiranext'; })[0];
    var cinco = PATAS.filter(function (p) { return p.id !== 'admiranext'; });
    els.mesa.innerHTML = mesa ? tarjeta(mesa, por[mesa.id] || []) : '';
    els.patas.innerHTML = cinco.map(function (p) { return tarjeta(p, por[p.id] || []); }).join('');
    requestAnimationFrame(function () {
      requestAnimationFrame(function () {
        els.constel.querySelectorAll('.rm-ring .fg').forEach(function (c) { c.setAttribute('stroke-dashoffset', c.getAttribute('data-off')); });
        els.constel.querySelectorAll('.rm-stack i').forEach(function (i) { i.style.width = i.getAttribute('data-w') + '%'; });
      });
    });
    els.constel.querySelectorAll('.rm-pata').forEach(function (b) {
      b.addEventListener('click', function () { spot(S.spot === b.getAttribute('data-pata') ? null : b.getAttribute('data-pata')); });
    });
    flujos();
  }
  // Flujos SVG: la mesa AdmiraNeXT alimenta a las cinco patas (como /organigrama).
  function flujos() {
    var svg = els.flows, base = els.constel.getBoundingClientRect();
    var from = els.mesa.querySelector('.rm-pata');
    if (!svg || !from || !base.width) { if (svg) svg.innerHTML = ''; return; }
    var f = from.getBoundingClientRect(), x1 = f.left + f.width / 2 - base.left, y1 = f.bottom - base.top;
    var html = '';
    els.patas.querySelectorAll('.rm-pata').forEach(function (b, i) {
      var r = b.getBoundingClientRect(), x2 = r.left + r.width / 2 - base.left, y2 = r.top - base.top, dy = Math.max(20, y2 - y1);
      var d = 'M' + x1.toFixed(1) + ' ' + y1.toFixed(1) + ' C' + x1.toFixed(1) + ' ' + (y1 + dy * 0.7).toFixed(1) + ' ' + x2.toFixed(1) + ' ' + (y2 - dy * 0.7).toFixed(1) + ' ' + x2.toFixed(1) + ' ' + y2.toFixed(1);
      var id = 'rmf' + i, on = S.spot === b.getAttribute('data-pata') ? ' class="is-spot"' : '';
      html += '<path id="' + id + '" d="' + d + '"' + on + '/>';
      if (!reduce) html += '<circle r="3"><animateMotion dur="2.6s" begin="' + (i * 0.35).toFixed(2) + 's" repeatCount="indefinite"><mpath href="#' + id + '"/></animateMotion></circle>';
    });
    svg.setAttribute('viewBox', '0 0 ' + base.width.toFixed(0) + ' ' + base.height.toFixed(0));
    svg.innerHTML = html;
  }

  // ── Raíl mensual ─────────────────────────────────────────────────────────
  function rango() {
    var a = Infinity, b = -Infinity;
    S.all.forEach(function (h) { var i = fecha(h.inicio), f = fecha(h.fin); if (i < a) a = i; if (f > b) b = f; });
    if (!isFinite(a)) { a = inicioMes(hoy()); b = finMes(hoy()); }
    return {desde: inicioMes(a), hasta: finMes(b)};
  }
  function meses() {
    var r = rango(), out = [];
    for (var m = r.desde; m <= r.hasta; m = sumaMes(m, 1)) out.push({desde: m, hasta: finMes(m)});
    return out;
  }
  function enRango(h, a, b) { return fecha(h.inicio) <= b && fecha(h.fin) >= a; }
  function urlCorte(extra) {
    var q = new URLSearchParams(location.search);
    Object.keys(extra).forEach(function (k) { q.set(k, extra[k]); });
    return '/roadmap?' + q.toString();
  }
  function pintarRail() {
    var t = hoy(), ms = meses();
    var html = '<button type="button" data-m="" aria-pressed="' + (S.month == null) + '"><b>Todo</b><small>' + S.list.length + ' hitos · ' + ms.length + ' meses</small><span class="bar"><i style="width:' + pct(cuenta(S.list).hecho, S.list.length) + '%"></i></span></button>';
    ms.forEach(function (m, i) {
      var dentro = S.list.filter(function (h) { return enRango(h, m.desde, m.hasta); }), c = cuenta(dentro);
      var d = new Date(m.desde), now = t >= m.desde && t <= m.hasta ? ' is-now' : '';
      html += '<button type="button" class="' + now.trim() + '" data-m="' + i + '" aria-pressed="' + (S.month === i) + '" title="Clic: enfoca el Gantt en el mes · doble clic: abre el corte del mes">' +
        '<b>' + MES[d.getUTCMonth()] + ' ' + d.getUTCFullYear() + '</b><small>' + dentro.length + ' hitos · ' + pct(c.hecho, c.total) + '% hecho</small>' +
        '<span class="bar"><i style="width:' + pct(c.hecho, c.total) + '%"></i></span></button>';
    });
    els.rail.innerHTML = html;
    els.rail.querySelectorAll('button').forEach(function (b) {
      b.addEventListener('click', function () {
        var v = b.getAttribute('data-m');
        S.month = v === '' ? null : +v;
        els.rail.querySelectorAll('button').forEach(function (x) { x.setAttribute('aria-pressed', String(x === b)); });
        gantt();
      });
      b.addEventListener('dblclick', function () {
        var v = b.getAttribute('data-m');
        if (v === '') return;
        var m = ms[+v], d = new Date(m.desde);
        location.href = urlCorte({vista: 'mes', desde: d.toISOString().slice(0, 10)});
      });
    });
  }

  // ── Leyenda (filtra estados en el Gantt) ─────────────────────────────────
  function pintarLeyenda() {
    var c = cuenta(S.list);
    els.legend.innerHTML = ESTADOS.map(function (e) {
      return '<button type="button" class="is-' + e.id + '" style="--c:' + e.c + '" data-e="' + e.id + '" aria-pressed="' + !S.hidden[e.id] + '">' + esc(e.nom) + ' · ' + c[e.id] + '</button>';
    }).join('') + '<span class="rm-hint">Pasa el ratón por un hito · clic fija la ficha · P presentador · Esc</span>';
    els.legend.querySelectorAll('button').forEach(function (b) {
      b.addEventListener('click', function () {
        var id = b.getAttribute('data-e');
        S.hidden[id] = !S.hidden[id];
        b.setAttribute('aria-pressed', String(!S.hidden[id]));
        gantt();
      });
    });
  }

  // ── Mini-Gantt SVG por pata ──────────────────────────────────────────────
  function el(tag, attrs, txt) {
    var n = document.createElementNS(NS, tag);
    Object.keys(attrs || {}).forEach(function (k) { if (attrs[k] != null) n.setAttribute(k, attrs[k]); });
    if (txt != null) n.textContent = txt;
    return n;
  }
  function gantt() {
    var wrap = els.wrap;
    ocultarFicha(true);
    var r = rango(), ms = meses();
    var a = S.month != null && ms[S.month] ? ms[S.month].desde : r.desde;
    var b = S.month != null && ms[S.month] ? ms[S.month].hasta : r.hasta;
    var dias = Math.round((b - a) / DAY) + 1;
    var W = Math.max(720, Math.floor(wrap.clientWidth || 960)), LBL = W < 820 ? 130 : 168, PADR = 14, TOP = 40, ROW = 24;
    var span = W - LBL - PADR;
    function x(t) { return LBL + (t - a) / DAY / dias * span; }
    var dayW = span / dias;
    var vis = S.list.filter(function (h) { return !S.hidden[h.estado] && enRango(h, a, b); });
    var lanes = PATAS.map(function (p) { return {p: p, hitos: vis.filter(function (h) { return h.solucion === p.id; })}; });
    if (filtro.proyecto !== 'todos') lanes = lanes.filter(function (l) { return l.hitos.length; });
    // Empaquetado: cada hito ocupa su barra y su rótulo; se busca la primera fila libre.
    var CH = 6.3, maxX = W - PADR;
    lanes.forEach(function (l) {
      var filas = [];
      l.hitos.slice().sort(function (p, q) { return fecha(p.inicio) - fecha(q.inicio) || fecha(p.fin) - fecha(q.fin); }).forEach(function (h) {
        var i0 = Math.max(fecha(h.inicio), a), f0 = Math.min(fecha(h.fin), b);
        var x0 = x(i0), x1 = Math.max(x0 + 8, x(f0 + DAY));
        var titulo = String(h.titulo || '');
        var txt = titulo.length > 46 ? titulo.slice(0, 45) + '…' : titulo;
        var lw = txt.length * CH, lado = 'r';
        if (x1 + 6 + lw > maxX) {
          if (x0 - 6 - lw >= LBL) lado = 'l';
          else if (x1 - x0 >= 70) {
            // Barra larga cortada por el borde: el rótulo va dentro de la barra.
            lado = 'in';
            var dentro = Math.floor((x1 - x0 - 14) / CH);
            if (titulo.length > dentro) txt = titulo.slice(0, Math.max(1, dentro - 1)) + '…';
            lw = 0;
          } else { var cabe = Math.max(4, Math.floor((maxX - x1 - 6) / CH)); txt = titulo.slice(0, Math.max(1, cabe - 1)) + '…'; lw = txt.length * CH; }
        }
        var o0 = lado === 'l' ? x0 - 6 - lw : x0, o1 = lado === 'l' || lado === 'in' ? x1 : x1 + 6 + lw;
        var fila = 0;
        while (filas[fila] != null && filas[fila] + 10 > o0) fila++;
        filas[fila] = o1;
        h._g = {x0: x0, x1: x1, fila: fila, txt: txt, lado: lado, uno: h.inicio === h.fin};
      });
      l.filas = Math.max(1, filas.length);
    });
    var y = TOP, H;
    lanes.forEach(function (l) { l.y = y; l.h = l.filas * ROW + 14; y += l.h; });
    H = Math.max(y + 10, TOP + 60);

    var svg = el('svg', {id: 'rm-gantt', viewBox: '0 0 ' + W + ' ' + H, width: W, height: H, role: 'img', 'aria-label': 'Gantt del RoadMap por pata, ' + dmy(a, true) + ' – ' + dmy(b, true)});
    var defs = el('defs');
    var pat = el('pattern', {id: 'rmStripe', width: 8, height: 8, patternUnits: 'userSpaceOnUse', patternTransform: 'rotate(45)'});
    pat.appendChild(el('rect', {width: 8, height: 8, fill: '#78f3ff'}));
    pat.appendChild(el('rect', {width: 3, height: 8, fill: 'rgba(5,9,16,.35)'}));
    defs.appendChild(pat);
    var lg = el('linearGradient', {id: 'rmHecho', x1: 0, x2: 1, y1: 0, y2: 0});
    lg.appendChild(el('stop', {offset: '0%', 'stop-color': '#2fbfae'}));
    lg.appendChild(el('stop', {offset: '100%', 'stop-color': '#4ae3d1'}));
    defs.appendChild(lg);
    svg.appendChild(defs);

    // Capas: fondos de carril → rejilla → rótulos e hitos (la rejilla no tapa las barras)
    var spotCls = function (id) { return S.spot ? (S.spot === id ? ' is-spot' : ' is-dim') : ''; };
    var fondos = el('g', {'class': 'fondos'});
    lanes.forEach(function (l, i) {
      var gb = el('g', {'class': 'lane-bgw' + spotCls(l.p.id), 'data-pata': l.p.id});
      gb.appendChild(el('rect', {'class': 'lane-bg' + (i % 2 ? ' alt' : ''), x: 0, y: l.y, width: W, height: l.h}));
      fondos.appendChild(gb);
    });
    svg.appendChild(fondos);
    var capaLanes = [];
    lanes.forEach(function (l) {
      var g = el('g', {'class': 'lane' + spotCls(l.p.id), 'data-pata': l.p.id});
      var c = cuenta(S.list.filter(function (h) { return h.solucion === l.p.id; }));
      g.appendChild(el('text', {'class': 'lane-nom', x: 12, y: l.y + 18}, l.p.nombre));
      g.appendChild(el('text', {'class': 'lane-pct', x: 12, y: l.y + 32}, pct(c.hecho, c.total) + '% hecho · ' + c.total + ' hitos'));
      if (!l.hitos.length) g.appendChild(el('text', {'class': 'lane-pct', x: LBL + 8, y: l.y + 22}, 'Por definir con Carlos'));
      l.g = g;
      capaLanes.push(g);
    });

    // Rejilla: semanas (lunes) o días en zoom mensual; meses siempre
    var grid = el('g', {'class': 'grid'});
    for (var t = a; t <= b + DAY; t += DAY) {
      var d = new Date(t), mesNuevo = d.getUTCDate() === 1, lunes = d.getUTCDay() === 1;
      var X = x(t);
      if (mesNuevo || t === a) {
        grid.appendChild(el('line', {'class': 'is-month', x1: X, x2: X, y1: 14, y2: H}));
        if (t <= b) grid.appendChild(el('text', {'class': 'mes', x: X + 5, y: 16}, MES[d.getUTCMonth()] + ' ' + d.getUTCFullYear()));
      } else if (dayW >= 16 || lunes) {
        grid.appendChild(el('line', {x1: X, x2: X, y1: 24, y2: H}));
      }
      if (t <= b && (dayW >= 16 || (lunes && dayW >= 4))) grid.appendChild(el('text', {'class': 'dia', x: X + (dayW >= 16 ? dayW / 2 : 2), y: 33, 'text-anchor': dayW >= 16 ? 'middle' : 'start'}, String(d.getUTCDate())));
    }
    svg.appendChild(grid);
    capaLanes.forEach(function (g) { svg.appendChild(g); });

    // Banda del corte del servidor (vista/desde/hasta de la URL)
    var cd = fecha(md.desde), ch = fecha(md.hasta);
    if (isFinite(cd) && isFinite(ch) && md.vista !== 'ano' && cd <= b && ch >= a) {
      var c0 = x(Math.max(cd, a)), c1 = x(Math.min(ch, b) + DAY);
      var gc = el('g', {'class': 'corte'});
      gc.appendChild(el('rect', {x: c0, y: TOP - 4, width: Math.max(2, c1 - c0), height: H - TOP}));
      gc.appendChild(el('text', {x: c0 + 4, y: H - 6}, 'CORTE · ' + (md.etiqueta || '')));
      svg.appendChild(gc);
    }

    // Hitos
    S.items = [];
    var n = 0;
    lanes.forEach(function (l) {
      l.hitos.forEach(function (h) {
        var G = h._g, cy = l.y + 7 + G.fila * ROW + ROW / 2, e = est(h.estado);
        var g = el('g', {'class': 'hito is-' + h.estado, tabindex: '0', role: 'button', 'data-i': S.items.length,
          'aria-label': h.titulo + ' · ' + e.nom + ' · ' + h.inicio + ' → ' + h.fin});
        var delay = reduce ? 0 : Math.min(1100, n * 26);
        var forma;
        if (G.uno) {
          var cx = x(Math.max(fecha(h.inicio), a)) + Math.max(4, dayW / 2), s = 7;
          forma = el('polygon', {'class': 'b', points: cx + ',' + (cy - s) + ' ' + (cx + s) + ',' + cy + ' ' + cx + ',' + (cy + s) + ' ' + (cx - s) + ',' + cy});
          G.x0 = cx - s; G.x1 = cx + s;
        } else {
          forma = el('rect', {'class': 'b', x: G.x0, y: cy - 7, width: Math.max(8, G.x1 - G.x0), height: 14, rx: 5});
        }
        if (h.estado === 'hecho') forma.setAttribute('fill', 'url(#rmHecho)');
        else if (h.estado === 'en_curso') forma.setAttribute('fill', 'url(#rmStripe)');
        else if (h.estado === 'confirmado') { forma.setAttribute('fill', '#5ec8ff'); forma.setAttribute('fill-opacity', '.85'); }
        else { forma.setAttribute('fill', 'rgba(184,199,218,.08)'); forma.setAttribute('stroke', e.c); forma.setAttribute('stroke-dasharray', '3 3'); }
        forma.style.animationDelay = delay + 'ms';
        g.appendChild(forma);
        var tx = G.lado === 'l' ? G.x0 - 6 : G.lado === 'in' ? G.x0 + 8 : G.x1 + 6;
        g.appendChild(el('text', {x: tx, y: cy + 3.5, 'class': G.lado === 'in' ? 'in' : null, 'text-anchor': G.lado === 'l' ? 'end' : 'start'}, G.txt));
        l.g.appendChild(g);
        S.items.push(h);
        n++;
      });
    });

    // HOY (Madrid)
    var th = hoy();
    if (th >= a && th <= b) {
      var hx = x(th) + dayW / 2, gh = el('g', {'class': 'hoy'});
      gh.appendChild(el('line', {x1: hx, x2: hx, y1: TOP - 6, y2: H}));
      gh.appendChild(el('circle', {cx: hx, cy: TOP - 6, r: 4}));
      gh.appendChild(el('text', {x: hx + 7, y: TOP - 3}, 'HOY ' + dmy(th).toUpperCase()));
      svg.appendChild(gh);
    }

    wrap.innerHTML = '';
    if (!vis.length && filtro.proyecto !== 'todos') {
      wrap.innerHTML = '<p class="rm-vacio">Por definir con Carlos · ningún hito en este periodo con estos filtros.</p>';
      return;
    }
    wrap.appendChild(svg);
    enganchar(svg);
  }

  // ── Ficha al pasar el ratón ──────────────────────────────────────────────
  function ficha(h) {
    var e = est(h.estado), i = fecha(h.inicio), f = fecha(h.fin), dias = Math.round((f - i) / DAY) + 1, t = hoy();
    var plazo = '';
    if (h.estado !== 'hecho' && dias > 1 && t >= i && t <= f) {
      var k = pct(Math.round((t - i) / DAY) + 1, dias);
      plazo = '<div class="rm-prog"><i style="width:' + k + '%"></i></div><small>Plazo transcurrido: ' + k + '% (calculado con la fecha de hoy)</small>';
    }
    return '<span class="rm-chip is-' + esc(h.estado) + '" style="--c:' + e.c + '">' + esc(e.nom) + '</span>' +
      '<h3>' + esc(h.titulo) + '</h3><dl>' +
      '<dt>Pata</dt><dd>' + esc(pataDe(h.solucion).nombre) + '</dd>' +
      '<dt>Fechas</dt><dd>' + esc(i === f ? dmy(i, true) : dmy(i) + ' → ' + dmy(f, true)) + ' · ' + dias + (dias === 1 ? ' día' : ' días') + '</dd>' +
      '<dt>Responsable</dt><dd>' + esc(h.responsable || '—') + '</dd>' +
      '<dt>Cliente</dt><dd>' + esc(h.cliente || 'General') + '</dd>' +
      '<dt>Idea</dt><dd>' + esc(h.idea || '—') + '</dd>' +
      '<dt>Fuente</dt><dd>' + esc(h.fuente || '—') + '</dd></dl>' + plazo;
  }
  function colocar(px, py) {
    var c = els.card, w = c.offsetWidth || 320, hh = c.offsetHeight || 200;
    var X = px + 16, Y = py + 16;
    if (X + w > innerWidth - 8) X = Math.max(8, px - w - 16);
    if (Y + hh > innerHeight - 8) Y = Math.max(8, py - hh - 16);
    c.style.left = X + 'px'; c.style.top = Y + 'px';
  }
  function verFicha(h, px, py) {
    els.card.innerHTML = ficha(h);
    els.card.hidden = false;
    colocar(px, py);
    els.card.classList.add('is-on');
  }
  function ocultarFicha(forzar) {
    if (S.pin != null && !forzar) return;
    S.pin = null;
    els.card.classList.remove('is-on', 'is-pin');
    document.querySelectorAll('#rm-gantt .hito.is-pin').forEach(function (n) { n.classList.remove('is-pin'); });
  }
  function enganchar(svg) {
    function item(e) { var g = e.target.closest && e.target.closest('.hito'); return g ? {g: g, h: S.items[+g.getAttribute('data-i')]} : null; }
    svg.addEventListener('pointermove', function (e) {
      if (S.pin != null) return;
      var it = item(e);
      if (it) verFicha(it.h, e.clientX, e.clientY); else ocultarFicha();
    });
    svg.addEventListener('pointerleave', function () { ocultarFicha(); });
    svg.addEventListener('click', function (e) {
      var it = item(e);
      if (!it) { ocultarFicha(true); return; }
      var i = +it.g.getAttribute('data-i');
      if (S.pin === i) { ocultarFicha(true); return; }
      ocultarFicha(true);
      S.pin = i;
      it.g.classList.add('is-pin');
      verFicha(it.h, e.clientX, e.clientY);
      els.card.classList.add('is-pin');
    });
    svg.addEventListener('focusin', function (e) {
      var it = item(e);
      if (!it) return;
      var r = it.g.getBoundingClientRect();
      verFicha(it.h, r.right, r.top);
    });
    svg.addEventListener('focusout', function () { ocultarFicha(); });
    svg.addEventListener('keydown', function (e) {
      if (e.key !== 'Enter' && e.key !== ' ') return;
      var it = item(e);
      if (!it) return;
      e.preventDefault();
      var r = it.g.getBoundingClientRect();
      ocultarFicha(true);
      S.pin = +it.g.getAttribute('data-i');
      it.g.classList.add('is-pin');
      verFicha(it.h, r.right, r.top);
      els.card.classList.add('is-pin');
    });
  }
  document.addEventListener('click', function (e) {
    if (S.pin == null) return;
    if (e.target.closest && (e.target.closest('#rm-gantt') || e.target.closest('#rm-card'))) return;
    ocultarFicha(true);
  });

  // ── Foco en una pata (tarjeta, carril y flujo) ───────────────────────────
  function spot(id) {
    S.spot = id;
    els.constel.querySelectorAll('.rm-pata').forEach(function (b) {
      var on = b.getAttribute('data-pata') === id;
      b.classList.toggle('is-spot', !!id && on);
      b.classList.toggle('is-dim', !!id && !on);
      b.setAttribute('aria-pressed', String(!!id && on));
    });
    document.querySelectorAll('#rm-gantt .lane, #rm-gantt .lane-bgw').forEach(function (g) {
      var on = g.getAttribute('data-pata') === id;
      g.classList.toggle('is-spot', !!id && on);
      g.classList.toggle('is-dim', !!id && !on);
    });
    flujos();
    if (els.caption) {
      if (!id) els.caption.innerHTML = 'RoadMap AdmiraNeXT · <em>' + S.list.length + ' hitos</em> · ' + pct(cuenta(S.list).hecho, S.list.length) + '% hecho';
      else {
        var p = pataDe(id), c = cuenta(S.list.filter(function (h) { return h.solucion === id; }));
        els.caption.innerHTML = esc(p.nombre) + ' · <em>' + pct(c.hecho, c.total) + '% hecho</em> · ' + c.total + ' hitos' + (c.en_curso ? ' · ' + c.en_curso + ' en curso' : '');
      }
    }
  }

  // ── Presentador (P) ──────────────────────────────────────────────────────
  function presentador(on) {
    document.body.classList.toggle('is-presenter', on);
    if (els.presenter) els.presenter.textContent = on ? 'Salir presentador' : 'Presentador (P)';
    clearInterval(S.tour);
    S.tour = null;
    if (on) {
      var orden = [null].concat(PATAS.map(function (p) { return p.id; }));
      var i = 0;
      spot(null);
      S.paused = false;
      S.tour = setInterval(function () { if (S.paused) return; i = (i + 1) % orden.length; spot(orden[i]); }, 5200);
      S.paso = function (d) { i = (i + d + orden.length) % orden.length; spot(orden[i]); };
    } else spot(null);
    setTimeout(function () { gantt(); flujos(); }, 60);
  }
  if (els.presenter) els.presenter.addEventListener('click', function () { presentador(!document.body.classList.contains('is-presenter')); });
  window.addEventListener('keydown', function (e) {
    var t = e.target;
    if (t && (/^(input|textarea|select)$/i.test(t.tagName) || t.isContentEditable)) return;
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    var pres = document.body.classList.contains('is-presenter');
    if (e.key === 'p' || e.key === 'P') { e.preventDefault(); presentador(!pres); return; }
    if (e.key === 'Escape') { ocultarFicha(true); if (pres) presentador(false); else spot(null); return; }
    if (pres && (e.key === 'ArrowRight' || e.key === 'ArrowLeft') && S.paso) { e.preventDefault(); S.paso(e.key === 'ArrowRight' ? 1 : -1); }
    if (pres && e.key === ' ') { e.preventDefault(); S.paused = !S.paused; }
  });

  // ── Lluvia matrix suave cyan/teal (la misma de /organigrama) ─────────────
  function matrix() {
    var cv = els.matrix;
    if (!cv || reduce || !cv.getContext) return;
    var ctx = cv.getContext('2d'), chars = 'アイウエオカキクケコサシスセソタチツテトナニヌネノハヒフヘホマミムメモヤユヨラリルレロワヲン0123456789ADMIRANEXT';
    var fs = 13, drops = [], colors = ['#78f3ff', '#4ae3d1', '#5ec8ff'], last = 0;
    function resize() {
      cv.width = show.clientWidth; cv.height = show.clientHeight;
      var cols = Math.max(8, Math.floor(cv.width / fs));
      drops = Array(cols);
      for (var i = 0; i < cols; i++) drops[i] = Math.random() * -40;
    }
    resize();
    if (window.ResizeObserver) new ResizeObserver(resize).observe(show); else window.addEventListener('resize', resize);
    function frame(ts) {
      requestAnimationFrame(frame);
      if (document.hidden || ts - last < 50) return;
      last = ts;
      ctx.fillStyle = 'rgba(5, 9, 16, 0.08)';
      ctx.fillRect(0, 0, cv.width, cv.height);
      ctx.font = fs + 'px monospace';
      for (var i = 0; i < drops.length; i++) {
        ctx.fillStyle = colors[i % colors.length];
        ctx.globalAlpha = 0.35 + (i % 5) * 0.08;
        ctx.fillText(chars[Math.floor(Math.random() * chars.length)], i * fs, drops[i] * fs);
        if (drops[i] * fs > cv.height && Math.random() > 0.975) drops[i] = 0;
        drops[i]++;
      }
      ctx.globalAlpha = 1;
    }
    requestAnimationFrame(frame);
  }

  // ── Arranque ─────────────────────────────────────────────────────────────
  function pintarTodo() {
    S.list = S.all.filter(pasa);
    if (els.filtro) {
      var partes = [];
      if (filtro.proyecto !== 'todos') partes.push(pataDe(filtro.proyecto).nombre);
      if (filtro.cliente !== 'todos') partes.push(filtro.cliente === 'general' ? 'General' : filtro.cliente);
      if (filtro.idea !== 'todos') partes.push(filtro.ideaNombre || filtro.idea);
      els.filtro.hidden = !partes.length;
      els.filtro.textContent = 'Filtro · ' + partes.join(' · ');
    }
    pintarKpis();
    pintarPatas();
    pintarRail();
    pintarLeyenda();
    gantt();
    spot(S.spot);
  }
  var rz = null;
  window.addEventListener('resize', function () { clearTimeout(rz); rz = setTimeout(function () { gantt(); spot(S.spot); }, 140); });
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(flujos).catch(function () {});
  matrix();
  fetch('/api/roadmap', {headers: {accept: 'application/json'}}).then(function (r) {
    if (!r.ok) throw new Error('HTTP ' + r.status);
    return r.json();
  }).then(function (lista) {
    S.all = Array.isArray(lista) ? lista.filter(function (h) { return h && isFinite(fecha(h.inicio)) && isFinite(fecha(h.fin)); }) : [];
    if (els.live) { els.live.classList.add('is-ok'); els.live.lastChild.textContent = ' /api/roadmap · ' + S.all.length + ' hitos'; }
    pintarTodo();
  }).catch(function (err) {
    if (els.live) { els.live.classList.add('is-bad'); els.live.lastChild.textContent = ' /api/roadmap no responde (' + (err && err.message || err) + ')'; }
    els.wrap.innerHTML = '<p class="rm-vacio">No se pudo leer /api/roadmap. El corte de abajo sigue disponible.</p>';
  });
  window.AdmiraRoadmap = {presentador: presentador, spot: spot, estado: function () { return {hitos: S.list.length, mes: S.month, pata: S.spot}; }};
})();
