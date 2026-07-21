import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {DEFAULT_PRESENTATION_PASSWORD, ensureHttpsUrl} from '../functions/presentaciones/_defaults.js';
import {DEFAULT_OUTPUTS, OUTPUTS} from '../functions/presentaciones/_generation.js';

test('generator URLs are upgraded to HTTPS when the scheme is absent or insecure',()=>{
  assert.equal(ensureHttpsUrl('ejemplo.com/inspiracion'),'https://ejemplo.com/inspiracion');
  assert.equal(ensureHttpsUrl('http://ejemplo.com'),'https://ejemplo.com');
  assert.equal(ensureHttpsUrl('https://ejemplo.com'),'https://ejemplo.com');
  assert.equal(ensureHttpsUrl(''), '');
});

test('default production is website plus working document',()=>{
  assert.deepEqual(DEFAULT_OUTPUTS,['website','documents']);
  assert.ok(OUTPUTS.includes('backgrounds'));
});

test('the endearing fallback password and clipboard explanation stay aligned',async()=>{
  assert.equal(DEFAULT_PRESENTATION_PASSWORD,'AdmiraNeXT;)');
  assert.ok(DEFAULT_PRESENTATION_PASSWORD.length>=10);
  const script=await readFile(new URL('../assets/presentation-generator-20260721-9.js',import.meta.url),'utf8');
  assert.match(script,/navigator\.clipboard\?\.readText/);
  assert.match(script,/débil, pero entrañable/);
  assert.match(script,/value="website" checked/);
  assert.match(script,/value="documents" checked/);
  assert.match(script,/value="backgrounds"/);
  assert.match(script,/Imágenes de fondo/);
  for(const output of ['audio','video','pdf','powerpoint','infographic','backgrounds']){
    assert.doesNotMatch(script,new RegExp(`value="${output}" checked`));
  }
});
