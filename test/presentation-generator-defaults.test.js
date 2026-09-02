import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createPresentationPassword, ensureHttpsUrl} from '../functions/presentaciones/_defaults.js';
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
  assert.ok(OUTPUTS.includes('credits'));
  assert.ok(OUTPUTS.includes('postcredits'));
});

test('every presentation gets its own password, and the form explains it',async()=>{
  // La clave compartida 'AdmiraNeXT;)' abría todas las presentaciones con slug adivinable.
  // Este test es el que impide que vuelva: cada llamada da una clave distinta y suficiente.
  const primera=createPresentationPassword(), segunda=createPresentationPassword();
  assert.notEqual(primera,segunda);
  assert.ok(primera.length>=10);
  assert.match(primera,/^AdmiraNeXT-[A-Za-z2-9]{12}$/);
  assert.doesNotMatch(primera,/AdmiraNeXT;\)/);
  const cien=new Set(Array.from({length:100},()=>createPresentationPassword()));
  assert.equal(cien.size,100);
  const script=await readFile(new URL('../assets/presentation-generator-20260721-11.js',import.meta.url),'utf8');
  assert.match(script,/navigator\.clipboard\?\.readText/);
  assert.match(script,/generaremos una clave única para este cliente/);
  assert.doesNotMatch(script,/AdmiraNeXT;\)/);
  assert.match(script,/value="website" checked/);
  assert.match(script,/value="documents" checked/);
  assert.match(script,/value="backgrounds"/);
  assert.match(script,/value="credits"/);
  assert.match(script,/value="postcredits"/);
  assert.match(script,/Imágenes de fondo/);
  assert.match(script,/Postcréditos/);
  for(const output of ['audio','video','pdf','powerpoint','infographic','backgrounds','credits','postcredits']){
    assert.doesNotMatch(script,new RegExp(`value="${output}" checked`));
  }
});
