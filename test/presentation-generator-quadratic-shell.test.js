import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {onRequestGet} from '../functions/presentaciones/generador.js';

test('generator route injects the quadratic shell without replacing the form',async()=>{
  const source='<!doctype html><html><head><title>Generator</title></head><body><form id="generator"><input name="displayName"></form><script src="/assets/presentation-generator.js"></script></body></html>';
  const response=await onRequestGet({request:new Request('https://admiranext.test/presentaciones/generador/'),env:{ASSETS:{fetch:async()=>new Response(source)}}});
  const html=await response.text();
  assert.match(html,/presentation-generator-20260721-11\.js/);
  assert.match(html,/presentation-generator-quadratic\.css\?v=1/);
  assert.match(html,/presentation-generator-quadratic\.js\?v=1/);
  assert.match(html,/form id="generator"/);
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
});
