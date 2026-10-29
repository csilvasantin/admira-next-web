// Locución en castellano de /demo luka (misión DCL-fb1c7a60, 29-oct-2026).
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';

const code = await readFile(new URL('../pruebas/mapa/locucion-demo.js', import.meta.url), 'utf8');

function mount({activated = false} = {}) {
  const spoken = [], cancels = [];
  const button = {hidden:true, textContent:'', attributes:{}, listeners:{}, setAttribute(k, v){this.attributes[k] = v;}, addEventListener(k, fn){this.listeners[k] = fn;}, click(){this.listeners.click();}};
  class Utterance {constructor(text){this.text = text;}}
  const voices = [{name:'Mónica', lang:'es-ES'}, {name:'Google español', lang:'es-ES'}, {name:'Paulina', lang:'es-MX'}, {name:'Samantha', lang:'en-US'}];
  const context = vm.createContext({document:{}, console, SpeechSynthesisUtterance:Utterance,
    speechSynthesis:{getVoices:() => voices, speak:u => spoken.push(u), cancel:() => cancels.push(1)}});
  context.window = context;
  vm.runInContext(code, context);
  const T = (es) => es;
  const narrator = context.AdmiraMapaLocucion.create({button, T, activated});
  return {narrator, button, spoken, cancels, api:context.AdmiraMapaLocucion};
}

test('una frase por oficina; la primera parada de la primera vuelta es la presentación', () => {
  const {api} = mount();
  assert.equal(api.lineFor({id:'pixeria', index:0, lap:0}), 'intro');
  assert.equal(api.lineFor({id:'pixeria', index:0, lap:1}), 'pixeria');
  assert.equal(api.lineFor({id:'university', index:1, lap:0}), 'university');
  assert.equal(api.lineFor({id:'zona-7', index:2, lap:0}), null, 'una zona sin frase no habla');
  assert.match(api.lines.university, /negocio/);assert.match(api.lines.intro, /Luka/);assert.match(api.lines['la-nave'], /tecnología/);
});

test('elige voz de España y, si la hay, la de Google', () => {
  const {api} = mount();
  assert.equal(api.pickVoice([{name:'Mónica', lang:'es-ES'}, {name:'Google español', lang:'es-ES'}]).name, 'Google español');
  assert.equal(api.pickVoice([{name:'Paulina', lang:'es-MX'}, {name:'Mónica', lang:'es_ES'}]).name, 'Mónica');
  assert.equal(api.pickVoice([{name:'Paulina', lang:'es-MX'}]).name, 'Paulina');
  assert.equal(api.pickVoice([{name:'Samantha', lang:'en-US'}]), null);
});

test('sin gesto no habla: el botón pide activarla y entonces dice la frase de la parada actual', () => {
  const {narrator, button, spoken} = mount();
  assert.equal(button.hidden, false);assert.equal(button.textContent, '🔊 Activar locución');
  narrator.onStop({id:'pixeria', index:0, lap:0});
  assert.equal(spoken.length, 0, 'el navegador lo bloquearía');
  narrator.onStop({id:'university', index:1, lap:0});
  button.click();
  assert.equal(spoken.length, 1);assert.match(spoken[0].text, /Admira University/);assert.equal(spoken[0].lang, 'es-ES');assert.equal(spoken[0].voice.name, 'Google español');
  assert.equal(button.textContent, '🔊 Locución');assert.equal(button.attributes['aria-pressed'], 'true');
});

test('con gesto habla en cada parada, corta la anterior y se puede silenciar', () => {
  const {narrator, button, spoken, cancels} = mount({activated:true});
  narrator.onStop({id:'pixeria', index:0, lap:0});narrator.onStop({id:'university', index:1, lap:0});
  assert.deepEqual(spoken.map(u => u.text.slice(0, 12)), ['Esta es Luka', 'Luka llega a']);
  assert.ok(cancels.length >= 2, 'cada frase corta la anterior');
  button.click();
  assert.equal(button.textContent, '🔇 Locución');
  narrator.onStop({id:'garage', index:2, lap:0});
  assert.equal(spoken.length, 2, 'silenciada no habla');
});
