/* /arquitectura — organigrama tecnológico de AdmiraNeXT (9-oct-2026).
 * Lee /api/arquitectura (datos + versiones vivas; si falla, /data/arquitectura.json) y pinta:
 * el diagrama SVG (hub, cinco patas, admira.live, servicios, suelo Cloudflare/GitHub), la ficha
 * de cada nodo, la leyenda, las piezas, la tabla de relaciones, los cambios y las dudas.
 * Idioma: el de <html lang> (lo cambia /idioma ENG|ESP del ⌘ Experto); al cambiar, se repinta
 * TODO en el otro idioma con los textos ES/EN de los datos y de TXT. El <main> lleva
 * data-yk-no-traducir: el diccionario del armazón no lo toca, lo traduce esta página.
 */
(function (G) {
  'use strict';
  var doc = G.document, root = doc.documentElement;
  var TXT = {
    es: {
      titulo: 'Organigrama tecnológico',
      lead: 'Cómo se hablan las webs de Admira: admiranext.com es el hub, cinco patas hacen el trabajo, admira.live lo controla y unos pocos servicios compartidos llevan los datos de un sitio a otro.',
      cargando: 'Cargando datos…', listo: 'Datos vivos · versiones leídas ahora', estatico: 'Datos del análisis (sin versiones vivas)',
      verEtiquetas: 'Ver todas las etiquetas', verDudosas: 'Mostrar relaciones por confirmar', json: 'Datos en JSON',
      svgTitulo: 'Diagrama de relaciones entre las plataformas de Admira',
      pista: 'Pasa el ratón por una caja para ver sus flechas. Haz clic para abrir su ficha.',
      hLeer: 'Cómo leer esto',
      lgHub: 'El centro (cian) es admiranext.com: define los clientes y publica lo común.',
      lgPata: 'Las cinco cajas de color son las patas: cada una hace un trabajo (crear, gestionar, emitir, mantener, vender).',
      lgControl: 'Arriba, admira.live: la capa de control, donde el Consejo y la flota de agentes ven y coordinan todo.',
      lgServicio: 'Las cajas grises son servicios compartidos: los usan varias patas a la vez.',
      lgFlecha: 'Una flecha va de quien pide a quien responde; la etiqueta dice qué viaja.',
      lgDudosa: 'Una flecha discontinua está por confirmar: hay pistas en el código, pero no una prueba clara.',
      lgInfra: 'Abajo, el suelo: Cloudflare aloja todo y GitHub guarda el código.',
      hPiezas: 'Las siete piezas', hRelaciones: 'Tabla de relaciones', hCambios: 'Cambios de los últimos días', hDudas: 'Por confirmar',
      thDe: 'De', thA: 'A', thQue: 'Qué viaja', thEvidencia: 'Evidencia', thEstado: 'Estado',
      ok: 'verificada', duda: 'por confirmar',
      pie: 'Organigrama tecnológico · análisis del código y de las webs en vivo, 9 de octubre de 2026', pieOrg: 'Organigrama de personas',
      consejero: 'Consejero', repo: 'Repositorio', despliegue: 'Despliegue', version: 'Versión viva', alias: 'También es',
      modulos: 'Módulos principales', expone: 'Lo que ofrece a los demás', consume: 'Lo que usa de otros', cambios: 'Cambios recientes',
      salen: 'Flechas que salen', entran: 'Flechas que entran', abrir: 'Abrir la web ↗', cerrar: 'Cerrar', sinVersion: 'sin dato',
      tipo: {hub: 'hub', pata: 'pata', control: 'control', servicio: 'servicio', dispositivo: 'dispositivos', infra: 'infraestructura'},
      cliNodo: 'Abre la ficha de un nodo (studio, store, tv, app, biz, live, admiranext…)', cliRel: 'Lista las relaciones (de un nodo, si lo indicas)',
      cliEtq: 'Muestra u oculta todas las etiquetas', cliNoNodo: 'No conozco ese nodo. Prueba: ', cliLista: 'Nodos: '
    },
    en: {
      titulo: 'Technology org chart',
      lead: 'How the Admira websites talk to each other: admiranext.com is the hub, five legs do the work, admira.live controls it and a few shared services carry the data from one place to another.',
      cargando: 'Loading data…', listo: 'Live data · versions read just now', estatico: 'Analysis data (no live versions)',
      verEtiquetas: 'Show all labels', verDudosas: 'Show relations still to confirm', json: 'Data as JSON',
      svgTitulo: 'Diagram of the relations between the Admira platforms',
      pista: 'Hover a box to see its arrows. Click it to open its card.',
      hLeer: 'How to read this',
      lgHub: 'The centre (cyan) is admiranext.com: it defines the clients and publishes what is shared.',
      lgPata: 'The five coloured boxes are the legs: each one does a job (create, manage, broadcast, maintain, sell).',
      lgControl: 'At the top, admira.live: the control layer, where the Council and the agent fleet see and coordinate everything.',
      lgServicio: 'The grey boxes are shared services: several legs use them at the same time.',
      lgFlecha: 'An arrow goes from whoever asks to whoever answers; the label says what travels.',
      lgDudosa: 'A dashed arrow is still to confirm: there are hints in the code, but no clear proof.',
      lgInfra: 'At the bottom, the ground: Cloudflare hosts everything and GitHub keeps the code.',
      hPiezas: 'The seven pieces', hRelaciones: 'Relations table', hCambios: 'Changes of the last few days', hDudas: 'Still to confirm',
      thDe: 'From', thA: 'To', thQue: 'What travels', thEvidencia: 'Evidence', thEstado: 'Status',
      ok: 'verified', duda: 'to confirm',
      pie: 'Technology org chart · analysis of the code and the live websites, 9 October 2026', pieOrg: 'People org chart',
      consejero: 'Counsellor', repo: 'Repository', despliegue: 'Deployment', version: 'Live version', alias: 'Also known as',
      modulos: 'Main modules', expone: 'What it offers the others', consume: 'What it uses from others', cambios: 'Recent changes',
      salen: 'Outgoing arrows', entran: 'Incoming arrows', abrir: 'Open the website ↗', cerrar: 'Close', sinVersion: 'no data',
      tipo: {hub: 'hub', pata: 'leg', control: 'control', servicio: 'service', dispositivo: 'devices', infra: 'infrastructure'},
      cliNodo: 'Opens the card of a node (studio, store, tv, app, biz, live, admiranext…)', cliRel: 'Lists the relations (of one node, if given)',
      cliEtq: 'Shows or hides every label', cliNoNodo: 'I do not know that node. Try: ', cliLista: 'Nodes: '
    }
  };
  var COLOR = {admiranext: '#4ae3d1', studio: '#FF3366', store: '#FFCC00', tv: '#33FF99', app: '#FF33CC', biz: '#63a5ff', live: '#b388ff'};
  var W = 180, H = 62, NS = 'http://www.w3.org/2000/svg';
  var D = null, VERS = {}, vivo = false, sel = null, foco = null;
  var PRINCIPALES = ['admiranext', 'studio', 'store', 'tv', 'app', 'biz', 'live'];

  function lang() { return /^en/i.test(root.getAttribute('lang') || '') ? 'en' : 'es'; }
  function t(k) { return TXT[lang()][k]; }
  function $(s) { return doc.querySelector(s); }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return {'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;'}[c]; }); }
  function svg(tag, at) { var e = doc.createElementNS(NS, tag); for (var k in at) e.setAttribute(k, at[k]); return e; }
  function nodo(id) { for (var i = 0; i < D.nodos.length; i++) if (D.nodos[i].id === id) return D.nodos[i]; return null; }
  function txt(n) { return n[lang()]; }
  function color(n) { return COLOR[n.id] || (n.tipo === 'dispositivo' ? '#9fb3c8' : '#7d8ba1'); }
  function version(n) { var v = VERS[n.id]; return v && v.version; }

  function pintarFijos() {
    Array.prototype.forEach.call(doc.querySelectorAll('[data-t]'), function (e) { var v = t(e.getAttribute('data-t')); if (typeof v === 'string') e.textContent = v; });
    doc.title = t('titulo') + ' · ADmiraNeXT';
    $('#arq-estado').textContent = D ? t(vivo ? 'listo' : 'estatico') : t('cargando');
    $('#arq-estado').classList.toggle('ok', !!(D && vivo));
  }

  // ── Diagrama ──
  function borde(n, hacia) {   // punto del borde del rectángulo en dirección a «hacia»
    var dx = hacia.x - n.x, dy = hacia.y - n.y, sx = (W / 2) / Math.abs(dx || 1e-6), sy = (H / 2) / Math.abs(dy || 1e-6), s = Math.min(sx, sy);
    return {x: n.x + dx * s, y: n.y + dy * s};
  }
  function pintarDiagrama() {
    var s = $('#arq-svg'), titulo = s.querySelector('title');
    while (s.lastChild && s.lastChild !== titulo) s.removeChild(s.lastChild);
    var defs = svg('defs', {});
    defs.innerHTML = '<marker id="arq-punta" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0 0L10 5L0 10z" fill="#5b7090"/></marker>' +
      '<marker id="arq-punta-on" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0 0L10 5L0 10z" fill="#4ae3d1"/></marker>';
    s.appendChild(defs);
    // suelo: Cloudflare y GitHub
    [['cloudflare', 15, 480], ['github', 505, 480]].forEach(function (f) {
      var n = nodo(f[0]); if (!n) return;
      var g = svg('g', {class: 'infra nodo', 'data-id': n.id, tabindex: '0', role: 'button', 'aria-label': txt(n).nombre});
      g.appendChild(svg('rect', {x: f[1], y: 808, width: f[2], height: 40, rx: 10}));
      var tx = svg('text', {x: f[1] + f[2] / 2, y: 833, 'text-anchor': 'middle'});
      tx.textContent = txt(n).nombre + ' · ' + (n.id === 'cloudflare' ? (lang() === 'en' ? 'Pages · 48 Workers · D1 · R2 · KV' : 'Pages · 48 Workers · D1 · R2 · KV') : (lang() === 'en' ? 'code · Actions' : 'código · Actions'));
      g.appendChild(tx); s.appendChild(g);
    });
    var capaA = svg('g', {}); s.appendChild(capaA);
    var pares = {};
    D.aristas.forEach(function (a, i) {
      var A = nodo(a.de), B = nodo(a.a); if (!A || !B) return;
      var clave = [a.de, a.a].sort().join('|'), k = pares[clave] = (pares[clave] || 0) + 1;
      var p1 = borde(A, B), p2 = borde(B, A), mx = (p1.x + p2.x) / 2, my = (p1.y + p2.y) / 2;
      var dx = p2.x - p1.x, dy = p2.y - p1.y, L = Math.sqrt(dx * dx + dy * dy) || 1;
      var curva = (k === 1 ? 18 : -30) * (a.de < a.a ? 1 : -1);
      var cx = mx - dy / L * curva, cy = my + dx / L * curva;
      var g = svg('g', {class: 'arista' + (a.seguro ? '' : ' dudosa'), 'data-de': a.de, 'data-a': a.a, 'data-i': i});
      g.appendChild(svg('path', {d: 'M' + p1.x.toFixed(1) + ' ' + p1.y.toFixed(1) + ' Q' + cx.toFixed(1) + ' ' + cy.toFixed(1) + ' ' + p2.x.toFixed(1) + ' ' + p2.y.toFixed(1), 'marker-end': 'url(#arq-punta)'}));
      var et = svg('text', {x: (0.25 * p1.x + 0.5 * cx + 0.25 * p2.x).toFixed(1), y: (0.25 * p1.y + 0.5 * cy + 0.25 * p2.y + 4).toFixed(1), 'text-anchor': 'middle'});
      et.textContent = a[lang()];
      g.appendChild(et);
      capaA.appendChild(g);
    });
    D.nodos.forEach(function (n) {
      if (n.tipo === 'infra') return;
      var tx = txt(n), c = color(n), x = n.x - W / 2, y = n.y - H / 2;
      var g = svg('g', {class: 'nodo', 'data-id': n.id, tabindex: '0', role: 'button', 'aria-label': n.dominio + ' · ' + tx.nombre});
      g.appendChild(svg('rect', {x: x, y: y, width: W, height: H, rx: n.tipo === 'servicio' || n.tipo === 'dispositivo' ? 8 : 14, stroke: c, 'stroke-width': n.tipo === 'hub' ? 3 : 2}));
      var t1 = svg('text', {x: n.x, y: y + 23, 'text-anchor': 'middle', class: 't1', fill: PRINCIPALES.indexOf(n.id) >= 0 ? c : '#dfe6ef'});
      t1.textContent = n.dominio; g.appendChild(t1);
      var t2 = svg('text', {x: n.x, y: y + 40, 'text-anchor': 'middle', class: 't2'});
      t2.textContent = PRINCIPALES.indexOf(n.id) >= 0 ? (n.alias.length ? '= ' + n.alias.join(' · ') : TXT[lang()].tipo[n.tipo]) : (tx.corto || tx.nombre);
      g.appendChild(t2);
      var t3 = svg('text', {x: n.x, y: y + 55, 'text-anchor': 'middle', class: 't3'});
      t3.textContent = version(n) || (n.consejero && n.consejero !== '—' ? n.consejero : '');
      g.appendChild(t3);
      s.appendChild(g);
    });
    Array.prototype.forEach.call(s.querySelectorAll('.nodo'), function (g) {
      var id = g.getAttribute('data-id');
      g.addEventListener('mouseenter', function () { enfocar(id); });
      g.addEventListener('mouseleave', function () { enfocar(sel); });
      g.addEventListener('focus', function () { enfocar(id); });
      g.addEventListener('click', function () { abrir(id); });
      g.addEventListener('keydown', function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); abrir(id); } });
    });
    s.classList.toggle('etiquetas', $('#arq-etiquetas').checked);
    s.classList.toggle('sin-dudosas', !$('#arq-dudosas').checked);
    enfocar(sel);
  }
  function enfocar(id) {
    foco = id;
    var s = $('#arq-svg');
    s.classList.toggle('foco', !!id);
    Array.prototype.forEach.call(s.querySelectorAll('.arista'), function (g) {
      var on = !!id && (g.getAttribute('data-de') === id || g.getAttribute('data-a') === id);
      g.classList.toggle('on', on);
      g.querySelector('path').setAttribute('marker-end', on ? 'url(#arq-punta-on)' : 'url(#arq-punta)');
    });
    Array.prototype.forEach.call(s.querySelectorAll('.nodo'), function (g) {
      var gid = g.getAttribute('data-id');
      var on = gid === id || D.aristas.some(function (a) { return (a.de === id && a.a === gid) || (a.a === id && a.de === gid); });
      g.classList.toggle('on', on);
      g.classList.toggle('sel', gid === sel);
    });
  }

  // ── Ficha ──
  function lista(arr) { return arr && arr.length ? '<ul>' + arr.map(function (x) { return '<li>' + esc(x) + '</li>'; }).join('') + '</ul>' : ''; }
  function nombreCorto(id) { var n = nodo(id); return n ? n.dominio : id; }
  function abrir(id) {
    var n = nodo(id); if (!n) return false;
    sel = id; enfocar(id);
    var tx = txt(n), v = VERS[id];
    var sal = D.aristas.filter(function (a) { return a.de === id; }).map(function (a) { return '→ ' + nombreCorto(a.a) + ': ' + a[lang()] + (a.seguro ? '' : ' (' + t('duda') + ')'); });
    var ent = D.aristas.filter(function (a) { return a.a === id; }).map(function (a) { return '← ' + nombreCorto(a.de) + ': ' + a[lang()] + (a.seguro ? '' : ' (' + t('duda') + ')'); });
    var h = '<button type="button" class="cerrar" id="arq-cerrar">' + esc(t('cerrar')) + '</button>' +
      '<h3 style="color:' + color(n) + '">' + esc(tx.nombre) + '</h3>' +
      '<p class="dom">' + esc(n.dominio) + ' · ' + esc(TXT[lang()].tipo[n.tipo]) + '</p>' +
      '<p class="rol">' + esc(tx.rol) + '</p><dl>' +
      (n.alias.length ? '<dt>' + esc(t('alias')) + '</dt><dd>' + esc(n.alias.join(' · ')) + '</dd>' : '') +
      (n.consejero && n.consejero !== '—' ? '<dt>' + esc(t('consejero')) + '</dt><dd>' + esc(n.consejero) + '</dd>' : '') +
      (n.repo && n.repo !== '—' ? '<dt>' + esc(t('repo')) + '</dt><dd>' + esc(n.repo) + '</dd>' : '') +
      (n.despliegue && n.despliegue !== '—' ? '<dt>' + esc(t('despliegue')) + '</dt><dd>' + esc(n.despliegue) + '</dd>' : '') +
      (n.version_url ? '<dt>' + esc(t('version')) + '</dt><dd>' + esc(v ? v.version + (v.firma ? ' · ' + v.firma : '') : t('sinVersion')) + '</dd>' : '') +
      '</dl>' +
      (tx.modulos.length ? '<h4>' + esc(t('modulos')) + '</h4>' + lista(tx.modulos) : '') +
      (tx.expone.length ? '<h4>' + esc(t('expone')) + '</h4>' + lista(tx.expone) : '') +
      (tx.consume.length ? '<h4>' + esc(t('consume')) + '</h4>' + lista(tx.consume) : '') +
      (sal.length ? '<h4>' + esc(t('salen')) + '</h4>' + lista(sal) : '') +
      (ent.length ? '<h4>' + esc(t('entran')) + '</h4>' + lista(ent) : '') +
      (tx.cambios.length ? '<h4>' + esc(t('cambios')) + '</h4>' + lista(tx.cambios) : '') +
      (n.url ? '<a class="ver" href="' + esc(n.url) + '" target="_blank" rel="noopener">' + esc(t('abrir')) + '</a>' : '');
    var f = $('#arq-ficha'); f.innerHTML = h;
    $('#arq-cerrar').addEventListener('click', cerrar);
    return true;
  }
  function cerrar() { sel = null; enfocar(null); $('#arq-ficha').innerHTML = '<p class="arq-pista">' + esc(t('pista')) + '</p>'; }

  // ── Secciones ──
  function pintarSecciones() {
    $('#arq-piezas').innerHTML = PRINCIPALES.map(function (id) {
      var n = nodo(id), tx = txt(n);
      return '<article class="pieza" data-id="' + id + '" style="--c:' + color(n) + '" tabindex="0"><h3 style="color:' + color(n) + '">' + esc(n.dominio) + '</h3>' +
        '<p class="sub">' + esc(tx.nombre) + (n.consejero && n.consejero !== '—' ? ' · ' + esc(n.consejero) : '') + '</p><p>' + esc(tx.rol) + '</p>' +
        '<p class="v">' + esc(version(n) || '') + '</p></article>';
    }).join('');
    Array.prototype.forEach.call(doc.querySelectorAll('.pieza'), function (e) {
      var go = function () { abrir(e.getAttribute('data-id')); $('.arq-escena').scrollIntoView({behavior: 'smooth', block: 'start'}); };
      e.addEventListener('click', go);
      e.addEventListener('keydown', function (ev) { if (ev.key === 'Enter') go(); });
    });
    $('#arq-tabla tbody').innerHTML = D.aristas.map(function (a) {
      return '<tr><td>' + esc(nombreCorto(a.de)) + '</td><td>' + esc(nombreCorto(a.a)) + '</td><td>' + esc(a[lang()]) + '</td><td class="ev">' + esc(a.evidencia) + '</td><td><span class="est ' + (a.seguro ? 'ok' : 'duda') + '">' + esc(t(a.seguro ? 'ok' : 'duda')) + '</span></td></tr>';
    }).join('');
    $('#arq-cambios').innerHTML = PRINCIPALES.concat(['pixer']).map(function (id) {
      var n = nodo(id), c = txt(n).cambios;
      return c.length ? '<li style="--c:' + color(n) + '"><b>' + esc(n.dominio) + '</b> · ' + c.map(esc).join(' · ') + '</li>' : '';
    }).join('');
    $('#arq-dudas').innerHTML = (D.dudas || []).map(function (x) { return '<li>' + esc(x[lang()]) + '</li>'; }).join('');
  }

  function pintarTodo() {
    pintarFijos();
    if (!D) return;
    pintarDiagrama(); pintarSecciones();
    if (sel) abrir(sel); else cerrar();
  }

  // ── CLI (⌘ Experto): verbos en los dos idiomas ──
  function ids() { return D ? D.nodos.map(function (n) { return n.id; }).join(', ') : ''; }
  function buscarNodo(q) {
    q = String(q || '').toLowerCase().replace(/^https?:\/\//, '').replace(/^www\./, '');
    if (!D || !q) return null;
    for (var i = 0; i < D.nodos.length; i++) {
      var n = D.nodos[i];
      if (n.id === q || n.dominio.toLowerCase() === q || n.alias.indexOf(q) >= 0 || n.dominio.toLowerCase().split('.')[1] === q) return n;
    }
    return null;
  }
  G.ADMIRA_FRAME_VERBS = (G.ADMIRA_FRAME_VERBS || []).concat([
    {id: 'nodo', aliases: ['node'], uso: '<id>', ayuda: 'Abre la ficha de un nodo · Opens a node card', run: function (args, ctx) {
      var n = buscarNodo(args[0]);
      if (!n) { ctx.imprimir((args[0] ? t('cliNoNodo') : t('cliLista')) + ids()); return; }
      abrir(n.id); $('.arq-escena').scrollIntoView({behavior: 'smooth', block: 'start'});
      ctx.imprimir(n.dominio + ' · ' + txt(n).rol);
    }},
    {id: 'relaciones', aliases: ['relations', 'rel'], uso: '[id]', ayuda: 'Lista las relaciones · Lists the relations', run: function (args, ctx) {
      var n = args[0] ? buscarNodo(args[0]) : null;
      if (args[0] && !n) { ctx.imprimir(t('cliNoNodo') + ids()); return; }
      D.aristas.filter(function (a) { return !n || a.de === n.id || a.a === n.id; }).forEach(function (a) {
        ctx.imprimir(nombreCorto(a.de) + ' → ' + nombreCorto(a.a) + ' · ' + a[lang()] + (a.seguro ? '' : ' (' + t('duda') + ')'));
      });
    }},
    {id: 'etiquetas', aliases: ['labels'], uso: '[on|off]', ayuda: 'Muestra u oculta las etiquetas · Shows or hides the labels', run: function (args, ctx) {
      var c = $('#arq-etiquetas'), v = String(args[0] || '').toLowerCase();
      c.checked = v === 'on' || v === 'si' || v === 'sí' || v === 'yes' ? true : v === 'off' || v === 'no' ? false : !c.checked;
      $('#arq-svg').classList.toggle('etiquetas', c.checked);
      ctx.imprimir(t('verEtiquetas') + ': ' + (c.checked ? 'on' : 'off'));
    }}
  ]);

  function arrancar() {
    try { montar(); } catch (e) { /* sin el DOM de la página (o sin fetch) no se pinta nada: el armazón sigue */ }
  }
  function montar() {
    if (!doc.getElementById || !doc.getElementById('arq-svg') || typeof fetch !== 'function') return;
    $('#arq-etiquetas').addEventListener('change', function () { $('#arq-svg').classList.toggle('etiquetas', this.checked); });
    $('#arq-dudosas').addEventListener('change', function () { $('#arq-svg').classList.toggle('sin-dudosas', !this.checked); });
    doc.addEventListener('keydown', function (e) { if (e.key === 'Escape' && sel && !(e.target.closest && e.target.closest('.yk-rail'))) cerrar(); });
    if (typeof MutationObserver === 'function') new MutationObserver(pintarTodo).observe(root, {attributes: true, attributeFilter: ['lang']});
    pintarFijos();
    var leer = function (u) { return fetch(u, {headers: {accept: 'application/json'}}).then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); }); };
    leer('/api/arquitectura').then(function (d) { vivo = true; return d; }, function () { return leer('/data/arquitectura.json'); }).then(function (d) {
      D = d; VERS = d.versiones || {};
      var q = (G.location.hash || '').replace('#', '');
      if (buscarNodo(q)) sel = buscarNodo(q).id;
      pintarTodo();
    }).catch(function () { $('#arq-estado').textContent = 'Error'; });
  }
  if (doc.readyState === 'loading') doc.addEventListener('DOMContentLoaded', arrancar); else arrancar();
  G.AdmiraArquitectura = {abrir: function (id) { var n = buscarNodo(id); return n ? abrir(n.id) : false; }, cerrar: cerrar, datos: function () { return D; }};
})(window);
