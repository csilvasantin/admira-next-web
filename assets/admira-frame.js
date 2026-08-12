/* admira-frame.js — monta la cuadrícula de AdmiraNeXT sobre cualquier página.
 *
 * Encargo de Carlos (7-ago-2026): «barra superior y principal fija y siempre la
 * misma, más dos barras verticales, la izquierda de opciones y la de la derecha
 * de avanzado, y por último la inferior de nivel experto».
 *
 * El motor original de yokup (yk-frame.js, 1.326 líneas) NO se porta: llama a
 * api.yokup.com para proyectos, contadores y RTC, y admiranext no debe depender
 * del backend de otro producto para pintar su propio armazón. Aquí queda sólo el
 * armazón, con el MISMO contrato declarativo para que las dos cuadrículas sean
 * la misma cosa:
 *
 *   <body data-yk-title="PRESENTACIONES"
 *         data-yk-rail-left="OPCIONES"
 *         data-yk-rail-right="AVANZADO">
 *     <div data-yk-slot="left">…</div>     → va al raíl izquierdo
 *     <div data-yk-slot="right">…</div>    → va al raíl derecho
 *     <div data-yk-slot="bottom">…</div>   → va a la franja de nivel experto
 *
 * La marca de la barra es el ÚNICO enlace a la home. Antes, /presentaciones tenía
 * DOS botones de inicio pegados —el logotipo «A» y un icono de casa, los dos a «/»—
 * y era justo lo que Carlos señaló como síntoma de que la interfaz estaba mal.
 */
