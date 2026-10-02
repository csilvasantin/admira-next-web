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
 *
 * CANON DE LA GALAXIA (2-oct-2026, FLT-101373; el mismo de admira.app, Pixeria,
 * XpaceOS y Yokup): ☰ Opciones abre el panel IZQUIERDO, ▤ Avanzado el DERECHO y
 * ⌘ Experto la franja INFERIOR con el CLI. Los paneles son independientes (pueden
 * estar abiertos a la vez), recuerdan su estado entre páginas y Esc cierra el
 * panel enfocado (o, si el foco no está en ninguno, el último que se abrió).
 * Hasta esta versión los glifos eran ⋯ y ⌄ y abrir uno cerraba los otros.
 *
 * MODO CABECERA (<body data-yk-frame="cabecera">): la página conserva SU cabecera
 * (<header data-yk-head> con la marca, la navegación y «● Acceso privado») y el
 * armazón sólo inserta los iconos en su sitio:
 *
 *   [☰] admiraNeXT · Analitics · Webmaster · Proyectos · … ● Acceso privado [▤] [⌘]
 *
 * La navegación de la cabecera se copia además en ☰ (en móvil la barra la
 * esconde); los enlaces con data-yk-rail-only sólo se ven en ☰. En pantallas de
 * 1100 px o más los paneles se ACOPLAN y el contenido se estrecha a su lado (el
 * globo de /analitics se redimensiona solo); por debajo se superponen. La franja
 * ⌘ trae un CLI con /help generado del registro de verbos: la página añade los
 * suyos con window.ADMIRA_FRAME_VERBS = [...] (antes de cargar el armazón) o con
 * AdmiraFrame.verbo({...}) (después).
 */
