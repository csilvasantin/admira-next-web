// 16-oct-2026 · Carlos: «ajústalo y que tenga un botón para poner a pantalla completa».
// Los vídeos de lámina (mp4 1920x1080, 16:9) salían recortados por la derecha: en BEST el
// marco heredaba el `aspect-ratio:4/5; object-fit:cover` de las ilustraciones, y en las
// láminas a sangre `.slide-media video` también era `cover`. Ahora el vídeo se ve ENTERO
// (contain, 16:9, fondo oscuro) y lleva un botón de pantalla completa sobre el contenedor.
import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';
import {onRequestGet as renderPresentation} from '../functions/presentaciones/[client]/presentacion.js';
import {onRequestGet as renderIndex} from '../functions/presentaciones/[client]/index.js';

function kv(values){return{async get(key,options){const value=values[key];return options?.type==='json'?value:JSON.stringify(value)}}}
const ideas={hero:{title:'Propuesta',summary:'Resumen'},objective:'Objetivo',skeleton:[{id:'uno',title:'Uno',message:'M',detail:'D'}],closing:{title:'Cierre',action:'Acción'},labels:{objective:'Objetivo',next:'Siguiente'}};

async function render({languages=['es'],audience=false}={}){
  const config={displayName:'Demo',outputs:['website'],languages,theme:{},sequence:{},slideMedia:[{slide:'cover',type:'video',src:'/presentaciones/demo/media/apertura.mp4',caption:'Apertura',fallback:'Estático',preload:'metadata'}]};
  const response=await renderPresentation({params:{client:'demo'},request:new Request(`https://admiranext.test/presentaciones/demo/presentacion${audience?'?audience=1':''}`),env:{PRESENTATION_IDEAS:kv({'presentation:demo':config,'ideas:demo':ideas})},next(){throw new Error('unexpected next')}});
  return response.text();
}

test('la lámina con vídeo lleva un botón de pantalla completa accesible sobre el contenedor del vídeo',async()=>{
  const html=await render();
  const figure=html.match(/<figure class="slide-media"[^>]*data-media-type="video"[^>]*>[\s\S]*?<\/figure>/)[0];
  assert.match(figure,/data-video-frame/);
  assert.match(figure,/<button class="video-fullscreen-btn" type="button" data-video-fullscreen aria-pressed="false" aria-label="Pantalla completa"/);
  // El botón convive con los controles de reproducción de la propia lámina.
  assert.match(figure,/data-slide-media-control/);
  assert.match(figure,/controlslist="nofullscreen"/);
  // Y la figura de BEST (vídeo enmarcado) también es contenedor de pantalla completa, con controles.
  assert.match(html,/<figure class="best-figure" aria-hidden="true" data-video-frame><img alt="" loading="lazy"><video class="best-figure-video"[^>]*controls[^>]*hidden><\/video><button class="video-fullscreen-btn best-figure-fullscreen"[^>]*aria-label="Pantalla completa"[^>]*hidden>/);
  assert.match(html,/presentation-video-fullscreen\.css\?v=/);
  assert.match(html,/presentation-video-fullscreen\.js\?v=/);
});

test('la etiqueta del botón sale en el idioma de la sala: Full screen en inglés',async()=>{
  const html=await render({languages:['en','es']});
  assert.match(html,/data-video-fullscreen aria-pressed="false" aria-label="Full screen"/);
  assert.doesNotMatch(html,/data-video-fullscreen aria-pressed="false" aria-label="Pantalla completa"/);
});

test('también viaja en la vista de audiencia (?audience=1)',async()=>{
  const html=await render({audience:true});
  assert.match(html,/data-video-fullscreen/);
  assert.match(html,/presentation-video-fullscreen\.js/);
});

test('BEST: el marco del vídeo es 16:9 y el vídeo usa contain, sin el 4/5 + cover de las ilustraciones',async()=>{
  const html=await render();
  const rule=[...html.matchAll(/html\[data-quality="best"\] \.slide:not\(\.deck-slide\)\[data-has-video="true"\] \.best-figure\{[^}]*\}/g)].map(m=>m[0]).find(r=>r.includes('aspect-ratio'));
  assert.ok(rule,'regla del marco 16:9');
  assert.match(rule,/aspect-ratio:16\/9/);
  assert.match(rule,/width:min\(100%,calc\(min\(72vh,640px\) \* 16 \/ 9\)\)/);
  const video=html.match(/\.best-figure video\.best-figure-video\{[^}]*\}/)[0];
  assert.match(video,/object-fit:contain/);
  assert.match(video,/aspect-ratio:16\/9/);
  assert.doesNotMatch(video,/object-fit:cover|aspect-ratio:4\/5/);
  // La regla de vídeo va DESPUÉS de la genérica 4/5 + cover de imagen/vídeo, para que gane.
  assert.ok(html.indexOf('.best-figure video.best-figure-video{width:100%')>html.indexOf('aspect-ratio:4/5;object-fit:cover'));
  // En móvil el marco sigue siendo 16:9 (no 16/10) y limita su alto.
  assert.match(html,/@media\(max-width:900px\)\{html\[data-quality="best"\] \.slide:not\(\.deck-slide\)\[data-has-video="true"\] \.best-figure\{width:min\(100%,calc\(38vh \* 16 \/ 9\)\);max-height:38vh\}/);
});

test('syncBestFigures muestra el botón sólo cuando hay vídeo y des-oculta la figura a lectores de pantalla',async()=>{
  const html=await render();
  assert.match(html,/const fsBtn=figureRoot\.querySelector\('\[data-video-fullscreen\]'\);if\(fsBtn\)fsBtn\.hidden=false;figureRoot\.removeAttribute\('aria-hidden'\)/);
  assert.match(html,/const fsOff=figureRoot\.querySelector\('\[data-video-fullscreen\]'\);if\(fsOff\)fsOff\.hidden=true;figureRoot\.setAttribute\('aria-hidden','true'\)/);
});

