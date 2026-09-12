import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {onRequestGet} from '../functions/presentaciones/index.js';
import {onRequestGet as legacyGenerator} from '../functions/presentaciones/generador.js';

test('generator route injects the quadratic shell without replacing the form',async()=>{
  const source='<!doctype html><html><head><title>Generator</title></head><body><form id="generator"><input name="displayName"></form><script src="/assets/presentation-generator.js"></script></body></html>';
  const response=await onRequestGet({request:new Request('https://admiranext.test/presentaciones/'),env:{ASSETS:{fetch:async()=>new Response(source)}}});
  const html=await response.text();
  assert.match(html,/presentation-generator-20260721-11\.js/);
  assert.match(html,/presentation-generator-quadratic\.css\?v=2/);
  assert.match(html,/presentation-generator-quadratic\.js\?v=2/);
  assert.match(html,/form id="generator"/);
});

test('presentaciones is the canonical generator entry',async()=>{
  const response=await legacyGenerator({request:new Request('https://admiranext.test/presentaciones/generador/?source=brief'),env:{}});
  assert.equal(response.status,308);
  assert.equal(response.headers.get('location'),'https://admiranext.test/presentaciones/?source=brief');
});

test('quadratic generator exposes the three requested navigation surfaces',async()=>{
  const [script,styles]=await Promise.all([
    readFile(new URL('../assets/presentation-generator-quadratic.js',import.meta.url),'utf8'),
    readFile(new URL('../assets/presentation-generator-quadratic.css',import.meta.url),'utf8')
  ]);
  for(const id of ['generatorOptionsToggle','generatorAdvancedToggle','generatorExpertToggle','generatorOptionsRail','generatorAdvancedRail','generatorExpertRail'])assert.match(script,new RegExp(id));
  assert.match(script,/aria-controls/);
  assert.match(script,/aria-expanded/);
  assert.match(styles,/generator-side-drawer\.left/);
  assert.match(styles,/generator-side-drawer\.right/);
  assert.match(styles,/generator-bottom-drawer/);
  assert.match(script,/href="\/presentaciones\/galeria\/"/);
});

test('home del generador tiene un botón visible al listado vivo, no un chip que vuelve a sí mismo', async () => {
  const [script, styles, html] = await Promise.all([
    readFile(new URL('../assets/presentation-generator-quadratic.js', import.meta.url), 'utf8'),
    readFile(new URL('../assets/presentation-generator-quadratic.css', import.meta.url), 'utf8'),
    readFile(new URL('../presentaciones/generador.html', import.meta.url), 'utf8')
  ]);
  assert.match(script, /id="generatorOpenListado"/);
  assert.match(script, /href="\/presentaciones\/galeria#registroVivo"/);
  assert.match(script, />Ver presentaciones<\/a>/);
  assert.doesNotMatch(script, /class="generator-back" href="\/presentaciones\/"/);
  assert.match(html, /href="\/presentaciones\/galeria#registroVivo"/);
  assert.match(html, />Ver presentaciones<\/a>/);
  assert.match(styles, /\.generator-listado\{/);
  assert.doesNotMatch(styles, /\.generator-listado\{display:none/);
  const mobile = styles.match(/@media\(max-width:680px\)\{[\s\S]*?\}/);
  assert.ok(mobile, 'hay reglas móviles');
  assert.doesNotMatch(mobile[0], /generator-listado\{display:none/);
});
