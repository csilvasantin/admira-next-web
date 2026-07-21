import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {DEFAULT_BEFORE_DECK,getDeckPack,isDeckAsset,listDeckPacks,normalizeSequence} from '../functions/presentaciones/_deck-library.js';
import {onRequestGet as renderPresentation} from '../functions/presentaciones/[client]/presentacion.js';
import {onRequestGet as serveDeckAsset} from '../functions/presentaciones/[client]/deck/[collection]/[file].js';

function kv(values){return{async get(key,options){const value=values[key];return options?.type==='json'?value:JSON.stringify(value)}}}

test('deck library exposes a curated corporate opening and optional XaaS close',()=>{
  const decks=listDeckPacks(),opening=getDeckPack(DEFAULT_BEFORE_DECK,'demo'),closing=getDeckPack('admira-2026-vision-xaas','demo');
  assert.equal(decks.length,2);assert.equal(opening.slides.length,11);assert.equal(closing.slides.length,3);
  assert.equal(opening.slides[0].url,'/presentaciones/demo/deck/admira-2026/slide-01.webp');
  assert.equal(opening.slides.at(-1).sourceSlide,21);
  assert.deepEqual(normalizeSequence({before:DEFAULT_BEFORE_DECK,after:'invalid'}),{before:DEFAULT_BEFORE_DECK,after:null});
  assert.equal(isDeckAsset('admira-2026','slide-42.webp'),true);assert.equal(isDeckAsset('admira-2026','secret.pdf'),false);
});

test('generator and presentation route expose the before-proposal-after sequence',async()=>{
  const [generator,presentation,middleware]=await Promise.all([
    readFile(new URL('../assets/presentation-generator.js',import.meta.url),'utf8'),
    readFile(new URL('../functions/presentaciones/[client]/presentacion.js',import.meta.url),'utf8'),
    readFile(new URL('../functions/presentaciones/_middleware.js',import.meta.url),'utf8')
  ]);
  assert.match(generator,/Secuencia de la presentación/);assert.match(generator,/beforeDeck/);assert.match(generator,/afterDeck/);assert.match(generator,/defaultBefore/);
  assert.match(presentation,/beforeSlides/);assert.match(presentation,/afterSlides/);assert.match(presentation,/data-segment="proposal"/);assert.match(presentation,/sequenceNav/);
  assert.match(middleware,/isDeckAssets/);assert.match(middleware,/isBrandAssets/);
});

test('a client presentation renders the curated decks around the dynamic proposal',async()=>{
  const config={displayName:'Demo',outputs:['website'],languages:['es'],theme:{},sequence:{before:'admira-2026-corporate',after:'admira-2026-vision-xaas'}};
  const ideas={hero:{title:'Propuesta',summary:'Resumen'},objective:'Objetivo',skeleton:[],closing:{title:'Cierre',action:'Acción'},labels:{objective:'Objetivo',next:'Siguiente'}};
  const response=await renderPresentation({params:{client:'demo'},env:{PRESENTATION_IDEAS:kv({'presentation:demo':config,'ideas:demo':ideas})},next(){throw new Error('unexpected next')}}),html=await response.text();
  assert.equal((html.match(/data-segment="before"/g)||[]).length,11);assert.equal((html.match(/data-segment="after"/g)||[]).length,3);
  assert.match(html,/data-segment="proposal"/);assert.match(html,/\/presentaciones\/demo\/deck\/admira-2026\/slide-01\.webp/);
});

test('private deck assets only serve catalogued WebP files',async()=>{
  const body=new Uint8Array([1,2,3]),bucket={async get(key){return key.endsWith('slide-01.webp')?{body,writeHttpMetadata(){}}:null}};
  const ok=await serveDeckAsset({params:{collection:'admira-2026',file:'slide-01.webp'},env:{PRESENTATION_MEDIA:bucket}});assert.equal(ok.status,200);assert.equal(ok.headers.get('content-type'),'image/webp');
  const denied=await serveDeckAsset({params:{collection:'admira-2026',file:'secret.pdf'},env:{PRESENTATION_MEDIA:bucket}});assert.equal(denied.status,404);
});
