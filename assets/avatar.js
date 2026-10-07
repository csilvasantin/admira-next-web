/* AdmiraNeXT · avatar digital compartido (cargador único de la red).
 *
 * Una sola fuente para todos los sitios: https://www.admiranext.com/assets/avatar.js
 * La cara y la voz no se copian: el panel abre la demo viva de digitalavatar.ai
 * (micro, texto, ElevenLabs por brain.digitalavatar.ai, cortar, estados).
 *
 *   /avatar good    Admirito — la nube animada, 2D ligera con lip-sync y vida propia (nube.html)
 *                   (el calvo 3D, better.html, queda como etapa del museo de digitalavatar.ai)
 *   /avatar better  Luna — anfitriona web Ready Player Me (best.html)
 *   /avatar best    Neo — MetaHuman por Pixel Streaming (metahuman.html)
 *   /avatar         estado y las tres opciones
 *   /avatarON /avatarOFF   muestran u ocultan el panel y lo recuerdan
 *   AdmiraAvatar.setContext({loc, lang, sector, brand, site, city, tier})  contexto del cliente
 *     (tier = nivel que pide la página; /avatar <nivel> del usuario manda en su pestaña)
 *     (la cara lo recibe en la URL y por postMessage; ver levelUrl).
 *   window 'admira-avatar:open' (cancelable, detail {level, context}): antes de abrir el panel;
 *     preventDefault() lo deja cerrado (la página muestra su propio avatar en escena)
 *
 * Precedencia (de más a menos fuerte):
 *   1. Elección del usuario en este sitio y navegador: localStorage
 *      «admira-avatar:override» = "on" | "off" (la escriben /avatarON, /avatarOFF
 *      y /avatar good|better|best).
 *   2. Interruptor del proyecto en admiranext.com (GET /api/avatar/flags?host=…).
 *   3. Apagado.
 * El encendido automático por interruptor NUNCA escribe la elección del usuario:
 * si Carlos apaga el proyecto, desaparece para todos los que no lo forzaron.
 * Con el interruptor sale la burbuja cerrada; /avatarON y /avatar <nivel> abren el panel.
 * Migra el interruptor antiguo por sitio (FLT-101350: «da-avatar:<host>» = 1/0).
 */
