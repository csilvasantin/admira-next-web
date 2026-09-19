// Hero «Game Boy» de la salida web (FLT-100646 · Carlos, 19-09-2026).
// Emulación look & feel de una referencia tipo voicebenchmarks: opt-in por theme.heroDevice='pocket'.
import test from 'node:test';
import assert from 'node:assert/strict';
import {onRequestGet as renderPresentation} from '../functions/presentaciones/[client]/presentacion.js';

function kv(values){return{async get(key,options){const value=values[key];return options?.type==='json'?value:JSON.stringify(value)}}}
const ideas={hero:{eyebrow:'ADmiraNeXT × Demo',title:'Propuesta',summary:'Resumen'},objective:'Objetivo',skeleton:[{id:'a',title:'Uno',message:'m',detail:'d'},{id:'b',title:'Dos',message:'m',detail:'d'}],closing:{title:'Cierre',action:'Acción'},labels:{objective:'Objetivo',next:'Siguiente'}};

async function render(theme){
  const config={displayName:'Café Río',outputs:['website'],languages:['es'],theme};
  const res=await renderPresentation({params:{client:'demo'},env:{PRESENTATION_IDEAS:kv({'presentation:demo':config,'ideas:demo':ideas,'image-set:demo':null})},next(){throw new Error('unexpected next')}});
  return res.text();
}

test('heroDevice="pocket" pinta la Game Boy con los datos del deck y carga VT323', async () => {
  const html=await render({heroDevice:'pocket',mode:'light',fontStyle:'serif'});
  assert.match(html,/class="slide pocket-hero"/,'monta la lámina pocket-hero');
  assert.match(html,/class="gbx-lcd"/,'tiene la pantalla LCD');
  assert.match(html,/DOT MATRIX WITH STEREO SOUND/);
  assert.match(html,/▶ Ver presentación/);
  assert.match(html,/family=VT323/,'carga la fuente pixel VT323');
  assert.match(html,/CAFÉ<\/b>|CAFÉ /,'el wordmark usa la primera palabra del cliente en mayúsculas');
  assert.match(html,/2 LÁMINAS \/ 1 IDIOMA/,'el contador refleja láminas e idiomas reales');
  // La lámina va ANTES de la portada (es el arranque).
  assert.ok(html.indexOf('pocket-hero') < html.indexOf('slide cover'),'la Game Boy abre el deck, antes de la portada');
});

test('sin heroDevice no hay Game Boy (no ensucia decks normales)', async () => {
  const html=await render({});
  assert.doesNotMatch(html,/pocket-hero/);
  assert.doesNotMatch(html,/gbx-lcd/);
  assert.doesNotMatch(html,/family=VT323/);
});

test('heroDevice inválido cae a none', async () => {
  const html=await render({heroDevice:'zzz'});
  assert.doesNotMatch(html,/pocket-hero/);
});
