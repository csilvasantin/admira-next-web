/* ⌘ EXPERTO · CLI — piel compartida de la suite AdmiraNeXT (studio, store, app, tv, biz).
 * Carlos, 4-oct-2026: el modo Experto de todas las patas con el look de digitalavatar.ai
 * (csilvasantin/digitalavatar.ai assets/da-shell.js: ficha verde del motor a la izquierda,
 * registro «CLI de … · ADmiraNeXT · escribe /help» a la derecha y orden «›» con borde cian).
 *
 * No sustituye el CLI de cada pata: reviste el panel que ya existe. Los verbos (/help, /marca,
 * /demo…), el historial y el autocompletado siguen siendo los de la pata.
 *
 *   <link rel="stylesheet" href="https://admiranext.com/suite/experto.css?v=…">
 *   <script defer src="https://admiranext.com/suite/experto.js?v=…"
 *     data-engine="ADMIRA BIZ ENGINE" data-pata="admira.biz" data-cli="admira.biz"></script>
 *
 * Selectores (data-*, con los valores por defecto del panel galaxy-shell / responsive-shell):
 *   data-panel="#expert-panel"  data-header=".expert-bar"  data-title=".expert-bar strong"
 *   data-body=".expert-blocks"  data-form="#expert-command-form"  data-input="#expert-command"
 *   data-log="#expert-command-result"  data-hint=".expert-hint"
 *   data-extras='[data-module="verbos"],[data-module="rutinas"]'   (tras «＋ verbos»)
 *   data-chrome=".expert-module-head,.expert-module-resizer,.expert-layout-menu"  (se ocultan)
 *   data-version-url="/version.json"
 * data-move-log: lleva el registro de la pata a la columna del CLI. data-toggle="": sin botones ⌘ genéricos.
 * Modo propio (patas sin CLI): data-mount="#af-panel-bottom" data-mount-body=".af-bd" [data-extras-label="vista"].
 * CERRADO POR DEFECTO (Carlos, 6-oct-2026): quien entra por primera vez (sin almacenamiento ni
 * parámetros) nunca ve el modo Experto; solo aparece al abrirlo a propósito (botón ⌘ de la pata,
 * data-toggle con los de la suite por defecto, su atajo o AdmiraExperto.open()).
 *   data-min="hide" (por defecto): cerrado = oculto del todo, sin la línea.
 *   data-min="line": cerrado = asa de una línea «› /help» anclada abajo (admiranext.com, admira.live);
 *     el asa y el ▾ despliegan/pliegan y una orden lanzada en la línea lo despliega. La página reserva
 *     abajo ese alto (div.ax-dock-spacer al final del body, --ax-dock-pad).
 *   Modo propio sin ⌘ de la pata (data-mount + data-toggle=""): sin otra forma de abrirlo, se queda
 *     la línea aunque no lo pida (compatibilidad con admira.live antes de data-min="line").
 * Abierto se recuerda SOLO en la pestaña (sessionStorage «ax-experto-abierto»): nunca se reabre solo en
 * otra visita. La clave antigua de localStorage (4-oct, reabría el Experto en cada visita) se borra.
 * data-dock="off" desactiva el anclaje (lo gobierna la pata).
 * API: window.AdmiraExperto = {paint(), setState(texto), lines(), set(clave, valor), verb({name, args, desc:[es,en], run(args, log)}), run(texto),
 *      demos(), parseDemo(texto)  ← /demo de las cinco soluciones (studio, store, tv, app, biz),
 *      open(), close(), toggle(), isOpen()}.
 */
