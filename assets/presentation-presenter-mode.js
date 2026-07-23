(function () {
  'use strict';

  var slides = Array.prototype.slice.call(document.querySelectorAll('.slide'));
  if (!slides.length || document.getElementById('admiraPresenterPanel')) return;

  var query = new URLSearchParams(location.search);
  var remoteMode = query.get('remote') === '1';
  var audienceMode = query.get('audience') === '1';
  var channelName = 'admira-presenter:' + location.pathname;
  if (audienceMode) {
    startAudienceMode();
    return;
  }
  var storageKey = 'admira.presenter.preferences.v1';
  var sessionSchema = 2;
  var sessionStorageKey = 'admira.presenter.session.v' + sessionSchema + ':' + location.pathname + (remoteMode ? ':remote' : ':stage');
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
  var audienceConnected = false;
  var audiencePrivacyVerified = false;
  var audienceWindow = null;
  var launchScreenStatus = 'Screen Details: pendiente de comprobar tras el gesto.';
  var launchFullscreenStatus = 'Pantalla completa: pendiente de solicitar.';
  var paceCoachApi = window.AdmiraPresentationPaceCoach || null;
  var paceSamples = [];
  var slideEnteredAt = 0;
  var stableCoachAdvice = null;
  var programmaticNavigationTarget = -1;
  var programmaticNavigationUntil = 0;

  var launch = document.createElement('button');
  launch.type = 'button';
  launch.id = 'admiraPresenterLaunch';
  launch.className = 'presenter-launch';
  launch.setAttribute('aria-controls', 'admiraPresenterPanel');
  launch.setAttribute('aria-expanded', 'false');
  launch.setAttribute('data-presenter-private', '');
  launch.textContent = 'Ensayar';
  document.body.appendChild(launch);

  var panel = document.createElement('aside');
  panel.id = 'admiraPresenterPanel';
  panel.className = 'presenter-panel';
  panel.hidden = true;
  panel.setAttribute('aria-label', 'Modo presentador inteligente');
  panel.setAttribute('data-presenter-private', '');
  panel.innerHTML =
    '<header class="presenter-head"><div><span>Ensayo inteligente</span><strong id="presenterSlideLabel">Diapositiva</strong></div>' +
    '<button type="button" id="presenterClose" aria-label="Cerrar modo presentador">×</button></header>' +
    '<div class="presenter-health"><span id="presenterConnection" class="is-online" role="status" aria-live="polite">● En línea</span><span id="presenterCacheState">Preparando modo offline…</span></div>' +
    '<section id="presenterRecovery" class="presenter-recovery" aria-labelledby="presenterRecoveryTitle" hidden><strong id="presenterRecoveryTitle">Sesión interrumpida disponible</strong><span id="presenterRecoverySummary"></span><div><button type="button" id="presenterResume">Reanudar exactamente</button><button type="button" id="presenterDiscard">Empezar de nuevo</button></div></section>' +
    '<div class="presenter-timing"><div><span>Tiempo</span><strong id="presenterClock" aria-live="off">00:00</strong></div>' +
    '<div><span>Ritmo</span><strong id="presenterPace" class="on-time" aria-live="polite">En ritmo</strong></div></div>' +
    '<div class="presenter-progress" aria-hidden="true"><i id="presenterProgress"></i></div>' +
    '<section id="presenterPaceCoach" class="presenter-pace-coach" data-coach-state="learning" data-presenter-private aria-labelledby="presenterCoachTitle"><div class="presenter-pace-coach-head"><div><span>Escaleta privada</span><strong id="presenterCoachTitle">Coach de ritmo en vivo</strong></div><span id="presenterCoachBadge">Calibrando</span></div>' +
    '<dl class="presenter-coach-metrics"><div><dt>Escaleta restante</dt><dd id="presenterCoachPlan">--:--</dd></div><div><dt>Tiempo disponible</dt><dd id="presenterCoachAvailable">--:--</dd></div><div><dt>Cierre estimado</dt><dd id="presenterCoachFinish">—</dd></div></dl>' +
    '<div id="presenterCoachAdvice" class="presenter-coach-advice" role="status" aria-live="polite" aria-atomic="true"><strong id="presenterCoachLabel">Calibrando ritmo</strong><span id="presenterCoachDetail">Avanza dos diapositivas para obtener una predicción fiable.</span></div>' +
    '<button type="button" id="presenterCoachSkip" class="presenter-coach-skip" hidden>Saltar diapositiva sugerida</button></section>' +
    '<div class="presenter-controls" aria-label="Controles de navegación"><button type="button" data-presenter-command="prev">← Anterior</button><button type="button" data-presenter-command="next">Siguiente →</button></div>' +
    '<div class="presenter-controls compact"><button type="button" id="presenterTimerToggle">Iniciar tiempo</button><button type="button" id="presenterTimerReset">Reiniciar</button><button type="button" id="presenterFullscreen" aria-pressed="false">Pantalla completa</button><label>Duración <input id="presenterDuration" type="number" min="5" max="180" step="1" inputmode="numeric" aria-label="Duración prevista en minutos"> min</label></div>' +
    '<section class="presenter-prompt" aria-labelledby="presenterPromptTitle"><div class="presenter-prompt-head"><strong id="presenterPromptTitle">Notas del orador</strong><div><button type="button" id="presenterPromptSmaller" aria-label="Reducir texto">A−</button><button type="button" id="presenterPromptLarger" aria-label="Aumentar texto">A+</button></div></div>' +
    '<div id="presenterNotes" class="presenter-notes" tabindex="0"></div><div class="presenter-prompt-actions"><button type="button" id="presenterPromptToggle">▶ Teleprompter</button><label>Velocidad <input id="presenterPromptSpeed" type="range" min="1" max="3" step="1" aria-label="Velocidad del teleprompter"></label></div></section>' +
    '<div class="presenter-next"><span>Siguiente</span><strong id="presenterNextTitle">Fin de la presentación</strong></div>' +
    '<section id="presenterCaptions" class="presenter-prompt" aria-labelledby="presenterCaptionsTitle"><div class="presenter-prompt-head"><div><span>Solo control privado</span><strong id="presenterCaptionsTitle">Subtítulos en vivo</strong></div><span id="presenterCaptionsStatus" role="status" aria-live="polite">Comprobando compatibilidad…</span></div>' +
    '<div class="presenter-controls compact presenter-caption-languages"><label>Idioma de entrada <select id="presenterCaptionsLanguage" aria-label="Idioma de reconocimiento"><option value="es-ES">Español (España)</option><option value="en-US">English (US)</option><option value="ca-ES">Català</option><option value="fr-FR">Français</option><option value="de-DE">Deutsch</option><option value="it-IT">Italiano</option><option value="pt-PT">Português</option></select></label><label>Traducción para audiencia <select id="presenterCaptionsTargetLanguage" aria-label="Idioma de traducción para la audiencia"><option value="en">English</option><option value="es">Español</option><option value="ca">Català</option><option value="fr">Français</option><option value="de">Deutsch</option><option value="it">Italiano</option><option value="pt">Português</option></select></label><button type="button" id="presenterCaptionsStart">Iniciar subtítulos</button><button type="button" id="presenterCaptionsStop" disabled>Detener subtítulos</button></div>' +
    '<label class="presenter-caption-glossary" for="presenterCaptionsGlossary"><span>Glosario efímero <small id="presenterCaptionsGlossaryStatus">vacío · solo memoria</small></span><textarea id="presenterCaptionsGlossary" rows="3" spellcheck="false" placeholder="Admira Next = Admira Next&#10;Smart Room = Sala Inteligente"></textarea></label>' +
    '<div id="presenterCaptionsPreview" aria-live="off"><p><strong>Final:</strong> <span id="presenterCaptionsFinal">—</span></p><p><strong>Provisional:</strong> <span id="presenterCaptionsInterim">—</span></p></div><p>El original aparece de inmediato; la traducción local lo sustituye cuando termina. Texto y glosario son efímeros: no se guardan ni salen del canal local.</p></section>' +
    '<section id="presenterLaunchAssistant" class="presenter-launch-assistant" data-launch-state="warning" aria-live="polite" aria-labelledby="presenterLaunchTitle"><div class="presenter-launch-assistant-head"><div><span>Preparación de sala</span><strong id="presenterLaunchTitle">Lanzamiento seguro en sala</strong></div><span id="presenterLaunchState" class="presenter-launch-state">Revisión necesaria</span></div>' +
    '<ul id="presenterLaunchChecklist" class="presenter-launch-checklist"><li>Salida de audiencia: pendiente de verificación.</li><li>Screen Details y Pantalla completa se comprobarán al lanzar.</li><li>No molestar: revisión manual obligatoria.</li></ul>' +
    '<div class="presenter-launch-actions"><button type="button" id="presenterAudienceLaunch" aria-describedby="presenterLaunchFallback">Presentar en audiencia</button></div>' +
    '<p id="presenterLaunchFallback" class="presenter-launch-fallback">La Web no puede garantizar otras ventanas ni activar No molestar. Revisa manualmente el escritorio antes de compartir.</p></section>' +
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
  var launchAssistant = document.getElementById('presenterLaunchAssistant');
  var launchChecklist = document.getElementById('presenterLaunchChecklist');
  var launchFallback = document.getElementById('presenterLaunchFallback');
  var launchState = document.getElementById('presenterLaunchState');
  var captionsStart = document.getElementById('presenterCaptionsStart');
  var captionsStop = document.getElementById('presenterCaptionsStop');
  var captionsLanguage = document.getElementById('presenterCaptionsLanguage');
  var captionsTargetLanguage = document.getElementById('presenterCaptionsTargetLanguage');
  var captionsGlossary = document.getElementById('presenterCaptionsGlossary');
  var captionsGlossaryStatus = document.getElementById('presenterCaptionsGlossaryStatus');
  var captionsStatus = document.getElementById('presenterCaptionsStatus');
  var captionsPreview = document.getElementById('presenterCaptionsPreview');
  var captionsFinal = document.getElementById('presenterCaptionsFinal');
  var captionsInterim = document.getElementById('presenterCaptionsInterim');
  var SpeechRecognitionConstructor = !remoteMode && (window.SpeechRecognition || window.webkitSpeechRecognition);
  var captionRecognition = null;
  var captionActive = false;
  var captionRestartTimer = 0;
  var captionSession = 0;
  var captionRevision = 0;
  var captionFinalText = '';
  var captionInterimText = '';
  var CaptionContract = window.AdmiraPresenterCaptions || null;
  var captionAccessibility = CaptionContract && typeof CaptionContract.create === 'function'
    ? CaptionContract.create({sourceLanguage: 'es', targetLanguage: captionsTargetLanguage.value})
    : null;
  var paceCoach = document.getElementById('presenterPaceCoach');
  var coachBadge = document.getElementById('presenterCoachBadge');
  var coachPlan = document.getElementById('presenterCoachPlan');
  var coachAvailable = document.getElementById('presenterCoachAvailable');
  var coachFinish = document.getElementById('presenterCoachFinish');
  var coachLabel = document.getElementById('presenterCoachLabel');
  var coachDetail = document.getElementById('presenterCoachDetail');
  var coachSkip = document.getElementById('presenterCoachSkip');

  durationInput.value = String(durationMinutes);
  speedInput.value = String(promptSpeed);
  notes.style.fontSize = promptSize + 'px';

  function startAudienceMode() {
    document.documentElement.classList.add('presenter-audience-mode');
    document.documentElement.setAttribute('data-presenter-surface', 'audience');
    var audiencePrivacyStyle = document.createElement('style');
    audiencePrivacyStyle.textContent = '.presenter-audience-mode.presenter-cursor-hidden,.presenter-audience-mode.presenter-cursor-hidden *{cursor:none!important}';
    document.head.appendChild(audiencePrivacyStyle);
    var privateSelector = '[data-speaker-notes],#admiraPresenterPanel,#admiraPresenterLaunch,[data-presenter-private],.inline-editor,.quality-levels,script[src*="presentation-inline-editor"]';
    var privacyReady = typeof window.__ADMIRA_PRESENTER_NOTES__ === 'undefined' && window.__ADMIRA_CAN_EDIT__ !== true && !document.querySelector(privateSelector);
    var audienceChannel = typeof BroadcastChannel === 'function' ? new BroadcastChannel(channelName) : null;
    var audienceSequence = 0;
    var audienceIndex = nearestSlide();
    var cursorTimer = 0;
    var audienceReceivedMessageIds = [];
    var AudienceCaptionContract = window.AdmiraPresenterCaptions || null;
    var audienceCaptions = privacyReady && AudienceCaptionContract && typeof AudienceCaptionContract.create === 'function'
      ? AudienceCaptionContract.create({document: document, sourceLanguage: 'es', targetLanguage: 'es', label: 'Subtítulos en vivo para la audiencia'})
      : null;
    if (audienceCaptions) audienceCaptions.mount(document.body);

    function hideAudienceCursorSoon() {
      document.documentElement.classList.remove('presenter-cursor-hidden');
      clearTimeout(cursorTimer);
      cursorTimer = setTimeout(function () { document.documentElement.classList.add('presenter-cursor-hidden'); }, 1400);
    }

    function audienceSend(payload) {
      payload.source = 'audience';
      payload.messageId = 'audience:' + Date.now() + ':' + (++audienceSequence);
      if (audienceChannel) audienceChannel.postMessage(payload);
      try { localStorage.setItem(channelName, JSON.stringify(Object.assign({nonce: Date.now()}, payload))); } catch (_) {}
    }

    function audienceGo(index) {
      audienceIndex = clamp(Number(index) || 0, 0, slides.length - 1);
      slides[audienceIndex].scrollIntoView({behavior: 'auto'});
    }

    function audienceReceive(payload) {
      if (!payload || payload.source === 'audience') return;
      if (payload.messageId && audienceReceivedMessageIds.indexOf(payload.messageId) >= 0) return;
      if (payload.messageId) {
        audienceReceivedMessageIds.push(payload.messageId);
        if (audienceReceivedMessageIds.length > 100) audienceReceivedMessageIds.shift();
      }
      if (payload.type === 'command' || payload.type === 'state') audienceGo(payload.index);
      if (payload.type === 'captions' && privacyReady) {
        if (!audienceCaptions) return;
        audienceCaptions.setLanguages(payload.sourceLanguage || 'es', payload.targetLanguage || payload.sourceLanguage || 'es');
        audienceCaptions.setGlossary(payload.glossary && typeof payload.glossary === 'object' ? payload.glossary : {});
        if (!payload.active || !payload.originalText) {
          audienceCaptions.hide();
          return;
        }
        // `show` pinta siempre el original de forma síncrona y solo lo sustituye
        // si la Translator API local termina. Las respuestas antiguas se descartan.
        audienceCaptions.show(payload.originalText);
      }
    }

    if (!privacyReady) {
      var warning = document.createElement('main');
      var title = document.createElement('h1');
      var detail = document.createElement('p');
      title.textContent = 'Salida de audiencia bloqueada';
      detail.textContent = 'Esta respuesta contiene datos o controles privados. Vuelve al control del presentador y reintenta; no compartas esta ventana.';
      warning.appendChild(title);
      warning.appendChild(detail);
      document.body.replaceChildren(warning);
    }

    addEventListener('storage', function (event) {
      if (event.key === channelName && event.newValue) {
        try { audienceReceive(JSON.parse(event.newValue)); } catch (_) {}
      }
    });
    if (audienceChannel) audienceChannel.addEventListener('message', function (event) { audienceReceive(event.data); });
    addEventListener('pointermove', hideAudienceCursorSoon, {passive: true});
    addEventListener('focus', hideAudienceCursorSoon);
    addEventListener('pagehide', function () { clearTimeout(cursorTimer); if (audienceCaptions) audienceCaptions.destroy(); if (audienceChannel) audienceChannel.close(); }, {once: true});
    hideAudienceCursorSoon();
    audienceSend({type: 'audience-ready', privacyReady: privacyReady, index: audienceIndex});
  }

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

  function trimCaptionText(value) {
    value = String(value || '').replace(/\s+/g, ' ').trim();
    return value.length > 420 ? value.slice(value.length - 420).replace(/^\S*\s+/, '') : value;
  }

  function captionSourceLanguage() {
    return String(captionsLanguage.value || 'es').toLowerCase().split('-')[0];
  }

  function parseCaptionGlossary() {
    var entries = {};
    String(captionsGlossary.value || '').split(/\r?\n/).slice(0, 24).forEach(function (line) {
      var separator = line.indexOf('=');
      if (separator < 1) return;
      var term = line.slice(0, separator).replace(/\s+/g, ' ').trim();
      var replacement = line.slice(separator + 1).replace(/\s+/g, ' ').trim();
      if (term && replacement && term.length <= 120 && replacement.length <= 240) entries[term] = replacement;
    });
    return entries;
  }

  function syncCaptionAccessibility() {
    var glossary = parseCaptionGlossary();
    var count = Object.keys(glossary).length;
    captionsGlossaryStatus.textContent = count ? count + (count === 1 ? ' término' : ' términos') + ' · solo memoria' : 'vacío · solo memoria';
    if (captionAccessibility) {
      captionAccessibility.setLanguages(captionSourceLanguage(), captionsTargetLanguage.value);
      captionAccessibility.setGlossary(glossary);
    }
    return glossary;
  }

  function captionTranslationSummary() {
    if (!CaptionContract || !captionAccessibility) return 'original inmediato · traducción local no disponible';
    var capabilities = typeof CaptionContract.capabilities === 'function' ? CaptionContract.capabilities() : {};
    return capabilities.browserTranslation ? 'original inmediato · traducción local progresiva' : 'original inmediato · traducción local no disponible';
  }

  function setCaptionControls(message) {
    captionsStart.disabled = captionActive || !SpeechRecognitionConstructor || !channel || remoteMode;
    captionsStop.disabled = !captionActive;
    captionsLanguage.disabled = captionActive;
    captionsStatus.textContent = message;
  }

  function sendCaptionState() {
    var glossary = syncCaptionAccessibility();
    captionRevision += 1;
    broadcast({
      type: 'captions',
      active: captionActive,
      sourceLanguage: captionSourceLanguage(),
      targetLanguage: captionsTargetLanguage.value,
      glossary: glossary,
      originalText: trimCaptionText(captionFinalText + ' ' + captionInterimText),
      messageId: 'captions:' + captionSession + ':' + captionRevision
    }, true);
  }

  function renderCaptionPreview() {
    captionsFinal.textContent = captionFinalText || '—';
    captionsInterim.textContent = captionInterimText || (captionActive ? 'Escuchando…' : '—');
    captionsPreview.dataset.captionActive = String(captionActive);
  }

  function createCaptionRecognition() {
    var recognition = new SpeechRecognitionConstructor();
    recognition.lang = captionsLanguage.value;
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.maxAlternatives = 1;
    recognition.addEventListener('start', function () {
      if (captionActive) setCaptionControls('Escuchando · ' + captionTranslationSummary());
    });
    recognition.addEventListener('result', function (event) {
      if (!captionActive) return;
      var newFinal = '';
      var interim = '';
      for (var index = event.resultIndex; index < event.results.length; index += 1) {
        var result = event.results[index];
        var transcript = result && result[0] ? String(result[0].transcript || '').trim() : '';
        if (!transcript) continue;
        if (result.isFinal) newFinal += (newFinal ? ' ' : '') + transcript;
        else interim += (interim ? ' ' : '') + transcript;
      }
      if (newFinal) captionFinalText = trimCaptionText(captionFinalText + ' ' + newFinal);
      captionInterimText = trimCaptionText(interim);
      renderCaptionPreview();
      sendCaptionState();
    });
    recognition.addEventListener('error', function (event) {
      var fatal = ['not-allowed', 'service-not-allowed', 'audio-capture', 'network'].indexOf(event.error) >= 0;
      if (!fatal) {
        setCaptionControls('Reconocimiento interrumpido (' + event.error + '); reintentando…');
        return;
      }
      captionActive = false;
      captionInterimText = '';
      clearTimeout(captionRestartTimer);
      setCaptionControls(event.error === 'not-allowed'
        ? 'Permiso de micrófono denegado. Autorízalo en el navegador y vuelve a iniciar.'
        : 'Reconocimiento no disponible (' + event.error + '). Usa el navegador compatible o subtítulos del sistema.');
      renderCaptionPreview();
      sendCaptionState();
    });
    recognition.addEventListener('end', function () {
      if (!captionActive) return;
      clearTimeout(captionRestartTimer);
      captionRestartTimer = setTimeout(function () {
        if (!captionActive) return;
        try { captionRecognition.start(); }
        catch (_) {
          captionActive = false;
          setCaptionControls('No se pudo reanudar el reconocimiento. Pulsa Iniciar para reintentarlo.');
          sendCaptionState();
        }
      }, 250);
    });
    return recognition;
  }

  function startLiveCaptions() {
    if (captionActive) return;
    if (!SpeechRecognitionConstructor) {
      setCaptionControls('Este navegador no ofrece Web Speech Recognition. Usa Chrome/Edge o los subtítulos del sistema.');
      return;
    }
    if (!channel) {
      setCaptionControls('Subtítulos desactivados: falta el canal local efímero y no se guardarán transcripciones como fallback.');
      return;
    }
    captionSession += 1;
    captionRevision = 0;
    captionFinalText = '';
    captionInterimText = '';
    captionActive = true;
    captionRecognition = createCaptionRecognition();
    setCaptionControls('Solicitando acceso al micrófono…');
    renderCaptionPreview();
    sendCaptionState();
    try { captionRecognition.start(); }
    catch (_) {
      captionActive = false;
      setCaptionControls('No se pudo iniciar el reconocimiento. Revisa el permiso del micrófono.');
      sendCaptionState();
    }
  }

  function stopLiveCaptions(silent) {
    if (!captionActive && !captionRecognition) return;
    captionActive = false;
    captionFinalText = '';
    captionInterimText = '';
    clearTimeout(captionRestartTimer);
    if (captionRecognition) {
      try { captionRecognition.abort(); } catch (_) {}
      captionRecognition = null;
    }
    renderCaptionPreview();
    setCaptionControls(silent ? 'Subtítulos detenidos.' : 'Subtítulos detenidos y texto efímero eliminado.');
    sendCaptionState();
  }

  function initializeCaptionControls() {
    var documentLanguage = String(document.documentElement.lang || navigator.language || 'es-ES').toLowerCase();
    var matchingOption = Array.prototype.find.call(captionsLanguage.options, function (option) {
      return option.value.toLowerCase() === documentLanguage || option.value.toLowerCase().split('-')[0] === documentLanguage.split('-')[0];
    });
    if (matchingOption) captionsLanguage.value = matchingOption.value;
    syncCaptionAccessibility();
    if (remoteMode) setCaptionControls('Inicia los subtítulos desde el control privado principal.');
    else if (!SpeechRecognitionConstructor) setCaptionControls('No disponible en este navegador. Usa Chrome/Edge o los subtítulos del sistema.');
    else if (!channel) setCaptionControls('No disponible sin BroadcastChannel: no se persistirá texto como fallback.');
    else setCaptionControls('Listo · ' + captionTranslationSummary() + ' · requiere permiso de micrófono.');
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
    resetPaceCoach(carriedSeconds);
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
    resetPaceCoach(0);
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

  function setLaunchChecklist(items) {
    launchChecklist.replaceChildren();
    items.forEach(function (item) {
      var row = document.createElement('li');
      row.textContent = item;
      row.dataset.checkStatus = /^BLOQUEADO/.test(item) ? 'blocked' : (/verificada|detectó una pantalla separada|Pantalla completa solicitada/.test(item) ? 'ready' : 'warning');
      launchChecklist.appendChild(row);
    });
  }

  function setLaunchState(state, fallback) {
    launchAssistant.dataset.launchState = ['ready', 'warning', 'blocked'].indexOf(state) >= 0 ? state : 'warning';
    launchState.textContent = state === 'ready' ? 'Listo' : (state === 'blocked' ? 'Bloqueado' : 'Revisión necesaria');
    launchFallback.textContent = fallback;
  }

  function refreshLaunchAssistant() {
    var privacyStatus = !audienceConnected
      ? 'Salida dedicada: pendiente; aún no se ha verificado que la audiencia no reciba notas.'
      : (audiencePrivacyVerified
        ? 'Salida dedicada verificada: la audiencia no recibió notas ni controles privados.'
        : 'BLOQUEADO: la salida de audiencia detectó datos o controles privados. No la compartas.');
    setLaunchChecklist([
      privacyStatus,
      launchScreenStatus,
      launchFullscreenStatus,
      'No molestar: la Web no puede activarlo ni comprobar otras ventanas; revísalo manualmente.'
    ]);
    if (audienceConnected && !audiencePrivacyVerified) {
      setLaunchState('blocked', 'No compartas la salida bloqueada. Cierra esa ventana y reintenta cuando la respuesta de audiencia ya no incluya datos privados.');
    } else if (audienceConnected) {
      setLaunchState('warning', 'Notas y controles privados separados. Aún debes comprobar manualmente notificaciones, otras ventanas y No molestar.');
    } else {
      setLaunchState('warning', 'La comprobación previa no promete privacidad todavía. Lanza la salida y espera la confirmación antes de compartir.');
    }
  }

  function requestAudienceFullscreen(targetWindow, targetScreen) {
    function requestNow() {
      try {
        var target = targetWindow.document.documentElement;
        if (!target || !target.requestFullscreen) {
          launchFullscreenStatus = 'Pantalla completa no disponible; actívala manualmente en la ventana de audiencia.';
          refreshLaunchAssistant();
          return;
        }
        var request = targetScreen ? target.requestFullscreen({screen: targetScreen}) : target.requestFullscreen();
        Promise.resolve(request).then(function () {
          launchFullscreenStatus = targetScreen
            ? 'Pantalla completa solicitada en la pantalla de audiencia seleccionada.'
            : 'Pantalla completa solicitada en la pantalla principal.';
          refreshLaunchAssistant();
        }).catch(function () {
          launchFullscreenStatus = 'El navegador rechazó Pantalla completa automática; actívala manualmente en la audiencia.';
          refreshLaunchAssistant();
        });
      } catch (_) {
        launchFullscreenStatus = 'No se pudo activar Pantalla completa automáticamente; continúa manualmente en la audiencia.';
        refreshLaunchAssistant();
      }
    }

    try {
      if (targetWindow.document.readyState === 'complete') requestNow();
      else targetWindow.addEventListener('load', requestNow, {once: true});
    } catch (_) {
      launchFullscreenStatus = 'La ventana de audiencia exige activar Pantalla completa manualmente.';
      refreshLaunchAssistant();
    }
  }

  function configureAudienceDisplay(targetWindow) {
    if (typeof window.getScreenDetails !== 'function') {
      launchScreenStatus = 'Screen Details no disponible; el navegador no permite asignar una pantalla. Mueve la audiencia manualmente.';
      refreshLaunchAssistant();
      requestAudienceFullscreen(targetWindow, null);
      return;
    }
    launchScreenStatus = 'Screen Details: solicitando permiso para elegir una pantalla de audiencia…';
    refreshLaunchAssistant();
    window.getScreenDetails().then(function (details) {
      var screens = Array.prototype.slice.call(details.screens || []);
      var targetScreen = screens.find(function (screen) { return screen !== details.currentScreen; }) || null;
      if (!targetScreen) {
        launchScreenStatus = 'Screen Details no encontró una segunda pantalla; se usará la pantalla principal con selección manual.';
        refreshLaunchAssistant();
        requestAudienceFullscreen(targetWindow, null);
        return;
      }
      launchScreenStatus = 'Screen Details detectó una pantalla separada; se solicitará allí la salida de audiencia.';
      refreshLaunchAssistant();
      requestAudienceFullscreen(targetWindow, targetScreen);
    }).catch(function () {
      launchScreenStatus = 'Permiso de Screen Details denegado o no disponible; elige la pantalla manualmente.';
      refreshLaunchAssistant();
      requestAudienceFullscreen(targetWindow, null);
    });
  }

  function offlineUrls() {
    var urls = [location.href, '/assets/presentation-pace-coach.js?v=20260723-1', '/assets/presentation-presenter-mode.js?v=20260723-2', '/assets/presentation-presenter-mode.css?v=20260723-2', '/assets/presentation-caption-accessibility.js?v=20260723-2', '/assets/presentation-caption-accessibility.css?v=20260723-2'];
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

  function coachRole(slide, index) {
    if (index === 0 || slide.classList.contains('cover')) return 'opening';
    if (index === slides.length - 1 || slide.querySelector('.close')) return 'closing';
    if (slide.classList.contains('deck-slide')) return 'context';
    return 'content';
  }

  function coachRunOfShow() {
    if (!paceCoachApi) return [];
    return paceCoachApi.createRunOfShow(slides.map(function (slide, index) {
      var role = coachRole(slide, index);
      var explicitOptional = slide.getAttribute('data-presenter-optional');
      return {
        title: slideTitle(slide),
        role: role,
        seconds: Number(slide.getAttribute('data-presenter-seconds')) || 0,
        weight: role === 'content' ? 1.15 : (role === 'context' ? 0.85 : 0.7),
        optional: explicitOptional === 'true' || (explicitOptional !== 'false' && role === 'context')
      };
    }), durationMinutes * 60);
  }

  function coachAssessment(seconds) {
    if (!paceCoachApi) return null;
    var runOfShow = coachRunOfShow();
    var samples = paceSamples.map(function (sample) {
      return {
        actualSeconds: sample.actualSeconds,
        plannedSeconds: runOfShow[sample.index] ? runOfShow[sample.index].plannedSeconds : 0
      };
    });
    return paceCoachApi.assess({
      runOfShow: runOfShow,
      totalSeconds: durationMinutes * 60,
      elapsedSeconds: seconds,
      currentEnteredAt: slideEnteredAt,
      index: currentIndex,
      samples: samples
    });
  }

  function renderPaceCoach(seconds) {
    var assessment = coachAssessment(seconds);
    if (!assessment) {
      paceCoach.hidden = true;
      return;
    }
    paceCoach.hidden = false;
    var nextAdvice = {
      mode: assessment.mode,
      label: assessment.label,
      detail: assessment.detail,
      skipIndex: assessment.skipIndex,
      skipTitle: assessment.skipTitle
    };
    stableCoachAdvice = paceCoachApi.stabilizeAdvice(nextAdvice, stableCoachAdvice, Date.now(), 8000);
    paceCoach.dataset.coachState = stableCoachAdvice.mode;
    coachBadge.textContent = stableCoachAdvice.mode === 'learning' ? 'Calibrando' : (stableCoachAdvice.mode === 'on-time' ? 'En ritmo' : 'Recomendación');
    coachPlan.textContent = paceCoachApi.formatTime(assessment.plannedRemaining);
    coachAvailable.textContent = paceCoachApi.formatTime(assessment.availableRemaining);
    coachFinish.textContent = assessment.predictedFinish === null ? 'Calibrando' : paceCoachApi.formatTime(assessment.predictedFinish);
    var shouldAnnounce = coachLabel.dataset.mode !== stableCoachAdvice.mode;
    if (shouldAnnounce) {
      coachLabel.dataset.mode = stableCoachAdvice.mode;
      coachLabel.textContent = stableCoachAdvice.label;
      coachDetail.textContent = stableCoachAdvice.detail;
    }
    var canSkip = stableCoachAdvice.mode === 'skip' && Number.isFinite(stableCoachAdvice.skipIndex) && stableCoachAdvice.skipIndex < slides.length - 1;
    coachSkip.hidden = !canSkip;
    coachSkip.dataset.skipIndex = canSkip ? String(stableCoachAdvice.skipIndex) : '';
    if (canSkip) coachSkip.textContent = 'Saltar «' + stableCoachAdvice.skipTitle + '»';
  }

  function resetPaceCoach(seconds) {
    paceSamples = [];
    slideEnteredAt = Math.max(0, Number(seconds) || 0);
    stableCoachAdvice = null;
    if (coachLabel) coachLabel.dataset.mode = '';
  }

  function recordSlideTransition(nextIndex, seconds, timerWasRunning) {
    nextIndex = clamp(nextIndex, 0, slides.length - 1);
    seconds = Math.max(0, Number(seconds) || 0);
    if (nextIndex === currentIndex) return;
    if (timerWasRunning && nextIndex === currentIndex + 1) {
      var actualSeconds = Math.max(0, seconds - slideEnteredAt);
      if (actualSeconds >= 1) {
        paceSamples.push({index: currentIndex, actualSeconds: actualSeconds});
        if (paceSamples.length > 10) paceSamples.shift();
      }
    } else if (nextIndex < currentIndex || Math.abs(nextIndex - currentIndex) > 1) {
      paceSamples = [];
      stableCoachAdvice = null;
    }
    slideEnteredAt = seconds;
    currentIndex = nextIndex;
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
    renderPaceCoach(seconds);
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
    recordSlideTransition(index, elapsedSeconds(), running);
    programmaticNavigationTarget = currentIndex;
    programmaticNavigationUntil = Date.now() + 1600;
    slides[currentIndex].scrollIntoView({behavior: immediate || matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth'});
    render();
  }

  function command(name) {
    var nextIndex = name === 'next' ? currentIndex + 1 : name === 'prev' ? currentIndex - 1 : currentIndex;
    if (!remoteMode) goLocal(nextIndex);
    broadcast({type: 'command', command: name, index: nextIndex});
  }

  function broadcast(payload, transient) {
    payload.source = remoteMode ? 'remote' : 'stage';
    payload.messageId = payload.messageId || payload.source + ':' + Date.now() + ':' + (++messageSequence);
    if (channel) channel.postMessage(payload);
    if (!transient) {
      try { localStorage.setItem(channelName, JSON.stringify(Object.assign({nonce: Date.now()}, payload))); } catch (_) {}
    }
  }

  function receive(payload) {
    if (!payload || payload.source === (remoteMode ? 'remote' : 'stage')) return;
    if (payload.messageId && receivedMessageIds.indexOf(payload.messageId) >= 0) return;
    if (payload.messageId) {
      receivedMessageIds.push(payload.messageId);
      if (receivedMessageIds.length > 100) receivedMessageIds.shift();
    }
    if (payload.type === 'audience-ready' && !remoteMode) {
      audienceConnected = true;
      audiencePrivacyVerified = Boolean(payload.privacyReady);
      if (captionActive) sendCaptionState();
      refreshLaunchAssistant();
      render();
      return;
    }
    if (payload.type === 'ready' && !remoteMode) { render(); return; }
    if (payload.type === 'command' && !remoteMode) {
      var requestedIndex = Number(payload.index);
      goLocal(Number.isFinite(requestedIndex) ? requestedIndex : (payload.command === 'next' ? currentIndex + 1 : currentIndex - 1));
    }
    if (payload.type === 'state' && remoteMode) {
      lastStageSignalAt = Date.now();
      recordSlideTransition(Number(payload.index) || 0, Math.max(0, Number(payload.elapsed) || 0), Boolean(payload.running));
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
  document.getElementById('presenterTimerReset').addEventListener('click', function () { running = false; startedAt = 0; carriedSeconds = 0; resetPaceCoach(0); render(); persistSession(true); });
  durationInput.addEventListener('change', function () { durationMinutes = clamp(Number(durationInput.value) || 15, 5, 180); durationInput.value = String(durationMinutes); savePreferences(); render(); });
  promptToggle.addEventListener('click', function () { promptPlaying ? stopPrompt() : startPrompt(); });
  speedInput.addEventListener('input', function () { promptSpeed = clamp(Number(speedInput.value) || 1, 1, 3); savePreferences(); });
  document.getElementById('presenterPromptSmaller').addEventListener('click', function () { promptSize = clamp(promptSize - 2, 17, 46); notes.style.fontSize = promptSize + 'px'; savePreferences(); });
  document.getElementById('presenterPromptLarger').addEventListener('click', function () { promptSize = clamp(promptSize + 2, 17, 46); notes.style.fontSize = promptSize + 'px'; savePreferences(); });
  document.getElementById('presenterResume').addEventListener('click', resumeSession);
  document.getElementById('presenterDiscard').addEventListener('click', resetSession);
  captionsStart.addEventListener('click', startLiveCaptions);
  captionsStop.addEventListener('click', function () { stopLiveCaptions(false); });
  captionsLanguage.addEventListener('change', syncCaptionAccessibility);
  captionsTargetLanguage.addEventListener('change', function () { syncCaptionAccessibility(); if (captionActive) sendCaptionState(); });
  captionsGlossary.addEventListener('input', function () { syncCaptionAccessibility(); if (captionActive) sendCaptionState(); });
  coachSkip.addEventListener('click', function () {
    var skipIndex = Number(coachSkip.dataset.skipIndex);
    if (!Number.isFinite(skipIndex) || skipIndex < currentIndex || skipIndex >= slides.length - 1) return;
    var landingIndex = skipIndex + 1;
    if (remoteMode) broadcast({type: 'command', command: 'skip', index: landingIndex});
    else goLocal(landingIndex);
  });
  fullscreenButton.addEventListener('click', function () {
    if (document.fullscreenElement) document.exitFullscreen().catch(function () {});
    else if (document.documentElement.requestFullscreen) document.documentElement.requestFullscreen().catch(function () {});
  });
  document.getElementById('presenterRemoteOpen').addEventListener('click', function () {
    var url = new URL(location.href); url.searchParams.set('presenter', '1'); url.searchParams.set('remote', '1');
    window.open(url, 'admira-presenter-remote', 'popup=yes,width=460,height=820');
  });
  document.getElementById('presenterAudienceLaunch').addEventListener('click', function () {
    var url = new URL(location.href);
    url.searchParams.delete('remote');
    url.searchParams.set('audience', '1');
    audienceConnected = false;
    audiencePrivacyVerified = false;
    launchScreenStatus = 'Screen Details: esperando respuesta del navegador.';
    launchFullscreenStatus = 'Pantalla completa: esperando que cargue la salida de audiencia.';
    audienceWindow = window.open(url, 'admira-presenter-audience', 'popup=yes');
    if (!audienceWindow) {
      launchScreenStatus = 'Ventana de audiencia bloqueada por el navegador.';
      launchFullscreenStatus = 'Pantalla completa no solicitada porque no se abrió la audiencia.';
      setLaunchState('blocked', 'Permite ventanas emergentes y pulsa de nuevo. No compartas la ventana de control.');
      setLaunchChecklist([
        'BLOQUEADO: no existe una salida de audiencia separada.',
        launchScreenStatus,
        launchFullscreenStatus,
        'No molestar: actívalo manualmente antes de compartir.'
      ]);
      return;
    }
    document.documentElement.classList.add('presenter-launch-confirmed');
    refreshLaunchAssistant();
    configureAudienceDisplay(audienceWindow);
  });
  addEventListener('keydown', function (event) {
    if (event.defaultPrevented || event.target?.closest?.('input,textarea,select,button,[contenteditable="true"]')) return;
    if (event.key.toLowerCase() === 'p') { event.preventDefault(); panel.hidden ? openPanel() : closePanel(); }
  });
  addEventListener('scroll', function () {
    var index = nearestSlide();
    if (programmaticNavigationTarget >= 0) {
      if (index === programmaticNavigationTarget) {
        programmaticNavigationTarget = -1;
        programmaticNavigationUntil = 0;
        return;
      }
      if (Date.now() < programmaticNavigationUntil) return;
      programmaticNavigationTarget = -1;
      programmaticNavigationUntil = 0;
    }
    if (index !== currentIndex) { recordSlideTransition(index, elapsedSeconds(), running); render(); }
  }, {passive: true});
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
  addEventListener('pagehide', function () { persistSession(true); stopLiveCaptions(true); if (captionAccessibility) captionAccessibility.destroy(); if (channel) channel.close(); stopPrompt(true); }, {once: true});
  setInterval(function () {
    if (running && !document.hidden) render();
    if (remoteMode && lastStageSignalAt && Date.now() - lastStageSignalAt > 4000) {
      remoteState.textContent = 'Reconectando con la presentación…';
      setConnection('↻ Reconectando control…', 'is-reconnecting');
      broadcast({type: 'ready'});
    }
  }, 500);

  if (!navigator.onLine) setConnection('● Sin conexión · modo seguro', 'is-offline');
  initializeCaptionControls();
  refreshLaunchAssistant();
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
