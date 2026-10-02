import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {onRequestGet} from '../functions/presentaciones/index.js';
import {onRequestGet as legacyGenerator} from '../functions/presentaciones/generador.js';

// Carlos (2-oct-2026, tras el PR #28): «no respeta la fórmula de la UX cuadrática ni el
// logo de AdmiraNeXT». El generador ya no pinta barra propia: adopta el armazón de la
// casa (assets/admira-frame.js, modo barra, el de /presentaciones/galeria):
//   [☰] ADmiraNeXT · GENERADOR · secciones …   [▤] [⌘]
// con el logotipo oficial (libro-de-estilo.html §7.4).

const leer = (rel) => readFile(new URL('../' + rel, import.meta.url), 'utf8');

test('generator route injects the house frame after the quadratic shell, without replacing the form', async () => {
  const source = '<!doctype html><html><head><title>Generator</title><style>.page{}</style></head><body><header class="top"></header><form id="generator"><input name="displayName"></form><script src="/assets/presentation-generator.js"></script></body></html>';
  const response = await onRequestGet({request: new Request('https://admiranext.test/presentaciones/'), env: {ASSETS: {fetch: async () => new Response(source)}}});
  const html = await response.text();
  assert.match(html, /presentation-generator-20260721-11\.js/);
  assert.match(html, /presentation-generator-quadratic\.css\?v=2/);
  assert.match(html, /form id="generator"/);
  const shell = html.search(/<script src="\/assets\/presentation-generator-quadratic\.js\?v=20261002-armazon"><\/script>/);
  const frame = html.search(/<script src="\/assets\/admira-frame\.js\?v=([^"]+)" defer><\/script>/);
  assert.ok(shell > 0 && frame > shell, 'el script cuadrático declara los slots ANTES de que el armazón los mude');
  const css = html.match(/<link rel="stylesheet" href="\/assets\/admira-frame\.css\?v=([^"]+)">/);
  assert.ok(css, 'carga el CSS del armazón');
  assert.equal(css[1], html.match(/admira-frame\.js\?v=([^"]+)"/)[1], 'css y js del armazón con la misma clave');
  const head = html.slice(0, html.indexOf('</head>'));
  assert.ok(head.lastIndexOf('<link rel="stylesheet"') === head.indexOf(css[0]), 'el CSS del armazón es el último del <head>');
});

test('presentaciones is the canonical generator entry', async () => {
  const response = await legacyGenerator({request: new Request('https://admiranext.test/presentaciones/generador/?source=brief'), env: {}});
  assert.equal(response.status, 308);
  assert.equal(response.headers.get('location'), 'https://admiranext.test/presentaciones/?source=brief');
});

test('el generador declara ☰ Opciones, ▤ Avanzado y ⌘ Experto para el armazón y no dibuja barra propia', async () => {
  const [script, styles] = await Promise.all([leer('assets/presentation-generator-quadratic.js'), leer('assets/presentation-generator-quadratic.css')]);
  for (const slot of ['nav', 'left', 'right', 'bottom']) assert.match(script, new RegExp(`data-yk-slot="${slot}"`), `slot ${slot}`);
  assert.match(script, /ykCli='on'/, '⌘ Experto lleva el CLI del armazón');
  assert.match(script, /ADMIRA_FRAME_VERBS/, 'el generador registra sus verbos en el CLI');
  for (const verbo of ['validar', 'config', 'estado', 'seccion']) assert.match(script, new RegExp(`id:'${verbo}'`), `verbo /${verbo}`);
  assert.match(script, /header\.top/, 'retira la cabecera propia del HTML');
  for (const viejo of ['generatorOptionsToggle', 'generatorAdvancedToggle', 'generatorExpertToggle', 'generator-topbar', 'generator-mode-button', 'generator-top-brand'])
    assert.doesNotMatch(script + styles, new RegExp(viejo), `sin la barra propia de antes (${viejo})`);
  // ☰ = navegación a otras páginas; ▤ = lo que trabaja sobre la página (estado, acciones, atajos).
  const izq = script.slice(script.indexOf('function optionsSlot('), script.indexOf('function advancedSlot('));
  const der = script.slice(script.indexOf('function advancedSlot('), script.indexOf('function expertSlot('));
  assert.match(izq, /href="\/presentaciones\/galeria"/);
  assert.doesNotMatch(izq, /data-generator-target/, 'los atajos a secciones van en ▤, no en ☰');
  assert.match(der, /generatorDiagValidity/);
  assert.match(der, /data-generator-target/);
});

test('el armazón pinta el logotipo oficial: «ADmira» en blanco y N·e·X·T en los cuatro neones', async () => {
  const [frame, css, libro] = await Promise.all([leer('assets/admira-frame.js'), leer('assets/admira-frame.css'), leer('libro-de-estilo.html')]);
  assert.match(frame, /yk-wm-admira">ADmira<\/span><span class="yk-wm-next"><span class="yk-wm-n">N<\/span><span class="yk-wm-e">e<\/span><span class="yk-wm-x">X<\/span><span class="yk-wm-t">T<\/span>/);
  const colores = {n: '#FF3366', e: '#FFCC00', x: '#33FF99', t: '#FF33CC'};
  for (const [letra, color] of Object.entries(colores)) {
    assert.match(css, new RegExp(`\\.yk-wm-${letra}\\{ color: ${color} \\}`), `${letra.toUpperCase()} en ${color}`);
    assert.match(libro, new RegExp(color, 'i'), `${color} es el del libro de estilo`);
  }
});