(function (root) {
  'use strict';

  var ORIGIN = 'https://www.admiranext.com';
  var FLAGS_URL = ORIGIN + '/api/avatar/flags';
  var CENTRAL_BRAIN = ORIGIN + '/api/avatar-ask';
  var LEVELS = {
    good: 'https://digitalavatar.ai/nube.html?dock=1',
    better: 'https://digitalavatar.ai/best.html?dock=1&kiosk=0',
    best: 'https://digitalavatar.ai/metahuman.html?dock=1'
  };
  // Categorías públicas (Carlos, 7-oct-2026): avatar = good (Admirito), human = better (Luna),
  // metahuman = best (Neo). good/better/best siguen como alias.
  var CATEGORY_LEVEL = { avatar: 'good', human: 'better', metahuman: 'best', admirito: 'good', luna: 'better', neo: 'best' };
  var KEY = 'admira-avatar:override';
  var LEVEL_KEY = 'admira-avatar:nivel';
  var SIZE_KEY = 'admira-avatar:size';
  var CACHE = 'admira-avatar:flags';
  var CACHE_MS = 60000;
  var TIMEOUT_MS = 2500;
  var ON = /^(on|encender|mostrar|show|abrir|open)$/i;
  var OFF = /^(off|apagar|ocultar|hide|cerrar|close)$/i;
  var RESET = /^(reset|auto|proyecto|project|default)$/i;

  // ─── Piezas puras (se prueban en node: test/avatar-loader.test.mjs) ───
  // null si el texto no es un comando del avatar.
  // 'on' | 'off' | 'toggle' | 'mascota' | 'reset' | 'status' | 'good' | 'better' | 'best' | 'bad'.
  // 'mascota' alterna la presencia de Admirito (burbuja nube), no el panel.
  function decide(text) {
    var raw = String(text == null ? '' : text).trim();
    var m = raw.match(/^\/?([^\s@]+)(?:@\S+)?(?:\s+([\s\S]*))?$/);
    if (!m) return null;
    var verb = m[1].toLowerCase();
    var rest = String(m[2] || '').trim().split(/\s+/).filter(Boolean);
    if (verb === 'avataron') return 'on';
    if (verb === 'avataroff') return 'off';
    // Admirito, la mascota nube (Carlos, 5-oct-2026): /avatarDigital, /avatar Digital y /admirito
    // la muestran u ocultan (alternan); con on/off la fijan.
    if (verb === 'admirito' || (verb === 'avatar' && /^digital$/i.test(rest[0] || ''))) {
      var a0 = String((verb === 'admirito' ? rest[0] : rest[1]) || '').toLowerCase();
      return !a0 ? 'mascota' : ON.test(a0) ? 'on' : OFF.test(a0) ? 'off' : 'bad';
    }
    if (verb === 'avatardigital' && !rest.length) return 'mascota';
    if (verb === 'cli') {
      if (!/^(ayudante|helper)$/i.test(rest[0] || '')) return null;
      rest = rest.slice(1);
    } else if (verb !== 'avatar' && verb !== 'avatardigital' && verb !== 'digitalavatar') {
      return null;
    }
    var arg = (rest[0] || '').toLowerCase();
    if (!arg) return verb === 'cli' ? 'toggle' : 'status';
    if (ON.test(arg)) return 'on';
    if (OFF.test(arg)) return 'off';
    if (RESET.test(arg)) return 'reset';
    arg = CATEGORY_LEVEL[arg] || arg;
    if (verb !== 'cli' && LEVELS[arg]) return arg;
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
    if (kind === 'good') return en ? 'Avatar: Admirito, the animated cloud (moves its lips and lives on its own).' : 'Avatar: Admirito, la nube animada (mueve los labios y hace cosas sola).';
    if (kind === 'better') return en ? 'Human: Luna, the web host (Ready Player Me).' : 'Human: Luna, la anfitriona web (Ready Player Me).';
    if (kind === 'best') return en ? 'Metahuman: Neo, MetaHuman.' : 'Metahuman: Neo, MetaHuman.';
    if (kind === 'status') return en
      ? 'Digital avatar. /avatar avatar · Admirito, the animated cloud. /avatar human · Luna, the web host. /avatar metahuman · Neo, MetaHuman (good, better and best still work). /avatarON shows it, /avatarOFF hides it.'
      : 'Avatar digital. /avatar avatar · Admirito, la nube animada. /avatar human · Luna, la anfitriona web. /avatar metahuman · Neo, MetaHuman (good, better y best siguen valiendo). /avatarON lo muestra, /avatarOFF lo oculta.';
    if (kind === 'mascota-on') return en ? 'Admirito shown. /avatarDigital or /admirito hides it again.' : 'Admirito visible. /avatarDigital o /admirito lo vuelve a ocultar.';
    if (kind === 'mascota-off') return en ? 'Admirito hidden. /avatarDigital or /admirito shows it again.' : 'Admirito oculto. /avatarDigital o /admirito lo vuelve a mostrar.';
    if (kind === 'reset-on') return en ? 'Digital avatar follows the project switch (on)' : 'El avatar sigue el interruptor del proyecto (encendido)';
    if (kind === 'reset-off') return en ? 'Digital avatar follows the project switch (off)' : 'El avatar sigue el interruptor del proyecto (apagado)';
    return en
      ? 'Use /avatar avatar, /avatar human or /avatar metahuman. /avatar alone shows the status. /avatarON and /avatarOFF show or hide it.'
      : 'Usa /avatar avatar, /avatar human o /avatar metahuman. /avatar solo muestra el estado. /avatarON y /avatarOFF lo muestran o lo ocultan.';
  }

  // El asa está arriba a la izquierda y el panel sigue anclado abajo a la
  // derecha: arrastrar hacia arriba-izquierda agranda. El borde superior no
  // pasa de 64 px (o del borde inferior de la barra, si queda más abajo).
  function clampPanelSize(w, h, view) {
    view = view || {};
    var vw = isFinite(view.w) ? view.w : 1280;
    var vh = isFinite(view.h) ? view.h : 800;
    var top = isFinite(view.top) ? view.top : 64;
    if (top < 64) top = 64;
    var bottom = isFinite(view.bottom) ? view.bottom : 20;
    var maxW = Math.max(1, Math.floor(vw - 32));
    var maxH = Math.max(1, Math.floor(vh - bottom - top));
    var minW = Math.min(240, maxW);
    var minH = Math.min(180, maxH);
    var nw = Number(w), nh = Number(h);
    if (!isFinite(nw) || nw <= 0) nw = Math.min(400, maxW);
    if (!isFinite(nh) || nh <= 0) nh = Math.min(680, maxH);
    return {
      w: Math.round(Math.max(minW, Math.min(maxW, nw))),
      h: Math.round(Math.max(minH, Math.min(maxH, nh)))
    };
  }
  function panelSizeAfterDrag(start, point, origin, view) {
    var dx = (point && point.x || 0) - (origin && origin.x || 0);
    var dy = (point && point.y || 0) - (origin && origin.y || 0);
    return clampPanelSize((start && start.w || 0) - dx, (start && start.h || 0) - dy, view);
  }

  // ─── Contexto del cliente (avatar por sector · 6-oct-2026 · GrokBot · MacMini) ───
  // El panel abre la cara con ?loc, lang, sector, brand, site, city y tier (= nivel:
  // good, better o best). digitalavatar.ai/assets/da-context.js lo lee y lo manda al
  // cerebro; los cambios posteriores viajan por postMessage {type:'da-context'}.
  var CTX_KEYS = ['loc', 'lang', 'sector', 'brand', 'site', 'city'];
  function cleanContext(ctx) {
    var out = {};
    ctx = ctx || {};
    for (var i = 0; i < CTX_KEYS.length; i++) {
      var k = CTX_KEYS[i], v = ctx[k];
      if (v == null) continue;
      v = String(v).replace(/\s+/g, ' ').trim().slice(0, 120);
      if (k === 'lang') v = /^en/i.test(v) ? 'en' : /^es/i.test(v) ? 'es' : '';
      if (k === 'brand' && /^(admira|off|none)$/i.test(v)) v = '';
      if (v) out[k] = v;
    }
    return out;
  }
  // Nivel de la cara: elección explícita del usuario en esta pestaña (/avatar good|better|best)
  // > nivel que pide la página (p. ej. el gemelo: Good 8 bits → good, Better 16 → better,
  // Best 32 y Matrix 64 → best) > último nivel guardado > good.
  function pickLevel(explicit, page, stored) {
    return LEVELS[explicit] ? explicit : LEVELS[page] ? page : LEVELS[stored] ? stored : 'good';
  }
  var TIER_AVATAR = { good: 'admirito', better: 'luna', best: 'neo' };
  function levelUrl(level, ctx) {
    var lv = LEVELS[level] ? level : 'good';
    var c = cleanContext(ctx), q = [];
    for (var i = 0; i < CTX_KEYS.length; i++) if (c[CTX_KEYS[i]]) q.push(CTX_KEYS[i] + '=' + encodeURIComponent(c[CTX_KEYS[i]]));
    q.push('tier=' + lv);
    q.push('avatar=' + (TIER_AVATAR[lv] || 'luna'));
    return LEVELS[lv] + '&' + q.join('&');
  }

  // Pastilla de categoría (Carlos, 7-oct-2026): pulsar sube avatar → human → metahuman → avatar;
  // deslizar/→ sube uno, deslizar/← baja uno (también cíclico).
  var CYCLE = ['good', 'better', 'best'];
  var CATEGORY_NAME = {good: ['AVATAR', 'Admirito'], better: ['HUMAN', 'Luna'], best: ['METAHUMAN', 'Neo']};
  function nextLevel(level, dir) {
    var i = CYCLE.indexOf(LEVELS[level] ? level : 'good');
    if (i < 0) i = 0;
    var n = CYCLE.length;
    return CYCLE[((i + (dir < 0 ? -1 : 1)) % n + n) % n];
  }
  function categoryLabel(level) {
    var c = CATEGORY_NAME[level] || CATEGORY_NAME.good;
    return c[0] + ' · ' + c[1];
  }

  var api = {decide: decide, nextLevel: nextLevel, categoryLabel: categoryLabel, resolve: resolve, legacyValue: legacyValue, message: message,
    clampPanelSize: clampPanelSize, panelSizeAfterDrag: panelSizeAfterDrag, cleanContext: cleanContext, levelUrl: levelUrl, pickLevel: pickLevel,
    KEY: KEY, LEVEL_KEY: LEVEL_KEY, SIZE_KEY: SIZE_KEY, LEVELS: LEVELS, FLAGS_URL: FLAGS_URL, CENTRAL_BRAIN: CENTRAL_BRAIN};
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
    style.textContent = '#da-suite{right:16px !important;bottom:var(--da-lift,20px) !important;top:auto !important;z-index:25 !important}';
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
    if (!resizing) fitPanel();
  }
  var liftTimer = null;
  function watchLift() {
    ensureLift();
    applyLift();
    root.addEventListener('resize', applyLift);
    // Las barras se abren y cierran sin avisar: se reajusta con un sondeo barato.
    if (!liftTimer) liftTimer = root.setInterval(applyLift, 1500);
  }

  // ─── Panel: una sola cara, la de digitalavatar.ai, en un iframe ───
  function node() { return doc.getElementById('da-suite'); }
  function visible() { var n = node(); return !!n && n.style.display !== 'none' && n.classList.contains('open'); }
  // Admirito está «presente» si la burbuja (o el panel) se ve, abierto o no.
  function present() { var n = node(); return !!n && n.style.display !== 'none'; }
  function storedLevel() {
    var v = get(LEVEL_KEY);
    return LEVELS[v] ? v : 'good';
  }
  var CHOICE_KEY = 'admira-avatar:nivel-elegido';   // sessionStorage: solo /avatar <nivel>
  function explicitLevel() { var s = session(); try { var v = s && s.getItem(CHOICE_KEY); return LEVELS[v] ? v : ''; } catch (_) { return ''; } }
  function pageTier() {
    var t = CTX.tier;
    if (!LEVELS[t]) { var g = root.AdmiraAvatarContext; t = g && typeof g === 'object' ? g.tier : ''; }
    t = CATEGORY_LEVEL[t] || t;
    return LEVELS[t] ? t : '';
  }
  function currentLevel() { return pickLevel(explicitLevel(), pageTier(), get(LEVEL_KEY)); }
  var resizing = null;
  function viewBox() {
    var top = 64;
    var bar = doc.getElementById('topBar') || doc.querySelector('.yk-bar');
    if (bar && bar.getBoundingClientRect) {
      var edge = bar.getBoundingClientRect().bottom;
      if (isFinite(edge)) top = Math.max(64, Math.round(edge) + 8);
    }
    var raw = doc.documentElement.style.getPropertyValue('--da-lift') || '';
    var lift = parseInt(raw, 10);
    var bottom = isFinite(lift) ? lift : 20;
    doc.documentElement.style.setProperty('--da-top', top + 'px');
    return {w: root.innerWidth || 1280, h: root.innerHeight || 800, top: top, bottom: bottom};
  }
  function readSize() {
    try { var s = JSON.parse(get(SIZE_KEY) || 'null'); if (s && isFinite(s.w) && isFinite(s.h)) return s; } catch (e) {}
    return null;
  }
  function fitPanel() {
    var panel = doc.getElementById('da-suite-panel');
    if (!panel || resizing) return;
    var stored = readSize();
    var s = clampPanelSize(stored && stored.w, stored && stored.h, viewBox());
    panel.style.width = s.w + 'px';
    panel.style.height = s.h + 'px';
    if (stored && (stored.w !== s.w || stored.h !== s.h)) set(SIZE_KEY, JSON.stringify(s));
  }
  function bindResize(handle) {
    function frameEl() { return doc.getElementById('da-suite-frame'); }
    function releasePointer() {
      var frame = frameEl();
      if (frame) frame.style.removeProperty('pointer-events');
      var wrap = node();
      if (wrap) wrap.classList.remove('da-resizing');
    }
    function end(e) {
      if (!resizing || (e && e.pointerId != null && e.pointerId !== resizing.id)) return;
      var panel = doc.getElementById('da-suite-panel');
      if (panel) {
        var rect = panel.getBoundingClientRect();
        var s = clampPanelSize(rect.width, rect.height, viewBox());
        panel.style.width = s.w + 'px';
        panel.style.height = s.h + 'px';
        set(SIZE_KEY, JSON.stringify(s));
      }
      releasePointer();
      resizing = null;
    }
    handle.addEventListener('pointerdown', function (e) {
      if (e.button != null && e.button !== 0) return;
      var panel = doc.getElementById('da-suite-panel');
      if (!panel) return;
      var rect = panel.getBoundingClientRect();
      resizing = {id: e.pointerId, x: e.clientX, y: e.clientY, w: rect.width, h: rect.height};
      var frame = frameEl();
      if (frame) frame.style.setProperty('pointer-events', 'none');
      var wrap = node();
      if (wrap) wrap.classList.add('da-resizing');
      try { handle.setPointerCapture(e.pointerId); } catch (err) {}
      e.preventDefault();
    });
    handle.addEventListener('pointermove', function (e) {
      if (!resizing || e.pointerId !== resizing.id) return;
      var s = panelSizeAfterDrag({w: resizing.w, h: resizing.h}, {x: e.clientX, y: e.clientY}, {x: resizing.x, y: resizing.y}, viewBox());
      var panel = doc.getElementById('da-suite-panel');
      if (panel) {
        panel.style.width = s.w + 'px';
        panel.style.height = s.h + 'px';
      }
      e.preventDefault();
    });
    handle.addEventListener('pointerup', end);
    handle.addEventListener('pointercancel', end);
  }
  // Mascota: la nube del imagotipo de Admira (contorno #689840 de admira-logo_green.svg) en cartoon,
  // con ojos, mejillas y sonrisa; parpadea y bota al pasar el ratón (sin movimiento si reduced-motion).
  var NUBE = '<svg class="da-nube" viewBox="-6 6 289 186" width="62" height="40" aria-hidden="true" focusable="false" xmlns="http://www.w3.org/2000/svg"><g class="da-nube-cuerpo"><path d="M213.31,59.13c-1,0-1.9.1-2.85.15a83,83,0,0,0-144,0c-1-.05-1.89-.15-2.85-.15A58.22,58.22,0,1,0,90.81,168.79a82.72,82.72,0,0,0,95.29,0A58.21,58.21,0,1,0,213.31,59.13Z" fill="#f3f9e8"/><path d="M213.31,59.13c-1,0-1.9.1-2.85.15a83,83,0,0,0-144,0c-1-.05-1.89-.15-2.85-.15A58.22,58.22,0,1,0,90.81,168.79a82.72,82.72,0,0,0,95.29,0A58.21,58.21,0,1,0,213.31,59.13Zm0,99.81a41.75,41.75,0,0,1-28.06-11,67.09,67.09,0,0,1-13.39,10.21,65.93,65.93,0,0,1-66.81,0A67.09,67.09,0,0,1,91.66,148,41.56,41.56,0,1,1,59,76a43.33,43.33,0,0,1,4.58-.26A41.39,41.39,0,0,1,76.11,77.7a66.43,66.43,0,0,1,124.69,0,41.39,41.39,0,0,1,12.51-1.93,43.33,43.33,0,0,1,4.58.26,41.58,41.58,0,0,1-4.58,82.91Z" fill="#689840"/><ellipse cx="92" cy="138" rx="15" ry="9" fill="#f5a3a3" opacity=".75"/><ellipse cx="185" cy="138" rx="15" ry="9" fill="#f5a3a3" opacity=".75"/><g class="da-nube-ojos"><ellipse cx="111" cy="110" rx="12.5" ry="17" fill="#1d2b12"/><ellipse cx="166" cy="110" rx="12.5" ry="17" fill="#1d2b12"/><circle cx="115.5" cy="103" r="5" fill="#fff"/><circle cx="170.5" cy="103" r="5" fill="#fff"/></g><path class="da-nube-boca" d="M122,135 Q138.5,153 155,135" fill="none" stroke="#1d2b12" stroke-width="8" stroke-linecap="round"/><path class="da-nube-risa" d="M121,131 Q138.5,162 156,131 Z" fill="#1d2b12" stroke="#1d2b12" stroke-width="4" stroke-linejoin="round"/><path class="da-nube-risa" d="M129,145 Q138.5,154 148,145 Q138.5,141 129,145Z" fill="#e8706f"/></g></svg>';
  function ensureDock() {
    if (node()) return node();
    watchLift();
    var wrap = doc.createElement('div');
    wrap.id = 'da-suite';
    wrap.setAttribute('style', 'position:fixed;right:16px;bottom:20px;z-index:25;font-family:ui-monospace,SFMono-Regular,Menlo,monospace');
    wrap.innerHTML = '<button type="button" id="da-suite-bubble" title="' + (en() ? 'Digital avatar' : 'Avatar digital') + '" style="width:64px;height:64px;padding:0;border-radius:50%;border:0;background:transparent;cursor:pointer">' + NUBE + '</button>'
      + '<div id="da-suite-panel" style="position:relative;box-sizing:border-box;background:#05080f;border:1px solid rgba(120,243,255,.35);border-radius:16px;overflow:hidden;box-shadow:0 20px 60px rgba(0,0,0,.55);flex-direction:column">'
      + '<div style="display:flex;align-items:center;justify-content:space-between;padding:6px 10px 6px 48px;color:#dff8ff;font-size:11px;letter-spacing:.12em"><button type="button" id="da-suite-label" class="da-pill"><span class="da-pill-txt">AVATAR · Admirito</span><span class="da-pill-chev" aria-hidden="true">›</span></button><button type="button" id="da-suite-x" style="background:none;border:0;color:#75aab9;cursor:pointer;font-size:15px">✕</button></div>'
      + '<iframe id="da-suite-frame" title="Avatar digital" style="flex:1;width:100%;min-height:0;border:0;background:#05080f" allow="autoplay; microphone; camera; fullscreen" referrerpolicy="no-referrer-when-downgrade"></iframe>'
      + '<button type="button" id="da-suite-resize" aria-label="' + (en() ? 'Resize avatar' : 'Redimensionar el avatar') + '"></button></div>';
    doc.body.appendChild(wrap);
    var style = doc.getElementById('admira-avatar-open');
    if (!style) {
      style = doc.createElement('style');
      style.id = 'admira-avatar-open';
      style.textContent = '#da-suite-panel{display:none}#da-suite.open #da-suite-bubble{display:none}#da-suite.open #da-suite-panel{display:flex}'
        + '#da-suite-bubble{display:grid;place-items:center}#da-suite.open #da-suite-bubble{display:none}'
        + '#da-suite-bubble .da-nube{display:block;overflow:visible;filter:drop-shadow(0 3px 6px rgba(0,0,0,.35))}'
        + '#da-suite-bubble .da-nube-cuerpo{transform-box:fill-box;transform-origin:50% 100%}'
        + '#da-suite-bubble .da-nube-ojos{transform-box:fill-box;transform-origin:50% 50%;animation:da-parpadeo 5s infinite}'
        + '#da-suite-bubble .da-nube-risa{opacity:0;transition:opacity .15s}'
        + '#da-suite-bubble .da-nube-boca{transition:opacity .15s}'
        + '#da-suite-bubble:hover .da-nube-risa,#da-suite-bubble:focus-visible .da-nube-risa{opacity:1}'
        + '#da-suite-bubble:hover .da-nube-boca,#da-suite-bubble:focus-visible .da-nube-boca{opacity:0}'
        + '#da-suite-bubble:hover .da-nube-cuerpo{animation:da-bote .6s ease-out}'
        + '#da-suite-bubble:focus-visible{outline:2px solid #689840;outline-offset:2px}'
        + '@keyframes da-parpadeo{0%,92%,100%{transform:scaleY(1)}95%{transform:scaleY(.1)}}'
        + '@keyframes da-bote{0%{transform:translateY(0) scale(1,1)}30%{transform:translateY(-14%) scale(.97,1.04)}55%{transform:translateY(0) scale(1.05,.94)}75%{transform:translateY(-4%) scale(1,1)}100%{transform:translateY(0) scale(1,1)}}'
        + '@media (prefers-reduced-motion:reduce){#da-suite-bubble .da-nube-ojos,#da-suite-bubble:hover .da-nube-cuerpo{animation:none}}'
        + '#da-suite-panel{max-width:calc(100vw - 32px);max-height:calc(100vh - var(--da-top,64px) - var(--da-lift,20px))}'
        + '#da-suite-frame{position:relative;z-index:1}'
        + '#da-suite-resize{position:absolute;left:0;top:0;width:44px;height:44px;padding:0;border:0;background:transparent;cursor:nwse-resize;touch-action:none;z-index:6}'
        + '#da-suite-resize:before{content:"";position:absolute;left:8px;top:8px;width:14px;height:14px;border-left:2px solid rgba(120,243,255,.9);border-top:2px solid rgba(120,243,255,.9)}'
        + '#da-suite.da-resizing{z-index:2147483646 !important}'
        + '.da-pill{display:inline-flex;align-items:center;gap:6px;padding:4px 10px;border-radius:999px;border:1px solid rgba(120,243,255,.45);background:rgba(120,243,255,.08);color:#dff8ff;font:600 11px/1 ui-monospace,SFMono-Regular,Menlo,monospace;letter-spacing:.1em;cursor:pointer;touch-action:pan-y;user-select:none;transition:background .15s,border-color .15s}'
        + '.da-pill:hover,.da-pill:focus-visible{background:rgba(120,243,255,.18);border-color:#78f3ff;outline:none}'
        + '.da-pill-chev{font-size:14px;opacity:.75;transition:transform .2s}.da-pill:hover .da-pill-chev{transform:translateX(2px)}'
        + '#da-suite-frame{transition:opacity .22s ease}#da-suite.da-fading #da-suite-frame{opacity:0}'
        + '@media (prefers-reduced-motion:reduce){#da-suite-frame{transition:none}}';
      (doc.head || doc.documentElement).appendChild(style);
    }
    fitPanel();
    bindResize(wrap.querySelector('#da-suite-resize'));
    wrap.querySelector('#da-suite-frame').addEventListener('load', postContext);
    wrap.querySelector('#da-suite-bubble').addEventListener('click', function () { requestOpen(currentLevel()); });
    // El idioma de la página manda: si cambia, la cara recibe el nuevo (chips e idioma de respuesta).
    try { new MutationObserver(postContext).observe(doc.documentElement, {attributes: true, attributeFilter: ['lang']}); } catch (_) {}
    root.addEventListener('storage', function (e) { if (e && e.key === 'admiranext_expert_lang') postContext(); });
    wrap.querySelector('#da-suite-x').addEventListener('click', function () { wrap.classList.remove('open'); });
    bindPill(wrap.querySelector('#da-suite-label'));
    return wrap;
  }
  function paintPill(lv) {
    var pill = doc.getElementById('da-suite-label');
    if (!pill) return;
    var txt = pill.querySelector('.da-pill-txt');
    if (txt) txt.textContent = categoryLabel(lv);
    var tip = en() ? 'Tap to change avatar (swipe or ←/→)' : 'Pulsa para cambiar de avatar (desliza o ←/→)';
    pill.title = tip;
    pill.setAttribute('aria-label', categoryLabel(lv) + ' — ' + tip);
  }
  // Elección por la pastilla = misma memoria que /avatar <categoría> (localStorage + pestaña).
  function chooseLevel(lv) {
    if (!LEVELS[lv]) return;
    set(LEVEL_KEY, lv);
    var ss = session(); try { if (ss) ss.setItem(CHOICE_KEY, lv); } catch (_) {}
    set(KEY, 'on');
    var wrap = node();
    if (!wrap || !visible()) { show(true, lv); return; }
    paintPill(lv);
    wrap.classList.add('da-fading');
    root.setTimeout(function () {
      openLevel(lv);
      var frame = wrap.querySelector('#da-suite-frame');
      var done = function () { wrap.classList.remove('da-fading'); };
      if (frame) frame.addEventListener('load', done, {once: true});
      root.setTimeout(done, 1500);
    }, 200);
  }
  function stepLevel(dir) { chooseLevel(nextLevel(openedLevel || currentLevel(), dir)); }
  function bindPill(pill) {
    if (!pill) return;
    var start = null, swiped = false;
    pill.addEventListener('pointerdown', function (e) { start = {x: e.clientX, y: e.clientY}; swiped = false; });
    pill.addEventListener('pointerup', function (e) {
      if (!start) return;
      var dx = e.clientX - start.x, dy = e.clientY - start.y;
      start = null;
      if (Math.abs(dx) > 24 && Math.abs(dx) > Math.abs(dy)) { swiped = true; stepLevel(dx > 0 ? 1 : -1); }
    });
    pill.addEventListener('pointercancel', function () { start = null; });
    pill.addEventListener('click', function (e) { e.preventDefault(); if (swiped) { swiped = false; return; } stepLevel(1); });
    pill.addEventListener('keydown', function (e) {
      if (e.key === 'ArrowRight' || e.key === 'ArrowUp') { e.preventDefault(); stepLevel(1); }
      else if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') { e.preventDefault(); stepLevel(-1); }
    });
  }
  var DA_ORIGIN = 'https://digitalavatar.ai';
  var CTX = {};
  var openedLevel = '';
  // Por defecto: ?loc de la página, idioma de ⌘ Experto (admiranext_expert_lang) o del
  // documento, marca blanca de la pestaña (mb:marca), data-loc/data-sector del script y
  // window.AdmiraAvatarContext. setContext() manda sobre todo eso.
  function defaultContext() {
    var c = {};
    try { var q = new URLSearchParams(root.location.search); if (q.get('loc')) c.loc = q.get('loc'); } catch (_) {}
    c.lang = get('admiranext_expert_lang') || String(doc.documentElement.lang || '').slice(0, 2);
    var s = session(); try { var m = s && s.getItem('mb:marca'); if (m) c.brand = m; } catch (_) {}
    if (data.loc) c.loc = data.loc;
    if (data.sector) c.sector = data.sector;
    var g = root.AdmiraAvatarContext;
    if (g && typeof g === 'object') for (var k in g) if (Object.prototype.hasOwnProperty.call(g, k)) c[k] = g[k];
    return c;
  }
  function context() {
    var c = defaultContext();
    for (var k in CTX) if (Object.prototype.hasOwnProperty.call(CTX, k)) { if (CTX[k] == null || CTX[k] === '') delete c[k]; else c[k] = CTX[k]; }
    return cleanContext(c);
  }
  function postContext() {
    var n = node(), frame = n && n.querySelector('#da-suite-frame');
    if (!frame || !frame.contentWindow || !frame.getAttribute('src')) return;
    var msg = context(); msg.type = 'da-context'; msg.tier = openedLevel || currentLevel();
    try { frame.contentWindow.postMessage(msg, DA_ORIGIN); } catch (_) {}
  }
  function setContext(partial) {
    if (partial && typeof partial === 'object') for (var k in partial) if (Object.prototype.hasOwnProperty.call(partial, k) && (CTX_KEYS.indexOf(k) >= 0 || k === 'tier')) CTX[k] = partial[k];
    // Si la página cambia de nivel (p. ej. el gemelo pasa a Matrix) y el usuario no eligió uno,
    // el panel abierto cambia de cara; si no, el contexto viaja por postMessage.
    var lv = currentLevel();
    if (visible() && openedLevel && lv !== openedLevel) openLevel(lv); else postContext();
    return context();
  }
  function openLevel(level) {
    var wrap = ensureDock();
    var frame = wrap.querySelector('#da-suite-frame');
    var lv = LEVELS[level] ? level : 'good';
    // Cambiar de nivel recarga la cara; con el mismo nivel, el contexto viaja por postMessage.
    if (!frame.getAttribute('src') || openedLevel !== lv) { openedLevel = lv; frame.setAttribute('src', levelUrl(lv, context())); }
    else postContext();
    paintPill(lv);
    wrap.style.display = '';
    wrap.classList.add('open');
    applyLift();
  }
  // Antes de abrir el panel por orden del usuario se emite 'admira-avatar:open' (cancelable) en
  // window: una página con su propio avatar en escena (p. ej. el gemelo en Matrix, que lo proyecta
  // en la pared) puede llevarlo allí con preventDefault() y el panel no se abre.
  function requestOpen(level) {
    var lv = LEVELS[level] ? level : 'good';
    try {
      if (typeof root.CustomEvent === 'function' && root.dispatchEvent) {
        var ev = new root.CustomEvent('admira-avatar:open', {cancelable: true, detail: {level: lv, context: context()}});
        if (!root.dispatchEvent(ev)) { var n = node(); if (n) { n.style.display = ''; n.classList.remove('open'); } return false; }
      }
    } catch (_) {}
    openLevel(lv);
    return true;
  }
  function show(open, level) {
    var lv = LEVELS[level] ? level : currentLevel();
    if (LEVELS[level]) set(LEVEL_KEY, lv);
    ensureDock();
    if (open) requestOpen(lv);
    else {
      var n = node();
      if (n) { n.style.display = ''; n.classList.remove('open'); }
      applyLift();
    }
    return Promise.resolve(true);
  }
  function hide() {
    var n = node();
    if (n) { n.classList.remove('open'); n.style.display = 'none'; var frame = n.querySelector('iframe'); if (frame) frame.removeAttribute('src'); openedLevel = ''; }
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
    if (mode === 'status') {
      var now = currentLevel();
      var seen = visible() ? (english ? 'open' : 'abierto') : (english ? 'hidden' : 'oculto');
      return message('status', english) + (english ? ' Now: ' : ' Ahora: ') + categoryLabel(now) + ' · ' + seen + '.';
    }
    if (mode === 'reset') {
      set(KEY, null);
      projectFlag().then(function (flag) { if (flag) show(false); else hide(); });
      return message(readCache() ? 'reset-on' : 'reset-off', english);
    }
    if (LEVELS[mode]) {
      set(LEVEL_KEY, mode);
      var ss = session(); try { if (ss) ss.setItem(CHOICE_KEY, mode); } catch (_) {}
      set(KEY, 'on');
      show(true, mode);
      return message(mode, english);
    }
    if (mode === 'mascota') {
      var vis = !present();
      set(KEY, vis ? 'on' : 'off');
      if (vis) show(false); else hide();
      return message(vis ? 'mascota-on' : 'mascota-off', english);
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
    return {override: override(), visible: visible(), present: present(), level: currentLevel(), host: host, brain: brainUrl(), context: context()};
  }

  root.AdmiraAvatar = {run: run, handle: handle, next: function () { stepLevel(1); }, prev: function () { stepLevel(-1); }, decide: decide, show: show, hide: hide, state: state, setContext: setContext, context: context,
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
