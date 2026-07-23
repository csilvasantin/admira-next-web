import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {onRequestGet as renderPresentation} from '../functions/presentaciones/[client]/presentacion.js';
import {normalizeSlideMedia} from '../functions/presentaciones/_slide-media.js';

function kv(values){
  return {
    async get(key, options){
      const value=values[key];
      return options?.type==='json'?value:JSON.stringify(value);
    }
  };
}

const ideas={
  hero:{title:'Propuesta',summary:'Resumen',speakerNotes:'Nota privada de portada'},
  objective:'Objetivo',
  skeleton:[
    {id:'historia',title:'Historia',message:'Mensaje',detail:'Detalle',enabled:true,notes:'Nota privada de bloque'}
  ],
  closing:{title:'Cierre',action:'Acción'},
  labels:{objective:'Objetivo',next:'Siguiente'},
  notes:'Notas privadas del presentador'
};

const slideMedia=[
  {
    slide:'cover',
    type:'video',
    src:'/presentaciones/demo/media/apertura.mp4',
    poster:'/presentaciones/demo/images/apertura.webp',
    caption:'Apertura audiovisual',
    fallback:'La apertura continúa en versión estática.',
    preload:'auto',
    autoplay:true,
    muted:true,
    loop:true
  },
  {
    slide:'objective',
    type:'audio',
    src:'/presentaciones/demo/media/objetivo.m4a',
    caption:'Relato del objetivo',
    fallback:'Lee el objetivo en pantalla.',
    preload:'metadata'
  },
  {
    slide:'historia',
    type:'animation',
    animation:'rise',
    durationMs:2400,
    caption:'Revelado narrativo',
    fallback:'La idea permanece visible sin movimiento.'
  },
  {
    slide:'closing',
    type:'video',
    src:'https://tracker.invalid/closing.mp4',
    poster:'javascript:alert(1)',
    caption:'No debe renderizarse',
    fallback:'<img src=x onerror=alert(1)>'
  }
];

async function render({audience=false, media=slideMedia}={}){
  const config={
    displayName:'Demo',
    outputs:['website'],
    languages:['es'],
    theme:{},
    sequence:{},
    slideMedia:media
  };
  const response=await renderPresentation({
    params:{client:'demo'},
    request:new Request(`https://admiranext.test/presentaciones/demo/presentacion${audience?'?audience=1':''}`),
    env:{PRESENTATION_IDEAS:kv({'presentation:demo':config,'ideas:demo':ideas})},
    next(){throw new Error('unexpected next');}
  });
  return {response,html:await response.text()};
}

test('slide media normalization bounds options and rejects unsafe or ambiguous input',()=>{
  const normalized=normalizeSlideMedia([
    {
      slide:'cover',
      type:'video',
      src:'/presentaciones/demo/media/opening.mp4',
      autoplay:true,
      muted:false,
      durationMs:999999,
      caption:'  Apertura  '
    },
    {
      slide:'historia',
      type:'animation',
      animation:'unknown',
      durationMs:1
    }
  ],'demo');
  assert.equal(normalized.length,2);
  assert.deepEqual(
    {
      slide:normalized[0].slide,
      type:normalized[0].type,
      src:normalized[0].src,
      autoplay:normalized[0].autoplay,
      muted:normalized[0].muted,
      durationMs:normalized[0].durationMs,
      caption:normalized[0].caption
    },
    {
      slide:'cover',
      type:'video',
      src:'/presentaciones/demo/media/opening.mp4',
      autoplay:true,
      muted:true,
      durationMs:20000,
      caption:'Apertura'
    }
  );
  assert.equal(normalized[1].animation,'fade');
  assert.equal(normalized[1].durationMs,300);
  assert.throws(
    ()=>normalizeSlideMedia([{slide:'cover',type:'video',src:'https://tracker.invalid/opening.mp4'}],'demo'),
    /URL privada|\/presentaciones\/demo\/media/
  );
  assert.throws(
    ()=>normalizeSlideMedia([
      {slide:'cover',type:'animation'},
      {slide:'cover',type:'audio',src:'/presentaciones/demo/media/opening.m4a'}
    ],'demo'),
    /Solo puede haber un medio/
  );
});

test('narrative media is attached to its slide with accessible static fallbacks',async()=>{
  const {response,html}=await render();
  assert.equal(response.status,200);
  assert.match(html,/presentation-slide-media\.css\?v=/);
  assert.match(html,/presentation-slide-media\.js\?v=/);
  assert.match(html,/data-slide-media/);
  assert.match(html,/data-(?:media-)?slide="cover"|data-slide-media[^>]*cover/);
  assert.match(html,/<video\b[^>]*src="\/presentaciones\/demo\/media\/apertura\.mp4"/);
  assert.match(html,/<video\b[^>]*poster="\/presentaciones\/demo\/images\/apertura\.webp"/);
  assert.match(html,/<audio\b[^>]*src="\/presentaciones\/demo\/media\/objetivo\.m4a"/);
  assert.match(html,/data-(?:media-)?animation="rise"|data-slide-media-animation="rise"/);
  assert.match(html,/Apertura audiovisual/);
  assert.match(html,/La apertura continúa en versión estática\./);
  assert.match(html,/La idea permanece visible sin movimiento\./);
  assert.match(html,/aria-(?:label|describedby)=/);
});

