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
 * estar abiertos a la vez), entran cerrados en cada página (desde el 3-oct-2026;
 * antes se recordaban) y Esc cierra el panel enfocado (o, si el foco no está en
 * ninguno, el último que se abrió).
 * Hasta esta versión los glifos eran ⋯ y ⌄ y abrir uno cerraba los otros.
 *
 * MODO CABECERA (<body data-yk-frame="cabecera">): la página conserva SU cabecera
 * (<header data-yk-head> con la marca, la navegación y «● Acceso privado») y el
 * armazón sólo inserta los iconos en su sitio:
 *
 *   [☰] admiraNeXT · Analitics · Webmaster · Proyectos · … ● Acceso privado [▤] [⌘]
 *
 * La navegación de la cabecera se copia además en ☰ (en móvil la barra la
 * esconde); los enlaces con data-yk-rail-only sólo se ven en ☰. Los paneles se
 * SUPERPONEN al contenido en cualquier ancho (Carlos, 3-oct-2026: «el cuerpo
 * central del site no se desplaza al abrir las barras opcionales, ni verticales ni
 * la horizontal inferior»): el contenido no cambia de sitio ni de ancho. La franja
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

  // ── Idioma del armazón (06-10-2026) ────────────────────────────────────────
  // Carlos: «el cambio de idioma en modo experto en las webs satélites no funciona».
  // /idioma ENG (o /language) cambiaba <html lang>, pero el armazón —☰ ▤ ⌘, la
  // navegación común de la cabecera, los paneles y el CLI— seguía en castellano y
  // parecía que la orden no hacía nada. El castellano sigue siendo el texto del HTML;
  // el armazón traduce lo suyo y la cabecera común con este diccionario, y sigue en
  // vivo cada cambio de <html lang> (piel ⌘ Experto, botones propios, idioma
  // guardado). Lo que una página quiera traducir de lo suyo va en data-en /
  // data-en-title / data-en-placeholder / data-en-aria-label (mismo contrato que
  // admira.live, admira-idioma.js).
  function enIngles() { return /^en/i.test(root.getAttribute && root.getAttribute('lang') || ''); }
  function T(es, en) { return enIngles() ? en : es; }
  var DICC = {
    'OPCIONES': 'OPTIONS', 'AVANZADO': 'ADVANCED', 'EXPERTO': 'EXPERT', 'EXPERTO · CLI': 'EXPERT · CLI',
    'NIVEL EXPERTO': 'EXPERT LEVEL', 'Nivel experto': 'Expert level',
    'Opciones': 'Options', 'Avanzado': 'Advanced', 'Experto': 'Expert',
    'Redimensionar Opciones': 'Resize Options', 'Redimensionar Avanzado': 'Resize Advanced',
    'Redimensionar Experto': 'Resize Expert', 'Redimensionar Nivel experto': 'Resize Expert level',
    'Arrastra para cambiar el tamaño · doble clic: tamaño por defecto': 'Drag to resize · double click: default size',
    'Navegación del grupo': 'Group navigation', 'Secciones': 'Sections',
    'sin opciones en esta página': 'no options on this page', 'esta página no tiene secciones': 'this page has no sections',
    'Acciones': 'Actions', 'Ir a': 'Go to', 'ADmiraNeXT, inicio': 'ADmiraNeXT, home', 'ADmiraNeXT · Inicio': 'ADmiraNeXT · Home',
    'Orden para el CLI': 'CLI command',
    // Cabecera común del grupo (la misma en todas las páginas con armazón)
    'Proyectos': 'Projects', 'Usuarios': 'Users', 'Agentes': 'Agents', 'Organigrama': 'Org chart',
    'Presentaciones': 'Presentations', 'Proyectos y locales': 'Projects and venues',
    'Página pública': 'Public page', 'Acceso privado': 'Private access',
    // Mapa del sitio (modo automático)
    'La casa': 'The house', 'Operación': 'Operations', 'Estudio': 'Studio',
    'El Consejo': 'The Council', 'Academia': 'Academy', 'Mandamientos': 'Commandments',
    'Normativa': 'Rules', 'Filosofía': 'Philosophy', 'Flota': 'Fleet', 'Presupuestos': 'Budgets',
    'Créditos': 'Credits', 'Impacto': 'Impact', 'Marca blanca': 'White label', 'Informes': 'Reports'
  };
  // Página entera (06-10-2026 10:11, Carlos: «sigo sin ver el cambio de idioma»): además del
  // armazón se traduce el TEXTO FIJO de cada página (títulos, contadores, botones, chips,
  // leyendas, rótulos de las patas…), lo que la página pinte por JS después incluido. El
  // diccionario de páginas vive en /assets/idioma-armazon.js y sólo se descarga cuando
  // alguien pide inglés. Los datos escritos en castellano (títulos de hitos…) se quedan.
  var EXTRA = {dicc: {}, reglas: []};
  function tiene(o, k) { return Object.prototype.hasOwnProperty.call(o, k); }
  function buscar(core) {
    if (tiene(DICC, core)) return DICC[core];
    if (tiene(EXTRA.dicc, core)) return EXTRA.dicc[core];
    for (var i = 0; i < EXTRA.reglas.length; i++) {
      var r = EXTRA.reglas[i], m = core.match(r[0]);
      if (m) return typeof r[1] === 'function' ? r[1](m, traducirFrase) : core.replace(r[0], r[1]);
    }
    return null;
  }
  // Una frase «a · b · c» se traduce por trozos si no está entera en el diccionario.
  function traducirFrase(core) {
    var t = buscar(core);
    if (t != null) return t;
    if (core.indexOf(' · ') < 0) return null;
    var cambio = false;
    var partes = core.split(' · ').map(function (p) {
      var q = buscar(p);
      if (q != null && q !== p) { cambio = true; return q; }
      return p;
    });
    return cambio ? partes.join(' · ') : null;
  }
  // «☰ OPCIONES», «○ Página pública», «— sin opciones…»: el adorno de delante se conserva.
  function traduceTexto(orig) {
    var m = String(orig == null ? '' : orig).match(/^([^A-Za-z\u00C0-\u024F0-9¿¡]*)([\s\S]*?)(\s*)$/);
    if (!m || !m[2]) return null;
    // El HTML parte las frases largas en varias líneas: se buscan con los espacios normalizados.
    var core = m[2].replace(/\s+/g, ' ');
    var t = traducirFrase(core), fin = '';
    // «La mesa que une las cinco patas.»: el cierre (punto, comillas…) también se conserva.
    if (t == null) {
      var c = core.match(/^([\s\S]*?[^.»"”:…!?\s])([\s.»"”:…!?·]+)$/);
      if (c) { t = traducirFrase(c[1]); fin = c[2]; }
    }
    return t == null || t + fin === core ? null : m[1] + t + fin + m[3];
  }
  var originales = typeof WeakMap === 'function' ? new WeakMap() : null;
  var ATRS_DICC = ['aria-label', 'title', 'placeholder'];
  var FUERA = '.yk-cli-out, .ax-cli-out, .ax-engine, script, style, textarea, [contenteditable], [data-yk-no-traducir]';
  // Los atributos (placeholder de un textarea, title…) sí se traducen aunque el texto de dentro no.
  var FUERA_ATR = '.yk-cli-out, .ax-cli-out, .ax-engine, script, style, [contenteditable], [data-yk-no-traducir]';
  function traducirTextoNodo(n, en) {
    var padre = n.parentNode;
    if (!padre || (padre.closest && padre.closest(FUERA))) return;
    var reg = originales.get(n), actual = n.nodeValue;
    // La página reescribió el nodo (no es ni el original ni nuestra traducción): manda lo nuevo.
    if (reg && actual !== reg.o && actual !== reg.t) reg = null;
    var orig = reg ? reg.o : actual;
    var trad = reg ? reg.t : traduceTexto(orig);
    if (trad == null) return;
    if (!reg) originales.set(n, {o: orig, t: trad});
    var quiero = en ? trad : orig;
    if (actual !== quiero) n.nodeValue = quiero;
  }
  function traducirAtributos(e, en) {
    ATRS_DICC.forEach(function (a) {
      if (!e.hasAttribute || !e.hasAttribute(a)) return;
      var ko = 'data-yk-es-' + a, kt = 'data-yk-en-' + a, actual = e.getAttribute(a);
      var orig = e.getAttribute(ko), trad = e.getAttribute(kt);
      if (orig == null || (actual !== orig && actual !== trad)) {
        orig = actual; trad = traduceTexto(orig);
        if (trad == null) { e.removeAttribute(ko); e.removeAttribute(kt); return; }
        e.setAttribute(ko, orig); e.setAttribute(kt, trad);
      }
      var quiero = en ? trad : orig;
      if (actual !== quiero) e.setAttribute(a, quiero);
    });
  }
  function traducirZona(zona, en) {
    if (!zona || !originales || !doc.createTreeWalker) return;
    if (zona.nodeType === 3) { traducirTextoNodo(zona, en); return; }
    if (zona.nodeType !== 1) return;
    if (zona.closest && zona.closest(FUERA)) { if (!zona.closest(FUERA_ATR)) traducirAtributos(zona, en); return; }
    var paseo = doc.createTreeWalker(zona, 4, null), n;
    while ((n = paseo.nextNode())) traducirTextoNodo(n, en);
    var nodos = [zona].concat(Array.prototype.slice.call(zona.querySelectorAll ? zona.querySelectorAll('[aria-label],[title],[placeholder]') : []));
    nodos.forEach(function (e) { if (!(e.closest && e.closest(FUERA_ATR))) traducirAtributos(e, en); });
  }
  var zonasIdioma = [];
  var idiomaPintado = false;   // el HTML nace en castellano: no hay nada que traducir hasta que pidan inglés
  var vigia = null, diccPedido = false;
  // Lo que la página pinte o repinte en inglés también se traduce (contadores, Gantt, fichas…).
  function vigilar(en) {
    if (typeof MutationObserver !== 'function' || !body) return;
    if (!vigia) {
      vigia = new MutationObserver(function (lista) {
        if (!enIngles()) return;
        try {
          lista.forEach(function (r) {
            if (r.type === 'characterData') traducirZona(r.target, true);
            else if (r.type === 'attributes') { if (r.target.closest && !r.target.closest(FUERA_ATR)) traducirAtributos(r.target, true); }
            else Array.prototype.forEach.call(r.addedNodes || [], function (x) { traducirZona(x, true); });
          });
        } catch (e) { /* una traducción fallida no rompe la página */ }
      });
    }
    if (en) vigia.observe(body, {childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ATRS_DICC});
    else vigia.disconnect();
  }
  function pedirDiccionario() {
    if (diccPedido || !doc.createElement) return;
    diccPedido = true;
    var s = doc.createElement('script');
    s.src = '/assets/idioma-armazon.js?v=' + IDIOMA_STAMP;
    s.async = true;
    s.onload = function () { if (enIngles()) aplicarIdioma(true); };
    (doc.head || root).appendChild(s);
  }
  var IDIOMA_STAMP = '20261006-escenas-1';
  function aplicarIdioma(forzar) {
    var en = enIngles();
    if (!forzar && idiomaPintado === en) return;
    idiomaPintado = en;
    if (en) pedirDiccionario();
    // Traducir nunca puede tumbar el armazón: si algo falla, se queda como estaba.
    try { zonasIdioma.forEach(function (z) { traducirZona(z, en); }); } catch (e) { /* sigue en el idioma anterior */ }
    try { vigilar(en); } catch (e) { /* sin vigía: se traduce lo que hay */ }
    // La cabecera cambia de ancho: que vuelva a medir y a plegar su navegación.
    try { if (typeof G.dispatchEvent === 'function' && typeof Event === 'function') G.dispatchEvent(new Event('resize')); } catch (e) { /* nada */ }
  }
  // /assets/idioma-armazon.js añade aquí su diccionario y sus reglas ([RegExp, reemplazo|función]).
  G.AdmiraIdiomaArmazon = {
    anadir: function (dicc, reglas) {
      Object.keys(dicc || {}).forEach(function (k) { EXTRA.dicc[k] = dicc[k]; });
      (reglas || []).forEach(function (r) { if (r && r[0] instanceof RegExp) EXTRA.reglas.push(r); });
    },
    traducir: function (texto) { var t = traduceTexto(texto); return t == null ? String(texto) : t; },
    aplicar: function () { aplicarIdioma(true); }
  };

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
  // El logotipo oficial, en un único sitio: «ADmira» en blanco y N·e·X·T en neón.
  var LOGO = '<span class="yk-wm-admira">ADmira</span><span class="yk-wm-next"><span class="yk-wm-n">N</span><span class="yk-wm-e">e</span><span class="yk-wm-x">X</span><span class="yk-wm-t">T</span></span>';

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
    // La marca de la cabecera es el LOGOTIPO OFICIAL (libro-de-estilo.html §7.4), el
    // mismo que pinta el modo barra. Las páginas ya lo traen en su HTML; si alguna
    // vuelve al «admiraNeXT.» en minúscula con punto, aquí se corrige.
    var marcaCab = cabecera.querySelector('a[href="/"]');
    if (marcaCab && String(marcaCab.innerHTML || '').indexOf('yk-wm-next') < 0) marcaCab.innerHTML = LOGO;
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
    // Es el LOGOTIPO OFICIAL (libro-de-estilo.html §7.4, el mismo de la portada,
    // .titlebar-brand de index.html): «ADmira» en blanco y N·e·X·T en neón rosa,
    // amarillo, verde y magenta. Hasta el 2-oct era texto plano «ADmiraNeXT» en
    // monoespaciada y Carlos lo señaló en el generador: «no respeta el logo». Las
    // piezas van pegadas (.yk-bar .yk-logo lleva gap:0), así que se lee de un tirón.
    var marca = el('a', 'yk-logo yk-wordmark', LOGO);
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

  // ── Modo AUTOMÁTICO (<body data-yk-auto="on">, en modo barra o con cabecera) ──
  // Para las páginas de admiranext.com que tenían cabecera propia (Carlos, 2-oct-2026:
  // «hay que utilizar el logo de AdmiraNeXT» y la fórmula en todas): sin escribir
  // slots, ☰ trae el MAPA DEL SITIO (lo que lleva a otra página), ▤ las ACCIONES de
  // la página (cada [data-yk-accion] se repite como botón que pulsa el original) y
  // «Ir a» sus secciones (los <h2> del contenido), y ⌘ el CLI con /ir, /seccion y
  // /arriba. Lo que la página declare en data-yk-slot va DELANTE de lo automático.
  var SITIO = Array.isArray(G.ADMIRA_FRAME_SITIO) ? G.ADMIRA_FRAME_SITIO : [
    {grupo: 'La casa', enlaces: [['/consejo/', 'El Consejo'], ['/organigrama', 'Organigrama'], ['/academia', 'Academia'], ['/mandamientos', 'Mandamientos'], ['/normativa', 'Normativa'], ['/filosofia', 'Filosofía'], ['/help/', '/help']]},
    {grupo: 'Operación', enlaces: [['/proyectos/', 'Proyectos'], ['/flota', 'Flota'], ['/status', 'Status'], ['/mcp/', 'Hub MCP'], ['/telegram/', 'Telegram']]},
    {grupo: 'Estudio', enlaces: [['/presentaciones/galeria', 'Presentaciones'], ['/presites/', 'Presites'], ['/tiktok/', 'TikTok'], ['/presupuestos/', 'Presupuestos'], ['/creditos/', 'Créditos'], ['/impacto/', 'Impacto'], ['/marcablanca/', 'Marca blanca'], ['/demo/', 'Créame demo'], ['/informes/', 'Informes'], ['/signage-benchmarks', 'Benchmarks']]}
  ];
  // Desde el 3-oct-2026 el modo automático también va con la CABECERA del grupo
  // (<body data-yk-frame="cabecera" data-yk-auto="on">): Carlos, «la barra superior
  // tiene que ser igual en todas las páginas de un sitio». La barra es la de
  // /proyectos/; lo automático (mapa del sitio, acciones, «Ir a», /seccion, /arriba)
  // va a los paneles igual que en modo barra. En ☰ el mapa del sitio va debajo de la
  // navegación del grupo y no repite sus páginas.
  var modoAuto = body.dataset.ykAuto === 'on';
  var secciones = [], sitioPlano = [], construirIrA = function () {};
  function slugar(t) {
    return String(t || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 48) || 'seccion';
  }
  function irA(n) { if (n && n.scrollIntoView) n.scrollIntoView({behavior: 'smooth', block: 'start'}); }
  if (modoAuto) {
    root.classList.add('yk-auto');
    if (!modoCabecera) root.classList.add('yk-framed');
    var izqAuto = el('div', 'yk-auto-blk');
    izqAuto.setAttribute('data-yk-slot', 'left');
    var rutasGrupo = grupo.map(function (a) { return ruta(a.getAttribute('href')); });
    grupo.forEach(function (a, i) {
      sitioPlano.push({href: a.getAttribute('href'), nombre: String(a.textContent || '').trim(), clave: rutasGrupo[i].replace(/^\//, '').split('/').pop() || 'inicio'});
    });
    SITIO.forEach(function (g) {
      var enlaces = g.enlaces.filter(function (par) { return rutasGrupo.indexOf(ruta(par[0])) < 0; });
      if (!enlaces.length) return;
      izqAuto.appendChild(texto('div', 'yk-auto-hd', g.grupo));
      var lista = el('nav', 'yk-auto-list');
      lista.setAttribute('aria-label', g.grupo);
      enlaces.forEach(function (par) {
        var a = texto('a', 'yk-auto-act', par[1]);
        a.href = par[0];
        if (ruta(par[0]) === aquí) a.setAttribute('aria-current', 'page');
        lista.appendChild(a);
        sitioPlano.push({href: par[0], nombre: par[1], clave: ruta(par[0]).replace(/^\//, '').split('/').pop() || 'inicio'});
      });
      izqAuto.appendChild(lista);
    });
    var derAuto = el('div', 'yk-auto-blk');
    derAuto.setAttribute('data-yk-slot', 'right');
    var acciones = doc.querySelectorAll('[data-yk-accion]');
    if (acciones.length) {
      derAuto.appendChild(texto('div', 'yk-auto-hd', 'Acciones'));
      var listaAcc = el('div', 'yk-auto-list');
      acciones.forEach(function (orig) {
        var b = texto('button', 'yk-auto-act', orig.dataset.ykAccion || String(orig.textContent || '').trim());
        b.type = 'button';
        b.addEventListener('click', function () { orig.click(); });
        listaAcc.appendChild(b);
      });
      derAuto.appendChild(listaAcc);
    }
    derAuto.appendChild(texto('div', 'yk-auto-hd', 'Ir a'));
    var listaIr = el('div', 'yk-auto-list');
    derAuto.appendChild(listaIr);
    construirIrA = function () {
      // Se rehace cada vez que se abre ▤: hay páginas (academia, consejero…) que
      // pintan sus secciones después de cargar, leídas en vivo.
      secciones = [];
      doc.querySelectorAll(body.dataset.ykSecciones || 'h2').forEach(function (h) {
        if (h.closest && h.closest('header, nav, footer, [data-yk-slot], .yk-rail, [hidden], dialog, template')) return;
        var t = String(h.textContent || '').replace(/\s+/g, ' ').trim();
        if (!t || secciones.length >= 40) return;
        var destino = h.closest && h.closest('section[id], article[id]') || h;
        if (!destino.id) {
          var id = 'sec-' + slugar(t), k = id, i = 2;
          while (doc.getElementById(k)) k = id + '-' + (i++);
          destino.id = k;
        }
        if (secciones.some(function (x) { return x.nodo === destino; })) return;
        secciones.push({nodo: destino, titulo: t.length > 64 ? t.slice(0, 62) + '…' : t});
      });
      listaIr.textContent = '';
      if (!secciones.length) listaIr.appendChild(texto('p', 'yk-empty', '— esta página no tiene secciones'));
      secciones.forEach(function (s, i) {
        var b = el('button', 'yk-auto-act');
        b.type = 'button';
        b.appendChild(texto('span', '', s.titulo));
        b.appendChild(texto('b', '', String(i + 1)));
        b.addEventListener('click', function () { irA(s.nodo); });
        listaIr.appendChild(b);
      });
    };
    construirIrA();
    body.appendChild(izqAuto);
    body.appendChild(derAuto);
  }

  // ── Fondo común: puntos que se iluminan con el ratón (modo cabecera) ─────────
  // Carlos, 3-oct-2026: «el mismo fondo de digitalsignage.ai que se ilumina con el
  // ratón» en todas las páginas con la barra del sitio. Es el .dsn-dots de allí, sin
  // librerías: una capa fija detrás del contenido (estilos en admira-frame.css,
  // .yk-dots). El halo sólo se recoloca en un requestAnimationFrame cuando el ratón
  // se mueve; en táctil o con prefers-reduced-motion no se escucha el puntero y el
  // halo queda fijo (y las esquinas no respiran).
  if (modoCabecera) {   // una sola vez: el armazón no se monta dos veces (ykFrameReady)
    var puntos = el('div', 'yk-dots', '<i class="yk-dots-base"></i><i class="yk-dots-idle"></i><i class="yk-dots-halo"></i>');
    puntos.setAttribute('aria-hidden', 'true');
    body.insertBefore(puntos, body.firstChild);
    var mm = typeof G.matchMedia === 'function' ? G.matchMedia.bind(G) : null;
    var fino = mm ? mm('(hover: hover) and (pointer: fine)') : null, calma = mm ? mm('(prefers-reduced-motion: reduce)') : null;
    var px = 0, py = 0, cuadro = 0;
    var pintar = function () { cuadro = 0; puntos.style.setProperty('--x', px + 'px'); puntos.style.setProperty('--y', py + 'px'); };
    if (typeof G.addEventListener === 'function') G.addEventListener('pointermove', function (e) {
      if (e.pointerType !== 'mouse' || !fino || !fino.matches || (calma && calma.matches)) return;
      px = e.clientX; py = e.clientY;
      if (!cuadro && typeof G.requestAnimationFrame === 'function') cuadro = G.requestAnimationFrame(pintar);
    }, {passive: true});
    if (calma && calma.addEventListener) calma.addEventListener('change', function () {
      if (calma.matches && puntos.style.removeProperty) { puntos.style.removeProperty('--x'); puntos.style.removeProperty('--y'); }
    });
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
    var pie = el('div', 'yk-rail-foot');
    var piePlaca = texto('span', '', 'ADmiraNeXT · ' + (selloMeta() || '2026'));
    piePlaca.setAttribute('data-yk-sello', '');
    pie.appendChild(piePlaca);
    r.appendChild(pie);
    return r;
  }
  // El pie de los paneles dice la versión VIVA (Carlos, 3-oct-2026: el de /flota decía
  // v.02.10.2026.r10 con producción en la r3 del 3-oct, porque leía el <meta> de la
  // página y ése sólo avanza cuando alguien la toca). Manda /version.json, el
  // manifiesto que genera cada publicación; el <meta> es el respaldo mientras llega
  // (o si no existe, como en local).
  function selloMeta() {
    var m = doc.querySelector('meta[name="admiranext-version"]');
    var v = m ? String(m.getAttribute('content') || '').match(/v\.\d{2}\.\d{2}\.\d{4}\.r\d+\.\d{2}:\d{2}/) : null;
    return v ? v[0] : '';
  }
  function selloVivo() {
    if (typeof G.fetch !== 'function') return;
    G.fetch('/version.json', {cache: 'no-store'}).then(function (r) { return r.ok ? r.json() : null; }).then(function (d) {
      var v = d && String(d.version || d.sello || '').match(/v\.\d{2}\.\d{2}\.\d{4}\.r\d+\.\d{2}:\d{2}/);
      if (!v) return;
      doc.querySelectorAll('[data-yk-sello]').forEach(function (n) { n.textContent = 'ADmiraNeXT · ' + v[0]; });
    }).catch(function () { /* sin manifiesto: se queda el del <meta> */ });
  }
  var railIzq = rail('left', nomIzq), railDer = rail('right', nomDer);

  // La CUARTA barra: el nivel experto es un raíl inferior (.yk-rail-bottom), no una
  // sección suelta; se abre con .yk-open-bottom igual que los otros dos.
  var hayCli = modoCabecera || modoAuto || body.dataset.ykCli === 'on';
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
  selloVivo();

  // ── Apertura ───────────────────────────────────────────────────────────────
  // Paneles independientes (canon de la Galaxia): abrir uno no cierra los otros.
  var CAJON = {left: {btn: btnIzq, rail: railIzq}, right: {btn: btnDer, rail: railDer}, bottom: {btn: btnAbajo, rail: hayAbajo ? railAbajo : null}};
  // Los paneles NO se recuerdan abiertos entre páginas (3-oct-2026): ahora se
  // superponen en cualquier ancho, y reabrirlos al entrar taparía el contenido nada
  // más cargar. Se borra el estado que guardaban las versiones anteriores.
  try { localStorage.removeItem('admiranext_frame_panels_v1'); } catch (e) { /* sin almacenamiento */ }
  var pila = [];   // orden de apertura: Esc sin foco en un panel cierra el último
  var cli = null;
  function abierto(lado) { return root.classList.contains('yk-open-' + lado); }
  function abrir(lado, valor) {
    if (!CAJON[lado] || !CAJON[lado].rail) return;
    root.classList.toggle('yk-open-' + lado, valor);
    pila = pila.filter(function (l) { return l !== lado; });
    if (valor) pila.push(lado);
    sincronizar();
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
      // Superpuestos, el último que se abre queda encima de los demás.
      if (modoCabecera && CAJON[lado].rail.style) CAJON[lado].rail.style.zIndex = a ? String(2147483001 + pila.indexOf(lado)) : '';
    });
    medir();
  }
  // Modo cabecera: la altura de la cabecera se publica en --yk-bar-h (el contenido
  // baja ese alto, siempre el mismo) y los raíles nacen justo debajo. Lo que ocupen
  // los paneles abiertos NO se publica: el contenido no se aparta (hasta el 3-oct, en
  // ≥1100 px, --yk-dock-l/-r y --yk-bottom lo empujaban y el globo de /analitics se
  // redimensionaba).
  function medir() {
    if (!modoCabecera || !root.style || !root.style.setProperty) return;
    root.style.setProperty('--yk-bar-h', (cabecera.offsetHeight || 76) + 'px');
  }
  function cerrarTodo() { LADOS.forEach(function (l) { if (abierto(l)) abrir(l, false); }); }

  sincronizar();   // plegado por defecto, y dicho: los tres botones nacen en false
  btnIzq.addEventListener('click', function () { abrir('left', !abierto('left')); });
  btnDer.addEventListener('click', function () { if (!abierto('right')) construirIrA(); abrir('right', !abierto('right')); });
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
  // Fuera del cajón se cierra: los cajones se superponen al contenido (en cualquier
  // ancho) y sin esto hay que apuntar al botón para volver a él.
  doc.addEventListener('click', function (e) {
    if (!LADOS.some(abierto)) return;
    if (!e.target || !e.target.closest) return;
    if (e.target.closest('.yk-rail') || e.target.closest('.yk-resize') || e.target.closest(modoCabecera ? '.yk-head' : '.yk-bar')) return;
    // Un control de la página que abre un panel (data-yk-toggle) no lo cierra a la vez.
    if (e.target.closest('[data-yk-toggle]')) return;
    cerrarTodo();
  });
  if (modoCabecera) {
    var navGrupo = cabecera.querySelector('nav');
    // Si los enlaces no caben en la caja del nav, se salen y tapan la derecha.
    // Se esconden: ☰ ya lleva la misma lista. Primero se quita el pliegue para
    // medir de verdad; si el CSS de móvil ya los escondió, no hay nada que plegar.
    function plegarNav() {
      if (!navGrupo || !cabecera.classList) return;
      cabecera.classList.remove('yk-nav-folded');
      var caja = G.getComputedStyle ? G.getComputedStyle(navGrupo) : null;
      if (!caja || caja.display === 'none') return;
      if (navGrupo.scrollWidth > navGrupo.clientWidth + 1) cabecera.classList.add('yk-nav-folded');
    }
    plegarNav();
    if (typeof ResizeObserver === 'function') new ResizeObserver(function () { medir(); plegarNav(); }).observe(cabecera);
    if (typeof G.addEventListener === 'function') G.addEventListener('resize', function () { medir(); plegarNav(); });
    if (doc.fonts && doc.fonts.ready && typeof doc.fonts.ready.then === 'function') doc.fonts.ready.then(plegarNav).catch(function () {});
  }

  // ── Paneles REDIMENSIONABLES (Carlos, 2-oct-2026: «en la UX cuadrática siempre
  // tienen que ser resizables las ventanas de opciones, avanzado y experto») ────
  // Cada panel lleva un tirador en su borde INTERIOR: ☰ el derecho, ▤ el izquierdo y
  // ⌘ el superior. Se arrastra con el ratón o el dedo, o con el teclado (flechas;
  // Mayús = pasos largos; Inicio/Fin = mínimo/máximo; Intro o doble clic = tamaño por
  // defecto). El tamaño se recuerda entre páginas (admiranext_frame_sizes_v1). Los
  // tiradores viven FUERA del panel (position:fixed), porque el panel hace scroll y un
  // hijo absoluto se iría con el contenido; sólo se ven con su panel abierto.
  var CLAVE_TAM = 'admiranext_frame_sizes_v1';
  var EJE = {left: 'x', right: 'x', bottom: 'y'};
  var VAR_TAM = {left: '--yk-w-left', right: '--yk-w-right', bottom: '--yk-h-bottom'};
  var NOMBRE = {left: nomIzq, right: nomDer, bottom: nomAbajo};
  var tamaños = {};
  try { tamaños = JSON.parse(localStorage.getItem(CLAVE_TAM) || '{}') || {}; } catch (e) { tamaños = {}; }
  function ancho() { return G.innerWidth || 1280; }
  function alto() { return G.innerHeight || 800; }
  function limites(lado) {
    if (EJE[lado] === 'y') {
      var barra = (bar && bar.offsetHeight) || 46;
      return {min: 120, max: Math.max(160, Math.round(alto() - barra - 60))};
    }
    var w = ancho();
    return {min: Math.min(220, Math.round(w * 0.8)), max: w <= 720 ? Math.round(w * 0.92) : Math.min(760, Math.round(w * 0.6))};
  }
  function medida(lado) {
    var r = CAJON[lado].rail;
    return r ? Math.round(EJE[lado] === 'y' ? r.offsetHeight : r.offsetWidth) || 0 : 0;
  }
  var tiradores = {};
  function aplicarTam(lado, px, guardarlo) {
    if (!root.style || !root.style.setProperty) return;
    if (px == null) {
      if (root.style.removeProperty) root.style.removeProperty(VAR_TAM[lado]);
      delete tamaños[lado];
    } else {
      var l = limites(lado);
      px = Math.round(Math.min(l.max, Math.max(l.min, px)));
      root.style.setProperty(VAR_TAM[lado], px + 'px');
      tamaños[lado] = px;
    }
    var t = tiradores[lado];
    if (t) {
      var l2 = limites(lado);
      t.setAttribute('aria-valuemin', String(l2.min));
      t.setAttribute('aria-valuemax', String(l2.max));
      t.setAttribute('aria-valuenow', String(px == null ? medida(lado) : px));
    }
    medir();
    if (guardarlo) { try { localStorage.setItem(CLAVE_TAM, JSON.stringify(tamaños)); } catch (e) { /* sin almacenamiento */ } }
  }
  function tirador(lado) {
    var r = CAJON[lado].rail;
    if (!r) return null;
    var t = el('div', 'yk-resize yk-resize-' + lado);
    t.setAttribute('role', 'separator');
    t.setAttribute('tabindex', '0');
    t.setAttribute('aria-orientation', EJE[lado] === 'y' ? 'horizontal' : 'vertical');
    t.setAttribute('aria-controls', IDS[lado].rail);
    t.setAttribute('aria-label', 'Redimensionar ' + NOMBRE[lado].charAt(0) + NOMBRE[lado].slice(1).toLowerCase());
    t.setAttribute('title', 'Arrastra para cambiar el tamaño · doble clic: tamaño por defecto');
    var arrastre = null;
    function desde(e) {
      return lado === 'left' ? e.clientX : lado === 'right' ? ancho() - e.clientX : alto() - e.clientY;
    }
    t.addEventListener('pointerdown', function (e) {
      if (e.button !== undefined && e.button !== 0) return;
      e.preventDefault();
      arrastre = {id: e.pointerId};
      if (t.setPointerCapture) { try { t.setPointerCapture(e.pointerId); } catch (x) { /* nada */ } }
      root.classList.add('yk-resizing');
    });
    t.addEventListener('pointermove', function (e) {
      if (!arrastre) return;
      aplicarTam(lado, desde(e), false);
    });
    function soltar() {
      if (!arrastre) return;
      arrastre = null;
      root.classList.remove('yk-resizing');
      try { localStorage.setItem(CLAVE_TAM, JSON.stringify(tamaños)); } catch (e) { /* sin almacenamiento */ }
    }
    t.addEventListener('pointerup', soltar);
    t.addEventListener('pointercancel', soltar);
    t.addEventListener('dblclick', function () { aplicarTam(lado, null, true); });
    t.addEventListener('keydown', function (e) {
      var paso = e.shiftKey ? 64 : 16, actual = tamaños[lado] || medida(lado), l = limites(lado), nuevo = null;
      // Las flechas mueven el BORDE: en ☰ la derecha agranda, en ▤ la izquierda, en ⌘ arriba.
      var crece = {left: 'ArrowRight', right: 'ArrowLeft', bottom: 'ArrowUp'}[lado];
      var mengua = {left: 'ArrowLeft', right: 'ArrowRight', bottom: 'ArrowDown'}[lado];
      if (e.key === crece) nuevo = actual + paso;
      else if (e.key === mengua) nuevo = actual - paso;
      else if (e.key === 'Home') nuevo = l.min;
      else if (e.key === 'End') nuevo = l.max;
      else if (e.key === 'Enter') { e.preventDefault(); aplicarTam(lado, null, true); return; }
      else return;
      e.preventDefault();
      aplicarTam(lado, nuevo, true);
    });
    body.appendChild(t);
    tiradores[lado] = t;
    return t;
  }
  LADOS.forEach(function (lado) {
    tirador(lado);
    if (tamaños[lado]) aplicarTam(lado, tamaños[lado], false);
    else if (tiradores[lado]) aplicarTam(lado, null, false);
  });
  // Si la ventana encoge, el tamaño guardado se recorta a lo que cabe (sin olvidarlo).
  if (typeof G.addEventListener === 'function') G.addEventListener('resize', function () {
    LADOS.forEach(function (lado) {
      if (!tamaños[lado] || !root.style || !root.style.setProperty) return;
      var l = limites(lado);
      root.style.setProperty(VAR_TAM[lado], Math.min(l.max, Math.max(l.min, tamaños[lado])) + 'px');
    });
    medir();
  });

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
  // Verbos bilingües (Carlos, 06-10-2026 10:58): cada verbo del CLI vale en castellano y en inglés.
  // Al registrar un verbo se le añade su pareja como alias (si nadie más la usa). Escribir la forma
  // castellana pone la web en castellano y la inglesa en inglés; lo que se escribe igual en los dos
  // idiomas (/json, /manifest…) no toca el idioma. Forma compacta: /marca84 = /marca 84.
  var PARES_ES_EN = [
    ['ayuda', 'help'], ['limpiar', 'clear'], ['ir', 'go'], ['seccion', 'section'], ['arriba', 'top'],
    ['marca', 'brand'], ['estado', 'status'], ['buscar', 'search'], ['refrescar', 'refresh'], ['actualizar', 'update'],
    ['misiones', 'missions'], ['copiar', 'copy'], ['generador', 'generator'], ['fecha', 'date'], ['pestana', 'tab'],
    ['vista', 'view'], ['censo', 'census'], ['cuenta', 'count'], ['rol', 'role'], ['ordenar', 'sort'],
    ['proyectos', 'projects'], ['proyecto', 'project'], ['sesion', 'session'], ['locales', 'venues'], ['galeria', 'gallery'],
    ['validar', 'validate'], ['accesos', 'access'], ['ahora', 'now'], ['audiencia', 'audience'], ['globo', 'globe'],
    ['periodo', 'period'], ['sitio', 'site'], ['datos', 'data'], ['alta', 'signup'], ['catalogo', 'catalog'], ['directo', 'live']
  ];
  var COMPACTO = /^(marca|brand)(off|[a-z0-9][a-z0-9_-]*)$/;
  function parDe(n) {
    for (var i = 0; i < PARES_ES_EN.length; i++) {
      if (PARES_ES_EN[i][0] === n) return PARES_ES_EN[i][1];
      if (PARES_ES_EN[i][1] === n) return PARES_ES_EN[i][0];
    }
    return '';
  }
  function idiomaDeVerbo(n) {
    for (var i = 0; i < PARES_ES_EN.length; i++) {
      if (PARES_ES_EN[i][0] === n) return 'es';
      if (PARES_ES_EN[i][1] === n) return 'en';
    }
    return null;
  }
  function verbo(def) {
    if (!def || !def.id || typeof def.run !== 'function') return;
    var id = normal(def.id);
    verbos = verbos.filter(function (v) { return v.id !== id; });
    var aliases = (def.aliases || []).map(normal);
    [id].concat(aliases).forEach(function (n) {
      var par = parDe(n);
      if (par && par !== id && aliases.indexOf(par) < 0 && !buscarVerbo(par)) aliases.push(par);
    });
    verbos.push({id: id, aliases: aliases, uso: def.uso || '', ayuda: def.ayuda || '', ayudaEn: def.ayudaEn || '', run: def.run, piel: !!def.piel});
  }
  function ponerIdioma(l) {
    if (!l || (enIngles() ? 'en' : 'es') === l) return;
    var X = G.AdmiraExperto;
    if (X && typeof X.setLanguage === 'function') X.setLanguage(l);
    else if (typeof G.AdmiraSetLanguage === 'function') G.AdmiraSetLanguage(l);
    else root.setAttribute('lang', l);
    imprimir(l === 'en' ? 'Language: English' : 'Idioma: español');
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
    var c = v ? null : COMPACTO.exec(normal(partes[0]));
    if (c && buscarVerbo(c[1])) { partes.splice(0, 1, c[1], c[2]); limpio = '/' + partes.join(' '); v = buscarVerbo(c[1]); }
    if (!v) { imprimir(T('Verbo desconocido: /', 'Unknown verb: /') + partes[0] + T(' · escribe /help', ' · type /help'), 'err'); return; }
    // Si el verbo lo atiende la piel ⌘ Experto, ella cambia el idioma; si no, el armazón.
    var idioma = v.piel ? null : idiomaDeVerbo(normal(partes[0]));
    try {
      var r = v.run(partes.slice(1), ctx, limpio);
      if (r && typeof r.then === 'function') r.then(function () { ponerIdioma(idioma); }, function (e) { imprimir('Error: ' + (e && e.message || e), 'err'); });
      else ponerIdioma(idioma);
    } catch (e) { imprimir('Error: ' + (e && e.message || e), 'err'); }
  }

  // Verbos comunes. /help se genera del registro: un verbo nuevo aparece en la
  // ayuda sin tocarla.
  verbo({id: 'help', aliases: ['ayuda', '?'], ayuda: 'Lista los verbos de esta página', ayudaEn: 'Lists the verbs of this page', run: function () {
    verbos.slice().sort(function (a, b) { return a.id < b.id ? -1 : 1; }).forEach(function (v) {
      imprimir('/' + v.id + (v.uso ? ' ' + v.uso : '') + ' — ' + ((enIngles() && v.ayudaEn) || v.ayuda) +
        (v.aliases.length ? ' (alias: ' + v.aliases.map(function (a) { return '/' + a; }).join(' ') + ')' : ''));
    });
  }});
  verbo({id: 'limpiar', aliases: ['clear', 'cls'], ayuda: 'Vacía la salida del CLI', ayudaEn: 'Clears the CLI output', run: function () { ctx.limpiar(); }});
  if (grupo.length) {
    var clavesGrupo = grupo.map(function (a) { return ruta(a.getAttribute('href')).replace(/^\//, '').split('/').pop(); });
    verbo({id: 'ir', aliases: ['go'], uso: '<página>', ayuda: 'Abre una página del grupo: ' + clavesGrupo.join(', '), ayudaEn: 'Opens a page of the group: ' + clavesGrupo.join(', '), run: function (args) {
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
        // Nombres y alias (castellano e inglés): gana la forma que se está escribiendo.
        var cand = [];
        verbos.forEach(function (v) {
          var n = [v.id].concat(v.aliases).filter(function (x) { return x.indexOf(pre) === 0 && /^[a-z0-9]/.test(x); })[0];
          if (n) cand.push({v: v, n: n});
        });
        if (cand.length) e.preventDefault();
        if (cand.length === 1) input.value = '/' + cand[0].n + ' ';
        else if (cand.length > 1) imprimir(cand.map(function (x) { return '/' + x.n; }).join('  '));
      }
    });
    imprimir(T('CLI de ', 'CLI of ') + (doc.title || 'AdmiraNeXT') + T(' · escribe /help', ' · type /help'));
    // El saludo del armazón se marca: con la piel ⌘ Experto (que trae el suyo) se retira y no
    // quedan dos saludos, uno en cada idioma.
    if (salida.lastChild && salida.lastChild.classList) salida.lastChild.classList.add('yk-cli-hola');
  }

  if (modoAuto) {
    verbo({id: 'ir', aliases: ['go'], uso: '<página>', ayuda: 'Abre otra página de admiranext.com: ' + sitioPlano.map(function (p) { return p.clave; }).join(', '), ayudaEn: 'Opens another admiranext.com page: ' + sitioPlano.map(function (p) { return p.clave; }).join(', '), run: function (args) {
      var q = normal(args.join(' '));
      if (!q) { imprimir('Uso: /ir <página> · ' + sitioPlano.map(function (p) { return p.clave; }).join(', '), 'err'); return; }
      var d = sitioPlano.filter(function (p) { return p.clave.indexOf(q) === 0 || normal(p.nombre).indexOf(q) === 0; })[0];
      if (!d) { imprimir('No hay ninguna página «' + q + '»', 'err'); return; }
      imprimir('Abriendo ' + d.nombre + '…');
      location.href = d.href;
    }});
    verbo({id: 'seccion', aliases: ['s'], uso: '<n|texto>', ayuda: 'Salta a una sección de la página (los <h2> del contenido)', ayudaEn: 'Jumps to a section of the page (the <h2> of the content)', run: function (args) {
      construirIrA();
      var q = normal(args.join(' '));
      var s = secciones.filter(function (x, i) { return q && (String(i + 1) === q || normal(x.titulo).indexOf(q) >= 0); })[0];
      if (!s) {
        imprimir(secciones.length ? 'Uso: /seccion <n|texto> · ' + secciones.map(function (x, i) { return (i + 1) + ' ' + x.titulo; }).join(' · ') : 'Esta página no tiene secciones', 'err');
        return;
      }
      irA(s.nodo);
      imprimir('→ ' + s.titulo);
    }});
    verbo({id: 'arriba', aliases: ['top'], ayuda: 'Vuelve al principio de la página', ayudaEn: 'Back to the top of the page', run: function () { if (G.scrollTo) G.scrollTo({top: 0, behavior: 'smooth'}); }});
  }
  (Array.isArray(G.ADMIRA_FRAME_VERBS) ? G.ADMIRA_FRAME_VERBS : []).forEach(verbo);

  // Idioma: zonas del armazón (cabecera o barra, los tres paneles y sus tiradores) y
  // cambio en vivo de <html lang>. Ver «Idioma del armazón» arriba.
  // Desde el 6-oct 10:11 la zona es la página entera (armazón + contenido propio).
  zonasIdioma = [body];
  aplicarIdioma(false);
  try {
    new MutationObserver(function () { aplicarIdioma(false); }).observe(root, {attributes: true, attributeFilter: ['lang']});
  } catch (e) { /* sin observador: el idioma se aplica al cargar */ }
  G.AdmiraFrame = {
    verbo: verbo,
    ejecutar: ejecutar,
    abrir: function (lado, valor) { abrir(lado, valor !== false); },
    abierto: abierto,
    tiene: function (nombre) { return !!buscarVerbo(nombre); },
    idioma: function () { aplicarIdioma(true); return enIngles() ? 'en' : 'es'; },
    tamano: function (lado, px) { if (VAR_TAM[lado]) aplicarTam(lado, px == null ? null : Number(px), true); },
    glifos: GLIFOS
  };
  if (typeof CustomEvent === 'function' && doc.dispatchEvent) doc.dispatchEvent(new CustomEvent('admira-frame:ready'));
})();

// Shared release stamp follows the Options panel, including the first update notice.
(function () {
  try { if (window.self !== window.top) return; } catch (e) { return; }
  if (document.querySelector('script[data-admira-sello-loader]')) return;
  var script = document.createElement('script');
  script.src = '/assets/sello-novedades.js?v=20261006-options-sello-5';
  script.defer = true;
  script.setAttribute('data-admira-sello-loader', '');
  (document.head || document.documentElement).appendChild(script);
})();

// ⌘ EXPERTO de la suite también en admiranext.com (06-10-2026): la piel /suite/experto.js reviste el
// raíl «⌘ EXPERTO · CLI» y el CLI gana /marca, /idioma (/language), /estado, /version, /avatar…
// Ver assets/experto-admiranext.js (allí va el sello de caché de experto.js/.css y marca-blanca.js).
(function () {
  try { if (window.self !== window.top) return; } catch (e) { return; }
  if (document.querySelector('script[data-ax-admiranext-loader]')) return;
  var script = document.createElement('script');
  script.src = '/assets/experto-admiranext.js?v=20261006-escenas-1';
  script.defer = true;
  script.setAttribute('data-ax-admiranext-loader', '');
  (document.head || document.documentElement).appendChild(script);
})();
