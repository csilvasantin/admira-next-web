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
  assert.match(html,/presentation-presenter-mode\.css\?v=20260722-1/);
  assert.match(html,/presentation-presenter-mode\.js\?v=20260722-1/);
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
