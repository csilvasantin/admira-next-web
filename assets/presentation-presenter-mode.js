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
  var calibrationStorageKey = 'admira.presenter.calibration.v1';
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
  var audienceOutputLaunched = false;
  var audienceLaunchedAt = 0;
  var lastAudienceSignalAt = 0;
  var lastMirrorSignalAt = 0;
  var audienceMediaHealth = {muted: false, ended: false, kind: ''};
  var presentationShareGuardian = null;
  var shareGuardianSnapshot = null;
  var shareGuardianBusy = false;
  var productionBackchannel = null;
  var productionBackchannelUnsubscribe = null;
  var productionBackchannelSnapshot = null;
  var productionBackchannelRole = 'presenter';
  var productionBackchannelTimer = 0;
  var speakerHandoff = null;
  var speakerHandoffUnsubscribe = null;
  var speakerHandoffSnapshot = null;
  var speakerHandoffTimer = 0;
  var speakerHandoffActiveId = '';
  var speakerHandoffContexts = Object.create(null);
  var speakerHandoffSequence = 0;
  var speakerHandoffTransientPhase = '';
  var speakerHandoffTransientUntil = 0;
  var speakerHandoffQueueSignature = '';
  var stagePaused = false;
  var stagePauseSnapshot = null;
  var launchScreenStatus = 'Screen Details: pendiente de comprobar tras el gesto.';
  var launchFullscreenStatus = 'Pantalla completa: pendiente de solicitar.';
  var paceCoachApi = window.AdmiraPresentationPaceCoach || null;
  var paceSamples = [];
  var slideEnteredAt = 0;
  var stableCoachAdvice = null;
  var programmaticNavigationTarget = -1;
  var programmaticNavigationUntil = 0;
  var remoteSession = null;
  var remoteCommandPollTimer = 0;
  var remoteCommandPollBusy = false;
  var remoteStatePushTimer = 0;
  var remoteStatePushBusy = false;
  var remoteStatePushQueued = false;
  var remotePairingUrl = '';

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
    '<div class="presenter-controls compact"><button type="button" id="presenterTimerToggle">Iniciar tiempo</button><button type="button" id="presenterTimerReset">Reiniciar</button><button type="button" id="presenterStagePause" class="presenter-stage-pause" aria-pressed="false" aria-keyshortcuts="B" data-presenter-private>Pausa escénica · B</button><button type="button" id="presenterFullscreen" aria-pressed="false">Pantalla completa</button><label>Duración <input id="presenterDuration" type="number" min="5" max="180" step="1" inputmode="numeric" aria-label="Duración prevista en minutos"> min</label></div>' +
    '<section class="presenter-prompt" aria-labelledby="presenterPromptTitle"><div class="presenter-prompt-head"><strong id="presenterPromptTitle">Notas del orador</strong><div><button type="button" id="presenterPromptSmaller" aria-label="Reducir texto">A−</button><button type="button" id="presenterPromptLarger" aria-label="Aumentar texto">A+</button></div></div>' +
    '<div id="presenterNotes" class="presenter-notes" tabindex="0"></div><div class="presenter-prompt-actions"><button type="button" id="presenterPromptToggle">▶ Teleprompter</button><label>Velocidad <input id="presenterPromptSpeed" type="range" min="1" max="3" step="1" aria-label="Velocidad del teleprompter"></label></div></section>' +
    '<div class="presenter-next"><span>Siguiente</span><strong id="presenterNextTitle">Fin de la presentación</strong></div>' +
    '<section id="presenterCaptions" class="presenter-prompt" aria-labelledby="presenterCaptionsTitle"><div class="presenter-prompt-head"><div><span>Solo control privado</span><strong id="presenterCaptionsTitle">Subtítulos en vivo</strong></div><span id="presenterCaptionsStatus" role="status" aria-live="polite">Comprobando compatibilidad…</span></div>' +
    '<div class="presenter-controls compact presenter-caption-languages"><label>Idioma de entrada <select id="presenterCaptionsLanguage" aria-label="Idioma de reconocimiento"><option value="es-ES">Español (España)</option><option value="en-US">English (US)</option><option value="ca-ES">Català</option><option value="fr-FR">Français</option><option value="de-DE">Deutsch</option><option value="it-IT">Italiano</option><option value="pt-PT">Português</option></select></label><label>Traducción para audiencia <select id="presenterCaptionsTargetLanguage" aria-label="Idioma de traducción para la audiencia"><option value="en">English</option><option value="es">Español</option><option value="ca">Català</option><option value="fr">Français</option><option value="de">Deutsch</option><option value="it">Italiano</option><option value="pt">Português</option></select></label><button type="button" id="presenterCaptionsStart">Iniciar subtítulos</button><button type="button" id="presenterCaptionsStop" disabled>Detener subtítulos</button></div>' +
    '<label class="presenter-caption-glossary" for="presenterCaptionsGlossary"><span>Glosario efímero <small id="presenterCaptionsGlossaryStatus">vacío · solo memoria</small></span><textarea id="presenterCaptionsGlossary" rows="3" spellcheck="false" placeholder="Admira Next = Admira Next&#10;Smart Room = Sala Inteligente"></textarea></label>' +
    '<div id="presenterCaptionsPreview" aria-live="off"><p><strong>Final:</strong> <span id="presenterCaptionsFinal">—</span></p><p><strong>Provisional:</strong> <span id="presenterCaptionsInterim">—</span></p></div><p>El original aparece de inmediato; la traducción local lo sustituye cuando termina. Texto y glosario son efímeros: no se guardan ni salen del canal local.</p></section>' +
    '<section id="presenterRoomCalibration" class="presenter-room-calibration" data-presenter-private aria-labelledby="presenterCalibrationTitle"><div class="presenter-room-calibration-head"><div><span>Preparación de sala</span><strong id="presenterCalibrationTitle">Calibración visual de sala</strong></div><span id="presenterCalibrationStatus" role="status" aria-live="polite">Comprobando esta pantalla…</span></div>' +
    '<p>Ajusta el patrón en la pantalla que vas a usar. El perfil se guarda únicamente para su resolución y densidad actuales.</p><div class="presenter-calibration-actions"><button type="button" id="presenterCalibrationToggle" aria-controls="presenterCalibrationPattern" aria-expanded="false" aria-pressed="false">Abrir patrón</button></div>' +
    '<div class="presenter-calibration-controls"><label>Margen seguro <input id="presenterCalibrationSafeMargin" type="range" min="0" max="15" step="1" value="5"><output id="presenterCalibrationSafeMarginValue">5%</output></label><label>Contraste <input id="presenterCalibrationContrast" type="range" min="70" max="140" step="1" value="100"><output id="presenterCalibrationContrastValue">100%</output></label><label>Gamma <input id="presenterCalibrationGamma" type="range" min="0.6" max="1.4" step="0.05" value="1"><output id="presenterCalibrationGammaValue">1.00</output></label><label>Escala <input id="presenterCalibrationScale" type="range" min="80" max="120" step="1" value="100"><output id="presenterCalibrationScaleValue">100%</output></label></div>' +
    '<div class="presenter-calibration-actions"><button type="button" id="presenterCalibrationSave">Guardar perfil de pantalla</button><button type="button" id="presenterCalibrationReset">Restablecer esta pantalla</button></div></section>' +
    '<section id="presenterLaunchAssistant" class="presenter-launch-assistant" data-launch-state="warning" aria-live="polite" aria-labelledby="presenterLaunchTitle"><div class="presenter-launch-assistant-head"><div><span>Preparación de sala</span><strong id="presenterLaunchTitle">Lanzamiento seguro en sala</strong></div><span id="presenterLaunchState" class="presenter-launch-state">Revisión necesaria</span></div>' +
    '<ul id="presenterLaunchChecklist" class="presenter-launch-checklist"><li>Salida de audiencia: pendiente de verificación.</li><li>Screen Details y Pantalla completa se comprobarán al lanzar.</li><li>No molestar: revisión manual obligatoria.</li></ul>' +
    '<div class="presenter-launch-actions"><button type="button" id="presenterAudienceLaunch" aria-describedby="presenterLaunchFallback">Abrir salida de audiencia</button></div>' +
    '<p id="presenterLaunchFallback" class="presenter-launch-fallback">La Web no puede garantizar otras ventanas ni activar No molestar. Revisa manualmente el escritorio antes de compartir.</p></section>' +
    '<section id="presenterShareGuardian" class="presenter-share-guardian" data-guardian-state="warning" data-presenter-private aria-labelledby="presenterShareGuardianTitle"><div class="presenter-share-guardian-head"><div><span>Solo control privado</span><strong id="presenterShareGuardianTitle">Guardián de salida</strong></div><span id="presenterShareGuardianState" role="status" aria-live="polite">Sin verificar</span></div>' +
    '<dl class="presenter-share-guardian-metrics"><div><dt>Superficie</dt><dd id="presenterShareSurface">No seleccionada</dd></div><div><dt>Señal</dt><dd id="presenterShareSignal">Sin captura</dd></div><div><dt>Heartbeat</dt><dd id="presenterAudienceHeartbeat">Esperando audiencia</dd></div></dl>' +
    '<div class="presenter-audience-mirror"><div><strong>Espejo privado de audiencia</strong><span id="presenterMirrorState">Iniciando comprobación segura…</span></div><iframe id="presenterAudienceMirror" title="Espejo privado de la salida de audiencia, sin notas del presentador" sandbox="allow-scripts allow-same-origin" referrerpolicy="no-referrer" tabindex="-1"></iframe></div>' +
    '<button type="button" id="presenterShareGuardianAction" class="presenter-share-guardian-action" aria-describedby="presenterShareGuardianFallback">Seleccionar y compartir salida</button>' +
    '<ul id="presenterShareAlerts" class="presenter-share-alerts" role="alert" aria-live="assertive" aria-atomic="true"></ul>' +
    '<p id="presenterShareGuardianFallback" class="presenter-share-guardian-fallback">Si el guardián de captura no está disponible, se abrirá una salida separada y tendrás que verificar y compartir esa ventana manualmente.</p></section>' +
    '<section id="presenterSpeakerHandoff" class="presenter-speaker-handoff" data-handoff-state="degraded" data-presenter-private aria-labelledby="presenterHandoffTitle"><div class="presenter-speaker-handoff-head"><div><span>Solo control privado</span><strong id="presenterHandoffTitle">Relevo entre ponentes</strong></div><span id="presenterHandoffState" role="status" aria-live="polite">Motor no disponible</span></div>' +
    '<div class="presenter-speaker-active"><span>Ponente activo</span><strong id="presenterHandoffActive" tabindex="-1">Sin asignar</strong><output id="presenterHandoffCountdown" aria-live="off">Listo</output></div>' +
    '<ol id="presenterHandoffQueue" class="presenter-speaker-queue" aria-label="Cola editable de ponentes"></ol>' +
    '<form id="presenterHandoffAdd" class="presenter-speaker-add" aria-label="Añadir ponente a la cola"><label for="presenterHandoffName">Nombre del ponente</label><div><input id="presenterHandoffName" name="speakerName" type="text" maxlength="80" autocomplete="off" placeholder="Nombre"><button type="submit">Añadir</button></div></form>' +
    '<div class="presenter-speaker-actions" aria-label="Controles de relevo"><button type="button" id="presenterHandoffRequest" aria-describedby="presenterHandoffFeedback">Solicitar relevo</button><button type="button" id="presenterHandoffAccept" aria-describedby="presenterHandoffFeedback">Aceptar relevo</button><button type="button" id="presenterHandoffCancel" aria-describedby="presenterHandoffFeedback">Cancelar</button></div>' +
    '<p id="presenterHandoffFeedback" class="presenter-speaker-feedback" role="status" aria-live="polite" aria-atomic="true">La cola y las posiciones de lectura solo existen en este control privado.</p></section>' +
    '<section id="presenterProductionBackchannel" class="presenter-production-backchannel" data-backchannel-state="unavailable" data-presenter-private aria-labelledby="presenterBackchannelTitle"><div class="presenter-production-backchannel-head"><div><span>Solo control privado</span><strong id="presenterBackchannelTitle">Backchannel de producción</strong></div><span id="presenterBackchannelState" role="status" aria-live="polite">Cargando motor…</span></div>' +
    '<div class="presenter-backchannel-mode"><button type="button" id="presenterBackchannelMode" aria-pressed="false" aria-describedby="presenterBackchannelModeHelp">Activar modo operador</button><small id="presenterBackchannelModeHelp">Presentador: recibe y acusa cues. Operador: los redacta y envía.</small></div>' +
    '<form id="presenterBackchannelComposer" class="presenter-backchannel-composer" aria-label="Enviar cue de producción" hidden><label>Prioridad <select id="presenterBackchannelPriority"><option value="normal">Normal</option><option value="high">Alta</option><option value="urgent">Urgente</option></select></label><label>Caducidad <span><input id="presenterBackchannelTtl" type="number" min="5" max="300" step="5" value="30" inputmode="numeric" aria-describedby="presenterBackchannelTtlHelp"> s</span></label><label class="presenter-backchannel-message">Cue <textarea id="presenterBackchannelText" rows="2" maxlength="240" placeholder="Ej.: quedan 2 minutos para preguntas" required></textarea></label><button type="submit" id="presenterBackchannelSend">Enviar cue</button></form>' +
    '<small id="presenterBackchannelTtlHelp" class="presenter-backchannel-help">Los cues duran entre 5 y 300 segundos y no se guardan desde esta interfaz.</small><p id="presenterBackchannelFeedback" class="presenter-backchannel-feedback" role="status" aria-live="polite">Esperando el motor local de producción.</p><ul id="presenterBackchannelCues" class="presenter-backchannel-cues" aria-label="Cues de producción activos" aria-live="polite" aria-relevant="additions text"></ul></section>' +
    '<section class="presenter-remote" data-remote-state="idle" data-presenter-private aria-labelledby="presenterRemoteTitle"><div class="presenter-remote-head"><div><span>Control privado</span><strong id="presenterRemoteTitle">Mando móvil entre dispositivos</strong></div><span id="presenterRemoteState" role="status" aria-live="polite">Sin sesión activa</span></div>' +
    '<p>La sesión es efímera. El móvil recibe solo número de diapositiva, tiempo y ritmo; nunca notas, teleprompter ni contenido.</p>' +
    '<div class="presenter-remote-actions"><button type="button" id="presenterRemoteCreate">Crear enlace de 4 horas</button><button type="button" id="presenterRemoteOpen">Fallback en este navegador</button></div>' +
    '<div id="presenterRemotePairing" class="presenter-remote-pairing" hidden><label>Enlace de emparejamiento <input id="presenterRemoteLink" type="text" readonly spellcheck="false" autocomplete="off"></label><label>Código de un uso <input id="presenterRemoteCode" type="text" readonly spellcheck="false" autocomplete="off"></label><div><button type="button" id="presenterRemoteCopy">Copiar enlace</button><button type="button" id="presenterRemoteLaunch">Abrir mando</button><button type="button" id="presenterRemoteRevoke">Revocar</button></div><small id="presenterRemoteExpiry"></small></div>' +
    '<small class="presenter-remote-fallback">El fallback solo controla otra pestaña del mismo navegador; no conecta un teléfono.</small></section>';
  document.body.appendChild(panel);

  var calibrationPattern = document.createElement('div');
  calibrationPattern.id = 'presenterCalibrationPattern';
  calibrationPattern.className = 'presenter-calibration-pattern';
  calibrationPattern.hidden = true;
  calibrationPattern.setAttribute('aria-hidden', 'true');
  calibrationPattern.setAttribute('data-presenter-private', '');
  calibrationPattern.innerHTML = '<div class="presenter-calibration-grid" aria-hidden="true"><i></i><i></i><i></i><i></i></div><div class="presenter-calibration-target" aria-hidden="true"><i></i><i></i></div><div class="presenter-calibration-ramp" aria-hidden="true"><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i></div><span class="presenter-calibration-label">Patrón de sala · ajusta desde el control privado</span>';
  document.body.appendChild(calibrationPattern);

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
  var remotePanel = panel.querySelector('.presenter-remote');
  var remoteCreate = document.getElementById('presenterRemoteCreate');
  var remotePairing = document.getElementById('presenterRemotePairing');
  var remoteLink = document.getElementById('presenterRemoteLink');
  var remoteCode = document.getElementById('presenterRemoteCode');
  var remoteExpiry = document.getElementById('presenterRemoteExpiry');
  var connectionState = document.getElementById('presenterConnection');
  var cacheState = document.getElementById('presenterCacheState');
  var recoveryPanel = document.getElementById('presenterRecovery');
  var recoverySummary = document.getElementById('presenterRecoverySummary');
  var stagePauseButton = document.getElementById('presenterStagePause');
  var fullscreenButton = document.getElementById('presenterFullscreen');
  var launchAssistant = document.getElementById('presenterLaunchAssistant');
  var launchChecklist = document.getElementById('presenterLaunchChecklist');
  var launchFallback = document.getElementById('presenterLaunchFallback');
  var launchState = document.getElementById('presenterLaunchState');
  var SourceTraceability = window.AdmiraSourceTraceability || null;
  var sourceTraceability = window.__ADMIRA_SOURCE_TRACEABILITY__ || null;
  var compatibilityLab = window.__ADMIRA_COMPATIBILITY_LAB__ || null;
  var shareGuardianPanel = document.getElementById('presenterShareGuardian');
  var shareGuardianState = document.getElementById('presenterShareGuardianState');
  var shareGuardianAction = document.getElementById('presenterShareGuardianAction');
  var shareGuardianFallback = document.getElementById('presenterShareGuardianFallback');
  var shareSurface = document.getElementById('presenterShareSurface');
  var shareSignal = document.getElementById('presenterShareSignal');
  var audienceHeartbeat = document.getElementById('presenterAudienceHeartbeat');
  var audienceMirror = document.getElementById('presenterAudienceMirror');
  var mirrorState = document.getElementById('presenterMirrorState');
  var shareAlerts = document.getElementById('presenterShareAlerts');
  var speakerHandoffPanel = document.getElementById('presenterSpeakerHandoff');
  var speakerHandoffState = document.getElementById('presenterHandoffState');
  var speakerHandoffActive = document.getElementById('presenterHandoffActive');
  var speakerHandoffCountdown = document.getElementById('presenterHandoffCountdown');
  var speakerHandoffQueue = document.getElementById('presenterHandoffQueue');
  var speakerHandoffAdd = document.getElementById('presenterHandoffAdd');
  var speakerHandoffName = document.getElementById('presenterHandoffName');
  var speakerHandoffRequest = document.getElementById('presenterHandoffRequest');
  var speakerHandoffAccept = document.getElementById('presenterHandoffAccept');
  var speakerHandoffCancel = document.getElementById('presenterHandoffCancel');
  var speakerHandoffFeedback = document.getElementById('presenterHandoffFeedback');
  var productionBackchannelPanel = document.getElementById('presenterProductionBackchannel');
  var productionBackchannelState = document.getElementById('presenterBackchannelState');
  var productionBackchannelMode = document.getElementById('presenterBackchannelMode');
  var productionBackchannelComposer = document.getElementById('presenterBackchannelComposer');
  var productionBackchannelPriority = document.getElementById('presenterBackchannelPriority');
  var productionBackchannelTtl = document.getElementById('presenterBackchannelTtl');
  var productionBackchannelText = document.getElementById('presenterBackchannelText');
  var productionBackchannelSend = document.getElementById('presenterBackchannelSend');
  var productionBackchannelFeedback = document.getElementById('presenterBackchannelFeedback');
  var productionBackchannelCues = document.getElementById('presenterBackchannelCues');
  var calibrationToggle = document.getElementById('presenterCalibrationToggle');
  var calibrationSafeMargin = document.getElementById('presenterCalibrationSafeMargin');
  var calibrationContrast = document.getElementById('presenterCalibrationContrast');
  var calibrationGamma = document.getElementById('presenterCalibrationGamma');
  var calibrationScale = document.getElementById('presenterCalibrationScale');
  var calibrationStatus = document.getElementById('presenterCalibrationStatus');
  var calibrationProfileSaved = false;
  var calibrationProfileDirty = false;
  var calibrationDefaults = {safeMargin: 5, contrast: 100, gamma: 1, scale: 100};
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
    var audienceEmbedded = window.self !== window.top || query.get('mirror') === '1';
    var audienceStagePaused = false;
    var audiencePauseSnapshot = null;
    var cursorTimer = 0;
    var heartbeatTimer = 0;
    var audienceWaiting = document.createElement('div');
    var audienceWaitingBrand = document.createElement('strong');
    var audienceWaitingTitle = document.createElement('span');
    var audienceWaitingDetail = document.createElement('small');

    audienceWaiting.className = 'presenter-stage-waiting';
    audienceWaiting.hidden = true;
    audienceWaiting.setAttribute('role', 'status');
    audienceWaiting.setAttribute('aria-live', 'polite');
    audienceWaitingBrand.textContent = 'ADMIRA';
    audienceWaitingTitle.textContent = 'Volvemos enseguida';
    audienceWaitingDetail.textContent = 'La presentación continuará en unos instantes.';
    audienceWaiting.appendChild(audienceWaitingBrand);
    audienceWaiting.appendChild(audienceWaitingTitle);
    audienceWaiting.appendChild(audienceWaitingDetail);
    document.body.appendChild(audienceWaiting);
    var audienceReceivedMessageIds = [];
    var AudienceCaptionContract = window.AdmiraPresenterCaptions || null;
    var audienceCaptions = privacyReady && AudienceCaptionContract && typeof AudienceCaptionContract.create === 'function'
      ? AudienceCaptionContract.create({document: document, sourceLanguage: 'es', targetLanguage: 'es', label: 'Subtítulos en vivo para la audiencia'})
      : null;
    var ShareGuardianContract = window.AdmiraPresentationShareGuardian || null;
    var audienceShareGuardian = ShareGuardianContract && typeof ShareGuardianContract.create === 'function'
      ? ShareGuardianContract.create({role: 'audience', channelName: channelName})
      : null;
    if (audienceCaptions) audienceCaptions.mount(document.body);
    if (audienceShareGuardian && typeof audienceShareGuardian.start === 'function') audienceShareGuardian.start();

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
      try {
        if (!audienceEmbedded && window.opener && !window.opener.closed) window.opener.postMessage(payload, location.origin);
        if (audienceEmbedded && window.parent !== window) window.parent.postMessage(payload, location.origin);
      } catch (_) {}
    }

    function audienceGo(index) {
      audienceIndex = clamp(Number(index) || 0, 0, slides.length - 1);
      slides[audienceIndex].scrollIntoView({behavior: 'auto'});
    }

    function captureMedia() {
      return Array.prototype.slice.call(document.querySelectorAll('video,audio')).map(function (media, index) {
        return {index: index, time: Number.isFinite(media.currentTime) ? media.currentTime : 0, paused: media.paused};
      });
    }

    function pauseMedia(items) {
      items.forEach(function (saved) {
        var media = document.querySelectorAll('video,audio')[saved.index];
        if (media) try { media.pause(); media.currentTime = saved.time; } catch (_) {}
      });
    }

    function restoreMedia(items) {
      items.forEach(function (saved) {
        var media = document.querySelectorAll('video,audio')[saved.index];
        if (!media) return;
        try {
          media.currentTime = saved.time;
          if (!saved.paused) media.play().catch(function () {}); else media.pause();
        } catch (_) {}
      });
    }

    function audienceTrackHealth() {
      var slide = slides[audienceIndex];
      var media = slide && slide.querySelector('video,audio');
      if (!media) return {muted: false, ended: false, kind: ''};
      return {
        muted: Boolean(media.muted && !media.paused && !media.ended),
        ended: Boolean(media.ended),
        kind: media.tagName.toLowerCase()
      };
    }

    function sendAudienceHeartbeat(type) {
      var media = audienceTrackHealth();
      audienceSend({
        type: type || 'audience-heartbeat',
        privacyReady: privacyReady,
        embedded: audienceEmbedded,
        visible: !document.hidden,
        index: audienceIndex,
        media: media
      });
    }

    function setAudienceStagePaused(paused, index) {
      paused = Boolean(paused);
      if (audienceStagePaused === paused) return;
      if (paused) {
        if (Number.isFinite(Number(index))) audienceGo(Number(index));
        audiencePauseSnapshot = {index: audienceIndex, media: captureMedia()};
        pauseMedia(audiencePauseSnapshot.media);
        audienceStagePaused = true;
        audienceWaiting.hidden = false;
        document.documentElement.classList.add('presenter-stage-paused');
        return;
      }
      audienceStagePaused = false;
      audienceWaiting.hidden = true;
      document.documentElement.classList.remove('presenter-stage-paused');
      if (audiencePauseSnapshot) {
        audienceGo(audiencePauseSnapshot.index);
        restoreMedia(audiencePauseSnapshot.media);
      }
      audiencePauseSnapshot = null;
    }

    function audienceReceive(payload) {
      if (!payload || payload.source === 'audience') return;
      if (payload.messageId && audienceReceivedMessageIds.indexOf(payload.messageId) >= 0) return;
      if (payload.messageId) {
        audienceReceivedMessageIds.push(payload.messageId);
        if (audienceReceivedMessageIds.length > 100) audienceReceivedMessageIds.shift();
      }
      if (payload.type === 'stage-pause' && payload.source === 'stage') {
        setAudienceStagePaused(Boolean(payload.paused), payload.index);
        return;
      }
      if (!audienceStagePaused && payload.source === 'stage' && (payload.type === 'command' || payload.type === 'state')) audienceGo(payload.index);
      if (payload.type === 'captions' && payload.source === 'stage' && privacyReady) {
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
    addEventListener('message', function (event) {
      if (event.origin !== location.origin || event.source !== window.opener) return;
      audienceReceive(event.data);
    });
    addEventListener('pointermove', hideAudienceCursorSoon, {passive: true});
    addEventListener('focus', hideAudienceCursorSoon);
    addEventListener('pagehide', function () {
      clearTimeout(cursorTimer);
      clearInterval(heartbeatTimer);
      if (audienceChannel) audienceChannel.close();
      if (audienceCaptions) audienceCaptions.destroy();
      if (audienceShareGuardian) {
        if (typeof audienceShareGuardian.destroy === 'function') audienceShareGuardian.destroy();
        else if (typeof audienceShareGuardian.stop === 'function') audienceShareGuardian.stop();
      }
    }, {once: true});
    hideAudienceCursorSoon();
    sendAudienceHeartbeat('audience-ready');
    heartbeatTimer = setInterval(function () { sendAudienceHeartbeat('audience-heartbeat'); }, 1500);
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

  function calibrationScreenSignature() {
    var width = typeof screen !== 'undefined' ? Math.max(0, Math.round(Number(screen.width) || 0)) : 0;
    var height = typeof screen !== 'undefined' ? Math.max(0, Math.round(Number(screen.height) || 0)) : 0;
    var density = Math.max(0.1, Number(window.devicePixelRatio) || 1);
    return width + 'x' + height + '@' + Number(density.toFixed(2));
  }

  function readCalibrationProfiles() {
    try {
      var profiles = JSON.parse(localStorage.getItem(calibrationStorageKey) || '{}');
      return profiles && typeof profiles === 'object' && !Array.isArray(profiles) ? profiles : {};
    } catch (_) { return {}; }
  }

  function calibrationNumber(value, fallback, min, max) {
    var number = Number(value);
    return Number.isFinite(number) ? clamp(number, min, max) : fallback;
  }

  function normalizeCalibrationProfile(value) {
    value = value && typeof value === 'object' ? value : {};
    return {
      safeMargin: calibrationNumber(value.safeMargin, calibrationDefaults.safeMargin, 0, 15),
      contrast: calibrationNumber(value.contrast, calibrationDefaults.contrast, 70, 140),
      gamma: calibrationNumber(value.gamma, calibrationDefaults.gamma, 0.6, 1.4),
      scale: calibrationNumber(value.scale, calibrationDefaults.scale, 80, 120)
    };
  }

  function calibrationInputProfile() {
    return normalizeCalibrationProfile({
      safeMargin: calibrationSafeMargin.value,
      contrast: calibrationContrast.value,
      gamma: calibrationGamma.value,
      scale: calibrationScale.value
    });
  }

  function applyCalibrationProfile(profile, status) {
    profile = normalizeCalibrationProfile(profile);
    var scale = profile.scale / 100;
    var calibrationProperties = {
      '--presenter-calibration-safe': profile.safeMargin + '%',
      '--presenter-calibration-contrast': profile.contrast + '%',
      '--presenter-calibration-gamma': String(profile.gamma),
      '--presenter-calibration-scale': String(scale),
      '--presenter-calibration-bar-height': Number(14 * scale).toFixed(2) + '%',
      '--presenter-calibration-grid-size': Number(100 / scale).toFixed(2) + '%',
      '--presenter-calibration-border-alpha': String(clamp((profile.contrast - 40) / 100, 0, 1)),
      '--presenter-calibration-text-alpha': String(clamp((profile.contrast - 30) / 100, 0, 1)),
      '--presenter-calibration-gamma-alpha': String(clamp(0.54 + (0.08 * profile.gamma), 0, 1))
    };
    calibrationSafeMargin.value = String(profile.safeMargin);
    calibrationContrast.value = String(profile.contrast);
    calibrationGamma.value = String(profile.gamma);
    calibrationScale.value = String(profile.scale);
    document.getElementById('presenterCalibrationSafeMarginValue').textContent = profile.safeMargin + '%';
    document.getElementById('presenterCalibrationContrastValue').textContent = profile.contrast + '%';
    document.getElementById('presenterCalibrationGammaValue').textContent = Number(profile.gamma).toFixed(2);
    document.getElementById('presenterCalibrationScaleValue').textContent = profile.scale + '%';
    Object.keys(calibrationProperties).forEach(function (property) {
      document.documentElement.style.setProperty(property, calibrationProperties[property]);
      // Mirror the resolved values on the pattern so its stylesheet fallbacks
      // cannot shadow the live preview in the custom-property cascade.
      calibrationPattern.style.setProperty(property, calibrationProperties[property]);
    });
    calibrationStatus.textContent = status;
  }

  function calibrationChecklistStatus() {
    var signature = calibrationScreenSignature();
    if (calibrationProfileDirty) return 'Calibración visual: hay una vista previa sin guardar para ' + signature + '.';
    if (calibrationProfileSaved) return 'Calibración visual verificada: perfil restaurado para ' + signature + '.';
    return 'Calibración visual: pendiente de guardar un perfil para ' + signature + '.';
  }

  function restoreCalibrationProfile() {
    var signature = calibrationScreenSignature();
    var stored = readCalibrationProfiles()[signature];
    calibrationProfileSaved = Boolean(stored && typeof stored === 'object');
    calibrationProfileDirty = false;
    applyCalibrationProfile(
      calibrationProfileSaved ? stored : calibrationDefaults,
      calibrationProfileSaved ? 'Perfil restaurado · ' + signature : 'Sin perfil guardado · ' + signature
    );
  }

  function previewCalibrationProfile() {
    calibrationProfileDirty = true;
    calibrationProfileSaved = false;
    applyCalibrationProfile(calibrationInputProfile(), 'Vista previa sin guardar · ' + calibrationScreenSignature());
    refreshLaunchAssistant();
  }

  function saveCalibrationProfile() {
    var signature = calibrationScreenSignature();
    var profiles = readCalibrationProfiles();
    profiles[signature] = calibrationInputProfile();
    try {
      localStorage.setItem(calibrationStorageKey, JSON.stringify(profiles));
      calibrationProfileSaved = true;
      calibrationProfileDirty = false;
      applyCalibrationProfile(profiles[signature], 'Perfil guardado · ' + signature);
    } catch (_) {
      calibrationProfileSaved = false;
      calibrationProfileDirty = true;
      calibrationStatus.textContent = 'No se pudo guardar; la vista previa sigue activa.';
    }
    refreshLaunchAssistant();
  }

  function resetCalibrationProfile() {
    var signature = calibrationScreenSignature();
    var profiles = readCalibrationProfiles();
    delete profiles[signature];
    var storageReset = true;
    try {
      if (Object.keys(profiles).length) localStorage.setItem(calibrationStorageKey, JSON.stringify(profiles));
      else localStorage.removeItem(calibrationStorageKey);
    } catch (_) { storageReset = false; }
    calibrationProfileSaved = false;
    calibrationProfileDirty = !storageReset;
    applyCalibrationProfile(
      calibrationDefaults,
      storageReset ? 'Valores seguros restaurados · ' + signature : 'Valores seguros en vista previa; no se pudo borrar el perfil guardado.'
    );
    refreshLaunchAssistant();
  }

  function openCalibrationPattern() {
    calibrationPattern.hidden = false;
    calibrationPattern.setAttribute('aria-hidden', 'false');
    calibrationToggle.setAttribute('aria-expanded', 'true');
    calibrationToggle.setAttribute('aria-pressed', 'true');
    calibrationToggle.textContent = 'Cerrar patrón';
    document.documentElement.classList.add('presenter-calibration-active');
  }

  function closeCalibrationPattern() {
    document.documentElement.classList.remove('presenter-calibration-active');
    calibrationPattern.hidden = true;
    calibrationPattern.setAttribute('aria-hidden', 'true');
    calibrationToggle.setAttribute('aria-expanded', 'false');
    calibrationToggle.setAttribute('aria-pressed', 'false');
    calibrationToggle.textContent = 'Abrir patrón';
  }

  function toggleCalibrationPattern() {
    if (document.documentElement.classList.contains('presenter-calibration-active')) closeCalibrationPattern();
    else openCalibrationPattern();
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

  function traceabilityChecklistStatus() {
    if (!SourceTraceability || typeof SourceTraceability.checklistStatus !== 'function' || !sourceTraceability) {
      return 'Trazabilidad pendiente: esta presentación no tiene un registro de fuentes revisado. Compruébalo antes de presentar.';
    }
    return SourceTraceability.checklistStatus(sourceTraceability);
  }

  function compatibilityChecklistStatus() {
    var summary = compatibilityLab && compatibilityLab.summary;
    if (!summary || !Number.isFinite(Number(summary.total)) || Number(summary.total) < 1) {
      return 'Compatibilidad pendiente: esta presentación no tiene matriz de PowerPoint, Keynote, Google Slides, PDF y web.';
    }
    if (Number(summary.executed) === Number(summary.total) && Number(summary.failed) === 0) {
      return 'Compatibilidad ejecutada: ' + summary.executed + ' comprobaciones con evidencia de adaptador y ningún fallo.';
    }
    return 'Compatibilidad parcial: ' + Number(summary.executed || 0) + ' ejecutadas, ' +
      Number(summary.structural || 0) + ' analizadas estructuralmente y ' +
      Number(summary.unavailable || 0) + ' no disponibles. Revisa fallbacks antes de presentar.';
  }

  function refreshLaunchAssistant() {
    var privacyStatus = !audienceConnected
      ? 'Salida dedicada: pendiente; aún no se ha verificado que la audiencia no reciba notas.'
      : (audiencePrivacyVerified
        ? 'Salida dedicada verificada: la audiencia no recibió notas ni controles privados.'
        : 'BLOQUEADO: la salida de audiencia detectó datos o controles privados. No la compartas.');
    setLaunchChecklist([
      privacyStatus,
      traceabilityChecklistStatus(),
      compatibilityChecklistStatus(),
      launchScreenStatus,
      launchFullscreenStatus,
      calibrationChecklistStatus(),
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

  function audienceOutputUrl(mirror) {
    var url = new URL(location.href);
    url.searchParams.delete('remote');
    url.searchParams.delete('presenter');
    url.searchParams.set('audience', '1');
    if (mirror) url.searchParams.set('mirror', '1');
    else url.searchParams.delete('mirror');
    return url;
  }

  function launchAudienceOutput() {
    audienceConnected = false;
    audiencePrivacyVerified = false;
    audienceOutputLaunched = true;
    audienceLaunchedAt = Date.now();
    lastAudienceSignalAt = 0;
    launchScreenStatus = 'Screen Details: esperando respuesta del navegador.';
    launchFullscreenStatus = 'Pantalla completa: esperando que cargue la salida de audiencia.';
    audienceWindow = window.open(audienceOutputUrl(false), 'admira-presenter-audience', 'popup=yes');
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
      renderShareGuardian();
      return null;
    }
    document.documentElement.classList.add('presenter-launch-confirmed');
    refreshLaunchAssistant();
    configureAudienceDisplay(audienceWindow);
    renderShareGuardian();
    return audienceWindow;
  }

  function shareGuardianCapture() {
    var snapshot = shareGuardianSnapshot || {};
    return snapshot.capture && typeof snapshot.capture === 'object' ? snapshot.capture : {};
  }

  function shareGuardianAudience() {
    var snapshot = shareGuardianSnapshot || {};
    return snapshot.audience && typeof snapshot.audience === 'object' ? snapshot.audience : {};
  }

  function secondsAgo(timestamp) {
    if (!timestamp) return '';
    return Math.max(0, Math.floor((Date.now() - Number(timestamp)) / 1000)) + ' s';
  }

  function guardianSurfaceLabel(capture) {
    var surface = String(capture.displaySurface || '').toLowerCase();
    if (surface === 'window') return 'Ventana seleccionada (declarada por navegador)';
    if (surface === 'browser') return 'Pestaña seleccionada';
    if (surface === 'monitor') return 'Pantalla completa seleccionada';
    return capture.phase === 'live' ? 'Superficie sin identificar' : 'No seleccionada';
  }

  function guardianSignalLabel(capture) {
    var trackState = String(capture.trackState || '').toLowerCase();
    if (trackState === 'ended' || capture.phase === 'ended') return 'Pista finalizada';
    if (trackState === 'muted') return 'Pista silenciada';
    if (trackState === 'live' || capture.phase === 'live') return 'Señal activa';
    if (capture.phase === 'requesting') return 'Esperando selección…';
    if (capture.permission === 'denied' || capture.permission === 'denied-or-dismissed') return 'Permiso denegado o selección cancelada';
    if (capture.support === false || capture.phase === 'unsupported') return 'Captura no compatible';
    return 'Sin captura';
  }

  function renderShareGuardian() {
    if (!shareGuardianPanel) return;
    var capture = shareGuardianCapture();
    var guardianAudience = shareGuardianAudience();
    var alerts = [];
    var outputClosed = Boolean(audienceOutputLaunched && audienceWindow && audienceWindow.closed);
    var outputStale = Boolean(audienceOutputLaunched && !outputClosed && Date.now() - (lastAudienceSignalAt || audienceLaunchedAt) > 6000);
    var mirrorStale = Boolean(lastMirrorSignalAt && Date.now() - lastMirrorSignalAt > 6000);
    var captureMuted = capture.trackState === 'muted' || audienceMediaHealth.muted;
    var captureEnded = capture.trackState === 'ended' || capture.phase === 'ended' || audienceMediaHealth.ended;

    shareSurface.textContent = guardianSurfaceLabel(capture);
    shareSignal.textContent = guardianSignalLabel(capture);
    audienceHeartbeat.textContent = lastAudienceSignalAt
      ? 'Audiencia hace ' + secondsAgo(lastAudienceSignalAt)
      : (audienceOutputLaunched ? 'Esperando señal real' : 'Salida no abierta');
    mirrorState.textContent = lastMirrorSignalAt
      ? 'Privacidad confirmada · señal hace ' + secondsAgo(lastMirrorSignalAt)
      : 'Iniciando comprobación segura…';

    if (!presentationShareGuardian) alerts.push('Guardián de captura no disponible: verifica y comparte manualmente solo la ventana de audiencia.');
    if (capture.displaySurface === 'monitor') alerts.push('Se comparte una pantalla completa: confirma que no contiene notas ni otras ventanas privadas.');
    if (captureMuted) alerts.push('La pista de salida está silenciada.');
    if (captureEnded) alerts.push('La pista de salida ha finalizado.');
    if (outputClosed) alerts.push('La ventana de audiencia se ha cerrado.');
    else if (outputStale || guardianAudience.status === 'stale') alerts.push('La salida de audiencia está desactualizada o no responde.');
    if (audienceConnected && !audiencePrivacyVerified) alerts.push('La salida real detectó controles o datos privados: no la compartas.');
    if (mirrorStale) alerts.push('El espejo privado ha dejado de responder.');

    shareAlerts.replaceChildren();
    alerts.forEach(function (message) {
      var item = document.createElement('li');
      item.textContent = message;
      shareAlerts.appendChild(item);
    });
    shareAlerts.hidden = alerts.length === 0;

    var captureReady = capture.phase === 'live' && capture.trackState !== 'muted' && capture.trackState !== 'ended';
    var outputReady = audienceConnected && audiencePrivacyVerified && !outputStale && !outputClosed;
    var state = alerts.length ? 'blocked' : (captureReady && outputReady ? 'ready' : 'warning');
    shareGuardianPanel.dataset.guardianState = state;
    shareGuardianState.textContent = state === 'ready' ? 'Protección activa' : (state === 'blocked' ? 'Atención' : 'Pendiente');
    shareGuardianAction.disabled = shareGuardianBusy;
    shareGuardianAction.textContent = shareGuardianBusy
      ? 'Esperando selección…'
      : (!audienceOutputLaunched || outputClosed ? 'Abrir salida de audiencia primero' : 'Seleccionar y compartir salida');
    shareGuardianFallback.textContent = presentationShareGuardian
      ? 'El navegador pedirá una superficie. Elige únicamente la ventana de audiencia; el guardián no toma capturas automáticas.'
      : 'Guardián no disponible: se abrirá una salida separada, pero debes verificar y compartir esa ventana manualmente.';
  }

  function initializeShareGuardian() {
    var contract = window.AdmiraPresentationShareGuardian || null;
    if (!contract || typeof contract.create !== 'function') {
      presentationShareGuardian = null;
      renderShareGuardian();
      return;
    }
    try {
      presentationShareGuardian = contract.create({
        role: 'presenter',
        channelName: channelName,
        onChange: function (snapshot) {
          shareGuardianSnapshot = snapshot && typeof snapshot === 'object' ? snapshot : null;
          renderShareGuardian();
        }
      });
      if (presentationShareGuardian && typeof presentationShareGuardian.start === 'function') presentationShareGuardian.start();
      if (presentationShareGuardian && typeof presentationShareGuardian.getState === 'function') shareGuardianSnapshot = presentationShareGuardian.getState();
    } catch (_) {
      presentationShareGuardian = null;
      shareGuardianSnapshot = null;
    }
    renderShareGuardian();
  }

  function requestGuardianShare(event) {
    if (!audienceOutputLaunched || !audienceWindow || audienceWindow.closed) {
      launchAudienceOutput();
      shareGuardianFallback.textContent = 'La salida ya está abierta. Comprueba que cargó y pulsa de nuevo para seleccionar únicamente esa ventana.';
      renderShareGuardian();
      return;
    }
    if (!presentationShareGuardian || typeof presentationShareGuardian.requestShareFromGesture !== 'function') {
      renderShareGuardian();
      return;
    }
    shareGuardianBusy = true;
    renderShareGuardian();
    var request;
    try { request = presentationShareGuardian.requestShareFromGesture(event); }
    catch (_) { request = Promise.reject(new Error('share request failed')); }
    Promise.resolve(request).then(function (result) {
      if (result && result.state && typeof result.state === 'object') shareGuardianSnapshot = result.state;
    }).catch(function () {
      if (presentationShareGuardian && typeof presentationShareGuardian.getState === 'function') {
        shareGuardianSnapshot = presentationShareGuardian.getState();
      }
    }).finally(function () {
      shareGuardianBusy = false;
      renderShareGuardian();
    });
  }

  function speakerHandoffPresentationId(path) {
    return String(path || 'presentation')
      .replace(/[^A-Za-z0-9._:-]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 80) || 'presentation';
  }

  function speakerContextReference(context) {
    context = context && typeof context === 'object' ? context : {};
    return JSON.stringify({
      version: 1,
      notesScrollTop: clamp(Math.round(Number(context.notesScrollTop) || 0), 0, 10000000),
      promptPlaying: Boolean(context.promptPlaying)
    });
  }

  function parseSpeakerContextReference(value) {
    if (typeof value !== 'string' || !value || value.length > 1000) return null;
    try {
      var parsed = JSON.parse(value);
      if (!parsed || typeof parsed !== 'object' || parsed.version !== 1) return null;
      return {
        notesScrollTop: clamp(Math.round(Number(parsed.notesScrollTop) || 0), 0, 10000000),
        promptPlaying: Boolean(parsed.promptPlaying)
      };
    } catch (_) {
      return null;
    }
  }

  function shouldRestoreSpeakerContext(snapshot, speaker) {
    snapshot = snapshot && typeof snapshot === 'object' ? snapshot : {};
    var restored = snapshot.persistence && snapshot.persistence.status === 'restored';
    var usefulState = speaker && speaker.state && (
      Number(speaker.state.slideIndex) > 0 ||
      Boolean(speaker.state.notes) ||
      Boolean(speaker.state.reference)
    );
    return Boolean(restored || usefulState);
  }

  function speakerHandoffSpeakers(snapshot) {
    snapshot = snapshot && typeof snapshot === 'object' ? snapshot : {};
    var catalog = (Array.isArray(snapshot.speakers) ? snapshot.speakers : []).map(function (speaker, index) {
      if (typeof speaker === 'string') return {id: speaker, name: speaker};
      speaker = speaker && typeof speaker === 'object' ? speaker : {};
      return {
        id: String(speaker.id || speaker.speakerId || speaker.key || ('speaker-' + (index + 1))),
        name: String(speaker.name || speaker.label || speaker.displayName || ('Ponente ' + (index + 1))).trim().slice(0, 80),
        state: speaker.state && typeof speaker.state === 'object' ? speaker.state : null
      };
    });
    var byId = Object.create(null);
    catalog.forEach(function (speaker) { byId[speaker.id] = speaker; });
    var orderedIds = [];
    var controllerId = String(snapshot.controllerId || snapshot.activeSpeakerId || snapshot.activeId || '');
    if (controllerId) orderedIds.push(controllerId);
    (Array.isArray(snapshot.queue) ? snapshot.queue : []).forEach(function (speaker) {
      var id = String(typeof speaker === 'string' ? speaker : (speaker && (speaker.id || speaker.speakerId)) || '');
      if (id && orderedIds.indexOf(id) < 0) orderedIds.push(id);
    });
    if (!orderedIds.length) catalog.forEach(function (speaker) { orderedIds.push(speaker.id); });
    return orderedIds.map(function (id, index) {
      return byId[id] || {id: id, name: 'Ponente ' + (index + 1), state: null};
    });
  }

  function speakerHandoffActiveSpeaker(snapshot, speakers) {
    snapshot = snapshot && typeof snapshot === 'object' ? snapshot : {};
    var active = snapshot.activeSpeaker && typeof snapshot.activeSpeaker === 'object' ? snapshot.activeSpeaker : null;
    var activeId = String(snapshot.controllerId || snapshot.activeSpeakerId || snapshot.activeId || (active && (active.id || active.speakerId)) || '');
    return speakers.find(function (speaker) { return speaker.id === activeId; }) || active || null;
  }

  function speakerHandoffPhase(snapshot) {
    if (!speakerHandoff) return 'degraded';
    if (snapshot && snapshot.handoff && snapshot.handoff.status === 'countdown') return 'countdown';
    if (speakerHandoffTransientPhase && Date.now() < speakerHandoffTransientUntil) return speakerHandoffTransientPhase;
    var phase = String(snapshot && (snapshot.state || snapshot.status || snapshot.phase) || 'ready').toLowerCase();
    if (phase === 'pending' || phase === 'requested' || phase === 'requesting') return 'countdown';
    if (phase === 'accepted' || phase === 'complete' || phase === 'completed') return 'transferred';
    if (phase === 'canceled') return 'cancelled';
    return ['ready', 'countdown', 'transferred', 'cancelled', 'degraded'].indexOf(phase) >= 0 ? phase : 'ready';
  }

  function speakerHandoffRemainingMs(snapshot) {
    var handoff = snapshot && snapshot.handoff && typeof snapshot.handoff === 'object' ? snapshot.handoff : {};
    var explicit = Number(handoff.remainingMs ?? (snapshot && (snapshot.remainingMs ?? snapshot.countdownMs)));
    if (Number.isFinite(explicit)) return Math.max(0, explicit);
    var deadline = Number(handoff.executeAt || handoff.deadline || handoff.deadlineAt || handoff.expiresAt || (snapshot && (snapshot.deadline || snapshot.deadlineAt || snapshot.expiresAt)));
    return deadline ? Math.max(0, deadline - Date.now()) : 0;
  }

  function speakerHandoffReadSnapshot() {
    if (!speakerHandoff) return {};
    try {
      if (typeof speakerHandoff.snapshot === 'function') return speakerHandoff.snapshot() || {};
      if (typeof speakerHandoff.getState === 'function') return speakerHandoff.getState() || {};
      if (speakerHandoff.state && typeof speakerHandoff.state === 'object') return speakerHandoff.state;
    } catch (_) {}
    return speakerHandoffSnapshot || {};
  }

  function captureSpeakerContext(speakerId) {
    if (!speakerId) return;
    var context = {
      index: currentIndex,
      notes: String(notes.textContent || ''),
      notesScrollTop: Math.max(0, Number(notes.scrollTop) || 0),
      promptPlaying: Boolean(promptPlaying)
    };
    speakerHandoffContexts[speakerId] = context;
    var updateState = speakerHandoffMethod(['updateSpeakerState']);
    if (updateState) {
      try {
        updateState(speakerId, {
          slideIndex: context.index,
          notes: context.notes,
          reference: speakerContextReference(context)
        });
      } catch (_) {}
    }
  }

  function restoreSpeakerContext(speakerId) {
    var saved = speakerId && speakerHandoffContexts[speakerId];
    if (!saved) {
      var speaker = speakerHandoffSpeakers(speakerHandoffReadSnapshot()).find(function (item) { return item.id === speakerId; });
      if (speaker && speaker.state) {
        var reference = parseSpeakerContextReference(speaker.state.reference);
        saved = {
          index: speaker.state.slideIndex,
          notes: speaker.state.notes,
          notesScrollTop: reference && reference.notesScrollTop,
          promptPlaying: reference && reference.promptPlaying
        };
      }
    }
    if (!saved) return;
    stopPrompt();
    goLocal(clamp(Number(saved.index) || 0, 0, slides.length - 1), true);
    requestAnimationFrame(function () {
      if (typeof saved.notes === 'string') notes.textContent = saved.notes;
      notes.scrollTop = Math.max(0, Number(saved.notesScrollTop) || 0);
      if (saved.promptPlaying) startPrompt();
      persistSession(true);
    });
  }

  function switchSpeakerContext(nextSpeakerId, snapshot) {
    nextSpeakerId = String(nextSpeakerId || '');
    if (!nextSpeakerId || nextSpeakerId === speakerHandoffActiveId) return;
    var previousSpeakerId = speakerHandoffActiveId;
    speakerHandoffActiveId = nextSpeakerId;
    if (previousSpeakerId) captureSpeakerContext(previousSpeakerId);
    if (previousSpeakerId) {
      var snapshot = speakerHandoffReadSnapshot();
      var queue = Array.isArray(snapshot.queue) ? snapshot.queue.map(String) : [];
      var enqueue = speakerHandoffMethod(['enqueue']);
      if (enqueue && previousSpeakerId !== 'presenter-control' && queue.indexOf(previousSpeakerId) < 0) {
        try { enqueue(previousSpeakerId); } catch (_) {}
      }
      restoreSpeakerContext(nextSpeakerId);
      requestAnimationFrame(function () { speakerHandoffActive.focus({preventScroll: true}); });
    } else {
      snapshot = snapshot && typeof snapshot === 'object' ? snapshot : {};
      var active = speakerHandoffSpeakers(snapshot).find(function (speaker) { return speaker.id === nextSpeakerId; });
      if (shouldRestoreSpeakerContext(snapshot, active)) restoreSpeakerContext(nextSpeakerId);
    }
  }

  function speakerHandoffMethod(names) {
    if (!speakerHandoff) return null;
    for (var index = 0; index < names.length; index += 1) {
      if (typeof speakerHandoff[names[index]] === 'function') return speakerHandoff[names[index]].bind(speakerHandoff);
    }
    return null;
  }

  function runSpeakerHandoffAction(names, args, pendingMessage, failedMessage) {
    var action = speakerHandoffMethod(names);
    if (!action) {
      speakerHandoffFeedback.textContent = 'Esta acción no está disponible en el motor de relevo cargado.';
      renderSpeakerHandoff();
      return Promise.resolve(null);
    }
    speakerHandoffFeedback.textContent = pendingMessage;
    var result;
    try { result = action.apply(null, Array.isArray(args) ? args : [args]); }
    catch (_) { result = Promise.reject(new Error('speaker handoff action failed')); }
    return Promise.resolve(result).then(function () {
      speakerHandoffSnapshot = speakerHandoffReadSnapshot();
      renderSpeakerHandoff(speakerHandoffSnapshot);
      return speakerHandoffSnapshot;
    }).catch(function () {
      speakerHandoffFeedback.textContent = failedMessage;
      renderSpeakerHandoff();
      return null;
    });
  }

  function queueSpeakerHandoff(name) {
    name = String(name || '').replace(/\s+/g, ' ').trim().slice(0, 80);
    if (!name) {
      speakerHandoffFeedback.textContent = 'Escribe un nombre antes de añadirlo.';
      speakerHandoffName.focus();
      return;
    }
    var speaker = {id: 'speaker-' + Date.now().toString(36) + '-' + (++speakerHandoffSequence), name: name, role: 'speaker'};
    runSpeakerHandoffAction(['addSpeaker', 'add'], [speaker], 'Añadiendo a ' + name + '…', 'No se pudo añadir el ponente.').then(function (result) {
      if (!result) return;
      var enqueue = speakerHandoffMethod(['enqueue']);
      try { if (enqueue) enqueue(speaker.id); } catch (_) {}
      speakerHandoffName.value = '';
      speakerHandoffFeedback.textContent = name + ' se añadió a la cola privada.';
      speakerHandoffName.focus();
    });
  }

  function moveSpeakerHandoff(speakerId, offset, button) {
    var snapshot = speakerHandoffReadSnapshot();
    var queueIds = (Array.isArray(snapshot.queue) ? snapshot.queue : []).map(String);
    var fromIndex = queueIds.indexOf(speakerId);
    var toIndex = clamp(fromIndex + offset, 0, queueIds.length - 1);
    if (fromIndex < 0 || fromIndex === toIndex) return;
    queueIds.splice(fromIndex, 1);
    queueIds.splice(toIndex, 0, speakerId);
    var remove = speakerHandoffMethod(['removeFromQueue', 'dequeue']);
    var enqueue = speakerHandoffMethod(['enqueue']);
    if (!remove || !enqueue) {
      speakerHandoffFeedback.textContent = 'El motor cargado no permite reordenar la cola.';
      return;
    }
    speakerHandoffFeedback.textContent = 'Reordenando la cola privada…';
    try {
      (Array.isArray(snapshot.queue) ? snapshot.queue : []).forEach(function (id) { remove(String(id)); });
      queueIds.forEach(function (id) { enqueue(id); });
      renderSpeakerHandoff();
      var next = Array.prototype.find.call(speakerHandoffQueue.querySelectorAll('[data-speaker-id]'), function (item) {
        return item.dataset.speakerId === speakerId;
      });
      var nextButton = next && next.querySelector('button[data-queue-action="' + (offset < 0 ? 'up' : 'down') + '"]');
      if (nextButton) nextButton.focus();
      else if (button) button.focus();
    } catch (_) {
      speakerHandoffFeedback.textContent = 'No se pudo reordenar la cola.';
    }
  }

  function removeSpeakerHandoff(speakerId) {
    var speakers = speakerHandoffSpeakers(speakerHandoffReadSnapshot());
    var removed = speakers.find(function (speaker) { return speaker.id === speakerId; });
    runSpeakerHandoffAction(['removeFromQueue', 'dequeue'], [speakerId], 'Quitando ponente…', 'No se pudo quitar el ponente.').then(function () {
      if (removed) speakerHandoffFeedback.textContent = removed.name + ' se quitó de la cola privada.';
      speakerHandoffName.focus();
    });
  }

  function renderSpeakerHandoff(nextSnapshot) {
    if (!speakerHandoffPanel) return;
    if (nextSnapshot && typeof nextSnapshot === 'object') speakerHandoffSnapshot = nextSnapshot;
    else speakerHandoffSnapshot = speakerHandoffReadSnapshot();
    var snapshot = speakerHandoffSnapshot && typeof speakerHandoffSnapshot === 'object' ? speakerHandoffSnapshot : {};
    var speakers = speakerHandoffSpeakers(snapshot);
    var active = speakerHandoffActiveSpeaker(snapshot, speakers);
    var phase = speakerHandoffPhase(snapshot);
    var remainingMs = speakerHandoffRemainingMs(snapshot);
    var pendingId = String((snapshot.handoff && snapshot.handoff.toSpeakerId) || snapshot.pendingSpeakerId || snapshot.requestedSpeakerId || snapshot.targetSpeakerId || '');
    var pending = speakers.find(function (speaker) { return speaker.id === pendingId; }) || null;

    speakerHandoffPanel.dataset.handoffState = phase;
    speakerHandoffState.textContent = phase === 'countdown' ? 'Relevo solicitado'
      : phase === 'transferred' ? 'Relevo completado'
        : phase === 'cancelled' ? 'Relevo cancelado'
          : phase === 'degraded' ? 'Motor no disponible'
            : 'Listo';
    speakerHandoffActive.textContent = active && (active.name || active.label || active.displayName) || 'Sin asignar';
    speakerHandoffCountdown.textContent = phase === 'countdown'
      ? (pending ? pending.name + ' · ' : '') + Math.ceil(remainingMs / 1000) + ' s'
      : (phase === 'transferred' ? 'Contexto restaurado' : (phase === 'cancelled' ? 'Sin cambios' : 'Listo'));
    speakerHandoffCountdown.setAttribute('aria-live', phase === 'countdown' && remainingMs <= 5000 ? 'assertive' : 'off');
    speakerHandoffRequest.disabled = !speakerHandoff || phase === 'countdown' || speakers.length < 2;
    speakerHandoffAccept.disabled = !speakerHandoff || phase !== 'countdown';
    speakerHandoffCancel.disabled = !speakerHandoff || phase !== 'countdown';
    speakerHandoffName.disabled = !speakerHandoff;
    speakerHandoffAdd.querySelector('button').disabled = !speakerHandoff;

    var nextQueueSignature = [phase, active && (active.id || active.speakerId) || '', Boolean(speakerHandoff)].concat(speakers.map(function (speaker) {
      return speaker.id + ':' + speaker.name;
    })).join('|');
    if (nextQueueSignature !== speakerHandoffQueueSignature) {
      speakerHandoffQueueSignature = nextQueueSignature;
      speakerHandoffQueue.replaceChildren();
      if (!speakers.length) {
        var empty = document.createElement('li');
        empty.className = 'presenter-speaker-empty';
        empty.textContent = speakerHandoff ? 'Añade al menos dos ponentes.' : 'La presentación continúa sin relevo asistido.';
        speakerHandoffQueue.appendChild(empty);
      }
      speakers.forEach(function (speaker, index) {
        var item = document.createElement('li');
        var name = document.createElement('span');
        var controls = document.createElement('div');
        var isActiveSpeaker = Boolean(active && String(active.id || active.speakerId) === speaker.id);
        item.dataset.speakerId = speaker.id;
        item.dataset.active = String(isActiveSpeaker);
        name.textContent = (index + 1) + '. ' + speaker.name;
        controls.setAttribute('aria-label', 'Editar posición de ' + speaker.name);
        [
          {action: 'up', label: 'Subir', offset: -1, disabled: isActiveSpeaker || index <= 1},
          {action: 'down', label: 'Bajar', offset: 1, disabled: isActiveSpeaker || index === speakers.length - 1},
          {action: 'remove', label: 'Quitar', disabled: isActiveSpeaker}
        ].forEach(function (control) {
          var button = document.createElement('button');
          button.type = 'button';
          button.dataset.queueAction = control.action;
          button.textContent = control.label;
          button.disabled = !speakerHandoff || control.disabled || phase === 'countdown';
          button.setAttribute('aria-label', control.label + ' a ' + speaker.name);
          button.addEventListener('click', function () {
            if (control.action === 'remove') removeSpeakerHandoff(speaker.id);
            else moveSpeakerHandoff(speaker.id, control.offset, button);
          });
          controls.appendChild(button);
        });
        item.appendChild(name);
        item.appendChild(controls);
        speakerHandoffQueue.appendChild(item);
      });
    }

    var activeId = String(active && (active.id || active.speakerId) || '');
    switchSpeakerContext(activeId, snapshot);
    if (!speakerHandoff) {
      speakerHandoffFeedback.textContent = 'El motor privado no cargó. Navegación, notas y audiencia siguen funcionando sin datos de relevo.';
    } else if (!speakerHandoffFeedback.dataset.userMessage) {
      speakerHandoffFeedback.textContent = phase === 'countdown'
        ? 'Confirma el relevo antes de que termine la cuenta atrás o cancélalo sin cambiar de contexto.'
        : 'Cada ponente recupera su última diapositiva y posición de notas al volver.';
    }
  }

  function handleSpeakerHandoffChange(snapshot, event) {
    var eventType = String(event && (event.type || event.eventType) || '').toLowerCase();
    if (eventType === 'handoff-completed') {
      speakerHandoffTransientPhase = 'transferred';
      speakerHandoffTransientUntil = Date.now() + 4000;
    } else if (eventType === 'handoff-cancelled' || eventType === 'handoff-canceled') {
      speakerHandoffTransientPhase = 'cancelled';
      speakerHandoffTransientUntil = Date.now() + 4000;
    } else if (eventType === 'handoff-requested') {
      speakerHandoffTransientPhase = '';
      speakerHandoffTransientUntil = 0;
    }
    renderSpeakerHandoff(snapshot);
  }

  function initializeSpeakerHandoff() {
    var contract = window.AdmiraSpeakerHandoff || null;
    if (!contract || typeof contract.create !== 'function') {
      renderSpeakerHandoff();
      return;
    }
    try {
      speakerHandoff = contract.create({
        presentationId: speakerHandoffPresentationId(location.pathname),
        speakers: [
          {id: 'presenter-control', name: 'Control de presentador', role: 'moderator'},
          {id: 'speaker-1', name: 'Ponente 1', role: 'speaker'},
          {id: 'speaker-2', name: 'Ponente 2', role: 'speaker'}
        ],
        actorId: 'presenter-control',
        initialControllerId: 'speaker-1',
        initialQueue: ['speaker-2'],
        defaultCountdownMs: 10000
      });
      if (speakerHandoff && typeof speakerHandoff.onChange === 'function') {
        speakerHandoffUnsubscribe = speakerHandoff.onChange(handleSpeakerHandoffChange);
      } else if (speakerHandoff && typeof speakerHandoff.subscribe === 'function') {
        speakerHandoffUnsubscribe = speakerHandoff.subscribe(handleSpeakerHandoffChange);
      }
      if (speakerHandoff && typeof speakerHandoff.start === 'function') speakerHandoff.start();
      speakerHandoffSnapshot = speakerHandoffReadSnapshot();
    } catch (_) {
      speakerHandoff = null;
      speakerHandoffSnapshot = null;
    }
    renderSpeakerHandoff();
  }

  function destroySpeakerHandoff() {
    if (typeof speakerHandoffUnsubscribe === 'function') {
      try { speakerHandoffUnsubscribe(); } catch (_) {}
    }
    speakerHandoffUnsubscribe = null;
    if (speakerHandoff) {
      try {
        if (typeof speakerHandoff.destroy === 'function') speakerHandoff.destroy();
        else if (typeof speakerHandoff.stop === 'function') speakerHandoff.stop();
      } catch (_) {}
    }
    speakerHandoff = null;
    speakerHandoffSnapshot = null;
    speakerHandoffContexts = Object.create(null);
  }

  function productionCueList(snapshot) {
    if (!snapshot || typeof snapshot !== 'object') return [];
    if (Array.isArray(snapshot.cues)) return snapshot.cues;
    if (Array.isArray(snapshot.activeCues)) return snapshot.activeCues;
    if (Array.isArray(snapshot.messages)) return snapshot.messages;
    return [];
  }

  function productionCuePriority(cue) {
    var priority = String(cue && cue.priority || 'normal').toLowerCase();
    return ['normal', 'high', 'urgent'].indexOf(priority) >= 0 ? priority : 'normal';
  }

  function productionCueStatus(cue, now) {
    var status = String(cue && cue.status || '').toLowerCase();
    var expiresAt = Number(cue && (cue.expiresAt || cue.expires_at)) || 0;
    if (status === 'acknowledged' || status === 'ack' || cue.acknowledgedAt || cue.acknowledged_at) return 'acknowledged';
    if (status === 'expired' || (expiresAt && expiresAt <= now)) return 'expired';
    if (status === 'dismissed') return 'dismissed';
    return 'active';
  }

  function productionCueStatusLabel(cue, now) {
    var status = productionCueStatus(cue, now);
    if (status === 'acknowledged') return 'Acusado';
    if (status === 'expired') return 'Caducado';
    if (status === 'dismissed') return 'Retirado';
    var expiresAt = Number(cue && (cue.expiresAt || cue.expires_at)) || 0;
    if (!expiresAt) return 'Activo';
    return 'Caduca en ' + Math.max(0, Math.ceil((expiresAt - now) / 1000)) + ' s';
  }

  function productionCuePriorityLabel(priority) {
    if (priority === 'urgent') return 'Urgente';
    if (priority === 'high') return 'Alta';
    return 'Normal';
  }

  function renderProductionBackchannel(nextSnapshot) {
    if (!productionBackchannelPanel) return;
    if (nextSnapshot && typeof nextSnapshot === 'object') productionBackchannelSnapshot = nextSnapshot;
    else if (productionBackchannel && typeof productionBackchannel.snapshot === 'function') {
      try { productionBackchannelSnapshot = productionBackchannel.snapshot(); } catch (_) {}
    }

    var available = Boolean(productionBackchannel);
    var snapshot = productionBackchannelSnapshot && typeof productionBackchannelSnapshot === 'object'
      ? productionBackchannelSnapshot
      : {};
    var transportStatus = String(snapshot.status || snapshot.transport || '').toLowerCase();
    var degraded = Boolean(transportStatus && transportStatus !== 'broadcast-channel');
    var roleIsOperator = productionBackchannelRole === 'operator';

    productionBackchannelPanel.dataset.backchannelState = !available ? 'unavailable' : (degraded ? 'degraded' : (roleIsOperator ? 'operator' : 'ready'));
    productionBackchannelMode.disabled = !available;
    productionBackchannelMode.setAttribute('aria-pressed', String(roleIsOperator));
    productionBackchannelMode.textContent = roleIsOperator ? 'Volver a modo presentador' : 'Activar modo operador';
    productionBackchannelComposer.hidden = !roleIsOperator;
    productionBackchannelSend.disabled = !available || degraded || !roleIsOperator;
    productionBackchannelState.textContent = !available
      ? 'Motor no disponible'
      : (degraded ? 'Canal seguro limitado' : (roleIsOperator ? 'Modo operador' : 'Modo presentador'));

    if (!available) {
      productionBackchannelFeedback.textContent = 'El motor de backchannel no cargó. La presentación continúa sin cues de producción.';
    } else if (degraded) {
      productionBackchannelFeedback.textContent = 'BroadcastChannel no está disponible. Para proteger el texto, los cues no salen de esta ventana y el envío queda desactivado.';
    } else if (!productionBackchannelFeedback.dataset.userMessage) {
      productionBackchannelFeedback.textContent = roleIsOperator
        ? 'Redacta cues breves; prioridad y caducidad viajarán por el canal local.'
        : 'Los cues activos aparecen aquí. Acúsalos cuando los hayas leído.';
    }

    var now = Date.now();
    var cues = productionCueList(snapshot).slice(-12).reverse();
    productionBackchannelCues.replaceChildren();
    if (!cues.length) {
      var empty = document.createElement('li');
      empty.className = 'presenter-backchannel-empty';
      empty.textContent = available ? 'No hay cues de producción.' : 'Sin motor de cues.';
      productionBackchannelCues.appendChild(empty);
      return;
    }

    cues.forEach(function (cue, index) {
      var item = document.createElement('li');
      var priority = productionCuePriority(cue);
      var status = productionCueStatus(cue, now);
      var cueId = String(cue && (cue.id || cue.cueId || cue.messageId) || '');
      var text = String(cue && (cue.text || cue.message || cue.cue) || '').trim().slice(0, 240);
      item.dataset.priority = priority;
      item.dataset.cueStatus = status;

      var header = document.createElement('div');
      var priorityBadge = document.createElement('strong');
      var statusBadge = document.createElement('span');
      priorityBadge.textContent = productionCuePriorityLabel(priority);
      statusBadge.textContent = productionCueStatusLabel(cue, now);
      header.appendChild(priorityBadge);
      header.appendChild(statusBadge);

      var message = document.createElement('p');
      message.textContent = text || 'Cue sin texto';
      item.appendChild(header);
      item.appendChild(message);

      if (!roleIsOperator && status === 'active' && cueId) {
        var acknowledgeButton = document.createElement('button');
        acknowledgeButton.type = 'button';
        acknowledgeButton.textContent = 'Acusar lectura';
        acknowledgeButton.setAttribute('aria-label', 'Acusar lectura del cue ' + (index + 1) + ': ' + (text || 'sin texto'));
        acknowledgeButton.addEventListener('click', function () { acknowledgeProductionCue(cueId, acknowledgeButton); });
        item.appendChild(acknowledgeButton);
      }
      productionBackchannelCues.appendChild(item);
    });
  }

  function setProductionBackchannelFeedback(message) {
    productionBackchannelFeedback.dataset.userMessage = 'true';
    productionBackchannelFeedback.textContent = message;
    setTimeout(function () {
      delete productionBackchannelFeedback.dataset.userMessage;
      renderProductionBackchannel();
    }, 3500);
  }

  function destroyProductionBackchannel() {
    if (typeof productionBackchannelUnsubscribe === 'function') {
      try { productionBackchannelUnsubscribe(); } catch (_) {}
    }
    productionBackchannelUnsubscribe = null;
    if (productionBackchannel) {
      try {
        if (typeof productionBackchannel.destroy === 'function') productionBackchannel.destroy();
        else if (typeof productionBackchannel.stop === 'function') productionBackchannel.stop();
      } catch (_) {}
    }
    productionBackchannel = null;
    productionBackchannelSnapshot = null;
  }

  function productionBackchannelChannelName() {
    var path = String(location.pathname || 'presentation');
    var hash = 2166136261;
    for (var index = 0; index < path.length; index += 1) {
      hash ^= path.charCodeAt(index);
      hash = Math.imul(hash, 16777619);
    }
    var safePath = path.replace(/[^A-Za-z0-9._:-]+/g, '-').replace(/^[-:.]+|[-:.]+$/g, '').slice(-42) || 'presentation';
    return 'presenter.' + safePath + '.' + (hash >>> 0).toString(36);
  }

  function initializeProductionBackchannel(role) {
    destroyProductionBackchannel();
    productionBackchannelRole = role === 'operator' ? 'operator' : 'presenter';
    var contract = window.AdmiraProductionBackchannel || null;
    if (!contract || typeof contract.create !== 'function') {
      renderProductionBackchannel();
      return;
    }
    try {
      productionBackchannel = contract.create({
        role: productionBackchannelRole,
        channelName: productionBackchannelChannelName(),
        onChange: renderProductionBackchannel
      });
      if (productionBackchannel && typeof productionBackchannel.onChange === 'function') {
        productionBackchannelUnsubscribe = productionBackchannel.onChange(renderProductionBackchannel);
      }
      if (productionBackchannel && typeof productionBackchannel.start === 'function') productionBackchannel.start();
      if (productionBackchannel && typeof productionBackchannel.snapshot === 'function') {
        productionBackchannelSnapshot = productionBackchannel.snapshot();
      }
    } catch (_) {
      destroyProductionBackchannel();
    }
    renderProductionBackchannel();
  }

  function switchProductionBackchannelRole() {
    initializeProductionBackchannel(productionBackchannelRole === 'operator' ? 'presenter' : 'operator');
    setProductionBackchannelFeedback(productionBackchannelRole === 'operator'
      ? 'Modo operador activo. Ya puedes enviar cues.'
      : 'Modo presentador activo. Los cues requieren acuse de lectura.');
  }

  function sendProductionCue(event) {
    event.preventDefault();
    if (!productionBackchannel || productionBackchannelRole !== 'operator' || typeof productionBackchannel.sendCue !== 'function') {
      setProductionBackchannelFeedback('No se pudo enviar: activa el modo operador y comprueba el motor local.');
      return;
    }
    var text = String(productionBackchannelText.value || '').trim().replace(/\s+/g, ' ').slice(0, 240);
    var ttlSeconds = clamp(Number(productionBackchannelTtl.value) || 30, 5, 300);
    var priority = productionCuePriority({priority: productionBackchannelPriority.value});
    productionBackchannelTtl.value = String(ttlSeconds);
    if (!text) {
      setProductionBackchannelFeedback('Escribe un cue antes de enviarlo.');
      productionBackchannelText.focus();
      return;
    }
    productionBackchannelSend.disabled = true;
    var result;
    try { result = productionBackchannel.sendCue({text: text, priority: priority, ttlMs: ttlSeconds * 1000}); }
    catch (_) { result = Promise.reject(new Error('send failed')); }
    Promise.resolve(result).then(function (nextSnapshot) {
      productionBackchannelText.value = '';
      setProductionBackchannelFeedback('Cue enviado · ' + productionCuePriorityLabel(priority) + ' · ' + ttlSeconds + ' s.');
      renderProductionBackchannel();
    }).catch(function () {
      setProductionBackchannelFeedback('El cue no se pudo enviar. Comprueba el canal local e inténtalo de nuevo.');
    }).finally(function () {
      productionBackchannelSend.disabled = false;
    });
  }

  function acknowledgeProductionCue(cueId, button) {
    if (!productionBackchannel || typeof productionBackchannel.acknowledge !== 'function') return;
    button.disabled = true;
    var result;
    try { result = productionBackchannel.acknowledge(cueId); }
    catch (_) { result = Promise.reject(new Error('acknowledge failed')); }
    Promise.resolve(result).then(function (nextSnapshot) {
      setProductionBackchannelFeedback('Lectura acusada al operador.');
      renderProductionBackchannel();
    }).catch(function () {
      button.disabled = false;
      setProductionBackchannelFeedback('No se pudo enviar el acuse. Comprueba el canal local.');
    });
  }

  function mountAudienceMirror() {
    if (!audienceMirror) return;
    audienceMirror.src = audienceOutputUrl(true).href;
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
    var urls = [location.href, '/assets/presentation-share-guardian.js?v=20260723-1', '/assets/presentation-pace-coach.js?v=20260723-1', '/assets/presentation-presenter-mode.js?v=20260723-4', '/assets/presentation-presenter-mode.css?v=20260723-4', '/assets/presentation-caption-accessibility.js?v=20260723-2', '/assets/presentation-caption-accessibility.css?v=20260723-2', '/assets/presentation-visual-auditor.js?v=20260723-1', '/assets/presentation-visual-auditor.css?v=20260723-1'];
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

  function remoteApiBase() {
    var match = location.pathname.match(/^\/presentaciones\/([^/]+)\//);
    return match ? '/presentaciones/' + match[1] + '/api/remote' : '';
  }

  function remoteClientSlug() {
    var match = location.pathname.match(/^\/presentaciones\/([^/]+)\//);
    if (!match) return '';
    try { return decodeURIComponent(match[1]); } catch (_) { return ''; }
  }

  async function remoteRequest(path, options) {
    var response = await fetch(path, Object.assign({credentials: 'same-origin'}, options || {}));
    var body = null;
    if (response.status !== 204) {
      try { body = await response.json(); } catch (_) {}
    }
    if (!response.ok) {
      var error = new Error(body && body.error || 'remote_request_failed');
      error.code = body && body.error || 'remote_request_failed';
      error.status = response.status;
      throw error;
    }
    return body;
  }

  function setRemoteStatus(state, label) {
    remotePanel.dataset.remoteState = state;
    remoteState.textContent = label;
  }

  function stopRemoteSession(reason) {
    clearTimeout(remoteCommandPollTimer);
    clearTimeout(remoteStatePushTimer);
    remoteCommandPollTimer = 0;
    remoteStatePushTimer = 0;
    remoteCommandPollBusy = false;
    remoteStatePushBusy = false;
    remoteStatePushQueued = false;
    remoteSession = null;
    remotePairingUrl = '';
    remotePairing.hidden = true;
    remoteLink.value = '';
    remoteCode.value = '';
    remoteCreate.disabled = false;
    setRemoteStatus(reason === 'revoked' ? 'revoked' : 'idle', reason === 'revoked' ? 'Sesión revocada' : 'Sin sesión activa');
  }

  function remotePairingLink(session) {
    var url = new URL('/assets/presentation-presenter-remote.html', location.origin);
    var fragment = new URLSearchParams({
      client: remoteClientSlug(),
      session: session.sessionId,
      pair: session.pairingSecret
    });
    url.hash = fragment.toString();
    return url.href;
  }

  function handleRemoteFailure(error) {
    if (error && (error.status === 410 || error.code === 'expired' || error.code === 'revoked')) {
      stopRemoteSession('revoked');
      return true;
    }
    if (error && error.status === 401) {
      stopRemoteSession('');
      setRemoteStatus('error', 'Sesión no autorizada');
      return true;
    }
    return false;
  }

  async function createRemoteSession() {
    var base = remoteApiBase();
    if (!base || remoteSession) return;
    remoteCreate.disabled = true;
    setRemoteStatus('connecting', 'Creando sesión efímera…');
    try {
      var data = await remoteRequest(base + '/sessions', {
        method: 'POST',
        headers: {'content-type': 'application/json'},
        body: JSON.stringify({ttlSeconds: 14400})
      });
      if (!data || !data.sessionId || !data.pairingSecret || !data.stageToken) throw new Error('invalid_session_contract');
      remoteSession = {
        sessionId: String(data.sessionId),
        stageToken: String(data.stageToken),
        expiresAt: String(data.expiresAt || ''),
        pollAfterMs: clamp(Number(data.pollAfterMs) || 750, 500, 5000),
        stateSeq: 0,
        ackCommandSeq: 0,
        failureCount: 0
      };
      remotePairingUrl = remotePairingLink({
        sessionId: remoteSession.sessionId,
        pairingSecret: String(data.pairingSecret)
      });
      remoteLink.value = remotePairingUrl;
      remoteCode.value = remoteClientSlug() + ':' + remoteSession.sessionId + ':' + String(data.pairingSecret);
      remoteExpiry.textContent = remoteSession.expiresAt ? 'Caduca: ' + new Date(remoteSession.expiresAt).toLocaleString() : 'Caduca al cerrar o revocar la sesión.';
      remotePairing.hidden = false;
      setRemoteStatus('pairing', 'Esperando emparejamiento');
      scheduleRemoteStatePush(true);
      scheduleRemoteCommandPoll(0);
    } catch (error) {
      remoteCreate.disabled = false;
      setRemoteStatus('error', error && error.status === 503 ? 'Servicio remoto no disponible' : 'No se pudo crear la sesión');
    }
  }

  function scheduleRemoteStatePush(immediate) {
    if (!remoteSession || remoteMode) return;
    remoteStatePushQueued = true;
    if (remoteStatePushBusy || remoteStatePushTimer) return;
    remoteStatePushTimer = setTimeout(pushRemoteState, immediate ? 0 : 120);
  }

  async function pushRemoteState() {
    remoteStatePushTimer = 0;
    if (!remoteSession || remoteStatePushBusy || !remoteStatePushQueued) return;
    remoteStatePushQueued = false;
    remoteStatePushBusy = true;
    var session = remoteSession;
    var seconds = elapsedSeconds();
    var paceInfo = paceState(seconds);
    var seq = ++session.stateSeq;
    try {
      await remoteRequest(remoteApiBase() + '/sessions/' + encodeURIComponent(session.sessionId) + '/state', {
        method: 'PUT',
        headers: {
          'authorization': 'Bearer ' + session.stageToken,
          'content-type': 'application/json'
        },
        body: JSON.stringify({
          seq: seq,
          index: currentIndex,
          count: slides.length,
          elapsed: seconds,
          running: running,
          paceLabel: !running && seconds === 0 ? 'ready' : paceInfo.className,
          ackCommandSeq: session.ackCommandSeq
        })
      });
      session.failureCount = 0;
      if (remotePanel.dataset.remoteState !== 'paired') setRemoteStatus('connected', 'Sesión activa · esperando móvil');
    } catch (error) {
      if (!handleRemoteFailure(error) && remoteSession === session) {
        session.failureCount += 1;
        setRemoteStatus('connecting', 'Reconectando sesión remota…');
        remoteStatePushQueued = true;
      }
    } finally {
      remoteStatePushBusy = false;
      if (remoteStatePushQueued && remoteSession === session) {
        remoteStatePushTimer = setTimeout(pushRemoteState, Math.min(8000, session.pollAfterMs * Math.pow(2, Math.min(session.failureCount, 3))));
      }
    }
  }

  function scheduleRemoteCommandPoll(delay) {
    clearTimeout(remoteCommandPollTimer);
    if (!remoteSession || remoteMode) return;
    remoteCommandPollTimer = setTimeout(pollRemoteCommands, Math.max(0, Number(delay) || 0));
  }

  async function pollRemoteCommands() {
    remoteCommandPollTimer = 0;
    if (!remoteSession || remoteCommandPollBusy) return;
    remoteCommandPollBusy = true;
    var session = remoteSession;
    try {
      var data = await remoteRequest(remoteApiBase() + '/sessions/' + encodeURIComponent(session.sessionId) + '/commands?after=' + session.ackCommandSeq, {
        headers: {'authorization': 'Bearer ' + session.stageToken}
      });
      var commands = data && Array.isArray(data.commands) ? data.commands.slice().sort(function (a, b) { return Number(a.seq) - Number(b.seq); }) : [];
      commands.forEach(function (item) {
        var seq = Number(item && item.seq);
        if (!Number.isSafeInteger(seq) || seq <= session.ackCommandSeq) return;
        applyRemoteCommand(item.command, item.index);
        session.ackCommandSeq = seq;
      });
      if (commands.length) {
        remoteCode.value = '';
        setRemoteStatus('paired', 'Móvil conectado');
        scheduleRemoteStatePush(true);
      }
      session.failureCount = 0;
    } catch (error) {
      if (!handleRemoteFailure(error) && remoteSession === session) {
        session.failureCount += 1;
        setRemoteStatus('connecting', 'Reconectando mando móvil…');
      }
    } finally {
      remoteCommandPollBusy = false;
      if (remoteSession === session) {
        scheduleRemoteCommandPoll(Math.min(8000, session.pollAfterMs * Math.pow(2, Math.min(session.failureCount, 3))));
      }
    }
  }

  function revokeRemoteSession() {
    if (!remoteSession) return Promise.resolve();
    var session = remoteSession;
    stopRemoteSession('revoked');
    return remoteRequest(remoteApiBase() + '/sessions/' + encodeURIComponent(session.sessionId), {
      method: 'DELETE',
      headers: {'authorization': 'Bearer ' + session.stageToken},
      keepalive: true
    }).catch(function () {});
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
    broadcast({type: 'state', index: currentIndex, slideCount: slides.length, elapsed: seconds, running: running, pace: paceInfo.label});
    scheduleRemoteStatePush(false);
    persistSession(false);
  }

  function setStagePaused(paused) {
    paused = Boolean(paused);
    if (stagePaused === paused) return;
    if (paused) {
      stagePauseSnapshot = {index: currentIndex, running: running, elapsed: elapsedSeconds()};
      stagePaused = true;
    } else {
      stagePaused = false;
      if (stagePauseSnapshot) {
        currentIndex = clamp(Number(stagePauseSnapshot.index) || 0, 0, slides.length - 1);
        carriedSeconds = Math.max(0, Number(stagePauseSnapshot.elapsed) || 0);
        running = Boolean(stagePauseSnapshot.running);
        startedAt = running ? Date.now() : 0;
        goLocal(currentIndex, true);
      }
      stagePauseSnapshot = null;
    }
    stagePauseButton.setAttribute('aria-pressed', String(stagePaused));
    stagePauseButton.textContent = stagePaused ? 'Reanudar presentación · B' : 'Pausa escénica · B';
    panel.classList.toggle('presenter-stage-pause-active', stagePaused);
    broadcast({type: 'stage-pause', paused: stagePaused, index: currentIndex});
    persistSession(true);
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
    closeCalibrationPattern();
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

  function initializeVisualAuditor() {
    if (remoteMode || audienceMode || document.getElementById('presenterVisualAuditor')) return;
    var stylesheet = document.createElement('link');
    stylesheet.rel = 'stylesheet';
    stylesheet.href = '/assets/presentation-visual-auditor.css?v=20260723-1';
    document.head.appendChild(stylesheet);
    function mount() {
      var auditor = window.AdmiraPresentationVisualAuditor;
      if (!auditor || typeof auditor.mount !== 'function') return;
      auditor.mount({
        container: panel,
        onNavigate: function (index) {
          currentIndex = clamp(Number(index) || 0, 0, slides.length - 1);
          goLocal(currentIndex, true);
        }
      });
    }
    if (window.AdmiraPresentationVisualAuditor) {
      mount();
      return;
    }
    var script = document.createElement('script');
    script.src = '/assets/presentation-visual-auditor.js?v=20260723-1';
    script.async = true;
    script.addEventListener('load', mount, {once: true});
    document.head.appendChild(script);
  }

  function command(name) {
    var nextIndex = name === 'next' ? currentIndex + 1 : name === 'prev' ? currentIndex - 1 : currentIndex;
    if (!remoteMode) goLocal(nextIndex);
    broadcast({type: 'command', command: name, index: nextIndex});
  }

  function applyRemoteCommand(remoteCommand, requestedIndex) {
    if (remoteCommand === 'timer-toggle') {
      if (running) { carriedSeconds = elapsedSeconds(); running = false; startedAt = 0; }
      else { running = true; startedAt = Date.now(); }
      render();
      persistSession(true);
      return true;
    }
    if (remoteCommand === 'timer-reset') {
      running = false;
      startedAt = 0;
      carriedSeconds = 0;
      resetPaceCoach(0);
      render();
      persistSession(true);
      return true;
    }
    if (remoteCommand !== 'next' && remoteCommand !== 'prev' && remoteCommand !== 'skip') return false;
    var nextIndex = remoteCommand === 'next'
      ? currentIndex + 1
      : remoteCommand === 'prev'
        ? currentIndex - 1
        : Number(requestedIndex);
    if (!Number.isFinite(nextIndex)) return false;
    goLocal(nextIndex);
    return true;
  }

  function broadcast(payload, transient) {
    payload.source = remoteMode ? 'remote' : 'stage';
    payload.messageId = payload.messageId || payload.source + ':' + Date.now() + ':' + (++messageSequence);
    if (channel) channel.postMessage(payload);
    if (!transient) {
      try { localStorage.setItem(channelName, JSON.stringify(Object.assign({nonce: Date.now()}, payload))); } catch (_) {}
    }
    try { if (audienceWindow && !audienceWindow.closed) audienceWindow.postMessage(payload, location.origin); } catch (_) {}
  }

  function receive(payload) {
    if (!payload || payload.source === (remoteMode ? 'remote' : 'stage')) return;
    if (payload.messageId && receivedMessageIds.indexOf(payload.messageId) >= 0) return;
    if (payload.messageId) {
      receivedMessageIds.push(payload.messageId);
      if (receivedMessageIds.length > 100) receivedMessageIds.shift();
    }
    if ((payload.type === 'audience-ready' || payload.type === 'audience-heartbeat') && !remoteMode) {
      if (payload.embedded) {
        lastMirrorSignalAt = Date.now();
      } else {
        lastAudienceSignalAt = Date.now();
        audienceConnected = true;
        audiencePrivacyVerified = Boolean(payload.privacyReady);
        audienceMediaHealth = payload.media && typeof payload.media === 'object'
          ? {
              muted: Boolean(payload.media.muted),
              ended: Boolean(payload.media.ended),
              kind: payload.media.kind === 'audio' || payload.media.kind === 'video' ? payload.media.kind : ''
            }
          : {muted: false, ended: false, kind: ''};
        if (captionActive && payload.type === 'audience-ready') sendCaptionState();
        refreshLaunchAssistant();
      }
      renderShareGuardian();
      if (payload.type === 'audience-ready') render();
      if (payload.type === 'audience-ready' && stagePaused) broadcast({type: 'stage-pause', paused: stagePaused, index: currentIndex});
      return;
    }
    if (payload.type === 'ready' && payload.source === 'remote' && !remoteMode) { render(); return; }
    if (payload.type === 'stage-pause') {
      if (remoteMode) {
        stagePaused = Boolean(payload.paused);
        stagePauseButton.setAttribute('aria-pressed', String(stagePaused));
        stagePauseButton.textContent = stagePaused ? 'Reanudar presentación · B' : 'Pausa escénica · B';
        panel.classList.toggle('presenter-stage-pause-active', stagePaused);
      } else if (payload.source === 'remote') setStagePaused(Boolean(payload.paused));
      return;
    }
    if (payload.type === 'command' && payload.source === 'remote' && !remoteMode) {
      applyRemoteCommand(payload.command, payload.index);
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
    if (event.key === 'Escape') {
      event.preventDefault();
      event.stopPropagation();
      if (document.documentElement.classList.contains('presenter-calibration-active')) closeCalibrationPattern();
      else closePanel();
    }
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
  stagePauseButton.addEventListener('click', function () { setStagePaused(!stagePaused); });
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
  speakerHandoffAdd.addEventListener('submit', function (event) {
    event.preventDefault();
    queueSpeakerHandoff(speakerHandoffName.value);
  });
  speakerHandoffRequest.addEventListener('click', function () {
    var snapshot = speakerHandoffReadSnapshot();
    var speakers = speakerHandoffSpeakers(snapshot);
    var active = speakerHandoffActiveSpeaker(snapshot, speakers);
    var activeIndex = speakers.findIndex(function (speaker) { return active && speaker.id === String(active.id || active.speakerId); });
    var target = speakers[activeIndex + 1] || speakers.find(function (speaker) { return !active || speaker.id !== String(active.id || active.speakerId); });
    if (!target) {
      speakerHandoffFeedback.textContent = 'Añade otro ponente antes de solicitar el relevo.';
      speakerHandoffName.focus();
      return;
    }
    runSpeakerHandoffAction(
      ['requestHandoff', 'requestTransfer', 'request'],
      [target.id, {countdownMs: 10000}],
      'Solicitando relevo a ' + target.name + '…',
      'No se pudo solicitar el relevo.'
    );
  });
  speakerHandoffAccept.addEventListener('click', function () {
    var snapshot = speakerHandoffReadSnapshot();
    var handoffId = snapshot.handoff && snapshot.handoff.id;
    runSpeakerHandoffAction(
      ['acceptHandoff', 'acceptTransfer', 'accept'],
      [handoffId],
      'Aceptando relevo…',
      'No se pudo aceptar el relevo.'
    );
  });
  speakerHandoffCancel.addEventListener('click', function () {
    var snapshot = speakerHandoffReadSnapshot();
    var handoffId = snapshot.handoff && snapshot.handoff.id;
    runSpeakerHandoffAction(
      ['cancelHandoff', 'cancelTransfer', 'cancel'],
      [handoffId],
      'Cancelando relevo…',
      'No se pudo cancelar el relevo.'
    );
  });
  productionBackchannelMode.addEventListener('click', switchProductionBackchannelRole);
  productionBackchannelComposer.addEventListener('submit', sendProductionCue);
  calibrationToggle.addEventListener('click', toggleCalibrationPattern);
  [calibrationSafeMargin, calibrationContrast, calibrationGamma, calibrationScale].forEach(function (input) {
    input.addEventListener('input', previewCalibrationProfile);
  });
  document.getElementById('presenterCalibrationSave').addEventListener('click', saveCalibrationProfile);
  document.getElementById('presenterCalibrationReset').addEventListener('click', resetCalibrationProfile);
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
    var url = new URL('/assets/presentation-presenter-remote.html', location.origin);
    url.searchParams.set('deck', location.pathname);
    window.open(url, 'admira-presenter-remote', 'popup=yes,width=460,height=820');
  });
  remoteCreate.addEventListener('click', createRemoteSession);
  document.getElementById('presenterRemoteCopy').addEventListener('click', function () {
    if (!remotePairingUrl) return;
    var copied = navigator.clipboard && navigator.clipboard.writeText
      ? navigator.clipboard.writeText(remotePairingUrl)
      : Promise.reject(new Error('clipboard_unavailable'));
    copied.then(function () {
      setRemoteStatus(remotePanel.dataset.remoteState, 'Enlace copiado · esperando móvil');
    }).catch(function () {
      remoteLink.focus();
      remoteLink.select();
      setRemoteStatus(remotePanel.dataset.remoteState, 'Selecciona y copia el enlace');
    });
  });
  document.getElementById('presenterRemoteLaunch').addEventListener('click', function () {
    if (remotePairingUrl) window.open(remotePairingUrl, '_blank', 'noopener');
  });
  document.getElementById('presenterRemoteRevoke').addEventListener('click', revokeRemoteSession);
  document.getElementById('presenterAudienceLaunch').addEventListener('click', launchAudienceOutput);
  shareGuardianAction.addEventListener('click', requestGuardianShare);
  addEventListener('keydown', function (event) {
    if (event.defaultPrevented || event.target?.closest?.('input,textarea,select,button,[contenteditable="true"]')) return;
    if (event.key.toLowerCase() === 'p') { event.preventDefault(); panel.hidden ? openPanel() : closePanel(); }
    else if (event.key.toLowerCase() === 'b') { event.preventDefault(); setStagePaused(!stagePaused); }
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
  addEventListener('message', function (event) {
    if (event.origin !== location.origin) return;
    var fromAudienceWindow = audienceWindow && event.source === audienceWindow;
    var fromMirror = audienceMirror && event.source === audienceMirror.contentWindow;
    if (fromAudienceWindow || fromMirror) receive(event.data);
  });
  document.addEventListener('admira:language', function () { notes.dataset.slide = ''; render(); });
  if (channel) channel.addEventListener('message', function (event) { receive(event.data); });
  addEventListener('pagehide', function () { if (remoteSession) revokeRemoteSession(); }, {once: true});
  addEventListener('pagehide', function () { persistSession(true); closeCalibrationPattern(); stopLiveCaptions(true); if (captionAccessibility) captionAccessibility.destroy(); destroySpeakerHandoff(); if (speakerHandoffTimer) clearInterval(speakerHandoffTimer); destroyProductionBackchannel(); if (productionBackchannelTimer) clearInterval(productionBackchannelTimer); if (presentationShareGuardian) { if (typeof presentationShareGuardian.destroy === 'function') presentationShareGuardian.destroy(); else if (typeof presentationShareGuardian.stop === 'function') presentationShareGuardian.stop(); } if (channel) channel.close(); stopPrompt(true); }, {once: true});
  setInterval(function () {
    if (running && !document.hidden) render();
    if (!remoteMode) renderShareGuardian();
    if (remoteMode && lastStageSignalAt && Date.now() - lastStageSignalAt > 4000) {
      remoteState.textContent = 'Reconectando con la presentación…';
      setConnection('↻ Reconectando control…', 'is-reconnecting');
      broadcast({type: 'ready'});
    }
  }, 500);

  if (!navigator.onLine) setConnection('● Sin conexión · modo seguro', 'is-offline');
  initializeCaptionControls();
  initializeSpeakerHandoff();
  speakerHandoffTimer = setInterval(function () { renderSpeakerHandoff(); }, 250);
  initializeProductionBackchannel('presenter');
  productionBackchannelTimer = setInterval(function () { renderProductionBackchannel(); }, 1000);
  initializeShareGuardian();
  initializeVisualAuditor();
  mountAudienceMirror();
  restoreCalibrationProfile();
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
