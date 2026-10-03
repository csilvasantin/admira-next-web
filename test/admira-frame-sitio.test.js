import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

// Ronda 3 del PR #34 (Carlos, 2-oct-2026): las páginas de admiranext.com que tenían
// cabecera propia pasan al armazón de la casa —logotipo oficial, ☰ a la izquierda,
// ▤ ⌘ a la derecha y paneles redimensionables—. Quedan fuera la portada, el libro de
// estilo, los decks de clientes, las redirecciones y la web clásica (old/).
const leer = (rel) => readFile(new URL('../' + rel, import.meta.url), 'utf8');

// Adoptan el armazón en modo automático (assets/admira-frame.md, «Modo automático»)
// con la barra PROPIA del armazón (rótulo de la página). Desde el 3-oct-2026 las
// páginas de contenido sencillas llevan además la barra del sitio (modo cabecera +
// automático): academia, consejero, filosofía, mandamientos, normativa, /help,
// /informes (+ el informe HandON), /telegram, /presentar y /consejo. Ésas las vigila
// test/familia-analitics-cuadratica.test.js (ADOPTADAS); éstas son las que quedan,
// con su propuesta en assets/admira-frame.md («Inventario de barras»).
export const AUTOMATICAS = [
  'creditos/index.html', 'credits-generator.html', 'impacto/index.html', 'marcablanca/index.html',
  'marcablanca/propuesta/index.html', 'presites/index.html', 'presites/generador/index.html',
  'presupuestos/index.html', 'signage-benchmarks.html', 'tiktok/index.html',
  'tiktok/publicar/index.html', 'tiktok/xtore.html', 'businessplan/index.html'
];

test('cada página con cabecera propia adopta el armazón en modo automático', async () => {
  for (const rel of AUTOMATICAS) {
    const html = await leer(rel);
    assert.match(html, /<body[^>]*data-yk-auto="on"/, `${rel}: data-yk-auto`);
    assert.match(html, /<body[^>]*data-yk-title="[^"]+"/, `${rel}: rótulo`);
    const css = html.match(/admira-frame\.css\?v=([^"]+)"/), js = html.match(/admira-frame\.js\?v=([^"]+)"/);
    assert.ok(css && js && css[1] === js[1], `${rel}: css y js del armazón con la misma clave`);
    // un solo camino a la home: la marca de la barra (los pies pueden enlazarla)
    const cuerpo = html.slice(html.indexOf('<body')).replace(/<footer[\s\S]*?<\/footer>/g, '');
    assert.doesNotMatch(cuerpo, /<a[^>]*href="(\/|\.\.\/)"[^>]*>\s*(←\s*)?admiranext\.com/i, `${rel}: sin un «← admiranext.com» que duplique la marca`);
    assert.doesNotMatch(cuerpo, /admira<span>NeXT<\/span><i><\/i>|ADmiraNeXT · (TikTok|Presites|Informes)<\/span>/, `${rel}: sin la marca propia de antes`);
  }
});

test('el modo automático da ☰ mapa del sitio, ▤ acciones e «Ir a», y ⌘ CLI', async () => {
  const js = await leer('assets/admira-frame.js');
  assert.match(js, /body\.dataset\.ykAuto === 'on'/);
  assert.match(js, /var SITIO = /, 'mapa del sitio en ☰');
  assert.match(js, /\[data-yk-accion\]/, 'acciones de la página en ▤');
  assert.match(js, /construirIrA/, '«Ir a» las secciones en ▤, rehecho al abrir');
  assert.match(js, /var hayCli = modoCabecera \|\| modoAuto/, 'CLI en ⌘');
  for (const v of ['ir', 'seccion', 'arriba']) assert.match(js, new RegExp(`verbo\\(\\{id: '${v}'`), `/${v}`);
  assert.doesNotMatch(js, /\['\/', 'Inicio'\]/, 'la home no se repite en ☰: su camino es la marca');
  const css = await leer('assets/admira-frame.css');
  assert.match(css, /html\.yk-auto\{/, 'paleta oscura fija: el logotipo siempre va sobre oscuro');
  assert.match(css, /@media print\{\s*\.yk-bar, \.yk-rail, \.yk-resize\{ display: none !important \}/, 'el armazón no sale al imprimir');
});

test('/status conserva su marco propio, con logotipo oficial, glifos del canon y asas por teclado', async () => {
  const html = await leer('status.html');
  assert.match(html, /<a class="brand" href="\/"[^>]*><span class="yk-wm-admira">ADmira<\/span><span class="yk-wm-next">/);
  assert.match(html, /id="tgRight"[^>]*>▤<\/button>/);
  assert.match(html, /id="tgBottom"[^>]*>⌘<\/button>/);
  for (const id of ['rzLeft', 'rzRight', 'rzBottom']) assert.match(html, new RegExp(`id="${id}" role="separator" tabindex="0"`), id);
  assert.match(html, /e\.key==='Enter'\)\{ e\.preventDefault\(\); opts\.reset\(\)/);
});

test('el Xpacio del Consejo (/game/) lleva el logotipo oficial', async () => {
  const html = await leer('game/index.html');
  assert.match(html, /<a class="brand" href="\/"[^>]*><span class="yk-wm-admira">ADmira<\/span>/);
});