(function (root) {
  'use strict';
  if (root.AdmiraExperto || typeof document === 'undefined') return;
  var script = document.currentScript || {};
  var ds = script.dataset || {};
  var host = location.hostname.replace(/^www\./, '');
  var cfg = {
    panel: ds.panel || '#expert-panel',
    header: ds.header || '.expert-bar',
    title: ds.title || '.expert-bar strong',
    body: ds.body || '.expert-blocks',
    form: ds.form || '#expert-command-form',
    input: ds.input || '#expert-command',
    log: ds.log || '#expert-command-result',
    hint: ds.hint || '.expert-hint',
    extras: ds.extras == null ? '[data-module="verbos"],[data-module="rutinas"]' : ds.extras,
    chrome: ds.chrome == null ? '.expert-module-head,.expert-module-resizer,.expert-layout-menu' : ds.chrome,
    pata: ds.pata || host,
    cli: ds.cli || ds.pata || host,
    versionUrl: ds.versionUrl || '/version.json',
    // Modo propio (patas sin CLI, p. ej. admira.tv): data-mount="#af-panel-bottom" data-mount-body=".af-bd".
    // La piel monta su CLI con verbos comunes (/help, /marca, /ir, /estado…) y deja lo que la página
    // ya tenía en ese panel tras «＋ vista».
    mount: ds.mount || '',
    mountBody: ds.mountBody || '',
    extrasLabel: ds.extrasLabel || '',
    // data-move-log: el registro de la pata vive en otro panel (admira.store: «PREVIOS»); se lleva
    // a la columna del CLI, encima de la orden, como en digitalavatar.ai.
    moveLog: ds.moveLog != null,
    dock: ds.dock !== 'off',
    // Cerrado = oculto del todo (Carlos 6-oct-2026: el Experto, apagado por defecto en toda la suite).
    // data-min="line" deja la línea «› /help»; un modo propio sin ⌘ de la pata (data-mount + data-toggle="")
    // también, porque si no no habría forma de abrirlo. data-min="hide" sigue valiendo (Pixeria, biz).
    minHide: ds.min === 'hide' || (ds.min !== 'line' && !(ds.mount && ds.toggle === '')),
    // Botones ⌘ propios de cada pata: biz/clearchannel, admira.tv, admira.app/yokup, pixeria/studio, store.
    toggle: ds.toggle == null ? '#header-expert-toggle,#af-ico-bottom,.yk-ico-exp,.pf-ico[title^="Expert"],.pix-nav-icon-expert,#xsExpertToggle' : ds.toggle
  };
  var DOCK_KEY = 'ax-experto-abierto';
  // Abierto/cerrado solo en la pestaña: en una visita nueva el Experto siempre empieza cerrado.
  function dockStore() { try { return root.sessionStorage; } catch (_) { return null; } }
  // Hasta el 6-oct-2026 las patas con línea lo guardaban en localStorage y lo reabrían en cada visita.
  try { root.localStorage.removeItem(DOCK_KEY); } catch (_) {}
  // Sin data-engine, el nombre sale de la pata: admira.biz → «ADMIRA BIZ ENGINE».
  cfg.engine = ds.engine || (cfg.pata.replace(/\.pages\.dev$/, '').split('.').slice(-2).join(' ').toUpperCase() + ' ENGINE');
  var state = '', version = '', extra = {}, panel = null;
  var lang = function () { return (document.documentElement.lang || 'es').slice(0, 2) === 'en' ? 'en' : 'es'; };
  var T = function (es, en) { return lang() === 'en' ? en : es; };

  // ─── Idioma / language (Carlos, 5-oct-2026) ───
  // /idioma y /language (y typo /languague) alternan o fijan ESP↔ENG.
  // Acepta barra o no, args separados o pegados (idiomaESP, /languageENG…).
  var LANG_VERBS = /^(idioma|language|languague)$/i;
  function normalizeLangToken(s) {
    var n = String(s == null ? '' : s).toLowerCase()
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z]/g, '');
    if (!n) return '';
    if (/^(en|eng|english|ingles)$/.test(n)) return 'en';
    if (/^(es|esp|spa|spanish|espanol|castellano)$/.test(n)) return 'es';
    return null;
  }
  // null = no es comando de idioma; {ok:false,usage} = verbo sí, arg inválido; {ok:true,lang} = aplicar.
  function parseLangCommand(text) {
    var raw = String(text == null ? '' : text).trim();
    if (!raw) return null;
    var body = raw.replace(/^\//, '').trim();
    var m = body.match(/^(idioma|language|languague)(?:[\s_-]*(.*))?$/i);
    if (!m) return null;
    var token = normalizeLangToken(m[2] || '');
    if (token === null) {
      return {ok: false, usage: true, verb: m[1].toLowerCase()};
    }
    var next = token || (lang() === 'en' ? 'es' : 'en');
    return {ok: true, lang: next, verb: m[1].toLowerCase(), toggled: !token};
  }
  function langMessage(l) {
    return l === 'en' ? 'Language: English' : 'Idioma: español';
  }
  function langUsage() {
    return T(
      'Usa /idioma o /language (toggle), /idioma ESP|ENG (o es|en). También languageENG, idiomaESP…',
      'Use /idioma or /language (toggle), /idioma ESP|ENG (or es|en). Also languageENG, idiomaESP…'
    );
  }
  // Aplica el idioma a la ficha, a la pata (si expone API) y avisa a quien escuche.
  function applyLang(next) {
    var l = next === 'en' ? 'en' : 'es';
    document.documentElement.lang = l;
    try {
      if (typeof root.setLanguage === 'function') root.setLanguage(l);
      else if (typeof root.setLang === 'function') root.setLang(l);
      else if (typeof root.applyHtmlLang === 'function') root.applyHtmlLang(l);
    } catch (_) {}
    try { root.localStorage.setItem('xtanco_lang', l); } catch (_) {}
    try { root.localStorage.setItem('omnip-lang', l); } catch (_) {}
    // Preferencia explícita del Experto, compartida con pixeria / admira.studio (assets/site-nav.js la
    // lee antes de su auto-redirect a /en/; sin ella, /language ESP en pixeria rebotaba al inglés).
    try { root.localStorage.setItem('admiranext_expert_lang', l); } catch (_) {}
    // La pata sabe mejor que el hreflang adónde ir (origen actual, ?lang=es, query conservado).
    var paginaSabe = false;
    try {
      var I = root.PixeriaIdioma;
      if (I && typeof I.url === 'function') {
        paginaSabe = true;
        var dest = I.url(l);
        if (dest) { location.assign(dest); return l; }
      }
    } catch (_) {}
    try {
      var link = paginaSabe ? null : document.querySelector('link[rel="alternate"][hreflang="' + l + '"]');
      if (link && link.href) {
        var target = new URL(link.href, location.href);
        if (target.origin === location.origin) {
          var cur = (location.pathname.replace(/\/$/, '') || '/');
          var want = (target.pathname.replace(/\/$/, '') || '/');
          if (cur !== want) {
            location.assign(target.pathname + target.search + target.hash);
            return l;
          }
        }
      }
    } catch (_) {}
    try { document.dispatchEvent(new CustomEvent('admiranext:lang', {detail: {lang: l}})); } catch (_) {}
    try { root.dispatchEvent(new CustomEvent('admiranext:lang', {detail: {lang: l}})); } catch (_) {}
    paint();
    return l;
  }
  function handleLangCommand(text, log) {
    var parsed = parseLangCommand(text);
    if (!parsed) return false;
    if (!parsed.ok) {
      if (log) out(log, langUsage(), 'err');
      return true;
    }
    applyLang(parsed.lang);
    if (log) out(log, langMessage(parsed.lang));
    return true;
  }
  if (typeof root.AdmiraSetLanguage !== 'function') {
    root.AdmiraSetLanguage = function (l) { return applyLang(l); };
  } else {
    var _prevSetLang = root.AdmiraSetLanguage;
    root.AdmiraSetLanguage = function (l) {
      try { _prevSetLang(l); } catch (_) {}
      return applyLang(l);
    };
  }


  function cliente() {
    try {
      var M = root.AdmiraMarca, a = M && typeof M.actual === 'function' && M.actual();
      if (a) return a.nombre || a.name || a.id || a.slug;
    } catch (_) {}
    if (marcaSel) return marcaSel.nombre || marcaSel.id;
    try {
      var q = new URL(location.href).searchParams.get('marca');
      if (q) return q;
      var m = location.pathname.match(/\/marca\/([^\/?#]+)/);
      if (m) return decodeURIComponent(m[1]);
    } catch (_) {}
    return T('de serie (Admira)', 'default (Admira)');
  }
  function readVersion() {
    // Opt-in por sitio (admiranext.com, 06-10-2026): con <html data-version-oculta="1"> la versión
    // solo se enseña a usuarios con sesión; el anónimo recibe una respuesta neutra. Sin el atributo
    // (el resto de la suite) nada cambia.
    if (document.documentElement.dataset.versionOculta === '1') return T('solo con sesión', 'signed-in users only');
    var v = document.documentElement.dataset.version;
    var meta = document.querySelector('meta[name="admiranext-version"]');
    if (!v && meta && !/__/.test(meta.content)) v = meta.content;
    return v || version || '—';
  }
  function lines() {
    var out = [
      cfg.engine,
      'version: ' + readVersion(),
      T('pata: ', 'leg: ') + cfg.pata,
      T('cliente: ', 'client: ') + cliente(),
      T('cerebro: ', 'brain: ') + 'admiranext.com',
      'host: ' + location.host,
      T('idioma: ', 'language: ') + lang()
    ];
    Object.keys(extra).forEach(function (k) { out.push(k + ': ' + extra[k]); });
    out.push(T('estado: ', 'status: ') + (state || T('listo', 'ready')));
    return out;
  }
  function paint() {
    var pre = panel && panel.querySelector('.ax-engine');
    if (pre) pre.textContent = lines().join('\n');
    var hi = panel && panel.querySelector('.ax-hello');
    if (hi) hi.textContent = helloText();
    // El título sigue al idioma en vivo (antes solo se fijaba al montar la piel).
    var ti = panel && panel.querySelector('.ax-title');
    if (ti) ti.textContent = '⌘ ' + T('EXPERTO', 'EXPERT') + ' · CLI';
    var xb = panel && panel.querySelector('.ax-extras-btn');
    if (xb) xb.textContent = (panel.classList.contains('ax-extras-on') ? '－ ' : '＋ ') + extrasLabel();
  }
  function extrasLabel() { return cfg.extrasLabel || (cfg.mount ? T('vista', 'view') : T('verbos', 'verbs')); }
  function helloText() { return T('CLI de ', 'CLI of ') + cfg.cli + ' · ADmiraNeXT · ' + T('escribe /help', 'type /help'); }
  function hello(log) {
    if (!log || log.querySelector('.ax-hello')) return;
    var tag = /^(OL|UL)$/.test(log.tagName) ? 'li' : 'div';
    var row = document.createElement(tag);
    row.className = 'ax-hello';
    row.textContent = helloText();
    log.insertBefore(row, log.firstChild);
  }
  function tagAll(sel, cls, scope) {
    if (!sel) return;
    try { (scope || panel).querySelectorAll(sel).forEach(function (n) { n.classList.add(cls); }); } catch (_) {}
  }

  // ─── Modo propio: CLI de la suite para patas que no traen el suyo ───
  var verbs = [];
  var MARCAS = 'https://www.admiranext.com/marcablanca/api/marcas';
  var marcaSel = null;
  try { marcaSel = JSON.parse(sessionStorage.getItem('ax-experto-marca') || 'null'); } catch (_) {}
  function verb(v) { verbs = verbs.filter(function (x) { return x.name !== v.name; }); verbs.push(v); }
  // ─── Verbos bilingües (Carlos, 06-10-2026 10:58) ───
  // Cada verbo vale en castellano y en inglés (/marca = /brand, /ayuda = /help, /limpiar = /clear…).
  // Usar la forma castellana pone la web en castellano y la inglesa en inglés, con el mismo applyLang
  // de /idioma. Lo que se escribe igual en los dos idiomas (/version, /avatar, /cli…) y los atajos
  // /81…/89 no tocan el idioma. Forma compacta: /marca84 = /marca 84, /brandoff = /brand off.
  // /idioma y /language siguen con su contrato propio (sin argumento alternan; con ESP|ENG fijan).
  var PARES_ES_EN = [['ayuda', 'help'], ['marca', 'brand'], ['ir', 'go'], ['estado', 'status'], ['limpiar', 'clear']];
  var COMPACTO = /^(marca|brand)(off|[a-z0-9][a-z0-9_-]*)$/;
  function idiomaDeVerbo(name) {
    for (var i = 0; i < PARES_ES_EN.length; i++) {
      if (PARES_ES_EN[i][0] === name) return 'es';
      if (PARES_ES_EN[i][1] === name) return 'en';
    }
    return null;
  }
  function parDe(name) {
    for (var i = 0; i < PARES_ES_EN.length; i++) {
      if (PARES_ES_EN[i][0] === name) return PARES_ES_EN[i][1];
      if (PARES_ES_EN[i][1] === name) return PARES_ES_EN[i][0];
    }
    return '';
  }
  function findVerb(name) { return verbs.filter(function (x) { return x.name === name || (x.alias || []).indexOf(name) >= 0; })[0]; }
  // «/marca84» → {name: 'marca', parts: ['84']}; null si no es forma compacta de un verbo conocido.
  function compacto(name) {
    var m = COMPACTO.exec(name);
    return m && findVerb(m[1]) ? {name: m[1], arg: m[2]} : null;
  }
  function out(log, text, cls) {
    String(text).split('\n').forEach(function (line) {
      var li = document.createElement('li');
      li.className = cls || '';
      li.textContent = line;
      log.appendChild(li);
    });
    while (log.children.length > 200) log.removeChild(log.firstChild);
    log.scrollTop = log.scrollHeight;
  }
  function navItems() {
    var N = root.AdmiraNav, items = [];
    try { (N && (N.items || N.ITEMS || N.nav || [])).forEach(function (it) { if (it && it.h) items.push(it); }); } catch (_) {}
    return items;
  }
  verb({name: 'help', alias: ['?', 'ayuda'], desc: ['esta lista', 'this list'], run: function (a, log) {
    out(log, verbs.map(function (v) { var par = parDe(v.name); return '/' + v.name + (par ? ' · /' + par : '') + (v.args ? ' ' + v.args : '') + ' — ' + T(v.desc[0], v.desc[1]); }).join('\n') +
      '\n' + T('Cada verbo vale en castellano o en inglés: el castellano pone la web en castellano y el inglés en inglés. /marca84 = /marca 84.',
        'Every verb works in Spanish or English: the Spanish one switches the site to Spanish, the English one to English. /brand84 = /brand 84.'));
  }});
  verb({name: 'marca', alias: ['brand', 'marcablanca'], args: '<id>|off|lista', desc: ['marca blanca del catálogo de admiranext.com (cliente de la ficha)', 'white label from the admiranext.com catalogue'], run: function (a, log) {
    var id = (a[0] || '').toLowerCase();
    var M = root.AdmiraMarca;
    if (id === 'list') id = 'lista';
    if (M && typeof M.activar === 'function' && id && id !== 'lista') {
      if (id === 'off') { M.desactivar(); out(log, T('Vuelves a la identidad de serie.', 'Back to the default identity.')); paint(); return; }
      out(log, T('Aplicando la marca ', 'Applying brand ') + id + '…');
      return Promise.resolve(M.activar(id)).then(function (r) { out(log, r && r.ok ? T('Marca ', 'Brand ') + id + T(' activa.', ' active.') : T('No se pudo aplicar ', 'Could not apply ') + id, r && r.ok ? '' : 'err'); paint(); });
    }
    if (id === 'off') { marcaSel = null; try { sessionStorage.removeItem('ax-experto-marca'); } catch (_) {} paint(); out(log, T('Marca retirada: vuelves a Admira.', 'Brand removed: back to Admira.')); return; }
    return fetch(MARCAS, {cache: 'no-store'}).then(function (r) { return r.json(); }).then(function (j) {
      var list = (j && j.clientes) || [];
      if (!id || id === 'lista') { out(log, T('Marcas: ', 'Brands: ') + list.map(function (c) { return c.id; }).join(' · ')); return; }
      var c = list.filter(function (x) { return x.id === id; })[0];
      if (!c) { out(log, T('No hay marca «', 'No brand «') + id + T('». /marca lista enseña el catálogo.', '». /marca lista shows the catalogue.'), 'err'); return; }
      marcaSel = {id: c.id, nombre: c.nombre};
      try { sessionStorage.setItem('ax-experto-marca', JSON.stringify(marcaSel)); } catch (_) {}
      paint();
      document.dispatchEvent(new CustomEvent('admira:marca', {detail: marcaSel}));
      out(log, T('Marca ', 'Brand ') + c.nombre + ' (' + c.id + T(') activa en la ficha de esta pestaña; /marca off vuelve a Admira.', ') active in this tab\'s card; /marca off returns to Admira.'));
    }).catch(function () { out(log, T('El catálogo de marcas no responde.', 'The brand catalogue is not answering.'), 'err'); });
  }});
  verb({name: 'ir', alias: ['go'], args: '<sección>', desc: ['abre una sección de esta web (sin argumento: lista)', 'open a section of this site (no argument: list)'], run: function (a, log) {
    var items = navItems(), k = (a[0] || '').toLowerCase();
    if (!k) { out(log, items.length ? items.map(function (i) { return (i.k || '?') + ' → ' + i.h; }).join('\n') : T('Esta página no publica secciones.', 'This page lists no sections.')); return; }
    var hit = items.filter(function (i) { return (i.k || '').toLowerCase() === k || (i.t || '').toLowerCase() === k; })[0];
    if (!hit) { out(log, T('Sección desconocida: ', 'Unknown section: ') + k + T(' · /ir para la lista', ' · /ir for the list'), 'err'); return; }
    out(log, T('Abriendo ', 'Opening ') + hit.h + '…'); setTimeout(function () { location.assign(hit.h); }, 250);
  }});
  verb({name: 'estado', alias: ['status'], desc: ['ficha del motor en el registro', 'engine card into the log'], run: function (a, log) { out(log, lines().join('\n')); }});
  verb({name: 'version', desc: ['sello de la release', 'release stamp'], run: function (a, log) { out(log, readVersion()); }});
  verb({name: 'idioma', alias: ['language', 'languague'], args: '[ESP|ENG|es|en]', desc: ['idioma de la ficha y del CLI (sin arg: alterna)', 'language of the card and CLI (no arg: toggle)'], run: function (a, log) {
    var joined = (a && a.length) ? a.join(' ') : '';
    var parsed = parseLangCommand('idioma' + (joined ? ' ' + joined : ''));
    if (!parsed || !parsed.ok) { out(log, langUsage(), 'err'); return; }
    applyLang(parsed.lang);
    out(log, langMessage(parsed.lang));
  }});
  verb({name: 'limpiar', alias: ['clear', 'cls'], desc: ['vacía el registro', 'clear the log'], run: function (a, log) { log.textContent = ''; hello(log); }});

  // ─── /demo · las cinco soluciones (Carlos, 7-oct-2026, demo Alsea · Starbucks España y México) ───
  // Mismo patrón que /demo tpv de admira.store: una orden encarga que se enseñe una funcionalidad.
  // /demo lista las cinco; /demo <solución|1-5> abre su demo; /demo siguiente salta a la siguiente.
  // El avatar digital (assets/avatar.js + digitalavatar.ai) usa este mismo catálogo: AdmiraExperto.demos().
  // Lo que no es una solución (/demo tpv, /demo off…) sigue siendo de la pata.
  var DEMOS = [
    {id: 'studio', alias: ['pixeria', 'contenido', 'contenidos', 'creatividad'], nombre: 'admira.studio',
      hosts: /(^|\.)(admira\.studio|pixeria\.com)$/,
      desc: ['Contenidos con IA: locución, música, imagen, vídeo y adaptación de formatos', 'AI content: voiceover, music, image, video and format adaptation'],
      url: ['https://www.admira.studio/']},
    {id: 'store', alias: ['tienda', 'xpace', 'xpaceos', 'gemelo', 'twin'], nombre: 'admira.store',
      hosts: /(^|\.)(admira\.store|xpaceos\.com)$/,
      desc: ['Gemelo digital del Starbucks de Alsea en Matrix: arranca /demo tpv, un muffin a caja que dispara música y pantallas', 'Digital twin of the Alsea Starbucks in Matrix: starts /demo tpv, a muffin to the register that triggers music and screens'],
      url: ['https://www.admira.store/admira-xp/?marca=starbucks&loc=alsea-sbux-021&project=starbucks&circuit=alsea_starbucks&lang=es&demo=tpv#tpv',
        'https://www.admira.store/admira-xp/?marca=starbucks&loc=alsea-sbux-021&project=starbucks&circuit=alsea_starbucks&lang=en&demo=tpv#tpv']},
    {id: 'tv', alias: ['canal', 'adcelerate', 'calle', 'videoanalytics'], nombre: 'admira.tv',
      hosts: /(^|\.)admira\.tv$/,
      desc: ['Starbucks Passeig de Gràcia 103 desde la calle: el halo de la fachada entra en Matrix', 'Starbucks Passeig de Gràcia 103 from the street: the entrance halo opens Matrix'],
      url: ['https://admira.tv/adcelerate/demo/?view=human&site=starbucks']},
    {id: 'app', alias: ['yokup', 'operaciones', 'itil', 'incidencias', 'retailer'], nombre: 'admira.app · Yokup',
      hosts: /(^|\.)(admira\.app|yokup\.com)$/,
      desc: ['Operación de la red Starbucks: equipos, incidencias ITIL y estado de cada tienda', 'Starbucks network operations: equipment, ITIL incidents and each store\'s status'],
      url: ['https://www.yokup.com/retailer?marca=starbucks']},
    {id: 'biz', alias: ['negocio', 'clearchannel', 'retailmedia', 'comercial'], nombre: 'admira.biz',
      hosts: /(^|\.)(admira\.biz|clearchannel\.tv)$/,
      desc: ['Comercialización: retail media y campañas de marca sobre las pantallas de la red', 'Monetisation: retail media and brand campaigns across the network screens'],
      url: ['https://www.admira.biz/']}
  ];
  function demoUrl(d) { return d.url[lang() === 'en' && d.url[1] ? 1 : 0]; }
  function demoActual() { for (var i = 0; i < DEMOS.length; i++) if (DEMOS[i].hosts.test(host)) return i; return -1; }
  function norm(t) { return String(t == null ? '' : t).trim().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, ''); }

  // ─── Subdemos locales de la plataforma (encargos de Trinity del 7-oct-2026: activar /demo en admira.studio) ───
  // En los hosts de una plataforma con manifiesto, /demo 1…5 y sus alias son LOCALES de esa plataforma
  // (admira.studio y pixeria.com = studio: 1 voz/locución, 2 música, 3 imagen, 4 vídeo, 5 adaptar), y
  // /demo help lista solo esas. Los nombres de las cinco soluciones (/demo store…) siguen valiendo.
  // Manifiesto {version, plataforma, activacion:{hosts}, default_mode, subdemos:[{id, letra, nombre, desc, url,
  // aliases, muestra:{tipo, url, poster, variantes:[{formato, url}]}, guion, steps}]} (pixeria demo/studio.subdemos.json);
  // contrato de resolución = pixeria demo/studio-comandos.mjs. Sin manifiesto publicado, este catálogo fijo.
  var LOCALES = {
    studio: {manifiestos: ['/demo/studio.subdemos.json', 'https://www.admira.studio/demo/studio.subdemos.json', 'https://www.admiranext.com/subdemos/studio.subdemos.json'],
      m: {"version":1,"plataforma":"studio","nombre":"Admira Studio / Pixeria","default_mode":"muestra","activacion":{"hosts":["admira.studio","www.admira.studio","pixeria.com","www.pixeria.com"]},"subdemos":[{"id":"voz","letra":"a","nombre":"Crear locución","desc":"De un guion breve a una voz lista para escuchar.","url":"https://www.admira.studio/audio.html","mirror_url":"https://www.pixeria.com/audio.html","cmd":"/demo 1","aliases":["locucion","voz"],"muestra":{"tipo":"audio","url":"https://www.admira.studio/assets/demos/studio-v1/locucion-es.mp3","descripcion":"Resultado preparado; este ensayo no realiza generación ni publicación.","variantes":[]}},{"id":"musica","letra":"b","nombre":"Crear música","desc":"Del ambiente de una marca a su hilo musical.","url":"https://www.admira.studio/musica.html","mirror_url":"https://www.pixeria.com/musica.html","cmd":"/demo 2","aliases":["musica"],"muestra":{"tipo":"audio","url":"https://www.admira.studio/assets/demos/studio-v1/musica-cafe.mp3","descripcion":"Resultado preparado; este ensayo no realiza generación ni publicación.","variantes":[]}},{"id":"imagen","letra":"c","nombre":"Crear imagen","desc":"Del briefing a una creatividad visual.","url":"https://www.admira.studio/imagenes.html","mirror_url":"https://www.pixeria.com/imagenes.html","cmd":"/demo 3","aliases":["imagen"],"muestra":{"tipo":"image","url":"https://www.admira.studio/assets/demos/studio-v1/imagen-cafe.jpg","descripcion":"Resultado preparado; este ensayo no realiza generación ni publicación.","variantes":[]}},{"id":"video","letra":"d","nombre":"Crear vídeo","desc":"De una imagen al movimiento de un clip.","url":"https://www.admira.studio/video.html","mirror_url":"https://www.pixeria.com/video.html","cmd":"/demo 4","aliases":["video"],"muestra":{"tipo":"video","url":"https://www.admira.studio/assets/demos/studio-v1/video-fuente.mp4","poster":"https://www.admira.studio/assets/demos/studio-v1/video-fuente.jpg","descripcion":"Resultado preparado; este ensayo no realiza generación ni publicación.","variantes":[]}},{"id":"adaptar","letra":"e","nombre":"Adaptar formatos","desc":"Una misma pieza en horizontal, vertical, cuadrado y barra.","url":"https://www.admira.studio/adaptaciones/","mirror_url":"https://www.pixeria.com/adaptaciones/","cmd":"/demo 5","aliases":["adaptar","formatos","adaptacion"],"muestra":{"tipo":"video","url":"https://www.admira.studio/assets/demos/studio-v1/adaptado-horizontal.mp4","poster":"https://www.admira.studio/assets/demos/studio-v1/adaptado-horizontal.jpg","descripcion":"Resultado preparado; este ensayo no realiza generación ni publicación.","variantes":[{"nombre":"horizontal","formato":"1920x1080","url":"https://www.admira.studio/assets/demos/studio-v1/adaptado-horizontal.mp4","poster":"https://www.admira.studio/assets/demos/studio-v1/adaptado-horizontal.jpg"},{"nombre":"vertical","formato":"1080x1920","url":"https://www.admira.studio/assets/demos/studio-v1/adaptado-vertical.mp4","poster":"https://www.admira.studio/assets/demos/studio-v1/adaptado-vertical.jpg"},{"nombre":"cuadrado","formato":"1080x1080","url":"https://www.admira.studio/assets/demos/studio-v1/adaptado-cuadrado.mp4","poster":"https://www.admira.studio/assets/demos/studio-v1/adaptado-cuadrado.jpg"},{"nombre":"barra","formato":"1920x540","url":"https://www.admira.studio/assets/demos/studio-v1/adaptado-barra.mp4","poster":"https://www.admira.studio/assets/demos/studio-v1/adaptado-barra.jpg"}]}}]}}
  };
  // Copia literal de resolverDemo (pixeria demo/studio-comandos.mjs, Trinity): test/experto-demo.test.mjs
  // pasa su batería de verificar-studio-comandos.mjs contra esta copia para que no diverjan.
  function normalizar(value) { return String(value == null ? '' : value).trim().normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase(); }
  function resolverDemo(texto, manifest, hostname) {
    var command = normalizar(texto);
    if (!/^\/demo(?:\s|$)/.test(command)) return {tipo: 'no_demo'};
    if (manifest.activacion.hosts.indexOf(String(hostname).toLowerCase()) < 0) return {tipo: 'otra_plataforma'};
    var arg = command.slice(5).trim();
    var opciones = manifest.subdemos.map(function (demo, index) {
      return {numero: index + 1, id: demo.id, nombre: demo.nombre, comando: demo.cmd, alias: '/demo ' + demo.aliases[0]};
    });
    if (!arg || arg === 'help') return {tipo: 'ayuda', plataforma: manifest.plataforma, opciones: opciones};
    var demo = null;
    manifest.subdemos.forEach(function (item, index) {
      if (!demo && (arg === String(index + 1) || item.aliases.some(function (alias) { return normalizar(alias) === arg; }))) demo = item;
    });
    if (!demo) return {tipo: 'desconocido', mensaje: 'Demo desconocida. Escribe /demo help.', opciones: opciones};
    return {tipo: 'demo', plataforma: manifest.plataforma, clave: manifest.plataforma + '/' + demo.id, modo: manifest.default_mode, demo: demo};
  }
  var plataforma = null;
  Object.keys(LOCALES).forEach(function (k) { if (LOCALES[k].m.activacion.hosts.indexOf(String(location.hostname).toLowerCase()) >= 0) plataforma = k; });
  function localM() { return plataforma ? LOCALES[plataforma].m : null; }
  function valido(j) { return j && j.plataforma === plataforma && j.activacion && j.activacion.hosts && j.subdemos && j.subdemos.length && j.subdemos.every(function (d) { return d.id && d.aliases && d.aliases.length; }); }
  function cargarLocal() {
    if (!plataforma || typeof fetch !== 'function') return Promise.resolve(null);
    var urls = LOCALES[plataforma].manifiestos.slice();
    var next = function () {
      var u = urls.shift();
      if (!u) return null;
      return fetch(u, {cache: 'no-store'}).then(function (r) { return r.ok ? r.json() : null; }).catch(function () { return null; })
        .then(function (j) { if (valido(j)) { LOCALES[plataforma].m = j; return j; } return next(); });
    };
    return next();
  }
  var localListo = cargarLocal();
  // pixeria.com es espejo de admira.studio: sus subdemos abren en el mismo host.
  function subUrl(d) { return /(^|\.)pixeria\.com$/.test(host) && d.mirror_url ? d.mirror_url : d.url; }

  // null = no es de la suite (lo resuelve la pata); {lista} | {local:true, lista} | {local:true, sub, n} | {local:true, desconocida} | {demo, i}.
  // En una plataforma con manifiesto manda resolverDemo (números y alias locales); los nombres de las cinco
  // soluciones (/demo store, /demo biz…) siguen abriendo las otras plataformas.
  function parseDemo(text) {
    var m = /^\/?demo(?:\s+(.*))?$/i.exec(String(text == null ? '' : text).trim());
    if (!m) return null;
    var arg = norm(m[1]).replace(/^admira\./, ''), L = localM();
    if (L) {
      var r = resolverDemo('/demo ' + (/^(ayuda|\?|lista|list)$/.test(arg) ? 'help' : arg), L, location.hostname);
      if (r.tipo === 'ayuda') return {local: true, lista: true};
      if (r.tipo === 'demo') return {local: true, sub: r.demo, n: L.subdemos.indexOf(r.demo) + 1, clave: r.clave, modo: r.modo};
    }
    if (!arg || /^(lista|list|soluciones|solutions)$/.test(arg)) return {lista: true};
    var i = -1;
    if (/^(siguiente|next|sig)$/.test(arg)) i = (demoActual() + 1) % DEMOS.length;
    else if (!L && /^[1-5]$/.test(arg)) i = +arg - 1;
    else DEMOS.forEach(function (d, k) { if (i < 0 && (d.id === arg || d.alias.indexOf(arg) >= 0)) i = k; });
    if (i < 0 && L) return {local: true, desconocida: arg};
    return i < 0 ? null : {demo: DEMOS[i], i: i};
  }
  function demoLista() {
    return T('Demos · las cinco soluciones:', 'Demos · the five solutions:') + '\n' +
      DEMOS.map(function (d, k) { return (k + 1) + ' /demo ' + d.id + ' · ' + d.nombre + ' — ' + T(d.desc[0], d.desc[1]); }).join('\n') +
      '\n' + T('/demo 1…5 o /demo siguiente. También desde el avatar digital: «/demo store».', '/demo 1…5 or /demo next. Also from the digital avatar: "/demo store".');
  }
  function localLista() {
    var L = localM();
    return T('Demos de ', 'Demos of ') + (L.nombre || plataforma) + ':\n' +
      L.subdemos.map(function (d, k) { return '/demo ' + (k + 1) + ' · /demo ' + d.aliases[0] + ' — ' + d.nombre + (d.desc ? ': ' + d.desc : ''); }).join('\n') +
      '\n' + T('Modo muestra: se enseña el resultado preparado, sin generar ni publicar. /demo store, /demo biz… abren las otras plataformas.',
        'Sample mode: shows the prepared result, without generating or publishing. /demo store, /demo biz… open the other platforms.');
  }
  // Modo muestra (default_mode): panel con el resultado preparado y enlace a la página de la función.
  function abs(u) { try { return new URL(u, location.href).href; } catch (_) { return u; } }
  function mediaEl(tipo, url, poster) {
    var el = document.createElement(tipo === 'audio' ? 'audio' : tipo === 'image' ? 'img' : 'video');
    el.src = abs(url);
    if (el.tagName === 'IMG') el.alt = '';
    else { el.controls = true; el.preload = 'metadata'; if (poster) el.poster = abs(poster); }
    return el;
  }
  function cerrarMuestra() { var o = document.getElementById('ax-demo-muestra'); if (o) o.parentNode.removeChild(o); }
  function mostrarMuestra(d, n) {
    cerrarMuestra();
    var o = document.createElement('div');
    o.id = 'ax-demo-muestra';
    o.setAttribute('role', 'dialog');
    o.setAttribute('aria-label', d.nombre);
    o.style.cssText = 'position:fixed;inset:0;z-index:2147483000;background:rgba(5,4,12,.82);display:flex;align-items:center;justify-content:center;padding:16px';
    var c = document.createElement('div');
    c.style.cssText = 'background:#14111f;color:#eee;border:1px solid #3b3358;max-width:960px;width:100%;max-height:92vh;overflow:auto;padding:18px 20px;font:14px/1.5 system-ui,sans-serif';
    var h = document.createElement('h2'); h.style.cssText = 'margin:0 0 4px;font-size:20px'; h.textContent = (d.letra ? d.letra + '. ' : n + '. ') + d.nombre;
    var p = document.createElement('p'); p.style.cssText = 'margin:0 0 12px;color:#b9b0cf'; p.textContent = d.desc || '';
    c.appendChild(h); c.appendChild(p);
    var mu = d.muestra;
    if (mu && mu.url) {
      var vs = (mu.variantes || []).filter(function (v) { return v && v.url; });
      if (vs.length) {
        var g = document.createElement('div'); g.style.cssText = 'display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:10px';
        vs.forEach(function (v) {
          var f = document.createElement('figure'); f.style.margin = '0';
          var el = mediaEl(mu.tipo, v.url, v.poster); el.style.cssText = 'width:100%;max-height:260px;object-fit:contain;background:#000';
          var cap = document.createElement('figcaption'); cap.style.cssText = 'font-size:12px;color:#b9b0cf'; cap.textContent = (v.nombre || '') + (v.formato ? ' · ' + v.formato : '');
          f.appendChild(el); f.appendChild(cap); g.appendChild(f);
        });
        c.appendChild(g);
      } else {
        var el = mediaEl(mu.tipo, mu.url, mu.poster); el.style.cssText = 'width:100%;max-height:60vh;object-fit:contain;background:#000;display:block';
        c.appendChild(el);
      }
      if (mu.descripcion) { var q = document.createElement('p'); q.style.cssText = 'font-size:12px;color:#8f86a8;margin:8px 0 0'; q.textContent = mu.descripcion; c.appendChild(q); }
    }
    var bar = document.createElement('p'); bar.style.cssText = 'display:flex;gap:10px;flex-wrap:wrap;margin:14px 0 0';
    var a = document.createElement('a'); a.href = abs(subUrl(d)); a.textContent = T('Abrir la función →', 'Open the feature →'); a.style.cssText = 'color:#ff8dbf';
    var x = document.createElement('button'); x.type = 'button'; x.textContent = T('Cerrar', 'Close'); x.onclick = cerrarMuestra;
    bar.appendChild(a); bar.appendChild(x); c.appendChild(bar);
    o.appendChild(c);
    o.addEventListener('click', function (e) { if (e.target === o) cerrarMuestra(); });
    document.addEventListener('keydown', function esc(e) { if (e.key === 'Escape') { cerrarMuestra(); document.removeEventListener('keydown', esc); } });
    document.body.appendChild(o);
    var first = c.querySelector('audio,video');
    if (first) { try { var pr = first.play(); if (pr && pr.catch) pr.catch(function () {}); } catch (_) {} }
  }
  // Devuelve {id, nombre, desc} de lo que se enseña (lo usa el avatar para presentarlo) o null.
  function demoRun(p, log) {
    if (p.lista) { out(log, p.local ? localLista() : demoLista()); return null; }
    if (p.desconocida != null) { out(log, T('Demo desconocida: ', 'Unknown demo: ') + p.desconocida + T('. Escribe /demo help.', '. Type /demo help.') + '\n' + localLista(), 'err'); return null; }
    if (p.local) {
      var d = p.sub, modo = p.modo || 'muestra';
      out(log, 'Demo ' + p.n + ' · ' + d.nombre + (d.desc ? ' — ' + d.desc : ''));
      try { document.dispatchEvent(new CustomEvent('admira:demo', {detail: {id: p.clave, url: abs(subUrl(d)), modo: modo}})); } catch (_) {}
      if (modo === 'muestra' && d.muestra && d.muestra.url) { out(log, T('Modo muestra: resultado preparado, sin generar ni publicar.', 'Sample mode: prepared result, nothing generated or published.')); mostrarMuestra(d, p.n); }
      else { out(log, T('Abriendo ', 'Opening ') + abs(subUrl(d)) + '…'); setTimeout(function () { location.assign(abs(subUrl(d))); }, 600); }
      return {id: p.clave, nombre: d.nombre, desc: d.desc || ''};
    }
    var g = p.demo, url = demoUrl(g);
    out(log, T('Demo ', 'Demo ') + (p.i + 1) + '/5 · ' + g.nombre + ' — ' + T(g.desc[0], g.desc[1]));
    out(log, T('Abriendo ', 'Opening ') + url + '…');
    try { document.dispatchEvent(new CustomEvent('admira:demo', {detail: {id: g.id, url: url}})); } catch (_) {}
    setTimeout(function () { location.assign(url); }, 600);
    return {id: g.id, nombre: g.nombre, desc: T(g.desc[0], g.desc[1])};
  }
  // Punto de entrada común para Experto y avatar: texto «/demo …» → lo ejecuta y devuelve qué enseña.
  function demoTexto(text, log) {
    var p = parseDemo(text);
    if (!p) return null;
    log = log || (panel && panel.querySelector('.ax-cli-out')) || {appendChild: function () {}, children: [], removeChild: function () {}};
    return demoRun(p, log);
  }
  verb({name: 'demo', args: '[help|1-5|nombre|studio|store|tv|app|biz|siguiente]', desc: ['enseña una demo (en esta plataforma, sus subdemos; sin argumento: lista)', 'show a demo (on this platform, its subdemos; no argument: list)'], run: function (a, log) {
    var p = parseDemo('/demo ' + a.join(' '));
    if (!p) { out(log, T('Demo desconocida: ', 'Unknown demo: ') + a.join(' ') + '\n' + demoLista(), 'err'); return; }
    demoRun(p, log);
  }});

  // Avatar conversacional. Un solo cargador (admiranext.com/assets/avatar.js): good = Admirito (nube animada),
  // better = chica Ready Player Me, best = Neo. En modo piel el CLI de la pata ya lo tiene;
  // aquí entra el modo propio (data-mount), que es el dock de las patas sin consola.
  var AVATAR_SRC = 'https://www.admiranext.com/assets/avatar.js?v=20261007-demo-1';
  function avatarApi() {
    if (root.AdmiraAvatar && root.AdmiraAvatar.handle) return Promise.resolve(root.AdmiraAvatar);
    var tag = document.querySelector('script[data-admira-avatar]');
    if (!tag) {
      tag = document.createElement('script');
      tag.src = AVATAR_SRC;
      tag.async = true;
      tag.setAttribute('data-admira-avatar', '');
      (document.head || document.documentElement).appendChild(tag);
    }
    return new Promise(function (resolve) {
      var done = function () { resolve(root.AdmiraAvatar || null); };
      if (root.AdmiraAvatar) return done();
      tag.addEventListener('load', done, {once: true});
      tag.addEventListener('error', done, {once: true});
      setTimeout(done, 4000);
    });
  }
  function avatarRun(text, log) {
    return avatarApi().then(function (A) {
      if (!A) { out(log, T('Avatar digital no disponible', 'Digital avatar unavailable'), 'err'); return; }
      return Promise.resolve(A.handle(text)).then(function (msg) { if (msg) out(log, String(msg)); });
    });
  }
  verb({name: 'avatar', args: '[avatar|human|metahuman]', desc: [
    'avatar abre a Admirito, la nube animada (mueve los labios y hace cosas sola) · human abre a Luna, la anfitriona web (Ready Player Me) · metahuman abre a Neo (MetaHuman; si el host de render está apagado, cae a Luna). good/better/best siguen como alias. Sin nivel, el estado. /avatarON lo muestra y /avatarOFF lo oculta. /avatar reset vuelve al interruptor del proyecto',
    'avatar opens Admirito, the animated cloud · human opens Luna, the web host (Ready Player Me) · metahuman opens Neo (MetaHuman; if the render host is off, Luna takes over). good/better/best kept as aliases. Alone, the status. /avatarON shows it and /avatarOFF hides it. /avatar reset follows the project switch'
  ], run: function (a, log) { return avatarRun('/avatar' + (a.length ? ' ' + a.join(' ') : ''), log); }});
  verb({name: 'avataron', desc: ['muestra el avatar digital y lo recuerda', 'show the digital avatar and remember it'], run: function (a, log) { return avatarRun('/avatarON', log); }});
  verb({name: 'avataroff', desc: ['oculta el avatar digital y lo recuerda', 'hide the digital avatar and remember it'], run: function (a, log) { return avatarRun('/avatarOFF', log); }});
  verb({name: 'avatardigital', alias: ['digitalavatar'], desc: ['sin nada, muestra u oculta a Admirito (la nube); con on/off lo fija', 'alone, shows or hides Admirito (the cloud); on/off sets it'], run: function (a, log) {
    return avatarRun('/avatarDigital' + (a.length ? ' ' + a.join(' ') : ''), log);
  }});
  verb({name: 'admirito', desc: ['muestra u oculta a Admirito, la mascota nube', 'show or hide Admirito, the cloud mascot'], run: function (a, log) {
    return avatarRun('/admirito' + (a.length ? ' ' + a.join(' ') : ''), log);
  }});
  verb({name: 'cli', args: 'ayudante|helper', desc: ['interruptor del avatar en esta consola', 'avatar switch on this console'], run: function (a, log) {
    if (/^(ayudante|helper)$/i.test(a[0] || '')) return avatarRun('/cli ' + a.join(' '), log);
    out(log, T('En esta consola, /cli ayudante es el avatar. /avatar good, /avatar better o /avatar best elige la cara.', 'On this console, /cli helper is the avatar. /avatar good, /avatar better or /avatar best picks the face.'), 'err');
  }});

  // opts.echo === false: quien llama ya pintó la orden (p. ej. el CLI del armazón de admiranext.com).
  function execute(text, log, opts) {
    var t = String(text || '').trim();
    if (!t) return;
    if (!opts || opts.echo !== false) out(log, '› ' + t, 'cmd');
    if (handleLangCommand(t, log)) return;
    var parts = t.replace(/^\//, '').split(/\s+/), name = (parts.shift() || '').toLowerCase();
    var v = findVerb(name), c = v ? null : compacto(name);
    if (c) { name = c.name; parts.unshift(c.arg); v = findVerb(name); }
    if (!v) { out(log, T('Verbo desconocido: /', 'Unknown verb: /') + name + T(' · escribe /help', ' · type /help'), 'err'); return; }
    // El idioma del verbo pasa a ser el de la web, cuando la orden ya ha hecho lo suyo.
    var idioma = idiomaDeVerbo(name);
    var cambiaIdioma = function () {
      if (!idioma || idioma === lang()) return;
      applyLang(idioma);
      out(log, langMessage(idioma));
    };
    try {
      var r = v.run(parts, log);
      if (r && typeof r.then === 'function') return r.then(function (x) { cambiaIdioma(); return x; }, function (e) { cambiaIdioma(); throw e; });
      cambiaIdioma();
      return r;
    } catch (e) { out(log, String(e && e.message || e), 'err'); }
  }

  function build() {
    var host = document.querySelector(cfg.mount);
    if (!host) return false;
    var bd = (cfg.mountBody && host.querySelector(cfg.mountBody)) || host;
    var previous = Array.prototype.slice.call(bd.childNodes);
    var hd = document.createElement('div');
    hd.className = 'ax-own-hd';
    hd.innerHTML = '<strong class="ax-own-title"></strong>';
    var body = document.createElement('div');
    body.className = 'ax-own-body';
    body.innerHTML = '<div class="ax-own-cli"><ol class="ax-own-out" role="log" aria-live="polite" tabindex="0"></ol>' +
      '<form class="ax-own-form" autocomplete="off"><input class="ax-own-input" id="axCliInput" type="text" spellcheck="false" autocapitalize="off" aria-label="' + T('Orden para el CLI', 'CLI command') + '"></form></div>';
    var keep = previous.filter(function (n) { return !(n.nodeType === 1 && n.classList.contains('af-empty')) && !(n.nodeType === 3 && !n.textContent.trim()); });
    previous.forEach(function (n) { if (n.parentNode === bd) bd.removeChild(n); });
    if (keep.length) {
      var ex = document.createElement('section');
      ex.className = 'ax-own-extra';
      keep.forEach(function (n) { ex.appendChild(n); });
      body.appendChild(ex);
    }
    bd.appendChild(hd);
    bd.appendChild(body);
    bd.classList.add('ax-own-panel');
    var form = body.querySelector('.ax-own-form'), input = body.querySelector('.ax-own-input'), log = body.querySelector('.ax-own-out');
    var hist = [], cur = 0;
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var t = input.value; input.value = '';
      if (t.trim()) { hist.push(t); hist = hist.slice(-30); cur = hist.length; }
      execute(t, log);
    });
    input.addEventListener('keydown', function (e) {
      if (e.key === 'ArrowUp' && hist.length) { e.preventDefault(); cur = Math.max(0, cur - 1); input.value = hist[cur] || ''; }
      else if (e.key === 'ArrowDown' && hist.length) { e.preventDefault(); cur = Math.min(hist.length, cur + 1); input.value = hist[cur] || ''; }
      else if (e.key === 'Tab' && input.value.trim()) {
        var pre = input.value.trim().replace(/^\//, '').toLowerCase();
        // Autocompleta nombres y alias (castellano e inglés): gana la forma que se está escribiendo.
        var cand = [];
        verbs.forEach(function (v) { [v.name].concat(v.alias || []).forEach(function (n) { if (n.indexOf(pre) === 0 && /^[a-z0-9]/.test(n)) cand.push({v: v, n: n}); }); });
        var distintos = cand.filter(function (x, i) { return cand.findIndex(function (y) { return y.v === x.v; }) === i; });
        if (distintos.length === 1) { e.preventDefault(); input.value = '/' + distintos[0].n + ' '; }
      }
    });
    cfg.panel = cfg.mount; cfg.header = '.ax-own-hd'; cfg.title = '.ax-own-title'; cfg.body = '.ax-own-body';
    cfg.form = '.ax-own-form'; cfg.input = '.ax-own-input'; cfg.log = '.ax-own-out'; cfg.hint = '.ax-own-hint';
    cfg.extras = '.ax-own-extra'; cfg.chrome = cfg.chrome === '.expert-module-head,.expert-module-resizer,.expert-layout-menu' ? '' : cfg.chrome;
    return true;
  }

  // ── Minimizado = una línea de orden ─────────────────────────────────────────
  // Carlos (4-oct 23:11): «no es cerrada es minimizada, que se pueda escribir pero no ocupe mucho
  // espacio». Minimizado solo queda la orden «› /help» (escribible) con un asa pequeña encima;
  // el asa, el ▾ de la cabecera o el ⌘ de la pata despliegan/pliegan, y una orden lanzada en
  // minimizado lo despliega para que se vea la respuesta. La página reserva abajo ese alto.
  function isOpen() { return !!panel && !panel.classList.contains('ax-min'); }
  function pad() {
    if (!panel) return;
    if (cfg.minHide) { document.documentElement.style.setProperty('--ax-dock-pad', '0px'); return; }
    var h = panel.classList.contains('ax-min') ? panel.offsetHeight : 0;
    if (h) document.documentElement.style.setProperty('--ax-dock-pad', h + 'px');
  }
  function setOpen(open, remember) {
    if (!panel || !panel.classList.contains('ax-dock')) return;
    panel.classList.toggle('ax-min', !open);
    panel.classList.toggle('ax-hide', cfg.minHide && !open);
    document.documentElement.setAttribute('data-ax-dock', open ? 'open' : cfg.minHide ? 'hidden' : 'min');
    var lab = open ? (cfg.minHide ? T('Ocultar el modo Experto', 'Hide Expert mode') : T('Minimizar el modo Experto', 'Minimise Expert mode')) : T('Desplegar el modo Experto', 'Expand Expert mode');
    [].forEach.call(panel.querySelectorAll('.ax-fold,.ax-grip'), function (f) {
      if (f.classList.contains('ax-fold')) f.textContent = open ? '▾' : '▴';
      f.setAttribute('aria-expanded', open ? 'true' : 'false');
      f.setAttribute('aria-label', lab); f.title = lab;
    });
    if (remember) { try { dockStore().setItem(DOCK_KEY, open ? '1' : '0'); } catch (_) {} }
    if (open) {
      var log = panel.querySelector('.ax-cli-out');
      if (log) setTimeout(function () { log.scrollTop = log.scrollHeight; }, 0);
    } else pad();
    try { root.dispatchEvent(new Event('resize')); } catch (_) {}
  }
  function dock(hd, form) {
    if (!cfg.dock || panel.classList.contains('ax-dock')) return;
    // Caminos de la orden y de la cabecera hasta el panel: minimizado solo queda la orden.
    for (var n = form.parentNode; n && n !== panel; n = n.parentNode) n.classList.add('ax-form-path');
    var f = document.createElement('button');
    f.type = 'button';
    f.className = 'ax-fold';
    hd.appendChild(f);
    hd.addEventListener('click', function (e) {
      if (e.target.closest('button:not(.ax-fold),a,input,select,textarea,summary,label')) return;
      setOpen(!isOpen(), true);
    });
    var g = document.createElement('button');
    g.type = 'button';
    g.className = 'ax-grip';
    g.addEventListener('click', function () { setOpen(!isOpen(), true); });
    panel.insertBefore(g, panel.firstChild);
    // Una orden lanzada en minimizado despliega el panel (sin recordarlo) para ver la respuesta.
    form.addEventListener('submit', function () { if (!isOpen()) setOpen(true, false); }, true);
    if (cfg.toggle) {
      document.addEventListener('click', function (e) {
        var t = e.target.closest && e.target.closest(cfg.toggle);
        if (t && !panel.contains(t)) setOpen(!isOpen(), true);
      }, true);
    }
    panel.classList.add('ax-dock');
    var sp = document.createElement('div');
    sp.className = 'ax-dock-spacer';
    sp.setAttribute('aria-hidden', 'true');
    document.body.appendChild(sp);
    try { new ResizeObserver(pad).observe(panel); } catch (_) {}
    var open = false;
    try { open = dockStore().getItem(DOCK_KEY) === '1'; } catch (_) {}
    setOpen(open, false);
  }

  function apply() {
    if (cfg.mount && !document.querySelector(cfg.mount + ' .ax-own-form') && !document.querySelector(cfg.panel + ' ' + cfg.form)) {
      if (!build()) return false;
    }
    panel = document.querySelector(cfg.panel);
    var form = panel && panel.querySelector(cfg.form);
    var input = panel && panel.querySelector(cfg.input);
    var log = panel && panel.querySelector(cfg.log);
    if (!panel || !form || !input || !log) return false;
    if (panel.classList.contains('ax-experto')) return true;
    document.documentElement.setAttribute('data-ax-experto', 'on');
    panel.classList.add('ax-experto');

    // Las asas y menús de bloque de la pata pueden aparecer después (expert-panel.js): CSS, no clases.
    if (cfg.chrome) {
      var st = document.createElement('style');
      st.id = 'ax-experto-chrome';
      st.textContent = cfg.chrome.split(',').map(function (s) { return 'html[data-ax-experto] .ax-experto ' + s.trim(); }).join(',') + '{display:none!important}';
      document.head.appendChild(st);
    }

    // Cabecera
    var hd = panel.querySelector(cfg.header);
    if (!hd) { hd = document.createElement('div'); panel.insertBefore(hd, panel.firstChild); }
    hd.classList.add('ax-hd');
    var title = panel.querySelector(cfg.title);
    if (!title) { title = document.createElement('strong'); hd.insertBefore(title, hd.firstChild); }
    title.classList.add('ax-title');
    title.textContent = '⌘ ' + T('EXPERTO', 'EXPERT') + ' · CLI';
    title.setAttribute('data-shell-text-es', '⌘ EXPERTO · CLI');
    title.setAttribute('data-shell-text-en', '⌘ EXPERT · CLI');

    // Cuerpo + ficha del motor
    var body = cfg.body ? panel.querySelector(cfg.body) : null;
    if (!body && form.parentNode === panel) {
      // Panel plano (registro y orden sueltos dentro del panel, p. ej. Pixeria/admira.studio):
      // se envuelven sin recrearlos, así el CLI de la pata conserva sus nodos y listeners.
      body = document.createElement('div');
      var inner = document.createElement('div');
      panel.insertBefore(body, log.parentNode === panel ? log : form);
      inner.appendChild(log); inner.appendChild(form);
      body.appendChild(inner);
    }
    if (!body) body = form.parentNode.parentNode;
    body.classList.add('ax-body');
    var cliModule = form.closest('[data-module]') || form.parentNode;
    if (cliModule === body) cliModule = form.parentNode;
    cliModule.classList.add('ax-cli-module');
    cliModule.removeAttribute('hidden');
    var slot = document.createElement('section');
    slot.className = 'ax-engine-slot';
    slot.setAttribute('aria-label', T('Motor de ', 'Engine of ') + cfg.pata);
    slot.innerHTML = '<pre class="ax-engine" aria-live="polite"></pre>';
    body.insertBefore(slot, body.firstChild);

    // CLI: registro arriba, orden «›» abajo (como digitalavatar.ai)
    var cli = form.parentNode;
    cli.classList.add('ax-cli');
    log.classList.add('ax-cli-out');
    form.classList.add('ax-cli-form');
    input.classList.add('ax-cli-input');
    // Algunas patas reescriben el placeholder al traducir: en la piel de la suite es /ayuda en castellano y
    // /help en inglés (06-10-2026: el verbo sugerido no cambia el idioma de la web al escribirlo).
    var pista = function () { return T('/ayuda', '/help'); };
    input.setAttribute('placeholder', pista());
    try {
      new MutationObserver(function () { if (input.getAttribute('placeholder') !== pista()) input.setAttribute('placeholder', pista()); })
        .observe(input, {attributes: true, attributeFilter: ['placeholder']});
      new MutationObserver(function () { if (input.getAttribute('placeholder') !== pista()) input.setAttribute('placeholder', pista()); })
        .observe(document.documentElement, {attributes: true, attributeFilter: ['lang']});
    } catch (_) {}
    if (!form.querySelector('.ax-cli-prompt')) {
      var prompt = document.createElement('label');
      prompt.className = 'ax-cli-prompt';
      prompt.textContent = '›';
      if (input.id) prompt.htmlFor = input.id;
      form.insertBefore(prompt, form.firstChild);
    }
    if (cfg.moveLog && log.parentNode !== cli) cli.insertBefore(log, form);
    if (log.parentNode === cli) cli.insertBefore(form, log.nextSibling);
    // Orden en textarea (admira.store): una sola línea; Enter ya lo gestiona la pata.
    if (input.tagName === 'TEXTAREA') input.rows = 1;
    var hint = panel.querySelector(cfg.hint);
    if (hint) { hint.classList.add('ax-cli-hint'); cli.appendChild(hint); }
    hello(log);

    // Extras de la pata (verbos, rutinas…) tras un botón
    tagAll(cfg.extras, 'ax-extra');
    if (panel.querySelector('.ax-extra') && !hd.querySelector('.ax-extras-btn')) {
      var b = document.createElement('button');
      b.type = 'button';
      b.className = 'ax-extras-btn';
      b.setAttribute('aria-pressed', 'false');
      b.textContent = '＋ ' + extrasLabel();
      b.addEventListener('click', function () {
        var on = panel.classList.toggle('ax-extras-on');
        b.setAttribute('aria-pressed', on ? 'true' : 'false');
        b.textContent = (on ? '－ ' : '＋ ') + extrasLabel();
      });
      hd.insertBefore(b, title.nextSibling);
    }

    // Idioma: intercepta en capture ANTES de que la pata diga «verbo desconocido».
    // Cubre /idioma, /language, typos, pegados y sin barra, en cualquier pata con la piel.
    form.addEventListener('submit', function (e) {
      var val = (input && input.value != null) ? String(input.value) : '';
      var parsed = parseLangCommand(val);
      if (!parsed) return;
      e.preventDefault();
      e.stopImmediatePropagation();
      var echoed = val.trim();
      input.value = '';
      if (!isOpen()) setOpen(true, false);
      if (echoed) out(log, '› ' + echoed, 'cmd');
      if (!parsed.ok) { out(log, langUsage(), 'err'); return; }
      applyLang(parsed.lang);
      out(log, langMessage(parsed.lang));
      state = '';
      paint();
    }, true);
    // /demo de la suite (las cinco soluciones) en cualquier pata con la piel; el resto de /demo es de la pata.
    form.addEventListener('submit', function (e) {
      var val = (input && input.value != null) ? String(input.value).trim() : '';
      var p = val.charAt(0) === '/' ? parseDemo(val) : null;
      if (!p) return;
      e.preventDefault();
      e.stopImmediatePropagation();
      input.value = '';
      if (!isOpen()) setOpen(true, false);
      out(log, '› ' + val, 'cmd');
      demoRun(p, log);
    }, true);
    // La ficha se repinta tras cada orden (/marca cambia el cliente) y al cambiar marca o idioma.
    form.addEventListener('submit', function () {
      state = T('ejecutando…', 'running…'); paint();
      setTimeout(function () { state = ''; paint(); }, 900);
      setTimeout(paint, 2500);
    }, true);
    document.addEventListener('admira:marca', paint);
    try { new MutationObserver(paint).observe(document.documentElement, {attributes: true, attributeFilter: ['lang', 'data-version', 'data-version-oculta']}); } catch (_) {}
    paint();
    dock(hd, form);
    if (readVersion() === '—' && cfg.versionUrl && document.documentElement.dataset.versionOculta !== '1') {
      fetch(cfg.versionUrl, {cache: 'no-store'}).then(function (r) { return r.ok ? r.json() : null; })
        .then(function (j) { if (j && j.version) { version = j.version; paint(); } }).catch(function () {});
    }
    return true;
  }

  root.AdmiraExperto = {
    paint: paint, lines: lines,
    setState: function (s) { state = s || ''; paint(); },
    set: function (k, v) { if (v == null) delete extra[k]; else extra[k] = v; paint(); },
    apply: apply,
    verb: verb,
    run: function (t) { var log = panel && panel.querySelector('.ax-cli-out'); if (log) return execute(t, log); },
    open: function () { setOpen(true, true); },
    close: function () { setOpen(false, true); },
    toggle: function () { setOpen(!isOpen(), true); },
    isOpen: isOpen,
    // admiranext.com (06-10-2026): el CLI del armazón (admira-frame.js) delega en estos verbos.
    // Añadidos compatibles: las cinco patas no los usan.
    list: function () { return verbs.map(function (v) { return {name: v.name, alias: (v.alias || []).slice(), args: v.args || '', desc: (v.desc || []).slice()}; }); },
    has: function (n) { n = String(n || '').replace(/^\//, '').toLowerCase(); return verbs.some(function (v) { return v.name === n || (v.alias || []).indexOf(n) >= 0; }); },
    idiomaDeVerbo: idiomaDeVerbo,
    pares: function () { return PARES_ES_EN.map(function (p) { return p.slice(); }); },
    exec: function (t, log, opts) { log = log || (panel && panel.querySelector('.ax-cli-out')); if (log) return execute(t, log, opts); },
    parseLangCommand: parseLangCommand,
    // /demo (7-oct-2026): catálogo de las cinco soluciones y lanzador, para el avatar digital.
    demos: function () { return DEMOS.map(function (d) { return {id: d.id, nombre: d.nombre, alias: d.alias.slice(), desc: T(d.desc[0], d.desc[1]), url: demoUrl(d)}; }); },
    parseDemo: function (t) { var p = parseDemo(t); if (!p) return null; if (p.lista) return p.local ? {lista: true, local: true} : {lista: true}; if (p.desconocida != null) return {desconocida: p.desconocida}; if (p.local) return {id: plataforma + '/' + p.sub.id, i: p.n - 1, url: abs(subUrl(p.sub)), local: true}; return {id: p.demo.id, i: p.i, url: demoUrl(p.demo)}; },
    demo: demoTexto, plataforma: function () { return plataforma; }, subdemos: function () { return localM(); }, listo: function () { return localListo; }, resolverDemo: resolverDemo,
    normalizeLangToken: normalizeLangToken,
    setLanguage: applyLang
  };

  function boot() {
    if (apply()) return;
    var mo = new MutationObserver(function () { if (apply()) mo.disconnect(); });
    mo.observe(document.documentElement, {childList: true, subtree: true});
    setTimeout(function () { mo.disconnect(); }, 20000);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, {once: true});
  else boot();
})(typeof window === 'undefined' ? globalThis : window);
