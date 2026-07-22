(function () {
  'use strict';

  var slides = Array.prototype.slice.call(document.querySelectorAll('.slide'));
  if (!slides.length || document.getElementById('admiraPresenterPanel')) return;

  var query = new URLSearchParams(location.search);
  var remoteMode = query.get('remote') === '1';
  var storageKey = 'admira.presenter.preferences.v1';
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
    '<div class="presenter-timing"><div><span>Tiempo</span><strong id="presenterClock" aria-live="off">00:00</strong></div>' +
    '<div><span>Ritmo</span><strong id="presenterPace" class="on-time" aria-live="polite">En ritmo</strong></div></div>' +
    '<div class="presenter-progress" aria-hidden="true"><i id="presenterProgress"></i></div>' +
    '<div class="presenter-controls" aria-label="Controles de navegación"><button type="button" data-presenter-command="prev">← Anterior</button><button type="button" data-presenter-command="next">Siguiente →</button></div>' +
    '<div class="presenter-controls compact"><button type="button" id="presenterTimerToggle">Iniciar tiempo</button><button type="button" id="presenterTimerReset">Reiniciar</button><label>Duración <input id="presenterDuration" type="number" min="5" max="180" step="1" inputmode="numeric" aria-label="Duración prevista en minutos"> min</label></div>' +
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
  }

  function openPanel() {
    panel.hidden = false;
    launch.setAttribute('aria-expanded', 'true');
    document.documentElement.classList.add('presenter-active');
    render();
    if (!remoteMode) closeButton.focus({preventScroll: true});
  }

  function closePanel() {
    panel.hidden = true;
    launch.setAttribute('aria-expanded', 'false');
    document.documentElement.classList.remove('presenter-active');
    stopPrompt();
    launch.focus({preventScroll: true});
  }

  function goLocal(index) {
    currentIndex = clamp(index, 0, slides.length - 1);
    slides[currentIndex].scrollIntoView({behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth'});
    render();
  }

  function command(name) {
    var nextIndex = name === 'next' ? currentIndex + 1 : name === 'prev' ? currentIndex - 1 : currentIndex;
    if (!remoteMode) goLocal(nextIndex);
    broadcast({type: 'command', command: name, index: nextIndex});
  }

  function broadcast(payload) {
    payload.source = remoteMode ? 'remote' : 'stage';
    if (channel) channel.postMessage(payload);
    try { localStorage.setItem(channelName, JSON.stringify(Object.assign({nonce: Date.now()}, payload))); } catch (_) {}
  }

  function receive(payload) {
    if (!payload || payload.source === (remoteMode ? 'remote' : 'stage')) return;
    if (payload.type === 'ready' && !remoteMode) { render(); return; }
    if (payload.type === 'command' && !remoteMode) goLocal(payload.command === 'next' ? currentIndex + 1 : currentIndex - 1);
    if (payload.type === 'state' && remoteMode) {
      currentIndex = clamp(Number(payload.index) || 0, 0, slides.length - 1);
      carriedSeconds = Math.max(0, Number(payload.elapsed) || 0);
      running = Boolean(payload.running);
      startedAt = running ? Date.now() : 0;
      remoteState.textContent = 'Conectado · diapositiva ' + (currentIndex + 1);
      render();
    }
  }

  function startPrompt() {
    promptPlaying = true;
    promptToggle.textContent = '❚❚ Pausar teleprompter';
    lastPromptFrame = performance.now();
    promptFrame = requestAnimationFrame(stepPrompt);
  }

  function stopPrompt() {
    promptPlaying = false;
    promptToggle.textContent = '▶ Teleprompter';
    if (promptFrame) cancelAnimationFrame(promptFrame);
    promptFrame = 0;
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
  });
  document.getElementById('presenterTimerReset').addEventListener('click', function () { running = false; startedAt = 0; carriedSeconds = 0; render(); });
  durationInput.addEventListener('change', function () { durationMinutes = clamp(Number(durationInput.value) || 15, 5, 180); durationInput.value = String(durationMinutes); savePreferences(); render(); });
  promptToggle.addEventListener('click', function () { promptPlaying ? stopPrompt() : startPrompt(); });
  speedInput.addEventListener('input', function () { promptSpeed = clamp(Number(speedInput.value) || 1, 1, 3); savePreferences(); });
  document.getElementById('presenterPromptSmaller').addEventListener('click', function () { promptSize = clamp(promptSize - 2, 17, 46); notes.style.fontSize = promptSize + 'px'; savePreferences(); });
  document.getElementById('presenterPromptLarger').addEventListener('click', function () { promptSize = clamp(promptSize + 2, 17, 46); notes.style.fontSize = promptSize + 'px'; savePreferences(); });
  document.getElementById('presenterRemoteOpen').addEventListener('click', function () {
    var url = new URL(location.href); url.searchParams.set('presenter', '1'); url.searchParams.set('remote', '1');
    window.open(url, 'admira-presenter-remote', 'popup=yes,width=460,height=820');
  });
  addEventListener('keydown', function (event) {
    if (event.defaultPrevented || event.target?.closest?.('input,textarea,select,button,[contenteditable="true"]')) return;
    if (event.key.toLowerCase() === 'p') { event.preventDefault(); panel.hidden ? openPanel() : closePanel(); }
  });
  addEventListener('scroll', function () { var index = nearestSlide(); if (index !== currentIndex) { currentIndex = index; render(); } }, {passive: true});
  addEventListener('storage', function (event) { if (event.key === channelName && event.newValue) { try { receive(JSON.parse(event.newValue)); } catch (_) {} } });
  document.addEventListener('admira:language', function () { notes.dataset.slide = ''; render(); });
  if (channel) channel.addEventListener('message', function (event) { receive(event.data); });
  addEventListener('pagehide', function () { if (channel) channel.close(); stopPrompt(); }, {once: true});
  setInterval(function () { if (running && !document.hidden) render(); }, 500);

  if (remoteMode || query.get('presenter') === '1') openPanel();
  if (remoteMode) {
    document.documentElement.classList.add('presenter-remote-mode');
    launch.hidden = true;
    closeButton.hidden = true;
    remoteState.textContent = 'Esperando conexión con la presentación…';
    broadcast({type: 'ready'});
  }
}());
