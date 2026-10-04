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
 * API: window.AdmiraExperto = {paint(), setState(texto), lines(), set(clave, valor)}.
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
    versionUrl: ds.versionUrl || '/version.json'
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
    if (xb) xb.textContent = (panel.classList.contains('ax-extras-on') ? '－ ' : '＋ ') + T('verbos', 'verbs');
  }
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

  function apply() {
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
    var body = panel.querySelector(cfg.body) || form.parentNode.parentNode;
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
      b.textContent = T('＋ verbos', '＋ verbs');
      b.addEventListener('click', function () {
        var on = panel.classList.toggle('ax-extras-on');
        b.setAttribute('aria-pressed', on ? 'true' : 'false');
        b.textContent = on ? T('－ verbos', '－ verbs') : T('＋ verbos', '＋ verbs');
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
    apply: apply
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