test('hojas: lámina a sangre con vídeo en contain (imagen sigue en cover) y estilo de pantalla completa',async()=>{
  const media=await readFile(new URL('../assets/presentation-slide-media.css',import.meta.url),'utf8');
  assert.match(media,/\.slide-media video\{object-fit:contain/);
  assert.match(media,/\.slide-media video,\.slide-media img\{[^}]*object-fit:cover\}/);
  const css=await readFile(new URL('../assets/presentation-video-fullscreen.css',import.meta.url),'utf8');
  assert.match(css,/\[data-video-frame\]:fullscreen video\{[^}]*object-fit:contain/);
  assert.match(css,/\[data-video-frame\]:-webkit-full-screen/);
  assert.match(css,/\.video-fullscreen-btn:focus-visible\{outline/);
});

test('la sala conserva sus atajos: la tecla F sigue entrando a pantalla completa y el botón de vídeo no la usa',async()=>{
  const html=await render();
  assert.match(html,/if\(event\.key\.toLowerCase\(\)==='f'\)enterFullscreen\(\)/);
  assert.match(html,/event\.target\?\.closest\?\.\('input,textarea,select,button'\)\)return/);
  const js=await readFile(new URL('../assets/presentation-video-fullscreen.js',import.meta.url),'utf8');
  assert.doesNotMatch(js,/keydown|keyup|keypress|event\.key/);
});

function entorno({hasFullscreenApi=true,lang='es'}={}){
  const listeners={};
  const mk=(extra={})=>({attrs:{},setAttribute(k,v){this.attrs[k]=String(v)},getAttribute(k){return this.attrs[k]??null},removeAttribute(k){delete this.attrs[k]},classList:{contains:()=>false},...extra});
  const calls=[];
  const video=mk({webkitEnterFullscreen(){calls.push('video.webkitEnterFullscreen')}});
  const frame=mk({querySelector:()=>video,classList:{contains:c=>c==='slide-media'}});
  if(hasFullscreenApi)frame.requestFullscreen=function(){calls.push('frame.requestFullscreen');document.fullscreenElement=frame;return Promise.resolve()};
  const button=mk({closest:sel=>sel==='[data-video-frame]'?frame:button});
  const document={fullscreenElement:null,documentElement:mk(),exitFullscreen(){calls.push('exitFullscreen');document.fullscreenElement=null;return Promise.resolve()},
    addEventListener:(t,f)=>{(listeners[t]||=[]).push(f)},
    querySelectorAll:sel=>sel==='[data-video-fullscreen]'?[button]:sel==='[data-video-frame]'?[frame]:[]};
  document.documentElement.attrs.lang=lang;
  const context=vm.createContext({document,window:{},Promise,String,Boolean,Array,Object});
  vm.runInContext(readFileSyncSource,context);
  return {document,button,frame,video,calls,fire:t=>(listeners[t]||[]).forEach(f=>f({target:button,preventDefault(){}})),context};
}
let readFileSyncSource='';
test.before(async()=>{readFileSyncSource=await readFile(new URL('../assets/presentation-video-fullscreen.js',import.meta.url),'utf8')});

test('script: clic entra con la Fullscreen API del contenedor, el segundo clic sale y aria-pressed lo refleja',()=>{
  const e=entorno();
  assert.equal(e.button.getAttribute('aria-label'),'Pantalla completa');
  e.fire('click');
  assert.deepEqual(e.calls,['frame.requestFullscreen']);
  e.fire('fullscreenchange');
  assert.equal(e.button.getAttribute('aria-pressed'),'true');
  assert.equal(e.video.getAttribute('controls'),'','a pantalla completa el vídeo conserva controles de reproducción');
  e.fire('click');
  assert.deepEqual(e.calls,['frame.requestFullscreen','exitFullscreen']);
  e.fire('fullscreenchange');
  assert.equal(e.button.getAttribute('aria-pressed'),'false');
  assert.equal(e.video.getAttribute('controls'),null);
});

test('script: sin Fullscreen API (iPhone) usa webkitEnterFullscreen del propio vídeo',()=>{
  const e=entorno({hasFullscreenApi:false});
  e.fire('click');
  assert.deepEqual(e.calls,['video.webkitEnterFullscreen']);
});

test('script: la etiqueta sigue al idioma («Full screen» en inglés)',()=>{
  const e=entorno({lang:'en'});
  assert.equal(e.button.getAttribute('aria-label'),'Full screen');
  assert.match(e.button.getAttribute('title'),/Full screen · Esc/);
});

test('la ficha de la presentación: el vídeo de la pieza también cabe entero y lleva el botón',async()=>{
  const config={displayName:'Demo',outputs:['video'],languages:['es'],theme:{}};
  const generation={client:'demo',languages:['es'],requested:['video'],artifacts:{video:{status:'ready',url:'/presentaciones/demo/media/pieza.mp4',label:'Vídeo'}}};
  const response=await renderIndex({params:{client:'demo'},request:new Request('https://admiranext.test/presentaciones/demo'),env:{PRESENTATION_IDEAS:kv({'presentation:demo':config,'generation:demo':generation})},next(){throw new Error('unexpected next')}});
  const html=await response.text();
  assert.match(html,/<div class="video-frame" data-video-frame><video class="media" controls/);
  assert.match(html,/\.video-frame \.media\{[^}]*object-fit:contain/);
  assert.match(html,/data-video-fullscreen/);
});
