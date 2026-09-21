// FLT-100792 (Morfeo, 21-sep-2026) · el resultado del alta, claro y sin sorpresas.
//
// a) Con la clave vacía se leía el portapapeles: un texto copiado por error se convertía en
//    la clave del cliente. Carlos decidió quitarlo: vacío = clave única del servidor.
// b) La acción principal del resultado depende del guion (xAI → ver el site; plantilla →
//    revisar el esqueleto antes de compartir), Grok se ofrece como opcional y el raíl ya no
//    manda «Acceso privado» al panel de soluciones embebidas.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const js = await readFile(new URL('../assets/presentation-generator-20260721-11.js', import.meta.url), 'utf8');
const html = await readFile(new URL('../presentaciones/generador.html', import.meta.url), 'utf8');
const rail = await readFile(new URL('../assets/presentation-generator-quadratic.js', import.meta.url), 'utf8');

test('a) la clave vacía no sale del portapapeles y el formulario lo dice', () => {
  assert.doesNotMatch(js, /clipboard\??\.readText/);
  const clave = js.slice(js.indexOf('async function resolvePassword('), js.indexOf('}', js.indexOf('return \'\'; // sin clave explícita')));
  assert.match(clave, /const explicit=passwordInput\.value\.trim\(\);if\(explicit\)return explicit;\s*return '';/);
  assert.match(js, /placeholder='Vacío = la generamos única para este cliente'/);
  assert.doesNotMatch(js, /portapapeles\. Si está vacío/);
  assert.match(html, /Copia la contraseña ahora: después no se vuelve a mostrar/);
});

test('b) la acción principal sigue al guion: xAI → site; plantilla → esqueleto', () => {
  assert.match(js, /const guionPropio=body\.narrativeSource==='xai'&&!openDeck\.hidden/);
  assert.match(js, /openDeck\.classList\.toggle\('primary',guionPropio\);openIdeas\.classList\.toggle\('primary',!guionPropio\)/);
});

test('b) Grok se ofrece como opción hasta que alguien lo pide', () => {
  assert.match(js, /:set\?\.startedAt\?`Continuar imágenes con Grok[^`]*`:`Opcional · crear \$\{total\} fondos con Grok`/);
});

test('b) el raíl asigna los paneles por título: «Acceso privado» ya no apunta a los embebidos', () => {
  const seccion = rail.slice(rail.indexOf('function registerSections('), rail.indexOf('function bind('));
  assert.doesNotMatch(seccion, /panels\[2\]\.id='generatorAccess'/);
  assert.match(seccion, /porTitulo\('Acceso privado'\)/);
  assert.match(seccion, /embebidos\.id='generatorEmbeds'/);
  // El JS renombra en vivo «2. Tesis e identidad» a «2. Inspiración e identidad»: se busca «identidad».
  assert.match(seccion, /identidad=porTitulo\('identidad'\)/);
  for (const titulo of ['1. Contexto del cliente', '2. Tesis e identidad', '3. Soluciones que se enseñan vivas', '4. Acceso privado']) {
    assert.ok(html.includes(`<h2>${titulo}</h2>`), `el HTML conserva el título «${titulo}» que busca el raíl`);
  }
});
