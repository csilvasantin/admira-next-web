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
  assert.match(html,/presentation-presenter-mode\.css\?v=20260723-1/);
  assert.match(html,/presentation-presenter-mode\.js\?v=20260723-1/);
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
  assert.doesNotMatch(html,/Recordar el contexto/);
  assert.doesNotMatch(html,/Nota privada de portada|Nota privada de bloque/);
  assert.doesNotMatch(html,/Notas del orador|presenterNotes|admiraPresenterPanel/);
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
  assert.match(source,/payload\.type === 'ready' && !remoteMode[\s\S]*render\(\)/);
  assert.match(source,/data-presenter-command="prev"/);
  assert.match(source,/data-presenter-command="next"/);
  assert.match(source,/aria-live="polite"/);
  assert.match(source,/prefers-reduced-motion/);
  assert.doesNotMatch(source,/\bfetch\s*\(/);
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
  assert.match(source,/goLocal\(Number\.isFinite\(requestedIndex\) \? requestedIndex/);
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
  assert.match(source,/function broadcast\(payload\)[\s\S]*?if \(channel\) channel\.postMessage\(payload\)[\s\S]*?localStorage\.setItem\(channelName/);
  assert.match(source,/function audienceSend\(payload\)[\s\S]*?if \(audienceChannel\) audienceChannel\.postMessage\(payload\)[\s\S]*?localStorage\.setItem\(channelName/);
  assert.match(source,/audienceWindow\.postMessage\(payload, location\.origin\)/);
  assert.doesNotMatch(source,/audienceWindow\.postMessage\([^,\n]+,\s*['"]\*['"]/);
  assert.match(source,/addEventListener\('message', function \(event\) \{[\s\S]{0,180}?event\.origin !== location\.origin[\s\S]{0,180}?audienceReceive\(event\.data\)/);
  assert.match(source,/pagehide[\s\S]{0,180}?if \(audienceChannel\) audienceChannel\.close\(\)/);
});
