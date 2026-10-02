import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

// Carlos (2-oct-2026): «en la UX cuadrática siempre tienen que ser resizables las
// ventanas de opciones, avanzado y experto y hay que utilizar el logo de AdmiraNeXT».
const leer = (rel) => readFile(new URL('../' + rel, import.meta.url), 'utf8');
const LOGO = /<span class="yk-wm-admira">ADmira<\/span><span class="yk-wm-next"><span class="yk-wm-n">N<\/span><span class="yk-wm-e">e<\/span><span class="yk-wm-x">X<\/span><span class="yk-wm-t">T<\/span><\/span>/;

test('el armazón pone un tirador accesible en el borde interior de ☰, ▤ y ⌘', async () => {
  const js = await leer('assets/admira-frame.js');
  assert.match(js, /setAttribute\('role', 'separator'\)/);
  assert.match(js, /setAttribute\('tabindex', '0'\)/);
  for (const a of ['aria-valuenow', 'aria-valuemin', 'aria-valuemax', 'aria-orientation', 'aria-controls']) assert.match(js, new RegExp(a), a);
  for (const evento of ['pointerdown', 'pointermove', 'pointerup', 'dblclick', 'keydown']) assert.match(js, new RegExp(`'${evento}'`), evento);
  for (const tecla of ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End', 'Enter']) assert.match(js, new RegExp(`'${tecla}'`), tecla);
  assert.match(js, /admiranext_frame_sizes_v1/, 'el tamaño se recuerda entre páginas');
  assert.match(js, /LADOS\.forEach\(function \(lado\) \{\s*tirador\(lado\);/, 'los tres lados llevan tirador');
  assert.match(js, /closest\('\.yk-resize'\)/, 'soltar un arrastre no cuenta como clic fuera (no cierra los paneles)');
});

test('el CSS lee el tamaño elegido y coloca los tiradores en el borde interior', async () => {
  const css = await leer('assets/admira-frame.css');
  assert.match(css, /\.yk-rail-left\{ width: var\(--yk-w-left, var\(--yk-rail-w\)\)/);
  assert.match(css, /\.yk-rail-right\{ width: var\(--yk-w-right, var\(--yk-rail-w\)\)/);
  assert.match(css, /\.yk-rail-bottom\{ height: var\(--yk-h-bottom, var\(--yk-rail-h\)\) \}/);
  assert.match(css, /\.yk-resize-left\{ left: calc\(/);
  assert.match(css, /\.yk-resize-right\{ right: calc\(/);
  assert.match(css, /\.yk-resize-bottom\{[^}]*bottom: calc\(var\(--yk-h-bottom/);
  assert.match(css, /cursor: col-resize/);
  assert.match(css, /cursor: row-resize/);
  assert.match(css, /\.yk-open-left \.yk-resize-left, \.yk-open-right \.yk-resize-right, \.yk-open-bottom \.yk-resize-bottom\{ display: block \}/);
});

test('el canon lo declara obligatorio', async () => {
  const md = await leer('assets/admira-frame.md');
  assert.match(md, /Paneles redimensionables — OBLIGATORIO/);
  assert.match(md, /Logotipo — OBLIGATORIO/);
});

test('las cabeceras de la familia llevan el logotipo oficial, no «admiraNeXT.»', async () => {
  for (const rel of ['analitics/index.html', 'webmaster.html', 'usuarios.html', 'xpace/manage.html', 'proyectos/index.html', 'flota.html']) {
    const html = await leer(rel);
    const marca = html.match(/<a class="brand" href="\/"[^>]*>([\s\S]*?)<\/a>/);
    assert.ok(marca, `${rel}: tiene marca`);
    assert.match(marca[1], LOGO, `${rel}: logotipo oficial`);
    assert.doesNotMatch(marca[0], /admira<span>NeXT<\/span><i><\/i>/, `${rel}: sin el «admiraNeXT.» de antes`);
  }
  assert.match(await leer('assets/admira-frame.js'), /marcaCab\.innerHTML = LOGO/, 'el armazón corrige una cabecera que vuelva al logo viejo');
});

test('el Hub MCP adopta el armazón', async () => {
  const html = await leer('mcp/index.html');
  for (const slot of ['nav', 'left', 'right']) assert.match(html, new RegExp(`data-yk-slot="${slot}"`));
  assert.match(html, /data-yk-cli="on"/);
  const css = html.match(/admira-frame\.css\?v=([^"]+)"/), js = html.match(/admira-frame\.js\?v=([^"]+)" defer/);
  assert.ok(css && js && css[1] === js[1], 'css y js del armazón, misma clave');
  assert.doesNotMatch(html, /class="shell topbar"/, 'sin la barra propia de antes');
});
