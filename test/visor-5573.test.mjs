import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const leer = (ruta) => readFile(new URL(ruta, import.meta.url), 'utf8');

test('el visor de Walt: contorno, foco, sin caja y textos nuevos', async () => {
  const html = await leer('../pruebas/visor/index.html');
  const demo = await leer('../pruebas/visor/demo/index.html');
  const css = await leer('../pruebas/visor/visor.css');
  const js = await leer('../pruebas/visor/visor.js');
  const ficha = await leer('../pruebas/visor/instalar/index.html');

  assert.match(css, /background:\s*transparent/);
  assert.match(css, /border:\s*2px solid var\(--visor-acento/);
  assert.match(css, /color:\s*#fff/);
  assert.doesNotMatch(css, /background:\s*#111/);
  assert.match(html, /id="btnAhora"[^>]*autofocus|autofocus[^>]*id="btnAhora"/);
  assert.match(html, /class="focused"/);
  assert.match(html, /Ahora en pantalla/);
  assert.match(html, /Now on screen/);
  assert.match(html, /Esperando contenido/);
  assert.match(html, /Waiting for content/);
  assert.match(html, /data-l="es">\/ayuda</);
  assert.match(html, /data-l="en">\/help</);
  assert.match(html, /Pantalla sin asignar/);
  assert.match(demo, /data-l="en">\/help</);
  assert.ok(demo.indexOf('id="detalle"') < demo.indexOf('id="marca"'));
  assert.match(demo, /id="nota"/);
  assert.match(css, /color-mix\(in srgb, var\(--visor-acento[^)]*\) 20%/);
  assert.match(css, /\.detalle\.suave[\s\S]*font-size:\s*20px/);
  assert.match(js, /Pantalla sin asignar/);
  assert.match(js, /getElementById\('nota'\)/);
  assert.doesNotMatch(js, /Pantalla ['"] \+/);
  assert.match(ficha, /margin:\s*16px auto 0/);
  assert.doesNotMatch(html, /<input|id="orden"|\/marca frescaria/);
  assert.doesNotMatch(demo, /<input|id="orden"/);
  assert.match(demo, /Demo sin conexión/);
  assert.match(demo, /class="aviso hay"/);
  assert.match(js, /Ahora en pantalla/);
  assert.match(js, /Now on screen/);
  assert.match(js, /Esperando contenido/);
  assert.match(js, /\/\(marca\|brand\|idioma\|language\)/);
  assert.match(js, /\/demo/);
  assert.match(js, /\/\(ayuda\|help\)/);
  assert.match(ficha, /Copiar enlace/);
  assert.match(ficha, /class="url"/);
  assert.match(ficha, /color:\s*#8d8d8d/);
});
