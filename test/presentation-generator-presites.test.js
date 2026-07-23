import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

test('generator offers an optional ready Presite and keeps the no-intro path',async()=>{
  const script=await readFile(new URL('../assets/presentation-generator-20260721-11.js',import.meta.url),'utf8');
  assert.match(script,/id="presiteSlug"/);
  assert.match(script,/Sin Presite · abrir directamente el deck/);
  assert.match(script,/fetch\('\/presites\/api\/sites'/);
  assert.match(script,/site\.publication\?\.published===true\|\|site\.status==='review-ready'/);
  assert.match(script,/option\.disabled=!ready/);
  assert.match(script,/Biblioteca de Presites no disponible\. La presentación se generará sin intro\./);
});

test('generator sends the compatible Presite payload and uses the backend launch URL',async()=>{
  const script=await readFile(new URL('../assets/presentation-generator-20260721-11.js',import.meta.url),'utf8');
  assert.match(script,/data\.presiteSlug=presite\?\.slug\|\|''/);
  assert.match(script,/data\.presite=presite\?\{slug:presite\.slug\}:null/);
  assert.match(script,/launchUrl=body\.presite\?\.launchUrl/);
  assert.match(script,/openDeck\.href=launchUrl\|\|body\.deckUrl/);
  assert.match(script,/Abrir intro \+ presentación/);
  assert.match(script,/Skip visible desde el inicio/);
  assert.match(script,/prefers-reduced-motion:reduce/);
  assert.match(script,/role="status" aria-live="polite"/);
});
