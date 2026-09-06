import test from 'node:test';
import assert from 'node:assert/strict';
import {onRequestGet as renderPresentation} from '../functions/presentaciones/[client]/presentacion.js';

// FLT-100018 b (Carlos, 6-sep-2026: «presentarlo bien y rápido»). El deck se lleva en PDF al
// vuelo por impresión —una lámina por página, sin barras ni webs vivas— y se pasa de lámina
// con un gesto horizontal en pantallas táctiles. Nada de esto depende del productor.
function kv(values){
  return {async get(key,options){const value=values[key];if(value==null)return null;return options?.type==='json'?value:JSON.stringify(value)}};
}
const ideas={
  hero:{title:'Propuesta',summary:'Resumen'},objective:'Objetivo',
  skeleton:[{id:'uno',title:'Idea',message:'Mensaje',detail:'Detalle',enabled:true}],
  closing:{title:'Cierre',action:'Acción'},labels:{objective:'Objetivo',next:'Siguiente'},notes:'Privado',
  embeds:[{id:'web',title:'XpaceOS en vivo',url:'https://www.xpaceos.com/',host:'www.xpaceos.com'}]
};
async function deck(config, query=''){
  const env={PRESENTATION_IDEAS:kv({'presentation:demo':config,'ideas:demo':ideas})};
  const response=await renderPresentation({params:{client:'demo'},request:new Request('https://admiranext.test/presentaciones/demo/presentacion'+query),env,next(){throw new Error('unexpected next')}});
  return response.text();
}
const config={displayName:'Demo',outputs:['website'],languages:['es','en'],theme:{},sequence:{}};

test('el deck ofrece PDF nativo: botón, tecla P y estilos de impresión con una lámina por página', async () => {
  const html=await deck(config);
  assert.match(html,/<button type="button" class="deck-print" data-print aria-label="Descargar en PDF \(imprimir\)"/);
  assert.match(html,/@media print\{@page\{size:landscape/);
  assert.match(html,/\.slide\{min-height:0!important;height:auto!important;display:block!important;page-break-after:always/);
  assert.match(html,/\.top,nav,\.deck-print,\[data-client-fullscreen\],\.embed-activate,\.embed-frame/);
  assert.match(html,/print-color-adjust:exact/);
  assert.match(html,/event\.key\.toLowerCase\(\)==='p'&&!event\.metaKey&&!event\.ctrlKey/);
  assert.match(html,/querySelector\('\[data-print\]'\)\?\.addEventListener\('click'/);
});

test('las webs embebidas no se imprimen como iframe: queda su enlace', async () => {
  const html=await deck(config);
  assert.match(html,/\.embed-slide \.embed-out\{display:inline-block!important/);
  assert.match(html,/class="embed-out" href="https:\/\/www\.xpaceos\.com\/"/);
});

test('un gesto horizontal claro pasa de lámina y no roba el gesto a una web embebida', async () => {
  const html=await deck(config);
  assert.match(html,/addEventListener\('touchstart'/);
  assert.match(html,/Math\.abs\(dx\)<60\|\|Math\.abs\(dx\)<Math\.abs\(dy\)\*1\.2/);
  assert.match(html,/closest\('\.embed-frame,input,textarea,\[contenteditable\]'\)/);
  assert.match(html,/go\(at\+\(dx<0\?1:-1\)\)/);
});

test('la etiqueta del botón PDF sigue al idioma del deck', async () => {
  const html=await deck(config);
  assert.match(html,/"print":"Download as PDF \(print\)"/);
  assert.match(html,/botonPdf\.setAttribute\('aria-label',ui\.print\)/);
  const english=await deck({...config,languages:['en','es']});
  assert.match(english,/data-print aria-label="Download as PDF \(print\)"/);
});
