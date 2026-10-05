/* AdmiraNeXT · SELLO DE VERSIÓN CON NOVEDADES (cargador único de la suite).
 *
 * Una sola fuente para todos los sitios, igual que el avatar compartido:
 *   https://www.admiranext.com/assets/sello-novedades.js
 * Nació en admira.live (r10/r11, 5-6 oct 2026): el sello enseña la versión y, al pasar
 * el ratón (o con el foco, o con un toque en móvil), un popover de 2-4 líneas en
 * español con lo que trae esa versión. Merovingio, 6-oct-2026: llevado a toda la suite
 * (studio, store, tv, app, biz, pixeria, xpaceos, yokup, clearchannel, admiranext).
 *
 *   <script defer src="https://www.admiranext.com/assets/sello-novedades.js?v=20261006-sello-1"></script>
 *
 * Datos: el /version.json DEL PROPIO SITIO (mismo origen que la página), que cada deploy
 * genera con {version, novedades[], deployedAt, signature…} a partir de novedades.json.
 *
 * Sello: si la página ya tiene uno (.rail-ver, [data-admira-sello], [data-release-signature])
 * se MEJORA ese, no se duplica. Si no hay ninguno visible, se pinta un rectángulo pequeño
 * fijo abajo a la izquierda (metaestilo cuadrado AdmiraNeXT: esquinas rectas, mono, cian),
 * levantado por encima de la barra «⌘ EXPERTO» si está anclada abajo.
 *
 * NUEVO: si la versión publicada no es la última que este visitante vio en este sitio
 * (localStorage «admira-sello:visto»), el sello se resalta con «NUEVO». Se da por vista al
 * abrir el popover o al salir de la página. Con la pestaña abierta se vuelve a mirar
 * /version.json cada 3 min: si cambia, el sello avisa «NUEVO · recarga».
 *
 * Popover: vive en document.body con position:fixed, anclado con getBoundingClientRect y
 * recortado al viewport (fix r11 de admira.live): ningún overflow de un padre lo corta.
 * Fallback: title nativo con la versión y las novedades.
 *
 * Marca del <script> inyectado: data-admira-sello-loader (NO data-admira-sello, que es la marca de un sello).
 * Opciones (data-* del <script>): data-version-url="/version.json"  data-target="selector"
 *   data-pos="bl|br|tl|tr"  data-floating="off" (solo mejora el sello existente).
 * Apagado: <meta name="admira-sello" content="off">, ?sello=off, o dentro de un iframe
 * (players/kioscos) salvo data-iframe="on".
 * API: window.AdmiraSello = {version(), novedades(), open(), close(), refresh(), seen()}.
 */