(function () {
  'use strict';
  var doc = document, root = doc.documentElement, body = doc.body;
  if (!body || body.dataset.ykFrameReady) return;
  body.dataset.ykFrameReady = '1';

  var titulo = body.dataset.ykTitle || 'ADMIRANEXT';
  var nomIzq = body.dataset.ykRailLeft || 'OPCIONES';
  var nomDer = body.dataset.ykRailRight || 'AVANZADO';

  function el(tag, cls, html) {
    var n = doc.createElement(tag);
    if (cls) n.className = cls;
    if (html != null) n.innerHTML = html;
    return n;
  }

  // Cada lado del marco tiene UN icono en la barra y UN cajón, y los dos dicen su
  // nombre: el icono declara con aria-controls qué cajón abre y el cajón lleva ese
  // mismo id. Sin ese par, un lector de pantalla ve tres botones sueltos y tres
  // regiones huérfanas, y no hay forma de saber que ⋯ abre «AVANZADO».
  var LADOS = ['left', 'right', 'bottom'];
  var IDS = {
    left: {toggle: 'ykOptionsToggle', rail: 'ykOptionsRail'},
    right: {toggle: 'ykAdvancedToggle', rail: 'ykAdvancedRail'},
    bottom: {toggle: 'ykExpertToggle', rail: 'ykExpertRail'}
  };

  // ── Barra superior ─────────────────────────────────────────────────────────
  var bar = el('header', 'yk-bar');
  bar.setAttribute('role', 'banner');

  var btnIzq = el('button', 'yk-ico', '<span aria-hidden="true">☰</span>');
  btnIzq.type = 'button';
  btnIzq.id = IDS.left.toggle;
  btnIzq.setAttribute('aria-label', nomIzq);
  btnIzq.setAttribute('aria-controls', IDS.left.rail);

  // La marca: un solo camino a la home, y va en la barra, no en un raíl.
  // Un SOLO nodo de texto: .yk-logo es inline-flex con gap:8px, así que partir la
  // marca en <b> la separaba visualmente y se leía «AD mira NeXT», en tres piezas.
  var marca = el('a', 'yk-logo', 'ADmiraNeXT');
  marca.href = '/';
  marca.setAttribute('aria-label', 'ADmiraNeXT, inicio');

  var pagina = el('span', 'yk-page', titulo);

  var btnDer = el('button', 'yk-ico', '<span aria-hidden="true">⋯</span>');
  btnDer.type = 'button';
  btnDer.id = IDS.right.toggle;
  btnDer.setAttribute('aria-label', nomDer);
  btnDer.setAttribute('aria-controls', IDS.right.rail);

  var btnAbajo = el('button', 'yk-ico', '<span aria-hidden="true">⌄</span>');
  btnAbajo.type = 'button';
  btnAbajo.id = IDS.bottom.toggle;
  btnAbajo.setAttribute('aria-label', 'Nivel experto');
  btnAbajo.setAttribute('aria-controls', IDS.bottom.rail);

  // El canon de la casa fija el orden de la esquina derecha: EXPERTO en el extremo
  // y AVANZADO a su izquierda. Estaban al revés.
  var meta = el('div', 'yk-meta');
  meta.appendChild(btnDer);
  meta.appendChild(btnAbajo);

  // Enlaces de sección declarados por la página: se suben a la barra tal cual, y el
  // que apunta a la página actual se marca en vez de repetirse como destino.
  var nav = el('nav', 'yk-barnav');
  nav.setAttribute('aria-label', 'Secciones');
  var aquí = location.pathname.replace(/\/+$/, '/');
  doc.querySelectorAll('[data-yk-slot="nav"] a').forEach(function (a) {
    var destino = (a.getAttribute('href') || '').replace(/\/+$/, '/');
    a.classList.add('yk-ico');
    if (destino && destino === aquí) a.setAttribute('aria-current', 'page');
    nav.appendChild(a);
  });
  doc.querySelectorAll('[data-yk-slot="nav"]').forEach(function (n) { n.remove(); });

  bar.appendChild(btnIzq); bar.appendChild(marca); bar.appendChild(pagina);
  if (nav.children.length) bar.appendChild(nav);
  bar.appendChild(meta);

  // ── Raíles y franja inferior ───────────────────────────────────────────────
  function rail(lado, nombre) {
    var r = el('aside', 'yk-rail yk-rail-' + lado);
    r.id = IDS[lado].rail;
    r.setAttribute('aria-label', nombre);
    r.appendChild(el('div', 'yk-rail-navhd', nombre));
    doc.querySelectorAll('[data-yk-slot="' + lado + '"]').forEach(function (n) { r.appendChild(n); });
    var pie = el('div', 'yk-rail-foot', '<span>ADmiraNeXT · 2026</span>');
    r.appendChild(pie);
    return r;
  }
  var railIzq = rail('left', nomIzq), railDer = rail('right', nomDer);

  // La CUARTA barra: el nivel experto es un raíl inferior (.yk-rail-bottom), no una
  // sección suelta; se abre con .yk-open-bottom igual que los otros dos.
  var hayAbajo = doc.querySelectorAll('[data-yk-slot="bottom"]').length > 0;
  var railAbajo = el('aside', 'yk-rail yk-rail-bottom');
  railAbajo.id = IDS.bottom.rail;
  railAbajo.setAttribute('aria-label', 'Nivel experto');
  railAbajo.appendChild(el('div', 'yk-rail-navhd', 'NIVEL EXPERTO'));
  var experto = el('div', 'yk-expert');
  doc.querySelectorAll('[data-yk-slot="bottom"]').forEach(function (n) { experto.appendChild(n); });
  railAbajo.appendChild(experto);

  body.insertBefore(bar, body.firstChild);
  body.appendChild(railIzq); body.appendChild(railDer);
  if (hayAbajo) body.appendChild(railAbajo);

  // ── Apertura ───────────────────────────────────────────────────────────────
  // Un raíl abierto cierra el otro: dos cajones a la vez tapan el contenido, que
  // es lo que uno vino a ver.
  var CAJON = {left: {btn: btnIzq, rail: railIzq}, right: {btn: btnDer, rail: railDer}, bottom: {btn: btnAbajo, rail: hayAbajo ? railAbajo : null}};
  function abrir(lado, abierto) {
    root.classList.toggle('yk-open-' + lado, abierto);
    if (abierto) LADOS.forEach(function (o) { if (o !== lado) root.classList.remove('yk-open-' + o); });
    sincronizar();
  }
  // El estado del cajón se dice UNA vez y para los dos: el botón lo anuncia con
  // aria-expanded y el cajón cerrado se sale del recorrido con inert. Un raíl
  // plegado vive fuera de pantalla con transform, así que sin inert sus enlaces
  // siguen recibiendo el tabulador: se navega a ciegas por un cajón invisible.
  function sincronizar() {
    LADOS.forEach(function (lado) {
      var abierto = root.classList.contains('yk-open-' + lado);
      CAJON[lado].btn.setAttribute('aria-expanded', String(abierto));
      if (!CAJON[lado].rail) return;
      CAJON[lado].rail.inert = !abierto;
      CAJON[lado].rail.setAttribute('aria-hidden', String(!abierto));
    });
  }
  function cerrarTodo() { LADOS.forEach(function (l) { abrir(l, false); }); }
  sincronizar();   // plegado por defecto, y dicho: los tres botones nacen en false
  btnIzq.addEventListener('click', function () { abrir('left', !root.classList.contains('yk-open-left')); });
  btnDer.addEventListener('click', function () { abrir('right', !root.classList.contains('yk-open-right')); });
  btnAbajo.addEventListener('click', function () { abrir('bottom', !root.classList.contains('yk-open-bottom')); });
  doc.addEventListener('keydown', function (e) { if (e.key === 'Escape') cerrarTodo(); });
  // Fuera del cajón se cierra: en móvil ocupa casi toda la pantalla y sin esto
  // hay que apuntar al botón para salir.
  doc.addEventListener('click', function (e) {
    if (!LADOS.some(function (l) { return root.classList.contains('yk-open-' + l); })) return;
    if (e.target.closest('.yk-rail') || e.target.closest('.yk-bar')) return;
    cerrarTodo();
  });
})();
