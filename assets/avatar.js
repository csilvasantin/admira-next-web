/* AdmiraNeXT · avatar digital compartido (cargador único de la red).
 *
 * Una sola fuente para todos los sitios: https://www.admiranext.com/assets/avatar.js
 * La cara es https://digitalavatar.ai/embed.js (siempre la MISMA URL: dos URL
 * distintas cargarían dos módulos y saldrían dos avatares).
 *
 * Precedencia (de más a menos fuerte):
 *   1. Elección del usuario en este sitio y navegador: localStorage
 *      «admira-avatar:override» = "on" | "off" (la escriben /avatarON, /avatarOFF y /avatar).
 *   2. Interruptor del proyecto en admiranext.com (GET /api/avatar/flags?host=…).
 *   3. Apagado.
 * El encendido automático por interruptor NUNCA escribe la elección del usuario:
 * si Carlos apaga el proyecto, desaparece para todos los que no lo forzaron.
 * Con el interruptor sale la burbuja cerrada; /avatarON abre el panel.
 * Oculto cuenta como apagado (/avatar alterna según lo que se ve).
 *
 * Atributos opcionales del <script>:
 *   data-brain="/avatar-ask"   relé del mismo origen (si el sitio lo tiene);
 *                              sin él se usa el relé central de admiranext.com.
 *   data-title, data-greeting  textos del panel.
 * Migra el interruptor antiguo por sitio (FLT-101350: «da-avatar:<host>» = 1/0).
 */
