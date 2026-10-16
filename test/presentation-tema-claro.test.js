// 16-oct-2026 · demo-alsea-16-oct (Carlos: «los fondos siempre claros con el logo de Starbucks»).
// Con theme.mode==='light' la sala no puede pintar negro a sangre en GOOD/BETTER/BEST ni perder el logo de marca;
// con theme.mode==='dark' el render NO cambia (ni CSS claro ni logo por lámina).
import test from 'node:test';
import assert from 'node:assert/strict';
import {onRequestGet as renderPresentation} from '../functions/presentaciones/[client]/presentacion.js';

function kv(values){return{async get(key,options){const value=values[key];return options?.type==='json'?value:JSON.stringify(value)}}}
const ideas={hero:{title:'Propuesta',summary:'Resumen'},objective:'Objetivo',skeleton:[{id:'uno',title:'Uno',message:'M',detail:'D'}],closing:{title:'Cierre',action:'Acción'},labels:{objective:'Objetivo',next:'Siguiente'}};
const media=[{slide:'uno',type:'video',src:'/presentaciones/demo/media/uno.mp4',caption:'Uno',fallback:'x',preload:'metadata'}];
async function render(theme){
  const config={displayName:'Demo',outputs:['website'],languages:['es'],brand:{logoUrl:'/presentaciones/demo/brand/logo'},theme,sequence:{},slideMedia:media};
  const response=await renderPresentation({params:{client:'demo'},env:{PRESENTATION_IDEAS:kv({'presentation:demo':config,'ideas:demo':ideas})},next(){throw new Error('unexpected next')}});
  return response.text();
}

test('tema claro: variables y fondos del tema pisan los de calidad (BEST/BETTER/GOOD) y el vídeo no pinta negro',async()=>{
  const html=await render({mode:'light',primary:'#006241',accent:'#006241',background:'#ffffff',surface:'#ffffff',text:'#142238'});
  assert.match(html,/<html[^>]* data-mode="light"/);
  assert.match(html,/html\[data-mode="light"\]\[data-quality\]\{--primary:#006241;--accent:#006241;--bg:#ffffff;--surface:#ffffff;--ink:#142238\}/);
  assert.match(html,/html\[data-mode="light"\]\[data-quality\] \.slide:not\(\.deck-slide\)\{background:radial-gradient\([^;]*var\(--bg\);color:var\(--ink\)\}/);
  assert.match(html,/html\[data-mode="light"\] \.slide-media\{background:var\(--bg\)/);
  assert.match(html,/html\[data-mode="light"\] \.slide-media:after\{display:none\}/);
  assert.match(html,/html\[data-mode="light"\]\[data-quality="best"\] \.best-figure video,[^{]*\{background:var\(--surface\)\}/);
  // El bloque claro va DESPUÉS de los de calidad para ganar a igual especificidad.
  assert.ok(html.lastIndexOf('html[data-mode="light"][data-quality]{--primary')>html.indexOf('html[data-quality="best"]{--primary:#0b1220'));
});

test('tema claro: el logo de marca (brand.logo) aparece en la esquina de cada lámina',async()=>{
  const html=await render({mode:'light',background:'#ffffff',surface:'#ffffff',text:'#142238'});
  const slides=html.match(/<section class="slide[^"]*"/g)||[];
  const logos=html.match(/<img class="slide-brand" src="\/presentaciones\/demo\/brand\/logo"/g)||[];
  assert.ok(slides.length>=4);
  assert.equal(logos.length,slides.length);
  assert.match(html,/html\[data-mode="light"\] \.slide-brand\{position:absolute;/);
});

test('tema oscuro: sin cambios (ni CSS claro ni logo por lámina)',async()=>{
  const html=await render({mode:'dark'});
  assert.doesNotMatch(html,/html\[data-mode="light"\]/);
  assert.doesNotMatch(html,/class="slide-brand"/);
  assert.match(html,/html\[data-quality="best"\]\{--primary:#0b1220;--accent:#ffbe2e;--bg:#05080f/);
});