(function () {
  'use strict';
  var doc = document, root = doc.documentElement, body = doc.body;
  if (!body || body.dataset.ykFrameReady) return;
  body.dataset.ykFrameReady = '1';
  var G = typeof window !== 'undefined' ? window : {};

  var cabecera = body.dataset.ykFrame === 'cabecera' ? doc.querySelector('[data-yk-head]') : null;
  var modoCabecera = !!cabecera;

  var titulo = body.dataset.ykTitle || 'ADMIRANEXT';
  var nomIzq = body.dataset.ykRailLeft || 'OPCIONES';
  var nomDer = body.dataset.ykRailRight || 'AVANZADO';
  var nomAbajo = modoCabecera ? 'EXPERTO' : 'Nivel experto';

  function el(tag, cls, html) {
    var n = doc.createElement(tag);
    if (cls) n.className = cls;
    if (html != null) n.innerHTML = html;
    return n;
  }
  function texto(tag, cls, valor) {
    var n = el(tag, cls);
    n.textContent = valor;
    return n;
  }

  // Cada lado del marco tiene UN icono en la barra y UN cajón, y los dos dicen su
  // nombre: el icono declara con aria-controls qué cajón abre y el cajón lleva ese
  // mismo id. Sin ese par, un lector de pantalla ve tres botones sueltos y tres
  // regiones huérfanas, y no hay forma de saber que ▤ abre «AVANZADO».
  var LADOS = ['left', 'right', 'bottom'];
  var IDS = {
    left: {toggle: 'ykOptionsToggle', rail: 'ykOptionsRail'},
    right: {toggle: 'ykAdvancedToggle', rail: 'ykAdvancedRail'},
    bottom: {toggle: 'ykExpertToggle', rail: 'ykExpertRail'}
  };
  // Los glifos del canon, en un único sitio (el test guardián los lee de aquí).
  var GLIFOS = {left: '☰', right: '▤', bottom: '⌘'};

  function icono(lado, nombre) {
    var b = el('button', 'yk-ico', '<span aria-hidden="true">' + GLIFOS[lado] + '</span>');
    b.type = 'button';
    b.id = IDS[lado].toggle;
    b.setAttribute('aria-label', nombre);
    b.setAttribute('aria-controls', IDS[lado].rail);
    b.setAttribute('title', GLIFOS[lado] + ' ' + nombre.charAt(0).toUpperCase() + nombre.slice(1).toLowerCase());
    return b;
  }
  var btnIzq = icono('left', nomIzq);
  var btnDer = icono('right', nomDer);
  var btnAbajo = icono('bottom', nomAbajo);

  // El canon de la casa fija el orden de la esquina derecha: EXPERTO en el extremo
  // y AVANZADO a su izquierda.
  var meta = el('div', modoCabecera ? 'yk-meta yk-head-meta' : 'yk-meta');
  meta.appendChild(btnDer);
  meta.appendChild(btnAbajo);

  // /proyectos/, /proyectos/index.html y /proyectos son la misma página; /flota.html
  // y /flota también (Pages sirve las dos).
  function ruta(href) {
    return String(href || '').split(/[?#]/)[0].replace(/\.html$/, '').replace(/\/index$/, '/').replace(/\/+$/, '') || '/';
  }
  var aquí = ruta(location.pathname);

  var bar;
  var grupo = [];   // enlaces de navegación que ☰ repite (modo cabecera)
  if (modoCabecera) {
    // ── Modo cabecera: la cabecera es de la página; sólo se insertan iconos ────
    bar = cabecera;
    root.classList.add('yk-head-mode');
    cabecera.classList.add('yk-head');
    cabecera.insertBefore(btnIzq, cabecera.firstChild);
    var acceso = cabecera.querySelector('[data-yk-access]');
    if (acceso && acceso.parentNode) acceso.parentNode.insertBefore(meta, acceso.nextSibling);
    else cabecera.appendChild(meta);
    cabecera.querySelectorAll('nav a').forEach(function (a) {
      if (ruta(a.getAttribute('href')) === aquí) a.setAttribute('aria-current', 'page');
      grupo.push(a);
    });
  } else {
    // ── Barra propia del armazón ──────────────────────────────────────────────
    bar = el('header', 'yk-bar');
    bar.setAttribute('role', 'banner');

    // La marca: un solo camino a la home, y va en la barra, no en un raíl.
    // Un SOLO nodo de texto: .yk-logo es inline-flex con gap:8px, así que partir la
    // marca en <b> la separaba visualmente y se leía «AD mira NeXT», en tres piezas.
    var marca = el('a', 'yk-logo', 'ADmiraNeXT');
    marca.href = '/';
    marca.setAttribute('aria-label', 'ADmiraNeXT, inicio');

    var pagina = el('span', 'yk-page', titulo);

    // Enlaces de sección declarados por la página: se suben a la barra tal cual, y el
    // que apunta a la página actual se marca en vez de repetirse como destino.
    var nav = el('nav', 'yk-barnav');
    nav.setAttribute('aria-label', 'Secciones');
    var aquíBarra = location.pathname.replace(/\/+$/, '/');
    doc.querySelectorAll('[data-yk-slot="nav"] a').forEach(function (a) {
      var destino = (a.getAttribute('href') || '').replace(/\/+$/, '/');
      a.classList.add('yk-ico');
      if (destino && destino === aquíBarra) a.setAttribute('aria-current', 'page');
      nav.appendChild(a);
    });
    doc.querySelectorAll('[data-yk-slot="nav"]').forEach(function (n) { n.remove(); });

    bar.appendChild(btnIzq); bar.appendChild(marca); bar.appendChild(pagina);
    if (nav.children.length) bar.appendChild(nav);
    bar.appendChild(meta);
  }

  // ── Raíles y franja inferior ───────────────────────────────────────────────
  // Lo que la página manda a un lado. En modo cabecera cada bloque se vuelve
  // columna (.yk-slot) y puede llevar su rótulo (data-yk-label).
  function mudar(lado, destino) {
    var n = 0;
    doc.querySelectorAll('[data-yk-slot="' + lado + '"]').forEach(function (nodo) {
      if (modoCabecera) {
        nodo.classList.add('yk-slot');
        if (nodo.dataset.ykLabel) destino.appendChild(texto('div', 'yk-rail-sub', nodo.dataset.ykLabel));
      }
      destino.appendChild(nodo);
      n++;
    });
    return n;
  }
  function rail(lado, nombre) {
    var r = el('aside', 'yk-rail yk-rail-' + lado);
    r.id = IDS[lado].rail;
    r.setAttribute('aria-label', nombre);
    r.appendChild(el('div', 'yk-rail-navhd', modoCabecera ? GLIFOS[lado] + ' ' + nombre : nombre));
    if (lado === 'left' && grupo.length) {
      // La navegación del grupo, también en ☰: en móvil la barra la esconde y en
      // escritorio aquí están además las páginas que no caben en la barra.
      r.appendChild(texto('div', 'yk-rail-sub', 'Navegación del grupo'));
      var lista = el('nav', 'yk-rail-group');
      lista.setAttribute('aria-label', 'Navegación del grupo');
      grupo.forEach(function (a) {
        var copia = a.cloneNode(true);
        copia.removeAttribute('id');
        copia.removeAttribute('data-yk-rail-only');
        copia.className = 'yk-rail-navlink';
        lista.appendChild(copia);
      });
      r.appendChild(lista);
    }
    var movidos = mudar(lado, r);
    if (modoCabecera && !movidos && !(lado === 'left' && grupo.length)) r.appendChild(texto('p', 'yk-empty', '— sin opciones en esta página'));
    var sello = '';
    if (modoCabecera) {
      var m = doc.querySelector('meta[name="admiranext-version"]');
      sello = m ? String(m.getAttribute('content') || '').replace(/^AdmiraNeXT\s*/, '') : '';
    }
    var pie = el('div', 'yk-rail-foot');
    pie.appendChild(texto('span', '', 'ADmiraNeXT · ' + (sello || '2026')));
    r.appendChild(pie);
    return r;
  }
  var railIzq = rail('left', nomIzq), railDer = rail('right', nomDer);

  // La CUARTA barra: el nivel experto es un raíl inferior (.yk-rail-bottom), no una
  // sección suelta; se abre con .yk-open-bottom igual que los otros dos.
  var hayCli = modoCabecera || body.dataset.ykCli === 'on';
  var hayAbajo = hayCli || doc.querySelectorAll('[data-yk-slot="bottom"]').length > 0;
  var railAbajo = el('aside', 'yk-rail yk-rail-bottom');
  railAbajo.id = IDS.bottom.rail;
  railAbajo.setAttribute('aria-label', nomAbajo);
  railAbajo.appendChild(el('div', 'yk-rail-navhd', modoCabecera ? GLIFOS.bottom + ' EXPERTO · CLI' : 'NIVEL EXPERTO'));
  var experto = el('div', 'yk-expert');
  doc.querySelectorAll('[data-yk-slot="bottom"]').forEach(function (n) { experto.appendChild(n); });
  railAbajo.appendChild(experto);

  if (!modoCabecera) body.insertBefore(bar, body.firstChild);
  body.appendChild(railIzq); body.appendChild(railDer);
  if (hayAbajo) body.appendChild(railAbajo);

  // ── Apertura ───────────────────────────────────────────────────────────────
  // Paneles independientes (canon de la Galaxia): abrir uno no cierra los otros.
  var CAJON = {left: {btn: btnIzq, rail: railIzq}, right: {btn: btnDer, rail: railDer}, bottom: {btn: btnAbajo, rail: hayAbajo ? railAbajo : null}};
  var CLAVE = 'admiranext_frame_panels_v1';
  var pila = [];   // orden de apertura: Esc sin foco en un panel cierra el último
  var cli = null;
  function abierto(lado) { return root.classList.contains('yk-open-' + lado); }
  function acoplable() {
    return modoCabecera && typeof matchMedia === 'function' && matchMedia('(min-width: 1100px)').matches;
  }
  function guardar() {
    try { localStorage.setItem(CLAVE, JSON.stringify({left: abierto('left'), right: abierto('right'), bottom: abierto('bottom')})); } catch (e) { /* sin almacenamiento: no se recuerda */ }
  }
  function abrir(lado, valor, sinGuardar) {
    if (!CAJON[lado] || !CAJON[lado].rail) return;
    root.classList.toggle('yk-open-' + lado, valor);
    pila = pila.filter(function (l) { return l !== lado; });
    if (valor) pila.push(lado);
    sincronizar();
    if (!sinGuardar) guardar();
  }
  // El estado del cajón se dice UNA vez y para los dos: el botón lo anuncia con
  // aria-expanded y el cajón cerrado se sale del recorrido con inert. Un raíl
  // plegado vive fuera de pantalla con transform, así que sin inert sus enlaces
  // siguen recibiendo el tabulador: se navega a ciegas por un cajón invisible.
  function sincronizar() {
    LADOS.forEach(function (lado) {
      var a = abierto(lado);
      CAJON[lado].btn.setAttribute('aria-expanded', String(a));
      if (!CAJON[lado].rail) return;
      CAJON[lado].rail.inert = !a;
      CAJON[lado].rail.setAttribute('aria-hidden', String(!a));
      // Superpuestos (móvil), el último que se abre queda encima de los demás.
      if (modoCabecera && CAJON[lado].rail.style) CAJON[lado].rail.style.zIndex = a ? String(2147483001 + pila.indexOf(lado)) : '';
    });
    medir();
  }
  // Modo cabecera: la altura de la cabecera y lo que ocupan los paneles abiertos
  // se publican como variables; el contenido se aparta con ellas (acoplado) y los
  // raíles nacen justo debajo de la cabecera.
  function medir() {
    if (!modoCabecera || !root.style || !root.style.setProperty) return;
    var dock = acoplable();
    root.classList.toggle('yk-dock', dock);
    root.style.setProperty('--yk-bar-h', (cabecera.offsetHeight || 76) + 'px');
    var anchoIzq = railIzq.offsetWidth || 300, anchoDer = railDer.offsetWidth || 300;
    root.style.setProperty('--yk-dock-l', dock && abierto('left') ? anchoIzq + 'px' : '0px');
    root.style.setProperty('--yk-dock-r', dock && abierto('right') ? anchoDer + 'px' : '0px');
    root.style.setProperty('--yk-bottom', hayAbajo && abierto('bottom') ? (railAbajo.offsetHeight || 260) + 'px' : '0px');
  }
  function cerrarTodo() { LADOS.forEach(function (l) { if (abierto(l)) abrir(l, false); }); }

  // Estado recordado. Sólo se restaura donde los paneles se acoplan: en un móvil,
  // reabrir un cajón al cargar taparía la página entera nada más entrar.
  if (acoplable()) {
    var previo = null;
    try { previo = JSON.parse(localStorage.getItem(CLAVE) || 'null'); } catch (e) { previo = null; }
    if (previo) LADOS.forEach(function (l) { if (previo[l]) abrir(l, true, true); });
  }
  sincronizar();   // plegado por defecto, y dicho: los tres botones nacen en false
  btnIzq.addEventListener('click', function () { abrir('left', !abierto('left')); });
  btnDer.addEventListener('click', function () { abrir('right', !abierto('right')); });
  btnAbajo.addEventListener('click', function () {
    abrir('bottom', !abierto('bottom'));
    if (abierto('bottom') && cli && cli.input.focus) cli.input.focus();
  });
  doc.addEventListener('keydown', function (e) {
    if (e.key !== 'Escape') return;
    var foco = doc.activeElement, lado = null;
    LADOS.forEach(function (l) {
      var r = CAJON[l].rail;
      if (foco && r && r.contains && r.contains(foco) && abierto(l)) lado = l;
    });
    var conFoco = !!lado;
    if (!lado) lado = pila[pila.length - 1];
    if (!lado) return;
    abrir(lado, false);
    if (conFoco && CAJON[lado].btn.focus) CAJON[lado].btn.focus();
  });
  // Fuera del cajón se cierra, pero sólo cuando los cajones se SUPERPONEN: en móvil
  // ocupan casi toda la pantalla y sin esto hay que apuntar al botón para salir.
  // Acoplados no tapan nada, así que un clic en el contenido no los pliega.
  doc.addEventListener('click', function (e) {
    if (acoplable()) return;
    if (!LADOS.some(abierto)) return;
    if (!e.target || !e.target.closest) return;
    if (e.target.closest('.yk-rail') || e.target.closest(modoCabecera ? '.yk-head' : '.yk-bar')) return;
    // Un control de la página que abre un panel (data-yk-toggle) no lo cierra a la vez.
    if (e.target.closest('[data-yk-toggle]')) return;
    cerrarTodo();
  });
  if (modoCabecera) {
    if (typeof ResizeObserver === 'function') new ResizeObserver(medir).observe(cabecera);
    if (typeof G.addEventListener === 'function') G.addEventListener('resize', medir);
  }

  // ── ⌘ Experto: CLI con registro de verbos ──────────────────────────────────
  var verbos = [];
  function normal(v) { return String(v || '').trim().toLowerCase().replace(/^\//, ''); }
  function buscarVerbo(nombre) {
    nombre = normal(nombre);
    for (var i = 0; i < verbos.length; i++) {
      if (verbos[i].id === nombre || verbos[i].aliases.indexOf(nombre) >= 0) return verbos[i];
    }
    return null;
  }
  function verbo(def) {
    if (!def || !def.id || typeof def.run !== 'function') return;
    var id = normal(def.id);
    verbos = verbos.filter(function (v) { return v.id !== id; });
    verbos.push({id: id, aliases: (def.aliases || []).map(normal), uso: def.uso || '', ayuda: def.ayuda || '', run: def.run});
  }
  function imprimir(linea, tipo) {
    if (!cli) return;
    cli.out.appendChild(texto('div', 'yk-cli-line' + (tipo ? ' yk-cli-' + tipo : ''), String(linea)));
    cli.out.scrollTop = cli.out.scrollHeight;
  }
  var ctx = {
    imprimir: function (t) { imprimir(t); },
    error: function (t) { imprimir(t, 'err'); },
    json: function (obj) { imprimir(JSON.stringify(obj, null, 2), 'json'); },
    abrir: function (lado, valor) { abrir(lado, valor !== false); },
    limpiar: function () { if (cli) cli.out.textContent = ''; }
  };
  function ejecutar(orden) {
    var limpio = String(orden || '').trim();
    if (!limpio) return;
    imprimir('› ' + limpio, 'cmd');
    var partes = limpio.replace(/^\//, '').split(/\s+/);
    var v = buscarVerbo(partes[0]);
    if (!v) { imprimir('Verbo desconocido: /' + partes[0] + ' · escribe /help', 'err'); return; }
    try {
      var r = v.run(partes.slice(1), ctx, limpio);
      if (r && typeof r.then === 'function') r.then(null, function (e) { imprimir('Error: ' + (e && e.message || e), 'err'); });
    } catch (e) { imprimir('Error: ' + (e && e.message || e), 'err'); }
  }

  // Verbos comunes. /help se genera del registro: un verbo nuevo aparece en la
  // ayuda sin tocarla.
  verbo({id: 'help', aliases: ['ayuda', '?'], ayuda: 'Lista los verbos de esta página', run: function () {
    verbos.slice().sort(function (a, b) { return a.id < b.id ? -1 : 1; }).forEach(function (v) {
      imprimir('/' + v.id + (v.uso ? ' ' + v.uso : '') + ' — ' + v.ayuda +
        (v.aliases.length ? ' (alias: ' + v.aliases.map(function (a) { return '/' + a; }).join(' ') + ')' : ''));
    });
  }});
  verbo({id: 'limpiar', aliases: ['clear', 'cls'], ayuda: 'Vacía la salida del CLI', run: function () { ctx.limpiar(); }});
  if (grupo.length) {
    var clavesGrupo = grupo.map(function (a) { return ruta(a.getAttribute('href')).replace(/^\//, '').split('/').pop(); });
    verbo({id: 'ir', aliases: ['go'], uso: '<página>', ayuda: 'Abre una página del grupo: ' + clavesGrupo.join(', '), run: function (args) {
      var buscado = normal(args.join(' '));
      if (!buscado) { imprimir('Uso: /ir <página> · ' + clavesGrupo.join(', '), 'err'); return; }
      var destino = grupo.filter(function (a, i) {
        return clavesGrupo[i].indexOf(buscado) === 0 || normal(a.textContent).indexOf(buscado) === 0;
      })[0];
      if (!destino) { imprimir('No hay ninguna página «' + buscado + '» en el grupo', 'err'); return; }
      if (destino.hidden) { imprimir(destino.textContent + ' requiere un administrador', 'err'); return; }
      imprimir('Abriendo ' + destino.textContent + '…');
      location.href = destino.getAttribute('href');
    }});
  }

  if (hayCli) {
    var caja = el('div', 'yk-cli');
    var salida = el('div', 'yk-cli-out');
    salida.setAttribute('role', 'log');
    salida.setAttribute('aria-live', 'polite');
    salida.setAttribute('tabindex', '0');
    var form = el('form', 'yk-cli-form');
    form.setAttribute('autocomplete', 'off');
    var prompt = texto('label', 'yk-cli-prompt', '›');
    prompt.setAttribute('for', 'ykCliInput');
    var input = el('input', 'yk-cli-input');
    input.id = 'ykCliInput';
    input.type = 'text';
    input.setAttribute('spellcheck', 'false');
    input.setAttribute('autocapitalize', 'off');
    input.setAttribute('aria-label', 'Orden para el CLI');
    input.setAttribute('placeholder', '/help');
    form.appendChild(prompt); form.appendChild(input);
    caja.appendChild(salida); caja.appendChild(form);
    experto.appendChild(caja);
    cli = {out: salida, input: input};
    var historial = [], cursor = 0, CLAVE_HIST = 'admiranext_frame_cli_history_v1';
    try { historial = JSON.parse(localStorage.getItem(CLAVE_HIST) || '[]') || []; } catch (e) { historial = []; }
    cursor = historial.length;
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var orden = input.value;
      input.value = '';
      if (!orden.trim()) return;
      historial = historial.filter(function (h) { return h !== orden; }).concat(orden).slice(-50);
      cursor = historial.length;
      try { localStorage.setItem(CLAVE_HIST, JSON.stringify(historial)); } catch (e2) { /* sin historial persistente */ }
      ejecutar(orden);
    });
    input.addEventListener('keydown', function (e) {
      if (e.key === 'ArrowUp' && historial.length) { e.preventDefault(); cursor = Math.max(0, cursor - 1); input.value = historial[cursor] || ''; }
      else if (e.key === 'ArrowDown' && historial.length) { e.preventDefault(); cursor = Math.min(historial.length, cursor + 1); input.value = historial[cursor] || ''; }
      else if (e.key === 'Tab' && input.value.trim() && input.value.indexOf(' ') < 0) {
        var pre = normal(input.value);
        var cand = verbos.filter(function (v) { return v.id.indexOf(pre) === 0; });
        if (cand.length) e.preventDefault();
        if (cand.length === 1) input.value = '/' + cand[0].id + ' ';
        else if (cand.length > 1) imprimir(cand.map(function (v) { return '/' + v.id; }).join('  '));
      }
    });
    imprimir('CLI de ' + (doc.title || 'AdmiraNeXT') + ' · escribe /help');
  }

  (Array.isArray(G.ADMIRA_FRAME_VERBS) ? G.ADMIRA_FRAME_VERBS : []).forEach(verbo);
  G.AdmiraFrame = {
    verbo: verbo,
    ejecutar: ejecutar,
    abrir: function (lado, valor) { abrir(lado, valor !== false); },
    abierto: abierto,
    glifos: GLIFOS
  };
  if (typeof CustomEvent === 'function' && doc.dispatchEvent) doc.dispatchEvent(new CustomEvent('admira-frame:ready'));
})();
