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
 * Modo propio (patas sin CLI): data-mount="#af-panel-bottom" data-mount-body=".af-bd" [data-extras-label="vista"].
 * API: window.AdmiraExperto = {paint(), setState(texto), lines(), set(clave, valor), verb({name, args, desc:[es,en], run(args, log)}), run(texto)}.
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
    extrasLabel: ds.extrasLabel || ''
  };
  // Sin data-engine, el nombre sale de la pata: admira.biz → «ADMIRA BIZ ENGINE».
  cfg.engine = ds.engine || (cfg.pata.replace(/\.pages\.dev$/, '').split('.').slice(-2).join(' ').toUpperCase() + ' ENGINE');
  var state = '', version = '', extra = {}, panel = null;
  var lang = function () { return (document.documentElement.lang || 'es').slice(0, 2) === 'en' ? 'en' : 'es'; };
  var T = function (es, en) { return lang() === 'en' ? en : es; };

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
    out(log, verbs.map(function (v) { return '/' + v.name + (v.args ? ' ' + v.args : '') + ' — ' + T(v.desc[0], v.desc[1]); }).join('\n'));
  }});
  verb({name: 'marca', args: '<id>|off|lista', desc: ['marca blanca del catálogo de admiranext.com (cliente de la ficha)', 'white label from the admiranext.com catalogue'], run: function (a, log) {
    var id = (a[0] || '').toLowerCase();
    var M = root.AdmiraMarca;
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
  verb({name: 'ir', args: '<sección>', desc: ['abre una sección de esta web (sin argumento: lista)', 'open a section of this site (no argument: list)'], run: function (a, log) {
    var items = navItems(), k = (a[0] || '').toLowerCase();
    if (!k) { out(log, items.length ? items.map(function (i) { return (i.k || '?') + ' → ' + i.h; }).join('\n') : T('Esta página no publica secciones.', 'This page lists no sections.')); return; }
    var hit = items.filter(function (i) { return (i.k || '').toLowerCase() === k || (i.t || '').toLowerCase() === k; })[0];
    if (!hit) { out(log, T('Sección desconocida: ', 'Unknown section: ') + k + T(' · /ir para la lista', ' · /ir for the list'), 'err'); return; }
    out(log, T('Abriendo ', 'Opening ') + hit.h + '…'); setTimeout(function () { location.assign(hit.h); }, 250);
  }});
  verb({name: 'estado', desc: ['ficha del motor en el registro', 'engine card into the log'], run: function (a, log) { out(log, lines().join('\n')); }});
  verb({name: 'version', desc: ['sello de la release', 'release stamp'], run: function (a, log) { out(log, readVersion()); }});
  verb({name: 'idioma', args: 'es|en', desc: ['idioma de la ficha y del CLI', 'language of the card and CLI'], run: function (a, log) {
    var l = a[0] === 'en' ? 'en' : 'es'; document.documentElement.lang = l; paint(); out(log, T('Idioma: español', 'Language: English'));
  }});
  verb({name: 'limpiar', alias: ['clear', 'cls'], desc: ['vacía el registro', 'clear the log'], run: function (a, log) { log.textContent = ''; hello(log); }});

  // Avatar conversacional. Un solo cargador (admiranext.com/assets/avatar.js): good = calvo 3D,
  // better = chica Ready Player Me, best = Neo. En modo piel el CLI de la pata ya lo tiene;
  // aquí entra el modo propio (data-mount), que es el dock de las patas sin consola.
  var AVATAR_SRC = 'https://www.admiranext.com/assets/avatar.js?v=20261004-avatar-3';
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
  verb({name: 'avatar', args: '[good|better|best]', desc: [
    'good abre el calvo (cara 3D, 52 blendshapes) · better abre la chica (Ready Player Me, gafas) · best abre a Neo (MetaHuman; si el host de render está apagado, cae a la chica). Sin nivel, el estado. /avatarON lo muestra y /avatarOFF lo oculta. /avatar reset vuelve al interruptor del proyecto',
    'good opens the bald 3D face (facecap, 52 blendshapes) · better opens the web girl (Ready Player Me, glasses) · best opens Neo (MetaHuman; if the render host is off, the girl takes over). Alone, the status. /avatarON shows it and /avatarOFF hides it. /avatar reset follows the project switch'
  ], run: function (a, log) { return avatarRun('/avatar' + (a.length ? ' ' + a.join(' ') : ''), log); }});
  verb({name: 'avataron', desc: ['muestra el avatar digital y lo recuerda', 'show the digital avatar and remember it'], run: function (a, log) { return avatarRun('/avatarON', log); }});
  verb({name: 'avataroff', desc: ['oculta el avatar digital y lo recuerda', 'hide the digital avatar and remember it'], run: function (a, log) { return avatarRun('/avatarOFF', log); }});
  verb({name: 'avatardigital', alias: ['digitalavatar'], desc: ['alias de /avatar', 'alias of /avatar'], run: function (a, log) {
    return avatarRun('/avatar' + (a.length ? ' ' + a.join(' ') : ''), log);
  }});
  verb({name: 'cli', args: 'ayudante|helper', desc: ['interruptor del avatar en esta consola', 'avatar switch on this console'], run: function (a, log) {
    if (/^(ayudante|helper)$/i.test(a[0] || '')) return avatarRun('/cli ' + a.join(' '), log);
    out(log, T('En esta consola, /cli ayudante es el avatar. /avatar good, /avatar better o /avatar best elige la cara.', 'On this console, /cli helper is the avatar. /avatar good, /avatar better or /avatar best picks the face.'), 'err');
  }});

  function execute(text, log) {
    var t = String(text || '').trim();
    if (!t) return;
    out(log, '› ' + t, 'cmd');
    var parts = t.replace(/^\//, '').split(/\s+/), name = (parts.shift() || '').toLowerCase();
    var v = verbs.filter(function (x) { return x.name === name || (x.alias || []).indexOf(name) >= 0; })[0];
    if (!v) { out(log, T('Verbo desconocido: /', 'Unknown verb: /') + name + T(' · escribe /help', ' · type /help'), 'err'); return; }
    try { return v.run(parts, log); } catch (e) { out(log, String(e && e.message || e), 'err'); }
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
        var m = verbs.filter(function (v) { return v.name.indexOf(pre) === 0; });
        if (m.length === 1) { e.preventDefault(); input.value = '/' + m[0].name + ' '; }
      }
    });
    cfg.panel = cfg.mount; cfg.header = '.ax-own-hd'; cfg.title = '.ax-own-title'; cfg.body = '.ax-own-body';
    cfg.form = '.ax-own-form'; cfg.input = '.ax-own-input'; cfg.log = '.ax-own-out'; cfg.hint = '.ax-own-hint';
    cfg.extras = '.ax-own-extra'; cfg.chrome = cfg.chrome === '.expert-module-head,.expert-module-resizer,.expert-layout-menu' ? '' : cfg.chrome;
    return true;
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
    input.setAttribute('placeholder', '/help');
    // Algunas patas reescriben el placeholder al traducir: en la piel de la suite siempre es /help.
    try {
      new MutationObserver(function () { if (input.getAttribute('placeholder') !== '/help') input.setAttribute('placeholder', '/help'); })
        .observe(input, {attributes: true, attributeFilter: ['placeholder']});
    } catch (_) {}
    if (!form.querySelector('.ax-cli-prompt')) {
      var prompt = document.createElement('label');
      prompt.className = 'ax-cli-prompt';
      prompt.textContent = '›';
      if (input.id) prompt.htmlFor = input.id;
      form.insertBefore(prompt, form.firstChild);
    }
    if (log.parentNode === cli) cli.insertBefore(form, log.nextSibling);
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

    // La ficha se repinta tras cada orden (/marca cambia el cliente) y al cambiar marca o idioma.
    form.addEventListener('submit', function () {
      state = T('ejecutando…', 'running…'); paint();
      setTimeout(function () { state = ''; paint(); }, 900);
      setTimeout(paint, 2500);
    }, true);
    document.addEventListener('admira:marca', paint);
    try { new MutationObserver(paint).observe(document.documentElement, {attributes: true, attributeFilter: ['lang', 'data-version']}); } catch (_) {}
    paint();
    if (readVersion() === '—' && cfg.versionUrl) {
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
    run: function (t) { var log = panel && panel.querySelector('.ax-cli-out'); if (log) return execute(t, log); }
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
