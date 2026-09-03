import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {onRequestGet as renderPresentation} from '../functions/presentaciones/[client]/presentacion.js';

function kv(values){return{async get(key,options){const value=values[key];return options?.type==='json'?value:JSON.stringify(value)}}}

const config={displayName:'Demo',outputs:['website'],languages:['es'],theme:{},sequence:{}};
const ideas={
  hero:{title:'Propuesta',summary:'Resumen',speakerNotes:'Nota privada de portada'},objective:'Objetivo',
  skeleton:[{id:'uno',title:'Idea',message:'Mensaje',detail:'Detalle',enabled:true,notes:'Nota privada de bloque'}],
  closing:{title:'Cierre',action:'Acción'},labels:{objective:'Objetivo',next:'Siguiente'},
  notes:'Recordar el contexto </script><script>alert(1)</script>'
};

test('generated presentations load the intelligent presenter mode without exposing executable notes',async()=>{
  const response=await renderPresentation({
    params:{client:'demo'},request:new Request('https://admiranext.test/presentaciones/demo/presentacion'),
    env:{PRESENTATION_IDEAS:kv({'presentation:demo':config,'ideas:demo':ideas})},
    next(){throw new Error('unexpected next')}
  });
  const html=await response.text();
  assert.match(html,/presentation-presenter-mode\.css\?v=20260902-2/);
  assert.match(html,/presentation-pace-coach\.js\?v=20260723-1/);
  assert.match(html,/presentation-share-guardian\.js\?v=20260723-1/);
  assert.match(html,/presentation-production-backchannel\.js\?v=20260723-1/);
  assert.match(html,/presentation-presenter-mode\.js\?v=20260902-2/);
  assert.match(html,/presentation-ui-i18n\.js\?v=20260903-1/);
  assert.match(html,/presentation-floating-labels\.js\?v=20260902-1/);
  assert.match(html,/admira-version-watch\.js\?build=02092026-1/);
  assert.ok(html.indexOf('presentation-share-guardian.js')<html.indexOf('presentation-presenter-mode.js'));
  assert.ok(html.indexOf('presentation-production-backchannel.js')<html.indexOf('presentation-presenter-mode.js'));
  assert.match(html,/window\.__ADMIRA_PRESENTER_NOTES__/);
  assert.match(html,/Recordar el contexto \\u003c\/script>/);
  assert.doesNotMatch(html,/Recordar el contexto <\/script><script>alert/);
});

test('audience output is structurally separated and never serializes private presenter notes',async()=>{
  const response=await renderPresentation({
    params:{client:'demo'},request:new Request('https://admiranext.test/presentaciones/demo/presentacion?audience=1'),
    env:{PRESENTATION_IDEAS:kv({'presentation:demo':config,'ideas:demo':ideas})},
    next(){throw new Error('unexpected next')}
  });
  const html=await response.text();
  assert.equal(response.status,200);
  assert.match(html,/presentation-presenter-mode\.js\?v=/);
  assert.doesNotMatch(html,/__ADMIRA_PRESENTER_NOTES__/);
  assert.doesNotMatch(html,/admira-version-watch\.js/,'la audiencia nunca debe ver avisos internos de publicación');
  assert.doesNotMatch(html,/Recordar el contexto/);
  assert.doesNotMatch(html,/Nota privada de portada|Nota privada de bloque/);
  assert.doesNotMatch(html,/Notas del orador|presenterNotes|admiraPresenterPanel/);
  assert.doesNotMatch(html,/presenterShareGuardian|Guardián de salida|Espejo privado/);
  assert.doesNotMatch(html,/presentation-production-backchannel|presenterProductionBackchannel|Backchannel de producción/);
});

test('presenter mode includes rehearsal, teleprompter, pace and same-origin remote controls',async()=>{
  const source=await readFile(new URL('../assets/presentation-presenter-mode.js',import.meta.url),'utf8');
  assert.doesNotThrow(()=>new Function(source));
  assert.match(source,/Modo presentador inteligente/);
  assert.match(source,/Notas del orador/);
  assert.match(source,/Teleprompter/);
  assert.match(source,/function paceState/);
  assert.match(source,/Acelera/);
  assert.match(source,/Vas por delante/);
  assert.match(source,/BroadcastChannel/);
  assert.match(source,/payload\.type === 'ready' && payload\.source === 'remote' && !remoteMode[\s\S]*render\(\)/);
  assert.match(source,/data-presenter-command="prev"/);
  assert.match(source,/data-presenter-command="next"/);
  assert.match(source,/aria-live="polite"/);
  assert.match(source,/prefers-reduced-motion/);
  assert.doesNotMatch(source,/WebSocket|EventSource/);
});

