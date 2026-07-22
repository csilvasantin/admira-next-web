(function () {
  'use strict';

  var slides = Array.prototype.slice.call(document.querySelectorAll('.slide'));
  if (!slides.length || document.getElementById('admiraPresenterPanel')) return;

  var query = new URLSearchParams(location.search);
  var remoteMode = query.get('remote') === '1';
  var storageKey = 'admira.presenter.preferences.v1';
  var sessionSchema = 2;
  var sessionStorageKey = 'admira.presenter.session.v' + sessionSchema + ':' + location.pathname + (remoteMode ? ':remote' : ':stage');
  var channelName = 'admira-presenter:' + location.pathname;
  var startedAt = 0;
  var carriedSeconds = 0;
  var running = false;
  var currentIndex = nearestSlide();
  var promptPlaying = false;
  var promptFrame = 0;
  var lastPromptFrame = 0;
  var preferences = readPreferences();
  var durationMinutes = preferences.durationMinutes || Math.max(5, Math.ceil(slides.length * 0.75));
  var promptSize = preferences.promptSize || 24;
  var promptSpeed = preferences.promptSpeed || 1;
  var channel = typeof BroadcastChannel === 'function' ? new BroadcastChannel(channelName) : null;
  var generalNotes = String(window.__ADMIRA_PRESENTER_NOTES__ || '').trim();
  var recoveryState = readSession();
  var recoveryOffered = false;
  var lastPersistedAt = 0;
  var lastStageSignalAt = remoteMode ? 0 : Date.now();
  var cacheReady = false;
  var messageSequence = 0;
  var receivedMessageIds = [];

  var launch = document.createElement('button');
  launch.type = 'button';
  launch.id = 'admiraPresenterLaunch';
  launch.className = 'presenter-launch';
  launch.setAttribute('aria-controls', 'admiraPresenterPanel');
  launch.setAttribute('aria-expanded', 'false');
  launch.textContent = 'Ensayar';
  document.body.appendChild(launch);

  var panel = document.createElement('aside');
  panel.id = 'admiraPresenterPanel';
  panel.className = 'presenter-panel';
  panel.hidden = true;
  panel.setAttribute('aria-label', 'Modo presentador inteligente');
  panel.innerHTML =
    '<header class="presenter-head"><div><span>Ensayo inteligente</span><strong id="presenterSlideLabel">Diapositiva</strong></div>' +
    '<button type="button" id="presenterClose" aria-label="Cerrar modo presentador">×</button></header>' +
    '<div class="presenter-health"><span id="presenterConnection" class="is-online" role="status" aria-live="polite">● En línea</span><span id="presenterCacheState">Preparando modo offline…</span></div>' +
    '<section id="presenterRecovery" class="presenter-recovery" aria-labelledby="presenterRecoveryTitle" hidden><strong id="presenterRecoveryTitle">Sesión interrumpida disponible</strong><span id="presenterRecoverySummary"></span><div><button type="button" id="presenterResume">Reanudar exactamente</button><button type="button" id="presenterDiscard">Empezar de nuevo</button></div></section>' +
    '<div class="presenter-timing"><div><span>Tiempo</span><strong id="presenterClock" aria-live="off">00:00</strong></div>' +
    '<div><span>Ritmo</span><strong id="presenterPace" class="on-time" aria-live="polite">En ritmo</strong></div></div>' +
    '<div class="presenter-progress" aria-hidden="true"><i id="presenterProgress"></i></div>' +
    '<div class="presenter-controls" aria-label="Controles de navegación"><button type="button" data-presenter-command="prev">← Anterior</button><button type="button" data-presenter-command="next">Siguiente →</button></div>' +
    '<div class="presenter-controls compact"><button type="button" id="presenterTimerToggle">Iniciar tiempo</button><button type="button" id="presenterTimerReset">Reiniciar</button><button type="button" id="presenterFullscreen" aria-pressed="false">Pantalla completa</button><label>Duración <input id="presenterDuration" type="number" min="5" max="180" step="1" inputmode="numeric" aria-label="Duración prevista en minutos"> min</label></div>' +
    '<section class="presenter-prompt" aria-labelledby="presenterPromptTitle"><div class="presenter-prompt-head"><strong id="presenterPromptTitle">Notas del orador</strong><div><button type="button" id="presenterPromptSmaller" aria-label="Reducir texto">A−</button><button type="button" id="presenterPromptLarger" aria-label="Aumentar texto">A+</button></div></div>' +
    '<div id="presenterNotes" class="presenter-notes" tabindex="0"></div><div class="presenter-prompt-actions"><button type="button" id="presenterPromptToggle">▶ Teleprompter</button><label>Velocidad <input id="presenterPromptSpeed" type="range" min="1" max="3" step="1" aria-label="Velocidad del teleprompter"></label></div></section>' +
    '<div class="presenter-next"><span>Siguiente</span><strong id="presenterNextTitle">Fin de la presentación</strong></div>' +
    '<div class="presenter-remote"><button type="button" id="presenterRemoteOpen">Abrir control remoto ↗</button><span id="presenterRemoteState">Mismo navegador · canal privado local</span></div>';
  document.body.appendChild(panel);

  var closeButton = document.getElementById('presenterClose');
  var clock = document.getElementById('presenterClock');
  var pace = document.getElementById('presenterPace');
  var progress = document.getElementById('presenterProgress');
  var slideLabel = document.getElementById('presenterSlideLabel');
  var nextTitle = document.getElementById('presenterNextTitle');
  var notes = document.getElementById('presenterNotes');
  var timerToggle = document.getElementById('presenterTimerToggle');
  var durationInput = document.getElementById('presenterDuration');
  var promptToggle = document.getElementById('presenterPromptToggle');
  var speedInput = document.getElementById('presenterPromptSpeed');
  var remoteState = document.getElementById('presenterRemoteState');
  var connectionState = document.getElementById('presenterConnection');
  var cacheState = document.getElementById('presenterCacheState');
  var recoveryPanel = document.getElementById('presenterRecovery');
  var recoverySummary = document.getElementById('presenterRecoverySummary');
  var fullscreenButton = document.getElementById('presenterFullscreen');

  durationInput.value = String(durationMinutes);
  speedInput.value = String(promptSpeed);
  notes.style.fontSize = promptSize + 'px';

  function readPreferences() {
    try {
      var value = JSON.parse(localStorage.getItem(storageKey) || '{}');
      return {
        durationMinutes: Number(value.durationMinutes) ? clamp(Number(value.durationMinutes), 5, 180) : 0,
        promptSize: Number(value.promptSize) ? clamp(Number(value.promptSize), 17, 46) : 0,
        promptSpeed: Number(value.promptSpeed) ? clamp(Number(value.promptSpeed), 1, 3) : 0
      };
    } catch (_) { return {}; }
  }

  function savePreferences() {
    try {
      localStorage.setItem(storageKey, JSON.stringify({
        durationMinutes: durationMinutes,
        promptSize: promptSize,
        promptSpeed: promptSpeed
      }));
    } catch (_) {}
  }

  function deckFingerprint() {
    return slides.map(function (slide, index) {
      return slide.id || slide.getAttribute('data-block-id') || slide.getAttribute('data-deck-source') || slideTitle(slide) || String(index);
    }).join('|').slice(0, 4000);
  }

  function safeSession(value) {
    if (!value || value.schema !== sessionSchema || value.path !== location.pathname) return null;
    if (value.slideCount !== slides.length || value.fingerprint !== deckFingerprint()) return null;
    if (!Number.isFinite(Number(value.index)) || !Number.isFinite(Number(value.elapsed))) return null;
    return value;
  }

  function readSession() {
    try { return safeSession(JSON.parse(localStorage.getItem(sessionStorageKey) || 'null')); }
    catch (_) { return null; }
  }

  function mediaState() {
    return Array.prototype.slice.call(document.querySelectorAll('video,audio')).map(function (media, index) {
      var sourcePath = '';
      try { var sourceUrl = new URL(media.currentSrc || media.src || '', location.href); if (sourceUrl.origin === location.origin) sourcePath = sourceUrl.pathname; } catch (_) {}
      return {
        index: index,
        path: sourcePath,
        time: Number.isFinite(media.currentTime) ? media.currentTime : 0,
        paused: media.paused,
        muted: media.muted,
        volume: media.volume,
        rate: media.playbackRate
      };
    });
  }

  function persistSession(force) {
    if (recoveryState) return;
    var now = Date.now();
    if (!force && now - lastPersistedAt < 900) return;
    lastPersistedAt = now;
    try {
      localStorage.setItem(sessionStorageKey, JSON.stringify({
        schema: sessionSchema,
        path: location.pathname,
        fingerprint: deckFingerprint(),
        slideCount: slides.length,
        index: currentIndex,
        elapsed: elapsedSeconds(),
        running: running,
        savedAt: now,
        panelOpen: !panel.hidden,
        promptPlaying: promptPlaying,
        notesScrollTop: notes.scrollTop,
        fullscreen: Boolean(document.fullscreenElement),
        media: mediaState()
      }));
    } catch (_) {}
  }

  function clearSession() {
    recoveryState = null;
    recoveryPanel.hidden = true;
    try { localStorage.removeItem(sessionStorageKey); } catch (_) {}
  }

  function restoreMedia(items) {
    if (!Array.isArray(items)) return;
    var media = Array.prototype.slice.call(document.querySelectorAll('video,audio'));
    items.forEach(function (saved) {
      var target = media[Number(saved.index)];
      if (!target) return;
      if (saved.path) {
        try { if (new URL(target.currentSrc || target.src || '', location.href).pathname !== saved.path) return; } catch (_) { return; }
      }
      try {
        target.currentTime = Math.max(0, Number(saved.time) || 0);
        target.muted = Boolean(saved.muted);
        target.volume = Number.isFinite(Number(saved.volume)) ? clamp(Number(saved.volume), 0, 1) : 1;
        target.playbackRate = clamp(Number(saved.rate) || 1, 0.25, 4);
        if (!saved.paused) target.play().catch(function () {}); else target.pause();
      } catch (_) {}
    });
  }

  function offerRecovery() {
    if (!recoveryState || recoveryOffered) return;
    recoveryOffered = true;
    recoverySummary.textContent = 'Diapositiva ' + (Number(recoveryState.index) + 1) + ' · ' + formatTime(recoveryState.elapsed) + (recoveryState.running ? ' · temporizador activo' : ' · temporizador pausado');
    recoveryPanel.hidden = false;
  }

  function resumeSession() {
    var saved = recoveryState;
    if (!saved) return;
    currentIndex = clamp(Number(saved.index) || 0, 0, slides.length - 1);
    carriedSeconds = Math.max(0, Number(saved.elapsed) || 0);
    running = Boolean(saved.running);
    if (running && Number(saved.savedAt)) carriedSeconds += Math.max(0, (Date.now() - Number(saved.savedAt)) / 1000);
    startedAt = running ? Date.now() : 0;
    goLocal(currentIndex, true);
    notes.scrollTop = Math.max(0, Number(saved.notesScrollTop) || 0);
    restoreMedia(saved.media);
    if (saved.promptPlaying) startPrompt();
    if (saved.fullscreen && document.documentElement.requestFullscreen && !document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(function () {});
    }
    recoveryState = null;
    recoveryPanel.hidden = true;
    persistSession(true);
  }

  function resetSession() {
    clearSession();
    running = false;
    startedAt = 0;
    carriedSeconds = 0;
    currentIndex = nearestSlide();
    stopPrompt();
    Array.prototype.forEach.call(document.querySelectorAll('video,audio'), function (media) {
      try { media.pause(); media.currentTime = 0; } catch (_) {}
    });
    render();
    persistSession(true);
  }

  function setConnection(label, className) {
    connectionState.textContent = label;
    connectionState.className = className;
  }

  function offlineUrls() {
    var urls = [location.href, '/assets/presentation-presenter-mode.js?v=20260722-2', '/assets/presentation-presenter-mode.css?v=20260722-2'];
    document.querySelectorAll('img[src],video[src],audio[src],source[src],link[rel="stylesheet"][href]').forEach(function (node) {
      var value = node.src || node.href;
      try { var parsed = new URL(value, location.href); if (parsed.origin === location.origin) urls.push(parsed.href); } catch (_) {}
    });
    if (window.performance && performance.getEntriesByType) performance.getEntriesByType('resource').forEach(function (entry) {
      try { var parsed = new URL(entry.name, location.href); if (parsed.origin === location.origin) urls.push(parsed.href); } catch (_) {}
    });
    return urls.filter(function (value, index, all) { return all.indexOf(value) === index; });
  }

  function refreshOfflineCache() {
    if (!('serviceWorker' in navigator) || !window.isSecureContext) {
      cacheState.textContent = 'Caché offline no disponible';
      return Promise.resolve(false);
    }
    cacheState.textContent = 'Actualizando copia offline…';
    return navigator.serviceWorker.register('/presentation-presenter-sw.js', {scope: '/'}).then(function (registration) {
      return navigator.serviceWorker.ready.then(function () {
        var worker = registration.active || registration.waiting || registration.installing || navigator.serviceWorker.controller;
        if (!worker) throw new Error('service worker unavailable');
        var requestId = String(Date.now()) + Math.random().toString(16).slice(2);
        return new Promise(function (resolve) {
          var channel = new MessageChannel();
          var timeout = setTimeout(function () { resolve(false); }, 8000);
          channel.port1.onmessage = function (event) {
            if (!event.data || event.data.requestId !== requestId) return;
            clearTimeout(timeout);
            resolve(Boolean(event.data.ok));
          };
          worker.postMessage({type: 'ADMIRA_PRESENTATION_PRECACHE', requestId: requestId, urls: offlineUrls()}, [channel.port2]);
        });
      });
    }).then(function (ok) {
      cacheReady = ok;
      cacheState.textContent = navigator.onLine ? (ok ? 'Disponible offline' : 'Copia offline parcial') : (ok ? 'Usando copia offline' : 'Copia offline parcial');
      return ok;
    }).catch(function () {
      cacheState.textContent = navigator.onLine ? 'Copia offline parcial' : 'Sin red · recursos ya guardados';
      return false;
    });
  }

  function clamp(value, min, max) { return Math.max(min, Math.min(max, value)); }
  function nearestSlide() {
    var best = 0;
    var distance = Infinity;
    slides.forEach(function (slide, index) {
      var delta = Math.abs(slide.getBoundingClientRect().top);
      if (delta < distance) { distance = delta; best = index; }
    });
    return best;
  }

  function slideTitle(slide) {
    var title = slide && slide.querySelector('h1,h2,.deck-copy h2,.eyebrow,.num');
    return title ? title.textContent.trim() : 'Diapositiva';
  }

  function speakerNotes(slide, index) {
    if (!slide) return '';
    var explicit = slide.getAttribute('data-speaker-notes');
    if (explicit) return explicit;
    var parts = [];
    if (index === 0 && generalNotes) parts.push(generalNotes);
    ['.deck-kicker', 'h1', 'h2', '.message', '.detail', '.deck-detail', '.close strong', '.close span'].forEach(function (selector) {
      var node = slide.querySelector(selector);
      var text = node && node.textContent.trim();
      if (text && parts.indexOf(text) < 0) parts.push(text);
    });
    return parts.join('\n\n') || 'Sin notas específicas. Resume la idea principal y conecta con la siguiente diapositiva.';
  }

  function elapsedSeconds() {
    return carriedSeconds + (running && startedAt ? (Date.now() - startedAt) / 1000 : 0);
  }

  function formatTime(seconds) {
    seconds = Math.max(0, Math.floor(seconds));
    var minutes = Math.floor(seconds / 60);
    var rest = seconds % 60;
    return String(minutes).padStart(2, '0') + ':' + String(rest).padStart(2, '0');
  }

  function paceState(seconds) {
    if (!running && seconds === 0) return {label: 'Listo para ensayar', className: 'on-time'};
    var targetPerSlide = durationMinutes * 60 / Math.max(1, slides.length);
    var expected = currentIndex * targetPerSlide;
    var delta = seconds - expected;
    if (delta > targetPerSlide * 0.7) return {label: 'Acelera · +' + formatTime(delta), className: 'behind'};
    if (delta < -targetPerSlide * 0.7) return {label: 'Vas por delante · ' + formatTime(Math.abs(delta)), className: 'ahead'};
    return {label: 'En ritmo', className: 'on-time'};
  }

  function render() {
    var seconds = elapsedSeconds();
    var paceInfo = paceState(seconds);
    currentIndex = clamp(currentIndex, 0, slides.length - 1);
    clock.textContent = formatTime(seconds);
    pace.textContent = paceInfo.label;
    pace.className = paceInfo.className;
    progress.style.width = ((currentIndex + 1) / slides.length * 100).toFixed(2) + '%';
    slideLabel.textContent = 'Diapositiva ' + (currentIndex + 1) + ' de ' + slides.length + ' · ' + slideTitle(slides[currentIndex]);
    nextTitle.textContent = currentIndex + 1 < slides.length ? slideTitle(slides[currentIndex + 1]) : 'Fin de la presentación';
    if (notes.dataset.slide !== String(currentIndex)) {
      notes.dataset.slide = String(currentIndex);
      notes.textContent = speakerNotes(slides[currentIndex], currentIndex);
      notes.scrollTop = 0;
    }
    timerToggle.textContent = running ? 'Pausar tiempo' : (seconds ? 'Continuar tiempo' : 'Iniciar tiempo');
    broadcast({type: 'state', index: currentIndex, elapsed: seconds, running: running});
    persistSession(false);
  }

  function openPanel() {
    panel.hidden = false;
    launch.setAttribute('aria-expanded', 'true');
    document.documentElement.classList.add('presenter-active');
    render();
    offerRecovery();
    if (!remoteMode) closeButton.focus({preventScroll: true});
  }

  function closePanel() {
    panel.hidden = true;
    launch.setAttribute('aria-expanded', 'false');
    document.documentElement.classList.remove('presenter-active');
    stopPrompt();
    persistSession(true);
    launch.focus({preventScroll: true});
  }

  function goLocal(index, immediate) {
    currentIndex = clamp(index, 0, slides.length - 1);
    slides[currentIndex].scrollIntoView({behavior: immediate || matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth'});
    render();
  }

  function command(name) {
    var nextIndex = name === 'next' ? currentIndex + 1 : name === 'prev' ? currentIndex - 1 : currentIndex;
    if (!remoteMode) goLocal(nextIndex);
    broadcast({type: 'command', command: name, index: nextIndex});
  }

  function broadcast(payload) {
    payload.source = remoteMode ? 'remote' : 'stage';
    payload.messageId = payload.messageId || payload.source + ':' + Date.now() + ':' + (++messageSequence);
    if (channel) channel.postMessage(payload);
    try { localStorage.setItem(channelName, JSON.stringify(Object.assign({nonce: Date.now()}, payload))); } catch (_) {}
  }

  function receive(payload) {
    if (!payload || payload.source === (remoteMode ? 'remote' : 'stage')) return;
    if (payload.messageId && receivedMessageIds.indexOf(payload.messageId) >= 0) return;
    if (payload.messageId) {
      receivedMessageIds.push(payload.messageId);
      if (receivedMessageIds.length > 100) receivedMessageIds.shift();
    }
    if (payload.type === 'ready' && !remoteMode) { render(); return; }
    if (payload.type === 'command' && !remoteMode) {
      var requestedIndex = Number(payload.index);
      goLocal(Number.isFinite(requestedIndex) ? requestedIndex : (payload.command === 'next' ? currentIndex + 1 : currentIndex - 1));
    }
    if (payload.type === 'state' && remoteMode) {
      lastStageSignalAt = Date.now();
      currentIndex = clamp(Number(payload.index) || 0, 0, slides.length - 1);
      carriedSeconds = Math.max(0, Number(payload.elapsed) || 0);
      running = Boolean(payload.running);
      startedAt = running ? Date.now() : 0;
      remoteState.textContent = 'Conectado · diapositiva ' + (currentIndex + 1);
      setConnection('● Control conectado', 'is-online');
      render();
    }
  }

  function startPrompt() {
    promptPlaying = true;
    promptToggle.textContent = '❚❚ Pausar teleprompter';
    lastPromptFrame = performance.now();
    promptFrame = requestAnimationFrame(stepPrompt);
    persistSession(true);
  }

  function stopPrompt(skipPersist) {
    promptPlaying = false;
    promptToggle.textContent = '▶ Teleprompter';
    if (promptFrame) cancelAnimationFrame(promptFrame);
    promptFrame = 0;
    if (notes && !skipPersist) persistSession(true);
  }

  function stepPrompt(now) {
    if (!promptPlaying) return;
    var delta = Math.min(50, now - lastPromptFrame);
    lastPromptFrame = now;
    notes.scrollTop += delta * (0.012 + promptSpeed * 0.009);
    if (notes.scrollTop + notes.clientHeight >= notes.scrollHeight - 2) { stopPrompt(); return; }
    promptFrame = requestAnimationFrame(stepPrompt);
  }

  launch.addEventListener('click', function () { panel.hidden ? openPanel() : closePanel(); });
  closeButton.addEventListener('click', closePanel);
  panel.addEventListener('keydown', function (event) {
    if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); closePanel(); }
    else event.stopPropagation();
  });
  panel.querySelectorAll('[data-presenter-command]').forEach(function (button) {
    button.addEventListener('click', function () { command(button.dataset.presenterCommand); });
  });
  timerToggle.addEventListener('click', function () {
    if (running) { carriedSeconds = elapsedSeconds(); running = false; startedAt = 0; }
    else { running = true; startedAt = Date.now(); }
    render();
    persistSession(true);
  });
  document.getElementById('presenterTimerReset').addEventListener('click', function () { running = false; startedAt = 0; carriedSeconds = 0; render(); persistSession(true); });
  durationInput.addEventListener('change', function () { durationMinutes = clamp(Number(durationInput.value) || 15, 5, 180); durationInput.value = String(durationMinutes); savePreferences(); render(); });
  promptToggle.addEventListener('click', function () { promptPlaying ? stopPrompt() : startPrompt(); });
  speedInput.addEventListener('input', function () { promptSpeed = clamp(Number(speedInput.value) || 1, 1, 3); savePreferences(); });
  document.getElementById('presenterPromptSmaller').addEventListener('click', function () { promptSize = clamp(promptSize - 2, 17, 46); notes.style.fontSize = promptSize + 'px'; savePreferences(); });
  document.getElementById('presenterPromptLarger').addEventListener('click', function () { promptSize = clamp(promptSize + 2, 17, 46); notes.style.fontSize = promptSize + 'px'; savePreferences(); });
  document.getElementById('presenterResume').addEventListener('click', resumeSession);
  document.getElementById('presenterDiscard').addEventListener('click', resetSession);
  fullscreenButton.addEventListener('click', function () {
    if (document.fullscreenElement) document.exitFullscreen().catch(function () {});
    else if (document.documentElement.requestFullscreen) document.documentElement.requestFullscreen().catch(function () {});
  });
  document.getElementById('presenterRemoteOpen').addEventListener('click', function () {
    var url = new URL(location.href); url.searchParams.set('presenter', '1'); url.searchParams.set('remote', '1');
    window.open(url, 'admira-presenter-remote', 'popup=yes,width=460,height=820');
  });
  addEventListener('keydown', function (event) {
    if (event.defaultPrevented || event.target?.closest?.('input,textarea,select,button,[contenteditable="true"]')) return;
    if (event.key.toLowerCase() === 'p') { event.preventDefault(); panel.hidden ? openPanel() : closePanel(); }
  });
  addEventListener('scroll', function () { var index = nearestSlide(); if (index !== currentIndex) { currentIndex = index; render(); } }, {passive: true});
  addEventListener('online', function () {
    setConnection('↻ Reconectando…', 'is-reconnecting');
    refreshOfflineCache().then(function () {
      setConnection('● En línea', 'is-online');
      broadcast({type: 'ready'});
      render();
    });
  });
  addEventListener('offline', function () { setConnection('● Sin conexión · modo seguro', 'is-offline'); cacheState.textContent = cacheReady ? 'Usando copia offline' : 'Copia offline parcial'; persistSession(true); });
  addEventListener('fullscreenchange', function () {
    var active = Boolean(document.fullscreenElement);
    fullscreenButton.setAttribute('aria-pressed', String(active));
    fullscreenButton.textContent = active ? 'Salir de pantalla' : 'Pantalla completa';
    persistSession(true);
  });
  notes.addEventListener('scroll', function () { persistSession(false); }, {passive: true});
  document.querySelectorAll('video,audio').forEach(function (media) {
    ['play', 'pause', 'seeked', 'volumechange', 'ratechange'].forEach(function (name) { media.addEventListener(name, function () { persistSession(true); }); });
  });
  addEventListener('storage', function (event) { if (event.key === channelName && event.newValue) { try { receive(JSON.parse(event.newValue)); } catch (_) {} } });
  document.addEventListener('admira:language', function () { notes.dataset.slide = ''; render(); });
  if (channel) channel.addEventListener('message', function (event) { receive(event.data); });
  addEventListener('pagehide', function () { persistSession(true); if (channel) channel.close(); stopPrompt(true); }, {once: true});
  setInterval(function () {
    if (running && !document.hidden) render();
    if (remoteMode && lastStageSignalAt && Date.now() - lastStageSignalAt > 4000) {
      remoteState.textContent = 'Reconectando con la presentación…';
      setConnection('↻ Reconectando control…', 'is-reconnecting');
      broadcast({type: 'ready'});
    }
  }, 500);

  if (!navigator.onLine) setConnection('● Sin conexión · modo seguro', 'is-offline');
  refreshOfflineCache();

  if (remoteMode || query.get('presenter') === '1') openPanel();
  if (remoteMode) {
    document.documentElement.classList.add('presenter-remote-mode');
    launch.hidden = true;
    closeButton.hidden = true;
    remoteState.textContent = 'Esperando conexión con la presentación…';
    lastStageSignalAt = Date.now();
    broadcast({type: 'ready'});
  }
}());
