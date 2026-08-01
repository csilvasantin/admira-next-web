import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

test('admiranext ofrece el generador de informes como herramienta propia',async()=>{
  const html=await readFile(new URL('../informes/index.html',import.meta.url),'utf8');
  assert.match(html,/Generador de informes de AdmiraNeXT/);
  assert.match(html,/https:\/\/www\.admira\.live\/informes\//);
  assert.match(html,/Cifras verificadas/);
  assert.match(html,/las cifras no las inventa el modelo/i);
});

test('la ruta de informes está publicada en el sitemap',async()=>{
  const sitemap=await readFile(new URL('../sitemap.xml',import.meta.url),'utf8');
  assert.match(sitemap,/https:\/\/www\.admiranext\.com\/informes\//);
});
