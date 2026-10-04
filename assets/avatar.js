/* AdmiraNeXT · avatar digital compartido (cargador único de la red).
 *
 * Una sola fuente para todos los sitios: https://www.admiranext.com/assets/avatar.js
 * La cara y la voz no se copian: el panel abre la demo viva de digitalavatar.ai
 * (micro, texto, ElevenLabs por brain.digitalavatar.ai, cortar, estados).
 *
 *   /avatar good    el calvo — cara 3D facecap.glb, 52 blendshapes (better.html)
 *   /avatar better  la chica — Ready Player Me con gafas (best.html)
 *   /avatar best    Neo — MetaHuman por Pixel Streaming (metahuman.html),
 *                   solo si este navegador recibe el vídeo. Si el stream no
 *                   llega (host apagado, o el WebRTC solo tiene candidatos de
 *                   la red local), en pocos segundos entra la chica.
 *   /avatar         estado y las tres opciones
 *   /avatarON /avatarOFF   muestran u ocultan el panel y lo recuerdan
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
    good: 'https://digitalavatar.ai/better.html?dock=1',
    better: 'https://digitalavatar.ai/best.html?dock=1&kiosk=0',
    best: 'https://digitalavatar.ai/metahuman.html?dock=1'
  };
  var KEY = 'admira-avatar:override';
  var LEVEL_KEY = 'admira-avatar:nivel';
  var SIZE_KEY = 'admira-avatar:size';
  // metahuman.html?dock=1 (digitalavatar.ai 1f5d1be) no cambia de cara: con el
  // stream apagado se queda en negro y con la chapa «EN VIVO». El HTTP :8443
  // responde igual (el sondeo del favicon da falso positivo) porque el vídeo
  // solo anuncia candidatos ICE de la LAN y de Tailscale.
  var NEO_WS = 'wss://macbook-pro-16.tail48b61c.ts.net:8443/';
  var NEO_PROBE_MS = 4000;
  var CACHE = 'admira-avatar:flags';
  var CACHE_MS = 60000;
  var TIMEOUT_MS = 2500;
  var ON = /^(on|encender|mostrar|show|abrir|open)$/i;
  var OFF = /^(off|apagar|ocultar|hide|cerrar|close)$/i;
  var RESET = /^(reset|auto|proyecto|project|default)$/i;

  // ─── Piezas puras (se prueban en node: test/avatar-loader.test.mjs) ───
  // null si el texto no es un comando del avatar.
  // 'on' | 'off' | 'toggle' | 'reset' | 'status' | 'good' | 'better' | 'best' | 'bad'.
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
    var arg = (rest[0] || '').toLowerCase();
    if (!arg) return verb === 'cli' ? 'toggle' : 'status';
    if (ON.test(arg)) return 'on';
    if (OFF.test(arg)) return 'off';
    if (RESET.test(arg)) return 'reset';
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
    if (kind === 'good') return en ? 'Avatar good: the bald 3D face (facecap, 52 blendshapes).' : 'Avatar good: el calvo, cara 3D (facecap, 52 blendshapes).';
    if (kind === 'better') return en ? 'Avatar better: the web girl (Ready Player Me, glasses).' : 'Avatar better: la chica web (Ready Player Me, gafas).';
    if (kind === 'best') return en ? 'Avatar best: Neo, MetaHuman. If the render host is off, the girl takes over.' : 'Avatar best: Neo, MetaHuman. Si el host de render está apagado, entra la chica.';
    if (kind === 'status') return en
      ? 'Digital avatar. /avatar good · bald 3D face. /avatar better · web girl with glasses. /avatar best · Neo (falls back to the girl). /avatarON shows it, /avatarOFF hides it.'
      : 'Avatar digital. /avatar good · el calvo (cara 3D). /avatar better · la chica web con gafas. /avatar best · Neo (si el render está apagado, la chica). /avatarON lo muestra, /avatarOFF lo oculta.';
    if (kind === 'reset-on') return en ? 'Digital avatar follows the project switch (on)' : 'El avatar sigue el interruptor del proyecto (encendido)';
    if (kind === 'reset-off') return en ? 'Digital avatar follows the project switch (off)' : 'El avatar sigue el interruptor del proyecto (apagado)';
    return en
      ? 'Use /avatar good, /avatar better or /avatar best. /avatar alone shows the status. /avatarON and /avatarOFF show or hide it.'
      : 'Usa /avatar good, /avatar better o /avatar best. /avatar solo muestra el estado. /avatarON y /avatarOFF lo muestran o lo ocultan.';
  }

  // Tamaño del panel. El asa está en la esquina superior izquierda: el panel
  // sigue anclado abajo a la derecha, así que arrastrar hacia arriba-izquierda agranda.
  function clampPanelSize(w, h, view) {
    var vw = view && isFinite(view.w) ? view.w : 1280;
    var vh = view && isFinite(view.h) ? view.h : 800;
    var lift = view && isFinite(view.lift) ? view.lift : 0;
    var maxW = Math.min(920, Math.max(200, vw - 24));
    var maxH = Math.min(1000, Math.max(200, vh - lift - 16));
    var minW = Math.min(300, maxW);
    var minH = Math.min(460, maxH);
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

  // best solo abre metahuman.html si el stream llegó de verdad. Si no, la chica
  // con dock=1 (sin barra) y kiosk=0 (la consola se queda; en un iframe estrecho
  // el modo kiosco de best.html la ocultaría).
  function faceChoice(level, neoUp) {
    if (level === 'best') {
      if (neoUp === true) return {label: 'best', url: LEVELS.best, fallback: false};
      return {label: 'best', url: LEVELS.better, fallback: true};
    }
    var lv = LEVELS[level] ? level : 'good';
    return {label: lv, url: LEVELS[lv], fallback: false};
  }

  // 'neo' si el vídeo llega, 'girl' si ya se sabe que no, 'wait' si aún cabe esperar.
  function neoVerdict(s) {
    s = s || {};
    if (s.transportError) return 'girl';
    if (s.ids && !s.ids.length) return 'girl';
    var ice = s.ice || '';
    var conn = s.conn || '';
    if (ice === 'failed' || conn === 'failed') return 'girl';
    if (ice === 'connected' || ice === 'completed' || conn === 'connected') return 'neo';
    if (s.elapsed >= (s.timeout || NEO_PROBE_MS)) return 'girl';
    return 'wait';
  }

  // Promesa true solo si este cliente completa el WebRTC con el streamer.
  // opts permite inyectar WebSocket, RTCPeerConnection y temporizadores en los tests.
  function probeNeo(opts) {
    opts = opts || {};
    var timeout = opts.timeoutMs || NEO_PROBE_MS;
    var WS = opts.WebSocket || (typeof WebSocket === 'function' ? WebSocket : null);
    var PC = opts.RTCPeerConnection || (typeof RTCPeerConnection === 'function' ? RTCPeerConnection : null);
    var sched = opts.setTimeout || (root && root.setTimeout) || (typeof setTimeout === 'function' ? setTimeout : null);
    var clear = opts.clearTimeout || (root && root.clearTimeout) || (typeof clearTimeout === 'function' ? clearTimeout : function () {});
    var url = opts.url || NEO_WS;
    return new Promise(function (resolve) {
      var done = false, ws = null, pc = null, timer = null, t0 = Date.now();
      var snap = {ids: null, ice: '', conn: '', transportError: false, elapsed: 0, timeout: timeout};
      var pcOpts = {}, iceQueue = [], remoteSet = false;
      function finish(ok) {
        if (done) return;
        done = true;
        if (timer) clear(timer);
        try { if (pc) pc.close(); } catch (e) {}
        try { if (ws && ws.readyState === 1) ws.close(); } catch (e) {}
        resolve(!!ok);
      }
      function look() {
        snap.elapsed = Date.now() - t0;
        var v = neoVerdict(snap);
        if (v === 'neo') finish(true);
        else if (v === 'girl') finish(false);
      }
      function send(obj) {
        try { if (ws && ws.readyState === 1) ws.send(JSON.stringify(obj)); } catch (e) {}
      }
      if (!WS || !PC || !sched) { finish(false); return; }
      timer = sched(function () { look(); if (!done) finish(false); }, timeout);
      try { ws = new WS(url); }
      catch (e) { snap.transportError = true; finish(false); return; }
      ws.onerror = function () { if (!done && ws.readyState !== 1) { snap.transportError = true; look(); } };
      ws.onclose = function () { if (!done) { snap.transportError = true; look(); } };
      ws.onmessage = function (ev) {
        if (done) return;
        var msg; try { msg = JSON.parse(String(ev && ev.data || '')); } catch (e) { return; }
        if (!msg || !msg.type) return;
        if (msg.type === 'config') {
          pcOpts = msg.peerConnectionOptions || {};
          send({type: 'listStreamers'});
        } else if (msg.type === 'streamerList') {
          snap.ids = msg.ids || [];
          look();
          if (!done && snap.ids.length) send({type: 'subscribe', streamerId: snap.ids[0]});
        } else if (msg.type === 'offer' && msg.sdp) {
          startPc(msg.sdp);
        } else if (msg.type === 'iceCandidate' && msg.candidate) {
          takeIce(msg.candidate);
        } else if (msg.type === 'streamerDisconnected') {
          snap.ids = [];
          look();
        }
      };
      function takeIce(c) {
        if (!c) return;
        if (!pc || !remoteSet) { iceQueue.push(c); return; }
        try { var added = pc.addIceCandidate(c); if (added && typeof added.catch === 'function') added.catch(function () {}); } catch (e) {}
      }
      function startPc(sdp) {
        if (pc || done) return;
        try { pc = new PC(pcOpts); }
        catch (e) { snap.transportError = true; look(); return; }
        pc.oniceconnectionstatechange = function () { if (done || !pc) return; snap.ice = pc.iceConnectionState || ''; look(); };
        pc.onconnectionstatechange = function () { if (done || !pc) return; snap.conn = pc.connectionState || ''; look(); };
        pc.onicecandidate = function (ev) {
          if (done || !ev || !ev.candidate) return;
          send({type: 'iceCandidate', candidate: {
            candidate: ev.candidate.candidate,
            sdpMid: ev.candidate.sdpMid,
            sdpMLineIndex: ev.candidate.sdpMLineIndex
          }});
        };
        Promise.resolve(pc.setRemoteDescription({type: 'offer', sdp: sdp})).then(function () {
          if (done) return null;
          remoteSet = true;
          var queued = iceQueue; iceQueue = [];
          queued.forEach(takeIce);
          return pc.createAnswer();
        }).then(function (ans) {
          if (done || !ans) return null;
          return pc.setLocalDescription(ans);
        }).then(function () {
          if (done || !pc || !pc.localDescription) return;
          send({type: 'answer', sdp: pc.localDescription.sdp});
        }).catch(function () { if (!done) { snap.transportError = true; look(); } });
      }
    });
  }

  var api = {decide: decide, resolve: resolve, legacyValue: legacyValue, message: message,
    clampPanelSize: clampPanelSize, panelSizeAfterDrag: panelSizeAfterDrag, faceChoice: faceChoice, neoVerdict: neoVerdict, probeNeo: probeNeo,
    KEY: KEY, LEVEL_KEY: LEVEL_KEY, SIZE_KEY: SIZE_KEY, LEVELS: LEVELS, FLAGS_URL: FLAGS_URL, CENTRAL_BRAIN: CENTRAL_BRAIN,
    NEO_WS: NEO_WS, NEO_PROBE_MS: NEO_PROBE_MS};
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
  function storedLevel() {
    var v = get(LEVEL_KEY);
    return LEVELS[v] ? v : 'good';
  }
  var resizing = null;
  var neoTicket = 0;
  var neoCache = null;
  function viewBox() {
    var raw = doc.documentElement.style.getPropertyValue('--da-lift') || '';
    var lift = parseInt(raw, 10);
    return {w: root.innerWidth || 1280, h: root.innerHeight || 800, lift: isFinite(lift) ? lift : 20};
  }
  function readSize() {
    try { var s = JSON.parse(get(SIZE_KEY) || 'null'); if (s && isFinite(s.w) && isFinite(s.h)) return s; } catch (e) {}
    return null;
  }
  function fitPanel() {
    var panel = doc.getElementById('da-suite-panel');
    if (!panel || resizing) return;
    var s = clampPanelSize((readSize() || {}).w, (readSize() || {}).h, viewBox());
    panel.style.width = s.w + 'px';
    panel.style.height = s.h + 'px';
  }
  function setNote(text) {
    var n = doc.getElementById('da-suite-note');
    if (!n) return;
    n.textContent = text || '';
    n.style.display = text ? 'block' : 'none';
  }
  function bindResize(handle) {
    function end(e) {
      if (!resizing || (e && e.pointerId !== resizing.id)) return;
      var panel = doc.getElementById('da-suite-panel');
      var rect = panel.getBoundingClientRect();
      var s = clampPanelSize(rect.width, rect.height, viewBox());
      panel.style.width = s.w + 'px';
      panel.style.height = s.h + 'px';
      set(SIZE_KEY, JSON.stringify(s));
      resizing = null;
    }
    handle.addEventListener('pointerdown', function (e) {
      if (e.button != null && e.button !== 0) return;
      var panel = doc.getElementById('da-suite-panel');
      var rect = panel.getBoundingClientRect();
      resizing = {id: e.pointerId, x: e.clientX, y: e.clientY, w: rect.width, h: rect.height};
      try { handle.setPointerCapture(e.pointerId); } catch (err) {}
      e.preventDefault();
    });
    handle.addEventListener('pointermove', function (e) {
      if (!resizing || e.pointerId !== resizing.id) return;
      var s = panelSizeAfterDrag({w: resizing.w, h: resizing.h}, {x: e.clientX, y: e.clientY}, {x: resizing.x, y: resizing.y}, viewBox());
      var panel = doc.getElementById('da-suite-panel');
      panel.style.width = s.w + 'px';
      panel.style.height = s.h + 'px';
      e.preventDefault();
    });
    handle.addEventListener('pointerup', end);
    handle.addEventListener('pointercancel', end);
    handle.addEventListener('keydown', function (e) {
      var step = e.shiftKey ? 80 : 24;
      var dx = 0, dy = 0;
      if (e.key === 'ArrowLeft') dx = -step;
      else if (e.key === 'ArrowRight') dx = step;
      else if (e.key === 'ArrowUp') dy = -step;
      else if (e.key === 'ArrowDown') dy = step;
      else return;
      var panel = doc.getElementById('da-suite-panel');
      var rect = panel.getBoundingClientRect();
      var s = panelSizeAfterDrag({w: rect.width, h: rect.height}, {x: dx, y: dy}, {x: 0, y: 0}, viewBox());
      panel.style.width = s.w + 'px';
      panel.style.height = s.h + 'px';
      set(SIZE_KEY, JSON.stringify(s));
      e.preventDefault();
    });
  }
  function ensureDock() {
    if (node()) return node();
    watchLift();
    var wrap = doc.createElement('div');
    wrap.id = 'da-suite';
    wrap.setAttribute('style', 'position:fixed;right:16px;bottom:20px;z-index:25;font-family:ui-monospace,SFMono-Regular,Menlo,monospace');
    wrap.innerHTML = '<button type="button" id="da-suite-bubble" title="' + (en() ? 'Digital avatar' : 'Avatar digital') + '" style="width:64px;height:64px;border-radius:50%;border:1px solid rgba(120,243,255,.4);background:#0a1620;color:#78f3ff;font-size:26px;cursor:pointer;box-shadow:0 8px 30px rgba(0,0,0,.5)">🤖</button>'
      + '<div id="da-suite-panel" style="position:relative;box-sizing:border-box;background:#05080f;border:1px solid rgba(120,243,255,.35);border-radius:16px;overflow:hidden;box-shadow:0 20px 60px rgba(0,0,0,.55);flex-direction:column;max-width:calc(100vw - 24px);max-height:calc(100vh - var(--da-lift,20px) - 16px)">'
      + '<div style="display:flex;align-items:center;justify-content:space-between;gap:8px;padding:8px 10px 8px 28px;color:#dff8ff;font-size:11px;letter-spacing:.12em;text-transform:uppercase"><span id="da-suite-label">Avatar</span><button type="button" id="da-suite-x" style="background:none;border:0;color:#75aab9;cursor:pointer;font-size:15px">✕</button></div>'
      + '<div id="da-suite-note" style="display:none;padding:0 12px 8px 28px;color:#ffb454;font-size:11px;letter-spacing:0;text-transform:none;line-height:1.35"></div>'
      + '<iframe id="da-suite-frame" title="Avatar digital" style="flex:1;width:100%;min-height:0;border:0;background:#05080f" allow="autoplay; microphone; camera; fullscreen" referrerpolicy="no-referrer-when-downgrade"></iframe>'
      + '<button type="button" id="da-suite-resize" aria-label="' + (en() ? 'Resize avatar' : 'Redimensionar el avatar') + '"></button></div>';
    doc.body.appendChild(wrap);
    var style = doc.getElementById('admira-avatar-open');
    if (!style) {
      style = doc.createElement('style');
      style.id = 'admira-avatar-open';
      style.textContent = '#da-suite-panel{display:none}#da-suite.open #da-suite-bubble{display:none}#da-suite.open #da-suite-panel{display:flex}'
        + '#da-suite-resize{position:absolute;left:0;top:0;width:28px;height:28px;padding:0;border:0;background:transparent;cursor:nwse-resize;touch-action:none;z-index:3}'
        + '#da-suite-resize:before{content:"";position:absolute;left:7px;top:7px;width:12px;height:12px;border-left:2px solid rgba(120,243,255,.9);border-top:2px solid rgba(120,243,255,.9)}'
        + '#da-suite-resize:focus-visible{outline:2px solid #78f3ff;outline-offset:-2px}';
      (doc.head || doc.documentElement).appendChild(style);
    }
    fitPanel();
    bindResize(wrap.querySelector('#da-suite-resize'));
    if (!root.__daAvatarSized) {
      root.__daAvatarSized = true;
      root.addEventListener('resize', fitPanel);
    }
    wrap.querySelector('#da-suite-bubble').addEventListener('click', function () { openLevel(storedLevel()); });
    wrap.querySelector('#da-suite-x').addEventListener('click', function () { wrap.classList.remove('open'); });
    return wrap;
  }
  function paintFace(level, url) {
    var wrap = ensureDock();
    var frame = wrap.querySelector('#da-suite-frame');
    if (frame.getAttribute('src') !== url) frame.setAttribute('src', url);
    var label = wrap.querySelector('#da-suite-label');
    if (label) label.textContent = level;
    wrap.style.display = '';
    wrap.classList.add('open');
    applyLift();
    return wrap;
  }
  function neoReady() {
    if (neoCache && Date.now() - neoCache.t < (neoCache.ok ? 20000 : 8000)) return Promise.resolve(neoCache.ok);
    return probeNeo().then(function (ok) { neoCache = {t: Date.now(), ok: !!ok}; return !!ok; });
  }
  function openLevel(level) {
    var ticket = ++neoTicket;
    if (level !== 'best') {
      var direct = faceChoice(level, true);
      setNote('');
      paintFace(direct.label, direct.url);
      return;
    }
    if (neoCache && neoCache.ok && Date.now() - neoCache.t < 20000) {
      var live = faceChoice('best', true);
      setNote('');
      paintFace(live.label, live.url);
      return;
    }
    var wrap = ensureDock();
    wrap.style.display = '';
    wrap.classList.add('open');
    var label = wrap.querySelector('#da-suite-label');
    if (label) label.textContent = 'best';
    // No dejar puesta la consola de Neo (vídeo negro) mientras se comprueba el stream.
    var frame = wrap.querySelector('#da-suite-frame');
    if (frame && frame.getAttribute('src') === LEVELS.best) frame.removeAttribute('src');
    setNote(en() ? 'Checking whether Neo is live…' : 'Comprobando si Neo está en vivo…');
    applyLift();
    neoReady().then(function (ok) {
      if (ticket !== neoTicket) return;
      var n = node();
      if (!n || !n.classList.contains('open')) return;
      var choice = faceChoice('best', ok === true);
      paintFace(choice.label, choice.url);
      setNote(choice.fallback ? (en() ? 'Neo is unavailable, showing the girl' : 'Neo no disponible, mostrando a la chica') : '');
    });
  }
  function show(open, level) {
    var lv = LEVELS[level] ? level : storedLevel();
    set(LEVEL_KEY, lv);
    ensureDock();
    if (open) openLevel(lv);
    else {
      var n = node();
      if (n) { n.style.display = ''; n.classList.remove('open'); }
      applyLift();
    }
    return Promise.resolve(true);
  }
  function hide() {
    neoTicket++;
    setNote('');
    var n = node();
    if (n) { n.classList.remove('open'); n.style.display = 'none'; var frame = n.querySelector('iframe'); if (frame) frame.removeAttribute('src'); }
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
      var now = storedLevel();
      var seen = visible() ? (english ? 'open' : 'abierto') : (english ? 'hidden' : 'oculto');
      return message('status', english) + (english ? ' Now: ' : ' Ahora: ') + now + ' · ' + seen + '.';
    }
    if (mode === 'reset') {
      set(KEY, null);
      projectFlag().then(function (flag) { if (flag) show(false); else hide(); });
      return message(readCache() ? 'reset-on' : 'reset-off', english);
    }
    if (LEVELS[mode]) {
      set(LEVEL_KEY, mode);
      set(KEY, 'on');
      show(true, mode);
      return message(mode, english);
    }
    var on = mode === 'toggle' ? !visible() : mode === 'on';
    set(KEY, on ? 'on' : 'off');
    if (on) show(true, storedLevel()); else hide();
    return message(on ? 'on' : 'off', english);
  }
  function handle(text) {
    var out = run(text);
    return Promise.resolve(out == null ? message('bad', en()) : out);
  }
  function state() {
    return {override: override(), visible: visible(), level: storedLevel(), host: host, brain: brainUrl()};
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
