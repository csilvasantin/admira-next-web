import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {onRequestGet} from '../functions/presentaciones/index.js';
import {onRequestGet as legacyGenerator} from '../functions/presentaciones/generador.js';

// Carlos (2-oct-2026, tras el PR #28): «no respeta la fórmula de la UX cuadrática ni el
// logo de AdmiraNeXT». El generador dejó de pintar barra propia y adoptó el armazón de
// la casa en modo barra. Carlos (3-oct-2026): «que Presentaciones lleve también la
// barra de la intranet» — ahora es el MODO CABECERA, la barra de /proyectos/:
//   [☰] ADmiraNeXT · Proyectos · … · Presentaciones … ● Acceso privado [▤] [⌘]
// con el logotipo oficial (libro-de-estilo.html §7.4). La igualdad carácter a carácter
// de la cabecera la vigila test/familia-analitics-cuadratica.test.js.

const leer = (rel) => readFile(new URL('../' + rel, import.meta.url), 'utf8');

test('generator route injects the house frame after the quadratic shell, without replacing the form', async () => {
  const source = '<!doctype html><html><head><title>Generator</title><style>.page{}</style></head><body><header class="top"></header><form id="generator"><input name="displayName"></form><script src="/assets/presentation-generator.js"></script></body></html>';
  const response = await onRequestGet({request: new Request('https://admiranext.test/presentaciones/'), env: {ASSETS: {fetch: async () => new Response(source)}}});
  const html = await response.text();
  assert.match(html, /presentation-generator-20260721-11\.js/);
  assert.match(html, /presentation-generator-quadratic\.css\?v=20261003-cabecera/);
  assert.match(html, /form id="generator"/);
  const shell = html.search(/<script src="\/assets\/presentation-generator-quadratic\.js\?v=20261003-cabecera"><\/script>/);
  const frame = html.search(/<script src="\/assets\/admira-frame\.js\?v=([^"]+)" defer><\/script>/);
  assert.ok(shell > 0 && frame > shell, 'el script cuadrático registra sus verbos ANTES de que cargue el armazón');
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

test('el generador lleva la barra de la intranet y declara ☰ Opciones, ▤ Avanzado y ⌘ Experto en su HTML', async () => {
  const [html, script, styles] = await Promise.all([leer('presentaciones/generador.html'), leer('assets/presentation-generator-quadratic.js'), leer('assets/presentation-generator-quadratic.css')]);
  // Modo cabecera: la cabecera del grupo es lo primero del <body>; ni barra propia ni rótulo.
  assert.match(html, /<body class="generator-quadratic" data-yk-frame="cabecera"><header class="yk-head" data-yk-head>/);
  assert.doesNotMatch(html, /<header class="top"/, 'sin la cabecera propia de antes («ADmiraNeXT · Generador» + «Catálogo»)');
  assert.doesNotMatch(html + script, /data-yk-slot="nav"|ykTitle|GENERADOR'/, 'sin rótulo «GENERADOR» ni pestañas propias en la barra');
  assert.doesNotMatch(script, /yk-framed|ykCli/, 'el modo cabecera ya trae el CLI y su paleta: el script no los fuerza');
  assert.doesNotMatch(styles, /--yk-(brand|bg|ink|line|bar-h)\s*:/, 'el generador no redefine la paleta ni las alturas de la barra: son las de /proyectos/');
  // ☰ = las páginas del generador (enlaces a otra página), bajo la navegación del grupo.
  const izq = html.match(/<nav data-yk-slot="left" data-yk-label="Presentaciones"[^>]*>([\s\S]*?)<\/nav>/);
  assert.ok(izq, '☰ trae el bloque «Presentaciones»');
  for (const href of ['/presentaciones/galeria', '/presentaciones/control/', '/marcablanca/', '/mcp/generador']) assert.match(izq[1], new RegExp(`href="${href}"`));
  assert.doesNotMatch(izq[1], /data-generator-target/, 'los atajos a secciones van en ▤, no en ☰');
  // ▤ = lo que trabaja sobre la página: estado, acciones y «Ir a».
  for (const [rotulo, id] of [['Estado de producción', 'generatorAdvancedSlot'], ['Ir a', 'generatorGoto']]) assert.match(html, new RegExp(`data-yk-slot="right" data-yk-label="${rotulo}" id="${id}"`));
  assert.match(html, /data-yk-slot="right" data-yk-label="Acciones"><button type="button" id="generatorValidate">[\s\S]*id="generatorCopyConfig"/);
  assert.match(script, /generatorDiagValidity/);
  assert.match(script, /data-generator-target/);
  // ⌘ = el resumen del motor junto al CLI, con los verbos del generador.
  assert.match(html, /data-yk-slot="bottom" id="generatorExpertSlot"[\s\S]*id="generatorExpertConsole"/);
  assert.match(script, /ADMIRA_FRAME_VERBS/, 'el generador registra sus verbos en el CLI');
  for (const verbo of ['validar', 'config', 'estado', 'seccion', 'galeria', 'accesos']) assert.match(script, new RegExp(`id:'${verbo}'`), `verbo /${verbo}`);
  for (const viejo of ['generatorOptionsToggle', 'generatorAdvancedToggle', 'generatorExpertToggle', 'generator-topbar', 'generator-mode-button', 'generator-top-brand'])
    assert.doesNotMatch(script + styles, new RegExp(viejo), `sin la barra propia de antes (${viejo})`);
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
