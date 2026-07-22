import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {onRequestGet as renderPresentation} from '../functions/presentaciones/[client]/presentacion.js';

function kv(values){return{async get(key,options){const value=values[key];return options?.type==='json'?value:JSON.stringify(value)}}}

const config={displayName:'Demo',outputs:['website'],languages:['es'],theme:{},sequence:{}};
const ideas={
  hero:{title:'Propuesta',summary:'Resumen'},objective:'Objetivo',
  skeleton:[{id:'uno',title:'Idea',message:'Mensaje',detail:'Detalle',enabled:true}],
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
  assert.match(html,/presentation-presenter-mode\.css\?v=20260722-2/);
  assert.match(html,/presentation-presenter-mode\.js\?v=20260722-2/);
  assert.match(html,/window\.__ADMIRA_PRESENTER_NOTES__/);
  assert.match(html,/Recordar el contexto \\u003c\/script>/);
  assert.doesNotMatch(html,/Recordar el contexto <\/script><script>alert/);
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