test('mobile remote pairs cross-device with ephemeral tokens, polling and a degraded local fallback',async()=>{
  const [source,remoteHtml,remoteSource,remoteStyles]=await Promise.all([
    readFile(new URL('../assets/presentation-presenter-mode.js',import.meta.url),'utf8'),
    readFile(new URL('../assets/presentation-presenter-remote.html',import.meta.url),'utf8'),
    readFile(new URL('../assets/presentation-presenter-remote.js',import.meta.url),'utf8'),
    readFile(new URL('../assets/presentation-presenter-remote.css',import.meta.url),'utf8')
  ]);
  assert.doesNotThrow(()=>new Function(remoteSource));
  assert.match(source,/new URL\('\/assets\/presentation-presenter-remote\.html', location\.origin\)/);
  assert.match(source,/payload\.type === 'command' && payload\.source === 'remote'/);
  assert.match(source,/\/api\/remote/);
  assert.match(source,/body: JSON\.stringify\(\{ttlSeconds: 14400\}\)/);
  assert.match(source,/\/commands\?after=' \+ session\.ackCommandSeq/);
  assert.match(source,/method: 'PUT'/);
  assert.match(source,/method: 'DELETE'/);
  assert.match(source,/ackCommandSeq: session\.ackCommandSeq/);
  assert.match(source,/paceLabel: !running && seconds === 0 \? 'ready' : paceInfo\.className/);
  assert.match(source,/fragment = new URLSearchParams\(\{[\s\S]*pair: session\.pairingSecret/);
  assert.doesNotMatch(source,/fragment = new URLSearchParams\(\{[\s\S]{0,300}?stageToken/);
  assert.match(remoteHtml,/Mando móvil/);
  assert.match(remoteHtml,/Introducir código de un uso/);
  assert.match(remoteHtml,/presentation-presenter-remote\.js/);
  assert.match(remoteHtml,/presentation-presenter-remote\.css/);
  assert.doesNotMatch(remoteHtml,/speaker-notes|presenterNotes|__ADMIRA_PRESENTER_NOTES__|data-speaker-notes/i);
  assert.match(remoteSource,/\/pair'/);
  assert.match(remoteSource,/\/state'/);
  assert.match(remoteSource,/\/commands'/);
  assert.match(remoteSource,/history\.replaceState\(null, '', location\.pathname \+ location\.search\)/);
  assert.match(remoteSource,/remoteToken: String\(data\.remoteToken\)/);
  assert.doesNotMatch(remoteSource,/(?:localStorage|sessionStorage)\.setItem\([^\n]*remoteToken/i);
  assert.match(remoteSource,/\['prev', 'next', 'skip', 'timer-toggle', 'timer-reset'\]/);
  assert.match(remoteSource,/pendingCommands = pendingCommands\.filter/);
  assert.match(remoteSource,/Fallback local · mismo navegador/);
  assert.match(remoteSource,/source: 'remote'/);
  assert.match(remoteSource,/setEnabled\(false\)/);
  assert.doesNotMatch(remoteSource,/WebSocket|EventSource|innerHTML/i);
  assert.doesNotMatch(remoteSource,/speakerNotes|__ADMIRA_PRESENTER_NOTES__|data-speaker-notes/);
  assert.doesNotMatch(remoteSource,/stageToken/);
  assert.match(remoteStyles,/touch-action:manipulation/);
});

test('audience accepts navigation, pause and captions only from the stage source',async()=>{
  const source=await readFile(new URL('../assets/presentation-presenter-mode.js',import.meta.url),'utf8');
  const audience=source.slice(source.indexOf('function startAudienceMode'),source.indexOf('function readPreferences'));
  assert.match(audience,/payload\.type === 'stage-pause' && payload\.source === 'stage'/);
  assert.match(audience,/payload\.source === 'stage' && \(payload\.type === 'command' \|\| payload\.type === 'state'\)/);
  assert.match(audience,/payload\.type === 'captions' && payload\.source === 'stage'/);
});

test('private production backchannel integrates operator cues, presenter acknowledgements and bounded expiry',async()=>{
  const [source,styles]=await Promise.all([
    readFile(new URL('../assets/presentation-presenter-mode.js',import.meta.url),'utf8'),
    readFile(new URL('../assets/presentation-presenter-mode.css',import.meta.url),'utf8')
  ]);
  for(const id of [
    'presenterProductionBackchannel','presenterBackchannelMode','presenterBackchannelComposer',
    'presenterBackchannelPriority','presenterBackchannelTtl','presenterBackchannelText',
    'presenterBackchannelSend','presenterBackchannelCues'
  ]) assert.match(source,new RegExp(`id="${id}"`));
  assert.match(source,/id="presenterProductionBackchannel"[^>]*data-presenter-private/);
  assert.match(source,/window\.AdmiraProductionBackchannel/);
  assert.match(source,/contract\.create\(\{[\s\S]{0,260}?role: productionBackchannelRole[\s\S]{0,260}?channelName: productionBackchannelChannelName\(\)/);
  assert.match(source,/function productionBackchannelChannelName\(\)[\s\S]{0,500}?replace\(\/\[\^A-Za-z0-9\._:-\]\+\/g, '-'\)[\s\S]{0,300}?slice\(-42\)/);
  assert.match(source,/productionBackchannel\.onChange\(renderProductionBackchannel\)/);
  assert.match(source,/productionBackchannel\.snapshot\(\)/);
  assert.match(source,/productionBackchannel\.sendCue\(\{text: text, priority: priority, ttlMs: ttlSeconds \* 1000\}\)/);
  assert.match(source,/productionBackchannel\.acknowledge\(cueId\)/);
  assert.match(source,/clamp\(Number\(productionBackchannelTtl\.value\) \|\| 30, 5, 300\)/);
  assert.match(source,/maxlength="240"/);
  assert.match(source,/Acusar lectura/);
  assert.match(source,/Caduca en/);
  assert.match(source,/Motor no disponible|motor de backchannel no cargó/i);
  assert.match(source,/transportStatus !== 'broadcast-channel'/);
  assert.match(source,/BroadcastChannel no está disponible[\s\S]{0,180}?envío queda desactivado/);
  assert.match(source,/productionBackchannelComposer\.hidden = !roleIsOperator/);
  assert.match(source,/initializeProductionBackchannel\('presenter'\)/);
  const integration=source.slice(source.indexOf('function productionCueList'),source.indexOf('function mountAudienceMirror'));
  assert.match(integration,/textContent = text \|\| 'Cue sin texto'/);
  assert.doesNotMatch(integration,/innerHTML|localStorage|sessionStorage|\bfetch\s*\(|WebSocket|EventSource/);
  assert.match(styles,/\.presenter-production-backchannel\[data-backchannel-state="operator"\]/);
  assert.match(styles,/\.presenter-production-backchannel\[data-backchannel-state="(?:degraded|unavailable)"\]/);
  assert.match(styles,/\.presenter-backchannel-cues li\[data-priority="urgent"\]/);
  assert.match(styles,/\.presenter-backchannel-mode button:focus-visible/);
});

test('live captions stay ephemeral, explicit and idempotent on the local audience channel',async()=>{
  const source=await readFile(new URL('../assets/presentation-presenter-mode.js',import.meta.url),'utf8');
  assert.doesNotThrow(()=>new Function(source));
  assert.match(source,/window\.SpeechRecognition \|\| window\.webkitSpeechRecognition/);
  assert.match(source,/id="presenterCaptionsStart"[^>]*>Iniciar subtítulos/);
  assert.match(source,/id="presenterCaptionsStop"[^>]*disabled[^>]*>Detener subtítulos/);
  assert.match(source,/id="presenterCaptionsLanguage"/);
  assert.match(source,/interimResults = true/);
  assert.match(source,/result\.isFinal/);
  assert.match(source,/window\.AdmiraPresenterCaptions/);
  assert.match(source,/id="presenterCaptionsTargetLanguage"/);
  assert.match(source,/id="presenterCaptionsGlossary"/);
  assert.match(source,/audienceCaptions\.show\(payload\.originalText\)/);
  assert.match(source,/audienceCaptions\.setLanguages\(payload\.sourceLanguage/);
  assert.match(source,/audienceCaptions\.setGlossary\(payload\.glossary/);
  assert.match(source,/payload\.type === 'captions'/);
  assert.match(source,/audienceReceivedMessageIds\.indexOf\(payload\.messageId\) >= 0/);
  assert.match(source,/messageId: 'captions:' \+ captionSession \+ ':' \+ captionRevision/);
  assert.match(source,/targetLanguage: captionsTargetLanguage\.value/);
  assert.match(source,/glossary: glossary/);
  assert.match(source,/originalText: trimCaptionText/);
  assert.match(source,/broadcast\(\{[\s\S]{0,400}?type: 'captions'[\s\S]{0,500}?\}, true\)/);
  assert.match(source,/if \(!transient\) \{[\s\S]{0,220}?localStorage\.setItem/);
  assert.match(source,/no se persistirá texto como fallback|no se guardarán transcripciones como fallback/);
  assert.doesNotMatch(source,/localStorage\.setItem\([^\n]*(?:caption|glossary|transcript)/i);
  const captionsLogic=source.slice(source.indexOf('function trimCaptionText'),source.indexOf('function deckFingerprint'));
  assert.doesNotMatch(captionsLogic,/\bfetch\s*\(/);
  assert.doesNotMatch(source,/WebSocket|EventSource/);
});

test('safe launch assistant requires an explicit user gesture and has accessible stateful controls',async()=>{
  const [source,styles]=await Promise.all([
    readFile(new URL('../assets/presentation-presenter-mode.js',import.meta.url),'utf8'),
    readFile(new URL('../assets/presentation-presenter-mode.css',import.meta.url),'utf8')
  ]);
  // Integration contract with task A: launching the audience window must stay inside this click handler.
  assert.match(source,/id="presenterLaunchAssistant"/);
  assert.match(source,/class="presenter-launch-assistant"/);
  assert.match(source,/data-launch-state="(?:ready|warning|blocked)"/);
  assert.match(source,/id="presenterLaunchChecklist"/);
  assert.match(source,/id="presenterAudienceLaunch"[^>]*>[^<]*(?:Presentar|audiencia|lanzar)/i);
  assert.match(source,/presenterAudienceLaunch[\s\S]{0,6000}?addEventListener\('click'/);
  assert.match(source,/aria-live="polite"/);
  assert.match(source,/aria-describedby="presenterLaunchFallback"/);
  assert.match(styles,/\.presenter-launch-assistant\[data-launch-state="ready"\]/);
  assert.match(styles,/\.presenter-launch-assistant\[data-launch-state="warning"\]/);
  assert.match(styles,/\.presenter-launch-assistant\[data-launch-state="blocked"\]/);
  assert.match(styles,/\.presenter-launch-actions button:focus-visible/);
  assert.match(styles,/\.presenter-launch-actions button:disabled/);
});

test('safe launch explains Screen Details, Fullscreen and do-not-disturb fallbacks',async()=>{
  const source=await readFile(new URL('../assets/presentation-presenter-mode.js',import.meta.url),'utf8');
  assert.match(source,/getScreenDetails/);
  assert.match(source,/requestFullscreen/);
  assert.match(source,/Screen Details/i);
  assert.match(source,/Pantalla completa/i);
  assert.match(source,/No molestar/i);
  assert.match(source,/id="presenterLaunchFallback"/);
  assert.match(source,/(?:manual|manualmente|contin(?:uar|\u00faa)|misma ventana|pantalla principal)/i);
  assert.match(source,/catch\s*\([^)]*\)\s*\{|\.catch\s*\(/);
});

test('room calibration exposes a private, persistent and bounded presenter contract',async()=>{
  const source=await readFile(new URL('../assets/presentation-presenter-mode.js',import.meta.url),'utf8');
  const id=name=>new RegExp(`id\\s*=\\s*["']${name}["']`);
  for(const name of [
    'presenterRoomCalibration','presenterCalibrationToggle','presenterCalibrationPattern',
    'presenterCalibrationSafeMargin','presenterCalibrationContrast','presenterCalibrationGamma',
    'presenterCalibrationScale','presenterCalibrationStatus'
  ]) assert.match(source,id(name));
  assert.match(source,/admira\.presenter\.calibration\.v1/);
  assert.match(source,/presenter-calibration-active/);
  for(const property of ['--presenter-calibration-safe','--presenter-calibration-contrast','--presenter-calibration-gamma','--presenter-calibration-scale']){
    assert.match(source,new RegExp(property));
  }
  for(const field of ['safeMargin','contrast','gamma','scale']) assert.match(source,new RegExp(`${field}\\s*:`));
  assert.match(source,/presenterRoomCalibration[\s\S]{0,5000}?data-presenter-private/);
  assert.match(source,/aria-live\s*=\s*["']polite["']/);
  assert.ok(source.indexOf('if (audienceMode)')<source.indexOf("admira.presenter.calibration.v1"));
  assert.match(source,/calibrationPattern\.style\.setProperty\(property, calibrationProperties\[property\]\)/);
  for(const property of ['--presenter-calibration-bar-height','--presenter-calibration-grid-size','--presenter-calibration-border-alpha','--presenter-calibration-text-alpha','--presenter-calibration-gamma-alpha']){
    assert.match(source,new RegExp(property));
  }
  const calibrationLogic=source.slice(source.indexOf('function calibrationScreenSignature'),source.indexOf('function trimCaptionText'));
  assert.doesNotMatch(calibrationLogic,/\bbroadcast\s*\(|BroadcastChannel|notes|caption|glossary|transcript/i);
  assert.doesNotMatch(source,/WebSocket|EventSource/);
});

test('room calibration renders a responsive technical pattern without filtering slide content',async()=>{
  const styles=await readFile(new URL('../assets/presentation-presenter-mode.css',import.meta.url),'utf8');
  const calibrationStyles=styles.slice(styles.indexOf('#presenterRoomCalibration'));
  assert.match(calibrationStyles,/#presenterCalibrationPattern\s*\{/);
  assert.match(calibrationStyles,/html\.presenter-calibration-active\s+#presenterCalibrationPattern\s*\{[^}]*display:block/);
  assert.match(calibrationStyles,/repeating-linear-gradient/);
  assert.match(calibrationStyles,/linear-gradient\(90deg,#fff[\s\S]{0,300}?#ff0[\s\S]{0,300}?#0ff/);
  assert.match(calibrationStyles,/#presenterCalibrationPattern::before\s*\{[^}]*inset:var\(--presenter-calibration-safe\)/);
  assert.match(calibrationStyles,/#presenterCalibrationPattern::after\s*\{[^}]*Aa Bb 0123456789/);
  assert.match(calibrationStyles,/@media\(max-width:720px\)[\s\S]*\.presenter-calibration-controls\{grid-template-columns:1fr\}/);
  assert.match(calibrationStyles,/@media\(prefers-reduced-motion:reduce\)[\s\S]*#presenterCalibrationPattern[\s\S]*animation:none!important/);
  assert.match(calibrationStyles,/\.presenter-audience-mode #presenterRoomCalibration[\s\S]*display:none!important/);
  assert.match(calibrationStyles,/#presenterCalibrationPattern\{background-size:[^}]*--presenter-calibration-bar-height[^}]*--presenter-calibration-grid-size/);
  assert.match(calibrationStyles,/#presenterCalibrationPattern::before\{border-color:rgba\(255,255,255,var\(--presenter-calibration-border-alpha,.6\)\)\}/);
  assert.match(calibrationStyles,/#presenterCalibrationPattern::after\{background:rgba\(0,0,0,var\(--presenter-calibration-gamma-alpha,.62\)\);color:rgba\(255,255,255,var\(--presenter-calibration-text-alpha,.7\)\)\}/);
  assert.doesNotMatch(calibrationStyles,/presenter-calibration-active[^{}]*body\s*>\s*\.slide[^{}]*\{[^}]*\b(?:display\s*:\s*none|filter\s*:)/);
});

test('audience mode cannot render presenter controls, notes or private-marked content',async()=>{
  const [source,styles]=await Promise.all([
    readFile(new URL('../assets/presentation-presenter-mode.js',import.meta.url),'utf8'),
    readFile(new URL('../assets/presentation-presenter-mode.css',import.meta.url),'utf8')
  ]);
  // Integration contract with task A: the audience query is handled before constructing the private panel.
  assert.match(source,/query\.get\('audience'\) === '1'/);
  assert.match(source,/presenter-audience-mode/);
  assert.match(source,/if\s*\([^)]*audienceMode[^)]*\)\s*\{[\s\S]{0,800}?return;/);
  assert.match(styles,/\.presenter-audience-mode \.presenter-panel[\s\S]*\.presenter-audience-mode \.presenter-notes[\s\S]*\.presenter-audience-mode \.inline-editor[\s\S]*\.presenter-audience-mode \.quality-levels[\s\S]*\.presenter-audience-mode \[data-presenter-private\]\{display:none!important\}/);
  assert.match(source,/presenter-cursor-hidden/);
  assert.match(source,/addEventListener\('pointermove', hideAudienceCursorSoon/);
});

test('middleware never injects editor controls into the audience response',async()=>{
  const middleware=await readFile(new URL('../functions/presentaciones/_middleware.js',import.meta.url),'utf8');
  assert.match(middleware,/isAudienceOutput = isPresentationMode && url\.searchParams\.get\('audience'\) === '1'/);
  assert.match(middleware,/isPresentationMode && !isAudienceOutput && \(masterValid \|\| editorValid\)/);
});

test('presenter preferences persist only non-sensitive timing and reading settings',async()=>{
  const source=await readFile(new URL('../assets/presentation-presenter-mode.js',import.meta.url),'utf8');
  const stored=source.match(/localStorage\.setItem\(storageKey,[\s\S]*?\}\)\);/)?.[0]||'';
  assert.match(stored,/durationMinutes/);
  assert.match(stored,/promptSize/);
  assert.match(stored,/promptSpeed/);
  assert.doesNotMatch(stored,/notes|client|password|speaker/i);
  assert.match(source,/Number\(value\.durationMinutes\) \? clamp\(Number\(value\.durationMinutes\), 5, 180\) : 0/);
  assert.match(source,/preferences\.durationMinutes \|\| Math\.max\(5, Math\.ceil\(slides\.length \* 0\.75\)\)/);
});

test('presenter stores a versioned exact session and offers explicit recovery or reset',async()=>{
  const source=await readFile(new URL('../assets/presentation-presenter-mode.js',import.meta.url),'utf8');
  assert.match(source,/sessionSchema = 2/);
  assert.match(source,/fingerprint: deckFingerprint\(\)/);
  for(const field of ['index','elapsed','running','savedAt','panelOpen','promptPlaying','notesScrollTop','fullscreen','media']){
    assert.match(source,new RegExp(`${field}:`));
  }
  assert.match(source,/id="presenterResume"[^>]*>Reanudar exactamente/);
  assert.match(source,/id="presenterDiscard"[^>]*>Empezar de nuevo/);
  assert.match(source,/function resumeSession\(\)[\s\S]*goLocal\(currentIndex, true\)[\s\S]*restoreMedia\(saved\.media\)/);
  assert.match(source,/saved\.fullscreen[\s\S]*requestFullscreen/);
  assert.match(source,/slideCount !== slides\.length \|\| value\.fingerprint !== deckFingerprint\(\)/);
});

test('presenter provides idempotent offline reconnect and a restricted cache fallback',async()=>{
  const source=await readFile(new URL('../assets/presentation-presenter-mode.js',import.meta.url),'utf8');
  const worker=await readFile(new URL('../presentation-presenter-sw.js',import.meta.url),'utf8');
  assert.doesNotThrow(()=>new Function(worker));
  assert.match(source,/addEventListener\('offline'/);
  assert.match(source,/addEventListener\('online'[\s\S]*refreshOfflineCache\(\)[\s\S]*broadcast\(\{type: 'ready'\}\)/);
  assert.match(source,/ADMIRA_PRESENTATION_PRECACHE/);
  assert.match(source,/Reconectando con la presentación/);
  assert.match(source,/receivedMessageIds\.indexOf\(payload\.messageId\) >= 0/);
  assert.match(source,/payload\.messageId = payload\.messageId \|\| payload\.source/);
  assert.match(source,/function applyRemoteCommand\([\s\S]*if \(!Number\.isFinite\(nextIndex\)\) return false;[\s\S]*goLocal\(nextIndex\)/);
  assert.match(worker,/url\.pathname\.includes\('\/api\/'\)/);
  assert.match(worker,/request\.mode === 'navigate' && isPresentationPath\(url\.pathname\)/);
  assert.match(worker,/fetchAndStore\(request\)\.catch\(\(\) => caches\.match\(request\)/);
  assert.match(worker,/results\.every\(result => result\.status === 'fulfilled'\)/);
});

test('stage pause exposes a private accessible control and an emergency keyboard shortcut',async()=>{
  const source=await readFile(new URL('../assets/presentation-presenter-mode.js',import.meta.url),'utf8');
  assert.match(source,/id="presenterStagePause"/);
  assert.match(source,/id="presenterStagePause"[^>]*aria-pressed="false"/);
  assert.match(source,/id="presenterStagePause"[^>]*aria-keyshortcuts="B"/);
  assert.match(source,/id="presenterStagePause"[^>]*data-presenter-private/);
  assert.match(source,/event\.target\?\.closest\?\.\('input,textarea,select,button,\[contenteditable="true"\]'\)/);
  assert.match(source,/event\.key\.toLowerCase\(\) === 'b'[\s\S]{0,240}?setStagePaused\(/);
});

test('stage pause sends an allowlisted audience signal without presenter notes or private state',async()=>{
  const source=await readFile(new URL('../assets/presentation-presenter-mode.js',import.meta.url),'utf8');
  const stagePause=source.match(/function setStagePaused\([^)]*\)\s*\{[\s\S]*?\n  \}/)?.[0]||'';
  const stagePauseSignal=stagePause.match(/broadcast\(\{[^\n]*type: 'stage-pause'[^\n]*\}\)/)?.[0]||'';
  assert.match(stagePauseSignal,/broadcast\(\{type: 'stage-pause', paused: stagePaused, index: currentIndex\}\)/);
  assert.doesNotMatch(stagePauseSignal,/notes|speaker|generalNotes|innerHTML|textContent|client|token/i);
  assert.match(source,/payload\.type === 'stage-pause'[\s\S]{0,240}?setAudienceStagePaused\(Boolean\(payload\.paused\), payload\.index\)/);
  assert.match(source,/data-presenter-surface', 'audience'[\s\S]*?presenter-stage-waiting/);
});

test('stage pause resumes the exact audience slide and is idempotent with a safe transport fallback',async()=>{
  const source=await readFile(new URL('../assets/presentation-presenter-mode.js',import.meta.url),'utf8');
  const audiencePause=source.match(/function setAudienceStagePaused\([^)]*\)\s*\{[\s\S]*?\n    \}/)?.[0]||'';
  assert.match(audiencePause,/if \(audienceStagePaused === paused\)[\s\S]{0,120}?return/);
  assert.match(audiencePause,/audiencePauseSnapshot = \{index: audienceIndex, media: captureMedia\(\)\}/);
  assert.match(audiencePause,/audienceGo\(audiencePauseSnapshot\.index\)[\s\S]{0,160}?restoreMedia\(audiencePauseSnapshot\.media\)/);
  assert.match(source,/function broadcast\(payload(?:, transient)?\)[\s\S]*?if \(channel\) channel\.postMessage\(payload\)[\s\S]*?localStorage\.setItem\(channelName/);
  assert.match(source,/function audienceSend\(payload\)[\s\S]*?if \(audienceChannel\) audienceChannel\.postMessage\(payload\)[\s\S]*?localStorage\.setItem\(channelName/);
  assert.match(source,/audienceWindow\.postMessage\(payload, location\.origin\)/);
  assert.doesNotMatch(source,/audienceWindow\.postMessage\([^,\n]+,\s*['"]\*['"]/);
  assert.match(source,/addEventListener\('message', function \(event\) \{[\s\S]{0,180}?event\.origin !== location\.origin[\s\S]{0,180}?audienceReceive\(event\.data\)/);
  assert.match(source,/pagehide[\s\S]{0,180}?if \(audienceChannel\) audienceChannel\.close\(\)/);
});

test('private share guardian integrates through the explicit gesture contract with an honest fallback',async()=>{
  const [source,styles]=await Promise.all([
    readFile(new URL('../assets/presentation-presenter-mode.js',import.meta.url),'utf8'),
    readFile(new URL('../assets/presentation-presenter-mode.css',import.meta.url),'utf8')
  ]);
  for(const id of [
    'presenterShareGuardian','presenterShareGuardianAction','presenterShareSurface',
    'presenterShareSignal','presenterAudienceHeartbeat','presenterShareAlerts'
  ]) assert.match(source,new RegExp(`id="${id}"`));
  assert.match(source,/data-guardian-state="warning"[^>]*data-presenter-private/);
  assert.match(source,/Seleccionar y compartir salida/);
  assert.match(source,/AdmiraPresentationShareGuardian/);
  assert.match(source,/contract\.create\(\{[\s\S]{0,220}?role: 'presenter'[\s\S]{0,220}?channelName: channelName[\s\S]{0,220}?onChange:/);
  assert.match(source,/requestGuardianShare\(event\)[\s\S]{0,900}?requestShareFromGesture\(event\)/);
  assert.match(source,/shareGuardianAction\.addEventListener\('click', requestGuardianShare\)/);
  const shareRequest=source.match(/function requestGuardianShare\([^)]*\)\s*\{[\s\S]*?\n  \}/)?.[0]||'';
  assert.ok(shareRequest.indexOf('launchAudienceOutput()')<shareRequest.indexOf('return;'));
  assert.ok(shareRequest.indexOf('requestShareFromGesture(event)')>shareRequest.indexOf('return;'));
  assert.match(shareRequest,/result && result\.state/);
  assert.doesNotMatch(shareRequest,/phase:[^,\n]*cancelled/);
  assert.match(source,/Guardián no disponible:[^']*manualmente/);
  assert.match(source,/declarada por navegador/);
  assert.doesNotMatch(source,/Ventana verificada|Pestaña verificada/);
  assert.doesNotMatch(source,/\bgetDisplayMedia\s*\(/);
  assert.match(styles,/\.presenter-share-guardian\[data-guardian-state="ready"\]/);
  assert.match(styles,/\.presenter-share-guardian\[data-guardian-state="blocked"\]/);
  assert.match(styles,/\.presenter-share-guardian-action:focus-visible/);
});

test('private audience mirror and heartbeat expose only allowlisted operational health',async()=>{
  const source=await readFile(new URL('../assets/presentation-presenter-mode.js',import.meta.url),'utf8');
  assert.match(source,/id="presenterAudienceMirror"[^>]*sandbox="allow-scripts allow-same-origin"[^>]*referrerpolicy="no-referrer"/);
  assert.match(source,/url\.searchParams\.set\('audience', '1'\)/);
  assert.match(source,/url\.searchParams\.set\('mirror', '1'\)/);
  assert.match(source,/audienceMirror\.src = audienceOutputUrl\(true\)\.href/);
  assert.match(source,/ShareGuardianContract\.create\(\{role: 'audience', channelName: channelName\}\)/);
  assert.match(source,/type \|\| 'audience-heartbeat'/);
  assert.match(source,/embedded: audienceEmbedded/);
  assert.match(source,/visible: !document\.hidden/);
  assert.match(source,/media: media/);
  const heartbeat=source.match(/function sendAudienceHeartbeat\([^)]*\)\s*\{[\s\S]*?\n    \}/)?.[0]||'';
  assert.doesNotMatch(heartbeat,/notes|speaker|innerHTML|textContent|src|href|url|capture|screenshot/i);
  assert.match(source,/setInterval\(function \(\) \{ sendAudienceHeartbeat\('audience-heartbeat'\); \}, 1500\)/);
  assert.match(source,/La pista de salida está silenciada/);
  assert.match(source,/La pista de salida ha finalizado/);
  assert.match(source,/La ventana de audiencia se ha cerrado/);
  assert.match(source,/La salida de audiencia está desactualizada/);
  assert.match(source,/event\.source === audienceMirror\.contentWindow/);
  assert.doesNotMatch(source,/toDataURL|drawImage|ImageCapture|takePhoto|getDisplayMedia\s*\(/);
});
