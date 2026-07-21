import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {DEFAULT_BEFORE_DECK,DEFAULT_BEFORE_LENGTH,DEFAULT_BEFORE_QUALITY,getDeckPack,isDeckAsset,listDeckPacks,normalizeSequence} from '../functions/presentaciones/_deck-library.js';
import {onRequestGet as renderPresentation} from '../functions/presentaciones/[client]/presentacion.js';
import {onRequestGet as serveDeckAsset} from '../functions/presentaciones/[client]/deck/[collection]/[file].js';

function kv(values){return{async get(key,options){const value=values[key];return options?.type==='json'?value:JSON.stringify(value)}}}

test('deck library exposes a curated corporate opening and optional XaaS close',()=>{
  const decks=listDeckPacks(),opening=getDeckPack(DEFAULT_BEFORE_DECK,'demo'),closing=getDeckPack('admira-2026-vision-xaas','demo');
  assert.equal(decks.length,2);assert.equal(opening.slides.length,42);assert.equal(closing.slides.length,3);
  assert.equal(opening.slides[0].urls.es,'/presentaciones/demo/deck/admira-2026/es-slide-01.webp');
  assert.equal(opening.slides[0].urls.ca,'/presentaciones/demo/deck/admira-2026/ca-slide-01.webp');
  assert.equal(opening.slides.at(-1).sourceSlide,42);
  assert.equal(getDeckPack(DEFAULT_BEFORE_DECK,'demo',{length:'short'}).slides.length,11);
  assert.match(getDeckPack(DEFAULT_BEFORE_DECK,'demo',{quality:'best'}).slides[0].bestUrl,/best-team\.webp$/);
  assert.equal(DEFAULT_BEFORE_LENGTH,'full');assert.equal(DEFAULT_BEFORE_QUALITY,'good');
  assert.deepEqual(normalizeSequence({before:DEFAULT_BEFORE_DECK,after:'invalid'}),{before:DEFAULT_BEFORE_DECK,beforeLength:'full',beforeQuality:'good',after:null});
  assert.deepEqual(normalizeSequence({before:DEFAULT_BEFORE_DECK,beforeLength:'short',beforeQuality:'best'}),{before:DEFAULT_BEFORE_DECK,beforeLength:'short',beforeQuality:'best',after:null});
  assert.equal(isDeckAsset('admira-2026','en-slide-42.webp'),true);assert.equal(isDeckAsset('admira-2026','best-avatar.webp'),true);assert.equal(isDeckAsset('admira-2026','secret.pdf'),false);
});

test('generator and presentation route expose the before-proposal-after sequence',async()=>{
  const [generator,presentation,middleware]=await Promise.all([
    readFile(new URL('../assets/presentation-generator-20260721-10.js',import.meta.url),'utf8'),
    readFile(new URL('../functions/presentaciones/[client]/presentacion.js',import.meta.url),'utf8'),
    readFile(new URL('../functions/presentaciones/_middleware.js',import.meta.url),'utf8')
  ]);
  assert.match(generator,/Secuencia de la presentación/);assert.match(generator,/beforeDeck/);assert.match(generator,/beforeLength/);assert.match(generator,/beforeQuality/);assert.match(generator,/Completa · 42/);assert.match(generator,/Good · Look & feel Admira/);assert.match(generator,/Better · Dirección Codex/);assert.match(generator,/Best · Web o película elegida/);assert.match(generator,/afterDeck/);assert.match(generator,/defaultBefore/);
  assert.match(presentation,/beforeSlides/);assert.match(presentation,/afterSlides/);assert.match(presentation,/data-segment="proposal"/);assert.match(presentation,/data-deck-image/);assert.match(presentation,/data-src-good-es/);assert.match(presentation,/data-src-better-es/);assert.match(presentation,/data-src-best-es/);assert.match(presentation,/__ADMIRA_APPLY_QUALITY__/);assert.match(presentation,/sequenceNav/);
  assert.match(middleware,/isDeckAssets/);assert.match(middleware,/isBrandAssets/);
});

test('a client presentation renders the curated decks around the dynamic proposal',async()=>{
  const config={displayName:'Demo',outputs:['website'],languages:['es','ca','en'],theme:{},sequence:{before:'admira-2026-corporate',beforeLength:'full',beforeQuality:'best',after:'admira-2026-vision-xaas'}};
  const ideas={hero:{title:'Propuesta',summary:'Resumen'},objective:'Objetivo',skeleton:[],closing:{title:'Cierre',action:'Acción'},labels:{objective:'Objetivo',next:'Siguiente'}};
  const imageSet={slides:[{status:'ready',textFreeVerified:true,url:'/presentaciones/demo/images/site-inspired.jpg'}]};
  const response=await renderPresentation({params:{client:'demo'},env:{PRESENTATION_IDEAS:kv({'presentation:demo':config,'ideas:demo':ideas,'image-set:demo':imageSet})},next(){throw new Error('unexpected next')}}),html=await response.text();
  assert.equal((html.match(/data-segment="before"/g)||[]).length,42);assert.equal((html.match(/data-segment="after"/g)||[]).length,3);
  assert.match(html,/data-segment="proposal"/);assert.match(html,/data-src-better-es="\/presentaciones\/demo\/deck\/admira-2026\/best-team\.webp"/);assert.match(html,/data-src-best-es="\/presentaciones\/demo\/images\/site-inspired\.jpg"/);assert.match(html,/data-title-ca="Qui som"/);assert.match(html,/data-src-good-en=/);
});

test('private deck assets only serve catalogued WebP files',async()=>{
  const body=new Uint8Array([1,2,3]),bucket={async get(key){return key.endsWith('es-slide-01.webp')?{body,writeHttpMetadata(){}}:null}};
  const ok=await serveDeckAsset({params:{collection:'admira-2026',file:'es-slide-01.webp'},env:{PRESENTATION_MEDIA:bucket}});assert.equal(ok.status,200);assert.equal(ok.headers.get('content-type'),'image/webp');
  const denied=await serveDeckAsset({params:{collection:'admira-2026',file:'secret.pdf'},env:{PRESENTATION_MEDIA:bucket}});assert.equal(denied.status,404);
});