(function (root) {
  'use strict';

  var ORIGIN = 'https://www.admiranext.com';
  var FLAGS_URL = ORIGIN + '/api/avatar/flags';
  var CENTRAL_BRAIN = ORIGIN + '/api/avatar-ask';
  var EMBED_URL = 'https://digitalavatar.ai/embed.js';
  var KEY = 'admira-avatar:override';
  var CACHE = 'admira-avatar:flags';
  var CACHE_MS = 60000;
  var TIMEOUT_MS = 2500;
  var ON = /^(on|encender|mostrar|show|abrir|open)$/i;
  var OFF = /^(off|apagar|ocultar|hide|cerrar|close)$/i;
  var RESET = /^(reset|auto|proyecto|project|default)$/i;

  // ─── Piezas puras (se prueban en node: test/avatar-loader.test.mjs) ───
  // null si el texto no es un comando del avatar. 'on' | 'off' | 'toggle' | 'reset' | 'bad'.
  function decide(text) {
    var raw = String(text == null ? '' : text).trim();
    var m = raw.match(/^\/?([^\s@]+)(?:@\S+)?(?:\s+([\s\S]*))?$/);
    if (!m) return null;
    var verb = m[1].toLowerCase();
    var rest = String(m[2] || '').trim().split(/\s+/).filter(Boolean);
    if (verb === 'avataron') return 'on';
    if (verb === 'avataroff') return 'off';
    if (verb === 'cli') {
      if (!/^(ayudante|helper)$/i.test(rest[0] || '')) return null;
      rest = rest.slice(1);
    } else if (verb !== 'avatar' && verb !== 'avatardigital' && verb !== 'digitalavatar') {
      return null;
    }
    var arg = rest[0] || '';
    if (!arg) return 'toggle';
    if (ON.test(arg)) return 'on';
    if (OFF.test(arg)) return 'off';
    if (RESET.test(arg)) return 'reset';
    return 'bad';
  }

  // override 'on'|'off'|null, flag true|false|null → {on, open:false, source}
  function resolve(override, flag) {
    if (override === 'on') return {on: true, source: 'usuario'};
    if (override === 'off') return {on: false, source: 'usuario'};
    if (flag === true) return {on: true, source: 'proyecto'};
    return {on: false, source: flag === false ? 'proyecto' : 'defecto'};
  }

  function legacyValue(v) {
    return v === '1' ? 'on' : v === '0' ? 'off' : null;
  }

  function message(kind, en) {
    if (kind === 'on') return en ? 'Digital avatar on' : 'Avatar digital activado';
    if (kind === 'off') return en ? 'Digital avatar off' : 'Avatar digital desactivado';
    if (kind === 'reset-on') return en ? 'Digital avatar follows the project switch (on)' : 'El avatar sigue el interruptor del proyecto (encendido)';
    if (kind === 'reset-off') return en ? 'Digital avatar follows the project switch (off)' : 'El avatar sigue el interruptor del proyecto (apagado)';
    return en
      ? 'Use /avatarON, /avatarOFF or /avatar (toggle). /avatar reset follows the project switch.'
      : 'Usa /avatarON, /avatarOFF o /avatar (alterna). /avatar reset vuelve al interruptor del proyecto.';
  }

  var api = {decide: decide, resolve: resolve, legacyValue: legacyValue, message: message,
    KEY: KEY, FLAGS_URL: FLAGS_URL, EMBED_URL: EMBED_URL, CENTRAL_BRAIN: CENTRAL_BRAIN};
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (typeof document === 'undefined') return;
  if (root.AdmiraAvatar && root.AdmiraAvatar.handle) return; // ya cargado en esta página

  var doc = document;
  var script = doc.currentScript;
  var data = (script && script.dataset) || {};
  var host = (root.location && root.location.host) || '';
  function store() { try { return root.localStorage; } catch (_) { return null; } }
  function session() { try { return root.sessionStorage; } catch (_) { return null; } }
  function get(k) { var s = store(); try { return s ? s.getItem(k) : null; } catch (_) { return null; } }
  function set(k, v) { var s = store(); try { if (s) { if (v == null) s.removeItem(k); else s.setItem(k, v); } } catch (_) {} }
  function en() { return String(doc.documentElement.lang || '').toLowerCase().indexOf('en') === 0; }

  // Migración del interruptor por sitio (una vez).
  (function migrate() {
    var oldKey = 'da-avatar:' + host;
    var old = legacyValue(get(oldKey));
    if (old && !get(KEY)) set(KEY, old);
    if (get(oldKey) != null) set(oldKey, null);
  })();

  function override() { var v = get(KEY); return v === 'on' || v === 'off' ? v : null; }

  function brainUrl() {
    var b = String(data.brain || '').trim();
    if (!b) return root.location.origin === ORIGIN ? '/api/avatar-ask' : CENTRAL_BRAIN;
    if (b === 'local') b = '/avatar-ask';
    if (b.charAt(0) === '/') return root.location.origin + b;
    return /^https:\/\//.test(b) ? b : CENTRAL_BRAIN;
  }

  // ─── Elevación sobre las barras «Experto» de cada sitio ───
  function ensureLift() {
    if (doc.getElementById('admira-avatar-lift')) return;
    var style = doc.createElement('style');
    style.id = 'admira-avatar-lift';
    style.textContent = '#da-av{right:16px !important;bottom:var(--da-lift,20px) !important;top:auto !important}';
    (doc.head || doc.documentElement).appendChild(style);
  }
  function barHeight(el) {
    if (!el) return 0;
    var cs = root.getComputedStyle(el);
    if (cs.display === 'none' || cs.visibility === 'hidden') return 0;
    var r = el.getBoundingClientRect();
    if (r.height < 24 || r.bottom < root.innerHeight - 40 || r.top > root.innerHeight - 8) return 0;
    return Math.round(root.innerHeight - r.top + 16);
  }
  function applyLift() {
    var h = 20;
    ['xsExpert', 'telegramDock', 'expert-panel', 'yk-rail-bottom'].forEach(function (id) { h = Math.max(h, barHeight(doc.getElementById(id))); });
    doc.querySelectorAll('.xs-expert, .yk-rail-bottom, .pf-cli').forEach(function (el) { h = Math.max(h, barHeight(el)); });
    doc.documentElement.style.setProperty('--da-lift', h + 'px');
  }
  var liftTimer = null;
  function watchLift() {
    ensureLift();
    applyLift();
    root.addEventListener('resize', applyLift);
    // Las barras se abren y cierran sin avisar: se reajusta con un sondeo barato.
    if (!liftTimer) liftTimer = root.setInterval(applyLift, 1500);
  }

  // ─── Cara ───
  var face = null, mounting = null, ours = false;
  function node() { return doc.getElementById('da-av'); }
  function visible() { var n = node(); return !!n && n.style.display !== 'none'; }

  function fallbackFace() {
    var wrap = node();
    if (wrap) return wrap;
    wrap = doc.createElement('div');
    wrap.id = 'da-av';
    wrap.setAttribute('style', 'position:fixed;right:20px;bottom:20px;z-index:2147483000');
    wrap.innerHTML = '<div style="width:220px;padding:14px 16px;border-radius:16px;background:#02080d;border:1px solid rgba(120,243,255,.45);color:#eef7ff;font:13px/1.4 system-ui,sans-serif;box-shadow:0 16px 40px rgba(0,0,0,.45)">'
      + '<div style="font:700 11px/1.2 ui-monospace,monospace;letter-spacing:.14em;text-transform:uppercase;color:#78f3ff;margin-bottom:8px">' + (en() ? 'Digital avatar' : 'Avatar digital') + '</div>'
      + '<div style="font-size:42px;line-height:1;text-align:center">🤖</div>'
      + '<div style="margin-top:8px">' + (en() ? 'The avatar could not load.' : 'El avatar no pudo cargar.') + '</div></div>';
    doc.body.appendChild(wrap);
    return wrap;
  }

  function mount() {
    if (face) return Promise.resolve(face);
    // Otro componente (copiloto de flota de Yokup o admira.tv/cms) ya montó una cara: no se duplica.
    if (node() && !ours) { face = {open: function () { var b = doc.getElementById('da-bubble'); if (b && !node().classList.contains('open')) b.click(); }, close: function () {}}; return Promise.resolve(face); }
    if (mounting) return mounting;
    var english = en();
    mounting = import(EMBED_URL).then(function (mod) {
      ours = true;
      var f = mod.mount({
        brainUrl: brainUrl(),
        lang: english ? 'en-US' : 'es-ES',
        title: data.title || (english ? 'Digital avatar' : 'Avatar digital'),
        greeting: data.greeting || (english ? 'Hello. What do you need?' : 'Hola. ¿En qué te ayudo?'),
        placeholder: english ? 'Ask about this project…' : 'Pregunta sobre este proyecto…'
      });
      face = f || {open: function () { var b = doc.getElementById('da-bubble'); if (b) b.click(); }, close: function () {}};
      return face;
    }).catch(function () {
      ours = true;
      fallbackFace();
      face = {open: function () {}, close: function () {}};
      return face;
    }).then(function (f) { watchLift(); mounting = null; return f; });
    return mounting;
  }

  function show(open) {
    return mount().then(function (f) {
      var n = node();
      if (n) n.style.display = '';
      if (open) { try { f.open(); } catch (_) {} }
      applyLift();
      return true;
    });
  }
  function hide() {
    var n = node();
    if (n) n.style.display = 'none';
    try { if (root.speechSynthesis) root.speechSynthesis.cancel(); } catch (_) {}
  }

  // ─── Interruptor del proyecto ───
  function readCache() {
    var s = session();
    try { var c = JSON.parse((s && s.getItem(CACHE)) || 'null'); if (c && c.host === host && Date.now() - c.t < CACHE_MS) return c.on; } catch (_) {}
    return null;
  }
  function projectFlag() {
    var cached = readCache();
    if (cached !== null) return Promise.resolve(cached);
    if (typeof fetch !== 'function') return Promise.resolve(null);
    var ctl = typeof AbortController === 'function' ? new AbortController() : null;
    var timer = ctl ? root.setTimeout(function () { ctl.abort(); }, TIMEOUT_MS) : null;
    return fetch(FLAGS_URL + '?host=' + encodeURIComponent(host), {credentials: 'omit', cache: 'default', signal: ctl ? ctl.signal : undefined})
      .then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); })
      .then(function (d) {
        var on = !!(d && d.on === true);
        var s = session();
        try { if (s) s.setItem(CACHE, JSON.stringify({t: Date.now(), host: host, on: on, project: d && d.project})); } catch (_) {}
        return on;
      })
      .catch(function () { return null; })
      .then(function (v) { if (timer) root.clearTimeout(timer); return v; });
  }

  // Devuelve el texto de la respuesta para la consola. Síncrono en lo que importa:
  // la elección se guarda antes de volver.
  function run(text) {
    var mode = decide(text);
    if (mode == null) return null;
    var english = en();
    if (mode === 'bad') return message('bad', english);
    if (mode === 'reset') {
      set(KEY, null);
      projectFlag().then(function (flag) { if (flag) show(false); else hide(); });
      return message(readCache() ? 'reset-on' : 'reset-off', english);
    }
    var on = mode === 'toggle' ? !visible() : mode === 'on';
    set(KEY, on ? 'on' : 'off');
    if (on) show(true); else hide();
    return message(on ? 'on' : 'off', english);
  }
  function handle(text) {
    var out = run(text);
    return Promise.resolve(out == null ? message('bad', en()) : out);
  }
  function state() {
    return {override: override(), visible: visible(), host: host, brain: brainUrl()};
  }

  root.AdmiraAvatar = {run: run, handle: handle, decide: decide, show: show, hide: hide, state: state,
    reset: function () { set(KEY, null); }, flag: projectFlag};
  // Compatibilidad con los CLI que ya llamaban a AvatarDigital (FLT-101350).
  root.AvatarDigital = {handle: handle, decide: decide, show: function () { set(KEY, 'on'); return show(true); },
    hide: function () { set(KEY, 'off'); hide(); }, storedOn: function () { return override() === 'on'; }};

  function boot() {
    var o = override();
    if (o === 'on') { show(false); return; }
    if (o === 'off') return;
    projectFlag().then(function (flag) {
      if (override() !== null) return;          // el usuario decidió mientras tanto
      if (resolve(null, flag).on) show(false);   // burbuja cerrada; no se guarda nada
    });
  }
  if (doc.readyState === 'loading') doc.addEventListener('DOMContentLoaded', boot); else boot();
})(typeof window === 'undefined' ? globalThis : window);