test('media URLs are same-origin, client-scoped and unsafe entries fail closed',async()=>{
  const {html}=await render();
  assert.doesNotMatch(html,/tracker\.invalid/);
  assert.doesNotMatch(html,/javascript:alert/);
  assert.doesNotMatch(html,/onerror=alert/);
  assert.doesNotMatch(html,/No debe renderizarse/);

  const {html:crossClient}=await render({media:[{
    slide:'cover',
    type:'video',
    src:'/presentaciones/otro/media/filtracion.mp4',
    fallback:'No permitido'
  }]});
  assert.doesNotMatch(crossClient,/filtracion\.mp4|No permitido/);
});

test('runtime controls active playback, bounded look-ahead preload and resilient fallback',async()=>{
  const source=await readFile(new URL('../assets/presentation-slide-media.js',import.meta.url),'utf8');
  assert.doesNotThrow(()=>new Function(source));
  assert.match(source,/(?:IntersectionObserver|getBoundingClientRect)/);
  assert.match(source,/querySelector(?:All)?\([^)]*\[data-slide-media/);
  assert.match(source,/\.play\(\)/);
  assert.match(source,/\.pause\(\)/);
  assert.match(source,/(?:currentTime\s*=\s*0|removeAttribute\(['"]src['"]\)|\.load\(\))/);
  assert.match(source,/(?:index\s*\+\s*1|nextElementSibling|nextSlide)/);
  assert.match(source,/\.preload\s*=\s*['"](?:none|metadata|auto)['"]|setAttribute\(['"]preload['"]/);
  assert.match(source,/(?:error|stalled|abort)/);
  assert.match(source,/(?:fallback|data-slide-media-fallback)/);
  assert.match(source,/document\.visibilityState|document\.hidden/);
  assert.match(source,/pagehide|visibilitychange/);
});

test('runtime exposes privacy-safe performance measurements without external telemetry',async()=>{
  const source=await readFile(new URL('../assets/presentation-slide-media.js',import.meta.url),'utf8');
  assert.match(source,/performance\.(?:now|getEntriesByName)/);
  assert.match(source,/admira:slide-media-metric/);
  assert.match(source,/CustomEvent/);
  assert.match(source,/(?:snapshot|Snapshot)/);
  assert.doesNotMatch(source,/\b(?:fetch|sendBeacon|XMLHttpRequest|WebSocket|EventSource)\s*\(/);
  assert.doesNotMatch(source,/(?:localStorage|sessionStorage)\.(?:setItem|getItem)/);
  assert.doesNotMatch(source,/(?:speakerNotes|__ADMIRA_PRESENTER_NOTES__|presenterNotes)/);
});

test('audience=1 receives playable narrative media but no private presenter payload',async()=>{
  const {response,html}=await render({audience:true});
  assert.equal(response.status,200);
  assert.match(html,/presenter-audience-mode/);
  assert.match(html,/presentation-slide-media\.js\?v=/);
  assert.match(html,/\/presentaciones\/demo\/media\/apertura\.mp4/);
  assert.match(html,/\/presentaciones\/demo\/media\/objetivo\.m4a/);
  assert.match(html,/data-slide-media/);
  assert.doesNotMatch(html,/Notas privadas del presentador|Nota privada de portada|Nota privada de bloque/);
  assert.doesNotMatch(html,/__ADMIRA_PRESENTER_NOTES__|speakerNotes|data-speaker-notes/);
  assert.doesNotMatch(html,/slideMedia\s*:/);
});

test('animation respects reduced motion and fallbacks are present in server-rendered HTML',async()=>{
  const styles=await readFile(new URL('../assets/presentation-slide-media.css',import.meta.url),'utf8');
  assert.match(styles,/@media\s*\(prefers-reduced-motion:\s*reduce\)/);
  assert.match(styles,/\[data-slide-media/);
  assert.match(styles,/(?:fallback|data-slide-media-fallback)/);

  const {html}=await render();
  const fallbackAt=html.indexOf('La apertura continúa en versión estática.');
  const runtimeAt=html.indexOf('presentation-slide-media.js');
  assert.ok(fallbackAt>=0&&runtimeAt>=0&&fallbackAt<runtimeAt,'fallback must be in server-rendered HTML before the runtime loads');
});