(function (root) {
  'use strict';
  if (typeof document === 'undefined' || root.AdmiraSello) return;
  var script = document.currentScript || {};
  var ds = script.dataset || {};
  var VERSION_URL = ds.versionUrl || '/version.json';
  var TARGET = ds.target || '.rail-ver,[data-admira-sello],[data-release-signature]';
  var POS = /^(bl|br|tl|tr)$/.test(ds.pos || '') ? ds.pos : 'bl';
  var FLOATING = ds.floating !== 'off';
  var KEY = 'admira-sello:visto';
  var POLL_MS = 180000;
  var Z = 2147482000;
  var TIP_W = 300;
  var GAP = 8;

  function off() {
    try {
      var m = document.querySelector('meta[name="admira-sello"]');
      if (m && /^off$/i.test(m.getAttribute('content') || '')) return true;
      if (/[?&]sello=off\b/.test(location.search)) return true;
      // Pantallas de emisión, kioscos y la verja: ahí no se enseña ningún sello.
      if (/[?&](kiosk|player|embed|emision)=(1|on|true)\b/i.test(location.search)) return true;
      if (/^\/(?:auth|cms|canal|player|virtual-players|wall|signage|tester)(?:[\/.]|$)/i.test(location.pathname)) return true;
      if (root.top !== root && ds.iframe !== 'on') return true;
    } catch (e) { /* top cruzado: estamos en iframe */ if (ds.iframe !== 'on') return true; }
    return false;
  }
  if (off()) return;

  var state = { data: null, loaded: '', fresh: '', seals: [], chip: null, tip: null, anchor: null, open: false, pinned: false, hideT: 0 };

  function store(k, v) { try { if (v == null) return localStorage.getItem(k); localStorage.setItem(k, v); } catch (e) { return null; } return v; }

  function metaVersion() {
    var m = document.querySelector('meta[name="admiranext-version"]');
    var s = m ? String(m.getAttribute('content') || '') : '';
    if (/__ADMIRANEXT_VERSION__/.test(s)) return '';
    var r = s.match(/v\.\d{2}\.\d{2}\.\d{4}\.r\d+(?:\.\d{2}:\d{2})?/);
    return r ? r[0] : s.replace(/^AdmiraNeXT\s*/, '').trim();
  }

  function versionOf(d) { return String((d && (d.version || d.sello)) || '').trim(); }

  function lines(d) {
    var n = d && d.novedades;
    if (typeof n === 'string') n = n.split(/\s*[;|\n]\s*/);
    if (!Array.isArray(n)) return [];
    return n.map(function (x) { return String(x == null ? '' : x).trim(); }).filter(Boolean).slice(0, 4);
  }

  function fmtWhen(iso) {
    if (!iso) return '';
    var t = new Date(iso);
    if (isNaN(t)) return String(iso);
    try {
      return t.toLocaleString('es-ES', { timeZone: 'Europe/Madrid', day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) + ' (Madrid)';
    } catch (e) { return t.toISOString().replace('T', ' ').replace(/\..*$/, ' UTC'); }
  }

  function css() {
    if (document.getElementById('admira-sello-css')) return;
    var s = document.createElement('style');
    s.id = 'admira-sello-css';
    s.textContent = [
      '.ax-sello{--axs-c:#50c8ff;--axs-g:#3df08a;--axs-bg:#0a0c12;font:600 10px/1.2 "JetBrains Mono",ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;letter-spacing:.06em}',
      '#admira-sello-chip{position:fixed;z-index:' + (Z - 1) + ';display:inline-flex;align-items:center;gap:6px;margin:0;padding:5px 8px;',
      'border:1px solid rgba(80,200,255,.45);border-radius:0;background:rgba(10,12,18,.92);color:#d8e9f5;cursor:help;',
      'box-shadow:3px 3px 0 rgba(0,0,0,.45);max-width:calc(100vw - 24px);white-space:nowrap;-webkit-tap-highlight-color:transparent}',
      '#admira-sello-chip:hover,#admira-sello-chip:focus-visible{border-color:var(--axs-c);color:#fff;outline:none}',
      '#admira-sello-chip .axs-v{overflow:hidden;text-overflow:ellipsis}',
      '.ax-sello-up{cursor:help}',
      '.ax-sello-up:focus-visible{outline:1px solid #50c8ff;outline-offset:2px}',
      '.axs-nuevo{display:none;padding:1px 4px;border-radius:0;background:#3df08a;color:#04140a;font:800 9px/1.2 ui-monospace,Menlo,monospace;letter-spacing:.08em}',
      '.ax-sello-new .axs-nuevo{display:inline-block}',
      '#admira-sello-chip.ax-sello-new{border-color:#3df08a;box-shadow:3px 3px 0 rgba(0,0,0,.45),0 0 0 1px rgba(61,240,138,.35);animation:axs-pulse 2.4s ease-in-out 3}',
      '.ax-sello-up.ax-sello-new{box-shadow:inset 0 0 0 1px rgba(61,240,138,.7)}',
      '@keyframes axs-pulse{50%{box-shadow:3px 3px 0 rgba(0,0,0,.45),0 0 0 4px rgba(61,240,138,.18)}}',
      '@media (prefers-reduced-motion:reduce){#admira-sello-chip.ax-sello-new{animation:none}}',
      '#admira-sello-tip{position:fixed;z-index:' + Z + ';left:8px;top:8px;width:' + TIP_W + 'px;max-width:calc(100vw - 16px);box-sizing:border-box;',
      'padding:10px 12px;border:1px solid #50c8ff;border-radius:0;background:#0a0c12;color:#f0e6ff;box-shadow:4px 4px 0 rgba(0,0,0,.55);',
      'font:11px/1.45 "JetBrains Mono",ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;text-align:left;white-space:normal;',
      'opacity:0;visibility:hidden;transform:translateY(3px);transition:opacity .12s ease,transform .12s ease,visibility .12s;pointer-events:none}',
      '#admira-sello-tip.is-on{opacity:1;visibility:visible;transform:none;pointer-events:auto}',
      '#admira-sello-tip .axs-h{display:flex;gap:8px;align-items:center;margin:0 0 7px;padding:0 0 6px;border-bottom:1px solid rgba(80,200,255,.25);',
      'color:#50c8ff;font-weight:700;font-size:10px;letter-spacing:.12em;text-transform:uppercase}',
      '#admira-sello-tip .axs-hv{text-transform:none;letter-spacing:.04em;color:#d8e9f5;font-weight:600}',
      '#admira-sello-tip ul{margin:0;padding:0;list-style:none}',
      '#admira-sello-tip li{position:relative;margin:0 0 4px;padding:0 0 0 12px;color:#e6eef7}',
      '#admira-sello-tip li::before{content:"▸";position:absolute;left:0;color:#3df08a}',
      '#admira-sello-tip .axs-m{margin-top:7px;padding-top:6px;border-top:1px solid rgba(80,200,255,.18);color:rgba(216,200,255,.6);font-size:9.5px}',
      '#admira-sello-tip .axs-r{margin-top:7px;color:#3df08a;font-weight:700}',
      '#admira-sello-tip button{margin-left:6px;padding:1px 6px;border:1px solid #3df08a;border-radius:0;background:transparent;color:#3df08a;font:inherit;cursor:pointer}',
      '@media print{#admira-sello-chip,#admira-sello-tip{display:none!important}}'
    ].join('');
    (document.head || document.documentElement).appendChild(s);
  }

  function visible(el) {
    if (!el || !el.isConnected) return false;
    var r = el.getBoundingClientRect();
    if (r.width < 2 || r.height < 2) return false;
    var cs = root.getComputedStyle ? getComputedStyle(el) : null;
    if (cs && (cs.visibility === 'hidden' || cs.display === 'none' || Number(cs.opacity) === 0)) return false;
    var vw = root.innerWidth || 0, vh = root.innerHeight || 0;
    if (r.right < 0 || r.bottom < 0 || r.left > vw || r.top > vh + 2000) return false;
    // ¿Lo tapa un panel plegado (fuera de pantalla por transform)?
    return !!el.offsetParent || (cs && cs.position === 'fixed');
  }

  function isNew(v) { return !!v && store(KEY) !== v; }

  function markSeen() {
    var v = state.fresh || state.loaded;
    if (!v) return;
    if (state.fresh && state.fresh !== state.loaded) return; // hay otra más nueva sin cargar: que siga avisando
    store(KEY, v);
    state.seenPending = true; // el NUEVO se apaga al cerrar el popover, no mientras se lee
  }

  function applyNew(on) {
    var all = state.seals.slice();
    if (state.chip) all.push(state.chip);
    all.forEach(function (el) { el.classList.toggle('ax-sello-new', !!on); });
  }

  function label() {
    var v = state.loaded || metaVersion();
    return v || 'versión';
  }

  function titleText() {
    var d = state.data || {};
    var ls = lines(d);
    return label() + (ls.length ? ' — ' + ls.join(' · ') : ' — versión publicada');
  }

  function ensureChip() {
    if (state.chip && state.chip.isConnected) return state.chip;
    var b = document.createElement('button');
    b.type = 'button';
    b.id = 'admira-sello-chip';
    b.className = 'ax-sello';
    b.innerHTML = '<span class="axs-v"></span><span class="axs-nuevo">NUEVO</span>';
    document.body.appendChild(b);
    bind(b);
    state.chip = b;
    return b;
  }

  function placeChip() {
    var c = state.chip;
    if (!c) return;
    var lift = 12;
    var dock = document.querySelector('.ax-experto.ax-dock');
    if (dock && visible(dock)) {
      var r = dock.getBoundingClientRect();
      lift = Math.max(lift, (root.innerHeight || 0) - r.top + 8);
    }
    var top = POS.charAt(0) === 't', left = POS.charAt(1) === 'l';
    c.style.top = top ? '12px' : 'auto';
    c.style.bottom = top ? 'auto' : lift + 'px';
    c.style.left = left ? '12px' : 'auto';
    c.style.right = left ? 'auto' : '12px';
  }

  function ensureTip() {
    if (state.tip && state.tip.isConnected) return state.tip;
    var t = document.createElement('div');
    t.id = 'admira-sello-tip';
    t.className = 'ax-sello';
    t.setAttribute('role', 'tooltip');
    t.setAttribute('aria-hidden', 'true');
    t.addEventListener('mouseenter', function () { clearTimeout(state.hideT); });
    t.addEventListener('mouseleave', function () { if (!state.pinned) hide(); });
    document.body.appendChild(t);
    state.tip = t;
    return t;
  }

  function fillTip() {
    var t = ensureTip();
    var d = state.data || {};
    var ls = lines(d);
    t.innerHTML = '';
    var h = document.createElement('div');
    h.className = 'axs-h';
    var hk = document.createElement('span'); hk.textContent = 'Novedades';
    var hv = document.createElement('span'); hv.className = 'axs-hv'; hv.textContent = label();
    h.appendChild(hk); h.appendChild(hv);
    t.appendChild(h);
    if (ls.length) {
      var ul = document.createElement('ul');
      ls.forEach(function (x) { var li = document.createElement('li'); li.textContent = x; ul.appendChild(li); });
      t.appendChild(ul);
    } else {
      var p = document.createElement('div');
      p.textContent = 'Versión publicada, sin notas en este sello.';
      p.style.color = 'rgba(216,200,255,.72)';
      t.appendChild(p);
    }
    var meta = [d.signature || d.deployer || '', fmtWhen(d.deployedAt || d.builtAt)].filter(Boolean).join(' · ');
    if (meta) { var m = document.createElement('div'); m.className = 'axs-m'; m.textContent = meta; t.appendChild(m); }
    if (state.fresh && state.loaded && state.fresh !== state.loaded) {
      var r = document.createElement('div');
      r.className = 'axs-r';
      r.textContent = 'Ya hay otra versión publicada: ' + state.fresh;
      var b = document.createElement('button');
      b.type = 'button'; b.textContent = 'recargar';
      b.addEventListener('click', function () { location.reload(); });
      r.appendChild(b);
      t.appendChild(r);
    }
    return t;
  }

  function placeTip(anchor, tip) {
    if (!anchor || !tip) return null;
    var r = anchor.getBoundingClientRect();
    var vw = root.innerWidth || document.documentElement.clientWidth || 0;
    var vh = root.innerHeight || document.documentElement.clientHeight || 0;
    var tw = tip.offsetWidth || TIP_W, th = tip.offsetHeight || 120;
    var left = Math.min(Math.max(8, r.left), Math.max(8, vw - tw - 8));
    var top = r.top - th - GAP;
    if (top < 8) { top = r.bottom + GAP; if (top + th > vh - 8) top = Math.max(8, vh - th - 8); }
    tip.style.left = Math.round(left) + 'px';
    tip.style.top = Math.round(top) + 'px';
    return { left: Math.round(left), top: Math.round(top), width: tw, height: th, vw: vw, vh: vh };
  }

  function show(anchor) {
    clearTimeout(state.hideT);
    state.anchor = anchor || state.anchor || state.chip;
    var t = fillTip();
    placeTip(state.anchor, t);
    t.classList.add('is-on');
    t.setAttribute('aria-hidden', 'false');
    state.open = true;
    markSeen();
  }

  function hide(now) {
    clearTimeout(state.hideT);
    state.hideT = setTimeout(function () {
      if (!state.tip) return;
      state.tip.classList.remove('is-on');
      state.tip.setAttribute('aria-hidden', 'true');
      state.open = false; state.pinned = false;
      if (state.seenPending) { state.seenPending = false; applyNew(isNew(state.fresh || state.loaded) || (state.fresh !== state.loaded)); }
    }, now ? 0 : 120);
  }

  function bind(el) {
    if (el.__axSello) return;
    el.__axSello = true;
    if (el.tagName !== 'BUTTON' && !el.hasAttribute('tabindex')) el.tabIndex = 0;
    el.setAttribute('aria-describedby', 'admira-sello-tip');
    el.addEventListener('pointerenter', function (e) { if (e.pointerType !== 'touch') show(el); });
    el.addEventListener('pointerleave', function (e) { if (e.pointerType !== 'touch' && !state.pinned) hide(); });
    el.addEventListener('focus', function () { show(el); });
    el.addEventListener('blur', function () { if (!state.pinned) hide(); });
    el.addEventListener('click', function (e) {
      // Toque en móvil (o clic): fija/quita el popover. Sin navegar si el sello es un enlace.
      if (state.open && state.pinned && state.anchor === el) { hide(true); return; }
      state.pinned = true; show(el);
      if (el.tagName === 'A') e.preventDefault();
    });
    el.addEventListener('keydown', function (e) { if (e.key === 'Escape') hide(true); });
  }

  function paint() {
    css();
    var d = state.data || {};
    var v = label();
    var tt = titleText();
    state.seals = Array.prototype.slice.call(document.querySelectorAll(TARGET)).filter(function (el) { return el.id !== 'admira-sello-chip' && !/^(SCRIPT|META|LINK|STYLE|HTML|BODY|HEAD)$/.test(el.tagName); });
    state.seals.forEach(function (el) {
      el.classList.add('ax-sello-up');
      el.setAttribute('title', tt);
      el.setAttribute('aria-label', 'Sello ' + tt);
      if (!el.querySelector('.axs-nuevo')) {
        var n = document.createElement('span'); n.className = 'axs-nuevo'; n.textContent = 'NUEVO';
        n.style.marginLeft = '6px';
        el.appendChild(n);
      }
      bind(el);
    });
    var anyVisible = state.seals.some(visible);
    if (FLOATING && !anyVisible) {
      var c = ensureChip();
      c.querySelector('.axs-v').textContent = v;
      c.setAttribute('title', tt);
      c.setAttribute('aria-label', 'Sello de versión ' + tt);
      c.hidden = false;
      placeChip();
    } else if (state.chip) {
      state.chip.hidden = true;
    }
    if (!state.open) applyNew(isNew(state.fresh || state.loaded) || (state.fresh && state.loaded && state.fresh !== state.loaded));
    if (state.open) { fillTip(); placeTip(state.anchor, state.tip); }
    root.__admiraSelloData = d;
  }

  function fetchVersion() {
    var url = VERSION_URL + (VERSION_URL.indexOf('?') < 0 ? '?' : '&') + 'sello=' + Date.now();
    return fetch(url, { cache: 'no-store', credentials: 'same-origin', headers: { accept: 'application/json' } })
      .then(function (r) { return r.ok ? r.json() : null; })
      .catch(function () { return null; });
  }

  function refresh(first) {
    return fetchVersion().then(function (d) {
      if (!d || typeof d !== 'object') { if (first) paint(); return null; }
      var v = versionOf(d);
      if (first || !state.loaded) { state.data = d; state.loaded = v || metaVersion(); state.fresh = state.loaded; }
      else { state.fresh = v || state.fresh; if (state.fresh === state.loaded) state.data = d; }
      paint();
      return d;
    });
  }

  function boot() {
    if (!document.body) return setTimeout(boot, 50);
    state.loaded = metaVersion();
    paint();
    refresh(true);
    setInterval(function () { if (!document.hidden) refresh(false); }, POLL_MS);
    setInterval(function () { if (!document.hidden) paint(); }, 2000); // paneles que abren/cierran, dock Experto
    root.addEventListener('resize', function () { placeChip(); if (state.open) placeTip(state.anchor, state.tip); });
    root.addEventListener('scroll', function () { if (state.open) placeTip(state.anchor, state.tip); }, true);
    document.addEventListener('pointerdown', function (e) {
      if (!state.open) return;
      var t = e.target;
      if (state.tip && state.tip.contains(t)) return;
      if (state.anchor && state.anchor.contains && state.anchor.contains(t)) return;
      hide(true);
    }, true);
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && state.open) hide(true); });
    root.addEventListener('pagehide', function () { if (state.loaded && state.fresh === state.loaded) store(KEY, state.loaded); });
  }

  root.AdmiraSello = {
    version: function () { return state.loaded; },
    novedades: function () { return lines(state.data); },
    open: function () { state.pinned = true; show(state.anchor || state.seals.filter(visible)[0] || state.chip); },
    close: function () { hide(true); },
    refresh: function () { return refresh(false); },
    seen: markSeen,
    _placeTip: placeTip
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})(typeof window !== 'undefined' ? window : this);
